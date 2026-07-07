-- 1) Update widget-settings validator to allow new attention effects
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

  RETURN NEW;
END;
$function$;

-- 2) Update per-site validator to allow new attention effects
CREATE OR REPLACE FUNCTION public.validate_friendly_website()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.name IS NULL OR length(btrim(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Website name is required';
  END IF;
  IF length(NEW.name) > 80 THEN
    RAISE EXCEPTION 'Website name too long (max 80)';
  END IF;
  IF NEW.name ~ '<[^>]*script' THEN
    RAISE EXCEPTION 'Website name may not contain script tags';
  END IF;

  IF NEW.url IS NULL OR length(NEW.url) > 2048 THEN
    RAISE EXCEPTION 'URL missing or too long';
  END IF;
  IF NEW.url !~* '^https?://[a-z0-9]' THEN
    RAISE EXCEPTION 'URL must start with http:// or https://';
  END IF;
  IF NEW.url ~* '^(javascript:|data:|vbscript:)' THEN
    RAISE EXCEPTION 'Unsafe URL scheme rejected';
  END IF;

  IF NEW.icon_url IS NOT NULL THEN
    IF length(NEW.icon_url) > 2048 THEN
      RAISE EXCEPTION 'Icon URL too long';
    END IF;
    IF NEW.icon_url !~* '^https?://' THEN
      RAISE EXCEPTION 'Icon URL must be http(s)';
    END IF;
  END IF;

  IF NEW.icon_name IS NOT NULL THEN
    IF length(NEW.icon_name) > 60 OR NEW.icon_name !~ '^[A-Za-z][A-Za-z0-9]*$' THEN
      RAISE EXCEPTION 'Invalid icon name';
    END IF;
  END IF;

  IF NEW.description IS NOT NULL AND length(NEW.description) > 300 THEN
    RAISE EXCEPTION 'Description too long (max 300)';
  END IF;

  IF NEW.badge_text IS NOT NULL AND length(NEW.badge_text) > 12 THEN
    RAISE EXCEPTION 'Badge text too long (max 12)';
  END IF;

  IF NEW.attention_effect IS NOT NULL
     AND NEW.attention_effect NOT IN
     ('none','pulse','glow','wiggle','bounce','ring','sparkle','confetti','ripple','rainbow','magnet') THEN
    RAISE EXCEPTION 'Invalid attention_effect';
  END IF;

  IF NEW.max_badge_per_day < 0 OR NEW.max_badge_per_day > 100 THEN
    RAISE EXCEPTION 'max_badge_per_day must be between 0 and 100';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Harden friendly_widget_events RLS: explicit deny for updates/deletes by
--    non-admins, and validate attention_effect at insert time.
DROP POLICY IF EXISTS "widget_events_no_update" ON public.friendly_widget_events;
CREATE POLICY "widget_events_no_update"
  ON public.friendly_widget_events
  FOR UPDATE
  TO anon, authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "widget_events_no_delete" ON public.friendly_widget_events;
CREATE POLICY "widget_events_no_delete"
  ON public.friendly_widget_events
  FOR DELETE
  TO anon, authenticated
  USING (public.is_admin(auth.uid()));

-- Revoke unnecessary write privileges (RLS already blocks, but grants shouldn't invite it).
REVOKE UPDATE, DELETE ON public.friendly_widget_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_friendly_widget_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NEW.attention_effect IS NOT NULL
     AND NEW.attention_effect NOT IN
     ('none','pulse','glow','wiggle','bounce','ring','sparkle','confetti','ripple','rainbow','magnet') THEN
    RAISE EXCEPTION 'Invalid attention_effect on widget event';
  END IF;
  IF NEW.session_id IS NOT NULL AND length(NEW.session_id) > 120 THEN
    RAISE EXCEPTION 'session_id too long';
  END IF;
  -- Force created_at to server time to avoid clock spoofing.
  NEW.created_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_validate_friendly_widget_event ON public.friendly_widget_events;
CREATE TRIGGER trg_validate_friendly_widget_event
  BEFORE INSERT OR UPDATE ON public.friendly_widget_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_friendly_widget_event();
