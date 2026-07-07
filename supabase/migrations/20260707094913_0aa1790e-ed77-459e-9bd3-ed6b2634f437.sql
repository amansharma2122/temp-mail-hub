-- Block inserts into received_emails whose target temp mailbox is expired or inactive.
CREATE OR REPLACE FUNCTION public.reject_email_for_expired_mailbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_expires_at timestamptz;
  v_is_active boolean;
BEGIN
  IF NEW.temp_email_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT expires_at, is_active
    INTO v_expires_at, v_is_active
  FROM public.temp_emails
  WHERE id = NEW.temp_email_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot deliver email: temp mailbox % does not exist', NEW.temp_email_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Cannot deliver email: temp mailbox % is inactive', NEW.temp_email_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
    RAISE EXCEPTION 'Cannot deliver email: temp mailbox % expired at %', NEW.temp_email_id, v_expires_at
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_reject_email_for_expired_mailbox ON public.received_emails;
CREATE TRIGGER trg_reject_email_for_expired_mailbox
  BEFORE INSERT ON public.received_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_email_for_expired_mailbox();