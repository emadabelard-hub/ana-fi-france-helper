
-- Fix 1: Replace overly permissive "true" INSERT policy on transfer_waitlist
-- with a check that ensures email is provided and valid format
DROP POLICY IF EXISTS "Anyone can insert into waitlist" ON public.transfer_waitlist;

CREATE POLICY "Anyone can insert into waitlist with valid email"
ON public.transfer_waitlist
FOR INSERT
WITH CHECK (
  email IS NOT NULL AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Fix 2: Create a secure admin view excluding sensitive PII fields
CREATE OR REPLACE VIEW public.admin_user_list
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  full_name,
  created_at,
  updated_at,
  credits_balance,
  daily_message_count
FROM public.profiles;
