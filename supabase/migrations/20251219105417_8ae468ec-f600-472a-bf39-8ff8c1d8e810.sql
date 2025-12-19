-- Drop the existing insert policy and recreate with correct roles
DROP POLICY IF EXISTS "Anyone can create temp emails" ON public.temp_emails;

-- Create INSERT policy that allows both anon and authenticated users
CREATE POLICY "Anyone can create temp emails" 
ON public.temp_emails 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);