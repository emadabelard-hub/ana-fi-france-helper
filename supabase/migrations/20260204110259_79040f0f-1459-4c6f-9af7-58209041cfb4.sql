-- Add credits_balance column to profiles with 20 free credits for new users
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS credits_balance integer NOT NULL DEFAULT 20;

-- Add daily_message_count and last_message_date for rate limiting
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_message_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_message_date date;

-- Update existing users to have 20 credits if they have 0 or null
UPDATE public.profiles 
SET credits_balance = 20 
WHERE credits_balance IS NULL OR credits_balance = 0;

-- Create a function to reset daily message count
CREATE OR REPLACE FUNCTION public.reset_daily_message_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_message_date IS DISTINCT FROM CURRENT_DATE THEN
    NEW.daily_message_count := 0;
    NEW.last_message_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-reset daily count on profile update
DROP TRIGGER IF EXISTS reset_daily_messages_trigger ON public.profiles;
CREATE TRIGGER reset_daily_messages_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.reset_daily_message_count();