import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ArtisanPricing {
  enduit_full: number;
  enduit_labor: number;
  peinture_plafond_full: number;
  peinture_plafond_labor: number;
  peinture_mur_full: number;
  peinture_mur_labor: number;
  nettoyage_forfait: number;
  fenetre_full: number;
  fenetre_labor: number;
  sous_couche_full: number;
  poncage_full: number;
}

export const DEFAULT_PRICING: ArtisanPricing = {
  enduit_full: 16,
  enduit_labor: 8.8,
  peinture_plafond_full: 30,
  peinture_plafond_labor: 16.5,
  peinture_mur_full: 30,
  peinture_mur_labor: 16.5,
  nettoyage_forfait: 200,
  fenetre_full: 60,
  fenetre_labor: 35,
  sous_couche_full: 12,
  poncage_full: 14,
};

export const useArtisanPricing = () => {
  const { user } = useAuth();
  const [pricing, setPricing] = useState<ArtisanPricing>(DEFAULT_PRICING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPricing = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    try {
      const { data, error } = await (supabase as any)
        .from('artisan_pricing')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setPricing({
          enduit_full: Number(data.enduit_full),
          enduit_labor: Number(data.enduit_labor),
          peinture_plafond_full: Number(data.peinture_plafond_full),
          peinture_plafond_labor: Number(data.peinture_plafond_labor),
          peinture_mur_full: Number(data.peinture_mur_full),
          peinture_mur_labor: Number(data.peinture_mur_labor),
          nettoyage_forfait: Number(data.nettoyage_forfait),
          fenetre_full: Number(data.fenetre_full),
          fenetre_labor: Number(data.fenetre_labor),
          sous_couche_full: Number(data.sous_couche_full),
          poncage_full: Number(data.ponçage_full),
        });
      }
    } catch (e) {
      console.warn('Failed to load pricing:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchPricing(); }, [fetchPricing]);

  const savePricing = async (newPricing: ArtisanPricing) => {
    if (!user) return false;
    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('artisan_pricing')
        .upsert({
          user_id: user.id,
          enduit_full: newPricing.enduit_full,
          enduit_labor: newPricing.enduit_labor,
          peinture_plafond_full: newPricing.peinture_plafond_full,
          peinture_plafond_labor: newPricing.peinture_plafond_labor,
          peinture_mur_full: newPricing.peinture_mur_full,
          peinture_mur_labor: newPricing.peinture_mur_labor,
          nettoyage_forfait: newPricing.nettoyage_forfait,
          fenetre_full: newPricing.fenetre_full,
          fenetre_labor: newPricing.fenetre_labor,
          sous_couche_full: newPricing.sous_couche_full,
          'ponçage_full': newPricing.poncage_full,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setPricing(newPricing);
      return true;
    } catch (e) {
      console.error('Failed to save pricing:', e);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { pricing, isLoading, isSaving, savePricing };
};
