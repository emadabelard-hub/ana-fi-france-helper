ALTER TABLE public.chantier_reports
  ADD COLUMN IF NOT EXISTS created_at_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS gps_latitude double precision,
  ADD COLUMN IF NOT EXISTS gps_longitude double precision,
  ADD COLUMN IF NOT EXISTS gps_address text;