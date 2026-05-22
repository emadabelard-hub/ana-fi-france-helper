-- Restrict client-side transactions inserts to status='pending' only.
-- Completed status must come from a trusted edge function (e.g. Stripe webhook).
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;

CREATE POLICY "Users can insert their own pending transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');