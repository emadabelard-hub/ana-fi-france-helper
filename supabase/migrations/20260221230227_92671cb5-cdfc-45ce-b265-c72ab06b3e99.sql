
-- Fix request_files and request_messages INSERT policies (UUID columns, no text cast needed)
-- The previous migration partially applied (DROPs succeeded), so we only need CREATEs for these two tables

-- === request_files ===
DROP POLICY IF EXISTS "Request participants can upload files" ON public.request_files;
DROP POLICY IF EXISTS "Request participants can view files" ON public.request_files;

CREATE POLICY "Request participants can view files" ON public.request_files FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM service_requests WHERE service_requests.id = request_files.request_id AND service_requests.user_id = auth.uid())
  OR is_admin(auth.uid())
);
CREATE POLICY "Request participants can upload files" ON public.request_files FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (SELECT 1 FROM service_requests WHERE service_requests.id = request_files.request_id AND service_requests.user_id = auth.uid())
);

-- === request_messages ===
DROP POLICY IF EXISTS "Request participants can send messages" ON public.request_messages;
DROP POLICY IF EXISTS "Request participants can view messages" ON public.request_messages;

CREATE POLICY "Request participants can view messages" ON public.request_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM service_requests WHERE service_requests.id = request_messages.request_id AND service_requests.user_id = auth.uid())
  OR is_admin(auth.uid())
);
CREATE POLICY "Request participants can send messages" ON public.request_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM service_requests WHERE service_requests.id = request_messages.request_id AND service_requests.user_id = auth.uid())
);
