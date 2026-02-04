-- Create promo_metrics table for tracking affiliate performance
CREATE TABLE public.promo_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_id TEXT NOT NULL UNIQUE,
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_metrics ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read promo metrics (for displaying stats)
CREATE POLICY "Anyone can view promo metrics"
ON public.promo_metrics
FOR SELECT
USING (true);

-- Create function to increment views
CREATE OR REPLACE FUNCTION public.increment_promo_views(p_promo_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.promo_metrics (promo_id, views, clicks)
  VALUES (p_promo_id, 1, 0)
  ON CONFLICT (promo_id)
  DO UPDATE SET views = promo_metrics.views + 1, updated_at = now();
END;
$$;

-- Create function to increment clicks
CREATE OR REPLACE FUNCTION public.increment_promo_clicks(p_promo_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.promo_metrics (promo_id, views, clicks)
  VALUES (p_promo_id, 0, 1)
  ON CONFLICT (promo_id)
  DO UPDATE SET clicks = promo_metrics.clicks + 1, updated_at = now();
END;
$$;

-- Insert initial promo records
INSERT INTO public.promo_metrics (promo_id, views, clicks) VALUES
  ('bank_promo', 0, 0),
  ('transfer_promo', 0, 0);

-- Add trigger for updated_at
CREATE TRIGGER update_promo_metrics_updated_at
BEFORE UPDATE ON public.promo_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();