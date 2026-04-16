---
name: Financial Logic and Labels
description: Comptabilité 100% encaissement. CA = factures payées uniquement. Profit basé sur trésorerie encaissée.
type: feature
---
La logique comptable repose sur une comptabilité 100% encaissement :

- **Chiffre d'affaires** = somme des factures finalisées ET payées uniquement
- **Trésorerie encaissée** = identique au CA (factures payées TTC)
- **TVA collectée** = calculée uniquement sur les factures payées
- **Bénéfice** = trésorerie encaissée - dépenses - charges (URSSAF, IS, TVA)
- **URSSAF** = calculée sur le bénéfice brut HT (CA payé HT - dépenses HT)

❌ Interdictions :
- Ne jamais inclure les factures non payées dans aucun calcul
- Ne jamais inclure les devis dans aucun calcul financier
- Ne jamais utiliser "toutes les factures finalisées" comme base de calcul

Le bénéfice net ne peut jamais dépasser la trésorerie encaissée.
Labels en Ammiya pour l'interface arabe (ex: الأموال المحصلة).
