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
  { code: 'MAC01', category: 'maconnerie', subcategory: 'travail', description: 'dalle béton', unit: 'm2', labor_price: 50, material_price: 45, equipment_price: 0, total_price: 95 },
  { code: 'MAC02', category: 'maconnerie', subcategory: 'travail', description: 'chape béton', unit: 'm2', labor_price: 25, material_price: 20, equipment_price: 0, total_price: 45 },
  { code: 'MAC03', category: 'maconnerie', subcategory: 'travail', description: 'chape liquide', unit: 'm2', labor_price: 30, material_price: 25, equipment_price: 0, total_price: 55 },
  { code: 'MAC04', category: 'maconnerie', subcategory: 'travail', description: 'mur parpaing', unit: 'm2', labor_price: 40, material_price: 20, equipment_price: 0, total_price: 60 },
  { code: 'MAC05', category: 'maconnerie', subcategory: 'travail', description: 'fondation béton', unit: 'm3', labor_price: 70, material_price: 90, equipment_price: 0, total_price: 160 },
  { code: 'MAC06', category: 'maconnerie', subcategory: 'travail', description: 'terrasse béton', unit: 'm2', labor_price: 55, material_price: 55, equipment_price: 0, total_price: 110 },
  { code: 'MAC07', category: 'maconnerie', subcategory: 'travail', description: 'escalier béton', unit: 'unit', labor_price: 900, material_price: 600, equipment_price: 0, total_price: 1500 },
  { code: 'MAC08', category: 'maconnerie', subcategory: 'travail', description: 'ouverture mur porteur', unit: 'unit', labor_price: 700, material_price: 500, equipment_price: 0, total_price: 1200 },
  { code: 'MAC09', category: 'maconnerie', subcategory: 'travail', description: 'démolition mur', unit: 'm2', labor_price: 30, material_price: 10, equipment_price: 0, total_price: 40 },
  { code: 'MAC10', category: 'maconnerie', subcategory: 'travail', description: 'enduit façade', unit: 'm2', labor_price: 20, material_price: 12, equipment_price: 0, total_price: 32 },
  { code: 'MAT001', category: 'maconnerie', subcategory: 'matériau', description: 'ciment 25kg', unit: 'unit', labor_price: 0, material_price: 8, equipment_price: 0, total_price: 8 },
  { code: 'MAT002', category: 'maconnerie', subcategory: 'matériau', description: 'sable', unit: 'm3', labor_price: 0, material_price: 55, equipment_price: 0, total_price: 55 },
  { code: 'MAT003', category: 'maconnerie', subcategory: 'matériau', description: 'gravier', unit: 'm3', labor_price: 0, material_price: 65, equipment_price: 0, total_price: 65 },
  { code: 'MAT004', category: 'maconnerie', subcategory: 'matériau', description: 'béton prêt', unit: 'm3', labor_price: 0, material_price: 130, equipment_price: 0, total_price: 130 },
  { code: 'MAT005', category: 'maconnerie', subcategory: 'matériau', description: 'parpaing', unit: 'unit', labor_price: 0, material_price: 2.5, equipment_price: 0, total_price: 2.5 },

  // ═══════════════════════════════════════════════
  // PEINTURE
  // ═══════════════════════════════════════════════
  { code: 'PEI01', category: 'peinture', subcategory: 'travail', description: 'préparation murs', unit: 'm2', labor_price: 22, material_price: 6, equipment_price: 0, total_price: 28 },
  { code: 'PEI02', category: 'peinture', subcategory: 'travail', description: 'peinture murs', unit: 'm2', labor_price: 18, material_price: 4, equipment_price: 0, total_price: 22 },
  { code: 'PEI03', category: 'peinture', subcategory: 'travail', description: 'préparation plafond', unit: 'm2', labor_price: 22, material_price: 6, equipment_price: 0, total_price: 28 },
  { code: 'PEI04', category: 'peinture', subcategory: 'travail', description: 'peinture plafond', unit: 'm2', labor_price: 18, material_price: 4, equipment_price: 0, total_price: 22 },
  { code: 'PEI05', category: 'peinture', subcategory: 'travail', description: 'peinture façade', unit: 'm2', labor_price: 24, material_price: 11, equipment_price: 0, total_price: 35 },
  { code: 'PEI06', category: 'peinture', subcategory: 'travail', description: 'peinture boiserie', unit: 'm2', labor_price: 20, material_price: 10, equipment_price: 0, total_price: 30 },
  { code: 'PEI07', category: 'peinture', subcategory: 'travail', description: 'enduit rebouchage', unit: 'm2', labor_price: 14, material_price: 6, equipment_price: 0, total_price: 20 },
  { code: 'PEI08', category: 'peinture', subcategory: 'travail', description: 'enduit lissage', unit: 'm2', labor_price: 15, material_price: 7, equipment_price: 0, total_price: 22 },
  { code: 'PEI09', category: 'peinture', subcategory: 'travail', description: 'ponçage murs', unit: 'm2', labor_price: 8, material_price: 2, equipment_price: 0, total_price: 10 },
  { code: 'MAT010', category: 'peinture', subcategory: 'matériau', description: 'peinture blanche mate', unit: 'unit', labor_price: 0, material_price: 7, equipment_price: 0, total_price: 7 },
  { code: 'MAT011', category: 'peinture', subcategory: 'matériau', description: 'peinture façade', unit: 'unit', labor_price: 0, material_price: 10, equipment_price: 0, total_price: 10 },
  { code: 'MAT012', category: 'peinture', subcategory: 'matériau', description: 'sous-couche', unit: 'unit', labor_price: 0, material_price: 6, equipment_price: 0, total_price: 6 },
  { code: 'MAT013', category: 'peinture', subcategory: 'matériau', description: 'enduit rebouchage', unit: 'unit', labor_price: 0, material_price: 15, equipment_price: 0, total_price: 15 },
  { code: 'MAT014', category: 'peinture', subcategory: 'matériau', description: 'enduit lissage', unit: 'unit', labor_price: 0, material_price: 18, equipment_price: 0, total_price: 18 },
  { code: 'MAT015', category: 'peinture', subcategory: 'matériau', description: 'ruban de masquage', unit: 'unit', labor_price: 0, material_price: 4, equipment_price: 0, total_price: 4 },
  { code: 'MAT016', category: 'peinture', subcategory: 'matériau', description: 'bâche protection', unit: 'unit', labor_price: 0, material_price: 6, equipment_price: 0, total_price: 6 },

  // ═══════════════════════════════════════════════
  // PLACO / ISOLATION
  // ═══════════════════════════════════════════════
  { code: 'PLA01', category: 'placo', subcategory: 'travail', description: 'pose placo BA13', unit: 'm2', labor_price: 30, material_price: 15, equipment_price: 0, total_price: 45 },
  { code: 'PLA02', category: 'placo', subcategory: 'travail', description: 'bandes placo', unit: 'm2', labor_price: 10, material_price: 2, equipment_price: 0, total_price: 12 },
  { code: 'PLA03', category: 'placo', subcategory: 'travail', description: 'faux plafond placo', unit: 'm2', labor_price: 45, material_price: 20, equipment_price: 0, total_price: 65 },
  { code: 'PLA04', category: 'placo', subcategory: 'travail', description: 'isolation combles', unit: 'm2', labor_price: 18, material_price: 12, equipment_price: 0, total_price: 30 },
  { code: 'PLA05', category: 'placo', subcategory: 'travail', description: 'isolation murs intérieur', unit: 'm2', labor_price: 22, material_price: 16, equipment_price: 0, total_price: 38 },
  { code: 'PLA06', category: 'placo', subcategory: 'travail', description: 'isolation toiture', unit: 'm2', labor_price: 25, material_price: 20, equipment_price: 0, total_price: 45 },
  { code: 'PLA07', category: 'placo', subcategory: 'travail', description: 'isolation plancher', unit: 'm2', labor_price: 18, material_price: 17, equipment_price: 0, total_price: 35 },
  { code: 'MAT017', category: 'placo', subcategory: 'matériau', description: 'plaque BA13', unit: 'unit', labor_price: 0, material_price: 12, equipment_price: 0, total_price: 12 },
  { code: 'MAT018', category: 'placo', subcategory: 'matériau', description: 'rail placo', unit: 'ml', labor_price: 0, material_price: 3, equipment_price: 0, total_price: 3 },
  { code: 'MAT019', category: 'placo', subcategory: 'matériau', description: 'bande placo', unit: 'unit', labor_price: 0, material_price: 8, equipment_price: 0, total_price: 8 },
  { code: 'MAT020', category: 'placo', subcategory: 'matériau', description: 'laine de verre', unit: 'm2', labor_price: 0, material_price: 6, equipment_price: 0, total_price: 6 },
  { code: 'MAT021', category: 'placo', subcategory: 'matériau', description: 'laine de roche', unit: 'm2', labor_price: 0, material_price: 8, equipment_price: 0, total_price: 8 },

  // ═══════════════════════════════════════════════
  // CARRELAGE / SOL
  // ═══════════════════════════════════════════════
  { code: 'CAR01', category: 'carrelage', subcategory: 'travail', description: 'ragréage sol', unit: 'm2', labor_price: 14, material_price: 6, equipment_price: 0, total_price: 20 },
  { code: 'CAR02', category: 'carrelage', subcategory: 'travail', description: 'pose carrelage sol', unit: 'm2', labor_price: 45, material_price: 30, equipment_price: 0, total_price: 75 },
  { code: 'CAR03', category: 'carrelage', subcategory: 'travail', description: 'pose faïence murale', unit: 'm2', labor_price: 42, material_price: 28, equipment_price: 0, total_price: 70 },
  { code: 'CAR04', category: 'carrelage', subcategory: 'travail', description: 'dépose carrelage', unit: 'm2', labor_price: 25, material_price: 5, equipment_price: 0, total_price: 30 },
  { code: 'CAR05', category: 'carrelage', subcategory: 'travail', description: 'pose carrelage terrasse', unit: 'm2', labor_price: 50, material_price: 35, equipment_price: 0, total_price: 85 },
  { code: 'MAT022', category: 'carrelage', subcategory: 'matériau', description: 'carrelage sol', unit: 'm2', labor_price: 0, material_price: 25, equipment_price: 0, total_price: 25 },
  { code: 'MAT023', category: 'carrelage', subcategory: 'matériau', description: 'faïence murale', unit: 'm2', labor_price: 0, material_price: 22, equipment_price: 0, total_price: 22 },
  { code: 'MAT024', category: 'carrelage', subcategory: 'matériau', description: 'colle carrelage', unit: 'unit', labor_price: 0, material_price: 18, equipment_price: 0, total_price: 18 },
  { code: 'MAT025', category: 'carrelage', subcategory: 'matériau', description: 'joint carrelage', unit: 'unit', labor_price: 0, material_price: 12, equipment_price: 0, total_price: 12 },
  { code: 'MAT026', category: 'carrelage', subcategory: 'matériau', description: 'primaire accrochage', unit: 'unit', labor_price: 0, material_price: 9, equipment_price: 0, total_price: 9 },

  // ═══════════════════════════════════════════════
  // PARQUET / REVÊTEMENT
  // ═══════════════════════════════════════════════
  { code: 'PAR01', category: 'parquet', subcategory: 'travail', description: 'pose parquet flottant', unit: 'm2', labor_price: 20, material_price: 25, equipment_price: 0, total_price: 45 },
  { code: 'PAR02', category: 'parquet', subcategory: 'travail', description: 'pose parquet collé', unit: 'm2', labor_price: 30, material_price: 35, equipment_price: 0, total_price: 65 },
  { code: 'PAR03', category: 'parquet', subcategory: 'travail', description: 'pose plinthes', unit: 'ml', labor_price: 7, material_price: 3, equipment_price: 0, total_price: 10 },
  { code: 'PAR04', category: 'parquet', subcategory: 'travail', description: 'ponçage parquet', unit: 'm2', labor_price: 18, material_price: 7, equipment_price: 0, total_price: 25 },
  { code: 'PAR05', category: 'parquet', subcategory: 'travail', description: 'pose sol vinyle', unit: 'm2', labor_price: 20, material_price: 15, equipment_price: 0, total_price: 35 },
  { code: 'MAT027', category: 'parquet', subcategory: 'matériau', description: 'parquet flottant', unit: 'm2', labor_price: 0, material_price: 28, equipment_price: 0, total_price: 28 },
  { code: 'MAT028', category: 'parquet', subcategory: 'matériau', description: 'parquet massif', unit: 'm2', labor_price: 0, material_price: 55, equipment_price: 0, total_price: 55 },
  { code: 'MAT029', category: 'parquet', subcategory: 'matériau', description: 'sous-couche parquet', unit: 'm2', labor_price: 0, material_price: 4, equipment_price: 0, total_price: 4 },
  { code: 'MAT030', category: 'parquet', subcategory: 'matériau', description: 'plinthe', unit: 'ml', labor_price: 0, material_price: 3, equipment_price: 0, total_price: 3 },

  // ═══════════════════════════════════════════════
  // ÉLECTRICITÉ
  // ═══════════════════════════════════════════════
  { code: 'ELE01', category: 'electricite', subcategory: 'travail', description: 'prise électrique', unit: 'unit', labor_price: 74, material_price: 6, equipment_price: 0, total_price: 80 },
  { code: 'ELE02', category: 'electricite', subcategory: 'travail', description: 'interrupteur', unit: 'unit', labor_price: 55, material_price: 5, equipment_price: 0, total_price: 60 },
  { code: 'ELE03', category: 'electricite', subcategory: 'travail', description: 'tableau électrique', unit: 'unit', labor_price: 750, material_price: 150, equipment_price: 0, total_price: 900 },
  { code: 'ELE04', category: 'electricite', subcategory: 'travail', description: 'point lumineux plafond', unit: 'unit', labor_price: 100, material_price: 20, equipment_price: 0, total_price: 120 },
  { code: 'ELE05', category: 'electricite', subcategory: 'travail', description: 'spot LED encastré', unit: 'unit', labor_price: 78, material_price: 12, equipment_price: 0, total_price: 90 },
  { code: 'ELE06', category: 'electricite', subcategory: 'travail', description: 'tirage câble électrique', unit: 'ml', labor_price: 7, material_price: 2, equipment_price: 0, total_price: 9 },
  { code: 'MAT031', category: 'electricite', subcategory: 'matériau', description: 'câble électrique', unit: 'ml', labor_price: 0, material_price: 2, equipment_price: 0, total_price: 2 },
  { code: 'MAT032', category: 'electricite', subcategory: 'matériau', description: 'prise électrique', unit: 'unit', labor_price: 0, material_price: 6, equipment_price: 0, total_price: 6 },
  { code: 'MAT033', category: 'electricite', subcategory: 'matériau', description: 'interrupteur', unit: 'unit', labor_price: 0, material_price: 5, equipment_price: 0, total_price: 5 },
  { code: 'MAT034', category: 'electricite', subcategory: 'matériau', description: 'disjoncteur', unit: 'unit', labor_price: 0, material_price: 25, equipment_price: 0, total_price: 25 },
  { code: 'MAT035', category: 'electricite', subcategory: 'matériau', description: 'tableau électrique', unit: 'unit', labor_price: 0, material_price: 150, equipment_price: 0, total_price: 150 },
  { code: 'MAT036', category: 'electricite', subcategory: 'matériau', description: 'spot LED', unit: 'unit', labor_price: 0, material_price: 12, equipment_price: 0, total_price: 12 },

  // ═══════════════════════════════════════════════
  // PLOMBERIE
  // ═══════════════════════════════════════════════
  { code: 'PLM01', category: 'plomberie', subcategory: 'travail', description: 'installation WC', unit: 'unit', labor_price: 130, material_price: 120, equipment_price: 0, total_price: 250 },
  { code: 'PLM02', category: 'plomberie', subcategory: 'travail', description: 'installation lavabo', unit: 'unit', labor_price: 110, material_price: 90, equipment_price: 0, total_price: 200 },
  { code: 'PLM03', category: 'plomberie', subcategory: 'travail', description: 'installation meuble vasque', unit: 'unit', labor_price: 90, material_price: 90, equipment_price: 0, total_price: 180 },
  { code: 'PLM04', category: 'plomberie', subcategory: 'travail', description: 'installation douche', unit: 'unit', labor_price: 250, material_price: 350, equipment_price: 0, total_price: 600 },
  { code: 'PLM05', category: 'plomberie', subcategory: 'travail', description: 'réparation fuite', unit: 'unit', labor_price: 110, material_price: 10, equipment_price: 0, total_price: 120 },
  { code: 'PLM06', category: 'plomberie', subcategory: 'travail', description: 'installation chauffe-eau', unit: 'unit', labor_price: 220, material_price: 430, equipment_price: 0, total_price: 650 },
  { code: 'MAT037', category: 'plomberie', subcategory: 'matériau', description: 'tuyau PVC', unit: 'ml', labor_price: 0, material_price: 4, equipment_price: 0, total_price: 4 },
  { code: 'MAT038', category: 'plomberie', subcategory: 'matériau', description: 'tuyau cuivre', unit: 'ml', labor_price: 0, material_price: 9, equipment_price: 0, total_price: 9 },
  { code: 'MAT039', category: 'plomberie', subcategory: 'matériau', description: 'robinet', unit: 'unit', labor_price: 0, material_price: 45, equipment_price: 0, total_price: 45 },
  { code: 'MAT040', category: 'plomberie', subcategory: 'matériau', description: 'WC', unit: 'unit', labor_price: 0, material_price: 120, equipment_price: 0, total_price: 120 },
  { code: 'MAT041', category: 'plomberie', subcategory: 'matériau', description: 'meuble vasque', unit: 'unit', labor_price: 0, material_price: 180, equipment_price: 0, total_price: 180 },
  { code: 'MAT042', category: 'plomberie', subcategory: 'matériau', description: 'receveur douche', unit: 'unit', labor_price: 0, material_price: 160, equipment_price: 0, total_price: 160 },
  { code: 'MAT043', category: 'plomberie', subcategory: 'matériau', description: 'chauffe-eau', unit: 'unit', labor_price: 0, material_price: 320, equipment_price: 0, total_price: 320 },

  // ═══════════════════════════════════════════════
  // MENUISERIE
  // ═══════════════════════════════════════════════
  { code: 'MEN01', category: 'menuiserie', subcategory: 'travail', description: 'pose porte intérieure', unit: 'unit', labor_price: 180, material_price: 120, equipment_price: 0, total_price: 300 },
  { code: 'MEN02', category: 'menuiserie', subcategory: 'travail', description: 'pose fenêtre PVC', unit: 'unit', labor_price: 250, material_price: 300, equipment_price: 0, total_price: 550 },
  { code: 'MEN03', category: 'menuiserie', subcategory: 'travail', description: 'placard sur mesure', unit: 'unit', labor_price: 250, material_price: 350, equipment_price: 0, total_price: 600 },
  { code: 'MEN04', category: 'menuiserie', subcategory: 'travail', description: 'pose escalier bois', unit: 'unit', labor_price: 900, material_price: 600, equipment_price: 0, total_price: 1500 },
  { code: 'MEN05', category: 'menuiserie', subcategory: 'travail', description: "porte d'entrée", unit: 'unit', labor_price: 250, material_price: 600, equipment_price: 0, total_price: 850 },
  { code: 'MEN06', category: 'menuiserie', subcategory: 'travail', description: 'baie vitrée', unit: 'unit', labor_price: 400, material_price: 800, equipment_price: 0, total_price: 1200 },
  { code: 'MEN07', category: 'menuiserie', subcategory: 'travail', description: 'volet roulant', unit: 'unit', labor_price: 90, material_price: 230, equipment_price: 0, total_price: 320 },
  { code: 'MAT044', category: 'menuiserie', subcategory: 'matériau', description: 'porte intérieure', unit: 'unit', labor_price: 0, material_price: 120, equipment_price: 0, total_price: 120 },
  { code: 'MAT045', category: 'menuiserie', subcategory: 'matériau', description: 'fenêtre PVC', unit: 'unit', labor_price: 0, material_price: 300, equipment_price: 0, total_price: 300 },
  { code: 'MAT046', category: 'menuiserie', subcategory: 'matériau', description: 'baie vitrée', unit: 'unit', labor_price: 0, material_price: 600, equipment_price: 0, total_price: 600 },
  { code: 'MAT047', category: 'menuiserie', subcategory: 'matériau', description: 'volet roulant', unit: 'unit', labor_price: 0, material_price: 180, equipment_price: 0, total_price: 180 },

  // ═══════════════════════════════════════════════
  // TOITURE
  // ═══════════════════════════════════════════════
  { code: 'TOI01', category: 'toiture', subcategory: 'travail', description: 'pose tuiles', unit: 'm2', labor_price: 55, material_price: 35, equipment_price: 0, total_price: 90 },
  { code: 'TOI02', category: 'toiture', subcategory: 'travail', description: 'réparation toiture', unit: 'm2', labor_price: 45, material_price: 25, equipment_price: 0, total_price: 70 },
  { code: 'TOI03', category: 'toiture', subcategory: 'travail', description: 'nettoyage toiture', unit: 'm2', labor_price: 15, material_price: 3, equipment_price: 0, total_price: 18 },
  { code: 'TOI04', category: 'toiture', subcategory: 'travail', description: 'démoussage toiture', unit: 'm2', labor_price: 16, material_price: 4, equipment_price: 0, total_price: 20 },
  { code: 'TOI05', category: 'toiture', subcategory: 'travail', description: 'pose gouttière', unit: 'ml', labor_price: 27, material_price: 18, equipment_price: 0, total_price: 45 },
  { code: 'MAT048', category: 'toiture', subcategory: 'matériau', description: 'tuiles', unit: 'unit', labor_price: 0, material_price: 1.8, equipment_price: 0, total_price: 1.8 },
  { code: 'MAT049', category: 'toiture', subcategory: 'matériau', description: 'écran sous toiture', unit: 'm2', labor_price: 0, material_price: 6, equipment_price: 0, total_price: 6 },
  { code: 'MAT050', category: 'toiture', subcategory: 'matériau', description: 'gouttière aluminium', unit: 'ml', labor_price: 0, material_price: 18, equipment_price: 0, total_price: 18 },

  // ═══════════════════════════════════════════════
  // ÉTANCHÉITÉ
  // ═══════════════════════════════════════════════
  { code: 'ETA01', category: 'etancheite', subcategory: 'travail', description: 'étanchéité toiture terrasse', unit: 'm2', labor_price: 38, material_price: 37, equipment_price: 0, total_price: 75 },
  { code: 'ETA02', category: 'etancheite', subcategory: 'travail', description: 'étanchéité balcon', unit: 'm2', labor_price: 32, material_price: 33, equipment_price: 0, total_price: 65 },
  { code: 'ETA03', category: 'etancheite', subcategory: 'travail', description: 'étanchéité salle de bain', unit: 'm2', labor_price: 20, material_price: 25, equipment_price: 0, total_price: 45 },

  // ═══════════════════════════════════════════════
  // EXTÉRIEUR
  // ═══════════════════════════════════════════════
  { code: 'EXT01', category: 'exterieur', subcategory: 'travail', description: 'clôture grillage', unit: 'ml', labor_price: 18, material_price: 22, equipment_price: 0, total_price: 40 },
  { code: 'EXT02', category: 'exterieur', subcategory: 'travail', description: 'clôture panneau rigide', unit: 'ml', labor_price: 35, material_price: 40, equipment_price: 0, total_price: 75 },
  { code: 'EXT03', category: 'exterieur', subcategory: 'travail', description: 'terrasse bois', unit: 'm2', labor_price: 65, material_price: 55, equipment_price: 0, total_price: 120 },
  { code: 'EXT04', category: 'exterieur', subcategory: 'travail', description: 'dalle terrasse', unit: 'm2', labor_price: 50, material_price: 45, equipment_price: 0, total_price: 95 },

  // ═══════════════════════════════════════════════
  // CHAUFFAGE / CLIM
  // ═══════════════════════════════════════════════
  { code: 'CH01', category: 'chauffage', subcategory: 'travail', description: 'radiateur eau', unit: 'unit', labor_price: 120, material_price: 130, equipment_price: 0, total_price: 250 },
  { code: 'CH02', category: 'chauffage', subcategory: 'travail', description: 'chauffe eau', unit: 'unit', labor_price: 250, material_price: 400, equipment_price: 0, total_price: 650 },
  { code: 'CH03', category: 'chauffage', subcategory: 'travail', description: 'pompe à chaleur', unit: 'unit', labor_price: 2200, material_price: 4300, equipment_price: 0, total_price: 6500 },
  { code: 'CH04', category: 'chauffage', subcategory: 'travail', description: 'climatisation split', unit: 'unit', labor_price: 700, material_price: 500, equipment_price: 0, total_price: 1200 },

  // ═══════════════════════════════════════════════
  // VENTILATION
  // ═══════════════════════════════════════════════
  { code: 'VEN01', category: 'ventilation', subcategory: 'travail', description: 'VMC simple flux', unit: 'unit', labor_price: 250, material_price: 200, equipment_price: 0, total_price: 450 },
  { code: 'VEN02', category: 'ventilation', subcategory: 'travail', description: 'VMC double flux', unit: 'unit', labor_price: 950, material_price: 850, equipment_price: 0, total_price: 1800 },

  // ═══════════════════════════════════════════════
  // PISCINE
  // ═══════════════════════════════════════════════
  { code: 'PIS01', category: 'piscine', subcategory: 'travail', description: 'vidange piscine', unit: 'unit', labor_price: 20, material_price: 180, equipment_price: 0, total_price: 200 },
  { code: 'PIS02', category: 'piscine', subcategory: 'travail', description: 'nettoyage bassin', unit: 'm2', labor_price: 3, material_price: 7, equipment_price: 0, total_price: 10 },
  { code: 'PIS03', category: 'piscine', subcategory: 'travail', description: 'sablage piscine', unit: 'm2', labor_price: 20, material_price: 15, equipment_price: 10, total_price: 45 },
  { code: 'PIS04', category: 'piscine', subcategory: 'travail', description: 'résine polyester piscine', unit: 'm2', labor_price: 95, material_price: 35, equipment_price: 10, total_price: 140 },
  { code: 'PIS05', category: 'piscine', subcategory: 'travail', description: 'gelcoat piscine', unit: 'm2', labor_price: 20, material_price: 10, equipment_price: 5, total_price: 35 },
  { code: 'PIS06', category: 'piscine', subcategory: 'travail', description: 'pose liner piscine', unit: 'm2', labor_price: 60, material_price: 30, equipment_price: 0, total_price: 90 },
  { code: 'PIS07', category: 'piscine', subcategory: 'travail', description: 'membrane armée piscine', unit: 'm2', labor_price: 80, material_price: 40, equipment_price: 0, total_price: 120 },
  { code: 'PIS08', category: 'piscine', subcategory: 'travail', description: 'réparation fissure piscine', unit: 'unit', labor_price: 35, material_price: 85, equipment_price: 0, total_price: 120 },
  { code: 'PIS09', category: 'piscine', subcategory: 'travail', description: 'pompe piscine', unit: 'unit', labor_price: 220, material_price: 380, equipment_price: 0, total_price: 600 },
  { code: 'PIS10', category: 'piscine', subcategory: 'travail', description: 'filtration piscine', unit: 'unit', labor_price: 300, material_price: 400, equipment_price: 0, total_price: 700 },
  { code: 'PIS11', category: 'piscine', subcategory: 'travail', description: 'pose margelles', unit: 'ml', labor_price: 30, material_price: 40, equipment_price: 0, total_price: 70 },
  { code: 'PIS12', category: 'piscine', subcategory: 'travail', description: 'carrelage piscine', unit: 'm2', labor_price: 35, material_price: 50, equipment_price: 0, total_price: 85 },
  { code: 'PIS13', category: 'piscine', subcategory: 'travail', description: 'skimmer piscine', unit: 'unit', labor_price: 70, material_price: 110, equipment_price: 0, total_price: 180 },
  { code: 'PIS14', category: 'piscine', subcategory: 'travail', description: 'bonde fond piscine', unit: 'unit', labor_price: 60, material_price: 100, equipment_price: 0, total_price: 160 },
  { code: 'PIS15', category: 'piscine', subcategory: 'travail', description: 'projecteur piscine', unit: 'unit', labor_price: 120, material_price: 100, equipment_price: 0, total_price: 220 },
  { code: 'MAT051', category: 'piscine', subcategory: 'matériau', description: 'liner piscine', unit: 'm2', labor_price: 0, material_price: 45, equipment_price: 0, total_price: 45 },
  { code: 'MAT052', category: 'piscine', subcategory: 'matériau', description: 'résine polyester', unit: 'unit', labor_price: 0, material_price: 12, equipment_price: 0, total_price: 12 },
  { code: 'MAT053', category: 'piscine', subcategory: 'matériau', description: 'gelcoat', unit: 'unit', labor_price: 0, material_price: 14, equipment_price: 0, total_price: 14 },
  { code: 'MAT054', category: 'piscine', subcategory: 'matériau', description: 'pompe piscine', unit: 'unit', labor_price: 0, material_price: 380, equipment_price: 0, total_price: 380 },
  { code: 'MAT055', category: 'piscine', subcategory: 'matériau', description: 'filtre piscine', unit: 'unit', labor_price: 0, material_price: 420, equipment_price: 0, total_price: 420 },
  { code: 'MAT056', category: 'piscine', subcategory: 'matériau', description: 'skimmer', unit: 'unit', labor_price: 0, material_price: 70, equipment_price: 0, total_price: 70 },
  { code: 'MAT057', category: 'piscine', subcategory: 'matériau', description: 'margelle piscine', unit: 'ml', labor_price: 0, material_price: 30, equipment_price: 0, total_price: 30 },

  // ═══════════════════════════════════════════════
  // LOCATION MATÉRIEL
  // ═══════════════════════════════════════════════
  { code: 'LOC01', category: 'location', subcategory: 'materiel', description: 'location échafaudage', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 45, total_price: 45 },
  { code: 'LOC02', category: 'location', subcategory: 'materiel', description: 'location sableuse', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 90, total_price: 90 },
  { code: 'LOC03', category: 'location', subcategory: 'materiel', description: 'location bétonnière', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 40, total_price: 40 },
  { code: 'LOC04', category: 'location', subcategory: 'materiel', description: 'location mini pelle', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 250, total_price: 250 },
  { code: 'LOC05', category: 'location', subcategory: 'materiel', description: 'location benne gravats', unit: 'day', labor_price: 0, material_price: 0, equipment_price: 180, total_price: 180 },

  // ═══════════════════════════════════════════════
  // FRAIS CHANTIER
  // ═══════════════════════════════════════════════
  { code: 'CHA01', category: 'frais_chantier', subcategory: 'service', description: 'protection chantier', unit: 'forfait', labor_price: 40, material_price: 40, equipment_price: 0, total_price: 80 },
  { code: 'CHA02', category: 'frais_chantier', subcategory: 'service', description: 'nettoyage fin chantier', unit: 'forfait', labor_price: 20, material_price: 100, equipment_price: 0, total_price: 120 },
  { code: 'CHA03', category: 'frais_chantier', subcategory: 'service', description: 'transport matériaux', unit: 'forfait', labor_price: 40, material_price: 60, equipment_price: 0, total_price: 100 },
  { code: 'CHA04', category: 'frais_chantier', subcategory: 'service', description: 'évacuation gravats', unit: 'forfait', labor_price: 50, material_price: 100, equipment_price: 0, total_price: 150 },
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
