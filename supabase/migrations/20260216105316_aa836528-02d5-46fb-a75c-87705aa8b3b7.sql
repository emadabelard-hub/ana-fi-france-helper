-- Add email format validation to transfer_waitlist
ALTER TABLE public.transfer_waitlist
ADD CONSTRAINT valid_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Drop unused admin_pin column
ALTER TABLE public.admin_users DROP COLUMN IF EXISTS admin_pin;