
-- Add subcategory and equipment_price columns to artisan_price_catalog
ALTER TABLE public.artisan_price_catalog 
  ADD COLUMN IF NOT EXISTS subcategory text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS equipment_price numeric NOT NULL DEFAULT 0;
