UPDATE public.app_settings
SET value = jsonb_set(coalesce(value, '{}'::jsonb), '{attentionEffect}', '"glow"'::jsonb)
WHERE key = 'friendly_sites_widget'
  AND coalesce(value->>'attentionEffect', 'pulse') IN ('pulse','wiggle','bounce','rainbow','sparkle','confetti');