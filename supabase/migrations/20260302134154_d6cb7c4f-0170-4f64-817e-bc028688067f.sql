-- Add assurance décennale fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assureur_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assureur_address TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assurance_policy_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assurance_geographic_coverage TEXT DEFAULT 'France métropolitaine';