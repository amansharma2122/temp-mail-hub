
ALTER TABLE public.friendly_websites
  ADD COLUMN IF NOT EXISTS attention_effect text,
  ADD COLUMN IF NOT EXISTS badge_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS badge_text text,
  ADD COLUMN IF NOT EXISTS auto_open_override boolean,
  ADD COLUMN IF NOT EXISTS max_badge_per_day integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.validate_friendly_website()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
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
     AND NEW.attention_effect NOT IN ('none','pulse','glow','wiggle','bounce','ring') THEN
    RAISE EXCEPTION 'Invalid attention_effect';
  END IF;

  IF NEW.max_badge_per_day < 0 OR NEW.max_badge_per_day > 100 THEN
    RAISE EXCEPTION 'max_badge_per_day must be between 0 and 100';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_validate_friendly_website ON public.friendly_websites;
CREATE TRIGGER trg_validate_friendly_website
  BEFORE INSERT OR UPDATE ON public.friendly_websites
  FOR EACH ROW EXECUTE FUNCTION public.validate_friendly_website();

CREATE OR REPLACE FUNCTION public.validate_friendly_widget_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
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
     AND (v ->> 'attentionEffect') NOT IN ('none','pulse','glow','wiggle','bounce','ring') THEN
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
$fn$;

DROP TRIGGER IF EXISTS trg_validate_friendly_widget_settings ON public.app_settings;
CREATE TRIGGER trg_validate_friendly_widget_settings
  BEFORE INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_friendly_widget_settings();

CREATE TABLE IF NOT EXISTS public.friendly_widget_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('manual_open','auto_open','click','badge_shown')),
  website_id uuid REFERENCES public.friendly_websites(id) ON DELETE SET NULL,
  attention_effect text,
  session_id text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friendly_widget_events_created ON public.friendly_widget_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendly_widget_events_type ON public.friendly_widget_events(event_type);

GRANT INSERT ON public.friendly_widget_events TO anon, authenticated;
GRANT SELECT ON public.friendly_widget_events TO authenticated;
GRANT ALL ON public.friendly_widget_events TO service_role;

ALTER TABLE public.friendly_widget_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "widget_events_insert_any" ON public.friendly_widget_events;
CREATE POLICY "widget_events_insert_any"
  ON public.friendly_widget_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL AND auth.uid() IS NULL)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "widget_events_select_admin" ON public.friendly_widget_events;
CREATE POLICY "widget_events_select_admin"
  ON public.friendly_widget_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_friendly_widget_stats(p_days integer DEFAULT 30)
RETURNS TABLE(
  event_type text,
  attention_effect text,
  website_id uuid,
  website_name text,
  event_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  RETURN QUERY
    SELECT e.event_type,
           COALESCE(e.attention_effect,'none') AS attention_effect,
           e.website_id,
           w.name AS website_name,
           count(*)::bigint AS event_count
      FROM public.friendly_widget_events e
      LEFT JOIN public.friendly_websites w ON w.id = e.website_id
     WHERE e.created_at >= now() - make_interval(days => GREATEST(p_days, 1))
     GROUP BY e.event_type, COALESCE(e.attention_effect,'none'), e.website_id, w.name
     ORDER BY event_count DESC;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_friendly_widget_stats(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_friendly_widget_stats(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_friendly_widget_stats(integer) TO authenticated, service_role;
