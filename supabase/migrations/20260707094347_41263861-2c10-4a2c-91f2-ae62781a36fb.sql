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
  v_max int := 120;
  v_window int := 60;
  v_setting jsonb;
  v_effect_cfg jsonb;
  v_key text;
BEGIN
  SELECT value INTO v_setting FROM public.app_settings
   WHERE key = 'rate_limit_friendly_widget_events'
   ORDER BY updated_at DESC LIMIT 1;

  IF v_setting IS NOT NULL THEN
    v_max    := COALESCE((v_setting->>'max_requests')::int, v_max);
    v_window := COALESCE((v_setting->>'window_minutes')::int, v_window);
  END IF;

  -- Per-attention_effect override, if configured.
  IF NEW.attention_effect IS NOT NULL AND v_setting IS NOT NULL
     AND v_setting ? 'per_effect'
     AND (v_setting->'per_effect') ? NEW.attention_effect THEN
    v_effect_cfg := v_setting -> 'per_effect' -> NEW.attention_effect;
    v_max    := COALESCE((v_effect_cfg->>'max_requests')::int, v_max);
    v_window := COALESCE((v_effect_cfg->>'window_minutes')::int, v_window);
    v_key := 'friendly_widget_event_fx_' || NEW.attention_effect;
  ELSE
    v_key := 'friendly_widget_event';
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

  v_allowed := public.check_rate_limit(v_identifier, v_key, v_max, v_window);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Friendly widget event quota exceeded';
  END IF;

  RETURN NEW;
END; $fn$;