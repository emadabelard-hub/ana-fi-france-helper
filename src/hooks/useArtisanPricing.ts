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
  // ═══ MAÇONNERIE ═══
  { code: 'MAC01', category: 'maconnerie', subcategory: 'beton', description: 'dalle béton', unit: 'm2', material_price: 50, labor_price: 45, equipment_price: 0, total_price: 95 },
  { code: 'MAC02', category: 'maconnerie', subcategory: 'chape', description: 'chape béton', unit: 'm2', material_price: 20, labor_price: 25, equipment_price: 0, total_price: 45 },
  { code: 'MAC03', category: 'maconnerie', subcategory: 'mur', description: 'mur parpaing', unit: 'm2', material_price: 20, labor_price: 40, equipment_price: 0, total_price: 60 },
  { code: 'MAC04', category: 'maconnerie', subcategory: 'beton', description: 'fondation béton', unit: 'm3', material_price: 70, labor_price: 90, equipment_price: 0, total_price: 160 },
  { code: 'MAC05', category: 'maconnerie', subcategory: 'beton', description: 'terrasse béton', unit: 'm2', material_price: 55, labor_price: 55, equipment_price: 0, total_price: 110 },
  { code: 'MAC06', category: 'maconnerie', subcategory: 'structure', description: 'escalier béton', unit: 'unit', material_price: 700, labor_price: 800, equipment_price: 0, total_price: 1500 },
  { code: 'MAC07', category: 'maconnerie', subcategory: 'structure', description: 'ouverture mur porteur', unit: 'unit', material_price: 500, labor_price: 700, equipment_price: 0, total_price: 1200 },
  { code: 'MAC08', category: 'maconnerie', subcategory: 'demolition', description: 'démolition mur', unit: 'm2', material_price: 5, labor_price: 35, equipment_price: 0, total_price: 40 },
  { code: 'MAC09', category: 'maconnerie', subcategory: 'chape', description: 'chape liquide', unit: 'm2', material_price: 25, labor_price: 30, equipment_price: 0, total_price: 55 },

  // ═══ PEINTURE ═══
  { code: 'PEI01', category: 'peinture', subcategory: 'preparation', description: 'préparation murs', unit: 'm2', material_price: 8, labor_price: 20, equipment_price: 0, total_price: 28 },
  { code: 'PEI02', category: 'peinture', subcategory: 'mur', description: 'peinture murs', unit: 'm2', material_price: 4, labor_price: 18, equipment_price: 0, total_price: 22 },
  { code: 'PEI03', category: 'peinture', subcategory: 'preparation', description: 'préparation plafond', unit: 'm2', material_price: 8, labor_price: 20, equipment_price: 0, total_price: 28 },
  { code: 'PEI04', category: 'peinture', subcategory: 'plafond', description: 'peinture plafond', unit: 'm2', material_price: 4, labor_price: 18, equipment_price: 0, total_price: 22 },
  { code: 'PEI05', category: 'peinture', subcategory: 'facade', description: 'peinture façade', unit: 'm2', material_price: 10, labor_price: 25, equipment_price: 0, total_price: 35 },
  { code: 'PEI06', category: 'peinture', subcategory: 'boiserie', description: 'peinture boiserie', unit: 'm2', material_price: 8, labor_price: 22, equipment_price: 0, total_price: 30 },

  // ═══ PLACO / ISOLATION ═══
  { code: 'PLA01', category: 'placo', subcategory: 'cloison', description: 'pose placo BA13', unit: 'm2', material_price: 12, labor_price: 33, equipment_price: 0, total_price: 45 },
  { code: 'PLA02', category: 'placo', subcategory: 'finitions', description: 'bandes placo', unit: 'm2', material_price: 2, labor_price: 10, equipment_price: 0, total_price: 12 },
  { code: 'PLA03', category: 'placo', subcategory: 'plafond', description: 'faux plafond placo', unit: 'm2', material_price: 18, labor_price: 47, equipment_price: 0, total_price: 65 },
  { code: 'ISO01', category: 'isolation', subcategory: 'combles', description: 'isolation combles', unit: 'm2', material_price: 10, labor_price: 20, equipment_price: 0, total_price: 30 },
  { code: 'ISO02', category: 'isolation', subcategory: 'murs', description: 'isolation murs intérieur', unit: 'm2', material_price: 15, labor_price: 23, equipment_price: 0, total_price: 38 },
  { code: 'ISO03', category: 'isolation', subcategory: 'toiture', description: 'isolation toiture', unit: 'm2', material_price: 20, labor_price: 25, equipment_price: 0, total_price: 45 },
  { code: 'ISO04', category: 'isolation', subcategory: 'plancher', description: 'isolation plancher', unit: 'm2', material_price: 15, labor_price: 20, equipment_price: 0, total_price: 35 },

  // ═══ CARRELAGE ═══
  { code: 'CAR01', category: 'carrelage', subcategory: 'preparation', description: 'ragréage sol', unit: 'm2', material_price: 6, labor_price: 14, equipment_price: 0, total_price: 20 },
  { code: 'CAR02', category: 'carrelage', subcategory: 'sol', description: 'pose carrelage sol', unit: 'm2', material_price: 30, labor_price: 45, equipment_price: 0, total_price: 75 },
  { code: 'CAR03', category: 'carrelage', subcategory: 'mur', description: 'pose faïence murale', unit: 'm2', material_price: 28, labor_price: 42, equipment_price: 0, total_price: 70 },
  { code: 'CAR04', category: 'carrelage', subcategory: 'demolition', description: 'dépose carrelage', unit: 'm2', material_price: 2, labor_price: 28, equipment_price: 0, total_price: 30 },

  // ═══ PARQUET ═══
  { code: 'PAR01', category: 'parquet', subcategory: 'sol', description: 'pose parquet flottant', unit: 'm2', material_price: 25, labor_price: 20, equipment_price: 0, total_price: 45 },
  { code: 'PAR02', category: 'parquet', subcategory: 'sol', description: 'pose parquet collé', unit: 'm2', material_price: 35, labor_price: 30, equipment_price: 0, total_price: 65 },
  { code: 'PAR03', category: 'parquet', subcategory: 'finitions', description: 'pose plinthes', unit: 'ml', material_price: 3, labor_price: 7, equipment_price: 0, total_price: 10 },
  { code: 'PAR04', category: 'parquet', subcategory: 'poncage', description: 'ponçage parquet', unit: 'm2', material_price: 5, labor_price: 20, equipment_price: 0, total_price: 25 },

  // ═══ ÉLECTRICITÉ ═══
  { code: 'ELE01', category: 'electricite', subcategory: 'prise', description: 'prise électrique', unit: 'unit', material_price: 15, labor_price: 65, equipment_price: 0, total_price: 80 },
  { code: 'ELE02', category: 'electricite', subcategory: 'interrupteur', description: 'interrupteur', unit: 'unit', material_price: 12, labor_price: 48, equipment_price: 0, total_price: 60 },
  { code: 'ELE03', category: 'electricite', subcategory: 'tableau', description: 'tableau électrique', unit: 'unit', material_price: 500, labor_price: 400, equipment_price: 0, total_price: 900 },
  { code: 'ELE04', category: 'electricite', subcategory: 'eclairage', description: 'point lumineux plafond', unit: 'unit', material_price: 40, labor_price: 80, equipment_price: 0, total_price: 120 },
  { code: 'ELE05', category: 'electricite', subcategory: 'eclairage', description: 'spot LED encastré', unit: 'unit', material_price: 30, labor_price: 60, equipment_price: 0, total_price: 90 },

  // ═══ PLOMBERIE ═══
  { code: 'PLM01', category: 'plomberie', subcategory: 'sanitaire', description: 'installation WC', unit: 'unit', material_price: 120, labor_price: 130, equipment_price: 0, total_price: 250 },
  { code: 'PLM02', category: 'plomberie', subcategory: 'sanitaire', description: 'installation lavabo', unit: 'unit', material_price: 90, labor_price: 110, equipment_price: 0, total_price: 200 },
  { code: 'PLM03', category: 'plomberie', subcategory: 'sanitaire', description: 'installation meuble vasque', unit: 'unit', material_price: 80, labor_price: 100, equipment_price: 0, total_price: 180 },
  { code: 'PLM04', category: 'plomberie', subcategory: 'douche', description: 'installation douche', unit: 'unit', material_price: 350, labor_price: 250, equipment_price: 0, total_price: 600 },
  { code: 'PLM05', category: 'plomberie', subcategory: 'reparation', description: 'réparation fuite', unit: 'unit', material_price: 10, labor_price: 110, equipment_price: 0, total_price: 120 },

  // ═══ MENUISERIE ═══
  { code: 'MEN01', category: 'menuiserie', subcategory: 'porte', description: 'pose porte intérieure', unit: 'unit', material_price: 120, labor_price: 180, equipment_price: 0, total_price: 300 },
  { code: 'MEN02', category: 'menuiserie', subcategory: 'fenetre', description: 'pose fenêtre PVC', unit: 'unit', material_price: 300, labor_price: 250, equipment_price: 0, total_price: 550 },
  { code: 'MEN03', category: 'menuiserie', subcategory: 'placard', description: 'placard sur mesure', unit: 'unit', material_price: 350, labor_price: 250, equipment_price: 0, total_price: 600 },
  { code: 'MEN04', category: 'menuiserie', subcategory: 'escalier', description: 'pose escalier bois', unit: 'unit', material_price: 800, labor_price: 700, equipment_price: 0, total_price: 1500 },
  { code: 'MEN05', category: 'menuiserie', subcategory: 'porte', description: "porte d'entrée", unit: 'unit', material_price: 450, labor_price: 400, equipment_price: 0, total_price: 850 },
  { code: 'MEN06', category: 'menuiserie', subcategory: 'fenetre', description: 'baie vitrée', unit: 'unit', material_price: 700, labor_price: 500, equipment_price: 0, total_price: 1200 },
  { code: 'MEN07', category: 'menuiserie', subcategory: 'volet', description: 'volet roulant', unit: 'unit', material_price: 170, labor_price: 150, equipment_price: 0, total_price: 320 },
  { code: 'MEN08', category: 'menuiserie', subcategory: 'portail', description: 'portail aluminium', unit: 'unit', material_price: 900, labor_price: 700, equipment_price: 0, total_price: 1600 },

  // ═══ TOITURE ═══
  { code: 'TOI01', category: 'toiture', subcategory: 'couverture', description: 'pose tuiles', unit: 'm2', material_price: 40, labor_price: 50, equipment_price: 0, total_price: 90 },
  { code: 'TOI02', category: 'toiture', subcategory: 'reparation', description: 'réparation toiture', unit: 'm2', material_price: 25, labor_price: 45, equipment_price: 0, total_price: 70 },
  { code: 'TOI03', category: 'toiture', subcategory: 'nettoyage', description: 'nettoyage toiture', unit: 'm2', material_price: 3, labor_price: 15, equipment_price: 0, total_price: 18 },
  { code: 'TOI04', category: 'toiture', subcategory: 'nettoyage', description: 'démoussage toiture', unit: 'm2', material_price: 5, labor_price: 15, equipment_price: 0, total_price: 20 },
  { code: 'TOI05', category: 'toiture', subcategory: 'gouttiere', description: 'pose gouttière', unit: 'ml', material_price: 20, labor_price: 25, equipment_price: 0, total_price: 45 },

  // ═══ ÉTANCHÉITÉ ═══
  { code: 'ETA01', category: 'etancheite', subcategory: 'toiture', description: 'étanchéité toiture terrasse', unit: 'm2', material_price: 35, labor_price: 40, equipment_price: 0, total_price: 75 },
  { code: 'ETA02', category: 'etancheite', subcategory: 'balcon', description: 'étanchéité balcon', unit: 'm2', material_price: 30, labor_price: 35, equipment_price: 0, total_price: 65 },
  { code: 'ETA03', category: 'etancheite', subcategory: 'sdb', description: 'étanchéité salle de bain', unit: 'm2', material_price: 20, labor_price: 25, equipment_price: 0, total_price: 45 },

  // ═══ EXTÉRIEUR ═══
  { code: 'EXT01', category: 'exterieur', subcategory: 'cloture', description: 'clôture grillage', unit: 'ml', material_price: 15, labor_price: 25, equipment_price: 0, total_price: 40 },
  { code: 'EXT02', category: 'exterieur', subcategory: 'cloture', description: 'clôture panneau rigide', unit: 'ml', material_price: 35, labor_price: 40, equipment_price: 0, total_price: 75 },
  { code: 'EXT03', category: 'exterieur', subcategory: 'terrasse', description: 'terrasse bois', unit: 'm2', material_price: 60, labor_price: 60, equipment_price: 0, total_price: 120 },
  { code: 'EXT04', category: 'exterieur', subcategory: 'terrasse', description: 'dalle terrasse', unit: 'm2', material_price: 45, labor_price: 50, equipment_price: 0, total_price: 95 },

  // ═══ CHAUFFAGE / CLIM ═══
  { code: 'CH01', category: 'chauffage', subcategory: 'radiateur', description: 'radiateur eau', unit: 'unit', material_price: 100, labor_price: 150, equipment_price: 0, total_price: 250 },
  { code: 'CH02', category: 'chauffage', subcategory: 'chauffe_eau', description: 'chauffe eau', unit: 'unit', material_price: 350, labor_price: 300, equipment_price: 0, total_price: 650 },
  { code: 'CH03', category: 'chauffage', subcategory: 'pac', description: 'pompe à chaleur', unit: 'unit', material_price: 4000, labor_price: 2500, equipment_price: 0, total_price: 6500 },
  { code: 'CH04', category: 'chauffage', subcategory: 'clim', description: 'climatisation split', unit: 'unit', material_price: 600, labor_price: 600, equipment_price: 0, total_price: 1200 },

  // ═══ VENTILATION ═══
  { code: 'VEN01', category: 'ventilation', subcategory: 'vmc', description: 'VMC simple flux', unit: 'unit', material_price: 200, labor_price: 250, equipment_price: 0, total_price: 450 },
  { code: 'VEN02', category: 'ventilation', subcategory: 'vmc', description: 'VMC double flux', unit: 'unit', material_price: 1000, labor_price: 800, equipment_price: 0, total_price: 1800 },

  // ═══ TRAVAUX PISCINE ═══
  { code: 'PIS01', category: 'piscine', subcategory: 'entretien', description: 'vidange piscine', unit: 'unit', material_price: 50, labor_price: 150, equipment_price: 0, total_price: 200 },
  { code: 'PIS02', category: 'piscine', subcategory: 'entretien', description: 'nettoyage bassin', unit: 'm2', material_price: 2, labor_price: 8, equipment_price: 0, total_price: 10 },
  { code: 'PIS03', category: 'piscine', subcategory: 'sablage', description: 'sablage piscine', unit: 'm2', material_price: 15, labor_price: 30, equipment_price: 0, total_price: 45 },
  { code: 'PIS04', category: 'piscine', subcategory: 'revetement', description: 'résine polyester piscine', unit: 'm2', material_price: 60, labor_price: 80, equipment_price: 0, total_price: 140 },
  { code: 'PIS05', category: 'piscine', subcategory: 'revetement', description: 'gelcoat piscine', unit: 'm2', material_price: 15, labor_price: 20, equipment_price: 0, total_price: 35 },
  { code: 'PIS06', category: 'piscine', subcategory: 'revetement', description: 'pose liner piscine', unit: 'm2', material_price: 40, labor_price: 50, equipment_price: 0, total_price: 90 },
  { code: 'PIS07', category: 'piscine', subcategory: 'revetement', description: 'membrane armée piscine', unit: 'm2', material_price: 55, labor_price: 65, equipment_price: 0, total_price: 120 },
  { code: 'PIS08', category: 'piscine', subcategory: 'reparation', description: 'réparation fissure piscine', unit: 'unit', material_price: 40, labor_price: 80, equipment_price: 0, total_price: 120 },
  { code: 'PIS09', category: 'piscine', subcategory: 'equipement', description: 'pompe piscine', unit: 'unit', material_price: 350, labor_price: 250, equipment_price: 0, total_price: 600 },
  { code: 'PIS10', category: 'piscine', subcategory: 'equipement', description: 'filtration piscine', unit: 'unit', material_price: 400, labor_price: 300, equipment_price: 0, total_price: 700 },
  { code: 'PIS11', category: 'piscine', subcategory: 'margelle', description: 'pose margelles', unit: 'ml', material_price: 30, labor_price: 40, equipment_price: 0, total_price: 70 },
  { code: 'PIS12', category: 'piscine', subcategory: 'carrelage', description: 'carrelage piscine', unit: 'm2', material_price: 35, labor_price: 50, equipment_price: 0, total_price: 85 },
  { code: 'PIS13', category: 'piscine', subcategory: 'equipement', description: 'skimmer piscine', unit: 'unit', material_price: 80, labor_price: 100, equipment_price: 0, total_price: 180 },
  { code: 'PIS14', category: 'piscine', subcategory: 'equipement', description: 'bonde fond piscine', unit: 'unit', material_price: 70, labor_price: 90, equipment_price: 0, total_price: 160 },
  { code: 'PIS15', category: 'piscine', subcategory: 'equipement', description: 'projecteur piscine', unit: 'unit', material_price: 100, labor_price: 120, equipment_price: 0, total_price: 220 },

  // ═══ LOCATION MATÉRIEL ═══
  { code: 'LOC01', category: 'location', subcategory: 'materiel', description: 'location échafaudage', unit: 'day', material_price: 45, labor_price: 0, equipment_price: 0, total_price: 45 },
  { code: 'LOC02', category: 'location', subcategory: 'materiel', description: 'location sableuse', unit: 'day', material_price: 90, labor_price: 0, equipment_price: 0, total_price: 90 },
  { code: 'LOC03', category: 'location', subcategory: 'materiel', description: 'location bétonnière', unit: 'day', material_price: 40, labor_price: 0, equipment_price: 0, total_price: 40 },
  { code: 'LOC04', category: 'location', subcategory: 'materiel', description: 'location mini pelle', unit: 'day', material_price: 250, labor_price: 0, equipment_price: 0, total_price: 250 },
  { code: 'LOC05', category: 'location', subcategory: 'materiel', description: 'location benne gravats', unit: 'day', material_price: 180, labor_price: 0, equipment_price: 0, total_price: 180 },

  // ═══ FRAIS CHANTIER ═══
  { code: 'CHA01', category: 'chantier', subcategory: 'protection', description: 'protection chantier', unit: 'forfait', material_price: 40, labor_price: 40, equipment_price: 0, total_price: 80 },
  { code: 'CHA02', category: 'chantier', subcategory: 'nettoyage', description: 'nettoyage fin chantier', unit: 'forfait', material_price: 30, labor_price: 90, equipment_price: 0, total_price: 120 },
  { code: 'CHA03', category: 'chantier', subcategory: 'transport', description: 'transport matériaux', unit: 'forfait', material_price: 50, labor_price: 50, equipment_price: 0, total_price: 100 },
  { code: 'CHA04', category: 'chantier', subcategory: 'evacuation', description: 'évacuation gravats', unit: 'forfait', material_price: 50, labor_price: 100, equipment_price: 0, total_price: 150 },
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
    fenetre_labor: pei06?.labor_price ?? 22,
    nettoyage_forfait: 120,
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
