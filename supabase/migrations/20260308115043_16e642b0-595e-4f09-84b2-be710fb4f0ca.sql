ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_b2b boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tva_number text DEFAULT NULL;