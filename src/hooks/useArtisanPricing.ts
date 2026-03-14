import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PriceCatalogItem {
  code: string;
  category: string;
  subcategory: string; // type: travail | matériau | materiel | service
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
  // ═══════════════════════════════════════════════
  // MAÇONNERIE
  // ═══════════════════════════════════════════════
  { code: 'MAC01', category: 'maconnerie', subcategory: 'travail', description: 'démolition cloison placo', unit: 'm2', labor_price: 20, material_price: 5, equipment_price: 0, total_price: 25 },
  { code: 'MAC02', category: 'maconnerie', subcategory: 'travail', description: 'démolition mur brique', unit: 'm2', labor_price: 35, material_price: 10, equipment_price: 0, total_price: 45 },
  { code: 'MAC03', category: 'maconnerie', subcategory: 'travail', description: 'évacuation gravats', unit: 'forfait', labor_price: 80, material_price: 70, equipment_price: 0, total_price: 150 },
  { code: 'MAC04', category: 'maconnerie', subcategory: 'travail', description: 'création ouverture mur', unit: 'unit', labor_price: 300, material_price: 150, equipment_price: 0, total_price: 450 },
  { code: 'MAC05', category: 'maconnerie', subcategory: 'travail', description: 'pose IPN', unit: 'unit', labor_price: 400, material_price: 200, equipment_price: 0, total_price: 600 },
  { code: 'MAC06', category: 'maconnerie', subcategory: 'travail', description: 'chape béton', unit: 'm2', labor_price: 25, material_price: 20, equipment_price: 0, total_price: 45 },
  { code: 'MAC07', category: 'maconnerie', subcategory: 'travail', description: 'chape liquide', unit: 'm2', labor_price: 22, material_price: 18, equipment_price: 0, total_price: 40 },
  { code: 'MAC08', category: 'maconnerie', subcategory: 'travail', description: 'dalle béton', unit: 'm2', labor_price: 50, material_price: 45, equipment_price: 0, total_price: 95 },
  { code: 'MAC09', category: 'maconnerie', subcategory: 'travail', description: 'ragréage sol', unit: 'm2', labor_price: 14, material_price: 6, equipment_price: 0, total_price: 20 },
  { code: 'MAC10', category: 'maconnerie', subcategory: 'travail', description: 'pose parpaing', unit: 'm2', labor_price: 45, material_price: 30, equipment_price: 0, total_price: 75 },
  { code: 'MAC11', category: 'maconnerie', subcategory: 'travail', description: 'mur parpaing enduit', unit: 'm2', labor_price: 55, material_price: 40, equipment_price: 0, total_price: 95 },
  { code: 'MAC12', category: 'maconnerie', subcategory: 'travail', description: 'création terrasse béton', unit: 'm2', labor_price: 50, material_price: 45, equipment_price: 0, total_price: 95 },
  { code: 'MAC13', category: 'maconnerie', subcategory: 'travail', description: 'pose bordure jardin', unit: 'ml', labor_price: 20, material_price: 15, equipment_price: 0, total_price: 35 },
  { code: 'MAC14', category: 'maconnerie', subcategory: 'travail', description: 'fondation mur', unit: 'ml', labor_price: 50, material_price: 35, equipment_price: 0, total_price: 85 },

  // ═══════════════════════════════════════════════
  // PEINTURE
  // ═══════════════════════════════════════════════
  { code: 'PEI01', category: 'peinture', subcategory: 'travail', description: 'préparation murs', unit: 'm2', labor_price: 22, material_price: 6, equipment_price: 0, total_price: 28 },
  { code: 'PEI02', category: 'peinture', subcategory: 'travail', description: 'peinture murs blanche', unit: 'm2', labor_price: 18, material_price: 4, equipment_price: 0, total_price: 22 },
  { code: 'PEI03', category: 'peinture', subcategory: 'travail', description: 'peinture plafond', unit: 'm2', labor_price: 18, material_price: 4, equipment_price: 0, total_price: 22 },
  { code: 'PEI04', category: 'peinture', subcategory: 'travail', description: 'peinture couleur', unit: 'm2', labor_price: 20, material_price: 5, equipment_price: 0, total_price: 25 },
  { code: 'PEI05', category: 'peinture', subcategory: 'travail', description: 'peinture façade', unit: 'm2', labor_price: 28, material_price: 12, equipment_price: 0, total_price: 40 },
  { code: 'PEI06', category: 'peinture', subcategory: 'travail', description: 'enduit lissage', unit: 'm2', labor_price: 18, material_price: 7, equipment_price: 0, total_price: 25 },
  { code: 'PEI07', category: 'peinture', subcategory: 'travail', description: 'enduit rebouchage', unit: 'm2', labor_price: 10, material_price: 5, equipment_price: 0, total_price: 15 },
  { code: 'PEI08', category: 'peinture', subcategory: 'travail', description: 'ponçage murs', unit: 'm2', labor_price: 8, material_price: 2, equipment_price: 0, total_price: 10 },
  { code: 'PEI09', category: 'peinture', subcategory: 'travail', description: 'vernis bois', unit: 'm2', labor_price: 14, material_price: 4, equipment_price: 0, total_price: 18 },
  { code: 'PEI10', category: 'peinture', subcategory: 'travail', description: 'peinture porte', unit: 'unit', labor_price: 60, material_price: 30, equipment_price: 0, total_price: 90 },
  { code: 'PEI11', category: 'peinture', subcategory: 'travail', description: 'peinture fenêtre', unit: 'unit', labor_price: 50, material_price: 20, equipment_price: 0, total_price: 70 },

  // ═══════════════════════════════════════════════
  // CARRELAGE / SOL
  // ═══════════════════════════════════════════════
  { code: 'CAR01', category: 'carrelage', subcategory: 'travail', description: 'dépose carrelage', unit: 'm2', labor_price: 25, material_price: 5, equipment_price: 0, total_price: 30 },
  { code: 'CAR02', category: 'carrelage', subcategory: 'travail', description: 'pose carrelage sol', unit: 'm2', labor_price: 45, material_price: 30, equipment_price: 0, total_price: 75 },
  { code: 'CAR03', category: 'carrelage', subcategory: 'travail', description: 'pose carrelage grand format', unit: 'm2', labor_price: 55, material_price: 35, equipment_price: 0, total_price: 90 },
  { code: 'CAR04', category: 'carrelage', subcategory: 'travail', description: 'pose faïence murale', unit: 'm2', labor_price: 42, material_price: 28, equipment_price: 0, total_price: 70 },
  { code: 'CAR05', category: 'carrelage', subcategory: 'travail', description: 'pose mosaïque', unit: 'm2', labor_price: 50, material_price: 35, equipment_price: 0, total_price: 85 },
  { code: 'CAR06', category: 'carrelage', subcategory: 'travail', description: 'joint carrelage', unit: 'm2', labor_price: 8, material_price: 2, equipment_price: 0, total_price: 10 },
  { code: 'CAR07', category: 'carrelage', subcategory: 'travail', description: 'plinthe carrelage', unit: 'ml', labor_price: 12, material_price: 6, equipment_price: 0, total_price: 18 },
  { code: 'CAR08', category: 'carrelage', subcategory: 'travail', description: 'étanchéité salle bain', unit: 'm2', labor_price: 20, material_price: 15, equipment_price: 0, total_price: 35 },

  // ═══════════════════════════════════════════════
  // PLOMBERIE
  // ═══════════════════════════════════════════════
  { code: 'PLM01', category: 'plomberie', subcategory: 'travail', description: 'installation WC', unit: 'unit', labor_price: 130, material_price: 120, equipment_price: 0, total_price: 250 },
  { code: 'PLM02', category: 'plomberie', subcategory: 'travail', description: 'installation douche', unit: 'unit', labor_price: 250, material_price: 350, equipment_price: 0, total_price: 600 },
  { code: 'PLM03', category: 'plomberie', subcategory: 'travail', description: 'installation baignoire', unit: 'unit', labor_price: 300, material_price: 400, equipment_price: 0, total_price: 700 },
  { code: 'PLM04', category: 'plomberie', subcategory: 'travail', description: 'pose meuble vasque', unit: 'unit', labor_price: 90, material_price: 90, equipment_price: 0, total_price: 180 },
  { code: 'PLM05', category: 'plomberie', subcategory: 'travail', description: 'pose évier cuisine', unit: 'unit', labor_price: 110, material_price: 110, equipment_price: 0, total_price: 220 },
  { code: 'PLM06', category: 'plomberie', subcategory: 'travail', description: 'installation chauffe eau', unit: 'unit', labor_price: 350, material_price: 500, equipment_price: 0, total_price: 850 },
  { code: 'PLM07', category: 'plomberie', subcategory: 'travail', description: 'remplacement robinet', unit: 'unit', labor_price: 60, material_price: 30, equipment_price: 0, total_price: 90 },
  { code: 'PLM08', category: 'plomberie', subcategory: 'travail', description: 'création arrivée eau', unit: 'unit', labor_price: 120, material_price: 60, equipment_price: 0, total_price: 180 },
  { code: 'PLM09', category: 'plomberie', subcategory: 'travail', description: 'évacuation PVC', unit: 'ml', labor_price: 25, material_price: 15, equipment_price: 0, total_price: 40 },

  // ═══════════════════════════════════════════════
  // ÉLECTRICITÉ
  // ═══════════════════════════════════════════════
  { code: 'ELE01', category: 'electricite', subcategory: 'travail', description: 'prise électrique', unit: 'unit', labor_price: 74, material_price: 6, equipment_price: 0, total_price: 80 },
  { code: 'ELE02', category: 'electricite', subcategory: 'travail', description: 'interrupteur', unit: 'unit', labor_price: 65, material_price: 5, equipment_price: 0, total_price: 70 },
  { code: 'ELE03', category: 'electricite', subcategory: 'travail', description: 'spot LED encastré', unit: 'unit', labor_price: 78, material_price: 12, equipment_price: 0, total_price: 90 },
  { code: 'ELE04', category: 'electricite', subcategory: 'travail', description: 'installation tableau électrique', unit: 'unit', labor_price: 750, material_price: 200, equipment_price: 0, total_price: 950 },
  { code: 'ELE05', category: 'electricite', subcategory: 'travail', description: 'mise aux normes électrique', unit: 'm2', labor_price: 60, material_price: 25, equipment_price: 0, total_price: 85 },
  { code: 'ELE06', category: 'electricite', subcategory: 'travail', description: 'tirage ligne électrique', unit: 'ml', labor_price: 35, material_price: 10, equipment_price: 0, total_price: 45 },
  { code: 'ELE07', category: 'electricite', subcategory: 'travail', description: 'pose luminaire', unit: 'unit', labor_price: 45, material_price: 15, equipment_price: 0, total_price: 60 },
  { code: 'ELE08', category: 'electricite', subcategory: 'travail', description: 'installation VMC', unit: 'unit', labor_price: 250, material_price: 200, equipment_price: 0, total_price: 450 },

  // ═══════════════════════════════════════════════
  // MENUISERIE
  // ═══════════════════════════════════════════════
  { code: 'MEN01', category: 'menuiserie', subcategory: 'travail', description: 'pose porte intérieure', unit: 'unit', labor_price: 150, material_price: 130, equipment_price: 0, total_price: 280 },
  { code: 'MEN02', category: 'menuiserie', subcategory: 'travail', description: 'pose porte blindée', unit: 'unit', labor_price: 400, material_price: 800, equipment_price: 0, total_price: 1200 },
  { code: 'MEN03', category: 'menuiserie', subcategory: 'travail', description: 'pose fenêtre PVC', unit: 'unit', labor_price: 250, material_price: 400, equipment_price: 0, total_price: 650 },
  { code: 'MEN04', category: 'menuiserie', subcategory: 'travail', description: 'pose fenêtre aluminium', unit: 'unit', labor_price: 350, material_price: 550, equipment_price: 0, total_price: 900 },
  { code: 'MEN05', category: 'menuiserie', subcategory: 'travail', description: 'pose parquet flottant', unit: 'm2', labor_price: 20, material_price: 25, equipment_price: 0, total_price: 45 },
  { code: 'MEN06', category: 'menuiserie', subcategory: 'travail', description: 'pose parquet massif', unit: 'm2', labor_price: 35, material_price: 50, equipment_price: 0, total_price: 85 },
  { code: 'MEN07', category: 'menuiserie', subcategory: 'travail', description: 'pose plinthes', unit: 'ml', labor_price: 7, material_price: 3, equipment_price: 0, total_price: 10 },
  { code: 'MEN08', category: 'menuiserie', subcategory: 'travail', description: 'pose dressing', unit: 'unit', labor_price: 250, material_price: 350, equipment_price: 0, total_price: 600 },

  // ═══════════════════════════════════════════════
  // TOITURE
  // ═══════════════════════════════════════════════
  { code: 'TOI01', category: 'toiture', subcategory: 'travail', description: 'réparation toiture', unit: 'm2', labor_price: 50, material_price: 30, equipment_price: 0, total_price: 80 },
  { code: 'TOI02', category: 'toiture', subcategory: 'travail', description: 'pose tuiles', unit: 'm2', labor_price: 55, material_price: 40, equipment_price: 0, total_price: 95 },
  { code: 'TOI03', category: 'toiture', subcategory: 'travail', description: 'nettoyage toiture', unit: 'm2', labor_price: 15, material_price: 3, equipment_price: 0, total_price: 18 },
  { code: 'TOI04', category: 'toiture', subcategory: 'travail', description: 'traitement anti mousse', unit: 'm2', labor_price: 12, material_price: 3, equipment_price: 0, total_price: 15 },
  { code: 'TOI05', category: 'toiture', subcategory: 'travail', description: 'pose gouttière', unit: 'ml', labor_price: 20, material_price: 15, equipment_price: 0, total_price: 35 },
  { code: 'TOI06', category: 'toiture', subcategory: 'travail', description: 'réparation fuite toiture', unit: 'forfait', labor_price: 200, material_price: 150, equipment_price: 0, total_price: 350 },

  // ═══════════════════════════════════════════════
  // PISCINE
  // ═══════════════════════════════════════════════
  { code: 'PIS01', category: 'piscine', subcategory: 'travail', description: 'réparation piscine', unit: 'm2', labor_price: 70, material_price: 50, equipment_price: 0, total_price: 120 },
  { code: 'PIS02', category: 'piscine', subcategory: 'travail', description: 'pose liner piscine', unit: 'm2', labor_price: 55, material_price: 40, equipment_price: 0, total_price: 95 },
  { code: 'PIS03', category: 'piscine', subcategory: 'travail', description: 'résine piscine', unit: 'm2', labor_price: 65, material_price: 45, equipment_price: 0, total_price: 110 },
  { code: 'PIS04', category: 'piscine', subcategory: 'travail', description: 'pose carrelage piscine', unit: 'm2', labor_price: 75, material_price: 55, equipment_price: 0, total_price: 130 },
  { code: 'PIS05', category: 'piscine', subcategory: 'travail', description: 'décapage piscine', unit: 'm2', labor_price: 30, material_price: 15, equipment_price: 0, total_price: 45 },
  { code: 'PIS06', category: 'piscine', subcategory: 'travail', description: 'sablage piscine', unit: 'm2', labor_price: 35, material_price: 10, equipment_price: 10, total_price: 55 },
  { code: 'PIS07', category: 'piscine', subcategory: 'travail', description: 'remplacement pompe piscine', unit: 'unit', labor_price: 250, material_price: 500, equipment_price: 0, total_price: 750 },
  { code: 'PIS08', category: 'piscine', subcategory: 'travail', description: 'installation filtre piscine', unit: 'unit', labor_price: 300, material_price: 600, equipment_price: 0, total_price: 900 },
  { code: 'PIS09', category: 'piscine', subcategory: 'travail', description: 'étanchéité piscine', unit: 'm2', labor_price: 45, material_price: 35, equipment_price: 0, total_price: 80 },

  // ═══════════════════════════════════════════════
  // LOCATION MATÉRIEL
  // ═══════════════════════════════════════════════
  { code: 'LOC01', category: 'location', subcategory: 'materiel', description: 'location échafaudage', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 60, total_price: 60 },
  { code: 'LOC02', category: 'location', subcategory: 'materiel', description: 'location sableuse', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 120, total_price: 120 },
  { code: 'LOC03', category: 'location', subcategory: 'materiel', description: 'location bétonnière', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 45, total_price: 45 },
  { code: 'LOC04', category: 'location', subcategory: 'materiel', description: 'location mini pelle', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 250, total_price: 250 },
  { code: 'LOC05', category: 'location', subcategory: 'materiel', description: 'location ponceuse mur', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 70, total_price: 70 },
  { code: 'LOC06', category: 'location', subcategory: 'materiel', description: 'location nettoyeur haute pression', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 50, total_price: 50 },

  // ═══════════════════════════════════════════════
  // FRAIS CHANTIER
  // ═══════════════════════════════════════════════
  { code: 'CHA01', category: 'frais_chantier', subcategory: 'service', description: 'protection chantier', unit: 'forfait', labor_price: 60, material_price: 60, equipment_price: 0, total_price: 120 },
  { code: 'CHA02', category: 'frais_chantier', subcategory: 'service', description: 'nettoyage fin chantier', unit: 'forfait', labor_price: 80, material_price: 100, equipment_price: 0, total_price: 180 },
  { code: 'CHA03', category: 'frais_chantier', subcategory: 'service', description: 'transport matériel', unit: 'forfait', labor_price: 40, material_price: 50, equipment_price: 0, total_price: 90 },
  { code: 'CHA04', category: 'frais_chantier', subcategory: 'service', description: 'installation chantier', unit: 'forfait', labor_price: 60, material_price: 60, equipment_price: 0, total_price: 120 },
];

// Build legacy pricing from catalog for backward compat
export const buildLegacyPricing = (catalog: PriceCatalogItem[]): ArtisanPricing => {
  const find = (code: string) => catalog.find(c => c.code === code);
  const pei02 = find('PEI02');
  const pei04 = find('PEI04');
  const pei06 = find('PEI06');
  const car01 = find('CAR01');

  return {
    enduit_full: car01?.total_price ?? 20,
    enduit_labor: car01?.labor_price ?? 14,
    peinture_mur_full: pei02?.total_price ?? 22,
    peinture_mur_labor: pei02?.labor_price ?? 18,
    peinture_plafond_full: pei04?.total_price ?? 22,
    peinture_plafond_labor: pei04?.labor_price ?? 18,
    fenetre_full: pei06?.total_price ?? 30,
    fenetre_labor: pei06?.labor_price ?? 20,
    nettoyage_forfait: find('CHA02')?.total_price ?? 120,
    sous_couche_full: car01?.total_price ?? 20,
    poncage_full: find('PAR04')?.total_price ?? 25,
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
