/**
 * BTP — Consolidation des faits AVANT création des lignes de devis.
 *
 * Étape intercalée uniquement dans le parcours « Préparer le devis ».
 * L'extraction reste faite document par document (contrat de faits validé côté
 * serveur). Ici, de façon 100 % déterministe (aucune IA) :
 *   - même ouvrage + informations complémentaires  → fusion / enrichissement ;
 *   - même ouvrage + même information              → doublon supprimé, toutes
 *     les sources conservées ;
 *   - même ouvrage + informations contradictoires   → aucun arbitrage : le fait
 *     passe en « pending » avec le motif « à vérifier ».
 *
 * Aucune quantité n'est additionnée, aucune valeur n'est inventée.
 */

export type MergeableFact = {
  factId?: string;
  lot?: string;
  category?: string;
  descriptionExact?: string;
  evidenceText?: string;
  quantity?: number | null;
  unit?: string | null;
  clientSupplied?: boolean | null;
  transferStatus?: string;
  technicalReservation?: string | null;
  sourceFile?: string;
  sourcePage?: number | null;
  sourceDocId?: string;
  location?: string | null;
  material?: string | null;
  reasons?: unknown;
  [key: string]: unknown;
};

export type MergedFact = MergeableFact & {
  /** Toutes les provenances du fait consolidé (fichier + page). */
  mergedSources?: string[];
  /** Identifiants internes des faits d'origine regroupés. */
  mergedFactIds?: string[];
};

const CONFLICT_REASON = 'informations contradictoires entre documents — à vérifier';

const STOP_WORDS = new Set([
  'fourniture', 'fournitures', 'fourni', 'fournie', 'pose', 'posee', 'poser',
  'application', 'mise', 'oeuvre', 'place', 'travaux', 'realisation',
  'et', 'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'd', 'l', 'en',
  'a', 'au', 'aux', 'sur', 'pour', 'par', 'avec', 'compris', 'y',
]);

const deaccent = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Clé d'ouvrage : tokens significatifs, sans ordre ni chiffres. */
const ouvrageKey = (text: string): string => {
  const tokens = deaccent(String(text || '').toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t));
  return [...new Set(tokens)].sort().join(' ');
};

const normalizeLight = (s: unknown) =>
  deaccent(String(s ?? '').toLowerCase()).replace(/\s+/g, ' ').trim();

const hasActionPrefix = (s: string) =>
  /^(fourniture|pose|d[ée]pose|installation|r[ée]alisation|application|mise en|cr[ée]ation|remplacement|d[ée]molition|nettoyage|traitement)/i
    .test(String(s || '').trim());

const sourceLabel = (f: MergeableFact): string => {
  const file = (f.sourceFile || '').trim();
  const page = f.sourcePage != null ? ` p.${f.sourcePage}` : '';
  return file ? `${file}${page}` : '';
};

const distinct = (values: string[]) => [...new Set(values.filter(Boolean))];

/**
 * Consolide les faits d'un contrat multi-documents pour la création du devis.
 * Les faits « excluded » sont conservés tels quels (notes techniques).
 */
export const mergeFactsForQuote = <T extends MergeableFact>(facts: T[]): MergedFact[] => {
  if (!Array.isArray(facts) || facts.length === 0) return [];

  const passthrough: MergedFact[] = [];
  const groups = new Map<string, T[]>();
  const order: string[] = [];

  for (const f of facts) {
    if (!f || typeof f !== 'object') continue;
    const designation = String(f.descriptionExact || '').trim();
    if (!designation || String(f.transferStatus) === 'excluded') {
      passthrough.push(f as MergedFact);
      continue;
    }
    const key = [
      normalizeLight(f.lot),
      normalizeLight(f.location),
      ouvrageKey(designation),
    ].join('|');
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(f);
  }

  const merged: MergedFact[] = [];

  for (const key of order) {
    const group = groups.get(key)!;
    // Consolidation UNIQUEMENT entre documents différents : deux faits issus
    // d'un même document restent deux lignes distinctes (comportement actuel).
    const docs = new Set(group.map((f) => String(f.sourceDocId || f.sourceFile || '')));
    if (group.length === 1 || docs.size < 2) {
      for (const f of group) {
        merged.push({
          ...f,
          mergedFactIds: f.factId ? [f.factId] : [],
          mergedSources: distinct([sourceLabel(f)]),
        });
      }
      continue;
    }
    if (group.length === 1) {
      const only = group[0];
      merged.push({
        ...only,
        mergedFactIds: only.factId ? [only.factId] : [],
        mergedSources: distinct([sourceLabel(only)]),
      });
      continue;
    }

    // Représentant : désignation la plus complète (action explicite prioritaire).
    const base = [...group].sort((a, b) => {
      const da = String(a.descriptionExact || '');
      const db = String(b.descriptionExact || '');
      const pa = hasActionPrefix(da) ? 1 : 0;
      const pb = hasActionPrefix(db) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return db.length - da.length;
    })[0];

    // Quantité / unité : jamais additionnées, jamais arbitrées.
    const quantified = group.filter(
      (f) => typeof f.quantity === 'number' && Number.isFinite(f.quantity as number) && (f.quantity as number) > 0,
    );
    const pairs = distinct(
      quantified.map((f) => `${f.quantity}|${normalizeLight(f.unit)}`),
    );
    const conflict = pairs.length > 1;
    const chosen = conflict ? null : quantified[0] ?? null;

    // Enrichissement : caractéristiques techniques complémentaires.
    const specs = distinct(
      group
        .map((f) => String(f.material ?? '').trim())
        .filter((m) => m && normalizeLight(base.descriptionExact).indexOf(normalizeLight(m)) === -1),
    );
    const baseDesignation = String(base.descriptionExact || '').trim();
    const descriptionExact = specs.length
      ? `${baseDesignation} — ${specs.join(' — ')}`
      : baseDesignation;

    const reservations = distinct(
      group.map((f) => String(f.technicalReservation ?? '').trim()),
    );
    const reasons = distinct([
      ...group.flatMap((f) => (Array.isArray(f.reasons) ? f.reasons.map(String) : [])),
      ...(conflict
        ? [
            `${CONFLICT_REASON} (${quantified
              .map((f) => `${f.quantity} ${String(f.unit ?? '').trim()} — ${sourceLabel(f) || 'source inconnue'}`)
              .join(' / ')})`,
          ]
        : []),
    ]);

    merged.push({
      ...base,
      descriptionExact,
      quantity: conflict ? null : chosen?.quantity ?? base.quantity ?? null,
      unit: conflict ? null : chosen?.unit ?? base.unit ?? null,
      transferStatus: conflict
        ? 'pending'
        : group.some((f) => String(f.transferStatus) === 'ready') && chosen
          ? 'ready'
          : String(base.transferStatus || 'pending'),
      clientSupplied: group.some((f) => f.clientSupplied === true)
        ? true
        : base.clientSupplied ?? null,
      technicalReservation: reservations.length ? reservations.join(' ; ') : null,
      reasons,
      mergedFactIds: distinct(group.map((f) => String(f.factId ?? ''))),
      mergedSources: distinct(group.map(sourceLabel)),
    });
  }

  return [...merged, ...passthrough];
};
