// Vérification pré-paiement du résultat prévisionnel.
// Réplique EXACTEMENT la formule utilisée par buildPrevisionnelPdf (creationPdf.ts)
// sans modifier le calcul du PDF ni sa présentation. Utilisé uniquement pour
// afficher un avertissement à l'utilisateur AVANT la génération/paiement.

import type { PrevisionnelInput } from "@/lib/creationPdf";

export interface PrevisionnelQuickResult {
  resultatAvantImpot: number;
  isNegatif: boolean;
}

export function computePrevisionnelQuick(body: PrevisionnelInput): PrevisionnelQuickResult {
  const ca = Number(body.chiffre_affaires_estime) || 0;
  const isAE = body.type_societe === "Auto-entrepreneur";
  const isSARLFamily = body.type_societe === "SARL" || body.type_societe === "EURL";
  const isSASFamily = body.type_societe === "SAS" || body.type_societe === "SASU";

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

  const empMontant = Math.max(0, Number(body.emprunt_montant) || 0);
  const empAnnees = Math.max(0, Number(body.emprunt_annees) || 0);

  let mensualiteEmprunt = 0;
  if (empMontant > 0 && empAnnees > 0) {
    const r = 0.05 / 12;
    const n = empAnnees * 12;
    mensualiteEmprunt = (empMontant * r) / (1 - Math.pow(1 + r, -n));
  }
  const remboursementAnnuel = mensualiteEmprunt * 12;

  let cotisDirigeant = 0;
  if (isSARLFamily) cotisDirigeant = remuAnnuel * 0.45;
  else if (isSASFamily) cotisDirigeant = remuAnnuel * 0.80;
  else if (isAE) cotisDirigeant = ca * 0.22;

  const masseSalariale = nbSalaries > 0 ? salaireMoyen * 12 * 1.80 * nbSalaries : 0;
  const vehiculeAnnuel = vehiculeMensuel * 12;
  const loyerAnnuel = loyerMensuel * 12;
  const cfe = 500;

  const totalCharges =
    remuAnnuel + cotisDirigeant + masseSalariale +
    vehiculeAnnuel + loyerAnnuel +
    assurances + comptable + achatsMateriaux + autres + cfe + remboursementAnnuel;

  const resultatAvantImpot = ca - totalCharges;

  return {
    resultatAvantImpot,
    isNegatif: resultatAvantImpot < 0,
  };
}
