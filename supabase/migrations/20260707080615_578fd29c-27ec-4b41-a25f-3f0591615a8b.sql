
-- Gate reconcile_email_stats behind admin/service_role.
CREATE OR REPLACE FUNCTION public.reconcile_email_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_ist_midnight_utc timestamptz := ((v_today::timestamp) AT TIME ZONE 'Asia/Kolkata');
  v_live_inboxes bigint;
  v_live_received bigint;
  v_live_today bigint;
  v_result jsonb;
BEGIN
  -- Allow: admins, or unauthenticated invocations from cron/service_role
  -- (auth.uid() is NULL when called by the postgres/service role).
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  SELECT count(*) INTO v_live_inboxes FROM public.temp_emails;
  SELECT count(*) INTO v_live_received FROM public.received_emails;
  SELECT count(*) INTO v_live_today
    FROM public.received_emails
    WHERE received_at >= v_ist_midnight_utc;

  INSERT INTO public.email_stats (stat_key, stat_value) VALUES ('total_inboxes_created', v_live_inboxes)
  ON CONFLICT (stat_key) DO UPDATE
    SET stat_value = GREATEST(public.email_stats.stat_value, EXCLUDED.stat_value), updated_at = now();

  INSERT INTO public.email_stats (stat_key, stat_value) VALUES ('total_emails_received', v_live_received)
  ON CONFLICT (stat_key) DO UPDATE
    SET stat_value = GREATEST(public.email_stats.stat_value, EXCLUDED.stat_value), updated_at = now();

  INSERT INTO public.email_stats (stat_key, stat_value, stat_date) VALUES ('emails_today_ist', v_live_today, v_today)
  ON CONFLICT (stat_key) DO UPDATE
    SET stat_value = CASE
          WHEN public.email_stats.stat_date IS DISTINCT FROM v_today THEN v_live_today
          ELSE GREATEST(public.email_stats.stat_value, v_live_today)
        END,
        stat_date = v_today,
        updated_at = now();

  v_result := jsonb_build_object(
    'ist_date', v_today,
    'live_inboxes', v_live_inboxes,
    'live_received', v_live_received,
    'live_today', v_live_today,
    'reconciled_at', now()
  );

  INSERT INTO public.stats_health_log(status, source, details)
  VALUES ('ok', 'reconcile_email_stats', v_result);

  RETURN v_result;
END; $function$;

-- Gate reconcile_mailbox_storage the same way.
CREATE OR REPLACE FUNCTION public.reconcile_mailbox_storage()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_updated int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  WITH agg AS (
    SELECT mailbox_id, COALESCE(sum(COALESCE(raw_size_bytes,
      COALESCE(octet_length(html_body),0) + COALESCE(octet_length(body),0)
    )), 0)::bigint AS bytes
    FROM public.received_emails
    WHERE mailbox_id IS NOT NULL
    GROUP BY mailbox_id
  )
  UPDATE public.mailboxes m
     SET storage_bytes_used = a.bytes,
         is_full = (a.bytes >= m.storage_bytes_limit),
         updated_at = now()
    FROM agg a
   WHERE m.id = a.mailbox_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('mailboxes_updated', v_updated, 'reconciled_at', now());
END; $function$;

-- Revoke the broad default and grant only where needed.
REVOKE EXECUTE ON FUNCTION public.reconcile_email_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_mailbox_storage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_email_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_mailbox_storage() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.promote_mailbox_as_primary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_mailbox_as_primary(uuid) TO authenticated, service_role;

-- Admin-only helper: list mailboxes above a given quota fraction (default 90%).
CREATE OR REPLACE FUNCTION public.get_mailboxes_nearing_quota(p_threshold_pct numeric DEFAULT 90)
 RETURNS TABLE(
   id uuid, name text, is_primary boolean, is_full boolean,
   storage_bytes_used bigint, storage_bytes_limit bigint,
   percent_used numeric,
   recommended_action text,
   suggested_rotate_at timestamptz
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  WITH stats AS (
    SELECT
      m.id, m.name, m.is_primary, m.is_full,
      m.storage_bytes_used, m.storage_bytes_limit,
      CASE WHEN m.storage_bytes_limit > 0
        THEN round((m.storage_bytes_used::numeric / m.storage_bytes_limit) * 100, 2)
        ELSE 0 END AS pct,
      m.last_polled_at
    FROM public.mailboxes m
    WHERE m.is_active = true
      AND m.storage_bytes_limit > 0
  ),
  growth AS (
    -- Rough 24h byte growth per mailbox → project days-to-full → rotate recommendation.
    SELECT mailbox_id,
      COALESCE(sum(COALESCE(raw_size_bytes,
        COALESCE(octet_length(html_body),0) + COALESCE(octet_length(body),0))), 0)::bigint AS bytes_24h
    FROM public.received_emails
    WHERE received_at >= now() - interval '24 hours'
      AND mailbox_id IS NOT NULL
    GROUP BY mailbox_id
  )
  SELECT s.id, s.name, s.is_primary, s.is_full,
    s.storage_bytes_used, s.storage_bytes_limit, s.pct,
    CASE
      WHEN s.is_full THEN 'Full — promote another mailbox immediately'
      WHEN s.pct >= 95 THEN 'Rotate now or promote another active mailbox'
      WHEN s.pct >= p_threshold_pct THEN 'Plan rotation within the next 24 hours'
      ELSE 'OK'
    END AS recommended_action,
    CASE
      WHEN s.is_full THEN now()
      WHEN COALESCE(g.bytes_24h, 0) > 0 AND s.storage_bytes_limit > s.storage_bytes_used THEN
        now() + make_interval(secs =>
          ((s.storage_bytes_limit - s.storage_bytes_used)::numeric / g.bytes_24h) * 86400
        )
      ELSE NULL
    END AS suggested_rotate_at
  FROM stats s
  LEFT JOIN growth g ON g.mailbox_id = s.id
  WHERE s.pct >= p_threshold_pct
  ORDER BY s.pct DESC;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.get_mailboxes_nearing_quota(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mailboxes_nearing_quota(numeric) TO authenticated, service_role;
