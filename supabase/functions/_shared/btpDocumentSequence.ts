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

/** Appel IA pour UN seul document. Retourne le texte brut de la réponse. */
export type SingleDocumentAiCall = (doc: ProjectDocument) => Promise<string>;

export class InvalidFactsContractError extends Error {}

/** Une relance maximum du même document. */
export const MAX_DOCUMENT_ATTEMPTS = 2;

// ---------------------------------------------------------------- budget IA
// Modèle : claude-sonnet-4-5 (voir _shared/anthropic-compat.ts).
/** Fenêtre de contexte du modèle (entrée + sortie), en tokens. */
export const MODEL_CONTEXT_TOKENS = 200_000;
/** Espace réservé à la réponse = max_tokens réellement envoyé par le worker. */
export const RESPONSE_MAX_TOKENS = 32_000;
/** Marge de sécurité : 15 % de la fenêtre ne sont jamais utilisés. */
export const CONTEXT_SAFETY_RATIO = 0.15;
/** Texte fixe ajouté autour du document (consignes, nom de fichier, balises). */
export const REQUEST_OVERHEAD_TOKENS = 1_000;
/** Coût maximal documenté d'une image (redimensionnée à ~1,15 Mpx ≈ 1 600 tokens), arrondi. */
export const IMAGE_TOKENS_MAX = 2_000;
/** Limite API Anthropic par image, appliquée à la chaîne base64 réellement envoyée. */
export const API_IMAGE_BASE64_LIMIT_BYTES = 5 * 1024 * 1024;
/** Marge sous la limite image : 10 %. */
export const IMAGE_SAFETY_RATIO = 0.10;

/** Budget d'entrée disponible pour la pièce + le prompt. */
export const inputTokenBudget = (): number =>
  Math.floor(MODEL_CONTEXT_TOKENS * (1 - CONTEXT_SAFETY_RATIO)) - RESPONSE_MAX_TOKENS;

/**
 * Estimation CONSERVATRICE (aucun tokenizer Claude officiel côté serveur) :
 * - caractère ASCII : 0,5 token (1 token pour 2 caractères ; un texte français
 *   courant fait plutôt 3 à 4 caractères/token, on surestime volontairement) ;
 * - caractère non ASCII (accents, arabe, symboles) : 1 token chacun.
 * L'estimation est toujours supérieure ou égale au réel attendu.
 */
export const estimateTokensConservative = (text: string): number => {
  let ascii = 0, other = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) ascii++; else other++;
  }
  return Math.ceil(ascii / 2) + other;
};

/** Taille réellement envoyée pour une image : la partie base64 de la data URL. */
export const imageBase64Length = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl.length : dataUrl.length - comma - 1;
};

export type SizeCheck = { ok: true; estimatedInputTokens: number } | { ok: false; reason: string };

export const checkDocumentFits = (doc: ProjectDocument, systemPrompt: string): SizeCheck => {
  if (typeof doc.dataUrl === "string") {
    const b64 = imageBase64Length(doc.dataUrl);
    const max = Math.floor(API_IMAGE_BASE64_LIMIT_BYTES * (1 - IMAGE_SAFETY_RATIO));
    if (b64 > max) {
      return { ok: false, reason: `Image trop volumineuse : ${b64} octets base64 envoyés > ${max} autorisés (limite API ${API_IMAGE_BASE64_LIMIT_BYTES} − 10 %).` };
    }
  }
  const tokens = estimateTokensConservative(systemPrompt)
    + REQUEST_OVERHEAD_TOKENS
    + (typeof doc.text === "string" ? estimateTokensConservative(doc.text) : 0)
    + (typeof doc.dataUrl === "string" ? IMAGE_TOKENS_MAX : 0);
  const budget = inputTokenBudget();
  if (tokens > budget) {
    return { ok: false, reason: `Document trop volumineux : ~${tokens} tokens estimés > budget ${budget} (fenêtre ${MODEL_CONTEXT_TOKENS} − 15 % − réponse ${RESPONSE_MAX_TOKENS}).` };
  }
  return { ok: true, estimatedInputTokens: tokens };
};

/** Compatibilité : vrai si le document ne tient pas dans un seul appel. */
export const documentNeedsChunking = (doc: ProjectDocument, systemPrompt = ""): boolean =>
  !checkDocumentFits(doc, systemPrompt).ok;

// ------------------------------------------------ erreur API de taille réelle
/** Levée quand l'API refuse la requête pour cause de taille/contexte. */
export class DocumentTooLargeError extends Error {}

const SIZE_ERROR_PATTERNS = [
  /prompt is too long/i,
  /too many (input )?tokens/i,
  /context (length|window)/i,
  /exceeds? (the )?(maximum|max) (context|token|prompt|request|image)/i,
  /image exceeds/i,
  /request[_ ]too[_ ]large/i,
  /maximum (allowed )?(request |image )?size/i,
];

/**
 * Seuls 413, et les 400 dont le message décrit explicitement un dépassement de
 * taille/contexte, sont des erreurs de taille. Tout autre 400 reste une erreur normale.
 */
export const isApiSizeLimitError = (status: number, bodyText: string): boolean => {
  if (status === 413) return true;
  if (status !== 400) return false;
  return SIZE_ERROR_PATTERNS.some((re) => re.test(bodyText || ""));
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
  systemPrompt = "",
): Promise<DocumentFactsResult> => {
  const base = { docId: doc.docId, fileName: doc.fileName };
  const fit = checkDocumentFits(doc, systemPrompt);
  if (!fit.ok) {
    return {
      ...base, status: "needs_chunking", attempts: 0, contract: null,
      error: `${fit.reason} Nécessite le futur traitement par portions (aucune troncature appliquée).`,
    };
  }
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_DOCUMENT_ATTEMPTS; attempt++) {
    try {
      const text = await callAi(doc);
      const contract = parseStrictFactsContract(typeof text === "string" ? text : "", doc.fileName);
      return { ...base, status: "completed", attempts: attempt, contract, error: null };
    } catch (e) {
      if (e instanceof DocumentTooLargeError) {
        // Refus de taille confirmé par l'API : aucune relance.
        return { ...base, status: "needs_chunking", attempts: attempt, contract: null,
          error: `Refus de taille par l'API : ${e.message} Nécessite le futur traitement par portions.` };
      }
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
  systemPrompt = "",
): Promise<DocumentFactsResult[]> => {
  const out: DocumentFactsResult[] = [];
  for (const doc of docs) {
    const done = existing[doc.docId];
    if (done) { out.push(done); continue; }
    const r = await processSingleDocument(doc, callAi, systemPrompt);
    out.push(r);
    if (onResult) await onResult(r);
  }
  return out;
};
