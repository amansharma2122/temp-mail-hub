-- Function to delete a user (admin only)
CREATE OR REPLACE FUNCTION public.delete_user_as_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Prevent deleting yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  
  -- Delete from user_roles first
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete from profiles
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'DELETE_USER', 'profiles', target_user_id, jsonb_build_object('reason', 'Admin deleted user'));
  
  RETURN true;
END;
$$;

-- Function to get all admin/moderator users with their profiles
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.email,
    p.display_name,
    ur.role::text,
    ur.created_at
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'moderator')
  ORDER BY ur.created_at DESC;
END;
$$;

-- Function to add admin role to a user
CREATE OR REPLACE FUNCTION public.add_admin_role(target_user_id uuid, target_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Insert or update role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, target_role)
  ON CONFLICT (user_id) DO UPDATE SET role = target_role;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'ADD_ADMIN_ROLE', 'user_roles', target_user_id, jsonb_build_object('role', target_role::text));
  
  RETURN true;
END;
$$;

-- Function to remove admin role from a user
CREATE OR REPLACE FUNCTION public.remove_admin_role(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Prevent removing yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove your own admin role';
  END IF;
  
  -- Count remaining admins
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin' AND user_id != target_user_id;
  
  -- Ensure at least one admin remains
  IF admin_count < 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;
  
  -- Update role to 'user' instead of deleting
  UPDATE public.user_roles SET role = 'user' WHERE user_id = target_user_id;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'REMOVE_ADMIN_ROLE', 'user_roles', target_user_id, jsonb_build_object('reason', 'Admin role removed'));
  
  RETURN true;
END;
$$;

-- Function to find user by email (for adding new admins)
CREATE OR REPLACE FUNCTION public.find_user_by_email(search_email text)
RETURNS TABLE(
  found_user_id uuid,
  found_email text,
  found_display_name text,
  found_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    p.email,
    p.display_name,
    COALESCE(ur.role::text, 'user')
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE LOWER(p.email) = LOWER(search_email)
  LIMIT 1;
END;
$$;