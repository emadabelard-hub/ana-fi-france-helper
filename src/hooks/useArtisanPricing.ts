import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PriceCatalogItem {
  code: string;
  category: string;
  subcategory: string;
  description: string;
  unit: string;
  material_price: number;
  labor_price: number;
  equipment_price: number;
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
  // Maçonnerie
  { code: 'MC001', category: 'maconnerie', subcategory: 'beton', description: 'dalle beton armee', unit: 'm2', material_price: 45, labor_price: 50, equipment_price: 0, total_price: 95 },
  { code: 'MC002', category: 'maconnerie', subcategory: 'mur', description: 'pose parpaing creux', unit: 'm2', material_price: 20, labor_price: 40, equipment_price: 0, total_price: 60 },
  { code: 'MC003', category: 'maconnerie', subcategory: 'chape', description: 'chape ciment', unit: 'm2', material_price: 15, labor_price: 20, equipment_price: 0, total_price: 35 },
  { code: 'MC004', category: 'maconnerie', subcategory: 'structure', description: 'ouverture mur porteur', unit: 'unit', material_price: 500, labor_price: 700, equipment_price: 0, total_price: 1200 },
  { code: 'MC005', category: 'maconnerie', subcategory: 'facade', description: 'enduit facade', unit: 'm2', material_price: 12, labor_price: 20, equipment_price: 0, total_price: 32 },
  { code: 'MC006', category: 'maconnerie', subcategory: 'demolition', description: 'demolition mur brique', unit: 'm2', material_price: 5, labor_price: 25, equipment_price: 0, total_price: 30 },
  { code: 'MC007', category: 'maconnerie', subcategory: 'terrassement', description: 'terrassement sol', unit: 'm3', material_price: 10, labor_price: 20, equipment_price: 15, total_price: 45 },
  // Placo
  { code: 'PL001', category: 'placo', subcategory: 'cloison', description: 'pose placo BA13', unit: 'm2', material_price: 12, labor_price: 35, equipment_price: 0, total_price: 55 },
  { code: 'PL002', category: 'placo', subcategory: 'cloison', description: 'cloison placo isolée', unit: 'm2', material_price: 25, labor_price: 45, equipment_price: 0, total_price: 70 },
  { code: 'PL003', category: 'placo', subcategory: 'plafond', description: 'faux plafond placo', unit: 'm2', material_price: 18, labor_price: 47, equipment_price: 0, total_price: 65 },
  { code: 'PL004', category: 'placo', subcategory: 'finitions', description: 'bande placo', unit: 'm2', material_price: 2, labor_price: 10, equipment_price: 0, total_price: 12 },
  { code: 'PL005', category: 'placo', subcategory: 'isolation', description: 'isolation laine verre', unit: 'm2', material_price: 8, labor_price: 18, equipment_price: 0, total_price: 26 },
  // Peinture
  { code: 'PNT001', category: 'peinture', subcategory: 'mur', description: 'peinture blanche mate', unit: 'm2', material_price: 4, labor_price: 18, equipment_price: 0, total_price: 22 },
  { code: 'PNT002', category: 'peinture', subcategory: 'mur', description: 'peinture blanche satinée', unit: 'm2', material_price: 5, labor_price: 18, equipment_price: 0, total_price: 23 },
  { code: 'PNT003', category: 'peinture', subcategory: 'mur', description: 'peinture couleur', unit: 'm2', material_price: 6, labor_price: 18, equipment_price: 0, total_price: 24 },
  { code: 'PNT004', category: 'peinture', subcategory: 'plafond', description: 'peinture plafond', unit: 'm2', material_price: 6, labor_price: 22, equipment_price: 0, total_price: 28 },
  { code: 'PNT005', category: 'peinture', subcategory: 'facade', description: 'peinture facade', unit: 'm2', material_price: 8, labor_price: 22, equipment_price: 0, total_price: 30 },
  { code: 'PNT006', category: 'peinture', subcategory: 'special', description: 'peinture anti humidite', unit: 'm2', material_price: 9, labor_price: 20, equipment_price: 0, total_price: 29 },
  { code: 'PNT007', category: 'peinture', subcategory: 'boiserie', description: 'peinture porte bois', unit: 'unit', material_price: 10, labor_price: 30, equipment_price: 0, total_price: 40 },
  { code: 'PNT008', category: 'peinture', subcategory: 'metal', description: 'peinture metal', unit: 'unit', material_price: 8, labor_price: 22, equipment_price: 0, total_price: 30 },
  // Carrelage
  { code: 'CR001', category: 'carrelage', subcategory: 'sol', description: 'pose carrelage sol', unit: 'm2', material_price: 30, labor_price: 45, equipment_price: 0, total_price: 75 },
  { code: 'CR002', category: 'carrelage', subcategory: 'mur', description: 'pose faience murale', unit: 'm2', material_price: 28, labor_price: 42, equipment_price: 0, total_price: 70 },
  { code: 'CR003', category: 'carrelage', subcategory: 'preparation', description: 'ragreage sol', unit: 'm2', material_price: 6, labor_price: 14, equipment_price: 0, total_price: 20 },
  { code: 'CR004', category: 'carrelage', subcategory: 'demolition', description: 'depose carrelage', unit: 'm2', material_price: 2, labor_price: 23, equipment_price: 0, total_price: 25 },
  { code: 'CR005', category: 'carrelage', subcategory: 'exterieur', description: 'pose carrelage terrasse', unit: 'm2', material_price: 35, labor_price: 50, equipment_price: 0, total_price: 85 },
  // Parquet
  { code: 'PQ001', category: 'parquet', subcategory: 'sol', description: 'pose parquet flottant', unit: 'm2', material_price: 25, labor_price: 20, equipment_price: 0, total_price: 45 },
  { code: 'PQ002', category: 'parquet', subcategory: 'sol', description: 'pose parquet colle', unit: 'm2', material_price: 35, labor_price: 30, equipment_price: 0, total_price: 65 },
  { code: 'PQ003', category: 'parquet', subcategory: 'finitions', description: 'pose plinthe', unit: 'ml', material_price: 3, labor_price: 7, equipment_price: 0, total_price: 10 },
  { code: 'PQ004', category: 'parquet', subcategory: 'demolition', description: 'depose parquet', unit: 'm2', material_price: 0, labor_price: 20, equipment_price: 0, total_price: 20 },
  { code: 'PQ005', category: 'parquet', subcategory: 'poncage', description: 'poncage parquet', unit: 'm2', material_price: 5, labor_price: 18, equipment_price: 0, total_price: 23 },
  // Plomberie
  { code: 'PB001', category: 'plomberie', subcategory: 'sanitaire', description: 'installation wc', unit: 'unit', material_price: 120, labor_price: 130, equipment_price: 0, total_price: 250 },
  { code: 'PB002', category: 'plomberie', subcategory: 'sanitaire', description: 'installation lavabo', unit: 'unit', material_price: 90, labor_price: 110, equipment_price: 0, total_price: 200 },
  { code: 'PB003', category: 'plomberie', subcategory: 'douche', description: 'pose douche', unit: 'unit', material_price: 350, labor_price: 250, equipment_price: 0, total_price: 600 },
  { code: 'PB004', category: 'plomberie', subcategory: 'reparation', description: 'reparation fuite', unit: 'unit', material_price: 10, labor_price: 110, equipment_price: 0, total_price: 120 },
  { code: 'PB005', category: 'plomberie', subcategory: 'chauffe_eau', description: 'installation chauffe eau', unit: 'unit', material_price: 250, labor_price: 200, equipment_price: 0, total_price: 450 },
  // Electricite
  { code: 'EL001', category: 'electricite', subcategory: 'prise', description: 'prise electrique murale', unit: 'unit', material_price: 15, labor_price: 65, equipment_price: 0, total_price: 80 },
  { code: 'EL002', category: 'electricite', subcategory: 'interrupteur', description: 'interrupteur simple', unit: 'unit', material_price: 12, labor_price: 48, equipment_price: 0, total_price: 60 },
  { code: 'EL003', category: 'electricite', subcategory: 'tableau', description: 'tableau electrique', unit: 'unit', material_price: 500, labor_price: 400, equipment_price: 0, total_price: 900 },
  { code: 'EL004', category: 'electricite', subcategory: 'eclairage', description: 'luminaire plafond', unit: 'unit', material_price: 40, labor_price: 80, equipment_price: 0, total_price: 120 },
  { code: 'EL005', category: 'electricite', subcategory: 'reseau', description: 'installation cable electrique', unit: 'ml', material_price: 3, labor_price: 8, equipment_price: 0, total_price: 11 },
  // Menuiserie
  { code: 'MN001', category: 'menuiserie', subcategory: 'porte', description: 'pose porte interieure', unit: 'unit', material_price: 120, labor_price: 180, equipment_price: 0, total_price: 300 },
  { code: 'MN002', category: 'menuiserie', subcategory: 'fenetre', description: 'pose fenetre pvc', unit: 'unit', material_price: 300, labor_price: 250, equipment_price: 0, total_price: 550 },
  { code: 'MN003', category: 'menuiserie', subcategory: 'placard', description: 'placard sur mesure', unit: 'unit', material_price: 350, labor_price: 250, equipment_price: 0, total_price: 600 },
  { code: 'MN004', category: 'menuiserie', subcategory: 'plinthe', description: 'pose plinthe bois', unit: 'ml', material_price: 5, labor_price: 10, equipment_price: 0, total_price: 15 },
  // Facade
  { code: 'FAC001', category: 'facade', subcategory: 'nettoyage', description: 'nettoyage facade haute pression', unit: 'm2', material_price: 2, labor_price: 15, equipment_price: 5, total_price: 22 },
  { code: 'FAC002', category: 'facade', subcategory: 'sablage', description: 'sablage facade', unit: 'm2', material_price: 4, labor_price: 20, equipment_price: 6, total_price: 30 },
  { code: 'FAC003', category: 'facade', subcategory: 'ravalement', description: 'ravalement facade', unit: 'm2', material_price: 12, labor_price: 28, equipment_price: 0, total_price: 40 },
  // Location
  { code: 'LOC001', category: 'location', subcategory: 'materiel', description: 'echafaudage roulant', unit: 'day', material_price: 45, labor_price: 0, equipment_price: 0, total_price: 45 },
  { code: 'LOC002', category: 'location', subcategory: 'materiel', description: 'echafaudage fixe', unit: 'm2_day', material_price: 8, labor_price: 0, equipment_price: 0, total_price: 8 },
  { code: 'LOC003', category: 'location', subcategory: 'materiel', description: 'sableuse', unit: 'day', material_price: 90, labor_price: 0, equipment_price: 0, total_price: 90 },
  { code: 'LOC004', category: 'location', subcategory: 'materiel', description: 'ponceuse girafe', unit: 'day', material_price: 35, labor_price: 0, equipment_price: 0, total_price: 35 },
  { code: 'LOC005', category: 'location', subcategory: 'materiel', description: 'betonniere', unit: 'day', material_price: 40, labor_price: 0, equipment_price: 0, total_price: 40 },
  { code: 'LOC006', category: 'location', subcategory: 'materiel', description: 'nacelle', unit: 'day', material_price: 180, labor_price: 0, equipment_price: 0, total_price: 180 },
  // Nettoyage général
  { code: 'GN001', category: 'general', subcategory: 'nettoyage', description: 'nettoyage chantier', unit: 'forfait', material_price: 200, labor_price: 200, equipment_price: 0, total_price: 200 },
];

