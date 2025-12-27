-- Enable realtime for rate_limits and banners tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rate_limits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.banners;

-- Set REPLICA IDENTITY FULL for better realtime updates
ALTER TABLE public.rate_limits REPLICA IDENTITY FULL;
ALTER TABLE public.banners REPLICA IDENTITY FULL;