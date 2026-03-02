
ALTER TABLE public.support_tickets
ADD COLUMN admin_reply text DEFAULT NULL,
ADD COLUMN replied_at timestamp with time zone DEFAULT NULL;
