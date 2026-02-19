
-- Fix admin_transactions_view: recreate with security_invoker and add RLS
DROP VIEW IF EXISTS public.admin_transactions_view;

CREATE VIEW public.admin_transactions_view
WITH (security_invoker = on) AS
SELECT 
  t.id,
  t.user_id,
  t.price_eur,
  t.is_bundle,
  t.created_at,
  t.service_name,
  t.service_key,
  t.status,
  p.full_name,
  p.email
FROM public.transactions t
LEFT JOIN public.profiles p ON t.user_id = p.user_id;

-- Fix admin_user_list: recreate with security_invoker and add RLS
DROP VIEW IF EXISTS public.admin_user_list;

CREATE VIEW public.admin_user_list
WITH (security_invoker = on) AS
SELECT 
  p.id,
  p.user_id,
  p.created_at,
  p.updated_at,
  p.credits_balance,
  p.daily_message_count,
  p.full_name
FROM public.profiles p;
