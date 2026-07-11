import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ─── Détection & rendu de l'arabe via image (même mécanisme que le rapport de chantier) ───
export function containsArabicText(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s || "");
}

export async function renderArabicToImage(
  text: string,
  widthMm: number,
  opts?: { bold?: boolean; size?: number; align?: "right" | "left" | "center"; color?: string; bg?: string }
): Promise<{ dataUrl: string; heightMm: number } | null> {
  if (!text || !text.trim()) return null;
  if (typeof document === "undefined") return null;
  const pxPerMm = 96 / 25.4;
  const widthPx = Math.max(50, Math.round(widthMm * pxPerMm));
  const fontPx = Math.round((opts?.size ?? 11) * (96 / 72));
  const div = document.createElement("div");
  div.style.cssText = [
    "position:fixed", "left:-99999px", "top:0",
    `width:${widthPx}px`,
    "direction:rtl",
    `text-align:${opts?.align || "right"}`,
    "font-family:'IBM Plex Sans Arabic','Tajawal','Noto Naskh Arabic',Arial,sans-serif",
    `font-size:${fontPx}px`,
    "line-height:1.55",
    `color:${opts?.color || "#212121"}`,
    `font-weight:${opts?.bold ? "700" : "400"}`,
    `background:${opts?.bg || "#ffffff"}`,
    "white-space:pre-wrap", "word-wrap:break-word", "padding:2px 0",
  ].join(";");
  div.textContent = text;
  document.body.appendChild(div);
  try {
    if (document.fonts && typeof (document.fonts as unknown as { ready?: Promise<void> }).ready?.then === "function") {
      try { await (document.fonts as unknown as { ready: Promise<void> }).ready; } catch { /* ignore */ }
    }
    const canvas = await html2canvas(div, {
      scale: 2, backgroundColor: opts?.bg || "#ffffff", logging: false, useCORS: true,
    });
    return { dataUrl: canvas.toDataURL("image/png"), heightMm: (canvas.height / canvas.width) * widthMm };
  } finally {
    document.body.removeChild(div);
  }
}

export type Gender = "M" | "F";

export interface Personne {
  gender: Gender;
  fullName: string;
  birthDate: string;      // dd/mm/yyyy
  birthPlace: string;     // "Ville, Pays"
  nationality: string;
  address: string;
  fatherName?: string;
  motherName?: string;
}

export interface AssocieDetail extends Personne {
  percent: number;
  isManager: boolean;
}

export interface StatutsInput {
  companyName: string;
  /** Famille juridique choisie par l'utilisateur. La forme effective (EURL/SARL/SASU/SAS) est calculée d'après le nombre d'associés. */
  companyType: "SASU" | "SARL";
  activity: string;
  capital: number;
  address: string;
  signatureCity?: string;
  associes: AssocieDetail[];
  extraManagers?: Personne[];
}

export type EffectiveForm = "EURL" | "SARL" | "SASU" | "SAS";

export function effectiveFormOf(family: "SASU" | "SARL", associesCount: number): EffectiveForm {
  const isSAS = family === "SASU";
  const unipersonnel = associesCount <= 1;
  if (isSAS) return unipersonnel ? "SASU" : "SAS";
  return unipersonnel ? "EURL" : "SARL";
}

export interface PrevisionnelInput {
  /** Forme effective à afficher : EURL/SARL/SASU/SAS ou Auto-entrepreneur */
  type_societe: "SASU" | "SARL" | "SAS" | "EURL" | "Auto-entrepreneur";
  activite: string;
  capital: number;
  chiffre_affaires_estime: number;
  is_btp?: boolean;
  /** Rémunération NETTE mensuelle du dirigeant (€) */
  remuneration_dirigeant_mensuelle?: number;
  /** Nombre de salariés hors dirigeant */
  nb_salaries?: number;
  /** Salaire NET mensuel moyen par salarié (€) */
  salaire_moyen_mensuel?: number;
  /** Coût véhicule mensuel (€) */
  vehicule_mensuel?: number;
  /** Loyer mensuel (€) */
  loyer_mensuel?: number;
  /** Assurances annuelles (décennale + RC Pro) (€) */
  assurances_annuelles?: number;
  /** Comptable annuel (€) */
  comptable_annuel?: number;
  /** Achats matériaux annuels (€) */
  achats_materiaux_annuels?: number;
  /** Autres charges annuelles (€) */
  autres_charges_annuelles?: number;
  // ─── Plan de démarrage ───
  /** Investissement matériel initial (€) — amortissable, hors charges */
  investissement_materiel?: number;
  /** Situation véhicule */
  vehicule_situation?: "owned" | "toBuy" | "notNeeded";
  /** Mode d'acquisition véhicule si toBuy */
  vehicule_mode?: "cash" | "credit" | "leasing";
  /** Emprunt bancaire — montant (€) */
  emprunt_montant?: number;
  /** Emprunt bancaire — durée (années) */
  emprunt_annees?: number;
  /** Carnet de commandes au démarrage */
  carnet_commandes?: "acquired" | "promises" | "prospecting";
}

// Formatte un montant avec espace NORMAL (jsPDF gère mal l'espace insécable)
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

// Capitalisation propre pour villes/adresses ("le caire" -> "Le Caire", "épinay-sur-seine" -> "Épinay-sur-Seine")
const SMALL_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "sur", "sous", "aux", "au", "d", "l"]);
function titleCasePlace(input: string): string {
  if (!input) return input;
  const capWord = (w: string): string => {
    if (!w) return w;
    // Traite chaque segment séparé par un tiret indépendamment
    return w.split("-").map(seg => {
      if (!seg) return seg;
      const lower = seg.toLocaleLowerCase("fr-FR");
      return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
    }).join("-");
  };
  // Découpe en tokens en conservant séparateurs (espaces, virgules, apostrophes)
  return input.split(/(\s+|,|'|’)/).map((tok, idx, arr) => {
    if (!tok) return tok;
    if (/^\s+$/.test(tok) || tok === "," || tok === "'" || tok === "’") return tok;
    // garder les chiffres tels quels
    if (/^\d+$/.test(tok)) return tok;
    const lower = tok.toLocaleLowerCase("fr-FR");
    // Mots outils en minuscule sauf en tête ou après virgule
    const prevNonSpace = (() => {
      for (let i = idx - 1; i >= 0; i--) {
        const t = arr[i];
        if (t && !/^\s+$/.test(t)) return t;
      }
      return "";
    })();
    const isFirst = idx === 0 || prevNonSpace === "" || prevNonSpace === ",";
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return capWord(tok);
  }).join("");
}

