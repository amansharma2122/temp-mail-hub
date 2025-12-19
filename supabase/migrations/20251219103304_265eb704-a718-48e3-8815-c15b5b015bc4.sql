-- Fix the security definer view warning by making it security invoker
DROP VIEW IF EXISTS public.temp_emails_public;

CREATE VIEW public.temp_emails_public
WITH (security_invoker = true)
AS
SELECT 
  id,
  address,
  domain_id,
  user_id,
  is_active,
  expires_at,
  created_at
  -- secret_token is intentionally excluded for security
FROM public.temp_emails
WHERE user_id IS NULL OR user_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON public.temp_emails_public TO anon, authenticated;