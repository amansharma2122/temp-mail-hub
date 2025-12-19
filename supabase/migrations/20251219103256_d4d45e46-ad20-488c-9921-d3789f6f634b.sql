-- FIX 1: Drop the insecure anonymous policy that exposes secret_token
DROP POLICY IF EXISTS "Anonymous can view anonymous temp emails" ON public.temp_emails;

-- Create a secure view that excludes secret_token for anonymous access
DROP VIEW IF EXISTS public.temp_emails_public;
CREATE VIEW public.temp_emails_public AS
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

-- Create a policy for anonymous users that ONLY allows access through token verification
-- They must use the verify_temp_email_token function, not direct table access
CREATE POLICY "Anonymous access via token only" ON public.temp_emails
FOR SELECT TO anon
USING (
  -- Anonymous users can only see their own temp email if they provide valid token via headers
  public.validate_email_access_from_headers(id)
);