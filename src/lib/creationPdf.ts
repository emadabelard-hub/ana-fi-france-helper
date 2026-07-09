import jsPDF from "jspdf";

export interface Associe { name: string; percent: number }

export interface StatutsInput {
  companyName: string;
  companyType: "SASU" | "SARL";
  activity: string;
  capital: number;
  address: string;
  managerName: string;
  managerBirthDate: string;
  managerNationality: string;
  managerAddress: string;
  signatureCity?: string;
  associes?: Associe[];
}

export interface PrevisionnelInput {
  type_societe: "SASU" | "SARL" | "Auto-entrepreneur";
  activite: string;
  capital: number;
  chiffre_affaires_estime: number;
  is_btp?: boolean;
}

// Formatte un montant avec espace NORMAL comme séparateur de milliers
// (jsPDF ne rend pas correctement l'espace insécable de toLocaleString).
export function formatEuro(n: number): string {
  const rounded = Math.round(n);
  const s = Math.abs(rounded).toString();
  const withSep = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (rounded < 0 ? "-" : "") + withSep + " €";
}

// Conversion nombre entier -> lettres françaises (1 à 999 999)
export function numberToFrenchWords(n: number): string {
  if (!Number.isFinite(n)) return "";
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zéro";

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

  const under100 = (num: number): string => {
    if (num < 20) return units[num];
    const t = Math.floor(num / 10);
    const u = num % 10;
    if (t === 7 || t === 9) {
      const base = tens[t];
      const rest = 10 + u;
      const join = (t === 7 && rest === 11) ? "-et-" : "-";
      return base + join + units[rest];
    }
    if (t === 8) {
      if (u === 0) return "quatre-vingts";
      return "quatre-vingt-" + units[u];
    }
    if (u === 0) return tens[t];
    if (u === 1 && t !== 8) return tens[t] + "-et-un";
    return tens[t] + "-" + units[u];
  };

  const under1000 = (num: number): string => {
    if (num < 100) return under100(num);
    const h = Math.floor(num / 100);
    const r = num % 100;
    let s = "";
    if (h === 1) s = "cent";
    else s = units[h] + " cent" + (r === 0 ? "s" : "");
    if (r > 0) s += " " + under100(r);
    return s;
  };

  if (n < 1000) return under1000(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  let s = "";
  if (thousands === 1) s = "mille";
  else s = under1000(thousands) + " mille";
  if (rest > 0) s += " " + under1000(rest);
  return s;
}

function extractCity(address: string): string {
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  if (!parts.length) return "";
  const last = parts[parts.length - 1];
  return last.replace(/^\d{4,5}\s*/, "").trim() || last;
}

export function buildStatutsPdf(body: StatutsInput): jsPDF {
  const isSASU = body.companyType === "SASU";
  const city = (body.signatureCity && body.signatureCity.trim()) || extractCity(body.address);
  const today = new Date().toLocaleDateString("fr-FR");
  const capitalStr = formatEuro(body.capital);
  const capitalLettres = numberToFrenchWords(body.capital);
  const dirigeantTitre = isSASU ? "Président" : "gérant";
  const dirigeantTitreCap = isSASU ? "Président" : "Gérant";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("times", "normal");
  const margin = 25;
  const pageWidth = 210;
  const usableWidth = pageWidth - 2 * margin;
  let y = margin;

  const addText = (
    text: string,
    opts: { bold?: boolean; size?: number; align?: "left" | "center"; spacing?: number } = {}
  ) => {
    doc.setFont("times", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 11);
    const lines = doc.splitTextToSize(text, usableWidth);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.text(line, opts.align === "center" ? pageWidth / 2 : margin, y, { align: opts.align ?? "left" });
      y += (opts.size ?? 11) * 0.5;
    }
    y += opts.spacing ?? 3;
  };

  addText(`STATUTS DE ${body.companyType}`, { bold: true, size: 16, align: "center", spacing: 4 });
  addText(body.companyName.toUpperCase(), { bold: true, size: 14, align: "center", spacing: 10 });

  addText("Article 1 — Forme", { bold: true, size: 12 });
  addText(`Il est constitué entre les soussignés une société ${body.companyType} régie par les dispositions du Code de commerce.`);

  addText("Article 2 — Objet social", { bold: true, size: 12 });
  addText(`La société a pour objet : ${body.activity}. Et généralement toutes opérations commerciales, industrielles ou financières se rattachant directement ou indirectement à cet objet.`);

  addText("Article 3 — Dénomination sociale", { bold: true, size: 12 });
  addText(`La société prend la dénomination : ${body.companyName}`);

  addText("Article 4 — Siège social", { bold: true, size: 12 });
  addText(`Le siège social est fixé à : ${body.address}`);

  addText("Article 5 — Durée", { bold: true, size: 12 });
  addText(`La durée de la société est fixée à 99 ans à compter de son immatriculation au RCS.`);

  addText("Article 6 — Capital social", { bold: true, size: 12 });
  addText(`Le capital social est fixé à ${capitalStr} (${capitalLettres} euros).`);
  if (isSASU) {
    addText(`Il est divisé en ${body.capital} actions de 1 € chacune, entièrement souscrites et libérées par l'associé unique.`);
  } else {
    const lignes = (body.associes ?? []).map(a => `- ${a.name} : ${a.percent}%`).join("\n");
    addText(`Il est réparti comme suit :\n${lignes || "- " + body.managerName + " : 100%"}`);
  }

  addText(isSASU ? "Article 7 — Présidence" : "Article 7 — Gérance", { bold: true, size: 12 });
  if (isSASU) {
    addText(`La société est dirigée par un Président : M/Mme ${body.managerName}, né(e) le ${body.managerBirthDate}, de nationalité ${body.managerNationality}, demeurant ${body.managerAddress || body.address}.`);
  } else {
    addText(`La société est gérée par M/Mme ${body.managerName}, né(e) le ${body.managerBirthDate}, de nationalité ${body.managerNationality}, demeurant ${body.managerAddress || body.address}.`);
  }

  addText("Article 8 — Exercice social", { bold: true, size: 12 });
  addText(`L'exercice social commence le 1er janvier et se termine le 31 décembre de chaque année.`);

  addText("Article 9 — Décisions collectives", { bold: true, size: 12 });
  if (isSASU) {
    addText(`Les décisions relevant de la compétence des associés sont prises par l'associé unique.`);
  } else {
    addText(`Les décisions collectives sont prises en assemblée générale ou par consultation écrite.`);
  }

  addText("Article 10 — Dissolution — Liquidation", { bold: true, size: 12 });
  addText(`En cas de dissolution, la liquidation est effectuée par le ${dirigeantTitre} ou tout mandataire désigné.`);

  y += 8;
  addText(`Fait à ${city}, le ${today}`, { spacing: 12 });
  addText(`Signature du ${dirigeantTitre} : _______________________`, { spacing: 4 });
  addText(body.managerName, { bold: true });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.text(
      "Document généré par Anafy Pro — anafypro.com — Ce document est fourni à titre indicatif et doit être validé par un professionnel juridique.",
      pageWidth / 2, 290, { align: "center", maxWidth: usableWidth }
    );
  }

  return doc;
}

