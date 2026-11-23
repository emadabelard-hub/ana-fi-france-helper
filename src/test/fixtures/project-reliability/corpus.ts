/**
 * Corpus synthétique non confidentiel, annoté manuellement (P0).
 * `text` = contenu tel que produit par la lecture locale ; `facts` = réponse IA
 * simulée ; `expected` = classement attendu, fixé à la main depuis `text`.
 * Aucun document client n'est copié ici.
 */
export type CorpusDoc = {
  id: string; label: string; fileName: string; text?: string; pageImages?: string[];
  coverage?: Record<string, unknown>;
  facts: Record<string, unknown>[];
  expected: "verified" | "partial" | "refused";
};
const W = (o: Record<string, unknown>) => ({ factType: "billable_work", ...o });
const IMG = "data:image/jpeg;base64,AAAA";

export const CORPUS: CorpusDoc[] = [
  { id: "C01", label: "Word simple", fileName: "simple.docx", expected: "verified",
    text: "Salle de bain\nDépose de 4 m² de carrelage au sol.\nPeinture des plafonds 100 m².",
    facts: [W({ descriptionExact: "Dépose carrelage sol", evidenceText: "Dépose de 4 m² de carrelage au sol.", quantity: 4, unit: "m²" }),
      W({ descriptionExact: "Peinture plafonds", evidenceText: "Peinture des plafonds 100 m².", quantity: 100, unit: "m²" })] },
  { id: "C02", label: "Tableau Word sans en-tête", fileName: "tableau.docx", expected: "verified",
    text: "[Tableau 1 — 2 ligne(s)]\nLigne 1 : | Peinture murs | 30 m² |\nLigne 2 : | Plinthes bois | 12 ml |\n[Tableau 1 : aucun en-tête marqué — aucune ligne n'est interprétée comme en-tête]\n[Fin du tableau 1]",
    facts: [W({ descriptionExact: "Peinture murs", evidenceText: "Peinture murs | 30 m²", quantity: 30, unit: "m²" }),
      W({ descriptionExact: "Plinthes bois", evidenceText: "Plinthes bois | 12 ml", quantity: 12, unit: "ml" })] },
  { id: "C03", label: "Cellules fusionnées", fileName: "fusion.docx", expected: "partial",
    coverage: { structureIssues: ["table_1_vertical_merge"] },
    text: "[Tableau 1 — 2 ligne(s)]\nLigne 1 : | Cuisine (fusion verticale ×2) | Carrelage 8 m² |\nLigne 2 : | Faïence 4 m² |\n[Fin du tableau 1]",
    facts: [W({ descriptionExact: "Carrelage", evidenceText: "Carrelage 8 m²", quantity: 8, unit: "m²", location: "Cuisine" }),
      W({ descriptionExact: "Faïence", evidenceText: "Faïence 4 m²", quantity: 4, unit: "m²", location: "Cuisine" })] },
  { id: "C04", label: "Word avec image", fileName: "image.docx", expected: "partial", pageImages: [IMG],
    coverage: { mediaTotal: 1, untransmittedMedia: 0 },
    text: "Pose de 6 u de spots LED.\n[Image 1 du document Word — transmise en pièce jointe n°1]",
    facts: [W({ descriptionExact: "Pose spots LED", evidenceText: "Pose de 6 u de spots LED.", quantity: 6, unit: "u" }),
      W({ descriptionExact: "Cloison placo", evidenceText: "Cloison 3,20 m (plan)", quantity: 3.2, unit: "ml" })] },
  { id: "C05", label: "PDF natif à deux colonnes", fileName: "colonnes.pdf", expected: "verified",
    coverage: { totalPages: 1, structureIssues: [] },
    text: "--- Page 1 ---\nDépose cuisine 10 m² ‖ Enduit couloir 15 m²",
    facts: [W({ descriptionExact: "Enduit couloir", evidenceText: "Enduit couloir 15 m²", quantity: 15, unit: "m²", sourcePage: 1 })] },
  { id: "C06", label: "PDF scanné (sans couche texte)", fileName: "scan.pdf", expected: "refused", pageImages: [IMG],
    coverage: { totalPages: 1, textPages: [], imagePages: [1], unreadPages: [] },
    facts: [W({ descriptionExact: "Peinture murs", evidenceText: "Peinture murs 40 m²", quantity: 40, unit: "m²", sourcePage: 1 })] },
  { id: "C07", label: "PDF mixte texte/plan", fileName: "mixte.pdf", expected: "partial", pageImages: [IMG],
    coverage: { totalPages: 2, textPages: [1], imagePages: [2], unreadPages: [] },
    text: "--- Page 1 ---\nRagréage sol 20 m².\n\n--- Page 2 --- (aucune couche texte : contenu visuel)",
    facts: [W({ descriptionExact: "Ragréage sol", evidenceText: "Ragréage sol 20 m².", quantity: 20, unit: "m²", sourcePage: 1 }),
      W({ descriptionExact: "Cloison", evidenceText: "Cloison 2,50 m", quantity: 2.5, unit: "ml", sourcePage: 2 })] },
  { id: "C08", label: "Plan coté (image seule)", fileName: "plan.png", expected: "refused", pageImages: [IMG],
    facts: [W({ descriptionExact: "Mur séjour", evidenceText: "4,20 m", quantity: 4.2, unit: "ml" })] },
  { id: "C09", label: "Passages répétés", fileName: "repete.docx", expected: "refused",
    text: "Lot 1\nPeinture murs 10 m²\nLot 2\nPeinture murs 10 m²",
    facts: [W({ descriptionExact: "Peinture murs", evidenceText: "Peinture murs 10 m²", quantity: 10, unit: "m²" })] },
  { id: "C10", label: "Véritable contradiction (version A)", fileName: "versionA.docx", expected: "verified",
    text: "Pose parquet chêne 25 m².",
    facts: [W({ descriptionExact: "Pose parquet chêne", evidenceText: "Pose parquet chêne 25 m².", quantity: 25, unit: "m²", material: "chêne" })] },
  { id: "C11", label: "Véritable contradiction (version B)", fileName: "versionB.docx", expected: "verified",
    text: "Pose parquet chêne 30 m².",
    facts: [W({ descriptionExact: "Pose parquet chêne", evidenceText: "Pose parquet chêne 30 m².", quantity: 30, unit: "m²", material: "chêne" })] },
  { id: "C12", label: "Fausse contradiction (erreur d'extraction, cas Hélène Delaplace reproduit)", fileName: "descriptif.pdf", expected: "refused",
    coverage: { totalPages: 4, textPages: [4], imagePages: [], unreadPages: [] },
    text: "--- Page 4 ---\nDépose de 4 m² de carrelage au sol.\nMise en place d'une fresque papier peint sur 22 m² en remplacement de la finition peinture.",
    facts: [W({ descriptionExact: "Dépose carrelage au sol", evidenceText: "Dépose de 6 m² de carrelage au sol.", quantity: 6, unit: "m²", sourcePage: 4 }),
      W({ descriptionExact: "Mise en place d'une frisette papier peint", evidenceText: "Mise en place d'une frisette papier peint sur 22 m² en remplacement de la fausse peinture.", quantity: 22, unit: "m²", sourcePage: 4 })] },
  { id: "C13", label: "Document partiellement illisible", fileName: "illisible.pdf", expected: "partial",
    coverage: { totalPages: 2, textPages: [1], imagePages: [], unreadPages: [2] },
    text: "--- Page 1 ---\nRemplacement de 2 u de fenêtres PVC.",
    facts: [W({ descriptionExact: "Remplacement fenêtres PVC", evidenceText: "Remplacement de 2 u de fenêtres PVC.", quantity: 2, unit: "u", material: "PVC", sourcePage: 1 })] },
];
