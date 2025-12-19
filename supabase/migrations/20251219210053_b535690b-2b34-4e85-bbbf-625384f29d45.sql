-- Add RLS policy for realtime subscriptions
-- This allows realtime to work for all users when they filter by temp_email_id

-- For anonymous users: Allow SELECT when filtering by temp_email_id (realtime subscription filter)
-- The client already filters by temp_email_id, so this is safe
CREATE POLICY "Anonymous can receive realtime for temp emails"
ON public.received_emails
FOR SELECT
TO anon
USING (true);

-- Note: This policy allows anon to see emails, but:
-- 1. They can only subscribe with a temp_email_id filter
-- 2. The actual email content is still protected by the existing query patterns
-- 3. For better security, we rely on the client-side filtering

-- Actually, let's be more restrictive - drop and recreate with proper logic
DROP POLICY IF EXISTS "Anonymous can receive realtime for temp emails" ON public.received_emails;

-- Create a policy that allows anon to see emails for temp addresses that have no user (guest emails)
CREATE POLICY "Anonymous can view guest temp email messages"
ON public.received_emails
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM temp_emails 
    WHERE temp_emails.id = received_emails.temp_email_id 
    AND temp_emails.user_id IS NULL
  )
);

-- Also ensure authenticated users who don't own the temp email can still receive realtime
-- if they have the secret_token (we'll need to track this differently)
-- For now, the existing policy should work for authenticated users with their own temp emails