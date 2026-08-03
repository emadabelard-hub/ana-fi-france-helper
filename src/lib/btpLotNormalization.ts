/**
 * BTP — Normalisation et inférence générique du lot d'une prestation.
 *
 * Règles générales (aucune règle propre à un chantier) :
 *   1. Le lot fourni par les faits BTP est prioritaire.
 *   2. Il est seulement normalisé pour obtenir un intitulé français propre.
 *   3. Un lot valide n'est jamais remplacé (notamment jamais par « Création »).
 *   4. Le lot n'est jamais hérité de la ligne précédente.
 *   5. L'inférence n'intervient que si le lot source est absent ou générique.
 */

export const CANONICAL_LOTS = [
  'DÉPOSE / DÉMOLITION',
  'GROS ŒUVRE / STRUCTURE',
  'CLOISONS / DOUBLAGE / ISOLATION',
  'MENUISERIE',
  'FINITIONS / PEINTURE',
  'SOLS / REVÊTEMENTS',
  'ÉLECTRICITÉ',
  'PLOMBERIE / SANITAIRES',
  'TOITURE / ÉTANCHÉITÉ',
  'EXTÉRIEURS',
] as const;

export type CanonicalLot = (typeof CANONICAL_LOTS)[number];

/** Mots-clés (français + arabe) par lot canonique. */
const LOT_KEYWORDS: Array<{ lot: CanonicalLot; patterns: RegExp[] }> = [
  {
    lot: 'DÉPOSE / DÉMOLITION',
    patterns: [
      /d[ée]pose/i, /d[ée]molition/i, /d[ée]construction/i, /d[ée]samiantage/i,
      /curage/i, /d[ée]capage/i, /هدم/, /إزالة/, /فك/,
    ],
  },
  {
    lot: 'GROS ŒUVRE / STRUCTURE',
    patterns: [
      /gros\s*(?:œuvre|oeuvre)/i, /structure/i, /ma[çc]onnerie/i, /b[ée]ton/i,
      /linteau/i, /poutre/i, /solivage/i, /coffrage/i, /ferraillage/i,
      /fondation/i, /dalle/i, /chape/i, /ipe\s*\d*/i, /هيكل/, /بناء/, /خرسانة/,
    ],
  },
  {
    lot: 'CLOISONS / DOUBLAGE / ISOLATION',
    patterns: [
      /cloison/i, /doublage/i, /isolation/i, /ba\s?13/i, /placo/i,
      /pl[âa]trerie/i, /faux[- ]plafond/i, /laine\s+(?:de\s+)?(?:verre|roche)/i,
      /عزل/, /قواطع/, /جبس/,
    ],
  },
  {
    lot: 'MENUISERIE',
    patterns: [
      /menuiserie/i, /\bportes?\b/i, /\bfen[êe]tres?\b/i, /\bbloc[- ]porte/i,
      /placard/i, /huisserie/i, /volet/i, /escalier\s+bois/i, /\bcoffre\b/i,
      /nichoir/i, /\bniche\b/i, /نجارة/, /باب/, /شباك/, /نافذة/,
    ],
  },
  {
    lot: 'FINITIONS / PEINTURE',
    patterns: [
      /finition/i, /peinture/i, /peindre/i, /enduit/i, /papier\s+peint/i,
      /ragr[ée]age/i, /rebouchage/i, /ponçage/i, /lasure/i, /vernis/i,
      /دهان/, /طلاء/, /تشطيب/,
    ],
  },
  {
    lot: 'SOLS / REVÊTEMENTS',
    patterns: [
      /\bsols?\b/i, /rev[êe]tement/i, /carrelage/i, /faïence/i, /parquet/i,
      /plinthe/i, /lino/i, /moquette/i, /\bpvc\b/i, /أرضيات/, /بلاط/, /سيراميك/,
    ],
  },
  {
    lot: 'ÉLECTRICITÉ',
    patterns: [
      /[ée]lectricit[ée]/i, /[ée]lectrique/i, /tableau\s+[ée]lectrique/i,
      /prise\b/i, /interrupteur/i, /luminaire/i, /c[âa]blage/i, /كهرباء/,
    ],
  },
  {
    lot: 'PLOMBERIE / SANITAIRES',
    patterns: [
      /plomberie/i, /sanitaire/i, /\bwc\b/i, /cuvette/i, /lavabo/i, /vasque/i,
      /douche/i, /baignoire/i, /receveur/i, /robinetterie/i, /mitigeur/i,
      /lave[- ]mains/i, /[ée]vacuation\s+(?:des\s+)?eaux/i, /alimentation\s+en\s+eau/i,
      /chauffe[- ]eau/i, /سباكة/, /صحية/, /حمام/,
    ],
  },
  {
    lot: 'TOITURE / ÉTANCHÉITÉ',
    patterns: [
      /toiture/i, /couverture/i, /[ée]tanch[ée]it[ée]/i, /charpente/i,
      /zinguerie/i, /goutti[èe]re/i, /tuile/i, /سطح/, /عزل\s*مائي/,
    ],
  },
  {
    lot: 'EXTÉRIEURS',
    patterns: [
      /ext[ée]rieur/i, /terrasse/i, /jardin/i, /cl[ôo]ture/i, /fa[çc]ade/i,
      /all[ée]e/i, /portail/i, /خارجي/, /حديقة/,
    ],
  },
];

