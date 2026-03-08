
-- Add legal fields to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'particulier';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;

-- Add insurance_notes to chantiers table
ALTER TABLE public.chantiers ADD COLUMN IF NOT EXISTS insurance_notes text;
