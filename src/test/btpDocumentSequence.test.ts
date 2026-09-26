import { describe, it, expect } from "vitest";
import {
  processDocumentsSequentially,
  processSingleDocument,
  inputTokenBudget,
  estimateTokensConservative,
  checkDocumentFits,
  isApiSizeLimitError,
  DocumentTooLargeError,
  API_IMAGE_BASE64_LIMIT_BYTES,
  type ProjectDocument,
} from "../../supabase/functions/_shared/btpDocumentSequence";
import { BTP_FACTUAL_EXTRACTION_PROMPT } from "../../supabase/functions/_shared/btpFactualPrompt";
import { readFileSync } from "node:fs";

const block = (facts: unknown[]) => `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ facts })}</ANAFYPRO_BTP_FACTS>`;
const f = (o: Record<string, unknown>) => ({ lot: "Lot 1", category: "travaux", sourcePage: 1, evidenceText: "x", ...o });
const doc = (n: number, text = `contenu ${n}`): ProjectDocument => ({ docId: `doc${n}`, fileName: `d${n}.pdf`, kind: "pdf", text });

describe("Analyser mon projet — étape 1 : document par document", () => {
  it("2 documents = 2 contrats indépendants, séquentiels, un document par appel", async () => {
    const seen: string[] = [];
    let inFlight = 0, maxInFlight = 0;
    const res = await processDocumentsSequentially([doc(1), doc(2)], async (d) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      seen.push(d.docId);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return block([f({ id: "A", descriptionExact: `Pose ${d.docId}`, quantity: 2, unit: "m²", role: "main" })]);
    });
    expect(seen).toEqual(["doc1", "doc2"]);
    expect(maxInFlight).toBe(1);
    expect(res.map((r) => r.status)).toEqual(["completed", "completed"]);
    expect(res[0].contract!.facts[0].sourceFile).toBe("d1.pdf");
    expect(res[1].contract!.facts[0].sourceFile).toBe("d2.pdf");
    expect(res[0].contract).not.toBe(res[1].contract);
  });

  it("une seule relance puis failed ; contrat illisible jamais accepté comme vide", async () => {
    let calls = 0;
    const r = await processSingleDocument(doc(1), async () => { calls++; return "pas de bloc"; });
    expect(calls).toBe(2);
    expect(r.status).toBe("failed");
    expect(r.contract).toBeNull();
    let c2 = 0;
    const r2 = await processSingleDocument(doc(1), async () => { c2++; return c2 === 1 ? "<ANAFYPRO_BTP_FACTS>{\"facts\":[" : block([f({ id: "A", descriptionExact: "Pose", quantity: 1, unit: "u" })]); });
    expect(r2.status).toBe("completed");
    expect(r2.attempts).toBe(2);
    const empty = await processSingleDocument(doc(1), async () => block([]));
    expect(empty.status).toBe("failed");
  });

  it("conserve factId / coveredByFactId", async () => {
    const r = await processSingleDocument(doc(1), async () => block([
      f({ id: "A", descriptionExact: "Installation système", quantity: 1, unit: "u", role: "main" }),
      f({ id: "B", descriptionExact: "Accessoire compris", role: "included_component", parentRef: "A" }),
    ]));
    const [main, child] = r.contract!.facts;
    expect(main.factId).toBeTruthy();
    expect(child.coveredByFactId).toBe(main.factId);
  });

  it("texte : budget de contexte réel (prompt + contenu + réponse + marge), sans appel ni troncature", async () => {
    const P = BTP_FACTUAL_EXTRACTION_PROMPT;
    expect(inputTokenBudget()).toBe(138_000); // 200 000 × 0,85 − 32 000
    expect(estimateTokensConservative("abcd")).toBe(2);
    expect(estimateTokensConservative("éé")).toBe(2);
    const room = inputTokenBudget() - estimateTokensConservative(P) - 1_000;
    expect(checkDocumentFits(doc(1, "a".repeat(room * 2)), P).ok).toBe(true);
    let calls = 0;
    const big = await processSingleDocument(doc(1, "a".repeat(room * 2 + 2)), async () => { calls++; return ""; }, P);
    expect(big.status).toBe("needs_chunking");
    expect(calls).toBe(0);
    // Moins de 300 000 caractères mais non ASCII (arabe) : refusé aussi.
    expect(checkDocumentFits(doc(1, "م".repeat(200_000)), P).ok).toBe(false);
    // Le prompt compte dans le budget.
    expect(checkDocumentFits(doc(1, "a".repeat(room * 2)), P + "x".repeat(10)).ok).toBe(false);
  });

  it("image : taille base64 réellement envoyée, marge 10 % sous 5 Mo, aucun appel si trop grosse", async () => {
    const max = Math.floor(API_IMAGE_BASE64_LIMIT_BYTES * 0.9);
    const img = (n: number): ProjectDocument => ({ docId: "i", fileName: "p.jpg", kind: "image", dataUrl: "data:image/jpeg;base64," + "A".repeat(n) });
    expect(checkDocumentFits(img(max), "").ok).toBe(true);
    let calls = 0;
    const r = await processSingleDocument(img(max + 1), async () => { calls++; return ""; });
    expect(r.status).toBe("needs_chunking");
    expect(r.error).toContain("Image trop volumineuse");
    expect(calls).toBe(0);
  });

  it("HTTP 400 de taille → needs_chunking sans relance ; autre 400 → erreur normale", async () => {
    expect(isApiSizeLimitError(400, '{"error":{"type":"invalid_request_error","message":"prompt is too long: 210000 tokens > 200000 maximum"}}')).toBe(true);
    expect(isApiSizeLimitError(400, "messages.0.content.1.image.source.base64: image exceeds 5 MB maximum")).toBe(true);
    expect(isApiSizeLimitError(413, "")).toBe(true);
    expect(isApiSizeLimitError(400, '{"error":{"message":"messages: roles must alternate"}}')).toBe(false);
    expect(isApiSizeLimitError(400, "temperature: must be between 0 and 1")).toBe(false);
    expect(isApiSizeLimitError(500, "prompt is too long")).toBe(false);
    let calls = 0;
    const r = await processSingleDocument(doc(1), async () => { calls++; throw new DocumentTooLargeError("HTTP 400: prompt is too long"); });
    expect(r.status).toBe("needs_chunking");
    expect(calls).toBe(1);
    let c2 = 0;
    const r2 = await processSingleDocument(doc(1), async () => { c2++; throw new Error("IA erreur 400: roles must alternate"); });
    expect(r2.status).toBe("failed");
    expect(c2).toBe(2);
    expect(r2.error).toContain("roles must alternate");
  });

  it("reprise : un document déjà traité n'est jamais rappelé", async () => {
    const first = await processSingleDocument(doc(1), async () => block([f({ id: "A", descriptionExact: "Pose", quantity: 1, unit: "u" })]));
    const seen: string[] = [];
    await processDocumentsSequentially([doc(1), doc(2)], async (d) => { seen.push(d.docId); return block([f({ id: "A", descriptionExact: "Pose", quantity: 1, unit: "u" })]); }, { doc1: first });
    expect(seen).toEqual(["doc2"]);
  });

  it("Prompt n°1 partagé = celui d'ai-assistant ; Smart Devis non branché", () => {
    const ai = readFileSync("supabase/functions/ai-assistant/index.ts", "utf8");
    expect(ai).toContain("finalSystemPrompt = BTP_FACTUAL_EXTRACTION_PROMPT;");
    expect(BTP_FACTUAL_EXTRACTION_PROMPT.startsWith("Tu es un moteur d'EXTRACTION DOCUMENTAIRE BTP strictement factuelle.")).toBe(true);
    const seq = readFileSync("supabase/functions/_shared/btpDocumentSequence.ts", "utf8");
    for (const w of ["consolidateBtpContracts", "mergeFactsForQuote", "buildDraftLinesFromFacts", "reformulate_btp_batch", "smart_devis_prefill_v1"]) expect(seq).not.toContain(w);
  });
});
