-- Drop the overly restrictive RLS policy that blocks admin access to profiles
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;