/** Intitulés trop génériques pour servir de lot professionnel. */
const GENERIC_LOT = [
  /^cr[ée]ation$/i, /^cr[ée]er$/i, /^divers$/i, /^autres?$/i, /^g[ée]n[ée]ral(?:e|es|aux)?$/i,
  /^travaux$/i, /^prestations?$/i, /^lot$/i, /^lot\s*\d+$/i, /^n\/?a$/i, /^-+$/,
  /^inconnu$/i, /^ind[ée]termin[ée]$/i, /^à\s+d[ée]finir$/i, /^a\s+definir$/i,
  /^principal$/i, /^chantier$/i, /^r[ée]novation$/i, /^annotation$/i,
  /^cote$/i, /^cotation$/i, /^dimension(?:s)?$/i, /^information(?:s)?$/i,
];

const isGenericLot = (s: string): boolean => GENERIC_LOT.some((r) => r.test(s.trim()));

const matchCanonical = (text: string): CanonicalLot | null => {
  for (const { lot, patterns } of LOT_KEYWORDS) {
    if (patterns.some((r) => r.test(text))) return lot;
  }
  return null;
};

/** Nettoyage typographique d'un intitulé de lot conservé tel quel. */
const cleanLabel = (s: string): string =>
  s
    .replace(/^lot\s*[:\-–—]?\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toUpperCase();

/**
 * Normalise un lot source : renvoie un intitulé canonique lorsque le libellé
 * correspond à un corps de métier connu, sinon le libellé nettoyé (un lot
 * professionnel déjà pertinent n'est jamais écrasé), sinon null si générique.
 */
export const normalizeLotLabel = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const withoutPrefix = s.replace(/^lot\s*[:\-–—]?\s*/i, '').trim();
  if (!withoutPrefix || isGenericLot(withoutPrefix)) return null;
  const canonical = matchCanonical(withoutPrefix);
  if (canonical) return canonical;
  return cleanLabel(withoutPrefix) || null;
};

/** Déduit un lot canonique depuis la nature réelle des travaux. */
export const inferLotFromText = (text: string): string | null =>
  text && text.trim() ? matchCanonical(text) : null;

/**
 * Règle de priorité : lot source normalisé, puis inférence, puis null.
 * Aucun héritage de la ligne précédente, aucun repli sur « Création ».
 */
export const resolveLot = (sourceLot: unknown, contextText: string): string | null =>
  normalizeLotLabel(sourceLot) ?? inferLotFromText(contextText);
