
-- Add input validation to promo RPC functions to restrict to known promo IDs only

CREATE OR REPLACE FUNCTION public.increment_promo_views(p_promo_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow known promo IDs
  IF p_promo_id NOT IN ('bank_promo', 'transfer_promo') THEN
    RAISE EXCEPTION 'Invalid promo ID';
  END IF;

  INSERT INTO public.promo_metrics (promo_id, views, clicks)
  VALUES (p_promo_id, 1, 0)
  ON CONFLICT (promo_id)
  DO UPDATE SET views = promo_metrics.views + 1, updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_promo_clicks(p_promo_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow known promo IDs
  IF p_promo_id NOT IN ('bank_promo', 'transfer_promo') THEN
    RAISE EXCEPTION 'Invalid promo ID';
  END IF;

  INSERT INTO public.promo_metrics (promo_id, views, clicks)
  VALUES (p_promo_id, 0, 1)
  ON CONFLICT (promo_id)
  DO UPDATE SET clicks = promo_metrics.clicks + 1, updated_at = now();
END;
$function$;
