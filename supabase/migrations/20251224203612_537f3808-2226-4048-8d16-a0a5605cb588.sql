-- Create email_stats table to track permanent email generation count
CREATE TABLE IF NOT EXISTS public.email_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_key text NOT NULL UNIQUE,
  stat_value bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access to stats
CREATE POLICY "Anyone can view email stats" 
ON public.email_stats 
FOR SELECT 
USING (true);

-- Only service role can modify stats
CREATE POLICY "Only service role can modify stats" 
ON public.email_stats 
FOR ALL 
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role');

-- Insert initial stat with current count from temp_emails
INSERT INTO public.email_stats (stat_key, stat_value)
SELECT 'total_emails_generated', COALESCE(COUNT(*), 0) + 600
FROM public.temp_emails
ON CONFLICT (stat_key) DO NOTHING;

-- Create trigger function to increment counter on new temp email
CREATE OR REPLACE FUNCTION public.increment_email_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.email_stats 
  SET stat_value = stat_value + 1, updated_at = now()
  WHERE stat_key = 'total_emails_generated';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on temp_emails INSERT
DROP TRIGGER IF EXISTS increment_total_emails_generated ON public.temp_emails;
CREATE TRIGGER increment_total_emails_generated
AFTER INSERT ON public.temp_emails
FOR EACH ROW
EXECUTE FUNCTION public.increment_email_stats();