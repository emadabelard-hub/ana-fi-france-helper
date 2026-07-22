// Shared schema for document analysis extraction (devis / BTP documents).
// Additive — legacy fields (designation_fr, designation_ar, quantity, unit,
// unitPrice, lot) are preserved for frontend compatibility. New fields carry
// source, confidence, and review metadata.

export type FieldConfidence = "high" | "medium" | "low" | "unknown";

export interface DocumentSource {
  fileName: string | null;
  pageNumber: number | null;
  sourceText: string | null;
}

export interface ItemFieldConfidences {
  designation: FieldConfidence;
  quantity: FieldConfidence;
  unit: FieldConfidence;
  unitPrice: FieldConfidence;
  lot: FieldConfidence;
  source: FieldConfidence;
}

export interface DocumentAnalysisItem {
  // Legacy fields (kept for frontend compatibility)
  designation_fr: string;
  designation_ar: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lot: string | null;
  // New structured fields
  technicalDescription: string | null;
  includesMaterials: boolean | null;
  includesLabor: boolean | null;
  source: DocumentSource;
  confidence: FieldConfidence;
  fieldConfidences: ItemFieldConfidences;
  requiresReview: boolean;
  reviewReasons: string[];
}

export type DocumentTypeId =
  | "devis"
  | "facture_client"
  | "facture_fournisseur"
  | "dpgf"
  | "cctp"
  | "bordereau_prix"
  | "plan_architecte"
  | "plan_technique"
  | "plan_electrique"
  | "plan_plomberie"
  | "plan_facade"
  | "bon_commande"
  | "bon_livraison"
  | "situation_travaux"
  | "metre"
  | "note_calcul"
  | "compte_rendu_chantier"
  | "rapport_expertise"
  | "photo_chantier"
  | "croquis_manuscrit"
  | "note_manuscrite"
  | "document_administratif"
  | "unknown";

export type DocumentCategory =
  | "commercial"
  | "technique"
  | "plan"
  | "chantier"
  | "administratif"
  | "manuscrit"
  | "photo"
  | "unknown";

export const DOCUMENT_TYPE_IDS: DocumentTypeId[] = [
  "devis", "facture_client", "facture_fournisseur", "dpgf", "cctp",
  "bordereau_prix", "plan_architecte", "plan_technique", "plan_electrique",
  "plan_plomberie", "plan_facade", "bon_commande", "bon_livraison",
  "situation_travaux", "metre", "note_calcul", "compte_rendu_chantier",
  "rapport_expertise", "photo_chantier", "croquis_manuscrit",
  "note_manuscrite", "document_administratif", "unknown",
];

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "commercial", "technique", "plan", "chantier",
  "administratif", "manuscrit", "photo", "unknown",
];

// Mapping documentType → catégorie par défaut. Utilisé comme filet de sécurité
// si le modèle omet la catégorie.
export const DEFAULT_CATEGORY_FOR_TYPE: Record<DocumentTypeId, DocumentCategory> = {
  devis: "commercial",
  facture_client: "commercial",
  facture_fournisseur: "commercial",
  bon_commande: "commercial",
  bon_livraison: "commercial",
  situation_travaux: "commercial",
  dpgf: "technique",
  cctp: "technique",
  bordereau_prix: "technique",
  metre: "technique",
  note_calcul: "technique",
  plan_architecte: "plan",
  plan_technique: "plan",
  plan_electrique: "plan",
  plan_plomberie: "plan",
  plan_facade: "plan",
  compte_rendu_chantier: "chantier",
  rapport_expertise: "chantier",
  photo_chantier: "photo",
  croquis_manuscrit: "manuscrit",
  note_manuscrite: "manuscrit",
  document_administratif: "administratif",
  unknown: "unknown",
};

export interface DocumentAnalysisResult {
  documentType: DocumentTypeId;
  documentCategory: DocumentCategory;
  confidenceDocumentType: FieldConfidence;
  documentTypeReason: string | null;
  subject: string | null;
  items: DocumentAnalysisItem[];
  warnings: string[];
  unreadableElements: string[];
  analysisComplete: boolean;
  // P5.1 — Compréhension métier des documents techniques BTP.
  // Listes INFORMATIVES : n'alimentent jamais automatiquement le devis.
  // Seul items[] est transférable vers le Smart Devis.
  prestationsFacturables: string[];
  contraintesTechniques: string[];
  informationsAdministratives: string[];
  referencesReglementaires: string[];
  elementsNonExploitables: string[];
}

