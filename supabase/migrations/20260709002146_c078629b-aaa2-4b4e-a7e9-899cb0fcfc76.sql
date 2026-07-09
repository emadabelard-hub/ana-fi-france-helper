DROP POLICY IF EXISTS "Anyone can view promo metrics" ON public.promo_metrics;
REVOKE SELECT ON public.promo_metrics FROM anon;
GRANT SELECT ON public.promo_metrics TO authenticated;
CREATE POLICY "Authenticated can view promo metrics"
ON public.promo_metrics
FOR SELECT
TO authenticated
USING (true);