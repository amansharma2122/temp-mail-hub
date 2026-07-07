
-- Ensure pg_cron / pg_net available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Mailbox storage tracking
ALTER TABLE public.mailboxes
  ADD COLUMN IF NOT EXISTS storage_bytes_used bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_bytes_limit bigint NOT NULL DEFAULT 10737418240, -- 10 GB
  ADD COLUMN IF NOT EXISTS is_full boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_quota_check_at timestamptz;

-- 2. received_emails attribution
ALTER TABLE public.received_emails
  ADD COLUMN IF NOT EXISTS mailbox_id uuid REFERENCES public.mailboxes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS raw_size_bytes integer;

CREATE INDEX IF NOT EXISTS idx_received_emails_mailbox_id ON public.received_emails(mailbox_id);

-- 3. Stats health log
CREATE TABLE IF NOT EXISTS public.stats_health_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,               -- 'ok' | 'partial' | 'error'
  source text NOT NULL DEFAULT 'get-public-stats',
  duration_ms integer,
  error_message text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stats_health_log TO authenticated;
GRANT ALL    ON public.stats_health_log TO service_role;

ALTER TABLE public.stats_health_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read stats health log" ON public.stats_health_log;
CREATE POLICY "Admins can read stats health log"
  ON public.stats_health_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stats_health_log_created_at ON public.stats_health_log(created_at DESC);

-- Prune old rows (keep 7 days)
CREATE OR REPLACE FUNCTION public.prune_stats_health_log()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.stats_health_log WHERE created_at < now() - interval '7 days';
$$;

-- 4. Reconcile email stats: monotonic GREATEST + IST-today true-up
CREATE OR REPLACE FUNCTION public.reconcile_email_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_ist_midnight_utc timestamptz := ((v_today::timestamp) AT TIME ZONE 'Asia/Kolkata');
  v_live_inboxes bigint;
  v_live_received bigint;
  v_live_today bigint;
  v_result jsonb;
BEGIN
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
END; $$;

-- 5. Reconcile per-mailbox storage from attributed received_emails
CREATE OR REPLACE FUNCTION public.reconcile_mailbox_storage()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated int := 0;
BEGIN
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
END; $$;

REVOKE ALL ON FUNCTION public.reconcile_email_stats() FROM public;
REVOKE ALL ON FUNCTION public.reconcile_mailbox_storage() FROM public;
GRANT EXECUTE ON FUNCTION public.reconcile_email_stats() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_mailbox_storage() TO service_role, authenticated;

-- 6. Backfill so counts reflect current data immediately
SELECT public.reconcile_email_stats();
SELECT public.reconcile_mailbox_storage();
