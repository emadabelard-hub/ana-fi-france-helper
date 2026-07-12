// Templates intégraux des statuts (SARL / EURL / SAS / SASU).
// Textes juridiquement calibrés — ne pas résumer/modifier.
// Le pipeline PDF (buildStatutsPdf) consomme ces blocs, numérote les articles
// séquentiellement (sans trou) et conserve les intitulés de TITRES.

import type { AssocieDetail, Personne } from "./creationPdf";

export type StatutsBlock =
  | { kind: "title"; text: string }
  | { kind: "article"; heading: string; paragraphs: string[] };

export interface StatutsCtx {
  denomination: string;
  capitalStr: string;
  capitalLettres: string;
  nbParts: number;
  valeurPart: string; // ex: "1 €"
  siege: string;
  objet: string;
  duree: string; // ex: "99"
  associes: AssocieDetail[];
  managers: Personne[];
  isUnipersonnel: boolean;
  // helpers déjà résolus
  civilStateSentence: (p: Personne) => string;
  formatEuro: (n: number) => string;
}

// ─────────────────── SARL (36 articles / 7 titres) ───────────────────
export function buildSarlBlocks(ctx: StatutsCtx): StatutsBlock[] {
  const { denomination, capitalStr, capitalLettres, nbParts, valeurPart, siege, objet, duree, associes, managers, civilStateSentence, formatEuro } = ctx;

  // Répartition des parts (nb = pct * total / 100)
  const parts = associes.map(a => {
    const nb = Math.round((a.percent / 100) * nbParts);
    const apport = nb * 1; // valeur nominale 1€
    return { a, nb, apport };
  });
  let running = 1;
  const partsLines = parts.map(({ a, nb, apport }) => {
    const from = running;
    const to = running + nb - 1;
    running = to + 1;
    return `— ${a.fullName} : ${nb} parts sociales, numérotées de ${from} à ${to}, soit ${a.percent}% du capital (apport de ${formatEuro(apport)}) ;`;
  }).join("\n");
  const apportsLines = parts.map(({ a, apport }) => `— ${a.fullName} : apport de ${formatEuro(apport)} ;`).join("\n");
  const totalPct = associes.reduce((s, a) => s + a.percent, 0);

  const managersList = managers.length === 1
    ? `Le premier gérant de la société est : ${civilStateSentence(managers[0])} ;`
    : `Les premiers gérants de la société sont :\n${managers.map(m => `— ${civilStateSentence(m)} ;`).join("\n")}`;
  const acceptent = managers.length > 1 ? "nommés sans limitation de durée, qui déclarent accepter ces fonctions et n'être frappés d'aucune incompatibilité ni d'aucune interdiction susceptible d'en empêcher l'exercice." : "nommé sans limitation de durée, qui déclare accepter ces fonctions et n'être frappé d'aucune incompatibilité ni d'aucune interdiction susceptible d'en empêcher l'exercice.";

  return [
    { kind: "title", text: "TITRE I — FORME, DÉNOMINATION, OBJET, SIÈGE, DURÉE" },
    { kind: "article", heading: "Forme", paragraphs: [
      "Il est formé entre les soussignés, propriétaires des parts sociales ci-après créées, une société à responsabilité limitée régie par les articles L. 223-1 et suivants du Code de commerce, par toutes les dispositions légales et réglementaires en vigueur, ainsi que par les présents statuts.",
    ]},
    { kind: "article", heading: "Dénomination sociale", paragraphs: [
      `La société prend la dénomination de : ${denomination}.`,
      "Dans tous les actes et documents émanant de la société et destinés aux tiers, cette dénomination doit être précédée ou suivie immédiatement des mots « société à responsabilité limitée » ou des initiales « SARL », de l'énonciation du montant du capital social, du numéro d'identification SIREN et de la mention RCS suivie du nom de la ville où se trouve le greffe où elle est immatriculée.",
    ]},
    { kind: "article", heading: "Objet social", paragraphs: [
      `La société a pour objet, en France et à l'étranger : ${objet} ;`,
      "Et plus généralement, toutes opérations industrielles, commerciales, financières, mobilières ou immobilières se rapportant directement ou indirectement à l'objet social ou susceptibles d'en faciliter l'extension ou le développement, ainsi que la participation de la société, par tous moyens, à toutes entreprises ou sociétés créées ou à créer pouvant se rattacher à l'objet social.",
    ]},
    { kind: "article", heading: "Siège social", paragraphs: [
      `Le siège social est fixé au : ${siege}.`,
      "Il peut être transféré en tout autre lieu du même département ou d'un département limitrophe par décision de la gérance, sous réserve de ratification par la prochaine décision ordinaire des associés, et partout ailleurs en vertu d'une décision extraordinaire des associés.",
    ]},
    { kind: "article", heading: "Durée", paragraphs: [
      `La durée de la société est fixée à ${duree} années à compter de la date de son immatriculation au Registre du Commerce et des Sociétés, sauf dissolution anticipée ou prorogation décidée par les associés dans les conditions prévues aux présents statuts.`,
    ]},
    { kind: "article", heading: "Actes accomplis pour le compte de la société en formation", paragraphs: [
      "Un état des actes accomplis pour le compte de la société en formation, avec l'indication pour chacun d'eux de l'engagement qui en résulterait pour la société, est annexé aux présents statuts. La signature des statuts emportera reprise de ces engagements par la société lorsqu'elle aura été immatriculée au Registre du Commerce et des Sociétés.",
      "En outre, les associés donnent mandat à la gérance de prendre, pour le compte de la société, les engagements nécessaires entre la signature des statuts et l'immatriculation ; l'immatriculation emportera reprise de ces engagements par la société.",
    ]},

    { kind: "title", text: "TITRE II — APPORTS, CAPITAL SOCIAL, PARTS SOCIALES" },
    { kind: "article", heading: "Apports", paragraphs: [
      `Les associés apportent à la société, en numéraire, la somme totale de ${capitalStr} (${capitalLettres}), soit :`,
      apportsLines,
      "Cette somme a été déposée, dès avant la signature des présents statuts, sur un compte ouvert au nom de la société en formation, ainsi qu'en atteste le certificat du dépositaire. Elle sera retirée par la gérance sur présentation du certificat du greffe attestant l'immatriculation de la société au Registre du Commerce et des Sociétés.",
      "En cas d'apports en nature ou en industrie, ceux-ci seraient soumis aux dispositions des articles L. 223-7 et suivants du Code de commerce et feraient l'objet d'une évaluation dans les conditions légales.",
    ]},
    { kind: "article", heading: "Capital social", paragraphs: [
      `Le capital social est fixé à la somme de ${capitalStr} (${capitalLettres}).`,
      `Il est divisé en ${nbParts} parts sociales de ${valeurPart} chacune, entièrement souscrites et intégralement libérées, numérotées de 1 à ${nbParts}, attribuées aux associés en proportion de leurs apports respectifs, à savoir :`,
      partsLines,
      `Total : ${nbParts} parts sociales — ${totalPct} % du capital social.`,
      "Les soussignés déclarent expressément que ces parts ont été réparties entre eux dans les proportions ci-dessus indiquées et qu'elles sont toutes souscrites et intégralement libérées.",
    ]},
    { kind: "article", heading: "Représentation des parts sociales", paragraphs: [
      "Les parts sociales ne peuvent être représentées par des titres négociables. Le titre de chaque associé résulte uniquement des présents statuts, des actes ultérieurs qui pourraient modifier le capital social et des cessions ou mutations qui seraient régulièrement consenties, constatées et publiées.",
    ]},
    { kind: "article", heading: "Augmentation et réduction du capital", paragraphs: [
      "Le capital social peut être augmenté ou réduit, en une ou plusieurs fois, en vertu d'une décision extraordinaire des associés, dans les conditions prévues par la loi et les présents statuts.",
      "En cas d'augmentation de capital par souscription de parts en numéraire, les fonds provenant de la libération des parts doivent faire l'objet d'un dépôt dans les conditions légales.",
      "La réduction du capital ne peut en aucun cas porter atteinte à l'égalité des associés. La réduction du capital à un montant inférieur au minimum légal éventuellement applicable ne peut être décidée que sous la condition suspensive d'une augmentation de capital destinée à ramener celui-ci à un montant au moins égal à ce minimum, à moins que la société ne se transforme en société d'une autre forme.",
    ]},
    { kind: "article", heading: "Droits et obligations attachés aux parts sociales", paragraphs: [
      "Chaque part sociale confère à son propriétaire un droit égal dans les bénéfices de la société et dans tout l'actif social, ainsi qu'une voix dans tous les votes et délibérations.",
      "Les associés ne sont tenus des dettes sociales que jusqu'à concurrence du montant de leurs apports. La propriété d'une part emporte de plein droit adhésion aux présents statuts et aux décisions collectives régulièrement prises par les associés.",
      "Les représentants, ayants droit, héritiers et créanciers d'un associé ne peuvent, sous quelque prétexte que ce soit, requérir l'apposition de scellés sur les biens et documents de la société, ni s'immiscer en aucune manière dans les actes de son administration.",
    ]},

    { kind: "title", text: "TITRE III — CESSION ET TRANSMISSION DES PARTS SOCIALES" },
    { kind: "article", heading: "Cessions entre associés, conjoints, ascendants et descendants", paragraphs: [
      "Les parts sociales sont librement cessibles entre associés, ainsi qu'entre conjoints et entre ascendants et descendants.",
      "Toute cession de parts doit être constatée par écrit. Elle est rendue opposable à la société dans les formes prévues à l'article 1690 du Code civil ou par le dépôt d'un original de l'acte de cession au siège social contre remise par le gérant d'une attestation de ce dépôt. Elle n'est opposable aux tiers qu'après l'accomplissement de ces formalités et le dépôt des statuts modifiés au Registre du Commerce et des Sociétés.",
    ]},
    { kind: "article", heading: "Agrément des cessions à des tiers", paragraphs: [
      "Les parts sociales ne peuvent être cédées à des tiers étrangers à la société qu'avec le consentement de la majorité des associés représentant au moins la moitié des parts sociales, conformément à l'article L. 223-14 du Code de commerce.",
      "Le projet de cession est notifié à la société et à chacun des associés par lettre recommandée avec demande d'avis de réception ou par acte extrajudiciaire. Dans le délai de huit jours à compter de cette notification, la gérance convoque l'assemblée des associés pour qu'elle délibère sur le projet, ou consulte les associés par écrit.",
      "Si la société n'a pas fait connaître sa décision dans le délai de trois mois à compter de la dernière des notifications, le consentement à la cession est réputé acquis.",
      "Si la société refuse de consentir à la cession, les associés sont tenus, dans le délai de trois mois à compter de ce refus, d'acquérir ou de faire acquérir les parts à un prix fixé dans les conditions prévues à l'article 1843-4 du Code civil. À la demande de la gérance, ce délai peut être prolongé par décision de justice, sans que cette prolongation puisse excéder six mois.",
      "La société peut également, avec le consentement de l'associé cédant, décider dans le même délai de réduire son capital du montant de la valeur nominale des parts de cet associé et de racheter ces parts au prix déterminé dans les conditions prévues ci-dessus.",
      "Si, à l'expiration du délai imparti, aucune des solutions prévues ci-dessus n'est intervenue, l'associé peut réaliser la cession initialement projetée, à condition qu'il détienne ses parts depuis au moins deux ans ou qu'il les ait reçues par voie de succession, de liquidation de communauté de biens entre époux ou de donation à son conjoint, à un ascendant ou à un descendant.",
    ]},
    { kind: "article", heading: "Transmission par décès", paragraphs: [
      "La société n'est pas dissoute par le décès d'un associé. Elle continue entre les associés survivants et les héritiers ou ayants droit de l'associé décédé, et éventuellement son conjoint survivant, sous réserve de l'agrément des intéressés par la majorité des associés survivants représentant au moins la moitié des parts sociales, dans les conditions prévues à l'article précédent des présents statuts.",
      "En cas de refus d'agrément, il est fait application des dispositions dudit article. Tant que subsiste l'indivision successorale, les droits attachés aux parts de l'associé décédé sont exercés par un mandataire commun désigné par les indivisaires ou, à défaut d'accord, par le président du tribunal de commerce statuant en référé.",
    ]},
    { kind: "article", heading: "Dissolution de communauté du vivant de l'associé", paragraphs: [
      "En cas de dissolution de communauté de biens entre époux par divorce, séparation de corps, séparation judiciaire de biens ou changement de régime matrimonial, l'attribution de parts communes à l'époux ou ex-époux qui n'a pas la qualité d'associé est soumise à l'agrément prévu aux présents statuts.",
    ]},
    { kind: "article", heading: "Incapacité ou déconfiture d'un associé", paragraphs: [
      "La société n'est pas dissoute par l'incapacité, la faillite personnelle, la liquidation ou le redressement judiciaire frappant l'un des associés. Elle continue entre les autres associés et, le cas échéant, avec le représentant de l'associé concerné dans les conditions légales.",
    ]},
    { kind: "article", heading: "Nantissement des parts sociales", paragraphs: [
      "Si la société a donné son consentement à un projet de nantissement de parts sociales dans les conditions prévues à l'article L. 223-15 du Code de commerce, ce consentement emportera agrément du cessionnaire en cas de réalisation forcée des parts nanties, à moins que la société ne préfère, après la cession, racheter sans délai les parts en vue de réduire son capital.",
    ]},

    { kind: "title", text: "TITRE IV — GÉRANCE" },
    { kind: "article", heading: "Nomination de la gérance", paragraphs: [
      "La société est administrée par un ou plusieurs gérants, personnes physiques, associés ou non, nommés par décision des associés représentant plus de la moitié des parts sociales, avec ou sans limitation de durée.",
      managersList,
      acceptent,
    ]},
    { kind: "article", heading: "Pouvoirs de la gérance", paragraphs: [
      "Dans les rapports avec les tiers, chaque gérant est investi des pouvoirs les plus étendus pour agir en toute circonstance au nom de la société, sous réserve des pouvoirs que la loi attribue expressément aux associés. La société est engagée même par les actes du gérant qui ne relèvent pas de l'objet social, à moins qu'elle ne prouve que le tiers savait que l'acte dépassait cet objet ou qu'il ne pouvait l'ignorer compte tenu des circonstances.",
      "Dans les rapports entre associés, la gérance peut accomplir tous actes de gestion dans l'intérêt de la société. L'opposition formée par un gérant aux actes d'un autre gérant est sans effet à l'égard des tiers, à moins qu'il ne soit établi qu'ils en ont eu connaissance.",
      "La gérance peut, sous sa responsabilité personnelle, déléguer temporairement certains de ses pouvoirs à toute personne de son choix pour un ou plusieurs objets déterminés.",
    ]},
    { kind: "article", heading: "Rémunération de la gérance", paragraphs: [
      "Chaque gérant a droit, en rémunération de ses fonctions, à un traitement fixe ou proportionnel, ou à la fois fixe et proportionnel, dont le montant et les modalités de paiement sont déterminés par décision ordinaire des associés. Le gérant a droit, en outre, au remboursement de ses frais de représentation et de déplacement sur justificatifs.",
    ]},
    { kind: "article", heading: "Responsabilité de la gérance", paragraphs: [
      "Les gérants sont responsables, individuellement ou solidairement selon le cas, envers la société ou envers les tiers, des infractions aux dispositions législatives ou réglementaires applicables aux sociétés à responsabilité limitée, des violations des présents statuts, ainsi que des fautes commises dans leur gestion.",
    ]},
    { kind: "article", heading: "Cessation des fonctions de la gérance", paragraphs: [
      "Les fonctions de gérant cessent par le décès, l'incapacité, l'interdiction de gérer, la faillite personnelle, la démission ou la révocation.",
      "Tout gérant peut démissionner de ses fonctions en prévenant les associés au moins trois mois à l'avance, par lettre recommandée avec demande d'avis de réception.",
      "Tout gérant est révocable par décision des associés représentant plus de la moitié des parts sociales. Si la révocation est décidée sans juste motif, elle peut donner lieu à dommages et intérêts. En outre, le gérant est révocable par les tribunaux pour cause légitime, à la demande de tout associé.",
      "La cessation des fonctions d'un gérant, pour quelque cause que ce soit, n'entraîne pas la dissolution de la société.",
    ]},
    { kind: "article", heading: "Conventions entre la société et ses gérants ou associés", paragraphs: [
      "Toute convention intervenue directement ou par personne interposée entre la société et l'un de ses gérants ou associés est soumise aux procédures de contrôle prévues par l'article L. 223-19 du Code de commerce : le gérant ou, s'il en existe un, le commissaire aux comptes, présente à l'assemblée un rapport sur ces conventions, et l'assemblée statue sur ce rapport, le gérant ou l'associé intéressé ne pouvant prendre part au vote.",
      "Les conventions portant sur des opérations courantes et conclues à des conditions normales ne sont pas soumises à cette procédure.",
      "À peine de nullité du contrat, il est interdit aux gérants et aux associés personnes physiques, conformément à l'article L. 223-21 du Code de commerce, de contracter sous quelque forme que ce soit des emprunts auprès de la société, de se faire consentir par elle un découvert en compte courant ou autrement, ainsi que de faire cautionner ou avaliser par elle leurs engagements envers les tiers. Cette interdiction s'applique également aux conjoints, ascendants et descendants des personnes visées ci-dessus, ainsi qu'à toute personne interposée.",
    ]},

    { kind: "title", text: "TITRE V — DÉCISIONS COLLECTIVES" },
    { kind: "article", heading: "Modalités des décisions collectives", paragraphs: [
      "La volonté des associés s'exprime par des décisions collectives, qualifiées d'ordinaires ou d'extraordinaires selon leur objet.",
      "Les décisions collectives sont prises, au choix de la gérance, en assemblée générale ou par consultation écrite des associés. Toutefois, la réunion d'une assemblée est obligatoire pour statuer sur l'approbation annuelle des comptes ou lorsque la tenue d'une assemblée est demandée par un ou plusieurs associés dans les conditions légales.",
      "Les décisions collectives peuvent également résulter du consentement de tous les associés exprimé dans un acte.",
      "Chaque associé a le droit de participer aux décisions et dispose d'un nombre de voix égal à celui des parts sociales qu'il possède. Un associé peut se faire représenter par son conjoint ou par un autre associé, à moins que la société ne comprenne que deux époux ou que deux associés.",
    ]},
    { kind: "article", heading: "Décisions ordinaires", paragraphs: [
      "Sont qualifiées d'ordinaires les décisions des associés ne concernant ni les modifications statutaires, ni l'agrément de cessions ou transmissions de parts soumis aux majorités spécifiques prévues par la loi.",
      "Les décisions ordinaires doivent, pour être valables, être adoptées par un ou plusieurs associés représentant plus de la moitié des parts sociales. Si cette majorité n'est pas obtenue à la première consultation, les associés sont, selon le cas, convoqués ou consultés une seconde fois, et les décisions sont alors prises à la majorité des votes émis, quel que soit le nombre des votants, à moins que les présents statuts n'en disposent autrement pour certaines décisions.",
      "Chaque année, dans les six mois de la clôture de l'exercice, les associés statuent en assemblée sur les comptes dudit exercice.",
    ]},
    { kind: "article", heading: "Décisions extraordinaires", paragraphs: [
      "Sont qualifiées d'extraordinaires les décisions ayant pour objet la modification des statuts, sous réserve des exceptions prévues par la loi.",
      "L'assemblée ne délibère valablement que si les associés présents ou représentés possèdent au moins, sur première convocation, le quart des parts sociales et, sur deuxième convocation, le cinquième de celles-ci. À défaut de ce quorum, la deuxième assemblée peut être prorogée à une date postérieure de deux mois au plus à celle à laquelle elle avait été convoquée.",
      "Les modifications statutaires sont décidées à la majorité des deux tiers des parts détenues par les associés présents ou représentés, conformément à l'article L. 223-30 du Code de commerce.",
      "Par exception : le changement de nationalité de la société et l'augmentation des engagements des associés exigent l'unanimité ; la transformation de la société est décidée dans les conditions prévues par la loi.",
    ]},
    { kind: "article", heading: "Assemblées générales — convocation et tenue", paragraphs: [
      "Les assemblées générales sont convoquées par la gérance ou, à défaut, par le commissaire aux comptes s'il en existe un, ou encore par un mandataire de justice dans les conditions légales. La convocation est adressée à chaque associé, par lettre recommandée ou par courrier électronique dans les conditions légales, quinze jours au moins avant la date de la réunion ; elle indique l'ordre du jour.",
      "L'assemblée est présidée par le gérant ou, si aucun gérant n'est associé, par l'associé présent et acceptant qui possède ou représente le plus grand nombre de parts sociales.",
      "En cas de consultation écrite, la gérance adresse à chaque associé, par lettre recommandée, le texte des résolutions proposées ainsi que les documents nécessaires à son information ; les associés disposent d'un délai de quinze jours à compter de la date de réception pour émettre leur vote par écrit.",
    ]},
    { kind: "article", heading: "Procès-verbaux", paragraphs: [
      "Toute délibération de l'assemblée des associés est constatée par un procès-verbal indiquant la date et le lieu de la réunion, les nom, prénoms et qualité du président de séance, les noms des associés présents ou représentés avec l'indication du nombre de parts détenues par chacun, les documents et rapports soumis à l'assemblée, un résumé des débats, le texte des résolutions mises aux voix et le résultat des votes.",
      "En cas de consultation écrite, il en est fait mention dans le procès-verbal, auquel est annexée la réponse de chaque associé.",
      "Les procès-verbaux sont établis et signés par la gérance sur un registre spécial coté et paraphé, tenu au siège social conformément à la réglementation en vigueur.",
    ]},
    { kind: "article", heading: "Information des associés", paragraphs: [
      "Chaque associé a le droit, à toute époque, de prendre connaissance au siège social des documents prévus par la loi et concernant les trois derniers exercices sociaux.",
      "Quinze jours au moins avant l'assemblée d'approbation des comptes, les comptes annuels, le rapport de gestion, le texte des résolutions proposées et, le cas échéant, le rapport du commissaire aux comptes sont adressés à chaque associé. Tout associé peut, en outre, poser par écrit des questions auxquelles la gérance est tenue de répondre au cours de l'assemblée.",
    ]},

    { kind: "title", text: "TITRE VI — EXERCICE SOCIAL, COMPTES, AFFECTATION DES RÉSULTATS" },
    { kind: "article", heading: "Exercice social", paragraphs: [
      "L'exercice social commence le 1er janvier et se termine le 31 décembre de chaque année.",
      "Par exception, le premier exercice commencera à la date de l'immatriculation de la société au Registre du Commerce et des Sociétés et se terminera le 31 décembre de la même année ou, si l'immatriculation intervient après le 30 juin, le 31 décembre de l'année suivante.",
    ]},
    { kind: "article", heading: "Comptes sociaux", paragraphs: [
      "Il est tenu une comptabilité régulière des opérations sociales conformément à la loi et aux usages du commerce. À la clôture de chaque exercice, la gérance dresse l'inventaire des divers éléments de l'actif et du passif, établit les comptes annuels (bilan, compte de résultat et annexe) ainsi que le rapport de gestion dans les conditions prévues par la loi.",
    ]},
    { kind: "article", heading: "Affectation et répartition des résultats", paragraphs: [
      "Le bénéfice distribuable est constitué par le bénéfice de l'exercice, diminué des pertes antérieures et des sommes portées en réserve en application de la loi — notamment la dotation à la réserve légale, à hauteur d'un vingtième au moins du bénéfice de l'exercice jusqu'à ce que cette réserve atteigne le dixième du capital social — et augmenté du report bénéficiaire.",
      "Ce bénéfice est réparti entre les associés proportionnellement au nombre de parts appartenant à chacun d'eux. Toutefois, les associés peuvent, sur proposition de la gérance, décider d'affecter tout ou partie du bénéfice distribuable à des comptes de réserves ou de le reporter à nouveau.",
      "Les pertes, s'il en existe, sont imputées sur les bénéfices reportés des exercices antérieurs ou reportées à nouveau.",
    ]},
    { kind: "article", heading: "Capitaux propres inférieurs à la moitié du capital social", paragraphs: [
      "Si, du fait des pertes constatées dans les documents comptables, les capitaux propres de la société deviennent inférieurs à la moitié du capital social, la gérance est tenue, dans les quatre mois qui suivent l'approbation des comptes ayant fait apparaître ces pertes, de consulter les associés afin de décider s'il y a lieu à dissolution anticipée de la société, dans les conditions prévues à l'article L. 223-42 du Code de commerce. La décision des associés fait l'objet des formalités de publicité prévues par la réglementation en vigueur.",
    ]},
    { kind: "article", heading: "Commissaires aux comptes", paragraphs: [
      "La nomination d'un commissaire aux comptes n'est obligatoire que si la société dépasse les seuils fixés par la réglementation en vigueur. Les associés peuvent, en outre, nommer volontairement un commissaire aux comptes dans les conditions de l'article L. 223-35 du Code de commerce.",
    ]},

    { kind: "title", text: "TITRE VII — DISSOLUTION, LIQUIDATION, CONTESTATIONS" },
    { kind: "article", heading: "Dissolution — Liquidation", paragraphs: [
      "La société est dissoute à l'expiration de la durée fixée par les statuts, sauf prorogation, par décision collective extraordinaire des associés, ou pour toute autre cause prévue par la loi.",
      "La dissolution entraîne la liquidation de la société. Elle est effectuée par le ou les gérants alors en fonction ou par tout liquidateur désigné par la décision collective qui prononce la dissolution. Le liquidateur dispose des pouvoirs les plus étendus pour réaliser l'actif, apurer le passif et répartir le solde disponible entre les associés proportionnellement au nombre de leurs parts.",
      "La personnalité morale de la société subsiste pour les besoins de la liquidation jusqu'à la clôture de celle-ci.",
    ]},
    { kind: "article", heading: "Contestations — Frais", paragraphs: [
      "Toutes contestations qui pourraient s'élever pendant la durée de la société ou lors de sa liquidation, soit entre les associés, soit entre la société et les associés, relativement aux affaires sociales ou à l'exécution des présents statuts, seront soumises aux tribunaux compétents du lieu du siège social.",
      "Les frais, droits et honoraires des présents statuts et de leurs suites, ainsi que l'ensemble des frais de constitution, seront pris en charge par la société et portés au compte des frais généraux du premier exercice social.",
    ]},
  ];
}

