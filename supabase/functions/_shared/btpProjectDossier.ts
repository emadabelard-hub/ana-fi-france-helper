/**
 * « Analyser mon projet » — Étape 2 : dossier factuel consolidé.
 *
 * Contrats indépendants (project_docs_facts) → consolidateBtpContracts → dossier.
 * 100 % déterministe, aucun appel IA, aucune fusion (pas de mergeFactsForQuote).
 * Seuls les documents "completed" fournissent des faits ; les autres restent
 * visibles dans `documents` et rendent le dossier incomplet.
 */
import {
  consolidateBtpContracts,
  type ConsolidatedBtpContract,
} from "./btpFactsConsolidation.ts";
import { evaluateDossierReliability, type DossierReliability } from "./btpProjectReportGate.ts";
import { isPartiallyCovered, type DocumentFactsResult, type DocumentFactsStatus } from "./btpDocumentSequence.ts";

export type DossierDocumentStatus = DocumentFactsStatus | "missing";

export type DossierDocumentState = {
  index: number;
  docId: string | null;
  fileName: string | null;
  status: DossierDocumentStatus;
  attempts: number;
  factsCount: number;
  contributesFacts: boolean;
  /** Traitement réussi mais une partie du document n'a pas été transmise. */
  partial: boolean;
  unreadPages: number[];
  untransmittedMedia?: number;
  structureIssues?: string[];
  error: string | null;
  /** Bilan de validation des faits (null pour les résultats antérieurs sans bilan). */
  validation: { received: number; accepted: number; rejected: number; withAnomalies: number; partial: boolean;
    sourceChecks: Record<string, number> } | null;
};

export type ProjectFactsDossier = {
  version: 1;
  complete: boolean;
  documents: DossierDocumentState[];
  missingDocuments: { index: number; fileName: string | null; status: DossierDocumentStatus; partial?: boolean; unreadPages?: number[]; untransmittedMedia?: number; rejectedEntries?: number }[];
  /** Niveaux de complétude distincts (aucune exhaustivité IA n'est revendiquée). */
  completeness: {
    transmitted: number; technicallyRead: number; extractionCompleted: number;
    factsFullyValidated: number; dossierBuilt: true; exhaustivenessProven: false;
  };
  contract: ConsolidatedBtpContract;
  /** Fiabilité documentaire (P0), distincte de la complétude technique `complete`. */
  reliability?: DossierReliability;
};

export const buildProjectFactsDossier = (
  results: Array<DocumentFactsResult | null | undefined>,
): ProjectFactsDossier => {
  const documents: DossierDocumentState[] = results.map((r, index) => {
    if (!r) {
      return { index, docId: null, fileName: null, status: "missing", attempts: 0,
        factsCount: 0, contributesFacts: false, partial: false, unreadPages: [], error: "Résultat du document absent.", validation: null };
    }
    const contributes = r.status === "completed" && !!r.contract && r.contract.facts.length > 0;
    return {
      index, docId: r.docId, fileName: r.fileName, status: r.status, attempts: r.attempts,
      factsCount: contributes ? r.contract!.facts.length : 0,
      contributesFacts: contributes,
      partial: isPartiallyCovered(r.coverage),
      unreadPages: isPartiallyCovered(r.coverage) ? [...(r.coverage!.unreadPages ?? [])] : [],
      ...(r.coverage?.untransmittedMedia ? { untransmittedMedia: r.coverage.untransmittedMedia } : {}),
      ...(r.coverage?.structureIssues?.length ? { structureIssues: [...r.coverage.structureIssues] } : {}),
      error: r.error,
      validation: r.integrity ? {
        received: r.integrity.received, accepted: r.integrity.accepted, rejected: r.integrity.rejected,
        withAnomalies: r.integrity.withAnomalies, partial: r.integrity.partial, sourceChecks: r.integrity.sourceChecks,
      } : null,
    };
  });

  // Préfixe unique par position : protège même si deux docId sont identiques.
  const contract = consolidateBtpContracts(
    results.map((r, index) => ({
      docId: r?.docId ? `d${index}_${r.docId}` : `d${index}`,
      contract: r && r.status === "completed" ? r.contract : null,
      fileName: r?.fileName ?? null,
      auxiliary: r && r.status === "completed" ? r.integrity?.auxiliary : undefined,
      rejectedEntries: r && r.status === "completed" ? r.integrity?.rejectedEntries : undefined,
    })),
  );

  const missingDocuments = documents
    .filter((d) => !d.contributesFacts || d.partial || !!d.validation?.partial)
    .map((d) => ({
      index: d.index, fileName: d.fileName, status: d.status,
      ...(d.partial ? { partial: true, unreadPages: d.unreadPages } : {}),
      ...(d.untransmittedMedia ? { untransmittedMedia: d.untransmittedMedia } : {}),
      ...(d.contributesFacts && d.validation?.partial ? { rejectedEntries: d.validation.rejected } : {}),
    }));

  const completeness = {
    transmitted: documents.filter((d) => d.status !== "missing").length,
    technicallyRead: documents.filter((d) => d.status !== "missing" && !d.partial && d.status !== "needs_chunking"
      && !(d.status === "failed" && d.attempts === 0)).length,
    extractionCompleted: documents.filter((d) => d.status === "completed").length,
    factsFullyValidated: documents.filter((d) => d.contributesFacts && !d.validation?.partial).length,
    dossierBuilt: true as const,
    exhaustivenessProven: false as const,
  };

  const complete = missingDocuments.length === 0;
  const reliability = evaluateDossierReliability({ complete, contract, documents });
  return { version: 1, complete, documents, missingDocuments, completeness, contract, reliability };
};
