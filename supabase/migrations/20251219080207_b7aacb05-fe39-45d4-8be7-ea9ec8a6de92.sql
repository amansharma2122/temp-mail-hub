-- Create table for storing user 2FA secrets
CREATE TABLE public.user_2fa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  totp_secret TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  backup_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;

-- Users can view their own 2FA settings
CREATE POLICY "Users can view own 2FA settings" 
ON public.user_2fa 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own 2FA settings
CREATE POLICY "Users can insert own 2FA settings" 
ON public.user_2fa 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own 2FA settings
CREATE POLICY "Users can update own 2FA settings" 
ON public.user_2fa 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own 2FA settings
CREATE POLICY "Users can delete own 2FA settings" 
ON public.user_2fa 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_2fa_updated_at
BEFORE UPDATE ON public.user_2fa
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();