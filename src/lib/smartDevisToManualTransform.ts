/**
 * Transforms raw Smart Devis suggested items (with technical materials,
 * quantities in sacs/litres/kg) into clean professional quote lines
 * grouped by trade category, ready for injection into the manual quote form.
 *
 * Rules:
 *  - Drop raw material units (sac, sacs, litre, l, kg, ml of paint, etc.)
 *  - Merge technical items into one "Fourniture et pose ..." line per work type
 *  - Group by professional categories (Préparation, Murs, Sols, Plomberie...)
 *  - Preserve surface (m²) / unit (u) quantities when meaningful
 *  - Do NOT carry unit prices — artisan fills them manually
 */

export interface RawSuggestedItem {
  designation_fr?: string;
  designation_ar?: string;
  quantity?: number | string;
  unit?: string;
  unitPrice?: number | string;
  category?: string;
  [key: string]: any;
}

export interface CleanLine {
  designation_fr: string;
  designation_ar: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category?: string;
}

// Units considered as raw materials (to be filtered out)
const RAW_MATERIAL_UNITS = new Set([
  'sac', 'sacs', 'l', 'litre', 'litres', 'kg', 'g', 'gr',
  'pot', 'pots', 'tube', 'tubes', 'rouleau', 'rouleaux',
  'boite', 'boîte', 'boîtes', 'carton', 'cartons',
  'paquet', 'paquets', 'bidon', 'bidons',
]);

// Keywords that indicate raw material lines (filter out even if unit is m²)
const RAW_MATERIAL_KEYWORDS = [
  'colle ', 'mortier', 'ciment', 'enduit (', 'sous-couche (',
  'mousse pu', 'silicone (', 'joint (', 'sable', 'gravier',
  'plâtre', 'platre', 'peinture (', 'résine (', 'resine (',
  'croisillon', 'ruban', 'bâche', 'bache',
];

// Category mapping
type CategoryKey =
  | 'preparation'
  | 'murs'
  | 'sols'
  | 'plomberie'
  | 'electricite'
  | 'menuiserie'
  | 'finitions'
  | 'autre';

interface CategoryDef {
  key: CategoryKey;
  fr: string;
  ar: string;
  order: number;
}

const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  preparation: { key: 'preparation', fr: 'Préparation chantier',     ar: 'تحضير الورشة',         order: 1 },
  murs:        { key: 'murs',        fr: 'Revêtements murs',         ar: 'تغطية الجدران',        order: 2 },
  sols:        { key: 'sols',        fr: 'Revêtements sols',         ar: 'تغطية الأرضيات',       order: 3 },
  plomberie:   { key: 'plomberie',   fr: 'Plomberie / sanitaires',   ar: 'سباكة / صحية',         order: 4 },
  electricite: { key: 'electricite', fr: 'Électricité',              ar: 'كهرباء',               order: 5 },
  menuiserie:  { key: 'menuiserie',  fr: 'Menuiserie',               ar: 'نجارة',                order: 6 },
  finitions:   { key: 'finitions',   fr: 'Finitions',                ar: 'لمسات أخيرة',          order: 7 },
  autre:       { key: 'autre',       fr: 'Autres travaux',           ar: 'أعمال أخرى',           order: 8 },
};

interface WorkTypeRule {
  category: CategoryKey;
  match: RegExp;
  designation_fr: string;
  designation_ar: string;
  defaultUnit: string; // 'm²' | 'U' | 'ml' | 'forfait'
}

