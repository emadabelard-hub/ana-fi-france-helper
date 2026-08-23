# Analyser mon projet — pipeline strictement par document

## 1. Chaîne exacte finale

```text
Document 1 ─┐   lecture → fiche compacte → faits du doc 1 → contrat validé doc 1
Document 2 ─┼─  lecture → fiche compacte → faits du doc 2 → contrat validé doc 2
Document 3 ─┘   lecture → fiche compacte → faits du doc 3 → contrat validé doc 3
                                   ↓
                  regroupement déterministe côté serveur (aucun appel IA)
                                   ↓
                     dossier consolidé + faits validés + sources
                                   ↓
                    Claude — btp_deep_technical_analysis
                                   ↓
                              rapport final
```

Aucun appel IA n'agit sur plus d'un document (ou d'une portion de document) à la fois. Il n'existe plus aucune étape « toutes les fiches → un appel d'extraction factuelle ».

## 2. Production des faits, document par document

Pour chaque document, deux appels IA successifs, tous deux limités à ce seul document :

1. **Lecture** : appel actuel de lecture documentaire avec `attachments: [doc]` → fiche technique compacte (`<ANAFYPRO_DOCUMENT_DATA>`).
2. **Extraction factuelle** : appel `btp_factual_extraction` alimenté **uniquement** par la fiche de ce document → bloc de faits de ce document.

Les faits conservent intégralement le format Phases A/B : `factId`, `role`, `operation`, `scope`, `parentRef` / `coveredByFactId`, `includesMaterials`, `includesLabor`, `lineKey`. Le prompt d'extraction n'est pas réécrit : il reçoit simplement un périmètre plus petit.

Chaque fait reçoit en plus, côté serveur, sa provenance : identifiant interne du document + nom de fichier + éventuelle portion (voir §5). Cette provenance est ajoutée après validation, elle n'est jamais demandée à l'IA.

## 3. Validation de chaque contrat

Pour chaque document, immédiatement après son extraction :

- `parseFactsBlock` puis `validateBtpFacts` sur les faits de ce document seul ;
- `parentRef` / `coveredByFactId` sont donc résolus **dans le périmètre du document**, ce qui est le comportement naturel : un composant inclus appartient toujours à l'ouvrage décrit par le même document ;
- contrat vide ou illisible → ce document est marqué `factsError` **sans repli silencieux**, les autres documents continuent ;
- le contrat validé et l'état (ok / erreur) sont enregistrés dans le travail avant de passer au document suivant.

Le fichier `_shared/btpFactsContract.ts` n'est pas modifié : les 97 tests Phases A/B restent valables tels quels.

## 4. Regroupement des contrats (code serveur, aucune IA)

Le serveur produit un contrat consolidé :

- concaténation des faits validés de tous les documents, **chacun conservant sa provenance** ;
- `counts` recalculé par simple somme (`ready` / `pending` / `excluded` / `total`) ;
- collision éventuelle de `factId` entre deux documents : le `factId` est préfixé par l'identifiant du document, ce qui garantit l'unicité tout en préservant les liens `parentRef` internes (préfixés de la même façon, donc cohérents) ;
- deux documents décrivant le même ouvrage restent **deux faits distincts avec deux sources** : aucune fusion, aucune addition de quantités, aucun arbitrage. Le `lineKey` identique entre eux est simplement exposé comme indice de recoupement pour que l'analyse globale comprenne qu'il s'agit d'un même ouvrage vu par plusieurs documents ;
- les fiches compactes sont regroupées de la même façon, chaque bloc restant identifié par son document.

Cette étape est de la pure agrégation : rien n'est inventé, rien n'est supprimé.

## 5. Document individuel trop volumineux

Un document n'est jamais déclaré en échec au premier appel qui atteint la limite de tokens. Traitement en portions :

- la troncature est déjà détectable (`stop_reason` de type longueur / marqueur de troncature dans le flux) ;
- si la lecture d'un document est tronquée, le document est subdivisé en portions maîtrisées (découpage par pages pour un PDF, sinon par sections de taille bornée de sa couche texte) ;
- chaque portion suit le même traitement : fiche compacte de la portion → faits de la portion → validation ;
- les portions d'un même document sont d'abord regroupées **au niveau du document** (même logique qu'au §4, provenance = document + portion), produisant un contrat de document unique ;
- ce contrat de document rejoint ensuite le regroupement global ;
- une portion reste inexploitable après subdivision → seule cette portion est signalée manquante, le document et le dossier continuent, et le rapport mentionne explicitement la portion non exploitée.

## 6. Idempotence et reprise du worker

L'état est enregistré au grain le plus fin :

- `step_results.docs[<docId>]` porte, pour chaque document : `sheet`, `parts` (si subdivisé), `factsContract`, `factsError`, `done` ;
- avant chaque appel IA, le worker vérifie si ce résultat existe déjà : présent → jamais rejoué ;
- le budget de temps est contrôlé après chaque sous-étape (lecture d'un document, extraction d'un document, portion) ; s'il est dépassé, l'état est enregistré et le self-chaining existant reprend exactement là où il s'est arrêté ;
- le regroupement et le rapport final restent idempotents comme aujourd'hui (`final_report` déjà présent → pas de nouvel appel).

Conséquence utile : chaque appel IA étant petit, une reprise ne coûte plus jamais la totalité du dossier.

## 7. Fichiers réellement nécessaires

| Fichier | Nature de la modification |
|---|---|
| `supabase/functions/btp-analysis-worker/index.ts` | boucle par document (lecture → extraction → validation), subdivision d'un document volumineux, stockage fin par document, regroupement déterministe |
| `supabase/functions/ai-assistant/index.ts` | ajustement du seul prompt `btp_deep_technical_analysis` : données issues de plusieurs documents/portions, sources multiples possibles pour un même ouvrage, interdiction d'additionner des quantités de sources différentes, mention des portions non exploitées |

Aucun autre fichier n'est nécessaire. `_shared/btpFactsContract.ts` reste inchangé.

## 8. Ce qui devient inutile dans l'ancien pipeline

- l'appel de lecture unique portant l'ensemble des `attachments` ;
- l'appel global `btp_factual_extraction` sur le dossier entier ;
- l'état global `results.docData` / `results.facts` / `results.factsContract` comme uniques porteurs de résultat (remplacés par l'état par document + le consolidé) ;
- le repli « réponse non structurée conservée comme rapport final » reste utile uniquement pour le cas sans pièce jointe (texte libre), inchangé.

## 9. Confirmation — plus aucun gros appel global

Confirmé : après cette correction, `btp_factual_extraction` n'est appelé qu'avec la fiche d'**un** document, ou d'**une** portion de document. Il n'existe aucun chemin de code qui lui transmette le dossier consolidé. Le seul appel qui voit l'ensemble du dossier est `btp_deep_technical_analysis`, qui reçoit des fiches compactes et des faits déjà validés — c'est le but du rapport.

## 10. Confirmation — aucun frontend, aucun devis touché

- `src/pages/AIAssistantPage.tsx` : **non modifié** (pas de libellé « document X/Y » pour l'instant, donc aucun Publish frontend pendant les tests).
- Devis intelligent, `btp-quote-from-documents`, factures, TVA, prix, PDF, RLS, tables : **non touchés**. Ce pipeline a pour seul objectif le rapport d'analyse.

## Vérification prévue

1. `bunx vitest run` — les 97 tests existants doivent rester verts (contrat inchangé).
2. Déploiement de `btp-analysis-worker` et `ai-assistant`.
3. Test réel 3 documents MARTIN : 3 fiches distinctes, 3 contrats validés non vides, logs `[btpFacts][phaseB]` présents pour chaque document, rapport final complet et non tronqué.
