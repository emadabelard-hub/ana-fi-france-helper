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