// Professional consolidated work-type rules
const WORK_TYPES: WorkTypeRule[] = [
  // ---- Préparation
  { category: 'preparation', match: /(protection|bâchage|bachage|installation\s+chantier)/i,
    designation_fr: 'Installation et protection du chantier', designation_ar: 'تجهيز وحماية الورشة', defaultUnit: 'forfait' },
  { category: 'preparation', match: /(démolition|demolition|dépose|depose|dem(o|ó)l)/i,
    designation_fr: 'Travaux de démolition et dépose', designation_ar: 'أعمال هدم وفك', defaultUnit: 'forfait' },
  { category: 'preparation', match: /(évacuation|evacuation|gravats|déchets|dechets|benne)/i,
    designation_fr: 'Évacuation des gravats', designation_ar: 'إخلاء المخلفات', defaultUnit: 'forfait' },
  { category: 'preparation', match: /(ponçage|poncage|rebouchage|reboucher|enduit\s+(de\s+)?lissage|préparation|preparation)\s+(mur|plafond|surface)?/i,
    designation_fr: 'Préparation des supports (rebouchage, ponçage)', designation_ar: 'تحضير الأسطح (ترميم وصنفرة)', defaultUnit: 'm²' },

  // ---- Murs
  { category: 'murs', match: /(faïence|faience)/i,
    designation_fr: 'Fourniture et pose faïence murale', designation_ar: 'توريد وتركيب فايونس للحوائط', defaultUnit: 'm²' },
  { category: 'murs', match: /(peinture\s+(mur|murale|intérieure|interieure))/i,
    designation_fr: 'Fourniture et application peinture murs', designation_ar: 'توريد وتطبيق دهان الحوائط', defaultUnit: 'm²' },
  { category: 'murs', match: /(peinture\s+(plafond|plafonds))/i,
    designation_fr: 'Fourniture et application peinture plafonds', designation_ar: 'توريد وتطبيق دهان الأسقف', defaultUnit: 'm²' },
  { category: 'murs', match: /(peinture\s+(façade|facade|extérieure|exterieure)|ravalement)/i,
    designation_fr: 'Fourniture et application peinture façade', designation_ar: 'توريد وتطبيق دهان الواجهة', defaultUnit: 'm²' },
  { category: 'murs', match: /(\bpeinture\b)/i,
    designation_fr: 'Travaux de peinture', designation_ar: 'أعمال الدهان', defaultUnit: 'm²' },
  { category: 'murs', match: /(placo|plaque\s+(de\s+)?plâtre|cloison|doublage)/i,
    designation_fr: 'Fourniture et pose cloisons / doublage placo', designation_ar: 'توريد وتركيب فواصل / تكسية جبسية', defaultUnit: 'm²' },
  { category: 'murs', match: /(enduit|crépi|crepi)/i,
    designation_fr: 'Fourniture et application d\'enduit', designation_ar: 'توريد وتطبيق المعجون', defaultUnit: 'm²' },

  // ---- Sols
  { category: 'sols', match: /(carrelage\s+sol|pose\s+carrelage|\bcarrelage\b)/i,
    designation_fr: 'Fourniture et pose carrelage sol', designation_ar: 'توريد وتركيب بلاط الأرضية', defaultUnit: 'm²' },
  { category: 'sols', match: /(parquet\s+(massif|collé|colle))/i,
    designation_fr: 'Fourniture et pose parquet massif', designation_ar: 'توريد وتركيب باركيه خشب طبيعي', defaultUnit: 'm²' },
  { category: 'sols', match: /(parquet|stratifié|stratifie)/i,
    designation_fr: 'Fourniture et pose parquet stratifié', designation_ar: 'توريد وتركيب باركيه', defaultUnit: 'm²' },
  { category: 'sols', match: /(chape|ragréage|ragreage|dalle\s+béton|dalle\s+beton)/i,
    designation_fr: 'Réalisation chape / ragréage', designation_ar: 'صب أرضية إسمنتية', defaultUnit: 'm²' },
  { category: 'sols', match: /(plinthe|plinthes)/i,
    designation_fr: 'Fourniture et pose plinthes', designation_ar: 'توريد وتركيب قواعد الجدار', defaultUnit: 'ml' },

  // ---- Plomberie
  { category: 'plomberie', match: /(wc|toilette)/i,
    designation_fr: 'Installation WC complet', designation_ar: 'تركيب مرحاض كامل', defaultUnit: 'U' },
  { category: 'plomberie', match: /(douche|receveur|paroi)/i,
    designation_fr: 'Installation douche complète', designation_ar: 'تركيب دش كامل', defaultUnit: 'U' },
  { category: 'plomberie', match: /(baignoire)/i,
    designation_fr: 'Installation baignoire', designation_ar: 'تركيب بانيو', defaultUnit: 'U' },
  { category: 'plomberie', match: /(lavabo|vasque|évier|evier)/i,
    designation_fr: 'Installation lavabo / vasque', designation_ar: 'تركيب حوض', defaultUnit: 'U' },
  { category: 'plomberie', match: /(robinet|mitigeur)/i,
    designation_fr: 'Fourniture et pose robinetterie', designation_ar: 'توريد وتركيب الحنفيات', defaultUnit: 'U' },
  { category: 'plomberie', match: /(chauffe-eau|ballon|chauffage)/i,
    designation_fr: 'Installation chauffe-eau', designation_ar: 'تركيب سخان الماء', defaultUnit: 'U' },
  { category: 'plomberie', match: /(plomberie|tuyau|canalisation|raccord|évacuation\s+eau)/i,
    designation_fr: 'Travaux de plomberie', designation_ar: 'أعمال السباكة', defaultUnit: 'forfait' },

  // ---- Électricité
  { category: 'electricite', match: /(tableau\s+électrique|tableau\s+electrique)/i,
    designation_fr: 'Installation tableau électrique', designation_ar: 'تركيب لوحة الكهرباء', defaultUnit: 'U' },
  { category: 'electricite', match: /(spot|luminaire|éclairage|eclairage|applique)/i,
    designation_fr: 'Fourniture et pose éclairage', designation_ar: 'توريد وتركيب الإضاءة', defaultUnit: 'U' },
  { category: 'electricite', match: /(prise|interrupteur)/i,
    designation_fr: 'Fourniture et pose prises et interrupteurs', designation_ar: 'توريد وتركيب المقابس والمفاتيح', defaultUnit: 'U' },
  { category: 'electricite', match: /(électricité|electricite|câblage|cablage|circuit\s+électrique)/i,
    designation_fr: 'Travaux d\'électricité', designation_ar: 'أعمال الكهرباء', defaultUnit: 'forfait' },

  // ---- Menuiserie
  { category: 'menuiserie', match: /(fenêtre|fenetre|baie\s+vitrée|baie\s+vitree)/i,
    designation_fr: 'Fourniture et pose fenêtres', designation_ar: 'توريد وتركيب نوافذ', defaultUnit: 'U' },
  { category: 'menuiserie', match: /(porte\s+(d['’]entrée|entrée|entree))/i,
    designation_fr: 'Fourniture et pose porte d\'entrée', designation_ar: 'توريد وتركيب باب رئيسي', defaultUnit: 'U' },
  { category: 'menuiserie', match: /(porte\s+intérieure|porte\s+interieure|\bporte\b)/i,
    designation_fr: 'Fourniture et pose portes intérieures', designation_ar: 'توريد وتركيب أبواب داخلية', defaultUnit: 'U' },
  { category: 'menuiserie', match: /(placard|dressing|rangement)/i,
    designation_fr: 'Fourniture et pose placards', designation_ar: 'توريد وتركيب خزائن', defaultUnit: 'U' },

  // ---- Finitions
  { category: 'finitions', match: /(nettoyage|livraison\s+chantier|nettoyage\s+fin)/i,
    designation_fr: 'Nettoyage de fin de chantier', designation_ar: 'تنظيف نهاية الورشة', defaultUnit: 'forfait' },
  { category: 'finitions', match: /(joint(s)?\s+silicone|joint(s)?\s+(de\s+)?finition)/i,
    designation_fr: 'Réalisation des joints de finition', designation_ar: 'تنفيذ اللحامات النهائية', defaultUnit: 'forfait' },
];

const isRawMaterialItem = (item: RawSuggestedItem): boolean => {
  const unit = (item.unit || '').toLowerCase().trim();
  if (RAW_MATERIAL_UNITS.has(unit)) return true;
  const desig = (item.designation_fr || '').toLowerCase();
  return RAW_MATERIAL_KEYWORDS.some(kw => desig.includes(kw));
};

const matchWorkType = (item: RawSuggestedItem): WorkTypeRule | null => {
  const desig = (item.designation_fr || '').toLowerCase();
  if (!desig) return null;
  for (const rule of WORK_TYPES) {
    if (rule.match.test(desig)) return rule;
  }
  return null;
};

/**
 * Transform raw smart-devis items into clean professional grouped lines.
 * Returns lines ordered by category, with no prices, ready for the manual form.
 */
export function transformSmartDevisItemsForManualQuote(
  rawItems: RawSuggestedItem[],
): CleanLine[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

  // Aggregate by work-type rule key
  type Bucket = {
    rule: WorkTypeRule;
    quantity: number;
    hasMeasurableQty: boolean;
  };
  const buckets = new Map<string, Bucket>();

  for (const raw of rawItems) {
    if (!raw || isRawMaterialItem(raw)) continue;
    const rule = matchWorkType(raw);
    if (!rule) continue;

    const qty = Number(raw.quantity);
    const unit = (raw.unit || '').toLowerCase().trim();
    const measurable =
      Number.isFinite(qty) && qty > 0 &&
      (unit === 'm²' || unit === 'm2' || unit === 'ml' || unit === 'u' || unit === 'unit' || unit === 'unité');

    const existing = buckets.get(rule.designation_fr);
    if (existing) {
      if (measurable && rule.defaultUnit === (unit === 'm2' ? 'm²' : unit === 'unit' || unit === 'unité' ? 'U' : unit)) {
        existing.quantity += qty;
        existing.hasMeasurableQty = true;
      }
    } else {
      buckets.set(rule.designation_fr, {
        rule,
        quantity: measurable && (rule.defaultUnit === 'm²' ? unit === 'm²' || unit === 'm2' : true) ? qty : 0,
        hasMeasurableQty: measurable,
      });
    }
  }

  // Build lines, sorted by category order
  const lines: (CleanLine & { _order: number })[] = [];
  for (const bucket of buckets.values()) {
    const cat = CATEGORIES[bucket.rule.category];
    const useQty = bucket.hasMeasurableQty && bucket.quantity > 0 && bucket.rule.defaultUnit !== 'forfait';
    lines.push({
      designation_fr: bucket.rule.designation_fr,
      designation_ar: bucket.rule.designation_ar,
      quantity: useQty ? Math.round(bucket.quantity * 100) / 100 : 1,
      unit: bucket.rule.defaultUnit,
      unitPrice: 0,
      total: 0,
      category: cat.fr,
      _order: cat.order,
    });
  }

  lines.sort((a, b) => a._order - b._order);
  return lines.map(({ _order, ...l }) => l);
}
