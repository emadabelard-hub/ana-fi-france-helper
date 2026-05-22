
-- 1. transactions: block user UPDATE/DELETE explicitly (restrictive)
CREATE POLICY "no_user_update_transactions"
ON public.transactions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "no_user_delete_transactions"
ON public.transactions
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);

-- 2. user_activity_logs: tighten insert + allow owner select
DROP POLICY IF EXISTS "Users can insert own activity logs" ON public.user_activity_logs;
CREATE POLICY "Users can insert own activity logs"
ON public.user_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND is_guest IS NOT TRUE
  AND (user_email IS NULL OR user_email = (auth.jwt() ->> 'email'))
);

CREATE POLICY "Users can read own activity logs"
ON public.user_activity_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. realtime.messages: require user is the sender AND owner of the referenced service_request
DROP POLICY IF EXISTS "users_own_messages" ON realtime.messages;

CREATE POLICY "users_own_request_messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (auth.uid())::text = COALESCE(payload ->> 'sender_id', payload ->> 'user_id')
  AND EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.id::text = (payload ->> 'request_id')
      AND sr.user_id = auth.uid()
  )
);
