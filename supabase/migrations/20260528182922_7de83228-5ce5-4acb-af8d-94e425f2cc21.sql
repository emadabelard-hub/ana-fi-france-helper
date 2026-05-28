ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dialect text NOT NULL DEFAULT 'egyptien'
CHECK (dialect IN ('egyptien','algerien','marocain','tunisien'));