CREATE TABLE public.accountant_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accountant_email text NOT NULL,
  accountant_name text NOT NULL,
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountant_access TO authenticated;
GRANT ALL ON public.accountant_access TO service_role;

ALTER TABLE public.accountant_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their accountant access"
  ON public.accountant_access
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_accountant_access_user_id ON public.accountant_access(user_id);
CREATE INDEX idx_accountant_access_token ON public.accountant_access(access_token) WHERE is_active = true;