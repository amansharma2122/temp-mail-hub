-- Create user_invoices table for billing history
CREATE TABLE public.user_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  invoice_url TEXT,
  invoice_pdf TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.user_invoices ENABLE ROW LEVEL SECURITY;

-- Users can view their own invoices
CREATE POLICY "Users can view own invoices"
  ON public.user_invoices
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all invoices
CREATE POLICY "Admins can view all invoices"
  ON public.user_invoices
  FOR SELECT
  USING (is_admin(auth.uid()));

-- System can insert invoices (via webhook)
CREATE POLICY "System can insert invoices"
  ON public.user_invoices
  FOR INSERT
  WITH CHECK (true);

-- System can update invoices (via webhook)
CREATE POLICY "System can update invoices"
  ON public.user_invoices
  FOR UPDATE
  USING (true);