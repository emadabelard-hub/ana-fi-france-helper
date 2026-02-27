
-- Add device_info column to user_activity_logs
ALTER TABLE public.user_activity_logs ADD COLUMN IF NOT EXISTS device_info text DEFAULT 'unknown';
