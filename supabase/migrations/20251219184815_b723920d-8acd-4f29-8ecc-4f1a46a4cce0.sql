-- Enable REPLICA IDENTITY FULL for received_emails to ensure realtime works properly
ALTER TABLE public.received_emails REPLICA IDENTITY FULL;