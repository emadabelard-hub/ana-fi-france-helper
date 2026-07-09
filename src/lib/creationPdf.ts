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
  const formeLongue = isSASU
    ? "Société par Actions Simplifiée Unipersonnelle (SASU)"
    : "Société à Responsabilité Limitée (SARL)";
  const titreSocieteInline = isSASU
    ? "« société par actions simplifiée unipersonnelle »"
    : "« société à responsabilité limitée »";
  const initiales = isSASU ? "SASU" : "SARL";
  const titreParts = isSASU ? "actions" : "parts sociales";
  const titrePart = isSASU ? "action" : "part sociale";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("times", "normal");
  const margin = 22;
  const pageWidth = 210;
  const pageHeight = 297;
  const usableWidth = pageWidth - 2 * margin;
  const bottomLimit = 275;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) { doc.addPage(); y = margin; }
  };

  const addText = (
    text: string,
    opts: { bold?: boolean; italic?: boolean; size?: number; align?: "left" | "center" | "justify"; spacing?: number; lineHeight?: number } = {}
  ) => {
    const style = opts.bold && opts.italic ? "bolditalic" : opts.bold ? "bold" : opts.italic ? "italic" : "normal";
    doc.setFont("times", style);
    const size = opts.size ?? 11;
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, usableWidth);
    const lh = (opts.lineHeight ?? 0.55) * size;
    for (const line of lines) {
      if (y > bottomLimit) { doc.addPage(); y = margin; }
      doc.text(line, opts.align === "center" ? pageWidth / 2 : margin, y, {
        align: opts.align === "center" ? "center" : "left",
      });
      y += lh;
    }
    y += opts.spacing ?? 3;
  };

  const addArticle = (title: string, paragraphs: string[]) => {
    // Groupement : réserver la place du titre + au moins la 1re ligne du corps
    const size = 12;
    doc.setFont("times", "bold");
    doc.setFontSize(size);
    const firstBody = paragraphs[0] ?? "";
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const firstLines = doc.splitTextToSize(firstBody, usableWidth);
    const needed = size * 0.55 + 3 + 11 * 0.55 * Math.min(2, firstLines.length) + 2;
    ensureSpace(needed);
    addText(title, { bold: true, size: 12, spacing: 2 });
    for (const p of paragraphs) {
      addText(p, { size: 11, spacing: 3 });
    }
    y += 2;
  };

  // ═══ PAGE 1 : EN-TÊTE ═══
  addText("STATUTS CONSTITUTIFS", { bold: true, size: 18, align: "center", spacing: 4 });
  addText(body.companyName.toUpperCase(), { bold: true, size: 15, align: "center", spacing: 3 });
  addText(formeLongue, { italic: true, size: 12, align: "center", spacing: 10 });

  // Encadré synthèse
  const boxTop = y;
  const boxLines = [
    `Dénomination :  ${body.companyName}`,
    `Forme juridique :  ${initiales}`,
    `Capital social :  ${capitalStr}`,
    `Siège social :  ${body.address}`,
    `Durée :  99 années`,
  ];
  const boxLineH = 6;
  const boxPad = 4;
  // Calcul hauteur en tenant compte du wrap éventuel de l'adresse
  let boxHeight = boxPad * 2;
  const wrappedBoxLines: string[][] = [];
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  for (const l of boxLines) {
    const ws = doc.splitTextToSize(l, usableWidth - boxPad * 2);
    wrappedBoxLines.push(ws);
    boxHeight += ws.length * boxLineH;
  }
  ensureSpace(boxHeight + 8);
  doc.setDrawColor(120);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, usableWidth, boxHeight);
  let by = y + boxPad + 4;
  for (const ws of wrappedBoxLines) {
    for (const line of ws) {
      doc.text(line, margin + boxPad, by);
      by += boxLineH;
    }
  }
  y += boxHeight + 10;

  // ═══ ARTICLES ═══
  addArticle("Article 1 — Forme", [
    isSASU
      ? "Il est formé par le soussigné une société par actions simplifiée unipersonnelle régie par les dispositions des articles L. 227-1 à L. 227-20 du Code de commerce, ainsi que par les présents statuts."
      : "Il est formé entre les soussignés une société à responsabilité limitée régie par les articles L. 223-1 et suivants du Code de commerce, ainsi que par les présents statuts.",
  ]);

  addArticle("Article 2 — Objet social", [
    `La société a pour objet : ${body.activity} ; et plus généralement, toutes opérations industrielles, commerciales, financières, mobilières ou immobilières, se rapportant directement ou indirectement à l'objet social ou susceptibles d'en faciliter l'extension ou le développement.`,
  ]);

  addArticle("Article 3 — Dénomination sociale", [
    `La société prend la dénomination de : ${body.companyName}. Dans tous les actes et documents émanant de la société, cette dénomination doit être précédée ou suivie immédiatement des mots ${titreSocieteInline} ou des initiales « ${initiales} », de l'énonciation du capital social, du numéro SIREN et de la mention RCS suivie du nom de la ville du greffe d'immatriculation.`,
  ]);

  addArticle("Article 4 — Siège social", [
    `Le siège social est fixé au : ${body.address}. Il peut être transféré en tout autre lieu par décision ${isSASU ? "de l'associé unique" : "des associés"}.`,
  ]);

  addArticle("Article 5 — Durée", [
    "La durée de la société est fixée à 99 années à compter de son immatriculation au Registre du Commerce et des Sociétés, sauf dissolution anticipée ou prorogation.",
  ]);

  // Article 6 — Apports et capital
  const article6: string[] = [];
  if (isSASU) {
    article6.push(
      `L'associé unique apporte en numéraire la somme de ${capitalStr} (${capitalLettres} euros). Le capital social est fixé à ${capitalStr} (${capitalLettres} euros), divisé en ${body.capital} ${titreParts} de 1 € chacune, entièrement souscrites et libérées.`
    );
  } else {
    article6.push(
      `Les associés apportent en numéraire la somme totale de ${capitalStr} (${capitalLettres} euros). Le capital social est fixé à ${capitalStr} (${capitalLettres} euros), divisé en ${body.capital} ${titreParts} de 1 € chacune, entièrement souscrites et libérées.`
    );
    const assoc = body.associes ?? [];
    if (assoc.length > 0) {
      const lignes = assoc
        .map(a => `— ${a.name} : ${a.percent}% du capital, soit ${Math.round((a.percent / 100) * body.capital)} ${a.percent === 0 || Math.round((a.percent / 100) * body.capital) > 1 ? "parts sociales" : "part sociale"}`)
        .join("\n");
      article6.push(`Répartition entre les associés :\n${lignes}`);
    } else {
      article6.push(`Répartition : ${body.managerName} : 100% du capital.`);
    }
  }
  addArticle("Article 6 — Apports et capital social", article6);

  // Article 7 — Présidence / Gérance
  const adresseDirigeant = body.managerAddress || body.address;
  if (isSASU) {
    addArticle("Article 7 — Présidence", [
      `La société est dirigée et administrée par un Président, personne physique ou morale, associé ou non.`,
      `Le premier Président est : M/Mme ${body.managerName}, né(e) le ${body.managerBirthDate}, de nationalité ${body.managerNationality}, demeurant ${adresseDirigeant}.`,
      `Le Président est investi des pouvoirs les plus étendus pour agir en toute circonstance au nom de la société, dans la limite de l'objet social. Il représente la société à l'égard des tiers.`,
      `Le Président est nommé sans limitation de durée. Il peut démissionner à tout moment sous réserve d'un préavis raisonnable. Sa rémunération est fixée par décision de l'associé unique.`,
    ]);
  } else {
    addArticle("Article 7 — Gérance", [
      `La société est administrée par un ou plusieurs gérants, personnes physiques, associés ou non.`,
      `Le premier gérant est : M/Mme ${body.managerName}, né(e) le ${body.managerBirthDate}, de nationalité ${body.managerNationality}, demeurant ${adresseDirigeant}.`,
      `Le gérant est investi des pouvoirs les plus étendus pour agir au nom de la société dans la limite de l'objet social et sous réserve des pouvoirs expressément attribués aux associés par la loi ou les présents statuts.`,
      `Le gérant est nommé sans limitation de durée. Sa rémunération est fixée par décision collective des associés.`,
    ]);
  }

  addArticle("Article 8 — Exercice social", [
    "L'exercice social commence le 1er janvier et se termine le 31 décembre de chaque année.",
    "Par exception, le premier exercice commencera à la date d'immatriculation de la société au RCS et se terminera le 31 décembre de la même année, ou de l'année suivante si l'immatriculation intervient après le 30 juin.",
  ]);

  if (isSASU) {
    addArticle("Article 9 — Décisions de l'associé unique", [
      "L'associé unique exerce les pouvoirs dévolus par la loi à la collectivité des associés. Ses décisions sont répertoriées dans un registre coté et paraphé.",
      "Relèvent de sa compétence exclusive : l'approbation des comptes annuels et l'affectation du résultat, la nomination et la révocation du Président, la modification des statuts, ainsi que la transformation, la dissolution ou la prorogation de la société.",
    ]);
  } else {
    addArticle("Article 9 — Décisions collectives", [
      "Les décisions collectives sont prises en assemblée générale ou, lorsque la loi le permet, par consultation écrite des associés.",
      "Les décisions ordinaires sont adoptées à la majorité des parts sociales. Les décisions extraordinaires emportant modification des statuts sont adoptées aux majorités légales prévues par les articles L. 223-27 et suivants du Code de commerce.",
    ]);
  }

  if (isSASU) {
    addArticle("Article 10 — Cession des actions", [
      "Tant que la société demeure unipersonnelle, l'associé unique cède librement ses actions.",
      "En cas de pluralité d'associés, toute cession à un tiers est soumise à l'agrément préalable de la collectivité des associés dans les conditions prévues par la loi et, le cas échéant, par les présents statuts.",
    ]);
  } else {
    addArticle("Article 10 — Cession des parts sociales", [
      "Les parts sociales sont librement cessibles entre associés, ainsi qu'entre conjoints, ascendants et descendants.",
      "Toute cession à un tiers étranger à la société est soumise à l'agrément de la majorité des associés représentant au moins la moitié des parts sociales, conformément à l'article L. 223-14 du Code de commerce.",
    ]);
  }

  addArticle("Article 11 — Conventions réglementées", [
    `Toute convention intervenant, directement ou par personne interposée, entre la société et son ${dirigeantTitre} fait l'objet des procédures de contrôle prévues par la loi.`,
    "Les conventions portant sur des opérations courantes et conclues à des conditions normales ne sont pas soumises à cette procédure.",
  ]);

  addArticle("Article 12 — Commissaire aux comptes", [
    `La nomination d'un commissaire aux comptes n'est pas obligatoire tant que la société ne dépasse pas les seuils légaux fixés par la réglementation en vigueur.`,
    `${isSASU ? "L'associé unique" : "Les associés"} peu${isSASU ? "t" : "vent"} décider d'en nommer un volontairement.`,
  ]);

  addArticle("Article 13 — Résultats sociaux", [
    "Le bénéfice distribuable est constitué par le bénéfice de l'exercice, diminué des pertes antérieures et des sommes portées en réserve en application de la loi — notamment la réserve légale à hauteur de 5% du bénéfice, jusqu'à atteindre 10% du capital social — et augmenté du report bénéficiaire.",
  ]);

  addArticle("Article 14 — Dissolution — Liquidation", [
    `La société est dissoute à l'expiration de sa durée, ${isSASU ? "par décision de l'associé unique" : "par décision collective des associés"}, ou pour toute autre cause prévue par la loi.`,
    `La dissolution entraîne la liquidation, effectuée par le ${dirigeantTitre} ou tout liquidateur désigné par ${isSASU ? "l'associé unique" : "les associés"}, qui dispose des pouvoirs les plus étendus pour réaliser l'actif et apurer le passif.`,
  ]);

  // ═══ FIN DU DOCUMENT ═══
  ensureSpace(45);
  y += 6;
  addText(`Fait à ${city}, le ${today}, en trois exemplaires originaux.`, { spacing: 14 });
  if (isSASU) {
    addText("Signature de l'associé unique et Président :", { spacing: 12 });
    addText("_______________________________________", { spacing: 4 });
    addText(`M/Mme ${body.managerName} — associé unique et Président`, { bold: true });
  } else {
    addText("Signature du gérant :", { spacing: 12 });
    addText("_______________________________________", { spacing: 4 });
    addText(`M/Mme ${body.managerName} — gérant`, { bold: true });
  }

  // Footer + pagination sur chaque page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
      "Document généré par Anafy Pro — anafypro.com — Ce document est fourni à titre indicatif et doit être validé par un professionnel juridique.",
      pageWidth / 2, pageHeight - 10, { align: "center", maxWidth: usableWidth }
    );
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    doc.setTextColor(0);
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
