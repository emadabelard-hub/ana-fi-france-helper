
-- Create invoice drafts table for cloud persistence
CREATE TABLE public.invoice_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'devis',
  draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Each user can have one draft per document type
CREATE UNIQUE INDEX idx_invoice_drafts_user_type ON public.invoice_drafts (user_id, document_type);

-- Enable RLS
ALTER TABLE public.invoice_drafts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own drafts
CREATE POLICY "Users can view their own drafts"
  ON public.invoice_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts"
  ON public.invoice_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
  ON public.invoice_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
  ON public.invoice_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_invoice_drafts_updated_at
  BEFORE UPDATE ON public.invoice_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