function toDocumentType(v: unknown): DocumentTypeId {
  if (typeof v !== "string") return "unknown";
  const s = v.trim().toLowerCase().replace(/[-\s]+/g, "_");
  // legacy aliases
  const alias: Record<string, DocumentTypeId> = {
    facture: "facture_client",
    demande: "document_administratif",
    autre: "unknown",
    plan: "plan_technique",
    photo: "photo_chantier",
  };
  if (alias[s]) return alias[s];
  return (DOCUMENT_TYPE_IDS as string[]).includes(s) ? (s as DocumentTypeId) : "unknown";
}

function toDocumentCategory(v: unknown, type: DocumentTypeId): DocumentCategory {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if ((DOCUMENT_CATEGORIES as string[]).includes(s)) return s as DocumentCategory;
  }
  return DEFAULT_CATEGORY_FOR_TYPE[type];
}

export const DOCUMENT_ANALYSIS_ERROR_CODE = "DOCUMENT_ANALYSIS_SCHEMA_ERROR";
export const DOCUMENT_ANALYSIS_ERROR_MESSAGE =
  "Le document a été lu, mais certaines informations n’ont pas pu être structurées de manière fiable. Aucune ligne de devis n’a été créée afin d’éviter une erreur.";

const CONFIDENCES: FieldConfidence[] = ["high", "medium", "low", "unknown"];

function toConfidence(v: unknown): FieldConfidence {
  return CONFIDENCES.includes(v as FieldConfidence) ? (v as FieldConfidence) : "unknown";
}

function toStringOrNull(v: unknown, maxLen = 5000): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toBoolOrNull(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["true", "oui", "yes", "1"].includes(s)) return true;
  if (["false", "non", "no", "0"].includes(s)) return false;
  return null;
}

// Normalize obvious unit variants only. Return null if not clearly identifiable.
export function normalizeUnit(raw: unknown): { value: string | null; normalized: boolean } {
  if (raw === null || raw === undefined) return { value: null, normalized: false };
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return { value: null, normalized: false };
  const map: Record<string, string> = {
    "m2": "m²", "m²": "m²", "metre carre": "m²", "mètre carré": "m²", "metres carres": "m²", "mètres carrés": "m²",
    "m3": "m³", "m³": "m³", "metre cube": "m³", "mètre cube": "m³",
    "ml": "ml", "m.l.": "ml", "m.l": "ml", "metre lineaire": "ml", "mètre linéaire": "ml", "metres lineaires": "ml", "mètres linéaires": "ml",
    "u": "u", "unite": "u", "unité": "u", "unites": "u", "unités": "u", "piece": "u", "pièce": "u", "pieces": "u", "pièces": "u", "pc": "u", "pcs": "u",
    "forfait": "forfait", "fft": "forfait", "ft": "forfait",
    "h": "h", "heure": "h", "heures": "h", "hr": "h",
    "j": "j", "jour": "j", "jours": "j",
    "kg": "kg", "g": "g", "l": "l", "litre": "l", "litres": "l",
    "ens": "ens", "ensemble": "ens",
  };
  if (map[s]) return { value: map[s], normalized: true };
  // Keep as-is if plausible short token (<=10) but mark not-normalized
  return { value: s.length <= 20 ? s : null, normalized: false };
}

function pickWorstConfidence(...levels: FieldConfidence[]): FieldConfidence {
  const rank: Record<FieldConfidence, number> = { high: 3, medium: 2, low: 1, unknown: 0 };
  return levels.reduce<FieldConfidence>((acc, c) => (rank[c] < rank[acc] ? c : acc), "high");
}

