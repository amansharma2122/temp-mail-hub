
-- Hard-guarantee at most one primary mailbox via partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS mailboxes_single_primary_uidx
  ON public.mailboxes ((true)) WHERE is_primary = true;

-- Rewrite enforce_single_active_mailbox to take a transactional advisory lock,
-- preventing two concurrent runs from racing on the primary flag.
CREATE OR REPLACE FUNCTION public.enforce_single_active_mailbox()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current record;
  v_next record;
  v_need_switch boolean := false;
  v_reason text;
BEGIN
  -- Advisory lock scoped to this transaction; releases on commit/rollback.
  -- Arbitrary 64-bit key: hashtext('mailboxes_primary_election').
  PERFORM pg_advisory_xact_lock(hashtext('mailboxes_primary_election'));

  SELECT * INTO v_current
    FROM public.mailboxes
   WHERE is_primary = true
   ORDER BY updated_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_current IS NULL THEN
    v_need_switch := true;
    v_reason := 'no_primary';
  ELSIF v_current.is_full THEN
    v_need_switch := true;
    v_reason := 'primary_full';
  ELSIF v_current.last_polled_at IS NOT NULL
        AND v_current.last_polled_at < now() - interval '2 hours' THEN
    v_need_switch := true;
    v_reason := 'primary_stalled';
  END IF;

  IF NOT v_need_switch THEN
    RETURN jsonb_build_object('changed', false, 'primary_id', v_current.id);
  END IF;

  SELECT * INTO v_next
    FROM public.mailboxes
   WHERE is_active = true
     AND is_full = false
     AND imap_host IS NOT NULL
     AND imap_user IS NOT NULL
     AND (v_current.id IS NULL OR id <> v_current.id)
   ORDER BY priority ASC, storage_bytes_used ASC
   LIMIT 1
   FOR UPDATE;

  IF v_next IS NULL THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'no_candidate',
      'previous_primary', v_current.id);
  END IF;

  -- Demote first to keep the partial unique index happy.
  IF v_current IS NOT NULL THEN
    UPDATE public.mailboxes SET is_primary = false, updated_at = now()
     WHERE id = v_current.id;
  END IF;
  UPDATE public.mailboxes SET is_primary = true, updated_at = now()
   WHERE id = v_next.id;

  INSERT INTO public.admin_audit_logs(admin_user_id, action, table_name, record_id, details)
  VALUES (NULL, 'AUTO_PROMOTE_PRIMARY_MAILBOX', 'mailboxes', v_next.id,
    jsonb_build_object('reason', v_reason,
      'previous_primary', v_current.id,
      'new_primary', v_next.id));

  RETURN jsonb_build_object('changed', true, 'reason', v_reason,
    'previous_primary', v_current.id, 'new_primary', v_next.id);
END; $function$;

-- Admin-callable helper to manually promote a mailbox as primary under the same lock.
CREATE OR REPLACE FUNCTION public.promote_mailbox_as_primary(p_mailbox_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prev uuid;
  v_target record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('mailboxes_primary_election'));

  SELECT id INTO v_prev FROM public.mailboxes WHERE is_primary = true LIMIT 1 FOR UPDATE;

  SELECT * INTO v_target FROM public.mailboxes WHERE id = p_mailbox_id FOR UPDATE;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Mailbox not found';
  END IF;

  IF v_prev IS NOT NULL AND v_prev <> p_mailbox_id THEN
    UPDATE public.mailboxes SET is_primary = false, updated_at = now() WHERE id = v_prev;
  END IF;
  UPDATE public.mailboxes SET is_primary = true, updated_at = now() WHERE id = p_mailbox_id;

  INSERT INTO public.admin_audit_logs(admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'MANUAL_PROMOTE_PRIMARY_MAILBOX', 'mailboxes', p_mailbox_id,
    jsonb_build_object('previous_primary', v_prev, 'new_primary', p_mailbox_id));

  RETURN jsonb_build_object('changed', true, 'previous_primary', v_prev,
    'new_primary', p_mailbox_id);
END; $function$;

GRANT EXECUTE ON FUNCTION public.promote_mailbox_as_primary(uuid) TO authenticated;
