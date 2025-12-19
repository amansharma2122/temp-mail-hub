-- Add unique constraint on temp_emails.address to prevent duplicate assignments
-- This ensures no two users can have the same email address at the same time
ALTER TABLE public.temp_emails 
ADD CONSTRAINT temp_emails_address_unique UNIQUE (address);

-- Create an index for faster lookups on active addresses
CREATE INDEX IF NOT EXISTS idx_temp_emails_active_address 
ON public.temp_emails (address) 
WHERE is_active = true;