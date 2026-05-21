-- Fix 4: Harden realtime request_messages RLS by scoping via service_requests ownership
DROP POLICY IF EXISTS "Request participants can view messages" ON public.request_messages;
DROP POLICY IF EXISTS "Request participants can send messages" ON public.request_messages;

CREATE POLICY "Request participants can view messages"
ON public.request_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.id = request_messages.request_id
      AND sr.user_id = auth.uid()
  )
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Request participants can send messages"
ON public.request_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = request_messages.request_id
        AND sr.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
);