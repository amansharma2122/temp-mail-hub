-- Fix rate_limits: Add explicit denial policies to satisfy linter
-- The table is accessed via SECURITY DEFINER functions only

CREATE POLICY "Deny anon access to rate_limits"
ON public.rate_limits
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny authenticated access to rate_limits"
ON public.rate_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);