# Fiabiliser Documents → Faits → Lignes de devis

Aucun code, aucune migration, aucun déploiement dans ce plan.

## 1. Chemin technique minimal recommandé

Le chemin le plus court n'est pas de créer un nouveau système : il consiste à **étendre le contrat de faits déjà existant** (`ValidatedBtpFact`) avec des champs optionnels de rôle/relation, puis à faire du **transfert direct faits → brouillon** le seul chemin du parcours documentaire.

```text
Documents ──► extraction IA (btp_factual_extraction)
                    │  JSON faits bruts
                    ▼
        validateBtpFacts()  ← rôles + relations validés ICI (déterministe)
                    │  contrat figé (factId, role, coveredByFactId, scope…)
                    ▼
   ┌────────────────┴────────────────┐
   ▼                                 ▼
Rapport Markdown             buildDraftLinesFromFacts()
(affichage seul)              → lignes de devis (clé métier, filtrage rôles)
                                     │
                                     ▼
                        Devis intelligent (prix, PDF, envoi) — INCHANGÉ
```

Le rapport narratif devient un simple rendu lisible. Le copier-coller et le second raisonnement IA disparaissent **uniquement pour ce parcours documentaire**. Le parcours texte libre (saisie manuelle → `smart-devis-analyzer`) reste tel quel.

## 2. Fichiers réellement concernés

| Fichier | Rôle dans le plan |
| --- | --- |
| `supabase/functions/_shared/btpFactsContract.ts` | Ajout des champs optionnels + déduction déterministe du rôle et de la relation |
| `supabase/functions/ai-assistant/index.ts` (action `btp_factual_extraction`) | Demander à l'extracteur `role`, `operation`, `scope`, fourniture/pose et une **référence parent temporaire** (jamais un `factId`, jamais une `lineKey`) |
| `src/lib/btpFactsToDraft.ts` | Filtrage par rôle, clé métier de ligne, conservation `factId`/source |
| `src/pages/AIAssistantPage.tsx` (`transferToSmartDevis`) | Utiliser le contrat enrichi ; retirer le repli narratif |
| `src/pages/ArchitectDevisPage.tsx` + `supabase/functions/btp-quote-from-documents/index.ts` | Basculer, en dernière phase, sur le contrat de faits plutôt que sur la reconstruction textuelle |
| `src/test/btpFacts*.test.ts` | Tests génériques (cas A→F) |

## 3. Champs à ajouter au contrat (tous optionnels)

Sur `ValidatedBtpFact`, sans nouvelle structure parallèle :

- `role?: "main" | "included_component" | "descriptive"` — défaut `main` si `factType = billable_work`, sinon `descriptive`.
- `parentRef?: string | null` — **référence temporaire** parent/enfant telle que sortie de l'IA (identifiant local libre, ex. `p1`, ou l'`id` brut du fait parent). Jamais un `factId`.
- `coveredByFactId?: string | null` — **calculé par le code uniquement**, après génération des `factId`.
- `operation?: string | null` — verbe métier normalisé (pose, dépose, création, peinture…).
- `scope?: string | null` — périmètre/localisation + dimensions caractérisantes non facturables.
- `includesMaterials?: boolean | null`, `includesLabor?: boolean | null` — fourniture/pose.
- `lineKey?: string` — **calculée par le code uniquement**, jamais lue depuis la sortie IA.

**Ordre de création vérifié.** Dans `btpFactsContract.ts`, `buildFactId` est appelé à l'intérieur de `validateBtpFacts`, donc **après** la sortie IA : l'IA ne peut pas connaître le `factId` définitif et ne doit donc jamais produire de `coveredByFactId`. Résolution en deux temps, entièrement déterministe :

1. l'extracteur ne fournit qu'une relation temporaire (`parentRef`) désignant un fait de la même sortie ;
2. `validateBtpFacts` génère tous les `factId`, construit la table `refTemporaire → factId`, puis renseigne `coveredByFactId`.

