
-- Service requests table
CREATE TABLE public.service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'administrative',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  price_eur NUMERIC NOT NULL DEFAULT 4.00,
  ai_requirements TEXT,
  specialist_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
ON public.service_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests"
ON public.service_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending requests"
ON public.service_requests FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
ON public.service_requests FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all requests"
ON public.service_requests FOR UPDATE
USING (is_admin(auth.uid()));

-- Request messages (real-time chat)
CREATE TABLE public.request_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Request participants can view messages"
ON public.request_messages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.service_requests WHERE id = request_id AND user_id = auth.uid())
  OR is_admin(auth.uid())
);

CREATE POLICY "Request participants can send messages"
ON public.request_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (SELECT 1 FROM public.service_requests WHERE id = request_id AND user_id = auth.uid())
    OR is_admin(auth.uid())
  )
);

-- Request files
CREATE TABLE public.request_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.request_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Request participants can view files"
ON public.request_files FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.service_requests WHERE id = request_id AND user_id = auth.uid())
  OR is_admin(auth.uid())
);

CREATE POLICY "Request participants can upload files"
ON public.request_files FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND (
    EXISTS (SELECT 1 FROM public.service_requests WHERE id = request_id AND user_id = auth.uid())
    OR is_admin(auth.uid())
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_messages;

-- Trigger for updated_at on service_requests
CREATE TRIGGER update_service_requests_updated_at
BEFORE UPDATE ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for request files
INSERT INTO storage.buckets (id, name, public) VALUES ('request-files', 'request-files', false);

CREATE POLICY "Users can upload request files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'request-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own request files"
ON storage.objects FOR SELECT
USING (bucket_id = 'request-files' AND auth.uid() IS NOT NULL);
