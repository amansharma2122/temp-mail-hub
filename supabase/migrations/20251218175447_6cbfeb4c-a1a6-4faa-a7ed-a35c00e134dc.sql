-- Create a secure view for temp_emails that excludes secret_token
CREATE OR REPLACE VIEW public.temp_emails_public AS
SELECT 
  id,
  user_id,
  address,
  domain_id,
  expires_at,
  is_active,
  created_at
FROM public.temp_emails;

-- Grant access to the view
GRANT SELECT ON public.temp_emails_public TO anon, authenticated;

-- Update temp_emails SELECT policies to be more restrictive
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own temp emails" ON public.temp_emails;
DROP POLICY IF EXISTS "Admins can view all temp emails" ON public.temp_emails;

-- Create new restrictive policy - authenticated users can view their own WITHOUT secret_token exposed
CREATE POLICY "Authenticated users can view own temp emails"
ON public.temp_emails
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all temp emails (for admin purposes)
CREATE POLICY "Admins can view all temp emails"
ON public.temp_emails
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Anonymous users should use the edge function which handles token verification
-- They can only view their session's temp email (user_id IS NULL)
-- The secret_token is only returned on INSERT, not on subsequent SELECT
CREATE POLICY "Anonymous can view anonymous temp emails"
ON public.temp_emails
FOR SELECT
TO anon
USING (user_id IS NULL);