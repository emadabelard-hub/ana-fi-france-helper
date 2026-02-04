import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PromoMetrics {
  views: number;
  clicks: number;
}

export const usePromoMetrics = (promoId: string) => {
  const [metrics, setMetrics] = useState<PromoMetrics>({ views: 0, clicks: 0 });
  const [hasTrackedView, setHasTrackedView] = useState(false);

  // Fetch current metrics
  const fetchMetrics = useCallback(async () => {
    const { data, error } = await supabase
      .from('promo_metrics')
      .select('views, clicks')
      .eq('promo_id', promoId)
      .single();

    if (!error && data) {
      setMetrics({ views: data.views, clicks: data.clicks });
    }
  }, [promoId]);

  // Track view on mount (only once per component lifecycle)
  useEffect(() => {
    const trackView = async () => {
      if (hasTrackedView) return;
      
      try {
        await supabase.rpc('increment_promo_views', { p_promo_id: promoId });
        setHasTrackedView(true);
        // Refetch to get updated count
        fetchMetrics();
      } catch (error) {
        console.error('Error tracking promo view:', error);
      }
    };

    trackView();
  }, [promoId, hasTrackedView, fetchMetrics]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Track click
  const trackClick = useCallback(async () => {
    try {
      await supabase.rpc('increment_promo_clicks', { p_promo_id: promoId });
      // Optimistically update
      setMetrics(prev => ({ ...prev, clicks: prev.clicks + 1 }));
    } catch (error) {
      console.error('Error tracking promo click:', error);
    }
  }, [promoId]);

  return { metrics, trackClick };
};