// ─────────────────── EURL (SARL 1 associé) ───────────────────
export function buildEurlBlocks(ctx: StatutsCtx): StatutsBlock[] {
  const { denomination, capitalStr, capitalLettres, nbParts, valeurPart, siege, objet, duree, associes, managers, civilStateSentence } = ctx;
  const u = associes[0];
  const isF = u?.gender === "F";
  const soussigneVerb = isF ? "La soussignée a" : "Le soussigné a";
  const ilElle = isF ? "elle" : "il";
  const formePar = isF ? "par la soussignée" : "par le soussigné";
  const managersList = managers.length === 1
    ? `Le premier gérant de la société est : ${civilStateSentence(managers[0])} ;`
    : `Les premiers gérants de la société sont :\n${managers.map(m => `— ${civilStateSentence(m)} ;`).join("\n")}`;
  const acceptent = managers.length > 1 ? "nommés sans limitation de durée, qui déclarent accepter ces fonctions et n'être frappés d'aucune incompatibilité ni d'aucune interdiction susceptible d'en empêcher l'exercice." : `nommé${isF && managers.length===1 && managers[0].gender==="F" ? "e" : ""} sans limitation de durée, qui déclare accepter ces fonctions et n'être frappé${managers[0]?.gender==="F" ? "e" : ""} d'aucune incompatibilité ni d'aucune interdiction susceptible d'en empêcher l'exercice.`;

  return [
    { kind: "title", text: "TITRE I — FORME, DÉNOMINATION, OBJET, SIÈGE, DURÉE" },
    { kind: "article", heading: "Forme", paragraphs: [
      `Il est formé ${formePar} une société à responsabilité limitée à associé unique, régie par les articles L. 223-1 et suivants du Code de commerce, notamment l'article L. 223-1 alinéa 2, ainsi que par les présents statuts.`,
      `La société peut, à tout moment, comprendre plusieurs associés par suite de cession ou transmission de parts ; elle serait alors régie par les règles applicables aux SARL pluripersonnelles, sans transformation.`,
    ]},
    { kind: "article", heading: "Dénomination sociale", paragraphs: [
      `La société prend la dénomination de : ${denomination}.`,
      "Dans tous les actes et documents émanant de la société et destinés aux tiers, cette dénomination doit être précédée ou suivie immédiatement des mots « société à responsabilité limitée à associé unique » ou de l'initiale « EURL », de l'énonciation du montant du capital social, du numéro d'identification SIREN et de la mention RCS suivie du nom de la ville où se trouve le greffe où elle est immatriculée.",
    ]},
    { kind: "article", heading: "Objet social", paragraphs: [
      `La société a pour objet, en France et à l'étranger : ${objet} ;`,
      "Et plus généralement, toutes opérations industrielles, commerciales, financières, mobilières ou immobilières se rapportant directement ou indirectement à l'objet social ou susceptibles d'en faciliter l'extension ou le développement.",
    ]},
    { kind: "article", heading: "Siège social", paragraphs: [
      `Le siège social est fixé au : ${siege}.`,
      "Il peut être transféré en tout autre lieu par décision de l'associé unique.",
    ]},
    { kind: "article", heading: "Durée", paragraphs: [
      `La durée de la société est fixée à ${duree} années à compter de la date de son immatriculation au Registre du Commerce et des Sociétés, sauf dissolution anticipée ou prorogation décidée par l'associé unique.`,
    ]},
    { kind: "article", heading: "Actes accomplis pour le compte de la société en formation", paragraphs: [
      "Un état des actes accomplis pour le compte de la société en formation est annexé aux présents statuts. La signature des statuts emportera reprise de ces engagements par la société lorsqu'elle aura été immatriculée au Registre du Commerce et des Sociétés.",
      "En outre, l'associé unique donne mandat à la gérance de prendre, pour le compte de la société, les engagements nécessaires entre la signature des statuts et l'immatriculation.",
    ]},

    { kind: "title", text: "TITRE II — APPORTS, CAPITAL SOCIAL, PARTS SOCIALES" },
    { kind: "article", heading: "Apports", paragraphs: [
      `L'associé unique apporte à la société, en numéraire, la somme de ${capitalStr} (${capitalLettres}).`,
      "Cette somme a été déposée, dès avant la signature des présents statuts, sur un compte ouvert au nom de la société en formation, ainsi qu'en atteste le certificat du dépositaire. Elle sera retirée par la gérance sur présentation du certificat du greffe attestant l'immatriculation de la société au Registre du Commerce et des Sociétés.",
    ]},
    { kind: "article", heading: "Capital social", paragraphs: [
      `Le capital social est fixé à la somme de ${capitalStr} (${capitalLettres}).`,
      `Il est divisé en ${nbParts} parts sociales de ${valeurPart} chacune, entièrement souscrites et intégralement libérées, numérotées de 1 à ${nbParts}, attribuées en totalité à l'associé unique${u ? ` : ${u.fullName}` : ""}.`,
    ]},
    { kind: "article", heading: "Représentation des parts sociales", paragraphs: [
      "Les parts sociales ne peuvent être représentées par des titres négociables. Le titre de l'associé unique résulte uniquement des présents statuts et des actes ultérieurs qui pourraient modifier le capital social.",
    ]},
    { kind: "article", heading: "Augmentation et réduction du capital", paragraphs: [
      "Le capital social peut être augmenté ou réduit, en une ou plusieurs fois, par décision de l'associé unique, dans les conditions prévues par la loi.",
      "En cas d'augmentation de capital par souscription de parts en numéraire, les fonds provenant de la libération des parts doivent faire l'objet d'un dépôt dans les conditions légales.",
    ]},
    { kind: "article", heading: "Droits et obligations attachés aux parts sociales", paragraphs: [
      "Chaque part sociale confère à son propriétaire un droit égal dans les bénéfices de la société et dans tout l'actif social.",
      "L'associé unique n'est tenu des dettes sociales que jusqu'à concurrence du montant de ses apports.",
    ]},

    { kind: "title", text: "TITRE III — CESSION ET TRANSMISSION DES PARTS" },
    { kind: "article", heading: "Cession et transmission des parts", paragraphs: [
      "L'associé unique cède librement ses parts. En cas de pluralité d'associés résultant d'une cession ou d'une transmission, les cessions à des tiers seraient soumises à l'agrément prévu par l'article L. 223-14 du Code de commerce.",
      "La société n'est pas dissoute par le décès de l'associé unique ; elle continue avec ses héritiers ou ayants droit.",
    ]},

    { kind: "title", text: "TITRE IV — GÉRANCE" },
    { kind: "article", heading: "Nomination de la gérance", paragraphs: [
      "La société est administrée par un ou plusieurs gérants, personnes physiques, associés ou non, nommés par décision de l'associé unique, avec ou sans limitation de durée.",
      managersList,
      acceptent,
    ]},
    { kind: "article", heading: "Pouvoirs de la gérance", paragraphs: [
      "Dans les rapports avec les tiers, chaque gérant est investi des pouvoirs les plus étendus pour agir en toute circonstance au nom de la société. La société est engagée même par les actes du gérant qui ne relèvent pas de l'objet social, à moins qu'elle ne prouve que le tiers savait que l'acte dépassait cet objet ou qu'il ne pouvait l'ignorer.",
      "La gérance peut, sous sa responsabilité personnelle, déléguer temporairement certains de ses pouvoirs à toute personne de son choix pour un ou plusieurs objets déterminés.",
    ]},
    { kind: "article", heading: "Rémunération de la gérance", paragraphs: [
      "Chaque gérant a droit, en rémunération de ses fonctions, à un traitement fixe ou proportionnel, ou à la fois fixe et proportionnel, dont le montant et les modalités de paiement sont déterminés par décision de l'associé unique. Le gérant a droit, en outre, au remboursement de ses frais de représentation et de déplacement sur justificatifs.",
    ]},
    { kind: "article", heading: "Responsabilité de la gérance", paragraphs: [
      "Les gérants sont responsables, individuellement ou solidairement selon le cas, envers la société ou envers les tiers, des infractions aux dispositions législatives ou réglementaires applicables aux SARL, des violations des présents statuts, ainsi que des fautes commises dans leur gestion.",
    ]},
    { kind: "article", heading: "Cessation des fonctions de la gérance", paragraphs: [
      "Les fonctions de gérant cessent par le décès, l'incapacité, l'interdiction de gérer, la faillite personnelle, la démission ou la révocation.",
      "Tout gérant peut démissionner en prévenant l'associé unique au moins trois mois à l'avance, par lettre recommandée avec demande d'avis de réception.",
      "Tout gérant est révocable par décision de l'associé unique. Si la révocation est décidée sans juste motif, elle peut donner lieu à dommages et intérêts.",
      "La cessation des fonctions d'un gérant n'entraîne pas la dissolution de la société.",
    ]},
    { kind: "article", heading: "Conventions entre la société et son gérant ou son associé unique", paragraphs: [
      "Les conventions intervenues directement ou par personne interposée entre la société et son gérant ou son associé unique font l'objet, conformément à l'article L. 223-19 alinéa 3 du Code de commerce, d'une mention au registre des décisions de l'associé unique.",
      "Les conventions portant sur des opérations courantes et conclues à des conditions normales ne sont pas soumises à cette procédure.",
      "À peine de nullité du contrat, il est interdit au gérant et à l'associé unique personne physique, conformément à l'article L. 223-21 du Code de commerce, de contracter sous quelque forme que ce soit des emprunts auprès de la société, de se faire consentir par elle un découvert en compte courant ou autrement, ainsi que de faire cautionner ou avaliser par elle leurs engagements envers les tiers.",
    ]},

    { kind: "title", text: "TITRE V — DÉCISIONS DE L'ASSOCIÉ UNIQUE" },
    { kind: "article", heading: "Décisions de l'associé unique", paragraphs: [
      `L'associé unique exerce les pouvoirs dévolus par la loi à la collectivité des associés. ${ilElle.charAt(0).toUpperCase()+ilElle.slice(1)} ne peut déléguer ces pouvoirs.`,
      "Ses décisions, prises aux lieu et place de l'assemblée, sont répertoriées dans un registre coté et paraphé dans les conditions réglementaires.",
      "Conformément à l'article L. 223-31 du Code de commerce, lorsque l'associé unique est seul gérant de la société, le dépôt au Registre du Commerce et des Sociétés, dans le délai de six mois à compter de la clôture de l'exercice, de l'inventaire et des comptes annuels dûment signés vaut approbation des comptes.",
      "Les conventions conclues entre la société et son associé unique sont mentionnées au registre des décisions.",
    ]},

    { kind: "title", text: "TITRE VI — EXERCICE SOCIAL, COMPTES, AFFECTATION DES RÉSULTATS" },
    { kind: "article", heading: "Exercice social", paragraphs: [
      "L'exercice social commence le 1er janvier et se termine le 31 décembre de chaque année.",
      "Par exception, le premier exercice commencera à la date de l'immatriculation de la société au Registre du Commerce et des Sociétés et se terminera le 31 décembre de la même année ou, si l'immatriculation intervient après le 30 juin, le 31 décembre de l'année suivante.",
    ]},
    { kind: "article", heading: "Comptes sociaux", paragraphs: [
      "Il est tenu une comptabilité régulière des opérations sociales conformément à la loi et aux usages du commerce. À la clôture de chaque exercice, la gérance dresse l'inventaire des divers éléments de l'actif et du passif, établit les comptes annuels et le rapport de gestion dans les conditions prévues par la loi.",
    ]},
    { kind: "article", heading: "Affectation et répartition des résultats", paragraphs: [
      "Le bénéfice distribuable est constitué par le bénéfice de l'exercice, diminué des pertes antérieures et des sommes portées en réserve en application de la loi — notamment la dotation à la réserve légale à hauteur d'un vingtième au moins du bénéfice jusqu'à ce qu'elle atteigne le dixième du capital social — et augmenté du report bénéficiaire.",
      "Ce bénéfice est attribué à l'associé unique, sauf décision d'affectation à des comptes de réserves ou de report à nouveau.",
    ]},
    { kind: "article", heading: "Capitaux propres inférieurs à la moitié du capital social", paragraphs: [
      "Si, du fait des pertes constatées dans les documents comptables, les capitaux propres de la société deviennent inférieurs à la moitié du capital social, la gérance est tenue, dans les quatre mois qui suivent l'approbation des comptes ayant fait apparaître ces pertes, de provoquer une décision de l'associé unique afin de décider s'il y a lieu à dissolution anticipée de la société, dans les conditions prévues à l'article L. 223-42 du Code de commerce.",
    ]},
    { kind: "article", heading: "Commissaires aux comptes", paragraphs: [
      "La nomination d'un commissaire aux comptes n'est obligatoire que si la société dépasse les seuils fixés par la réglementation en vigueur. L'associé unique peut, en outre, nommer volontairement un commissaire aux comptes.",
    ]},

    { kind: "title", text: "TITRE VII — DISSOLUTION, LIQUIDATION, CONTESTATIONS" },
    { kind: "article", heading: "Dissolution — Liquidation", paragraphs: [
      "La société est dissoute à l'expiration de la durée fixée par les statuts, sauf prorogation, par décision de l'associé unique, ou pour toute autre cause prévue par la loi.",
      "La dissolution entraîne la liquidation. Elle est effectuée par le ou les gérants alors en fonction ou par tout liquidateur désigné par l'associé unique. La personnalité morale de la société subsiste pour les besoins de la liquidation jusqu'à la clôture de celle-ci.",
    ]},
    { kind: "article", heading: "Contestations — Frais", paragraphs: [
      "Toutes contestations qui pourraient s'élever pendant la durée de la société ou lors de sa liquidation, relativement aux affaires sociales ou à l'exécution des présents statuts, seront soumises aux tribunaux compétents du lieu du siège social.",
      "Les frais, droits et honoraires des présents statuts et de leurs suites, ainsi que l'ensemble des frais de constitution, seront pris en charge par la société et portés au compte des frais généraux du premier exercice social.",
    ]},
  ];
}

