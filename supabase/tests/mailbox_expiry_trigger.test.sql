-- Integration test for the reject_email_for_expired_mailbox trigger.
-- Verifies that received_emails inserts are blocked when the target
-- temp mailbox is expired, inactive, or missing — and pass otherwise.
--
-- Run with: `psql "$SUPABASE_DB_URL" -f supabase/tests/mailbox_expiry_trigger.test.sql`

BEGIN;

-- Isolate this test's rows behind a synthetic user id.
DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_domain_id uuid;
  v_valid uuid;
  v_expired uuid;
  v_inactive uuid;
  v_missing uuid := gen_random_uuid();
  v_ok boolean;
BEGIN
  -- Get or create a domain to satisfy FK on temp_emails.
  SELECT id INTO v_domain_id FROM public.domains LIMIT 1;
  IF v_domain_id IS NULL THEN
    INSERT INTO public.domains (name, is_active)
    VALUES ('test.expiry.local', true)
    RETURNING id INTO v_domain_id;
  END IF;

  -- Seed three mailboxes covering the three rejection cases + the happy path.
  INSERT INTO public.temp_emails (address, domain_id, user_id, expires_at, is_active, secret_token)
  VALUES ('valid+' || v_user || '@test.local', v_domain_id, v_user,
          now() + interval '2 hours', true, gen_random_uuid()::text)
  RETURNING id INTO v_valid;

  INSERT INTO public.temp_emails (address, domain_id, user_id, expires_at, is_active, secret_token)
  VALUES ('expired+' || v_user || '@test.local', v_domain_id, v_user,
          now() - interval '5 minutes', true, gen_random_uuid()::text)
  RETURNING id INTO v_expired;

  INSERT INTO public.temp_emails (address, domain_id, user_id, expires_at, is_active, secret_token)
  VALUES ('inactive+' || v_user || '@test.local', v_domain_id, v_user,
          now() + interval '2 hours', false, gen_random_uuid()::text)
  RETURNING id INTO v_inactive;

  ---------------------------------------------------------------------------
  -- CASE 1: valid mailbox — insert MUST succeed.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.received_emails (temp_email_id, from_address, subject, body)
    VALUES (v_valid, 'sender@example.com', 'ok', 'body');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL: valid mailbox insert was rejected';
  END IF;
  RAISE NOTICE 'PASS: valid mailbox accepts inserts';

  ---------------------------------------------------------------------------
  -- CASE 2: expired mailbox — insert MUST be rejected.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.received_emails (temp_email_id, from_address, subject, body)
    VALUES (v_expired, 'sender@example.com', 'nope', 'body');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'FAIL: expired mailbox accepted a new email';
  END IF;
  RAISE NOTICE 'PASS: expired mailbox rejects inserts';

  ---------------------------------------------------------------------------
  -- CASE 3: inactive mailbox — insert MUST be rejected.
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.received_emails (temp_email_id, from_address, subject, body)
    VALUES (v_inactive, 'sender@example.com', 'nope', 'body');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'FAIL: inactive mailbox accepted a new email';
  END IF;
  RAISE NOTICE 'PASS: inactive mailbox rejects inserts';

  ---------------------------------------------------------------------------
  -- CASE 4: unknown mailbox id — insert MUST be rejected (FK or trigger).
  ---------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.received_emails (temp_email_id, from_address, subject, body)
    VALUES (v_missing, 'sender@example.com', 'nope', 'body');
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'FAIL: missing mailbox insert unexpectedly succeeded';
  END IF;
  RAISE NOTICE 'PASS: missing mailbox rejects inserts';

  RAISE NOTICE 'ALL PASS: mailbox-expiry trigger covers all four cases.';
END $$;

ROLLBACK; -- Discard all seeded rows; test is fully idempotent.