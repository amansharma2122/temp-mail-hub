
-- 1. email_attachments: require validated token for guest inbox rows
DROP POLICY IF EXISTS "Users can view attachments for their emails" ON public.email_attachments;
CREATE POLICY "Users can view attachments for their emails"
ON public.email_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM received_emails re
    JOIN temp_emails te ON te.id = re.temp_email_id
    WHERE re.id = email_attachments.received_email_id
      AND (
        (te.user_id IS NOT NULL AND te.user_id = auth.uid())
        OR (te.user_id IS NULL AND public.validate_email_access_from_headers(te.id))
      )
  )
);

-- 2. push_subscriptions: anon must own the temp_email via validated token
DROP POLICY IF EXISTS "Anonymous can manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anonymous can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anonymous can delete own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anonymous can insert push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Anonymous can select own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO anon
USING (
  user_id IS NULL
  AND temp_email_id IS NOT NULL
  AND public.validate_email_access_from_headers(temp_email_id)
);

CREATE POLICY "Anonymous can insert push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND temp_email_id IS NOT NULL
  AND public.validate_email_access_from_headers(temp_email_id)
);

CREATE POLICY "Anonymous can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO anon
USING (
  user_id IS NULL
  AND temp_email_id IS NOT NULL
  AND public.validate_email_access_from_headers(temp_email_id)
)
WITH CHECK (
  user_id IS NULL
  AND temp_email_id IS NOT NULL
  AND public.validate_email_access_from_headers(temp_email_id)
);

CREATE POLICY "Anonymous can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO anon
USING (
  user_id IS NULL
  AND temp_email_id IS NOT NULL
  AND public.validate_email_access_from_headers(temp_email_id)
);

-- 3. storage.objects for email-attachments bucket: remove broad access.
-- Uploads and reads are handled by edge functions using service_role (RLS bypass)
-- and via signed URLs. Admins retain full access via existing policy.
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their email attachments" ON storage.objects;
