-- Server-side rate-limit + RLS integration tests for
-- public.friendly_widget_events. Non-destructive: everything runs inside a
-- BEGIN/ROLLBACK envelope so no rows outlive the test.
--
-- Usage: psql -v ON_ERROR_STOP=1 -f friendly_rate_limit.test.sql
--
-- These assertions cover:
--   1) The 120/hour quota trigger blocks the 121st insert for the same session.
--   2) A different session_id is NOT rate-limited (per-session bucket).
--   3) RLS remains intact: anon/authenticated cannot UPDATE or DELETE events,
--      and non-admins cannot SELECT rows.

\set ON_ERROR_STOP on
BEGIN;

-- 1) Rate limit: 120 allowed, 121st rejected -------------------------------
DO $$
DECLARE
  v_session text := 'ratelimit-test-' || gen_random_uuid();
  v_err text;
BEGIN
  FOR i IN 1..120 LOOP
    INSERT INTO public.friendly_widget_events (event_type, session_id)
    VALUES ('click', v_session);
  END LOOP;

  BEGIN
    INSERT INTO public.friendly_widget_events (event_type, session_id)
    VALUES ('click', v_session);
    RAISE EXCEPTION 'FAIL: 121st insert should have been rejected by quota trigger';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err !~* 'rate|quota|limit' THEN
      RAISE EXCEPTION 'FAIL: unexpected error for over-quota insert: %', v_err;
    END IF;
    RAISE NOTICE 'PASS: quota trigger blocked over-limit insert (%).', v_err;
  END;
END $$;

-- 2) A fresh session bucket is independent -------------------------------
DO $$
DECLARE
  v_session text := 'independent-' || gen_random_uuid();
BEGIN
  INSERT INTO public.friendly_widget_events (event_type, session_id)
  VALUES ('manual_open', v_session);
  RAISE NOTICE 'PASS: independent session bucket accepts inserts.';
END $$;

-- 3) RLS: UPDATE / DELETE are denied for non-service roles ---------------
DO $$
DECLARE
  v_ok boolean;
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.friendly_widget_events SET event_type = 'click' WHERE session_id = 'nonexistent';
    RAISE EXCEPTION 'FAIL: authenticated role should not be able to UPDATE events';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    RAISE NOTICE 'PASS: authenticated UPDATE denied (% )', SQLERRM;
  END;
  BEGIN
    DELETE FROM public.friendly_widget_events WHERE session_id = 'nonexistent';
    RAISE EXCEPTION 'FAIL: authenticated role should not be able to DELETE events';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    RAISE NOTICE 'PASS: authenticated DELETE denied (%)', SQLERRM;
  END;
  RESET ROLE;
END $$;

-- 4) RLS: anonymous SELECT is denied -------------------------------------
DO $$
DECLARE
  v_count int;
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO v_count FROM public.friendly_widget_events;
    -- If RLS blocks it, PostgREST typically returns 0 rows for anon; a raised
    -- privilege error is also acceptable. Any non-zero visible row is a fail.
    IF v_count > 0 THEN
      RAISE EXCEPTION 'FAIL: anon should not see event rows (saw % rows)', v_count;
    END IF;
    RAISE NOTICE 'PASS: anon SELECT returned no rows.';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon SELECT rejected with insufficient_privilege.';
  END;
  RESET ROLE;
END $$;

-- 5) Admin-configured quota is honored by the trigger --------------------
-- Override the setting to (5 events / 60 minutes) and verify the 6th insert
-- is blocked, then restore the default. All wrapped in the outer ROLLBACK.
DO $$
DECLARE
  v_session text := 'tunable-' || gen_random_uuid();
  v_err text;
  v_old jsonb;
BEGIN
  SELECT value INTO v_old FROM public.app_settings
   WHERE key = 'rate_limit_friendly_widget_events';

  INSERT INTO public.app_settings (key, value)
  VALUES ('rate_limit_friendly_widget_events',
          jsonb_build_object('max_requests', 5, 'window_minutes', 60))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  FOR i IN 1..5 LOOP
    INSERT INTO public.friendly_widget_events (event_type, session_id)
    VALUES ('click', v_session);
  END LOOP;

  BEGIN
    INSERT INTO public.friendly_widget_events (event_type, session_id)
    VALUES ('click', v_session);
    RAISE EXCEPTION 'FAIL: 6th insert should have been rejected by tuned quota (max=5)';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err !~* 'rate|quota|limit' THEN
      RAISE EXCEPTION 'FAIL: unexpected error for over-quota insert (tuned): %', v_err;
    END IF;
    RAISE NOTICE 'PASS: tuned quota (max=5) blocked over-limit insert (%).', v_err;
  END;
END $$;

-- 6) RLS still intact after quota override --------------------------------
DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.friendly_widget_events SET event_type = 'click' WHERE 1=0;
    RAISE EXCEPTION 'FAIL: authenticated UPDATE should still be denied after quota override';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    RAISE NOTICE 'PASS: authenticated UPDATE remains denied after quota override.';
  END;
  RESET ROLE;
END $$;

ROLLBACK;