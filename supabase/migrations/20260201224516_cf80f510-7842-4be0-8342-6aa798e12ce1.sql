-- Add artisan profile fields and custom header options to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS siret text,
ADD COLUMN IF NOT EXISTS company_address text,
ADD COLUMN IF NOT EXISTS legal_status text DEFAULT 'auto-entrepreneur' CHECK (legal_status IN ('auto-entrepreneur', 'societe')),
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS header_type text DEFAULT 'automatic' CHECK (header_type IN ('automatic', 'full_image')),
ADD COLUMN IF NOT EXISTS header_image_url text;

-- Add SIRET validation (14 digits)
ALTER TABLE public.profiles
ADD CONSTRAINT siret_format CHECK (siret IS NULL OR siret ~ '^\d{14}$');

-- Create storage bucket for company assets (logos and header images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own assets
CREATE POLICY "Users can update their company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own assets
CREATE POLICY "Users can delete their company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access for PDF generation
CREATE POLICY "Company assets are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');