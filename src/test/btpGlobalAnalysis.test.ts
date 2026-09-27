import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validateBtpFacts } from "../../supabase/functions/_shared/btpFactsContract";
import { buildProjectFactsDossier } from "../../supabase/functions/_shared/btpProjectDossier";
import {
  BTP_GLOBAL_ANALYSIS_PROMPT,
  buildGlobalAnalysisMessages,
  runGlobalAnalysis,
  type GlobalAnalysisMessages,
} from "../../supabase/functions/_shared/btpGlobalAnalysisPrompt";
import type { DocumentFactsResult } from "../../supabase/functions/_shared/btpDocumentSequence";

const base = (file: string, over: Record<string, unknown>) => ({
  sourceFile: file, sourcePage: 1, lot: "Lot 1", category: "travaux", evidenceText: "extrait", ...over,
});
const raw = (file: string) => [
  base(file, { id: "A", descriptionExact: "Installation d'un système", quantity: 1, unit: "u", role: "main" }),
  base(file, { id: "c1", descriptionExact: "Raccordement compris", quantity: 1, unit: "u", role: "included_component", parentRef: "A" }),
];
const ok = (docId: string, file: string): DocumentFactsResult => ({
  docId, fileName: file, status: "completed", attempts: 1, contract: validateBtpFacts(raw(file)), error: null,
});
const ORIGINAL_TEXT = "CONTENU ORIGINAL SECRET DU DOCUMENT 7788";
const withOriginal = (r: DocumentFactsResult) => ({ ...r, text: ORIGINAL_TEXT, dataUrl: "data:image/png;base64,QUJD" } as any);

const dossierIncomplete = () => buildProjectFactsDossier([
  withOriginal(ok("a", "a.pdf")),
  { docId: "b", fileName: "b.pdf", status: "failed", attempts: 2, contract: null, error: "x" },
  { docId: "c", fileName: "c.pdf", status: "needs_chunking", attempts: 0, contract: null, error: "trop grand" },
  undefined,
]);

const capture = async (d = dossierIncomplete()) => {
  const calls: GlobalAnalysisMessages[] = [];
  const res = await runGlobalAnalysis(d, async (m) => { calls.push(m); return "1. RÉSUMÉ DU PROJET ..."; });
  return { d, calls, res, user: calls[0][1].content };
};

describe("Analyse globale (Prompt n°2)", () => {
  it("reçoit le dossier consolidé, jamais les documents originaux", async () => {
    const { user, calls } = await capture();
    expect(user).toContain("<ANAFYPRO_BTP_FACTS>");
    expect(user).not.toContain(ORIGINAL_TEXT);
    expect(JSON.stringify(calls)).not.toContain("image_url");
    expect(JSON.stringify(calls)).not.toContain("QUJD");
  });
  it("un seul appel IA", async () => {
    expect((await capture()).calls).toHaveLength(1);
  });
  it("complete=false et documents non exploités transmis", async () => {
    const { user, res } = await capture();
    expect(user).toContain("complete = false");
    expect(user).toContain("DOSSIER DOCUMENTAIRE INCOMPLET");
    for (const s of ['"failed"', '"needs_chunking"', '"missing"', "b.pdf", "c.pdf"]) expect(user).toContain(s);
    expect(res.complete).toBe(false);
    expect(res.missingDocuments.map((m) => m.status)).toEqual(["failed", "needs_chunking", "missing"]);
  });
  it("complete=true transmis", async () => {
    const { user } = await capture(buildProjectFactsDossier([ok("a", "a.pdf")]));
    expect(user).toContain("complete = true");
  });
  it("prompt système = exactement le module partagé, fidèle au texte fourni", async () => {
    const { calls } = await capture();
    expect(calls[0][0]).toEqual({ role: "system", content: BTP_GLOBAL_ANALYSIS_PROMPT });
    expect(BTP_GLOBAL_ANALYSIS_PROMPT.startsWith("RÔLE")).toBe(true);
    expect(BTP_GLOBAL_ANALYSIS_PROMPT).toContain("CE QUI N'EST PAS DANS LES FAITS N'EST PAS DANS LE PROJET.");
    expect(BTP_GLOBAL_ANALYSIS_PROMPT).not.toContain("IMPLÉMENTATION ANAFYPRO");
  });
  it("factId et coveredByFactId transmis sans modification", async () => {
    const { d, user } = await capture();
    const sent = JSON.parse(user.split("<ANAFYPRO_BTP_FACTS>")[1].split("</ANAFYPRO_BTP_FACTS>")[0]);
    expect(sent).toEqual(d.contract);
    expect(sent.facts[1].coveredByFactId).toBe(d.contract.facts[0].factId);
  });
  it("dossier non modifié et stocké séparément de l'analyse", async () => {
    const d = dossierIncomplete();
    const before = JSON.stringify(d);
    const { res } = await capture(d);
    expect(JSON.stringify(d)).toBe(before);
    expect(res).not.toHaveProperty("contract");
    const src = readFileSync("supabase/functions/btp-analysis-job/index.ts", "utf8");
    expect(src).toContain("_step: 'dossier'");
    expect(src).toContain("_step: 'global_analysis'");
  });
  it("réponse vide = erreur (jamais une analyse vide valide)", async () => {
    await expect(runGlobalAnalysis(dossierIncomplete(), async () => "  ")).rejects.toThrow();
  });
  it("aucun élément Smart Devis appelé", () => {
    for (const f of ["supabase/functions/_shared/btpGlobalAnalysisPrompt.ts", "supabase/functions/btp-analysis-job/index.ts"]) {
      const src = readFileSync(f, "utf8");
      for (const k of ["mergeFactsForQuote", "buildDraftLinesFromFacts", "reformulate_btp_batch", "smart_devis_prefill_v1"]) expect(src).not.toContain(k);
    }
    expect(buildGlobalAnalysisMessages).toBeTypeOf("function");
  });
});

