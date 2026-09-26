/**
 * « Analyser mon projet » — Étape 1 : traitement document par document.
 *
 * Un document = un appel IA (Prompt n°1 factuel) → contrat BtpFactsContract
 * validé → résultat conservé. Strictement séquentiel, jamais multi-documents.
 * Aucune consolidation ici (étape ultérieure).
 */
import {
  parseFactsBlock,
  validateBtpFacts,
  type BtpFactsContract,
} from "./btpFactsContract.ts";

export type ProjectDocument = {
  docId: string;
  fileName: string;
  kind: "image" | "pdf" | "docx" | "text";
  /** Couche texte (pdf/docx/texte). */
  text?: string;
  /** Image encodée (data URL). */
  dataUrl?: string;
};

export type DocumentFactsStatus = "completed" | "failed" | "needs_chunking";

export type DocumentFactsResult = {
  docId: string;
  fileName: string;
  status: DocumentFactsStatus;
  attempts: number;
  contract: BtpFactsContract | null;
  error: string | null;
};

/** Au-delà, le document relève du futur traitement par portions : jamais tronqué. */
export const MAX_DOCUMENT_TEXT_CHARS = 300_000;
export const MAX_DOCUMENT_IMAGE_CHARS = 14_000_000;
/** Une relance maximum du même document. */
export const MAX_DOCUMENT_ATTEMPTS = 2;

/** Appel IA pour UN seul document. Retourne le texte brut de la réponse. */
export type SingleDocumentAiCall = (doc: ProjectDocument) => Promise<string>;

export class InvalidFactsContractError extends Error {}

export const documentNeedsChunking = (doc: ProjectDocument): boolean => {
  if (typeof doc.text === "string" && doc.text.length > MAX_DOCUMENT_TEXT_CHARS) return true;
  if (typeof doc.dataUrl === "string" && doc.dataUrl.length > MAX_DOCUMENT_IMAGE_CHARS) return true;
  return false;
};

/**
 * Lecture stricte : bloc présent et fermé, JSON lisible, tableau facts présent,
 * au moins un fait valide. Un contrat absent/illisible/vide lève une erreur —
 * il ne devient jamais silencieusement un contrat vide valide.
 */
export const parseStrictFactsContract = (text: string, fileName: string): BtpFactsContract => {
  const open = text.indexOf("<ANAFYPRO_BTP_FACTS>");
  const close = text.indexOf("</ANAFYPRO_BTP_FACTS>");
  if (open === -1) throw new InvalidFactsContractError("Bloc <ANAFYPRO_BTP_FACTS> absent.");
  if (close === -1 || close < open) throw new InvalidFactsContractError("Bloc <ANAFYPRO_BTP_FACTS> non fermé (réponse tronquée).");
  const inner = text.slice(open + "<ANAFYPRO_BTP_FACTS>".length, close);
  const s = inner.indexOf("{");
  const e = inner.lastIndexOf("}");
  let parsed: any;
  try {
    parsed = JSON.parse(inner.slice(s, e + 1));
  } catch {
    throw new InvalidFactsContractError("JSON du contrat illisible.");
  }
  if (!parsed || !Array.isArray(parsed.facts)) throw new InvalidFactsContractError("Tableau facts absent.");

  // Provenance : chaque fait est rattaché à son document si l'IA ne l'a pas précisé.
  const raw = parseFactsBlock(text).map((f: any) =>
    f && typeof f === "object" && !f.sourceFile ? { ...f, sourceFile: fileName } : f,
  );
  const contract = validateBtpFacts(raw);
  if (contract.facts.length === 0) throw new InvalidFactsContractError("Contrat vide.");
  return contract;
};

/** Traite UN document : un appel, une seule relance, puis failed. */
export const processSingleDocument = async (
  doc: ProjectDocument,
  callAi: SingleDocumentAiCall,
): Promise<DocumentFactsResult> => {
  const base = { docId: doc.docId, fileName: doc.fileName };
  if (documentNeedsChunking(doc)) {
    return {
      ...base, status: "needs_chunking", attempts: 0, contract: null,
      error: "Document trop volumineux : nécessite le futur traitement par portions (aucune troncature appliquée).",
    };
  }
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_DOCUMENT_ATTEMPTS; attempt++) {
    try {
      const text = await callAi(doc);
      const contract = parseStrictFactsContract(typeof text === "string" ? text : "", doc.fileName);
      return { ...base, status: "completed", attempts: attempt, contract, error: null };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ...base, status: "failed", attempts: MAX_DOCUMENT_ATTEMPTS, contract: null, error: lastError };
};

/**
 * Traite les documents l'un après l'autre (await dans la boucle : jamais en
 * parallèle). `existing` permet la reprise : un document déjà traité n'est
 * jamais rappelé.
 */
export const processDocumentsSequentially = async (
  docs: ProjectDocument[],
  callAi: SingleDocumentAiCall,
  existing: Record<string, DocumentFactsResult> = {},
  onResult?: (r: DocumentFactsResult) => Promise<void> | void,
): Promise<DocumentFactsResult[]> => {
  const out: DocumentFactsResult[] = [];
  for (const doc of docs) {
    const done = existing[doc.docId];
    if (done) { out.push(done); continue; }
    const r = await processSingleDocument(doc, callAi);
    out.push(r);
    if (onResult) await onResult(r);
  }
  return out;
};
