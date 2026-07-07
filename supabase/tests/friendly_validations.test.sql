-- Integration tests for friendly_websites and app_settings validation triggers.
-- Run with: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/friendly_validations.test.sql
-- Each block MUST raise inside the DO ... EXCEPTION shield; the outer script only
-- fails if a rejection did NOT happen (indicating validation regressed).

\set ON_ERROR_STOP on
BEGIN;

-- Helper: assert that an INSERT/UPDATE was rejected by the validator.
CREATE OR REPLACE FUNCTION pg_temp.assert_rejected(sql text, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
    RAISE EXCEPTION 'VALIDATION-TEST FAILED: % was accepted', label;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % → %', label, SQLERRM;
  END;
END $$;

-- 1) friendly_websites: unsafe URL schemes rejected
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.friendly_websites(name,url) VALUES('bad','javascript:alert(1)')$q$,
  'javascript: url'
);
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.friendly_websites(name,url) VALUES('bad','data:text/html,x')$q$,
  'data: url'
);
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.friendly_websites(name,url) VALUES('bad','ftp://example.com')$q$,
  'ftp: url'
);

-- 2) friendly_websites: script tag in name rejected
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.friendly_websites(name,url) VALUES('<script>x</script>','https://example.com')$q$,
  'script tag in name'
);

-- 3) friendly_websites: invalid icon_name rejected
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.friendly_websites(name,url,icon_name) VALUES('ok','https://a.com','not a name!')$q$,
  'bad icon_name'
);

-- 4) friendly_websites: invalid attention_effect rejected
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.friendly_websites(name,url,attention_effect) VALUES('ok','https://a.com','explode')$q$,
  'bad attention_effect'
);

-- 5) friendly_websites: known good insert succeeds and rolls back
INSERT INTO public.friendly_websites(name,url,attention_effect,icon_name)
VALUES('Nullsto','https://nullsto.lovable.app','sparkle','Star');

-- 6) app_settings: script tag in widget label rejected
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.app_settings(key,value)
     VALUES('friendly_sites_widget', '{"buttonLabel":"<script>x</script>"}'::jsonb)$q$,
  'script tag in buttonLabel'
);

-- 7) app_settings: invalid triggerIcon rejected
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.app_settings(key,value)
     VALUES('friendly_sites_widget', '{"triggerIcon":"not valid"}'::jsonb)$q$,
  'invalid triggerIcon'
);

-- 8) app_settings: invalid enum values rejected
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.app_settings(key,value)
     VALUES('friendly_sites_widget', '{"attentionEffect":"nuke"}'::jsonb)$q$,
  'invalid attentionEffect'
);
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.app_settings(key,value)
     VALUES('friendly_sites_widget', '{"animationType":"warp"}'::jsonb)$q$,
  'invalid animationType'
);
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.app_settings(key,value)
     VALUES('friendly_sites_widget', '{"colorScheme":"neon"}'::jsonb)$q$,
  'invalid colorScheme'
);
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.app_settings(key,value)
     VALUES('friendly_sites_widget', '{"size":"huge"}'::jsonb)$q$,
  'invalid size'
);
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.app_settings(key,value)
     VALUES('friendly_sites_widget', '{"position":"top"}'::jsonb)$q$,
  'invalid position'
);
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.app_settings(key,value)
     VALUES('friendly_sites_widget', '{"autoOpenDelayMs":9999999}'::jsonb)$q$,
  'autoOpenDelayMs out of range'
);

-- 9) app_settings: known good widget payload with new effect succeeds
INSERT INTO public.app_settings(key,value)
VALUES('friendly_sites_widget',
  '{"attentionEffect":"confetti","animationType":"zoom","colorScheme":"gradient","size":"medium","position":"right","triggerIcon":"Sparkles","autoOpenDelayMs":1500}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 10) friendly_widget_events: bad attention_effect rejected by trigger
SELECT pg_temp.assert_rejected(
  $q$INSERT INTO public.friendly_widget_events(event_type, attention_effect)
     VALUES('manual_open','explode')$q$,
  'bad widget event attention_effect'
);

ROLLBACK;

\echo 'friendly_validations.test.sql: all validators rejected unsafe inputs as expected.'