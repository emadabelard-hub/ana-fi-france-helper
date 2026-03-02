
-- Harden transfer_waitlist INSERT policy: require non-empty email
DROP POLICY IF EXISTS "Authenticated users can insert into waitlist" ON public.transfer_waitlist;
CREATE POLICY "Authenticated users can insert into waitlist"
ON public.transfer_waitlist
FOR INSERT
WITH CHECK (email IS NOT NULL AND length(trim(email)) > 0);

-- Harden visit_logs INSERT policy: user_id must match auth or be null (guest)
DROP POLICY IF EXISTS "Authenticated users can log visits" ON public.visit_logs;
CREATE POLICY "Authenticated users can log visits"
ON public.visit_logs
FOR INSERT
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
