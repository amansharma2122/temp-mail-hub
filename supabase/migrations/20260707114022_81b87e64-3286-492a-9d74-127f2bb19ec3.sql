ALTER TABLE public.friendly_widget_events
  DROP CONSTRAINT IF EXISTS friendly_widget_events_event_type_check;

ALTER TABLE public.friendly_widget_events
  ADD CONSTRAINT friendly_widget_events_event_type_check
  CHECK (event_type IN (
    'manual_open','auto_open','click','badge_shown',
    'anim_start','anim_complete','render_latency',
    'app_settings_latency','app_settings_toast',
    'realtime_email_latency','realtime_email_missed'
  ));

CREATE OR REPLACE FUNCTION public.validate_friendly_widget_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.event_type IN (
    'app_settings_latency','app_settings_toast',
    'realtime_email_latency','realtime_email_missed'
  ) THEN
    IF NEW.attention_effect IS NOT NULL AND length(NEW.attention_effect) > 200 THEN
      RAISE EXCEPTION 'telemetry label too long';
    END IF;
  ELSIF NEW.attention_effect IS NOT NULL
     AND NEW.attention_effect NOT IN
     ('none','pulse','glow','wiggle','bounce','ring','sparkle','confetti','ripple','rainbow','magnet') THEN
    RAISE EXCEPTION 'Invalid attention_effect on widget event';
  END IF;

  IF NEW.session_id IS NOT NULL AND length(NEW.session_id) > 120 THEN
    RAISE EXCEPTION 'session_id too long';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$fn$;