`coveredByFactId` doit toujours pointer vers un `factId` réellement présent dans le contrat validé. Une référence parent inexistante, circulaire, ou pointant vers un fait non `main` est **rejetée** : le fait est déclassé en `role = descriptive` (ou `transferStatus = pending` s'il est facturable en propre), avec un motif explicite dans `reasons` (`parent_ref_unresolved`). Jamais de rattachement deviné.

**`lineKey`.** Calculée exclusivement par le code après validation, à partir des champs validés : `operation + scope normalisé + dimensions caractérisantes + unit + mode fourniture/pose`. Aucune valeur `lineKey` venant de l'IA n'est lue, stockée ou fusionnée ; si le JSON en contient une, elle est ignorée. Recalculable à l'identique à tout moment depuis le contrat.


Déjà présents, à réutiliser sans les dupliquer : `factId`, `quantity`, `unit`, `quantityType`, `clientSupplied`, `technicalReservation`, `sourceFile`, `sourcePage`, `location`, `material`, `reasons`, `transferStatus`.

Aucune table, aucune colonne : ces données vivent dans le bloc `<ANAFYPRO_BTP_FACTS>` et dans le brouillon en mémoire/`sessionStorage`.

## 4. Règles déterministes

**Transfert.** Devient une ligne facturable uniquement : `role = main` ET `factType = billable_work`.
- **Statut `ready`** (quantité > 0, unité valide, conflits résolus) → ligne normale du brouillon de devis, l'artisan peut ajuster le prix et la finaliser.
- **Statut `pending`** (quantité/unité absente, unité non fiable, conflit de sources entre quantités, information facturable nécessitant confirmation) → ligne présente dans le brouillon mais **clairement marquée « À confirmer » / « À vérifier »**, **aucune quantité, unité ou prix inventé** ; l'artisan la complète avant la finalisation du devis.
`included_component` avec `coveredByFactId` → rattaché au périmètre de la ligne parente (mention dans la désignation ou note), jamais une deuxième ligne. `descriptive` → jamais de ligne. Aucune règle par métier.

**Clé de ligne.** `lineKey = operation | scope normalisé | dimensions caractérisantes | unit | mode fourniture/pose`. Le `lot` n'entre jamais dans la clé (classement/affichage seulement).

**Règle absolue : plusieurs sources ≠ plusieurs prestations.** Deux faits de même `lineKey` décrivent le même travail vu dans deux documents, jamais deux travaux. Aucune addition de quantités n'est faite lors d'un rapprochement de sources. Résolution déterministe :

- **Cas A — même opération, même périmètre, même quantité, même unité, plusieurs documents :** une seule ligne ; la quantité est conservée **une seule fois** ; toutes les sources (`sourceFile`/`sourcePage`) sont conservées et affichées. Exemple : « Isolation combles 96 m² » dans A et B → `Isolation combles | 96 m²` (jamais 192 m²).
- **Cas B — même opération, même périmètre, quantités divergentes :** aucune addition, aucun choix arbitraire, aucune moyenne. La ligne passe en `pending` avec le motif `quantity_conflict_between_sources` ; les deux valeurs et les deux sources sont conservées et présentées « à vérifier » à l'artisan, qui tranche.
- **Cas C — opérations réellement différentes (périmètres distincts) :** `lineKey` différentes → deux lignes distinctes, chacune avec sa quantité. Exemple : isolation mur chambre 1 = 20 m², chambre 2 = 25 m².

Aucun cumul automatique de quantités n'existe dans ce plan, quelle que soit la situation.

**Quantité principale.** La quantité d'un `included_component` n'est jamais promue vers son parent ; le nombre de composants ne devient jamais la quantité du `main`. Les cotes descriptives restent dans `scope`. Aucune quantité ni unité inventée : sans quantité fiable, le fait reste `pending` plutôt que `1 u`.

**Contrôles avant devis (dans le code, pas dans un prompt) :** zéro ligne issue d'un `included_component` ou d'un `descriptive` ; **zéro quantité/unité inventée** — une ligne `main` devient `ready` si `quantity > 0` et `unit` valide, sinon `pending` avec motif explicite (`quantity_missing`, `unit_unreadable`…) ; **zéro quantité additionnée entre sources** ; **zéro `lineKey` dupliquée non résolue** ; zéro quantité d'un composant promue vers son parent ; `factId` + toutes les sources (`sourceFile`/`sourcePage`) présents sur chaque ligne transférée ; **tout `coveredByFactId` résolu vers un `factId` `main` réellement présent** ; **toute `lineKey` recalculée par le code** (aucune valeur IA). Toute violation bloque le transfert avec un message clair, sans écrire de devis partiel.

## 5. Fonctions à réutiliser / à ne pas toucher

Réutiliser : `validateBtpFacts`, `normalizeUnit`, `parseFactsBlock`, `serializeFactsContract`, `buildFactId`, `buildDraftLinesFromFacts` / `buildFromContract`, `resolveLot` (`btpLotNormalization`), `sanitizeReformulatedDesignation`, `btpTransferValidator`.

Ne pas toucher : `src/lib/invoiceTotals.ts`, moteur TVA et mentions CGI, `invoicePdf` / `facturx*` / `pdfEngine`, enregistrement et numérotation (`documentNumbers`, `documentArchive`, `invoiceDraftStorage`), envoi/signature client, `documentValidator.ts` (politique de non-correction acquise), `smart-devis-analyzer` et le parcours texte libre, RLS et tables existantes.

## 6. Phases, dans l'ordre, avec le test de sortie

**Phase A — Enrichir le contrat, comportement strictement identique (seule phase à réaliser après approbation).**
Ajout des champs optionnels dans `btpFactsContract.ts`, `role` déduit par défaut de `factType` (`billable_work` → `main`, sinon `descriptive`). Aucune règle de filtrage nouvelle, aucune ligne de devis modifiée, aucun PDF, aucun calcul, aucune TVA, aucun envoi/signature touché, aucun prompt modifié, aucune migration, aucun déploiement au-delà du partage du fichier de contrat.
*Test :* la suite de tests existante passe inchangée ; un contrat sans les nouveaux champs produit exactement les mêmes lignes qu'aujourd'hui ; un devis réel documentaire donne un résultat identique à avant. Validation de la Phase A **avant** toute Phase B. Les phases B à E ne sont jamais exécutées en même temps.

**Phase B — Produire rôles et relations (référence temporaire) + résolution par le code.**
Le prompt d'extraction déclare `role`, `operation`, `scope`, fourniture/pose et une référence parent temporaire. `validateBtpFacts` résout ces références en `coveredByFactId` après génération des `factId` et calcule `lineKey`. Résultats seulement affichés/loggués, pas encore appliqués.
*Test :* sur les 3 documents MARTIN, vérifier dans la console que les accessoires sortent en `included_component` avec un `coveredByFactId` pointant vers un `factId` `main` existant, que les références non résolues sont déclassées avec le motif `parent_ref_unresolved`, et que les cotes sortent en `descriptive`. Le devis produit reste identique à la Phase A.

**Phase C — Activer le filtrage déterministe + clé de ligne.**
`btpFactsToDraft` applique les règles du §4 et les contrôles.
*Test :* cas A→F ci-dessous en tests unitaires, plus un devis réel de bout en bout (prix, PDF, enregistrement) pour vérifier l'absence de régression.

**Phase D — Transfert direct.**
« Préparer le devis » consomme le contrat (factId + données validées) sans passer par le Markdown ni un second appel IA ; `factId` et source conservés jusqu'au brouillon.
*Test :* un transfert complet sans aucun appel à `btp-quote-from-documents` / `smart-devis-analyzer` (vérifiable dans l'onglet réseau), lignes détaillées conservées, aucune erreur 413.

**Phase E — Retirer le passage narratif devenu inutile.**
Suppression du repli « rapport → parsing → IA » dans ce seul parcours, une fois D validée en usage réel.
*Test :* parcours documentaire OK ; parcours texte libre et devis manuel toujours fonctionnels ; anciens devis enregistrés s'ouvrent normalement.

## 7. Tests génériques (indépendants du métier)

- **A** — équipement + 5 accessoires → 1 ligne `main`, 5 `included_component`, aucune double facturation.
- **B** — 2 équipements type A + 3 type B → 2 lignes distinctes, quantités 2 et 3.
- **C** — ouvrage 4,20 ml, hauteur 2,50 m → quantité 4,20 ml ; hauteur dans `scope`.
- **D** — fourniture client / pose entreprise → `clientSupplied = true`, `includesMaterials = false`, fourniture non facturée.
- **E** — ouvrage « comprenant raccordements, essais, mise en service » → composants inclus, sauf prestation explicitement distincte.
- **F** — même prestation présente dans deux documents avec la **même quantité** (ex. isolation combles 96 m² dans A et dans B) → **une seule ligne**, quantité conservée **une seule fois** (96 m², jamais 192), **deux sources conservées**.
- **F bis** — même prestation, quantités divergentes (96 m² / 102 m²) → une seule ligne en `pending` « à vérifier », les deux valeurs et les deux sources conservées, **aucune addition automatique**, aucun choix arbitraire.
- **F ter** — même opération sur deux périmètres différents (mur chambre 1 = 20 m², mur chambre 2 = 25 m²) → deux lignes distinctes.

## 8. Risques de régression

- Un `role` mal déduit pourrait faire disparaître une prestation réelle : atténuation par la Phase B en observation seule et par le repli `main` quand le rôle est absent ou incohérent.
- Sur-fusion si `scope` est mal normalisé : la clé inclut périmètre et dimensions, et le lot est exclu de la décision.
- Contrôles trop stricts bloquant un transfert légitime : message explicite listant les faits fautifs, jamais de devis partiel silencieux.
- Faits anciens sans nouveaux champs : chemin de compatibilité conservé tant que la Phase E n'est pas validée.
- Le devis actuel (création, prix, PDF, enregistrement, envoi, signature) n'est touché à aucune phase.

## 9. Ce qui se fait sans base de données

Tout. Rôles, relations, périmètre, clé de ligne et contrôles vivent dans le contrat de faits sérialisé et dans le brouillon côté client. Aucune migration, aucune RLS, aucun champ de table nouveau. Une persistance en base ne se poserait qu'un jour, si l'on souhaitait rejouer un devis à partir des faits d'origine — hors périmètre de ce plan.
