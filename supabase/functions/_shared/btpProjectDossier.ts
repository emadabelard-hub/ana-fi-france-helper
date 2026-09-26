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
import type { DocumentFactsResult, DocumentFactsStatus } from "./btpDocumentSequence.ts";

export type DossierDocumentStatus = DocumentFactsStatus | "missing";

export type DossierDocumentState = {
  index: number;
  docId: string | null;
  fileName: string | null;
  status: DossierDocumentStatus;
  attempts: number;
  factsCount: number;
  contributesFacts: boolean;
  error: string | null;
};

export type ProjectFactsDossier = {
  version: 1;
  complete: boolean;
  documents: DossierDocumentState[];
  missingDocuments: { index: number; fileName: string | null; status: DossierDocumentStatus }[];
  contract: ConsolidatedBtpContract;
};

export const buildProjectFactsDossier = (
  results: Array<DocumentFactsResult | null | undefined>,
): ProjectFactsDossier => {
  const documents: DossierDocumentState[] = results.map((r, index) => {
    if (!r) {
      return { index, docId: null, fileName: null, status: "missing", attempts: 0,
        factsCount: 0, contributesFacts: false, error: "Résultat du document absent." };
    }
    const contributes = r.status === "completed" && !!r.contract && r.contract.facts.length > 0;
    return {
      index, docId: r.docId, fileName: r.fileName, status: r.status, attempts: r.attempts,
      factsCount: contributes ? r.contract!.facts.length : 0,
      contributesFacts: contributes, error: r.error,
    };
  });

  // Préfixe unique par position : protège même si deux docId sont identiques.
  const contract = consolidateBtpContracts(
    results.map((r, index) => ({
      docId: r?.docId ? `d${index}_${r.docId}` : `d${index}`,
      contract: r && r.status === "completed" ? r.contract : null,
    })),
  );

  const missingDocuments = documents
    .filter((d) => !d.contributesFacts)
    .map((d) => ({ index: d.index, fileName: d.fileName, status: d.status }));

  return { version: 1, complete: missingDocuments.length === 0, documents, missingDocuments, contract };
};
