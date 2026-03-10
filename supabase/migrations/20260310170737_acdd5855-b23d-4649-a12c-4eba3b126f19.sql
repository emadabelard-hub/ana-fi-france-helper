
ALTER TABLE public.documents_comptables ADD COLUMN IF NOT EXISTS sent_to_accountant_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS sent_to_accountant_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accountant_email text DEFAULT NULL;
