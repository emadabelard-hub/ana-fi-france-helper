-- Add artisan permanent signature field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS artisan_signature_url text;

COMMENT ON COLUMN public.profiles.artisan_signature_url IS 'URL de la signature permanente de l''artisan pour les devis et factures';