-- Fix the security definer view issue by explicitly setting SECURITY INVOKER
ALTER VIEW public.temp_emails_public SET (security_invoker = on);