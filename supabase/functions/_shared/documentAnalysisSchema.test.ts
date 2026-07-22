// Deno tests for the shared document analysis schema.
// No API calls — pure normalization / validation logic.
import { assertEquals, assert, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizeItem,
  normalizeAnalysisPayload,
  normalizeUnit,
  DOCUMENT_ANALYSIS_ERROR_CODE,
} from "./documentAnalysisSchema.ts";

Deno.test("A — ligne complète imprimée → high confidence, no review", () => {
  const it = normalizeItem({
    designation_fr: "Peinture murs salon",
    designation_ar: "دهان الحوائط",
    quantity: 12,
    unit: "m²",
    unitPrice: 45,
    lot: "LOT — PEINTURE ET ENDUITS",
    source: { fileName: "devis.pdf", pageNumber: 1, sourceText: "Peinture murs 12 m² à 45 €" },
    fieldConfidences: { designation: "high", quantity: "high", unit: "high", unitPrice: "high", lot: "high", source: "high" },
  }, "devis.pdf");
  assert(it);
  assertEquals(it!.quantity, 12);
  assertEquals(it!.unit, "m²");
  assertEquals(it!.unitPrice, 45);
  assertEquals(it!.confidence, "high");
  assertEquals(it!.requiresReview, false);
});

Deno.test("B — quantité absente → null + review", () => {
  const it = normalizeItem({
    designation_fr: "Pose de carrelage",
    designation_ar: "",
    unit: "m²",
    unitPrice: 30,
    lot: "LOT — CARRELAGE ET FAÏENCE",
    fieldConfidences: { designation: "high", unit: "high", unitPrice: "high", lot: "high" },
    source: { fileName: "doc.pdf", pageNumber: 2, sourceText: "Pose carrelage" },
  }, "doc.pdf");
  assert(it);
  assertEquals(it!.quantity, null);
  assertEquals(it!.fieldConfidences.quantity, "unknown");
  assert(it!.requiresReview);
  assert(it!.reviewReasons.some((r) => r.toLowerCase().includes("quantité")));
});

Deno.test("C — prix absent → null, aucun prix inventé, confiance globale non dégradée par unitPrice", () => {
  const it = normalizeItem({
    designation_fr: "Plâtrerie plafond",
    designation_ar: "",
    quantity: 20,
    unit: "m²",
    lot: "LOT — PEINTURE ET ENDUITS",
    fieldConfidences: { designation: "high", quantity: "high", unit: "high", lot: "high" },
    source: { fileName: "cctp.pdf", pageNumber: 3, sourceText: "Plafond 20 m²" },
  }, "cctp.pdf");
  assert(it);
  assertEquals(it!.unitPrice, null);
  assertEquals(it!.fieldConfidences.unitPrice, "unknown");
  // Global confidence should stay high because price was not claimed
  assertEquals(it!.confidence, "high");
});

Deno.test("D — unité ambiguë → normalisée si évidente", () => {
  assertEquals(normalizeUnit("M2").value, "m²");
  assertEquals(normalizeUnit("m.l.").value, "ml");
  assertEquals(normalizeUnit("pièce").value, "u");
  assertEquals(normalizeUnit("Fft").value, "forfait");
  // Ambiguous → kept lowercase, not normalized
  const amb = normalizeUnit("boite");
  assertEquals(amb.normalized, false);
});

Deno.test("E — ligne manuscrite difficile → low + review obligatoire", () => {
  const it = normalizeItem({
    designation_fr: "Reprise enduit facade",
    designation_ar: "",
    quantity: 5,
    unit: "m²",
    unitPrice: 22,
    lot: null,
    fieldConfidences: { designation: "low", quantity: "low", unit: "medium", unitPrice: "low", lot: "unknown", source: "low" },
    reviewReasons: ["Écriture manuscrite partiellement illisible"],
    requiresReview: true,
    source: { fileName: "notes.jpg", pageNumber: null, sourceText: "reprise enduit" },
  }, "notes.jpg");
  assert(it);
  assertEquals(it!.confidence, "low");
  assert(it!.requiresReview);
  assert(it!.reviewReasons.some((r) => r.toLowerCase().includes("manuscrit")));
});

Deno.test("F — note technique sans désignation → ligne écartée", () => {
  const it = normalizeItem({
    designation_fr: "",
    designation_ar: "",
    technicalDescription: "Prévoir accès à la toiture depuis balcon nord",
  }, "doc.pdf");
  assertEquals(it, null);
});

Deno.test("G — payload sans tableau items → schema error", () => {
  assertThrows(
    () => normalizeAnalysisPayload({ subject: "test" }, {}),
    Error,
    DOCUMENT_ANALYSIS_ERROR_CODE,
  );
});

Deno.test("H — ancien format (quantity=1, unit='u', unitPrice=0, lot=NETTOYAGE ET DIVERS) sans confidences → dégradé + review", () => {
  const it = normalizeItem({
    designation_fr: "Divers",
    designation_ar: "",
    quantity: 1,
    unit: "u",
    unitPrice: 0,
    lot: "LOT — NETTOYAGE ET DIVERS",
  }, "legacy.pdf");
  assert(it);
  // Quantity kept but no explicit confidence → medium
  assertEquals(it!.quantity, 1);
  assertEquals(it!.fieldConfidences.quantity, "medium");
  // Price 0 was provided so kept, but no fabricated
  assertEquals(it!.unitPrice, 0);
  // Legacy fallback lot flagged low + review
  assertEquals(it!.fieldConfidences.lot, "low");
  assert(it!.requiresReview);
  assert(it!.reviewReasons.some((r) => r.toLowerCase().includes("lot")));
});

