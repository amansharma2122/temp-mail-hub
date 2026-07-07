
-- 1) Only one is_primary=true at a time
CREATE OR REPLACE FUNCTION public.enforce_single_primary_mailbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_primary IS TRUE THEN
    UPDATE public.mailboxes
       SET is_primary = false, updated_at = now()
     WHERE id <> NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_single_primary_mailbox ON public.mailboxes;
CREATE TRIGGER trg_enforce_single_primary_mailbox
  AFTER INSERT OR UPDATE OF is_primary ON public.mailboxes
  FOR EACH ROW WHEN (NEW.is_primary IS TRUE)
  EXECUTE FUNCTION public.enforce_single_primary_mailbox();

-- 2) Auto-promote next candidate when current primary is full or stalled
CREATE OR REPLACE FUNCTION public.enforce_single_active_mailbox()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current record;
  v_next record;
  v_need_switch boolean := false;
  v_reason text;
BEGIN
  SELECT * INTO v_current
    FROM public.mailboxes
   WHERE is_primary = true
   LIMIT 1;

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
   LIMIT 1;

  IF v_next IS NULL THEN
    RETURN jsonb_build_object('changed', false, 'reason', 'no_candidate', 'previous_primary', v_current.id);
  END IF;

  IF v_current IS NOT NULL THEN
    UPDATE public.mailboxes SET is_primary = false, updated_at = now() WHERE id = v_current.id;
  END IF;
  UPDATE public.mailboxes SET is_primary = true, updated_at = now() WHERE id = v_next.id;

  INSERT INTO public.admin_audit_logs(admin_user_id, action, table_name, record_id, details)
  VALUES (NULL, 'AUTO_PROMOTE_PRIMARY_MAILBOX', 'mailboxes', v_next.id,
    jsonb_build_object('reason', v_reason, 'previous_primary', v_current.id, 'new_primary', v_next.id));

  RETURN jsonb_build_object('changed', true, 'reason', v_reason,
    'previous_primary', v_current.id, 'new_primary', v_next.id);
END; $$;

REVOKE ALL ON FUNCTION public.enforce_single_active_mailbox() FROM public;
GRANT EXECUTE ON FUNCTION public.enforce_single_active_mailbox() TO service_role, authenticated;