// Normalize a raw item coming from the model (possibly legacy format).
// Returns null if the designation is unusable.
export function normalizeItem(raw: any, fileName: string | null): DocumentAnalysisItem | null {
  if (!raw || typeof raw !== "object") return null;

  const designation_fr = toStringOrNull(raw.designation_fr, 2000) ?? "";
  const designation_ar = toStringOrNull(raw.designation_ar, 2000) ?? "";
  if (!designation_fr && !designation_ar) return null;

  const reviewReasons: string[] = [];
  const rawFieldConf = raw.fieldConfidences && typeof raw.fieldConfidences === "object"
    ? raw.fieldConfidences
    : {};

  // ---- Designation
  const designationConf: FieldConfidence = designation_fr
    ? toConfidence(rawFieldConf.designation ?? raw.designationConfidence ?? "high")
    : "low";
  if (!designation_fr) reviewReasons.push("Désignation française absente");

  // ---- Quantity — never coerce absent -> 1
  let quantity = toNumberOrNull(raw.quantity);
  const rawHadQuantity = raw.quantity !== undefined && raw.quantity !== null && raw.quantity !== "";
  // Legacy compat: if the model returned exactly 1 without any confidence hint,
  // treat as unverified.
  let quantityConf: FieldConfidence = toConfidence(rawFieldConf.quantity ?? raw.quantityConfidence);
  if (!rawHadQuantity) {
    quantity = null;
    quantityConf = "unknown";
    reviewReasons.push("Quantité absente dans le document");
  } else if (quantity === null || quantity <= 0) {
    quantity = null;
    quantityConf = "unknown";
    reviewReasons.push("Quantité illisible ou invalide");
  } else if (quantityConf === "unknown") {
    // No explicit signal from model — assume medium if plausible integer/decimal
    quantityConf = "medium";
  }

  // ---- Unit — never coerce absent -> "u"
  const rawHadUnit = raw.unit !== undefined && raw.unit !== null && String(raw.unit).trim() !== "";
  const unitInfo = normalizeUnit(raw.unit);
  let unit = unitInfo.value;
  let unitConf: FieldConfidence = toConfidence(rawFieldConf.unit ?? raw.unitConfidence);
  if (!rawHadUnit) {
    unit = null;
    unitConf = "unknown";
    reviewReasons.push("Unité absente dans le document");
  } else if (!unit) {
    unitConf = "unknown";
    reviewReasons.push("Unité illisible");
  } else if (unitConf === "unknown") {
    unitConf = unitInfo.normalized ? "medium" : "low";
    if (!unitInfo.normalized) reviewReasons.push("Unité non standard, à vérifier");
  }

  // ---- Unit price — never coerce absent -> 0
  const rawHadPrice = raw.unitPrice !== undefined && raw.unitPrice !== null && raw.unitPrice !== "";
  let unitPrice = toNumberOrNull(raw.unitPrice);
  let unitPriceConf: FieldConfidence = toConfidence(rawFieldConf.unitPrice ?? raw.unitPriceConfidence);
  if (!rawHadPrice) {
    unitPrice = null;
    unitPriceConf = "unknown";
  } else if (unitPrice === null || unitPrice < 0) {
    unitPrice = null;
    unitPriceConf = "unknown";
    reviewReasons.push("Prix unitaire illisible");
  } else if (unitPriceConf === "unknown") {
    unitPriceConf = "medium";
  }

  // ---- Lot — do not force fallback
  let lot = toStringOrNull(raw.lot, 200);
  let lotConf: FieldConfidence = toConfidence(rawFieldConf.lot ?? raw.lotConfidence);
  if (lot && /nettoyage\s+et\s+divers/i.test(lot) && lotConf === "unknown") {
    // Legacy fallback likely — flag for review
    lotConf = "low";
    reviewReasons.push("Lot non identifiable avec certitude");
  }
  if (!lot) {
    lotConf = "unknown";
    reviewReasons.push("Lot non identifiable avec certitude");
  } else if (lotConf === "unknown") {
    lotConf = "medium";
  }

  // ---- Source
  const rawSource = raw.source && typeof raw.source === "object" ? raw.source : {};
  const source: DocumentSource = {
    fileName: toStringOrNull(rawSource.fileName, 300) ?? fileName,
    pageNumber: (() => {
      const p = toNumberOrNull(rawSource.pageNumber);
      return p !== null && p > 0 ? Math.floor(p) : null;
    })(),
    sourceText: toStringOrNull(rawSource.sourceText, 300),
  };
  const sourceConf: FieldConfidence = source.sourceText
    ? (source.pageNumber ? "high" : "medium")
    : "unknown";
  if (!source.sourceText) reviewReasons.push("Extrait source non disponible");
  if (!source.pageNumber) {
    // Only mention if it's not already implied
    if (!reviewReasons.includes("Extrait source non disponible")) {
      reviewReasons.push("Page source non disponible");
    }
  }

  // ---- Global confidence: worst of designation/quantity/unit — price excluded
  // unless it was explicitly claimed. See spec section 5.
  const essential: FieldConfidence[] = [designationConf, quantityConf, unitConf];
  if (rawHadPrice) essential.push(unitPriceConf);
  const confidence = pickWorstConfidence(...essential);

  // ---- Review triggers from raw hints
  const rawReviewReasons = Array.isArray(raw.reviewReasons) ? raw.reviewReasons : [];
  for (const r of rawReviewReasons) {
    const s = toStringOrNull(r, 200);
    if (s && !reviewReasons.includes(s)) reviewReasons.push(s);
  }
  const requiresReview = raw.requiresReview === true
    || reviewReasons.length > 0
    || confidence === "low"
    || confidence === "unknown";

  return {
    designation_fr,
    designation_ar,
    quantity,
    unit,
    unitPrice,
    lot,
    technicalDescription: toStringOrNull(raw.technicalDescription, 2000),
    includesMaterials: toBoolOrNull(raw.includesMaterials),
    includesLabor: toBoolOrNull(raw.includesLabor),
    source,
    confidence,
    fieldConfidences: {
      designation: designationConf,
      quantity: quantityConf,
      unit: unitConf,
      unitPrice: unitPriceConf,
      lot: lotConf,
      source: sourceConf,
    },
    requiresReview,
    reviewReasons,
  };
}