export function buildPrevisionnelPdf(body: PrevisionnelInput): jsPDF {
  const eur = (n: number) => formatEuro(n);
  const ca = Number(body.chiffre_affaires_estime) || 0;
  const isAE = body.type_societe === "Auto-entrepreneur";
  const isSociete = body.type_societe === "SASU" || body.type_societe === "SARL";

  const urssaf = isAE ? ca * 0.22 : ca * 0.45;
  const cfe = 500;
  const decennale = body.is_btp ? 1500 : 0;
  const rcpro = 400;
  const comptable = 1200;
  const banque = 300;
  const materiel = ca * 0.15;
  const totalCharges = urssaf + cfe + decennale + rcpro + comptable + banque + materiel;
  const resultatAvantImpot = ca - totalCharges;
  let is = 0;
  if (isSociete && resultatAvantImpot > 0) {
    if (resultatAvantImpot <= 42500) is = resultatAvantImpot * 0.15;
    else is = 42500 * 0.15 + (resultatAvantImpot - 42500) * 0.25;
  }
  const resultatNet = resultatAvantImpot - is;
  const mensuel = resultatNet / 12;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");
  const margin = 20;
  const pageWidth = 210;
  const usable = pageWidth - 2 * margin;
  let y = margin;
  const today = new Date().toLocaleDateString("fr-FR");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PRÉVISIONNEL FINANCIER — ANNÉE 1", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`${body.activite} — ${body.type_societe}`, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(10);
  doc.text(`Date de génération : ${today}`, pageWidth / 2, y, { align: "center" });
  y += 10;

  const drawRow = (label: string, value: string, bold = false) => {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.rect(margin, y - 4, usable, 7);
    doc.text(label, margin + 2, y);
    doc.text(value, margin + usable - 2, y, { align: "right" });
    y += 7;
  };

  const sectionTitle = (t: string) => {
    y += 4;
    if (y > 265) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(t, margin, y);
    y += 6;
  };

  sectionTitle("1. CHARGES ANNUELLES ESTIMÉES");
  drawRow(`Cotisations URSSAF (${isAE ? "22%" : "45%"} du CA)`, eur(urssaf));
  drawRow("CFE (Cotisation Foncière des Entreprises)", eur(cfe));
  if (body.is_btp) drawRow("Assurance décennale (BTP)", eur(decennale));
  drawRow("RC Pro", eur(rcpro));
  drawRow("Comptable", eur(comptable));
  drawRow("Frais bancaires", eur(banque));
  drawRow("Matériel et fournitures (15% du CA)", eur(materiel));
  drawRow("TOTAL CHARGES", eur(totalCharges), true);

  sectionTitle("2. RÉSULTAT PRÉVISIONNEL");
  drawRow("Chiffre d'affaires estimé", eur(ca));
  drawRow("Total charges", eur(totalCharges));
  drawRow("Résultat avant impôt", eur(resultatAvantImpot));
  if (isSociete) drawRow("Impôt sur les Sociétés (15% / 25%)", eur(is));
  drawRow("Résultat net estimé", eur(resultatNet), true);
  drawRow("Équivalent mensuel net", eur(mensuel), true);

  sectionTitle("3. SEUILS IMPORTANTS À CONNAÎTRE");
  const seuils: [string, string, string][] = [
    ["Franchise TVA", "37 500 €", "En dessous : pas de TVA à facturer"],
    ["Plafond Auto-entrepreneur BTP", "77 700 €", "Au-delà : changer de statut obligatoire"],
    ["Taux IS réduit", "42 500 €", "En dessous : IS à 15% seulement"],
    ["ACRE", "Année 1", "Réduction 50% cotisations si éligible"],
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const colW = [55, 35, usable - 90];
  if (y > 260) { doc.addPage(); y = margin; }
  doc.rect(margin, y - 4, colW[0], 7);
  doc.rect(margin + colW[0], y - 4, colW[1], 7);
  doc.rect(margin + colW[0] + colW[1], y - 4, colW[2], 7);
  doc.text("Seuil", margin + 2, y);
  doc.text("Montant", margin + colW[0] + 2, y);
  doc.text("Signification", margin + colW[0] + colW[1] + 2, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  for (const [s, m, sig] of seuils) {
    if (y > 270) { doc.addPage(); y = margin; }
    const sigLines = doc.splitTextToSize(sig, colW[2] - 4);
    const h = Math.max(7, sigLines.length * 5 + 2);
    doc.rect(margin, y - 4, colW[0], h);
    doc.rect(margin + colW[0], y - 4, colW[1], h);
    doc.rect(margin + colW[0] + colW[1], y - 4, colW[2], h);
    doc.text(s, margin + 2, y);
    doc.text(m, margin + colW[0] + 2, y);
    doc.text(sigLines, margin + colW[0] + colW[1] + 2, y);
    y += h;
  }

  y += 8;
  if (y > 260) { doc.addPage(); y = margin; }
  doc.setFillColor(255, 248, 220);
  doc.rect(margin, y - 4, usable, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Conseil Anafy Pro", margin + 3, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const conseil = "Ces chiffres sont des estimations. Consultez un expert-comptable pour valider votre prévisionnel avant dépôt au greffe.";
  doc.text(doc.splitTextToSize(conseil, usable - 6), margin + 3, y + 6);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Document généré par Anafy Pro — à titre indicatif", pageWidth / 2, 290, { align: "center" });
  }

  return doc;
}
