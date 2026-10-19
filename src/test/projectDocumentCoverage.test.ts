import { describe, it, expect, vi } from "vitest";
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, version: "x" }));
vi.mock("mammoth", () => ({ default: {} }));
import { planPdfPages, assemblePdf, docxHtmlToStructuredText, type PdfPageProbe } from "@/lib/projectDocumentIngest";
import { processSingleDocument, processDocumentsSequentially, checkDocumentFits, IMAGE_TOKENS_MAX, type ProjectDocument } from "../../supabase/functions/_shared/btpDocumentSequence";
import { buildProjectFactsDossier } from "../../supabase/functions/_shared/btpProjectDossier";

const txt = (n: number) => "Mur en béton armé épaisseur 20 cm. ".repeat(n);
const probe = (page: number, text: string, rasterImages = 0, vectorOps = 0): PdfPageProbe => ({ page, text, rasterImages, vectorOps });
const img = "data:image/jpeg;base64,AAAA";
const block = `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ facts: [{ id: "A", lot: "Lot 1", category: "travaux", sourcePage: 1, evidenceText: "x", descriptionExact: "Pose", quantity: 1, unit: "u" }] })}</ANAFYPRO_BTP_FACTS>`;

describe("PDF : couverture par page", () => {
  it("PDF texte : aucune image rendue, couverture complète", () => {
    const r = assemblePdf([probe(1, txt(10)), probe(2, txt(10))], new Map());
    expect(r.pageImages).toEqual([]);
    expect(r.coverage).toEqual({ totalPages: 2, textPages: [1, 2], imagePages: [], unreadPages: [] });
    expect(r.text).toContain("--- Page 2 ---");
  });
  it("PDF entièrement scanné (3 pages) : toutes les pages en image, rien de perdu", () => {
    const probes = [1, 2, 3].map((p) => probe(p, "", 1));
    const r = assemblePdf(probes, new Map([[1, img], [2, img], [3, img]]));
    expect(r.pageImages).toHaveLength(3);
    expect(r.coverage.imagePages).toEqual([1, 2, 3]);
    expect(r.coverage.unreadPages).toEqual([]);
    expect(r.text).toBe("");
  });
  it("PDF mixte : texte gardé, page scannée en image, page non rendue signalée", () => {
    const r = assemblePdf([probe(1, txt(10)), probe(2, "", 1), probe(3, "", 1)], new Map([[2, img], [3, null]]));
    expect(r.coverage.textPages).toEqual([1]);
    expect(r.coverage.imagePages).toEqual([2]);
    expect(r.coverage.unreadPages).toEqual([3]);
  });
  it("PDF avec plan vectoriel et tableau tracé : rendu visuel même si du texte existe", () => {
    const plans = planPdfPages([probe(1, txt(10), 0, 400), probe(2, txt(10), 0, 10)]);
    expect(plans.map((p) => p.needsImage)).toEqual([true, false]);
    expect(plans.every((p) => p.sendText)).toBe(true);
  });
});

describe("DOCX : contenu intégral et tableaux", () => {
  it("DOCX volumineux : plus de 50 000 caractères conservés", () => {
    const html = Array.from({ length: 3000 }, (_, i) => `<p>Paragraphe ${i} ${"x".repeat(20)}</p>`).join("");
    const t = docxHtmlToStructuredText(html);
    expect(t.length).toBeGreaterThan(50_000);
    expect(t).toContain("Paragraphe 2999");
  });
  it("DOCX avec tableaux : lignes, colonnes et en-têtes associés, ordre conservé", () => {
    const html = `<p>Avant</p><table><tr><td>Désignation</td><td>Qté</td><td>PU</td></tr><tr><td>Cloison BA13</td><td>25</td><td>48</td></tr><tr><td></td><td>3</td><td>10</td></tr></table><p>Après</p>`;
    const t = docxHtmlToStructuredText(html).split("\n");
    expect(t[0]).toBe("Avant");
    expect(t).toContain("Ligne 1 : | Désignation = Cloison BA13 | Qté = 25 | PU = 48 |");
    expect(t).toContain("Ligne 2 : | Désignation =  | Qté = 3 | PU = 10 |");
    expect(t[t.length - 1]).toBe("Après");
  });
});

describe("Intégrité du dossier", () => {
  it("document illisible : conservé, failed sans appel IA, dossier incomplet", async () => {
    let calls = 0;
    const r = await processSingleDocument({ docId: "d", fileName: "x.pdf", kind: "pdf", unreadable: true }, async () => { calls++; return block; });
    expect(calls).toBe(0);
    expect(r.status).toBe("failed");
    expect(buildProjectFactsDossier([r]).complete).toBe(false);
  });
  it("lecture partielle : faits gardés, mais dossier jamais déclaré complet", async () => {
    const doc: ProjectDocument = { docId: "d", fileName: "m.pdf", kind: "pdf", text: txt(10), coverage: { totalPages: 3, textPages: [1], imagePages: [2], unreadPages: [3] } };
    const r = await processSingleDocument(doc, async () => block);
    expect(r.status).toBe("completed");
    const d = buildProjectFactsDossier([r]);
    expect(d.contract.counts.total).toBe(1);
    expect(d.complete).toBe(false);
    expect(d.missingDocuments).toEqual([{ index: 0, fileName: "m.pdf", status: "completed", partial: true, unreadPages: [3] }]);
  });
  it("chaque image de page compte dans le budget ; image trop grosse refusée avant appel", () => {
    const base: ProjectDocument = { docId: "d", fileName: "p.pdf", kind: "pdf", text: "a" };
    const one = checkDocumentFits({ ...base, pageImages: [img] }, "").estimatedInputTokens!;
    const three = checkDocumentFits({ ...base, pageImages: [img, img, img] }, "").estimatedInputTokens!;
    expect(three - one).toBe(2 * IMAGE_TOKENS_MAX);
    expect(checkDocumentFits({ ...base, pageImages: [img, "data:image/jpeg;base64," + "A".repeat(5 * 1024 * 1024)] }, "").ok).toBe(false);
  });
  it("plusieurs documents : tous conservés dans l'ordre, un appel par document lisible", async () => {
    const seen: string[] = [];
    const docs: ProjectDocument[] = [
      { docId: "1", fileName: "a.pdf", kind: "pdf", text: txt(5) },
      { docId: "2", fileName: "b.docx", kind: "docx", unreadable: true },
      { docId: "3", fileName: "c.jpg", kind: "image", dataUrl: img },
    ];
    const res = await processDocumentsSequentially(docs, async (d) => { seen.push(d.docId); return block; });
    expect(seen).toEqual(["1", "3"]);
    expect(res.map((r) => r.fileName)).toEqual(["a.pdf", "b.docx", "c.jpg"]);
    expect(buildProjectFactsDossier(res).missingDocuments.map((m) => m.fileName)).toEqual(["b.docx"]);
  });
});