// Validate an already-normalized item structurally. Returns list of errors.
function validateItem(it: DocumentAnalysisItem, idx: number): string[] {
  const errs: string[] = [];
  if (typeof it.designation_fr !== "string") errs.push(`items[${idx}].designation_fr`);
  if (typeof it.designation_ar !== "string") errs.push(`items[${idx}].designation_ar`);
  if (it.quantity !== null && typeof it.quantity !== "number") errs.push(`items[${idx}].quantity`);
  if (it.unit !== null && typeof it.unit !== "string") errs.push(`items[${idx}].unit`);
  if (it.unitPrice !== null && typeof it.unitPrice !== "number") errs.push(`items[${idx}].unitPrice`);
  if (!CONFIDENCES.includes(it.confidence)) errs.push(`items[${idx}].confidence`);
  if (!it.fieldConfidences || typeof it.fieldConfidences !== "object") errs.push(`items[${idx}].fieldConfidences`);
  if (!Array.isArray(it.reviewReasons)) errs.push(`items[${idx}].reviewReasons`);
  if (!it.source || typeof it.source !== "object") errs.push(`items[${idx}].source`);
  if (!it.designation_fr && !it.designation_ar) errs.push(`items[${idx}].designation(empty)`);
  return errs;
}

// Normalize an arbitrary model payload into a DocumentAnalysisResult.
// Throws on unrecoverable schema errors.
export function normalizeAnalysisPayload(
  raw: any,
  opts: { fileName?: string | null } = {},
): DocumentAnalysisResult {
  if (!raw || typeof raw !== "object") {
    throw new Error(DOCUMENT_ANALYSIS_ERROR_CODE);
  }
  const rawItems = Array.isArray(raw.items) ? raw.items : null;
  if (!rawItems) throw new Error(DOCUMENT_ANALYSIS_ERROR_CODE);

  const fileName = opts.fileName ?? null;
  const items: DocumentAnalysisItem[] = [];
  const errors: string[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = normalizeItem(rawItems[i], fileName);
    if (!it) continue; // silently drop unusable stubs (no designation at all)
    const e = validateItem(it, i);
    if (e.length) {
      errors.push(...e);
      continue;
    }
    items.push(it);
  }
  if (errors.length && items.length === 0) {
    throw new Error(DOCUMENT_ANALYSIS_ERROR_CODE);
  }

  const documentType = toDocumentType(raw.documentType);
  const documentCategory = toDocumentCategory(raw.documentCategory, documentType);
  const confidenceDocumentType: FieldConfidence = documentType === "unknown"
    ? "low"
    : toConfidence(raw.confidenceDocumentType);
  const documentTypeReason = toStringOrNull(raw.documentTypeReason, 500);

  const toStringList = (v: unknown, maxLen = 500): string[] =>
    Array.isArray(v)
      ? v.map((x) => toStringOrNull(x, maxLen)).filter((x: string | null): x is string => !!x)
      : [];

  return {
    documentType,
    documentCategory,
    confidenceDocumentType,
    documentTypeReason,
    subject: toStringOrNull(raw.subject, 500),
    items,
    warnings: toStringList(raw.warnings),
    unreadableElements: toStringList(raw.unreadableElements),
    analysisComplete: raw.analysisComplete !== false,
    prestationsFacturables: toStringList(raw.prestationsFacturables, 300),
    contraintesTechniques: toStringList(raw.contraintesTechniques, 300),
    informationsAdministratives: toStringList(raw.informationsAdministratives, 300),
    referencesReglementaires: toStringList(raw.referencesReglementaires, 300),
    elementsNonExploitables: toStringList(raw.elementsNonExploitables, 300),
  };
}

