
-- Create the new price catalog table
CREATE TABLE public.artisan_price_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'm2',
  material_price numeric NOT NULL DEFAULT 0,
  labor_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);

-- Enable RLS
ALTER TABLE public.artisan_price_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own catalog" ON public.artisan_price_catalog
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own catalog" ON public.artisan_price_catalog
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own catalog" ON public.artisan_price_catalog
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own catalog" ON public.artisan_price_catalog
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
