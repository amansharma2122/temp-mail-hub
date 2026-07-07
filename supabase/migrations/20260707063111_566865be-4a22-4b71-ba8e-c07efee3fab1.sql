
ALTER TABLE public.user_2fa ADD COLUMN IF NOT EXISTS totp_secret_encrypted text;
ALTER TABLE public.user_2fa ADD COLUMN IF NOT EXISTS backup_codes_encrypted text;