// Prompt fragment shared by both edge functions describing the expected JSON
// output. Callers prepend their domain-specific instructions.
export const DOCUMENT_ANALYSIS_PROMPT_SPEC = `
FORMAT DE SORTIE — JSON STRICT UNIQUEMENT, sans markdown, sans texte autour :

{
  "documentType": "devis" | "facture_client" | "facture_fournisseur" | "dpgf" | "cctp" | "bordereau_prix" | "plan_architecte" | "plan_technique" | "plan_electrique" | "plan_plomberie" | "plan_facade" | "bon_commande" | "bon_livraison" | "situation_travaux" | "metre" | "note_calcul" | "compte_rendu_chantier" | "rapport_expertise" | "photo_chantier" | "croquis_manuscrit" | "note_manuscrite" | "document_administratif" | "unknown",
  "documentCategory": "commercial" | "technique" | "plan" | "chantier" | "administratif" | "manuscrit" | "photo" | "unknown",
  "confidenceDocumentType": "high" | "medium" | "low" | "unknown",
  "documentTypeReason": "phrase courte en français justifiant le type retenu",
  "subject": "objet court du document ou null",
  "analysisComplete": true | false,
  "warnings": ["texte court en français"],
  "unreadableElements": ["zones illisibles décrites brièvement"],
  "prestationsFacturables": ["libellés courts des prestations réellement facturables identifiées"],
  "contraintesTechniques": ["contraintes chantier (protection sols, nettoyage quotidien, échafaudage, sécurité, DTU applicables, horaires, accès…)"],
  "informationsAdministratives": ["maître d'ouvrage, adresse, lot, phase, références, délai, pénalités, coordonnées…"],
  "referencesReglementaires": ["normes, DTU, RE2020, ERP, accessibilité, sécurité incendie, arrêtés cités…"],
  "elementsNonExploitables": ["éléments présents mais non transformables en ligne de devis (photos, plans non côtés, notes vagues…)"],
  "unreadableElements": ["zones illisibles décrites brièvement"],
  "items": [
    {
      "designation_fr": "libellé français exact (obligatoire si ligne facturable)",
      "designation_ar": "libellé arabe si présent, sinon chaîne vide",
      "quantity": nombre ou null,
      "unit": "m²" | "ml" | "u" | "forfait" | "m³" | "h" | "j" | "kg" | "l" | "ens" | null,
      "unitPrice": nombre ou null,
      "lot": "LOT — NOM_DU_LOT" ou null,
      "technicalDescription": "précisions techniques hors prestation facturable, sinon null",
      "includesMaterials": true | false | null,
      "includesLabor": true | false | null,
      "source": {
        "fileName": "nom du fichier si connu, sinon null",
        "pageNumber": numéro de page si connu, sinon null,
        "sourceText": "extrait court (<= 300 caractères) du document, sinon null"
      },
      "confidence": "high" | "medium" | "low" | "unknown",
      "fieldConfidences": {
        "designation": "...",
        "quantity": "...",
        "unit": "...",
        "unitPrice": "...",
        "lot": "...",
        "source": "..."
      },
      "requiresReview": true | false,
      "reviewReasons": ["message court en français"]
    }
  ]
}

IDENTIFICATION DU TYPE DE DOCUMENT — étape préalable obligatoire :
- Détermine d'abord "documentType" avant d'analyser le contenu métier.
- Renseigne "documentCategory" cohérente : commercial (devis, facture, bon de commande/livraison, situation), technique (CCTP, DPGF, bordereau de prix, métré, note de calcul), plan (plans architecte / technique / électrique / plomberie / façade), chantier (compte rendu, rapport d'expertise), photo (photographie de chantier), manuscrit (croquis ou note manuscrite), administratif (courrier, attestation, KBIS, etc.).
- Renseigne "confidenceDocumentType" (high / medium / low / unknown) selon la clarté du document.
- Justifie brièvement dans "documentTypeReason" (ex : "Présence d'un tableau de prix et d'un total HT.", "Mentions CCTP explicites.", "Document composé principalement d'un plan côté.", "Photographie de chantier sans texte structuré.").
- Si le document ne correspond à aucun type reconnu : documentType = "unknown", documentCategory = "unknown", confidenceDocumentType = "low", et explique pourquoi dans "documentTypeReason". N'invente JAMAIS un type.
- Un plan, une photo, un croquis ou une note manuscrite peuvent parfaitement donner "items": [] ; ne fabrique pas de lignes facturables dans ce cas.

COMPRÉHENSION MÉTIER DES DOCUMENTS TECHNIQUES BTP (CCTP, DPGF, BPU, métré, bordereau quantitatif, notice descriptive, compte rendu de chantier, rapport d'expertise, cahier des charges, plan, photo) — obligatoire :
- Sépare STRICTEMENT quatre familles d'informations en plus des lignes extraites :
  1. "prestationsFacturables" : libellés courts des prestations réellement facturables identifiées (ex : "Peinture murs", "Pose carrelage 60×60", "Isolation combles"). Ces libellés doivent correspondre aux items[] extraits (une entrée par prestation retenue). Si aucune prestation facturable n'est identifiable, retourne un tableau vide.
  2. "contraintesTechniques" : éléments d'exécution ou d'organisation qui NE sont PAS des prestations facturables (ex : "Protection des sols obligatoire", "Nettoyage quotidien du chantier", "Respect du DTU 59.1", "Échafaudage obligatoire au-delà de 3 m", "Port des EPI"). Ne les transforme JAMAIS en items.
  3. "informationsAdministratives" : maître d'ouvrage, adresse du chantier, numéro de lot, phase, références du marché, délais, pénalités, contacts.
  4. "referencesReglementaires" : normes et textes cités (DTU, NF, RE2020, ERP, PMR/accessibilité, sécurité incendie, arrêtés).
  5. "elementsNonExploitables" : éléments présents dans le document mais impossibles à transformer en devis (photo sans texte, plan sans cotes, note vague, croquis illisible).
- N'ajoute jamais une contrainte technique, une information administrative ou une référence réglementaire dans "items[]".
- Ne recopie jamais une prestation dans plusieurs listes : une prestation facturable va dans items[] ET dans "prestationsFacturables", pas ailleurs.
- Pour un plan / une photo / un croquis : items = [], prestationsFacturables = [], mais tu peux remplir "contraintesTechniques", "informationsAdministratives" ou "elementsNonExploitables" si le document le permet.



RÈGLES ABSOLUES :
- N'invente jamais une prestation, une quantité, une unité, un prix ou un lot.
- Utilise null pour toute information absente du document. N'utilise pas 1 pour une quantité absente. N'utilise pas 0 pour un prix absent. N'utilise pas "u" pour une unité absente. N'utilise pas "NETTOYAGE ET DIVERS" comme lot par défaut.
- Signale toute ambiguïté via "requiresReview": true et une raison précise dans "reviewReasons".
- Niveau de confiance :
  * "high" : information explicitement lisible et non ambiguë.
  * "medium" : information vraisemblable mais légèrement ambiguë (déduction raisonnable, tableau imparfait).
  * "low" : information largement déduite ou difficile à lire.
  * "unknown" : information absente ou impossible à évaluer.
- Ne transforme pas une note technique, une réserve, un total ou une simple annotation en prestation facturable : place-la dans "technicalDescription" d'une ligne existante ou dans "warnings".
- Conserve un court extrait source (<= 300 caractères) et le numéro de page si connu ; sinon null.
- Ne modifie pas les valeurs numériques (garde les prix et quantités exacts du document).
`;