function nePart(gender: Gender): string {
  return gender === "F" ? "née" : "né";
}
function civilite(gender: Gender): string {
  return gender === "F" ? "Mme" : "M.";
}

function civilStateSentence(p: Personne): string {
  const bp = titleCasePlace(p.birthPlace);
  const addr = titleCasePlace(p.address);
  return `${civilite(p.gender)} ${p.fullName}, ${nePart(p.gender)} le ${p.birthDate} à ${bp}, de nationalité ${p.nationality}, demeurant ${addr}`;
}

export function buildStatutsPdf(body: StatutsInput): jsPDF {
  const associes = body.associes ?? [];
  const extraManagers = body.extraManagers ?? [];
  const isSAS = body.companyType === "SASU"; // famille SAS
  const unipersonnel = associes.length <= 1;
  const forme: EffectiveForm = effectiveFormOf(body.companyType, associes.length);

  const addressPretty = titleCasePlace(body.address);
  const city = titleCasePlace((body.signatureCity && body.signatureCity.trim()) || extractCity(body.address));
  const today = new Date().toLocaleDateString("fr-FR");
  const capitalStr = formatEuro(body.capital);
  const capitalLettres = numberToFrenchWords(body.capital);
  const dirigeantTitre = isSAS ? "Président" : "gérant";
  const formeLongueMap: Record<EffectiveForm, string> = {
    EURL: "Entreprise Unipersonnelle à Responsabilité Limitée (EURL)",
    SARL: "Société à Responsabilité Limitée (SARL)",
    SASU: "Société par Actions Simplifiée Unipersonnelle (SASU)",
    SAS: "Société par Actions Simplifiée (SAS)",
  };
  const formeLongue = formeLongueMap[forme];
  const titreSocieteInlineMap: Record<EffectiveForm, string> = {
    EURL: "« entreprise unipersonnelle à responsabilité limitée »",
    SARL: "« société à responsabilité limitée »",
    SASU: "« société par actions simplifiée unipersonnelle »",
    SAS: "« société par actions simplifiée »",
  };
  const titreSocieteInline = titreSocieteInlineMap[forme];
  const initiales = forme;
  const titreParts = isSAS ? "actions" : "parts sociales";
  const titrePart = isSAS ? "action" : "part sociale";

  const managers: Personne[] = [
    ...associes.filter(a => a.isManager),
    ...extraManagers,
  ];

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

  // ═══ EN-TÊTE ═══
  addText("STATUTS CONSTITUTIFS", { bold: true, size: 18, align: "center", spacing: 4 });
  addText(body.companyName.toUpperCase(), { bold: true, size: 15, align: "center", spacing: 3 });
  addText(formeLongue, { italic: true, size: 12, align: "center", spacing: 10 });

  // Encadré synthèse
  const boxLines = [
    `Dénomination :  ${body.companyName}`,
    `Forme juridique :  ${initiales}`,
    `Capital social :  ${capitalStr}`,
    `Siège social :  ${addressPretty}`,
    `Durée :  99 années`,
  ];
  const boxLineH = 6;
  const boxPad = 4;
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

  // ═══ LES SOUSSIGNÉS / LE SOUSSIGNÉ ═══
  if (unipersonnel) {
    const u = associes[0];
    const soussigneLabel = u && u.gender === "F" ? "LA SOUSSIGNÉE" : "LE SOUSSIGNÉ";
    addText(soussigneLabel, { bold: true, size: 13, spacing: 4 });
    if (u) addText(`${civilStateSentence(u)}.`, { spacing: 4 });
  } else {
    addText("LES SOUSSIGNÉS", { bold: true, size: 13, spacing: 4 });
    associes.forEach((a, i) => {
      addText(`${i + 1}. ${civilStateSentence(a)} ;`, { spacing: 2 });
    });
    y += 2;
  }
  const introSoussignes = unipersonnel
    ? `A établi ainsi qu'il suit les statuts de la ${formeLongue} avec un associé unique qu'il a convenu de constituer.`
    : `Ont établi ainsi qu'il suit les statuts de la ${formeLongue} qu'ils ont convenu de constituer.`;
  addText(introSoussignes, { spacing: 8 });

  // ═══ ARTICLES ═══
  const article1Map: Record<EffectiveForm, string> = {
    SASU: "Il est formé par le soussigné une société par actions simplifiée unipersonnelle régie par les dispositions des articles L. 227-1 à L. 227-20 du Code de commerce, ainsi que par les présents statuts, avec un associé unique.",
    SAS: "Il est formé entre les soussignés une société par actions simplifiée régie par les dispositions des articles L. 227-1 à L. 227-20 du Code de commerce, ainsi que par les présents statuts.",
    EURL: "Il est formé par le soussigné une société à responsabilité limitée à associé unique régie par les articles L. 223-1 et suivants du Code de commerce, ainsi que par les présents statuts.",
    SARL: "Il est formé entre les soussignés une société à responsabilité limitée régie par les articles L. 223-1 et suivants du Code de commerce, ainsi que par les présents statuts.",
  };
  addArticle("Article 1 — Forme", [article1Map[forme]]);

  addArticle("Article 2 — Objet social", [
    `La société a pour objet : ${body.activity} ; et plus généralement, toutes opérations industrielles, commerciales, financières, mobilières ou immobilières, se rapportant directement ou indirectement à l'objet social ou susceptibles d'en faciliter l'extension ou le développement.`,
  ]);

  addArticle("Article 3 — Dénomination sociale", [
    `La société prend la dénomination de : ${body.companyName}. Dans tous les actes et documents émanant de la société, cette dénomination doit être précédée ou suivie immédiatement des mots ${titreSocieteInline} ou des initiales « ${initiales} », de l'énonciation du capital social, du numéro SIREN et de la mention RCS suivie du nom de la ville du greffe d'immatriculation.`,
  ]);

  addArticle("Article 4 — Siège social", [
    `Le siège social est fixé au : ${addressPretty}. Il peut être transféré en tout autre lieu par décision ${unipersonnel ? "de l'associé unique" : "des associés"}.`,
  ]);

  addArticle("Article 5 — Durée", [
    "La durée de la société est fixée à 99 années à compter de son immatriculation au Registre du Commerce et des Sociétés, sauf dissolution anticipée ou prorogation.",
  ]);

  // Article 6 — Apports et capital
  const article6: string[] = [];
  if (unipersonnel) {
    const unique = associes[0];
    article6.push(
      `L'associé unique apporte en numéraire la somme de ${capitalStr} (${capitalLettres} euros). Le capital social est fixé à ${capitalStr} (${capitalLettres} euros), divisé en ${body.capital} ${titreParts} de 1 € chacune, entièrement souscrites et libérées, attribuées en totalité à l'associé unique.`
    );
    if (unique) {
      article6.push(`${unique.fullName} : ${body.capital} ${titreParts} (100%).`);
    }
  } else {
    article6.push(
      `Les associés apportent en numéraire la somme totale de ${capitalStr} (${capitalLettres} euros). Le capital social est fixé à ${capitalStr} (${capitalLettres} euros), divisé en ${body.capital} ${titreParts} de 1 € chacune, entièrement souscrites et libérées.`
    );
    const lignes = associes.map(a => {
      const nb = Math.round((a.percent / 100) * body.capital);
      const noun = nb > 1 ? titreParts : titrePart;
      return `— ${a.fullName} : ${nb} ${noun} (${a.percent}%), soit un apport de ${formatEuro(nb)}`;
    }).join("\n");
    article6.push(`Répartition entre les associés :\n${lignes}`);
    const totalPct = associes.reduce((s, a) => s + a.percent, 0);
    article6.push(`Total : ${body.capital} ${titreParts} — ${totalPct}% du capital.`);
  }
  addArticle("Article 6 — Apports et capital social", article6);

  // Article 7 — Présidence / Gérance
  if (isSAS) {
    const paras: string[] = [
      "La société est dirigée et administrée par un Président, personne physique ou morale, associé ou non.",
    ];
    if (managers.length === 1) {
      paras.push(`Le premier Président est : ${civilStateSentence(managers[0])}.`);
    } else if (managers.length > 1) {
      paras.push("Les premiers Présidents sont :");
      managers.forEach((m, i) => paras.push(`${i + 1}. ${civilStateSentence(m)}.`));
    }
    paras.push("Le Président est investi des pouvoirs les plus étendus pour agir en toute circonstance au nom de la société, dans la limite de l'objet social. Il représente la société à l'égard des tiers.");
    paras.push(`Le Président est nommé sans limitation de durée. Il peut démissionner à tout moment sous réserve d'un préavis raisonnable. Sa rémunération est fixée par décision ${unipersonnel ? "de l'associé unique" : "collective des associés"}.`);
    addArticle("Article 7 — Présidence", paras);
  } else {
    const paras: string[] = [
      "La société est administrée par un ou plusieurs gérants, personnes physiques, associés ou non.",
    ];
    if (managers.length === 1) {
      paras.push(`Le premier gérant est : ${civilStateSentence(managers[0])}.`);
    } else if (managers.length > 1) {
      paras.push("Les premiers gérants (co-gérance) sont :");
      managers.forEach((m, i) => paras.push(`${i + 1}. ${civilStateSentence(m)}.`));
    }
    paras.push("Chaque gérant est investi des pouvoirs les plus étendus pour agir au nom de la société dans la limite de l'objet social et sous réserve des pouvoirs expressément attribués aux associés par la loi ou les présents statuts.");
    paras.push(`Le(s) gérant(s) est(sont) nommé(s) sans limitation de durée. Leur rémunération est fixée par décision ${unipersonnel ? "de l'associé unique" : "collective des associés"}.`);
    addArticle("Article 7 — Gérance", paras);
  }

  addArticle("Article 8 — Exercice social", [
    "L'exercice social commence le 1er janvier et se termine le 31 décembre de chaque année.",
    "Par exception, le premier exercice commencera à la date d'immatriculation de la société au RCS et se terminera le 31 décembre de la même année, ou de l'année suivante si l'immatriculation intervient après le 30 juin.",
  ]);

  if (unipersonnel) {
    addArticle("Article 9 — Décisions de l'associé unique", [
      "L'associé unique exerce les pouvoirs dévolus par la loi à la collectivité des associés. Ses décisions sont répertoriées dans un registre coté et paraphé.",
      `Relèvent de sa compétence exclusive : l'approbation des comptes annuels et l'affectation du résultat, la nomination et la révocation du ${dirigeantTitre === "Président" ? "Président" : "gérant"}, la modification des statuts, ainsi que la transformation, la dissolution ou la prorogation de la société.`,
    ]);
  } else if (isSAS) {
    addArticle("Article 9 — Décisions collectives", [
      "Les décisions collectives sont prises en assemblée générale ou, lorsque la loi le permet, par consultation écrite des associés.",
      "Les décisions ordinaires sont adoptées à la majorité des actions présentes ou représentées. Les décisions extraordinaires emportant modification des statuts sont adoptées dans les conditions fixées par les présents statuts, dans le respect des dispositions impératives des articles L. 227-9 et suivants du Code de commerce.",
    ]);
  } else {
    addArticle("Article 9 — Décisions collectives", [
      "Les décisions collectives sont prises en assemblée générale ou, lorsque la loi le permet, par consultation écrite des associés.",
      "Les décisions ordinaires sont adoptées à la majorité des parts sociales. Les décisions extraordinaires emportant modification des statuts sont adoptées aux majorités légales prévues par les articles L. 223-27 et suivants du Code de commerce.",
    ]);
  }

  if (unipersonnel) {
    addArticle(`Article 10 — Cession des ${titreParts}`, [
      `Tant que la société demeure unipersonnelle, l'associé unique cède librement ses ${titreParts}.`,
      "En cas de pluralité d'associés, les règles d'agrément légales s'appliquent.",
    ]);
  } else if (isSAS) {
    addArticle("Article 10 — Cession des actions", [
      "Les actions sont librement cessibles entre associés.",
      "Toute cession à un tiers étranger à la société est soumise à l'agrément préalable de la collectivité des associés dans les conditions prévues par la loi et, le cas échéant, par les présents statuts.",
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
    `${unipersonnel ? "L'associé unique peut" : "Les associés peuvent"} décider d'en nommer un volontairement.`,
  ]);

  addArticle("Article 13 — Résultats sociaux", [
    "Le bénéfice distribuable est constitué par le bénéfice de l'exercice, diminué des pertes antérieures et des sommes portées en réserve en application de la loi — notamment la réserve légale à hauteur de 5% du bénéfice, jusqu'à atteindre 10% du capital social — et augmenté du report bénéficiaire.",
  ]);

  addArticle("Article 14 — Dissolution — Liquidation", [
    `La société est dissoute à l'expiration de sa durée, ${unipersonnel ? "par décision de l'associé unique" : "par décision collective des associés"}, ou pour toute autre cause prévue par la loi.`,
    `La dissolution entraîne la liquidation, effectuée par le ${dirigeantTitre} ou tout liquidateur désigné par ${unipersonnel ? "l'associé unique" : "les associés"}, qui dispose des pouvoirs les plus étendus pour réaliser l'actif et apurer le passif.`,
  ]);

  // ═══ SIGNATURES ═══
  ensureSpace(60);
  y += 6;
  addText(`Fait à ${city}, le ${today}, en trois exemplaires originaux.`, { spacing: 12 });

  const signatureBlock = (label: string, name: string) => {
    ensureSpace(24);
    addText(label, { spacing: 10 });
    addText("_______________________________________", { spacing: 3 });
    addText(name, { bold: true, spacing: 6 });
  };

  if (unipersonnel) {
    const u = associes[0];
    const civU = u ? civilite(u.gender) : "M.";
    const isF = u?.gender === "F";
    const isMgr = u?.isManager;
    const associeWord = isF ? "associée" : "associé";
    const managerWord = isSAS ? (isF ? "Présidente" : "Président") : (isF ? "gérante" : "gérant");
    const suffix = isMgr ? ` et ${managerWord}` : "";
    signatureBlock(
      `Signature de l'${associeWord} unique${suffix} :`,
      `${civU} ${u?.fullName ?? ""} — ${associeWord} unique${suffix}`
    );
  } else {
    associes.forEach((a) => {
      const isF = a.gender === "F";
      const associeWord = isF ? "associée" : "associé";
      const managerWord = isSAS ? (isF ? "Présidente" : "Président") : (isF ? "gérante" : "gérant");
      const roles = a.isManager ? `${associeWord} et ${managerWord}` : associeWord;
      signatureBlock(`Signature de ${a.fullName} :`, `${civilite(a.gender)} ${a.fullName} — ${roles}`);
    });
    extraManagers.forEach((m) => {
      const isF = m.gender === "F";
      const managerWord = isSAS ? (isF ? "Présidente" : "Président") : (isF ? "gérante" : "gérant");
      const nonAssocieWord = isF ? "associée" : "associé";
      const role = `${managerWord} non ${nonAssocieWord}`;
      signatureBlock(`Signature de ${m.fullName} :`, `${civilite(m.gender)} ${m.fullName} — ${role}`);
    });
  }

  // Footer + pagination
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
  const isSARLFamily = body.type_societe === "SARL" || body.type_societe === "EURL";
  const isSASFamily = body.type_societe === "SAS" || body.type_societe === "SASU";
  const isSociete = isSARLFamily || isSASFamily;

  // Saisies personnalisées
  const remuMensuel = Math.max(0, Number(body.remuneration_dirigeant_mensuelle) || 0);
  const remuAnnuel = remuMensuel * 12;
  const nbSalaries = Math.max(0, Math.floor(Number(body.nb_salaries) || 0));
  const salaireMoyen = Math.max(0, Number(body.salaire_moyen_mensuel) || 0);
  const vehiculeMensuel = Math.max(0, Number(body.vehicule_mensuel) || 0);
  const loyerMensuel = Math.max(0, Number(body.loyer_mensuel) || 0);
  const assurances = Math.max(0, Number(body.assurances_annuelles) || 0);
  const comptable = Math.max(0, Number(body.comptable_annuel) || 0);
  const achatsMateriaux = Math.max(0, Number(body.achats_materiaux_annuels) || 0);
  const autres = Math.max(0, Number(body.autres_charges_annuelles) || 0);

  // ─── Plan de démarrage ───
  const investMateriel = Math.max(0, Number(body.investissement_materiel) || 0);
  const vehSituation = body.vehicule_situation;
  const vehMode = body.vehicule_mode;
  const empMontant = Math.max(0, Number(body.emprunt_montant) || 0);
  const empAnnees = Math.max(0, Number(body.emprunt_annees) || 0);
  const carnet = body.carnet_commandes;

  // Mensualité emprunt — taux indicatif 5%/an
  let mensualiteEmprunt = 0;
  if (empMontant > 0 && empAnnees > 0) {
    const r = 0.05 / 12;
    const n = empAnnees * 12;
    mensualiteEmprunt = (empMontant * r) / (1 - Math.pow(1 + r, -n));
  }
  const remboursementAnnuel = mensualiteEmprunt * 12;

  // Cotisations sociales dirigeant
  let cotisDirigeant = 0;
  if (isSARLFamily) cotisDirigeant = remuAnnuel * 0.45;          // TNS gérant majoritaire
  else if (isSASFamily) cotisDirigeant = remuAnnuel * 0.80;      // Président assimilé salarié
  else if (isAE) cotisDirigeant = ca * 0.22;                      // AE : cotisations sur CA

  // Masse salariale (coût total employeur)
  const masseSalariale = nbSalaries > 0 ? salaireMoyen * 12 * 1.80 * nbSalaries : 0;

  const vehiculeAnnuel = vehiculeMensuel * 12;
  const loyerAnnuel = loyerMensuel * 12;
  const cfe = 500;

  const totalCharges =
    remuAnnuel + cotisDirigeant + masseSalariale +
    vehiculeAnnuel + loyerAnnuel +
    assurances + comptable + achatsMateriaux + autres + cfe + remboursementAnnuel;

  // Trésorerie de départ : investissement + 3 mois de charges fixes (hors matériaux)
  const chargesFixesAnnuelles = totalCharges - achatsMateriaux;
  const besoinTresorerie = investMateriel + (chargesFixesAnnuelles / 12) * 3;

  const resultatAvantImpot = ca - totalCharges;
  let is = 0;
  if (isSociete && resultatAvantImpot > 0) {
    if (resultatAvantImpot <= 42500) is = resultatAvantImpot * 0.15;
    else is = 42500 * 0.15 + (resultatAvantImpot - 42500) * 0.25;
  }
  const resultatNet = resultatAvantImpot - is;
  const mensuel = resultatNet / 12;
  const isNegatif = resultatAvantImpot < 0;

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

  const drawRow = (label: string, value: string, bold = false, colorRed = false) => {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.rect(margin, y - 4, usable, 7);
    if (colorRed) doc.setTextColor(200, 30, 30); else doc.setTextColor(0, 0, 0);
    doc.text(label, margin + 2, y);
    doc.text(value, margin + usable - 2, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
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

  // ─── 1. PLAN DE DÉMARRAGE ───
  const hasPlan =
    investMateriel > 0 ||
    !!vehSituation ||
    empMontant > 0 ||
    !!carnet;

  if (hasPlan) {
    sectionTitle("1. PLAN DE DÉMARRAGE");

    if (investMateriel > 0) {
      drawRow("Investissement matériel initial", eur(investMateriel), true);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      const noteAmort = "Investissement amortissable — consultez votre comptable pour le plan d'amortissement.";
      const noteLines = doc.splitTextToSize(noteAmort, usable - 4);
      for (const l of noteLines) {
        if (y > 275) { doc.addPage(); y = margin; }
        doc.text(l, margin + 2, y);
        y += 4.5;
      }
      y += 2;
    }

    if (vehSituation) {
      const modeLabel: Record<string, string> = {
        cash: "Achat comptant",
        credit: "Crédit",
        leasing: "Leasing",
      };
      let vehStr = "";
      if (vehSituation === "owned") {
        vehStr = vehiculeMensuel > 0
          ? `Véhicule déjà détenu — ${eur(vehiculeMensuel)}/mois`
          : "Véhicule déjà détenu";
      } else if (vehSituation === "notNeeded") {
        vehStr = "Pas de véhicule";
      } else {
        const modeStr = vehMode ? modeLabel[vehMode] : "Mode à définir";
        vehStr = vehiculeMensuel > 0
          ? `${modeStr} — ${eur(vehiculeMensuel)}/mois`
          : modeStr;
      }
      drawRow("Véhicule", vehStr);
    }

    if (empMontant > 0 && empAnnees > 0) {
      drawRow(
        "Financement bancaire",
        `Emprunt ${eur(empMontant)} sur ${empAnnees} an(s) — mensualité ≈ ${eur(mensualiteEmprunt)} (taux indicatif 5%)`
      );
    } else {
      drawRow("Financement bancaire", "Aucun emprunt prévu");
    }

    if (carnet) {
      const carnetLabel: Record<string, string> = {
        acquired: "Clients acquis",
        promises: "Prospects en discussion",
        prospecting: "Prospection à démarrer",
      };
      drawRow("Carnet de commandes au démarrage", carnetLabel[carnet]);
    }

    drawRow(
      "Besoin de trésorerie initial estimé",
      `${eur(besoinTresorerie)}  (matériel ${eur(investMateriel)} + 3 mois charges fixes ${eur((chargesFixesAnnuelles / 12) * 3)})`,
      true
    );

    if (empMontant > 0 && empMontant < besoinTresorerie) {
      y += 1;
      if (y > 270) { doc.addPage(); y = margin; }
      doc.setFillColor(255, 245, 220);
      doc.rect(margin, y - 4, usable, 8, "F");
      doc.setTextColor(150, 90, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Attention : l'emprunt prévu est inférieur au besoin de trésorerie initial estimé — pensez à un apport ou un prêt qui couvre le démarrage.", margin + 3, y + 1, { maxWidth: usable - 6 });
      doc.setTextColor(0, 0, 0);
      y += 10;
    }
  }

  sectionTitle("2. CHIFFRE D'AFFAIRES PRÉVISIONNEL");
  drawRow("Chiffre d'affaires estimé (HT)", eur(ca), true);

  sectionTitle("3. CHARGES DÉTAILLÉES");
  if (isSociete) {
    drawRow("Rémunération dirigeant (net annuel)", eur(remuAnnuel));
    const tauxLabel = isSARLFamily
      ? "Cotisations sociales dirigeant TNS (~45% du net)"
      : "Cotisations sociales dirigeant assimilé salarié (~80% du net)";
    drawRow(tauxLabel, eur(cotisDirigeant));
  } else if (isAE) {
    drawRow("Cotisations URSSAF (22% du CA)", eur(cotisDirigeant));
  }
  if (nbSalaries > 0) {
    drawRow(
      `Masse salariale ${nbSalaries} salarié(s) — coût employeur (net × 1,80)`,
      eur(masseSalariale)
    );
  }
  if (vehiculeAnnuel > 0) drawRow("Véhicule (mensuel × 12)", eur(vehiculeAnnuel));
  if (loyerAnnuel > 0) drawRow("Loyer local (mensuel × 12)", eur(loyerAnnuel));
  if (assurances > 0) drawRow("Assurances (décennale + RC Pro)", eur(assurances));
  if (comptable > 0) drawRow("Comptable", eur(comptable));
  if (achatsMateriaux > 0) drawRow("Achats matériaux", eur(achatsMateriaux));
  if (autres > 0) drawRow("Autres charges (téléphone, banque, outils...)", eur(autres));
  if (remboursementAnnuel > 0) drawRow(`Remboursement d'emprunt (mensualité ≈ ${eur(mensualiteEmprunt)} × 12)`, eur(remboursementAnnuel));
  drawRow("CFE — estimation (variable selon commune)", eur(cfe));
  drawRow("TOTAL CHARGES", eur(totalCharges), true);

  sectionTitle("4. RÉSULTAT PRÉVISIONNEL");
  drawRow("Chiffre d'affaires", eur(ca));
  drawRow("Total charges", eur(totalCharges));
  drawRow("Résultat avant impôt", eur(resultatAvantImpot), true, isNegatif);
  if (isSociete && !isNegatif) drawRow("Impôt sur les Sociétés (15% jusqu'à 42 500 €, puis 25%)", eur(is));
  drawRow("Résultat net estimé", eur(resultatNet), true, resultatNet < 0);
  drawRow("Équivalent mensuel net", eur(mensuel), true, mensuel < 0);

  // Phrase de conclusion adaptée au carnet de commandes
  if (carnet) {
    y += 3;
    if (y > 265) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const phrase = carnet === "acquired"
      ? "Démarrage d'activité sécurisé par un carnet de commandes existant."
      : "Prévoir une montée en charge progressive du chiffre d'affaires sur la première année.";
    const pl = doc.splitTextToSize(phrase, usable - 4);
    for (const l of pl) {
      doc.text(l, margin + 2, y);
      y += 5;
    }
  }

  if (isNegatif) {
    y += 2;
    if (y > 265) { doc.addPage(); y = margin; }
    doc.setFillColor(255, 235, 235);
    doc.rect(margin, y - 4, usable, 10, "F");
    doc.setTextColor(180, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      "Attention : le résultat est négatif. Revoir les hypothèses ou réduire les charges.",
      margin + 3, y + 2
    );
    doc.setTextColor(0, 0, 0);
    y += 12;
  }

  sectionTitle("5. SEUILS IMPORTANTS À CONNAÎTRE");
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
  if (y > 255) { doc.addPage(); y = margin; }
  doc.setFillColor(255, 248, 220);
  doc.rect(margin, y - 4, usable, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Conseil Anafy Pro", margin + 3, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const conseil =
    "Ces chiffres sont des estimations. Consultez un expert-comptable pour valider votre prévisionnel avant dépôt au greffe. " +
    "Les taux de cotisations sont des estimations moyennes 2026 — consultez un expert-comptable.";
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

// ═══════════════════════════════════════════════════════════════════════
// DOCUMENT — ATTESTATION DE NON-CONDAMNATION ET DE FILIATION
// ═══════════════════════════════════════════════════════════════════════

export interface AttestationInput {
  person: Personne;
  denomination: string;
  role: "gérant" | "Président";
  signatureCity: string;
}

function fillOnesFooter(doc: jsPDF, pageWidth: number, usableWidth: number, margin: number, pageHeight: number) {
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
}

export function buildAttestationPdf(body: AttestationInput): jsPDF {
  const { person: p, denomination, role, signatureCity } = body;
  const isF = p.gender === "F";
  const soussigne = isF ? "Je soussignée" : "Je soussigné";
  const filsFille = isF ? "Fille" : "Fils";
  const neE = isF ? "née" : "né";
  const declare = isF ? "Déclare" : "Déclare";
  const informe = isF ? "Je suis informée" : "Je suis informé";
  const city = titleCasePlace((signatureCity || extractCity(p.address)).trim());
  const today = new Date().toLocaleDateString("fr-FR");
  const addr = titleCasePlace(p.address);
  const bp = titleCasePlace(p.birthPlace);
  // Extract country from birthPlace ("Ville, Pays") if present
  const bpParts = p.birthPlace.split(",").map(s => s.trim()).filter(Boolean);
  const pays = bpParts.length > 1 ? bpParts[bpParts.length - 1] : "";
  const bpCity = bpParts.length > 1 ? bpParts.slice(0, -1).join(", ") : p.birthPlace;
  const bpCityPretty = titleCasePlace(bpCity);
  const paysPretty = titleCasePlace(pays);
  const naissanceLieu = pays ? `${bpCityPretty} (${paysPretty})` : bp;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("times", "normal");
  const margin = 22;
  const pageWidth = 210;
  const pageHeight = 297;
  const usableWidth = pageWidth - 2 * margin;
  let y = margin;

  const addText = (text: string, opts: { bold?: boolean; size?: number; align?: "left" | "center"; spacing?: number } = {}) => {
    doc.setFont("times", opts.bold ? "bold" : "normal");
    const size = opts.size ?? 11;
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, usableWidth);
    const lh = 0.55 * size;
    for (const line of lines) {
      doc.text(line, opts.align === "center" ? pageWidth / 2 : margin, y, {
        align: opts.align === "center" ? "center" : "left",
      });
      y += lh;
    }
    y += opts.spacing ?? 3;
  };

  addText("ATTESTATION SUR L'HONNEUR", { bold: true, size: 16, align: "center", spacing: 2 });
  addText("DE NON-CONDAMNATION ET DE FILIATION", { bold: true, size: 16, align: "center", spacing: 12 });

  addText(
    `${soussigne} ${civilite(p.gender)} ${p.fullName}, ${neE} le ${p.birthDate} à ${naissanceLieu}, de nationalité ${p.nationality}, demeurant ${addr},`,
    { spacing: 6 }
  );

  const pere = titleCasePlace(p.fatherName || "");
  const mere = titleCasePlace(p.motherName || "");
  const startsWithVowel = (s: string) => /^[aeiouyàâäéèêëîïôöùûüh]/i.test((s || "").trim());
  const dePart = (name: string) => startsWithVowel(name) ? `d'${name}` : `de ${name}`;
  addText(`${filsFille} ${dePart(pere)} et ${dePart(mere)},`, { spacing: 6 });

  addText(
    `${declare} sur l'honneur, conformément à l'article A. 123-51 du Code de commerce, n'avoir fait l'objet d'aucune condamnation pénale, ni de sanction civile ou administrative de nature à m'interdire de gérer, d'administrer ou de diriger une personne morale, ou d'exercer une activité commerciale ou artisanale.`,
    { spacing: 5 }
  );

  addText(
    `Cette attestation est établie pour être produite à l'appui de la demande d'immatriculation de la société ${denomination} au Registre du Commerce et des Sociétés, dans le cadre de mes fonctions de ${role} de ladite société.`,
    { spacing: 5 }
  );

  addText(
    `${informe} que toute fausse déclaration est passible des sanctions prévues par l'article 441-1 du Code pénal.`,
    { spacing: 12 }
  );

  addText(`Fait à ${city}, le ${today}.`, { spacing: 18 });
  addText("Signature :", { spacing: 8 });
  addText("_______________________________________", { spacing: 4 });
  addText(`${civilite(p.gender)} ${p.fullName}`, { bold: true });

  fillOnesFooter(doc, pageWidth, usableWidth, margin, pageHeight);
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════
// DOCUMENT — BÉNÉFICIAIRES EFFECTIFS (fiche préparatoire)
// ═══════════════════════════════════════════════════════════════════════

export interface BeneficiairesInput {
  companyName: string;
  associes: AssocieDetail[];
  extraManagers?: Personne[];
  companyType: "SASU" | "SARL";
}

export async function buildBeneficiairesPdf(body: BeneficiairesInput): Promise<jsPDF> {
  const associes = body.associes ?? [];
  const extraManagers = body.extraManagers ?? [];
  const isSAS = body.companyType === "SASU";
  const roleTitle = isSAS ? "Président" : "gérant";

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
  const addText = (text: string, opts: { bold?: boolean; italic?: boolean; size?: number; align?: "left" | "center"; spacing?: number } = {}) => {
    const style = opts.bold && opts.italic ? "bolditalic" : opts.bold ? "bold" : opts.italic ? "italic" : "normal";
    doc.setFont("times", style);
    const size = opts.size ?? 11;
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, usableWidth);
    const lh = 0.55 * size;
    for (const line of lines) {
      if (y > bottomLimit) { doc.addPage(); y = margin; }
      doc.text(line, opts.align === "center" ? pageWidth / 2 : margin, y, {
        align: opts.align === "center" ? "center" : "left",
      });
      y += lh;
    }
    y += opts.spacing ?? 3;
  };

  addText("BÉNÉFICIAIRES EFFECTIFS", { bold: true, size: 16, align: "center", spacing: 2 });
  addText("FICHE PRÉPARATOIRE", { bold: true, size: 14, align: "center", spacing: 3 });
  addText(
    "À recopier lors de la déclaration en ligne sur le Guichet Unique INPI (la déclaration officielle se fait sur procedures.inpi.fr).",
    { italic: true, size: 10, align: "center", spacing: 8 }
  );
  addText(`Société : ${body.companyName}`, { bold: true, size: 12, spacing: 8 });

  const beneficiaires = associes.filter(a => a.percent > 25);

  const printBeneficiaire = (p: AssocieDetail | Personne, n: number, opts: { percent?: number; isManager?: boolean; note?: string }) => {
    ensureSpace(60);
    addText(`Bénéficiaire effectif n°${n}`, { bold: true, size: 12, spacing: 3 });
    const bp = titleCasePlace(p.birthPlace);
    const addr = titleCasePlace(p.address);
    addText(`• Nom complet : ${p.fullName}`, { spacing: 1 });
    addText(`• Date et lieu de naissance : ${p.birthDate} à ${bp}`, { spacing: 1 });
    addText(`• Nationalité : ${p.nationality}`, { spacing: 1 });
    addText(`• Adresse personnelle : ${addr}`, { spacing: 1 });
    if (typeof opts.percent === "number") {
      addText(`• Nature du contrôle : Détention de ${opts.percent}% du capital et des droits de vote`, { spacing: 1 });
    } else if (opts.note) {
      addText(`• Nature du contrôle : ${opts.note}`, { spacing: 1 });
    }
    if (opts.isManager) {
      addText(`• Exerce également la fonction de ${roleTitle}`, { spacing: 1 });
    }
    y += 4;
  };

  if (beneficiaires.length > 0) {
    beneficiaires.forEach((a, i) => {
      printBeneficiaire(a, i + 1, { percent: a.percent, isManager: a.isManager });
    });
  } else {
    addText(
      "Aucun associé ne détient plus de 25% du capital. En application de l'article R. 561-1 du Code monétaire et financier, le(s) dirigeant(s) doi(ven)t être déclaré(s) comme bénéficiaire(s) effectif(s) par défaut.",
      { italic: true, spacing: 6 }
    );
    const dirigeants: Array<AssocieDetail | Personne> = [
      ...associes.filter(a => a.isManager),
      ...extraManagers,
    ];
    if (dirigeants.length === 0 && associes.length > 0) dirigeants.push(associes[0]);
    dirigeants.forEach((d, i) => {
      const asAss = associes.find(a => a.fullName === d.fullName);
      printBeneficiaire(d, i + 1, {
        percent: asAss ? asAss.percent : undefined,
        isManager: true,
        note: asAss ? undefined : `Représentant légal (${roleTitle}) — bénéficiaire par défaut`,
      });
    });
  }

  // ─── Encadré d'avertissement en arabe (rendu via image pour éviter les glyphes corrompus) ───
  const warnText = "⚠️ الورقة دي للتحضير بس — التصريح الرسمي بيتم أونلاين على موقع INPI وقت تسجيل الشركة.";
  const warnImg = await renderArabicToImage(warnText, usableWidth - 6, {
    bold: true, size: 10, align: "center", color: "#785000", bg: "#FFF8DC",
  });
  const boxH = Math.max(20, (warnImg?.heightMm ?? 8) + 8);
  ensureSpace(boxH + 4);
  y += 4;
  doc.setDrawColor(200, 150, 0);
  doc.setFillColor(255, 248, 220);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, usableWidth, boxH, "FD");
  if (warnImg) {
    const imgX = margin + 3;
    const imgY = y + (boxH - warnImg.heightMm) / 2;
    doc.addImage(warnImg.dataUrl, "PNG", imgX, imgY, usableWidth - 6, warnImg.heightMm);
  }
  y += boxH + 4;

  fillOnesFooter(doc, pageWidth, usableWidth, margin, pageHeight);
  return doc;
}

// ═══════════════════════════════════════════════════════════════════════
// DOCUMENT — GUIDE DE DÉPÔT + LISTE DES PIÈCES (bilingue)
// ═══════════════════════════════════════════════════════════════════════

export async function buildGuideDepotPdf(): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("times", "normal");
  const margin = 22;
  const pageWidth = 210;
  const pageHeight = 297;
  const usableWidth = pageWidth - 2 * margin;
  const bottomLimit = 275;
  let y = margin;

  const addText = (text: string, opts: { bold?: boolean; italic?: boolean; size?: number; align?: "left" | "center"; spacing?: number } = {}) => {
    const style = opts.bold && opts.italic ? "bolditalic" : opts.bold ? "bold" : opts.italic ? "italic" : "normal";
    doc.setFont("times", style);
    const size = opts.size ?? 11;
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, usableWidth);
    for (const line of lines) {
      const dim = doc.getTextDimensions(line);
      const lh = dim.h;
      if (y + lh > bottomLimit) { doc.addPage(); y = margin; }
      doc.text(line, opts.align === "center" ? pageWidth / 2 : margin, y, {
        align: opts.align === "center" ? "center" : "left",
        baseline: "top",
      });
      y += lh;
    }
    y += opts.spacing ?? 3;
  };


  // Rend une ligne arabe en image, alignée à droite (RTL)
  const addArabic = async (text: string, opts: { bold?: boolean; size?: number; align?: "right" | "center"; spacing?: number } = {}) => {
    const rendered = await renderArabicToImage(text, usableWidth, {
      bold: opts.bold, size: opts.size ?? 11, align: opts.align ?? "right",
    });
    if (!rendered) return;
    if (y + rendered.heightMm > bottomLimit) { doc.addPage(); y = margin; }
    doc.addImage(rendered.dataUrl, "PNG", margin, y, usableWidth, rendered.heightMm);
    y += rendered.heightMm + (opts.spacing ?? 3);
  };

  // PAGE 1 — Liste des pièces
  await addArabic("📂 قائمة الأوراق المطلوبة لتسجيل شركتك", { bold: true, size: 15, align: "center", spacing: 3 });
  addText("Liste des pièces à fournir pour l'immatriculation", { italic: true, size: 12, align: "center", spacing: 10 });

  const pieces: Array<[string, string]> = [
    ["1. عقد التأسيس موقّع من كل الشركاء (كل صفحة لازم تتوقع بالأحرف الأولى)",
     "Statuts signés par tous les associés (parapher chaque page)"],
    ["2. شهادة إيداع رأس المال من البنك",
     "Attestation de dépôt des fonds"],
    ["3. إثبات عنوان مقر الشركة (فاتورة كهرباء أو عقد إيجار)",
     "Justificatif de siège social (facture ou bail)"],
    ["4. صورة بطاقة الهوية أو الإقامة لكل مدير",
     "Pièce d'identité de chaque dirigeant"],
    ["5. شهادة عدم الإدانة والنسب لكل مدير (Anafy Pro بيولّدهالك ✅)",
     "Attestation de non-condamnation et de filiation"],
    ["6. بيانات المستفيدين الفعليين (التصريح أونلاين — استخدم الفيشة اللي ولّدناهالك ✅)",
     "Bénéficiaires effectifs (déclaration en ligne)"],
    ["7. لو نشاطك منظّم (كهرباء، غاز...): شهادة المؤهل أو الخبرة",
     "Justificatif de qualification professionnelle si activité réglementée"],
  ];
  for (const [ar, fr] of pieces) {
    await addArabic(ar, { size: 11, spacing: 2 });
    addText(fr, { italic: true, size: 10, spacing: 6 });
  }


  // PAGE 2 — Guide étapes
  doc.addPage();
  y = margin;
  await addArabic("📖 إزاي تسجّل شركتك على Guichet Unique خطوة بخطوة", { bold: true, size: 14, align: "center", spacing: 3 });
  addText("Guide de dépôt étape par étape sur procedures.inpi.fr", { italic: true, size: 12, align: "center", spacing: 10 });

  const etapes: Array<[string, string]> = [
    ["1️⃣ افتح procedures.inpi.fr واعمل حساب",
     "Créer un compte sur procedures.inpi.fr"],
    ["2️⃣ اختار « Déposer une formalité de création d'entreprise »",
     "Choisir « Déposer une formalité de création d'entreprise »"],
    ["3️⃣ املا البيانات — كلها موجودة في عقد التأسيس اللي معاك",
     "Remplir les informations (déjà présentes dans vos statuts)"],
    ["4️⃣ ارفع الأوراق (PDF) واحدة واحدة",
     "Téléverser les pièces justificatives (PDF) une par une"],
    ["5️⃣ ادفع رسوم التسجيل أونلاين",
     "Régler les frais d'immatriculation en ligne"],
    ["6️⃣ هتستلم رقم SIRET خلال أيام على إيميلك",
     "Réception du numéro SIRET par email sous quelques jours"],
  ];
  for (const [ar, fr] of etapes) {
    await addArabic(ar, { size: 11, spacing: 1 });
    addText(fr, { italic: true, size: 10, spacing: 6 });
  }

  // Encadré final — texte arabe rendu en image
  const arTitle = "💬 محتاج مساعدة في أي خطوة؟ اسأل شبيك لبيك";
  const arTitleImg = await renderArabicToImage(arTitle, usableWidth - 6, {
    bold: true, size: 11, align: "center", color: "#143C82", bg: "#E6F0FF",
  });
  const encH = Math.max(22, (arTitleImg?.heightMm ?? 8) + 14);
  if (y + encH > bottomLimit) { doc.addPage(); y = margin; }
  y += 4;
  doc.setDrawColor(30, 100, 180);
  doc.setFillColor(230, 240, 255);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, usableWidth, encH, "FD");
  if (arTitleImg) {
    doc.addImage(arTitleImg.dataUrl, "PNG", margin + 3, y + 3, usableWidth - 6, arTitleImg.heightMm);
  }
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(20, 60, 130);
  doc.text("Ouvre INPI traduit en arabe sur anafypro.com/anafy-translate", pageWidth / 2, y + encH - 4, { align: "center", maxWidth: usableWidth - 6 });
  doc.setTextColor(0);
  y += encH + 4;

  fillOnesFooter(doc, pageWidth, usableWidth, margin, pageHeight);
  return doc;
}