import { checkGlobalAnalysisFits } from "../../supabase/functions/_shared/btpGlobalAnalysisPrompt";
import {
  inputTokenBudget, DocumentTooLargeError, isApiSizeLimitError, estimateTokensConservative, REQUEST_OVERHEAD_TOKENS,
} from "../../supabase/functions/_shared/btpDocumentSequence";

const bigDossier = (n: number, descLen: number) => {
  const facts = Array.from({ length: n }, (_, i) => base("gros.pdf", {
    id: `F${i}`, descriptionExact: `Prestation ${i} ` + "x".repeat(descLen), quantity: i + 1, unit: "u", role: "main",
  }));
  return buildProjectFactsDossier([{ docId: "g", fileName: "gros.pdf", status: "completed", attempts: 1, contract: validateBtpFacts(facts), error: null }]);
};

describe("Analyse globale — contrôle de taille", () => {
  it("compte Prompt n°2 + métadonnées + contrat + surcoût, même calcul que l'étape 1", () => {
    const d = dossierIncomplete();
    const m = buildGlobalAnalysisMessages(d);
    const expected = estimateTokensConservative(m[0].content) + estimateTokensConservative(m[1].content) + REQUEST_OVERHEAD_TOKENS;
    expect(checkGlobalAnalysisFits(m)).toEqual({ ok: true, estimatedInputTokens: expected });
    expect(inputTokenBudget()).toBe(138_000);
  });
  it("dossier trop volumineux : aucun appel, statut needs_chunking, faits intacts", async () => {
    const d = bigDossier(400, 1200);
    const before = JSON.stringify(d);
    let calls = 0;
    const r = await runGlobalAnalysis(d, async () => { calls++; return "x"; });
    expect(calls).toBe(0);
    expect(r.status).toBe("needs_chunking");
    expect(r.text).toBeNull();
    expect(r.estimatedInputTokens!).toBeGreaterThan(inputTokenBudget());
    expect(r.factsCount).toBe(400);
    expect(JSON.stringify(d)).toBe(before);
  });
  it("dossier sous le budget : appel effectué", async () => {
    const d = bigDossier(20, 200);
    let calls = 0;
    const r = await runGlobalAnalysis(d, async () => { calls++; return "ok"; });
    expect(calls).toBe(1);
    expect(r.status).toBe("completed");
  });
  it("dépassement signalé par l'API : needs_chunking, un seul appel, pas de relance", async () => {
    let calls = 0;
    const r = await runGlobalAnalysis(dossierIncomplete(), async () => { calls++; throw new DocumentTooLargeError("HTTP 413"); });
    expect(calls).toBe(1);
    expect(r.status).toBe("needs_chunking");
  });
  it("autre erreur (400 ordinaire) : propagée comme erreur normale, pas needs_chunking", async () => {
    await expect(runGlobalAnalysis(dossierIncomplete(), async () => { throw new Error("IA erreur 400: invalid field"); })).rejects.toThrow("400");
    expect(isApiSizeLimitError(400, '{"error":{"message":"temperature: invalid value"}}')).toBe(false);
    expect(isApiSizeLimitError(400, "prompt is too long: 250000 tokens > 200000 maximum")).toBe(true);
    expect(isApiSizeLimitError(413, "")).toBe(true);
  });
  it("le serveur convertit les dépassements API en DocumentTooLargeError pour l'analyse globale", () => {
    const src = readFileSync("supabase/functions/btp-analysis-job/index.ts", "utf8");
    const fn = src.slice(src.indexOf("async function callGlobalAnalysis"), src.indexOf("/** Un seul document"));
    expect(fn).toContain("isApiSizeLimitError(resp.status, full)) throw new DocumentTooLargeError");
  });
});
