import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PriceCatalogItem {
  code: string;
  category: string;
  description: string;
  unit: string;
  material_price: number;
  labor_price: number;
  total_price: number;
}

// Legacy interface kept for backward compatibility
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

export const DEFAULT_CATALOG: PriceCatalogItem[] = [
  { code: 'PT001', category: 'peinture', description: 'peinture mur blanc', unit: 'm2', material_price: 5, labor_price: 20, total_price: 30 },
  { code: 'PT002', category: 'peinture', description: 'peinture plafond', unit: 'm2', material_price: 6, labor_price: 22, total_price: 32 },
  { code: 'PT003', category: 'peinture', description: 'Preparation/Enduit (Lissage)', unit: 'm2', material_price: 4, labor_price: 10, total_price: 14 },
  { code: 'PT004', category: 'peinture', description: 'Portes et Fenêtres', unit: 'unit', material_price: 15, labor_price: 45, total_price: 60 },
  { code: 'PL001', category: 'placo', description: 'pose placo BA13', unit: 'm2', material_price: 12, labor_price: 35, total_price: 55 },
  { code: 'PL002', category: 'placo', description: 'cloison placo complete', unit: 'm2', material_price: 25, labor_price: 45, total_price: 70 },
  { code: 'CR001', category: 'carrelage', description: 'pose carrelage sol', unit: 'm2', material_price: 30, labor_price: 45, total_price: 75 },
  { code: 'CR002', category: 'carrelage', description: 'pose faience murale', unit: 'm2', material_price: 28, labor_price: 42, total_price: 70 },
  { code: 'PQ001', category: 'parquet', description: 'pose parquet flottant', unit: 'm2', material_price: 25, labor_price: 20, total_price: 45 },
  { code: 'PQ002', category: 'parquet', description: 'pose parquet colle', unit: 'm2', material_price: 35, labor_price: 30, total_price: 65 },
  { code: 'PB001', category: 'plomberie', description: 'installation wc', unit: 'unit', material_price: 120, labor_price: 130, total_price: 250 },
  { code: 'PB002', category: 'plomberie', description: 'installation lavabo', unit: 'unit', material_price: 90, labor_price: 110, total_price: 200 },
  { code: 'PB003', category: 'plomberie', description: 'installation Douche/Baignoire', unit: 'unit', material_price: 400, labor_price: 500, total_price: 900 },
  { code: 'EL001', category: 'electricite', description: 'prise electrique', unit: 'unit', material_price: 15, labor_price: 65, total_price: 80 },
  { code: 'EL002', category: 'electricite', description: 'interrupteur', unit: 'unit', material_price: 12, labor_price: 48, total_price: 60 },
  { code: 'EL003', category: 'electricite', description: 'Tableau Electrique complet', unit: 'unit', material_price: 600, labor_price: 700, total_price: 1300 },
  { code: 'MC001', category: 'maconnerie', description: 'dalle beton', unit: 'm2', material_price: 45, labor_price: 50, total_price: 95 },
  { code: 'MC002', category: 'maconnerie', description: 'pose parpaing', unit: 'm2', material_price: 20, labor_price: 40, total_price: 60 },
  { code: 'MC003', category: 'maconnerie', description: 'Demolition mur', unit: 'm2', material_price: 0, labor_price: 40, total_price: 40 },
  { code: 'PS001', category: 'piscine', description: 'Terrassement/Structure', unit: 'm3', material_price: 150, labor_price: 200, total_price: 350 },
  { code: 'PS002', category: 'piscine', description: 'Etanchéité/Liner', unit: 'm2', material_price: 40, labor_price: 60, total_price: 100 },
  { code: 'PS003', category: 'piscine', description: 'Filtration/Local technique', unit: 'unit', material_price: 1200, labor_price: 800, total_price: 2000 },
  { code: 'GN001', category: 'general', description: 'Nettoyage Chantier final', unit: 'unit', material_price: 30, labor_price: 170, total_price: 200 },
];

// Build legacy pricing from catalog for backward compat
export const buildLegacyPricing = (catalog: PriceCatalogItem[]): ArtisanPricing => {
  const find = (code: string) => catalog.find(c => c.code === code);
  const pt003 = find('PT003');
  const pt001 = find('PT001');
  const pt002 = find('PT002');
  const pt004 = find('PT004');
  const gn001 = find('GN001');

  return {
    enduit_full: pt003?.total_price ?? 14,
    enduit_labor: pt003?.labor_price ?? 10,
    peinture_mur_full: pt001?.total_price ?? 30,
    peinture_mur_labor: pt001?.labor_price ?? 20,
    peinture_plafond_full: pt002?.total_price ?? 32,
    peinture_plafond_labor: pt002?.labor_price ?? 22,
    fenetre_full: pt004?.total_price ?? 60,
    fenetre_labor: pt004?.labor_price ?? 45,
    nettoyage_forfait: gn001?.total_price ?? 200,
    sous_couche_full: pt003?.total_price ?? 14,
    poncage_full: pt003?.total_price ?? 14,
  };
};

export const DEFAULT_PRICING: ArtisanPricing = buildLegacyPricing(DEFAULT_CATALOG);

export const useArtisanPricing = () => {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<PriceCatalogItem[]>(DEFAULT_CATALOG);
  const [pricing, setPricing] = useState<ArtisanPricing>(DEFAULT_PRICING);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCatalog = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    try {
      const { data, error } = await (supabase as any)
        .from('artisan_price_catalog')
        .select('*')
        .eq('user_id', user.id)
        .order('code');

      if (!error && data && data.length > 0) {
        const items: PriceCatalogItem[] = data.map((d: any) => ({
          code: d.code,
          category: d.category,
          description: d.description,
          unit: d.unit,
          material_price: Number(d.material_price),
          labor_price: Number(d.labor_price),
          total_price: Number(d.total_price),
        }));
        setCatalog(items);
        setPricing(buildLegacyPricing(items));
      } else {
        setCatalog(DEFAULT_CATALOG);
        setPricing(DEFAULT_PRICING);
      }
    } catch (e) {
      console.warn('Failed to load price catalog:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const saveCatalog = async (newCatalog: PriceCatalogItem[]) => {
    if (!user) return false;
    setIsSaving(true);
    try {
      // Delete existing and re-insert
      await (supabase as any)
        .from('artisan_price_catalog')
        .delete()
        .eq('user_id', user.id);

      const rows = newCatalog.map(item => ({
        user_id: user.id,
        code: item.code,
        category: item.category,
        description: item.description,
        unit: item.unit,
        material_price: item.material_price,
        labor_price: item.labor_price,
        total_price: item.total_price,
      }));

      const { error } = await (supabase as any)
        .from('artisan_price_catalog')
        .insert(rows);

      if (error) throw error;
      setCatalog(newCatalog);
      setPricing(buildLegacyPricing(newCatalog));
      return true;
    } catch (e) {
      console.error('Failed to save price catalog:', e);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Legacy save (kept for backward compat but now no-op, use saveCatalog)
  const savePricing = async (newPricing: ArtisanPricing) => {
    // No longer used directly, but kept for interface compat
    return true;
  };

  return { pricing, catalog, isLoading, isSaving, savePricing, saveCatalog };
};
