-- ========================================
-- ADD RATE LIMITING FOR TEMP EMAIL CREATION
-- ========================================

-- Create a table to track rate limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- IP address or user_id
  action_type text NOT NULL, -- 'temp_email_create', etc.
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE(identifier, action_type, window_start)
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only system can manage rate limits
CREATE POLICY "System can manage rate limits"
ON public.rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits(identifier, action_type, window_start);

-- Create function to check and update rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action_type text,
  p_max_requests integer DEFAULT 10,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamp with time zone;
  v_current_count integer;
BEGIN
  -- Calculate the start of the current time window
  v_window_start := date_trunc('hour', now()) + 
    (floor(extract(minute from now()) / p_window_minutes) * p_window_minutes) * interval '1 minute';
  
  -- Get current count for this identifier/action in this window
  SELECT request_count INTO v_current_count
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_start = v_window_start;
  
  -- If no record exists, create one
  IF v_current_count IS NULL THEN
    INSERT INTO public.rate_limits (identifier, action_type, window_start, request_count)
    VALUES (p_identifier, p_action_type, v_window_start, 1)
    ON CONFLICT (identifier, action_type, window_start) 
    DO UPDATE SET request_count = rate_limits.request_count + 1
    RETURNING request_count INTO v_current_count;
    
    RETURN true; -- First request, allow it
  END IF;
  
  -- Check if limit exceeded
  IF v_current_count >= p_max_requests THEN
    RETURN false; -- Rate limit exceeded
  END IF;
  
  -- Increment counter
  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_start = v_window_start;
  
  RETURN true; -- Request allowed
END;
$$;

-- Create function to enforce rate limit on temp email creation
CREATE OR REPLACE FUNCTION public.enforce_temp_email_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identifier text;
  v_allowed boolean;
BEGIN
  -- Use user_id if authenticated, otherwise use a placeholder for anonymous
  IF NEW.user_id IS NOT NULL THEN
    v_identifier := NEW.user_id::text;
  ELSE
    -- For anonymous users, we'll use 'anonymous' as identifier
    -- In production, you'd want to pass IP address from the edge function
    v_identifier := 'anonymous_' || COALESCE(current_setting('request.headers', true)::json->>'x-real-ip', 'unknown');
  END IF;
  
  -- Check rate limit: 10 temp emails per hour per identifier
  v_allowed := public.check_rate_limit(v_identifier, 'temp_email_create', 10, 60);
  
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before creating more temporary emails.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce rate limit on temp_emails insert
DROP TRIGGER IF EXISTS enforce_temp_email_rate_limit_trigger ON public.temp_emails;
CREATE TRIGGER enforce_temp_email_rate_limit_trigger
  BEFORE INSERT ON public.temp_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_temp_email_rate_limit();

-- Clean up old rate limit records (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;