
-- 1) Lock down banners bucket listing.
DROP POLICY IF EXISTS "Anyone can view banner images" ON storage.objects;
CREATE POLICY "Admins can list banner images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'banners' AND public.is_admin(auth.uid()));
-- Public direct URL access to banner files still works (bucket is public).

-- 2) Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated/PUBLIC.
DO $$
DECLARE
  fn text;
  sig text;
  fns text[] := ARRAY[
    'update_friendly_websites_updated_at()',
    'increment_email_stats()',
    'handle_new_user()',
    'log_sensitive_access()',
    'update_subscription_updated_at()',
    'update_updated_at_column()',
    'update_email_templates_updated_at()',
    'validate_friendly_website()',
    'enforce_temp_email_rate_limit()',
    'enforce_friendly_widget_event_quota()',
    'bump_inboxes_created()',
    'validate_friendly_widget_settings()',
    'enforce_single_active_mailbox()',
    'encrypt_sensitive(text, text)',
    'decrypt_sensitive(text, text)',
    'get_registration_ip()',
    'generate_secret_token()',
    'check_rate_limit(text, text, integer, integer)',
    'cleanup_old_rate_limits()',
    'record_mailbox_error(uuid, text)',
    'reset_mailbox_daily_counters()',
    'log_admin_access(text, text, uuid, jsonb)',
    'is_guest_temp_email(uuid)',
    'is_country_blocked(text)',
    'is_ip_blocked(text)',
    'is_email_blocked(text)',
    'is_user_suspended(uuid)'
  ];
BEGIN
  FOREACH sig IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', sig);
    EXCEPTION WHEN undefined_function THEN
      -- Skip if signature doesn't exist in this env
      NULL;
    END;
  END LOOP;
END $$;
