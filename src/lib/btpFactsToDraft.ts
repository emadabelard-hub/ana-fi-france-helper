/**
 * BTP — Transfert des prestations structurées vers le brouillon de devis.
 *
 * Source unique : le bloc <ANAFYPRO_BTP_FACTS> produit par l'analyse chantier
 * (faits structurés). Aucun texte Markdown n'est reconstitué ici.
 *
 * Statuts transférables :
 *   - ready_for_draft
 *   - ready_for_draft_with_technical_reservation  (quantité/unité conservées)
 *   - certain  (statut historique du bloc de faits — insuffisant seul :
 *     le fait doit décrire une PRESTATION DE TRAVAUX, pas une annotation)
 *
 * Statuts NON transférés automatiquement :
 *   - quantity_to_confirm, not_transferable, lecture_partielle, absent,
 *     hypothèses et informations non vérifiables.
 *
 * Règles absolues :
 *   - jamais de quantité inventée (pas de « 1 »), jamais d'unité forcée à « u » ;
 *   - jamais de prix inventé (unitPrice = 0 = « à compléter », comportement
 *     existant du Devis intelligent) ;
 *   - une cote / dimension / charge n'est jamais une quantité facturable ;
 *   - lot conservé et regroupé une seule fois, aucun doublon.
 */

import type { ValidatedLine, ValidationMeta } from './btpTransferValidator';
import { resolveLot } from './btpLotNormalization';

const TRANSFERABLE = new Set([
  'ready_for_draft',
  'ready_for_draft_with_technical_reservation',
  'certain',
]);

const RESERVATION_STATUS = 'ready_for_draft_with_technical_reservation';

/** Provenance transportée dans le payload du brouillon (aucune colonne en base). */
export const BTP_FACTS_ORIGIN = 'btp_facts';

export type FactsLine = ValidatedLine & {
  /** Provenance : verrouille l'unité contre toute réécriture heuristique. */
  sourceOrigin: typeof BTP_FACTS_ORIGIN;
  /** Fourniture explicitement à la charge du client (mention prouvée). */
  clientSupplied?: boolean;
};

export type FactsDraftResult = {
  lines: FactsLine[];
  meta: ValidationMeta[];
  rawItems: Record<string, unknown>[];
  /** Prestations structurées présentes mais non transférables (à confirmer). */
  pendingCount: number;
  /** Faits écartés car annotation / caractéristique technique (non facturable). */
  excludedAnnotations: number;
  /** Notes techniques conservées (dimensions, réserves) sans ligne facturable. */
  technicalNotes: string[];
  /** Nombre total de prestations structurées trouvées. */
  totalFacts: number;
  /** true dès que des faits structurés exploitables existent dans la source. */
  hasStructuredFacts: boolean;
};

const EMPTY: FactsDraftResult = {
  lines: [],
  meta: [],
  rawItems: [],
  pendingCount: 0,
  excludedAnnotations: 0,
  technicalNotes: [],
  totalFacts: 0,
  hasStructuredFacts: false,
};

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const isReadableUnit = (u: unknown): u is string => {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  if (!s) return false;
  const low = s.toLowerCase();
  if (['?', '-', 'null', 'n/a', 'à définir', 'a definir'].includes(low)) return false;
  return true;
};

const parseFactsSource = (source: unknown): any | null => {
  if (!source) return null;
  if (typeof source === 'object') return source;
  if (typeof source !== 'string') return null;
  const text = source;
  const open = text.indexOf('<ANAFYPRO_BTP_FACTS>');
  const raw = open !== -1
    ? text.slice(open + '<ANAFYPRO_BTP_FACTS>'.length, text.indexOf('</ANAFYPRO_BTP_FACTS>') === -1 ? undefined : text.indexOf('</ANAFYPRO_BTP_FACTS>'))
    : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
};