// Build legacy pricing from catalog for backward compat
export const buildLegacyPricing = (catalog: PriceCatalogItem[]): ArtisanPricing => {
  const find = (code: string) => catalog.find(c => c.code === code);
  const pnt001 = find('PNT001');
  const pnt004 = find('PNT004');
  const pnt007 = find('PNT007');
  const cr003 = find('CR003');

  return {
    enduit_full: cr003?.total_price ?? 20,
    enduit_labor: cr003?.labor_price ?? 14,
    peinture_mur_full: pnt001?.total_price ?? 22,
    peinture_mur_labor: pnt001?.labor_price ?? 0,
    peinture_plafond_full: pnt004?.total_price ?? 28,
    peinture_plafond_labor: pnt004?.labor_price ?? 22,
    fenetre_full: pnt007?.total_price ?? 40,
    fenetre_labor: pnt007?.labor_price ?? 30,
    nettoyage_forfait: 200,
    sous_couche_full: cr003?.total_price ?? 20,
    poncage_full: find('PQ005')?.total_price ?? 23,
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
          subcategory: d.subcategory || '',
          description: d.description,
          unit: d.unit,
          material_price: Number(d.material_price),
          labor_price: Number(d.labor_price),
          equipment_price: Number(d.equipment_price || 0),
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
      await (supabase as any)
        .from('artisan_price_catalog')
        .delete()
        .eq('user_id', user.id);

      const rows = newCatalog.map(item => ({
        user_id: user.id,
        code: item.code,
        category: item.category,
        subcategory: item.subcategory,
        description: item.description,
        unit: item.unit,
        material_price: item.material_price,
        labor_price: item.labor_price,
        equipment_price: item.equipment_price,
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

  const savePricing = async (newPricing: ArtisanPricing) => {
    return true;
  };

  return { pricing, catalog, isLoading, isSaving, savePricing, saveCatalog };
};
