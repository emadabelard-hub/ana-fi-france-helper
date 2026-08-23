// ============================================================================
// btpFactsConsolidation
// Consolidation DÉTERMINISTE de plusieurs contrats de faits BTP validés
// (un contrat par document, ou par portion de document) en un contrat unique.
//
// Aucune intelligence artificielle n'intervient ici. Cette étape :
//  - conserve TOUS les faits de TOUS les documents (aucune fusion) ;
//  - n'additionne jamais deux quantités ;
//  - conserve la provenance de chaque fait (document, fichier, portion) ;
//  - préfixe les `factId` pour garantir leur unicité entre documents ;
//  - REMAPPE `coveredByFactId` avec la même table de correspondance, puis
//    vérifie que chaque relation pointe vers un `factId` réellement présent.
//
// `parentRef` est une référence temporaire d'avant validation : elle n'est plus
// utilisée comme relation après validation. La seule relation finale conservée
// est `coveredByFactId`.
// ============================================================================
import type { BtpFactsContract, ValidatedBtpFact } from "./btpFactsContract.ts";

/** Fait consolidé : fait validé + provenance ajoutée par le serveur. */
export type ConsolidatedBtpFact = ValidatedBtpFact & {
  /** Identifiant interne du document (ou document+portion) d'origine. */
  sourceDocId: string;
  /** Portion du document lorsque celui-ci a été subdivisé, sinon null. */
  sourcePart: string | null;
};

export type ConsolidatedBtpContract = {
  version: 1;
  facts: ConsolidatedBtpFact[];
  counts: { ready: number; pending: number; excluded: number; total: number };
  /** Diagnostics déterministes (relations neutralisées, recoupements). */
  notes: string[];
};

export type ContractEntry = {
  /** Identifiant du document (ou de la portion) : sert de préfixe. */
  docId: string;
  contract: BtpFactsContract | null;
  /** Portion d'origine lorsque le document a été subdivisé. */
  part?: string | null;
};

const prefixId = (docId: string, factId: string) => `${docId}_${factId}`;

/**
 * Consolide plusieurs contrats validés en un seul contrat.
 * Les contrats absents/nuls sont simplement ignorés (le document concerné est
 * signalé ailleurs par son `factsError`, jamais remplacé par un repli).
 */
export const consolidateBtpContracts = (
  entries: ContractEntry[],
): ConsolidatedBtpContract => {
  const facts: ConsolidatedBtpFact[] = [];
  const notes: string[] = [];

  for (const entry of entries) {
    const src = entry.contract;
    if (!src || !Array.isArray(src.facts) || src.facts.length === 0) continue;

    // 1. Table de correspondance ancien factId → nouveau factId, par document.
    const map = new Map<string, string>();
    for (const f of src.facts) {
      if (typeof f?.factId === "string" && f.factId) {
        map.set(f.factId, prefixId(entry.docId, f.factId));
      }
    }

    // 2. Réécriture des factId ET remapping des coveredByFactId.
    for (const f of src.facts) {
      const newId = map.get(f.factId) ?? prefixId(entry.docId, String(f.factId));
      const covered = f.coveredByFactId
        ? map.get(f.coveredByFactId) ?? null
        : null;
      if (f.coveredByFactId && !covered) {
        notes.push(
          `relation ignorée (parent absent du document ${entry.docId}) : ${f.factId} → ${f.coveredByFactId}`,
        );
      }
      facts.push({
        ...f,
        factId: newId,
        coveredByFactId: covered,
        sourceDocId: entry.docId,
        sourcePart: entry.part ?? null,
      });
    }
  }

  // 3. Contrôle d'intégrité global : toute relation doit pointer vers un
  //    factId réellement présent. Sinon elle est neutralisée et signalée,
  //    jamais rattachée arbitrairement à un autre fait.
  const present = new Set(facts.map((f) => f.factId));
  for (const f of facts) {
    if (f.coveredByFactId && !present.has(f.coveredByFactId)) {
      notes.push(
        `relation neutralisée (factId parent introuvable) : ${f.factId} → ${f.coveredByFactId}`,
      );
      f.coveredByFactId = null;
    }
  }

  // Indice de recoupement : plusieurs documents décrivant le même ouvrage.
  // Simple signalement, AUCUNE fusion et AUCUNE addition de quantités.
  const byLineKey = new Map<string, Set<string>>();
  for (const f of facts) {
    if (!f.lineKey) continue;
    const set = byLineKey.get(f.lineKey) ?? new Set<string>();
    set.add(f.sourceDocId);
    byLineKey.set(f.lineKey, set);
  }
  for (const [lineKey, docs] of byLineKey) {
    if (docs.size > 1) {
      notes.push(
        `même ouvrage décrit par plusieurs documents (${[...docs].join(", ")}) : lineKey ${lineKey} — sources conservées, aucune fusion`,
      );
    }
  }

  const counts = {
    ready: facts.filter((f) => f.transferStatus === "ready").length,
    pending: facts.filter((f) => f.transferStatus === "pending").length,
    excluded: facts.filter((f) => f.transferStatus === "excluded").length,
    total: facts.length,
  };

  return { version: 1, facts, counts, notes };
};

/** Sérialise le contrat consolidé pour l'étape d'analyse approfondie. */
export const serializeConsolidatedContract = (
  contract: ConsolidatedBtpContract,
): string => `<ANAFYPRO_BTP_FACTS>${JSON.stringify(contract)}</ANAFYPRO_BTP_FACTS>`;