const readString = (obj: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

// ── Catégorie A : prestation de travaux (action réelle) ────────────────────
const ACTION_PATTERNS = [
  /d[ée]pose/i, /d[ée]molition/i, /d[ée]construction/i, /pose\b/i, /poser/i,
  /installation/i, /installer/i, /cr[ée]ation/i, /cr[ée]er/i, /r[ée]alisation/i,
  /fourniture/i, /peinture/i, /peindre/i, /enduit/i, /ragr[ée]age/i,
  /carrelage/i, /rev[êe]tement/i, /cloison/i, /doublage/i, /isolation/i,
  /pl[âa]trerie/i, /placo/i, /raccordement/i, /remplacement/i, /remplacer/i,
  /r[ée]fection/i, /r[ée]novation/i, /reprise/i, /ouverture/i, /perc(ement|er)/i,
  /[ée]vacuation/i, /nettoyage/i, /ponçage/i, /rebouchage/i, /scellement/i,
  /renforcement/i, /coffrage/i, /ferraillage/i, /ma[çc]onnerie/i, /plomberie/i,
  /[ée]lectricit[ée]/i, /menuiserie/i, /solivage\s+(à|a)\s+cr[ée]er/i,
  /application/i, /traitement/i, /mise en (œuvre|oeuvre|place)/i, /d[ée]capage/i,
  // Actions complémentaires (fabrication, montage, habillage…)
  /fabrication/i, /fabriquer/i, /confection/i, /montage/i, /monter\b/i,
  /assemblage/i, /habillage/i, /r[ée]paration/i, /r[ée]parer/i, /d[ée]placement/i,
  /d[ée]placer/i, /mise\s+en\s+service/i, /branchement/i, /alimentation\s+en\s+eau/i,
  /tablette/i, /coffre\b/i, /niche\b/i,
];

// ── Catégorie A bis : équipements dont la pose est une prestation réelle ───
// (utilisés uniquement quand une quantité et une unité facturables existent)
const EQUIPMENT_PATTERNS = [
  /\bwc\b/i, /cuvette/i, /lave[- ]mains/i, /lavabo/i, /vasque/i, /meuble\s+vasque/i,
  /douche/i, /baignoire/i, /baln[ée]o/i, /receveur/i, /miroir/i, /paroi\b/i,
  /robinetterie/i, /mitigeur/i, /radiateur/i, /s[èe]che[- ]serviettes/i,
  /tablette/i, /porte\b/i, /fen[êe]tre/i, /plinthe/i, /parquet/i, /faïence/i,
];

// ── Catégorie B : caractéristique / annotation technique (non facturable) ──
const ANNOTATION_PATTERNS = [
  /^charge\b/i, /\bcharge (à|a|de|sur)\b/i, /^cote\b/i, /^section\b/i,
  /^port[ée]e\b/i, /^longueur\b/i, /^largeur\b/i, /^hauteur\b/i, /^[ée]paisseur\b/i,
  /^dimension/i, /^calcul/i, /^annotation/i, /^cotation/i, /^rep[èe]re\b/i,
  /^niveau\b/i, /^descente de charge/i, /^entraxe\b/i, /^surface (au plan|indiqu)/i,
  /^\s*[LlHhØø]\s*=/,
  /^dalle\s+(existante|b[ée]ton)\b/i,
];

const hasAction = (text: string): boolean => ACTION_PATTERNS.some((r) => r.test(text));

/**
 * Décision conjointe : la ligne décrit-elle uniquement une annotation technique ?
 * L'action de travaux est cherchée dans la désignation, la preuve, la catégorie
 * et le matériau. Un équipement quantifié (WC, vasque, tablette…) accompagné
 * d'une quantité et d'une unité facturables reste une prestation de pose.
 */
const isAnnotationOnly = (
  text: string,
  category: string | null,
  context = '',
  billableQuantity = false,
): boolean => {
  const t = text.trim();
  if (!t) return true;
  const cat = (category || '').toLowerCase();
  const full = `${t}\n${context}`;

  // Annotation explicite en tête de désignation → exige une action en tête
  // (un participe passé descriptif « posée sur linteau » n'est pas une action).
  if (ANNOTATION_PATTERNS.some((r) => r.test(t))) {
    return !hasAction(t.slice(0, 30));
  }

  if (/annotation|cote|cotation|dimension|caract[ée]ristique|information|note technique|structure existante/.test(cat)) {
    return !hasAction(full);
  }
  if (hasAction(full)) return false;
  // Équipement identifié avec quantité et unité facturables → prestation.
  if (billableQuantity && EQUIPMENT_PATTERNS.some((r) => r.test(full))) return false;
  // Aucune action identifiable → prudence : non facturable.
  return true;
};


// ── Dimension utilisée comme quantité ─────────────────────────────────────
const DIMENSION_ONLY = /\b(longueur|largeur|hauteur|port[ée]e|entraxe|[ée]paisseur)\b/i;
const BILLABLE_METRIC = /\b(surface|m[èe]tr[ée]|quantit[ée]|lin[ée]aire|à traiter|a traiter|à peindre|a peindre|total)\b/i;

/**
 * true si la quantité provient visiblement d'une simple cote d'ouvrage
 * (longueur / largeur / hauteur) sans métrage facturable explicite.
 */
const quantityLooksLikeDimension = (text: string, unit: string): boolean => {
  if (!DIMENSION_ONLY.test(text)) return false;
  if (BILLABLE_METRIC.test(text)) return false;
  const u = unit.trim().toLowerCase();
  return u === 'm' || u === 'ml' || u === 'cm' || u === 'mm';
};

// ── Fourniture à la charge du client (mentions explicites uniquement) ──────
const CLIENT_SUPPLIED_PATTERNS = [
  /fourni(?:e|es|s)?\s+par\s+(?:le|la|les)?\s*client(?:e|es|s)?\b/i,
  /fourni(?:e|es|s)?\s+par\s+(?:le\s+)?ma[îi]tre\s+d[’']?ouvrage/i,
  /fourniture\s+(?:du\s+|de\s+la\s+|par\s+le\s+)?client/i,
  /fourniture\s+client/i,
  /(?:à|a)\s+la\s+charge\s+du\s+client/i,
  /من\s*توريد\s*العميل/,
  /العميل\s*يوفر/,
];

// ── Réserves techniques (mentions explicites uniquement) ──────────────────
const RESERVATION_PATTERNS: Array<RegExp> = [
  /(?:à|a)\s+v[ée]rifier\s+apr[èe]s\s+sondage/i,
  /apr[èe]s\s+sondage/i,
  /caract[èe]re\s+porteur\s+(?:à|a)\s+confirmer/i,
  /(?:à|a)\s+confirmer\s+sur\s+place/i,
  /selon\s+(?:le\s+)?plan\s+de\s+l[’']?ing[ée]nieur/i,
  /suivant\s+plan\s+structure/i,
  /selon\s+(?:le\s+)?plan\s+structure/i,
  /sous\s+r[ée]serve/i,
];

const findFirstMatch = (text: string, patterns: RegExp[]): string | null => {
  for (const r of patterns) {
    const m = text.match(r);
    if (m && m[0]) return m[0].trim();
  }
  return null;
};

const stripFournitureEtPose = (s: string): string =>
  s
    .replace(/^fourniture\s+et\s+pose\s+(de\s+|d[’']|du\s+|des\s+|de\s+la\s+)?/i, 'Pose de ')
    .replace(/^fourniture\s+et\s+installation\s+(de\s+|d[’']|du\s+|des\s+)?/i, 'Pose de ')
    .replace(/^fourniture\s+(et\s+)?pose\b/i, 'Pose')
    .replace(/^fourniture\s+seule\b/i, 'Pose')
    .replace(/^fourniture\s+(de\s+|d[’']|du\s+|des\s+|de\s+la\s+)?/i, 'Pose de ');

/**
 * Mention de fourniture client : accord féminin uniquement lorsqu'il est
 * explicitement prouvé par la source, sinon formulation neutre et sûre.
 */
export const CLIENT_SUPPLIED_NEUTRAL = 'matériel fourni par le client';

export const normalizeClientSuppliedMention = (mention: string): string =>
  /par\s+la\s+cliente\b/i.test(mention)
    ? 'équipement fourni par la cliente'
    : CLIENT_SUPPLIED_NEUTRAL;



/**
 * Construit les lignes de brouillon à partir des faits structurés.
 * Les lignes sont regroupées par lot (ordre de première apparition du lot,
 * ordre d'origine à l'intérieur du lot) afin que le PDF n'affiche qu'un seul
 * en-tête par lot.
 */
export const buildDraftLinesFromFacts = (source: unknown): FactsDraftResult => {
  const parsed = parseFactsSource(source);
  if (!parsed) return EMPTY;

  const rawFacts: unknown = Array.isArray(parsed?.facts)
    ? parsed.facts
    : Array.isArray(parsed?.prestations)
      ? parsed.prestations
      : Array.isArray(parsed)
        ? parsed
        : null;
  if (!Array.isArray(rawFacts) || rawFacts.length === 0) return EMPTY;

  type Entry = { line: FactsLine; meta: ValidationMeta; raw: Record<string, unknown> };
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const technicalNotes: string[] = [];
  let pendingCount = 0;
  let excludedAnnotations = 0;

  rawFacts.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const f = entry as Record<string, unknown>;

    const designation = readString(f, [
      'descriptionExact', 'description', 'designation_fr', 'designation', 'libelle', 'label', 'title',
    ]);
    const status = (readString(f, ['draftStatus', 'transferStatus', 'status']) || '').trim();
    const quantity = toNum(f.quantity ?? f.quantite ?? f.qty);
    const unit = f.unit ?? f.unite;
    const lotSource = readString(f, ['lot', 'lotName', 'lot_fr']);
    const category = readString(f, ['category', 'categorie', 'nature', 'type']);
    const evidenceText = readString(f, ['evidenceText', 'evidence', 'preuve', 'citation']) || '';
    const material = readString(f, ['material', 'materiau', 'materiel']) || '';
    const dimensions = readString(f, ['dimensions', 'dimension', 'cotes']) || '';
    const location = readString(f, ['location', 'localisation', 'zone', 'piece']) || '';
    const sourceFile = readString(f, ['sourceFile', 'fichier', 'file']) || '';
    const sourcePage = readString(f, ['sourcePage', 'page']) || '';

    // 1-6. Lot : source prioritaire (normalisée), puis inférence sur la nature
    // réelle des travaux. Aucun héritage de la ligne précédente, jamais
    // de repli automatique sur « Création ».
    const lot = resolveLot(
      lotSource ?? category,
      `${designation ?? ''}\n${category ?? ''}\n${evidenceText}\n${material}`,
    );

    if (!designation) return;

    const unitReadable = isReadableUnit(unit);
    const unitStr = unitReadable ? String(unit).trim() : '';
    const billableQuantity =
      TRANSFERABLE.has(status) && quantity !== null && quantity > 0 && unitReadable;

    // 5. Exclusion des annotations / caractéristiques techniques.
    if (
      isAnnotationOnly(
        designation,
        category,
        `${evidenceText}\n${material}\n${location}\n${category ?? ''}`,
        billableQuantity,
      )
    ) {
      excludedAnnotations += 1;
      const parts = [designation];
      if (dimensions) parts.push(dimensions);
      if (location) parts.push(location);
      const src = [sourceFile, sourcePage].filter(Boolean).join(' p.');
      technicalNotes.push(src ? `${parts.join(' — ')} (${src})` : parts.join(' — '));
      return;
    }


    // 6. Une cote d'ouvrage n'est jamais une quantité de travaux.
    if (
      quantity !== null &&
      unitReadable &&
      quantityLooksLikeDimension(`${designation} ${dimensions} ${evidenceText}`, unitStr)
    ) {
      pendingCount += 1;
      const dim = dimensions || `${quantity} ${unitStr}`;
      technicalNotes.push(`${designation} — dimension relevée : ${dim} (quantité de travaux à confirmer)`);
      return;
    }

    const valid =
      TRANSFERABLE.has(status) &&
      quantity !== null &&
      Number.isFinite(quantity) &&
      quantity > 0 &&
      unitReadable;

    if (!valid) {
      pendingCount += 1;
      return;
    }

    const haystack = `${designation}\n${evidenceText}\n${material}`;

    // 4. Fourniture à la charge du client — mentions explicites uniquement.
    const clientSuppliedMention = findFirstMatch(haystack, CLIENT_SUPPLIED_PATTERNS);
    const clientSupplied = !!clientSuppliedMention;

    // 7. Réserve technique — mention explicite ou statut dédié.
    const reservationField = readString(f, [
      'technicalReservation', 'reserveTechnique', 'reservation', 'reserve',
    ]);
    const reservationMention = reservationField || findFirstMatch(haystack, RESERVATION_PATTERNS);

    const notes: string[] = [];
    if (status === RESERVATION_STATUS) {
      notes.push(reservationMention ? `réserve technique : ${reservationMention}` : 'réserve technique à confirmer');
    } else if (reservationMention) {
      notes.push(`réserve technique : ${reservationMention}`);
    }

    let baseDesignation = designation;
    if (clientSupplied) {
      baseDesignation = stripFournitureEtPose(baseDesignation);
      if (!CLIENT_SUPPLIED_PATTERNS.some((r) => r.test(baseDesignation))) {
        notes.push(clientSuppliedMention as string);
      }
    }

    const finalDesignation = notes.length > 0
      ? `${baseDesignation} (${notes.join(' ; ')})`
      : baseDesignation;

    const dedupKey = `${finalDesignation.toLowerCase()}|${quantity}|${unitStr.toLowerCase()}|${lot ?? ''}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);

    entries.push({
      raw: f,
      line: {
        designation_fr: finalDesignation,
        designation_ar: '',
        quantity,
        unit: unitStr,
        unitPrice: 0, // prix non renseigné — comportement existant « à compléter »
        lot: lot ?? null,
        sourceOrigin: BTP_FACTS_ORIGIN,
        ...(clientSupplied ? { clientSupplied: true } : {}),
      },
      meta: {
        index: 0, // réattribué après regroupement par lot
        designation: finalDesignation,
        priceAccepted: false,
        quantityAccepted: true,
        reasons: status === RESERVATION_STATUS ? ['technical_reservation'] : [],
        priceSource: null,
        confidence: toNum(f.confidence),
        quantityConfidence: toNum(f.quantityConfidence) ?? toNum(f.confidence),
        priceConfidence: null,
        requiresReview: false,
        arithmeticOk: null,
      },
    });
  });

  // 8. Regroupement par lot : ordre de première apparition des lots,
  // ordre d'origine conservé à l'intérieur de chaque lot, aucun lot vide.
  const lotOrder: string[] = [];
  const buckets = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.line.lot ?? '';
    if (!buckets.has(key)) {
      buckets.set(key, []);
      lotOrder.push(key);
    }
    buckets.get(key)!.push(e);
  }

  const lines: FactsLine[] = [];
  const meta: ValidationMeta[] = [];
  const rawItems: Record<string, unknown>[] = [];
  for (const key of lotOrder) {
    for (const e of buckets.get(key)!) {
      const index = rawItems.length;
      rawItems.push(e.raw);
      lines.push(e.line);
      meta.push({ ...e.meta, index });
    }
  }

  return {
    lines,
    meta,
    rawItems,
    pendingCount,
    excludedAnnotations,
    technicalNotes,
    totalFacts: rawFacts.length,
    hasStructuredFacts: true,
  };
};
