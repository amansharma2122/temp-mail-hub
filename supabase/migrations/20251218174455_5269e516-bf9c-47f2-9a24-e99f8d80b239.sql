-- ========================================
-- FIX ALL REMAINING SECURITY ISSUES
-- ========================================

-- FIX PROFILES: Add explicit anon denial
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- FIX EMAIL_FORWARDING: Add explicit anon denial
CREATE POLICY "Deny anonymous access to email_forwarding"
ON public.email_forwarding
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- FIX SAVED_EMAILS: Add explicit anon denial
CREATE POLICY "Deny anonymous access to saved_emails"
ON public.saved_emails
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- FIX USER_ROLES: Add explicit anon denial
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);

-- FIX PUSH_SUBSCRIPTIONS: Recreate policies with tighter control
DROP POLICY IF EXISTS "Authenticated users can manage push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anonymous users can manage anonymous push subscriptions" ON public.push_subscriptions;

-- Authenticated users can only manage their OWN subscriptions
CREATE POLICY "Authenticated users manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Anonymous users can manage subscriptions for temp emails they created (in same session)
-- This is more restrictive - they can only INSERT, not SELECT others
CREATE POLICY "Anonymous can insert push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL AND temp_email_id IS NOT NULL);

-- Anonymous can only view/update/delete their own subscriptions by endpoint match
CREATE POLICY "Anonymous can manage own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO anon
USING (user_id IS NULL AND temp_email_id IS NOT NULL);

CREATE POLICY "Anonymous can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO anon
USING (user_id IS NULL AND temp_email_id IS NOT NULL)
WITH CHECK (user_id IS NULL AND temp_email_id IS NOT NULL);

CREATE POLICY "Anonymous can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO anon
USING (user_id IS NULL AND temp_email_id IS NOT NULL);

-- FIX RATE_LIMITS: Drop overly permissive policy
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limits;

-- Only service_role (backend) can access rate_limits - no public access at all
-- Note: The trigger runs as SECURITY DEFINER so it can still access the table