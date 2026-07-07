DROP POLICY IF EXISTS "Anyone can read public app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can read public settings" ON public.app_settings;

CREATE POLICY "Public can read safe app settings"
ON public.app_settings
FOR SELECT
TO public
USING (
  key = ANY (ARRAY[
    'seo'::text,
    'general'::text,
    'appearance'::text,
    'pricing_content'::text,
    'friendly_sites_widget'::text,
    'blog_settings'::text,
    'announcement'::text,
    'seo_settings'::text,
    'general_settings'::text,
    'appearance_settings'::text,
    'announcement_settings'::text,
    'registration_settings'::text,
    'language_settings'::text,
    'homepage_sections'::text,
    'limit_modal_config'::text
  ])
);

CREATE OR REPLACE FUNCTION public.get_public_captcha_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE((value->>'enabled')::boolean, false),
    'provider', COALESCE(value->>'provider', 'recaptcha'),
    'siteKey', COALESCE(value->>'siteKey', ''),
    'enableOnLogin', COALESCE((value->>'enableOnLogin')::boolean, true),
    'enableOnRegister', COALESCE((value->>'enableOnRegister')::boolean, true),
    'enableOnContact', COALESCE((value->>'enableOnContact')::boolean, true),
    'enableOnEmailGen', COALESCE((value->>'enableOnEmailGen')::boolean, false),
    'threshold', COALESCE((value->>'threshold')::numeric, 0.5)
  )
  FROM public.app_settings
  WHERE key = 'captcha_settings'
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_captcha_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_captcha_settings() TO anon, authenticated, service_role;