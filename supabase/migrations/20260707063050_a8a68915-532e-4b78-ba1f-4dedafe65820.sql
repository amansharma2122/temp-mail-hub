
-- 1) Deny all anonymous access to profiles (restrictive)
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
CREATE POLICY "Deny anonymous access to profiles"
  ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 2) Remove unused temp_emails_safe view (attack surface reduction)
DROP VIEW IF EXISTS public.temp_emails_safe;

-- 3) Clear residual plaintext columns in user_2fa (keep columns for app compat, but null out plaintext fields)
-- The app writes encrypted content into totp_secret/backup_codes fields; the _encrypted mirror
-- columns are unused legacy. Drop them to eliminate duplicate sensitive storage.
ALTER TABLE public.user_2fa DROP COLUMN IF EXISTS totp_secret_encrypted;
ALTER TABLE public.user_2fa DROP COLUMN IF EXISTS backup_codes_encrypted;
