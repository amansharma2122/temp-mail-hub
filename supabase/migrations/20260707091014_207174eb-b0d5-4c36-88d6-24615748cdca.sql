-- 1) Extend widget events allowed types (telemetry samples)
ALTER TABLE public.friendly_widget_events
  DROP CONSTRAINT IF EXISTS friendly_widget_events_event_type_check;
ALTER TABLE public.friendly_widget_events
  ADD CONSTRAINT friendly_widget_events_event_type_check
  CHECK (event_type IN (
    'manual_open','auto_open','click','badge_shown',
    'anim_start','anim_complete','render_latency'
  ));

-- 2) Optional numeric sample column for render latency (ms) etc.
ALTER TABLE public.friendly_widget_events
  ADD COLUMN IF NOT EXISTS sample_ms integer;

-- 3) Server-side quota trigger — uses existing check_rate_limit primitive.
CREATE OR REPLACE FUNCTION public.enforce_friendly_widget_event_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_identifier text;
  v_headers text;
  v_ip text;
  v_allowed boolean;
  v_max int := 120;         -- max events per window
  v_window int := 60;       -- minutes
  v_setting jsonb;
BEGIN
  SELECT value INTO v_setting FROM public.app_settings
   WHERE key = 'rate_limit_friendly_widget_events'
   ORDER BY updated_at DESC LIMIT 1;
  IF v_setting IS NOT NULL THEN
    v_max    := COALESCE((v_setting->>'max_requests')::int, v_max);
    v_window := COALESCE((v_setting->>'window_minutes')::int, v_window);
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    v_identifier := 'fw_evt_user_' || NEW.user_id::text;
  ELSIF NEW.session_id IS NOT NULL THEN
    v_identifier := 'fw_evt_sess_' || NEW.session_id;
  ELSE
    v_headers := NULLIF(current_setting('request.headers', true), '');
    v_ip := NULLIF(split_part(COALESCE((COALESCE(v_headers,'{}'))::json->>'x-forwarded-for',''),',',1),'');
    v_identifier := 'fw_evt_ip_' || COALESCE(v_ip, 'unknown');
  END IF;

  v_allowed := public.check_rate_limit(v_identifier, 'friendly_widget_event', v_max, v_window);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Friendly widget event quota exceeded';
  END IF;

  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_enforce_friendly_widget_event_quota ON public.friendly_widget_events;
CREATE TRIGGER trg_enforce_friendly_widget_event_quota
  BEFORE INSERT ON public.friendly_widget_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_friendly_widget_event_quota();

-- 4) Widget settings validator — accept new admin fields
CREATE OR REPLACE FUNCTION public.validate_friendly_widget_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
  s text;
BEGIN
  IF NEW.key <> 'friendly_sites_widget' THEN
    RETURN NEW;
  END IF;
  v := COALESCE(NEW.value, '{}'::jsonb);

  FOREACH s IN ARRAY ARRAY['buttonLabel','tooltipText','badgeText','triggerIcon'] LOOP
    IF v ? s THEN
      IF jsonb_typeof(v -> s) <> 'string' THEN
        RAISE EXCEPTION 'Widget setting % must be a string', s;
      END IF;
      IF length(v ->> s) > 80 THEN
        RAISE EXCEPTION 'Widget setting % too long (max 80)', s;
      END IF;
      IF (v ->> s) ~ '<[^>]*script' THEN
        RAISE EXCEPTION 'Widget setting % may not contain script tags', s;
      END IF;
    END IF;
  END LOOP;

  IF v ? 'triggerIcon' AND length(v ->> 'triggerIcon') > 0
     AND (v ->> 'triggerIcon') !~ '^[A-Za-z][A-Za-z0-9]*$' THEN
    RAISE EXCEPTION 'triggerIcon must be alphanumeric icon name';
  END IF;

  IF v ? 'attentionEffect'
     AND (v ->> 'attentionEffect') NOT IN
     ('none','pulse','glow','wiggle','bounce','ring','sparkle','confetti','ripple','rainbow','magnet') THEN
    RAISE EXCEPTION 'Invalid attentionEffect';
  END IF;
  IF v ? 'animationType'
     AND (v ->> 'animationType') NOT IN ('slide','fade','bounce','flip','zoom') THEN
    RAISE EXCEPTION 'Invalid animationType';
  END IF;
  IF v ? 'colorScheme'
     AND (v ->> 'colorScheme') NOT IN ('primary','accent','gradient','glass') THEN
    RAISE EXCEPTION 'Invalid colorScheme';
  END IF;
  IF v ? 'size' AND (v ->> 'size') NOT IN ('small','medium','large') THEN
    RAISE EXCEPTION 'Invalid size';
  END IF;
  IF v ? 'position' AND (v ->> 'position') NOT IN ('left','right') THEN
    RAISE EXCEPTION 'Invalid position';
  END IF;
  IF v ? 'autoOpenDelayMs' THEN
    IF jsonb_typeof(v -> 'autoOpenDelayMs') <> 'number'
       OR (v ->> 'autoOpenDelayMs')::numeric < 0
       OR (v ->> 'autoOpenDelayMs')::numeric > 600000 THEN
      RAISE EXCEPTION 'autoOpenDelayMs must be 0..600000';
    END IF;
  END IF;
  IF v ? 'animationIntensity'
     AND (v ->> 'animationIntensity') NOT IN ('subtle','normal','lively') THEN
    RAISE EXCEPTION 'Invalid animationIntensity';
  END IF;
  IF v ? 'disableEffectsOnReducedMotion'
     AND jsonb_typeof(v -> 'disableEffectsOnReducedMotion') <> 'boolean' THEN
    RAISE EXCEPTION 'disableEffectsOnReducedMotion must be boolean';
  END IF;

  RETURN NEW;
END;
$function$;
