import type { ConsolidatedBtpContract } from "./btpFactsConsolidation.ts";

/** Contrôle de références uniquement : ne prouve ni l'exhaustivité ni la justesse sémantique. */
export type GlobalAnalysisAudit = {
  version: 1;
  citedFactIds: string[];
  unknownFactIds: string[];
  unreferencedFactIds: string[];
  duplicateFactIds: string[];
  orphanCoveredByFactIds: string[];
};

export function auditGlobalAnalysis(text: string, contract: ConsolidatedBtpContract): GlobalAnalysisAudit {
  const ids = contract.facts.map(f => f.factId);
  const known = new Set(ids);
  const candidates = new Set<string>();
  // Les identifiants produits par ANAFYPRO sont des tokens ASCII contenant btp_.
  // Lire le token ENTIER évite de créditer un ID valide inclus dans un faux ID.
  for (const match of text.matchAll(/[\p{L}\p{N}_-]+/gu)) {
    if (match[0].includes("btp_") || known.has(match[0])) candidates.add(match[0]);
  }
  // Forme de citation demandée au modèle : [factId], plusieurs IDs séparés par ; ou ,.
  // Ne pas traiter les autres crochets (ex. [ILLISIBLE]) comme des références.
  for (const match of text.matchAll(/\[([^\]\n]+)\]/g)) {
    for (const part of match[1].split(/[;,]/)) {
      const id = part.trim().replace(/^`|`$/g, "");
      if (known.has(id) || /^F\d+$/i.test(id) || /^[\w-]*btp_[\w-]+$/.test(id)) candidates.add(id);
    }
  }
  const citedFactIds = [...known].filter(id => candidates.has(id));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) { if (seen.has(id)) duplicates.add(id); seen.add(id); }
  return {
    version: 1,
    citedFactIds,
    unknownFactIds: [...candidates].filter(id => !known.has(id)).sort(),
    unreferencedFactIds: [...known].filter(id => !candidates.has(id)),
    duplicateFactIds: [...duplicates],
    orphanCoveredByFactIds: [...new Set(contract.facts
      .map(f => f.coveredByFactId).filter((id): id is string => !!id && !known.has(id)))],
  };
}