Deno.test("H2 — ancien format prix absent (unitPrice undefined) → null, pas d'invention", () => {
  const it = normalizeItem({
    designation_fr: "Pose plinthes",
    designation_ar: "",
    quantity: 10,
    unit: "ml",
  }, "legacy.pdf");
  assert(it);
  assertEquals(it!.unitPrice, null);
  assertEquals(it!.fieldConfidences.unitPrice, "unknown");
});

Deno.test("normalizeAnalysisPayload — items partiels acceptés, stubs ignorés", () => {
  const res = normalizeAnalysisPayload({
    subject: "Rénovation",
    items: [
      { designation_fr: "Peinture", quantity: 10, unit: "m²", unitPrice: 25, source: { sourceText: "ok" } },
      { designation_fr: "", designation_ar: "" }, // ignored
    ],
    warnings: ["Zone 3 illisible"],
  }, { fileName: "test.pdf" });
  assertEquals(res.items.length, 1);
  assertEquals(res.subject, "Rénovation");
  assertEquals(res.warnings[0], "Zone 3 illisible");
});

// ─── P3 — Routeur documentaire ────────────────────────────────────────────
Deno.test("P3-1 — devis reconnu", () => {
  const r = normalizeAnalysisPayload({
    documentType: "devis",
    documentCategory: "commercial",
    confidenceDocumentType: "high",
    documentTypeReason: "Présence d'un tableau de prix et d'un total HT.",
    items: [{ designation_fr: "Peinture", quantity: 10, unit: "m²", unitPrice: 25 }],
  }, {});
  assertEquals(r.documentType, "devis");
  assertEquals(r.documentCategory, "commercial");
  assertEquals(r.confidenceDocumentType, "high");
  assert(r.documentTypeReason!.toLowerCase().includes("prix"));
});

Deno.test("P3-2 — facture fournisseur", () => {
  const r = normalizeAnalysisPayload({
    documentType: "facture_fournisseur",
    confidenceDocumentType: "high",
    documentTypeReason: "En-tête fournisseur + numéro de facture.",
    items: [],
  }, {});
  assertEquals(r.documentType, "facture_fournisseur");
  assertEquals(r.documentCategory, "commercial");
});

Deno.test("P3-3 — CCTP", () => {
  const r = normalizeAnalysisPayload({
    documentType: "cctp",
    confidenceDocumentType: "high",
    documentTypeReason: "Mentions CCTP explicites.",
    items: [],
  }, {});
  assertEquals(r.documentType, "cctp");
  assertEquals(r.documentCategory, "technique");
});

Deno.test("P3-4 — DPGF", () => {
  const r = normalizeAnalysisPayload({
    documentType: "dpgf",
    confidenceDocumentType: "medium",
    documentTypeReason: "Décomposition du prix global et forfaitaire.",
    items: [],
  }, {});
  assertEquals(r.documentType, "dpgf");
  assertEquals(r.documentCategory, "technique");
});

Deno.test("P3-5 — plan (alias 'plan')", () => {
  const r = normalizeAnalysisPayload({
    documentType: "plan_architecte",
    confidenceDocumentType: "high",
    documentTypeReason: "Vue en plan cotée d'un logement.",
    items: [],
  }, {});
  assertEquals(r.documentType, "plan_architecte");
  assertEquals(r.documentCategory, "plan");
});

Deno.test("P3-6 — photo chantier", () => {
  const r = normalizeAnalysisPayload({
    documentType: "photo_chantier",
    confidenceDocumentType: "high",
    documentTypeReason: "Document essentiellement composé d'une photographie.",
    items: [],
  }, {});
  assertEquals(r.documentType, "photo_chantier");
  assertEquals(r.documentCategory, "photo");
});

Deno.test("P3-7 — note manuscrite", () => {
  const r = normalizeAnalysisPayload({
    documentType: "note_manuscrite",
    confidenceDocumentType: "medium",
    documentTypeReason: "Texte manuscrit non structuré.",
    items: [],
  }, {});
  assertEquals(r.documentType, "note_manuscrite");
  assertEquals(r.documentCategory, "manuscrit");
});

Deno.test("P3-8 — document administratif", () => {
  const r = normalizeAnalysisPayload({
    documentType: "document_administratif",
    confidenceDocumentType: "medium",
    documentTypeReason: "Attestation officielle.",
    items: [],
  }, {});
  assertEquals(r.documentType, "document_administratif");
  assertEquals(r.documentCategory, "administratif");
});

Deno.test("P3-9 — inconnu → low + catégorie unknown, jamais inventé", () => {
  const r = normalizeAnalysisPayload({
    documentType: "grimoire_magique",
    confidenceDocumentType: "high", // ignoré car type inconnu
    documentTypeReason: "Type non reconnu.",
    items: [],
  }, {});
  assertEquals(r.documentType, "unknown");
  assertEquals(r.documentCategory, "unknown");
  assertEquals(r.confidenceDocumentType, "low");
});

Deno.test("P3-10 — alias legacy 'facture' → facture_client", () => {
  const r = normalizeAnalysisPayload({
    documentType: "facture",
    confidenceDocumentType: "medium",
    items: [],
  }, {});
  assertEquals(r.documentType, "facture_client");
  assertEquals(r.documentCategory, "commercial");
});