// ─────────────────── SAS (25 articles) ───────────────────
export function buildSasBlocks(ctx: StatutsCtx, isSasu: boolean): StatutsBlock[] {
  const { denomination, capitalStr, capitalLettres, nbParts, valeurPart, siege, objet, duree, associes, managers, civilStateSentence, formatEuro } = ctx;
  const president = managers[0];
  const dep = isSasu ? "L'associé unique" : "la collectivité des associés";
  const dep2 = isSasu ? "de l'associé unique" : "des associés";
  const dep3 = isSasu ? "l'associé unique" : "les associés";
  const parLaCol = isSasu ? "par décision de l'associé unique" : "par décision collective des associés";
  const denomInline = isSasu ? "« société par actions simplifiée unipersonnelle » ou « SASU »" : "« société par actions simplifiée » ou « SAS »";
  const forme1Extra = isSasu ? " La société comporte un associé unique. Elle peut, à tout moment, comprendre plusieurs associés ; elle serait alors régie par les règles applicables aux sociétés par actions simplifiées pluripersonnelles, sans transformation." : "";
  const parts = associes.map(a => ({ a, nb: Math.round((a.percent / 100) * nbParts) }));
  const partsLines = isSasu
    ? (associes[0] ? `Attribuées en totalité à l'associé unique : ${associes[0].fullName} — ${nbParts} actions (100%).` : `Attribuées en totalité à l'associé unique.`)
    : parts.map(({ a, nb }) => `— ${a.fullName} : ${nb} actions (${a.percent}%), soit un apport de ${formatEuro(nb)} ;`).join("\n");
  const apports = isSasu
    ? `L'associé unique apporte en numéraire la somme de ${capitalStr} (${capitalLettres}).`
    : `Les associés apportent à la société, en numéraire, la somme totale de ${capitalStr} (${capitalLettres}), soit :\n${parts.map(({a,nb}) => `— ${a.fullName} : apport de ${formatEuro(nb)} ;`).join("\n")}`;

  const blocks: StatutsBlock[] = [
    { kind: "title", text: "TITRE I — FORME, DÉNOMINATION, OBJET, SIÈGE, DURÉE" },
    { kind: "article", heading: "Forme", paragraphs: [
      `Il est formé une société par actions simplifiée régie par les dispositions des articles L. 227-1 à L. 227-20 et L. 244-1 à L. 244-4 du Code de commerce, par les dispositions du Code de commerce applicables aux sociétés anonymes dans la mesure où elles sont compatibles avec les dispositions particulières aux sociétés par actions simplifiées, ainsi que par les présents statuts.${forme1Extra}`,
      "La société ne peut procéder à une offre au public de titres financiers dans les conditions interdites par l'article L. 227-2 du Code de commerce.",
    ]},
    { kind: "article", heading: "Dénomination sociale", paragraphs: [
      `La société prend la dénomination de : ${denomination}.`,
      `Dans tous les actes et documents émanant de la société et destinés aux tiers, cette dénomination doit être précédée ou suivie immédiatement des mots ${denomInline}, de l'énonciation du montant du capital social, du numéro SIREN et de la mention RCS suivie du nom de la ville du greffe d'immatriculation.`,
    ]},
    { kind: "article", heading: "Objet social", paragraphs: [
      `La société a pour objet, en France et à l'étranger : ${objet} ;`,
      "Et plus généralement, toutes opérations industrielles, commerciales, financières, mobilières ou immobilières se rapportant directement ou indirectement à l'objet social.",
    ]},
    { kind: "article", heading: "Siège social", paragraphs: [
      `Le siège social est fixé au : ${siege}. Il peut être transféré en tout lieu par décision du Président, sous réserve de ratification par la prochaine ${isSasu ? "décision de l'associé unique" : "décision collective des associés"}.`,
    ]},
    { kind: "article", heading: "Durée", paragraphs: [
      `La durée de la société est fixée à ${duree} années à compter de la date de son immatriculation au Registre du Commerce et des Sociétés, sauf dissolution anticipée ou prorogation décidée ${parLaCol}.`,
    ]},
    { kind: "article", heading: "Actes accomplis pour le compte de la société en formation", paragraphs: [
      "Un état des actes accomplis pour le compte de la société en formation est annexé aux présents statuts. La signature des statuts emportera reprise de ces engagements par la société lorsqu'elle aura été immatriculée au Registre du Commerce et des Sociétés.",
      `En outre, ${dep3} donne${isSasu?"":"nt"} mandat au Président de prendre, pour le compte de la société, les engagements nécessaires entre la signature des statuts et l'immatriculation.`,
    ]},

    { kind: "title", text: "TITRE II — APPORTS, CAPITAL, ACTIONS" },
    { kind: "article", heading: "Apports", paragraphs: [ apports ]},
    { kind: "article", heading: "Capital social", paragraphs: [
      `Le capital social est fixé à la somme de ${capitalStr} (${capitalLettres}). Il est divisé en ${nbParts} actions de ${valeurPart} chacune, de même catégorie, entièrement souscrites et intégralement libérées.`,
      partsLines,
    ]},
    { kind: "article", heading: "Forme des actions", paragraphs: [
      "Les actions sont obligatoirement nominatives. Elles donnent lieu à une inscription en compte individuel dans les conditions et selon les modalités prévues par la réglementation en vigueur. Elles ne peuvent être représentées par des titres négociables.",
    ]},
    { kind: "article", heading: "Droits et obligations attachés aux actions", paragraphs: [
      `Chaque action donne droit, dans les bénéfices, l'actif social et le boni de liquidation, à une part proportionnelle à la quotité du capital qu'elle représente, et donne droit à une voix dans les votes et délibérations. ${isSasu ? "L'associé unique ne supporte" : "Les associés ne supportent"} les pertes qu'à concurrence de ${isSasu ? "son apport" : "leurs apports"}. La propriété d'une action emporte de plein droit adhésion aux présents statuts et aux décisions ${dep2}.`,
    ]},
    { kind: "article", heading: "Augmentation et réduction du capital", paragraphs: [
      `Le capital social peut être augmenté ou réduit dans les conditions prévues par la loi, ${parLaCol}. ${isSasu ? "L'associé unique peut" : "Les associés peuvent"} déléguer au Président les pouvoirs nécessaires à la réalisation de ces opérations dans les conditions légales.`,
    ]},

    { kind: "title", text: "TITRE III — CESSION DES ACTIONS" },
  ];

  if (isSasu) {
    blocks.push({ kind: "article", heading: "Cession et transmission des actions", paragraphs: [
      "Tant que la société demeure unipersonnelle, l'associé unique cède librement ses actions.",
      "En cas de pluralité d'associés, les cessions d'actions entre associés seront libres. Toute cession d'actions à un tiers étranger à la société, à quelque titre que ce soit, serait alors soumise à l'agrément préalable de la collectivité des associés statuant à la majorité des voix des associés disposant du droit de vote.",
      "La demande d'agrément serait notifiée à la société par lettre recommandée avec demande d'avis de réception, indiquant l'identité du cessionnaire, le nombre d'actions dont la cession est envisagée et le prix offert. L'agrément résulterait d'une décision collective des associés notifiée au cédant dans les trois mois de la demande ; à défaut de réponse dans ce délai, l'agrément serait réputé acquis.",
      "En cas de refus d'agrément, la société serait tenue, dans un délai de trois mois à compter de la notification du refus, de faire acquérir les actions soit par un ou plusieurs associés, soit par un tiers agréé, soit par la société elle-même en vue d'une réduction de capital. À défaut d'accord, le prix des actions serait déterminé dans les conditions prévues à l'article 1843-4 du Code civil.",
      "Toute cession réalisée en violation de la présente clause d'agrément serait nulle, conformément à l'article L. 227-15 du Code de commerce.",
    ]});
  } else {
    blocks.push({ kind: "article", heading: "Cession et transmission des actions", paragraphs: [
      "Les cessions d'actions entre associés sont libres. Toute cession d'actions à un tiers étranger à la société, à quelque titre que ce soit, est soumise à l'agrément préalable de la collectivité des associés statuant à la majorité des voix des associés disposant du droit de vote.",
      "La demande d'agrément est notifiée à la société par lettre recommandée avec demande d'avis de réception, indiquant l'identité du cessionnaire, le nombre d'actions dont la cession est envisagée et le prix offert. L'agrément résulte d'une décision collective des associés notifiée au cédant dans les trois mois de la demande ; à défaut de réponse dans ce délai, l'agrément est réputé acquis.",
      "En cas de refus d'agrément, la société est tenue, dans un délai de trois mois à compter de la notification du refus, de faire acquérir les actions soit par un ou plusieurs associés, soit par un tiers agréé, soit par la société elle-même en vue d'une réduction de capital. À défaut d'accord, le prix des actions est déterminé dans les conditions prévues à l'article 1843-4 du Code civil. Si, à l'expiration de ce délai, l'achat n'est pas réalisé, l'agrément est considéré comme donné.",
      "Toute cession réalisée en violation de la présente clause d'agrément est nulle, conformément à l'article L. 227-15 du Code de commerce.",
    ]});
  }

  blocks.push(
    { kind: "title", text: "TITRE IV — DIRECTION DE LA SOCIÉTÉ" },
    { kind: "article", heading: "Président", paragraphs: [
      "La société est représentée, dirigée et administrée par un Président, personne physique ou morale, associé ou non de la société.",
      president
        ? `Le premier Président de la société est : ${civilStateSentence(president)}, qui déclare accepter ces fonctions et n'être frappé${president.gender==="F"?"e":""} d'aucune incompatibilité ni d'aucune interdiction susceptible d'en empêcher l'exercice.`
        : "Le premier Président est désigné par les présents statuts.",
      `Le Président est nommé sans limitation de durée. En cours de vie sociale, le Président est nommé, renouvelé et révoqué ${parLaCol}. La révocation peut intervenir à tout moment ; elle n'a pas à être motivée et ne peut donner lieu à indemnité, sauf décision contraire ${dep2}.`,
      `La rémunération du Président est fixée ${parLaCol}. Le Président a droit au remboursement de ses frais de représentation et de déplacement sur justificatifs. Le Président peut démissionner à tout moment, sous réserve de prévenir ${dep3} au moins trois mois à l'avance.`,
    ]},
    { kind: "article", heading: "Pouvoirs du Président", paragraphs: [
      "Conformément à l'article L. 227-6 du Code de commerce, le Président représente la société à l'égard des tiers. Il est investi des pouvoirs les plus étendus pour agir en toute circonstance au nom de la société, dans la limite de l'objet social.",
      "La société est engagée même par les actes du Président qui ne relèvent pas de l'objet social, à moins qu'elle ne prouve que le tiers savait que l'acte dépassait cet objet ou qu'il ne pouvait l'ignorer compte tenu des circonstances. Les dispositions statutaires limitant les pouvoirs du Président sont inopposables aux tiers.",
      "Le Président peut, sous sa responsabilité, consentir toutes délégations de pouvoirs à toute personne de son choix pour un ou plusieurs objets déterminés.",
    ]},
    { kind: "article", heading: "Directeur Général", paragraphs: [
      `Sur proposition du Président, ${dep} peut nommer un ou plusieurs Directeurs Généraux, personnes physiques, chargés d'assister le Président. Conformément à l'article L. 227-6 alinéa 3 du Code de commerce, le Directeur Général dispose, à l'égard des tiers, des mêmes pouvoirs de représentation que le Président.`,
      "La durée des fonctions, la rémunération et l'étendue des pouvoirs internes du Directeur Général sont fixées par la décision qui le nomme. Le Directeur Général est révocable à tout moment dans les mêmes conditions que le Président.",
    ]},
    { kind: "article", heading: "Conventions réglementées", paragraphs: [
      isSasu
        ? "Conformément à l'article L. 227-10 dernier alinéa du Code de commerce, lorsque la société ne comprend qu'un seul associé, il est seulement fait mention au registre des décisions des conventions intervenues directement ou par personne interposée entre la société et son dirigeant ou son associé unique. Les conventions portant sur des opérations courantes et conclues à des conditions normales ne sont pas soumises à cette procédure."
        : "Conformément à l'article L. 227-10 du Code de commerce, toute convention intervenue, directement ou par personne interposée, entre la société et son Président, l'un de ses dirigeants ou l'un de ses associés disposant d'une fraction des droits de vote supérieure à 10 %, doit être portée à la connaissance des associés, qui statuent sur ces conventions dans les conditions prévues par la loi. Les conventions portant sur des opérations courantes et conclues à des conditions normales ne sont pas soumises à cette procédure.",
      "Les interdictions prévues à l'article L. 225-43 du Code de commerce (emprunts, découverts, cautions ou avals consentis par la société à ses dirigeants personnes physiques) s'appliquent dans les conditions déterminées par l'article L. 227-12 du même code.",
    ]},

    { kind: "title", text: isSasu ? "TITRE V — DÉCISIONS DE L'ASSOCIÉ UNIQUE" : "TITRE V — DÉCISIONS COLLECTIVES" },
  );

  if (isSasu) {
    blocks.push({ kind: "article", heading: "Décisions de l'associé unique", paragraphs: [
      "L'associé unique exerce les pouvoirs dévolus par la loi à la collectivité des associés.",
      "Relèvent de sa compétence exclusive, conformément à l'article L. 227-9 du Code de commerce : l'approbation des comptes annuels et l'affectation des résultats, la nomination, la révocation et la rémunération du Président et des Directeurs Généraux, la nomination des commissaires aux comptes, l'augmentation, l'amortissement ou la réduction du capital, la fusion, la scission, l'apport partiel d'actif, la transformation, la dissolution, ainsi que toute modification des statuts.",
      "Ses décisions sont répertoriées dans un registre coté et paraphé tenu au siège social. Toutes les autres décisions relèvent de la compétence du Président.",
    ]});
  } else {
    blocks.push(
      { kind: "article", heading: "Décisions collectives obligatoires", paragraphs: [
        "Conformément à l'article L. 227-9 du Code de commerce, doivent être prises collectivement par les associés les décisions relatives à l'augmentation, l'amortissement ou la réduction du capital, la fusion, la scission, l'apport partiel d'actif, la dissolution, la transformation en une société d'une autre forme, la nomination des commissaires aux comptes, l'approbation des comptes annuels et l'affectation des résultats, ainsi que la nomination, la révocation et la rémunération du Président et des Directeurs Généraux, et toute modification des statuts.",
        "Toutes les autres décisions relèvent de la compétence du Président.",
        "Les décisions collectives sont prises, au choix du Président, en assemblée, par consultation écrite ou par acte signé de tous les associés. Chaque action donne droit à une voix. Les décisions collectives sont adoptées à la majorité des voix des associés disposant du droit de vote, à l'exception des décisions exigeant l'unanimité en application de l'article L. 227-19 du Code de commerce (adoption ou modification des clauses statutaires relatives à l'inaliénabilité temporaire des actions, à l'exclusion d'un associé, ou à l'agrément des cessions dans les cas prévus par la loi).",
        "Toute délibération est constatée par un procès-verbal établi et signé par le Président sur un registre spécial tenu au siège social.",
      ]},
      { kind: "article", heading: "Information des associés", paragraphs: [
        "Quinze jours au moins avant toute décision collective statuant sur les comptes annuels, les documents prévus par la réglementation sont adressés ou tenus à la disposition de chaque associé. Chaque associé peut, à toute époque, consulter au siège social les statuts à jour ainsi que les documents sociaux des trois derniers exercices.",
      ]},
    );
  }

  blocks.push(
    { kind: "title", text: "TITRE VI — EXERCICE SOCIAL, COMPTES, RÉSULTATS" },
    { kind: "article", heading: "Exercice social", paragraphs: [
      "L'exercice social commence le 1er janvier et se termine le 31 décembre de chaque année.",
      "Par exception, le premier exercice commencera à la date d'immatriculation de la société au Registre du Commerce et des Sociétés et se terminera le 31 décembre de la même année ou, si l'immatriculation intervient après le 30 juin, le 31 décembre de l'année suivante.",
    ]},
    { kind: "article", heading: "Comptes sociaux", paragraphs: [
      "Il est tenu une comptabilité régulière des opérations sociales conformément à la loi. À la clôture de chaque exercice, le Président dresse l'inventaire des divers éléments de l'actif et du passif, établit les comptes annuels (bilan, compte de résultat et annexe) ainsi que le rapport de gestion dans les conditions prévues par la loi.",
    ]},
    { kind: "article", heading: "Affectation et répartition des résultats", paragraphs: [
      "Le bénéfice distribuable est constitué par le bénéfice de l'exercice, diminué des pertes antérieures et des sommes portées en réserve en application de la loi — notamment la dotation à la réserve légale, à hauteur d'un vingtième au moins du bénéfice jusqu'à ce qu'elle atteigne le dixième du capital social — et augmenté du report bénéficiaire.",
      `Ce bénéfice est réparti ${isSasu ? "au profit de l'associé unique" : "entre les associés proportionnellement au nombre d'actions appartenant à chacun d'eux"}. ${isSasu ? "L'associé unique peut" : "Les associés peuvent, sur proposition du Président,"} décider d'affecter tout ou partie du bénéfice distribuable à des comptes de réserves ou de le reporter à nouveau.`,
    ]},
    { kind: "article", heading: "Capitaux propres inférieurs à la moitié du capital social", paragraphs: [
      `Si, du fait des pertes constatées dans les documents comptables, les capitaux propres de la société deviennent inférieurs à la moitié du capital social, le Président est tenu ${isSasu ? "de provoquer une décision de l'associé unique" : "de consulter les associés"}, dans les quatre mois qui suivent l'approbation des comptes ayant fait apparaître ces pertes, à l'effet de décider s'il y a lieu à dissolution anticipée de la société, conformément à l'article L. 225-248 du Code de commerce sur renvoi de l'article L. 227-1.`,
    ]},
    { kind: "article", heading: "Commissaires aux comptes", paragraphs: [
      `La nomination d'un commissaire aux comptes n'est obligatoire que si la société dépasse les seuils fixés par la réglementation en vigueur (article L. 227-9-1 du Code de commerce). ${isSasu ? "L'associé unique peut" : "Les associés peuvent"} en outre en nommer un volontairement.`,
    ]},

    { kind: "title", text: "TITRE VII — DISSOLUTION, LIQUIDATION, CONTESTATIONS" },
    { kind: "article", heading: "Dissolution — Liquidation", paragraphs: [
      `La société est dissoute à l'expiration de la durée fixée par les statuts, sauf prorogation, ${parLaCol}, ou pour toute autre cause prévue par la loi.`,
      "La dissolution entraîne la liquidation de la société. Elle est effectuée par le Président alors en fonction ou par tout liquidateur désigné par la décision qui prononce la dissolution. Le liquidateur dispose des pouvoirs les plus étendus pour réaliser l'actif, apurer le passif et répartir le solde disponible.",
      "La personnalité morale de la société subsiste pour les besoins de la liquidation jusqu'à la clôture de celle-ci.",
    ]},
    { kind: "article", heading: "Contestations — Frais", paragraphs: [
      "Toutes contestations qui pourraient s'élever pendant la durée de la société ou lors de sa liquidation, relativement aux affaires sociales ou à l'exécution des présents statuts, seront soumises aux tribunaux compétents du lieu du siège social.",
      "Les frais, droits et honoraires des présents statuts et de leurs suites, ainsi que l'ensemble des frais de constitution, seront pris en charge par la société et portés au compte des frais généraux du premier exercice social.",
    ]},
  );

  return blocks;
}
