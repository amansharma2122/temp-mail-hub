
ALTER TABLE public.email_stats ADD COLUMN IF NOT EXISTS stat_date date;

INSERT INTO public.email_stats (stat_key, stat_value, stat_date) VALUES
  ('total_emails_generated', 591900, NULL),
  ('total_inboxes_created', 307, NULL),
  ('total_emails_received', 591900, NULL),
  ('emails_today_ist', 11100, ((now() AT TIME ZONE 'Asia/Kolkata')::date))
ON CONFLICT (stat_key) DO UPDATE
  SET stat_value = GREATEST(public.email_stats.stat_value, EXCLUDED.stat_value),
      stat_date = COALESCE(EXCLUDED.stat_date, public.email_stats.stat_date),
      updated_at = now();

CREATE OR REPLACE FUNCTION public.bump_inboxes_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.email_stats (stat_key, stat_value) VALUES ('total_inboxes_created', 1)
  ON CONFLICT (stat_key) DO UPDATE
    SET stat_value = public.email_stats.stat_value + 1, updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_inboxes_created ON public.temp_emails;
CREATE TRIGGER trg_bump_inboxes_created
  AFTER INSERT ON public.temp_emails
  FOR EACH ROW EXECUTE FUNCTION public.bump_inboxes_created();

CREATE OR REPLACE FUNCTION public.bump_emails_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  INSERT INTO public.email_stats (stat_key, stat_value) VALUES ('total_emails_received', 1)
  ON CONFLICT (stat_key) DO UPDATE
    SET stat_value = public.email_stats.stat_value + 1, updated_at = now();

  INSERT INTO public.email_stats (stat_key, stat_value, stat_date) VALUES ('emails_today_ist', 1, v_today)
  ON CONFLICT (stat_key) DO UPDATE
    SET stat_value = CASE
          WHEN public.email_stats.stat_date IS DISTINCT FROM v_today THEN 1
          ELSE public.email_stats.stat_value + 1
        END,
        stat_date = v_today,
        updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_emails_received ON public.received_emails;
CREATE TRIGGER trg_bump_emails_received
  AFTER INSERT ON public.received_emails
  FOR EACH ROW EXECUTE FUNCTION public.bump_emails_received();
