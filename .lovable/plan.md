# Analyser mon projet — pipeline par document, un seul appel IA par document

## 1. Chaîne finale

```text
Document 1 (original) ─► 1 appel IA ─► fiche compacte + faits ─► validation ─► contrat doc 1
Document 2 (original) ─► 1 appel IA ─► fiche compacte + faits ─► validation ─► contrat doc 2
Document 3 (original) ─► 1 appel IA ─► fiche compacte + faits ─► validation ─► contrat doc 3

Document volumineux : découpage en portions ─► 1 appel IA par portion ─►
                      fiche + faits par portion ─► validation ─► regroupement du document
                                   ↓
        consolidation déterministe serveur (remapping factId / coveredByFactId)
                                   ↓
              dossier consolidé : fiches + faits validés + sources
                                   ↓
                  Claude — btp_deep_technical_analysis
                                   ↓
                           rapport final
```

## 2. Un seul appel IA par document — faisable, retenu

Vérification faite dans `ai-assistant/index.ts` : les deux prompts existants sont indépendants et compatibles.

- la lecture documentaire produit déjà un bloc `<ANAFYPRO_DOCUMENT_DATA>` en tête de réponse, **avant** toute partie narrative ;
- `btp_factual_extraction` produit déjà un bloc `<ANAFYPRO_BTP_FACTS>` et sait travailler directement sur les pièces originales (images, PDF, docx) — il ne dépend pas de la fiche ;
- rien dans le code n'impose l'enchaînement en deux appels : c'est uniquement l'historique du worker.

Décision : **une nouvelle action** `btp_document_ingest` dans `ai-assistant`, appelée une fois par document (ou portion), qui reçoit la **pièce originale** et renvoie, dans cet ordre :

1. `<ANAFYPRO_DOCUMENT_DATA>` … `</ANAFYPRO_DOCUMENT_DATA>` — fiche technique compacte de ce document ;
2. `<ANAFYPRO_BTP_FACTS>` … `</ANAFYPRO_BTP_FACTS>` — faits structurés du même document, format Phases A/B inchangé (`factId`/`id`, `role`, `operation`, `scope`, `parentRef`, `includesMaterials`, `includesLabor`).

Son prompt est la réunion des deux prompts existants, sans la partie narrative de la lecture documentaire (inutile ici : le narratif final est produit par le rapport). Les interdictions factuelles de `btp_factual_extraction` s'appliquent au bloc de faits.

Bénéfices : une seule lecture de la source, aucune réinterprétation d'un résumé, coût et latence réduits de moitié, une seule source de vérité par document.

Les actions existantes `btp_factual_extraction` et la lecture documentaire classique restent en place pour les autres parcours (texte libre sans pièce jointe, conversation), mais ne sont plus appelées dans ce pipeline.

## 3. Validation par document

Pour chaque document / portion, immédiatement après son appel :

- extraction des deux blocs de la réponse ; bloc manquant ou JSON incomplet → ce document est marqué en erreur explicite, **sans repli silencieux**, et les autres continuent ;
- `parseFactsBlock` + `validateBtpFacts` sur les faits de ce seul document → `factId`, `lineKey`, `role`, résolution `parentRef → coveredByFactId` dans le périmètre du document (comportement naturel : un composant inclus appartient toujours à l'ouvrage du même document) ;
- contrat vide → erreur enregistrée pour ce document ;
- fiche + contrat + état enregistrés avant de passer au document suivant.

`_shared/btpFactsContract.ts` n'est pas modifié.

## 4. Consolidation des contrats et remapping des identifiants

Étape purement déterministe, aucun appel IA, en trois temps :

1. **Table de correspondance** par document : `ancien factId → <docId>_<ancien factId>`.
2. **Réécriture** : chaque fait reçoit son nouveau `factId`, et **`coveredByFactId` est remappé avec la même table**. `parentRef` (référence temporaire d'avant validation) n'est plus utilisé comme relation après validation — la seule relation finale est `coveredByFactId`.
3. **Contrôle d'intégrité** : chaque `coveredByFactId` doit pointer vers un `factId` réellement présent dans le consolidé ; sinon la relation est neutralisée (`coveredByFactId: null`) et le fait est signalé, jamais rattaché arbitrairement.

Le consolidé conserve par ailleurs :

- la provenance de chaque fait (identifiant document, nom de fichier, portion le cas échéant) ;
- tous les faits de tous les documents, sans fusion et sans addition de quantités ;
- plusieurs documents décrivant le même ouvrage → plusieurs faits, plusieurs sources ; l'égalité de `lineKey` est exposée comme simple indice de recoupement pour l'analyse ;
- `counts` recalculé par somme.

Le même mécanisme (correspondance + remapping + contrôle) sert au regroupement des portions à l'intérieur d'un document, avec `<docId>_p<portion>_` comme préfixe.

**Test ajouté** (`src/test/`) : un `main` de `factId` `A` et un `included_component` de `coveredByFactId` `A`, après consolidation du document 1, donnent `doc1_A` et `coveredByFactId: doc1_A`, relation toujours valide ; plus un cas de collision `A` entre deux documents restant distincte, et un cas de `coveredByFactId` orphelin neutralisé.

## 5. Document individuel trop volumineux

Aucun document n'est déclaré en échec au premier appel tronqué :

- la troncature est détectée via le signal de longueur / le marqueur de troncature déjà présents dans le flux, ou un bloc non fermé ;
- le document est alors subdivisé en portions maîtrisées : par pages pour un PDF, sinon par sections bornées de sa couche texte ;
- un appel `btp_document_ingest` par portion → fiche + faits de la portion → validation ;
- regroupement au niveau du document (§4), produisant un contrat unique de document ;
- si une portion reste inexploitable, seule cette portion est signalée manquante ; le document et le dossier continuent et le rapport mentionne explicitement la portion non exploitée.

## 6. Idempotence et reprise du worker

État enregistré au grain le plus fin, dans `step_results.docs[<docId>]` : `sheet`, `parts[]` (si subdivisé), `factsContract`, `factsError`, `done`.

- avant chaque appel IA, le worker vérifie si le résultat existe déjà → jamais rejoué ;
- contrôle du budget de temps après chaque document et chaque portion ; dépassement → état enregistré et self-chaining existant reprend exactement au point d'arrêt ;
- consolidation et rapport final restent idempotents (`final_report` présent → aucun nouvel appel).

Un appel étant désormais petit, une reprise ne recoûte jamais la totalité du dossier.

## 7. Fichiers nécessaires

| Fichier | Modification |
|---|---|
| `supabase/functions/ai-assistant/index.ts` | nouvelle action `btp_document_ingest` (fiche + faits en un appel) ; ajustement du prompt `btp_deep_technical_analysis` (plusieurs documents/portions, sources multiples d'un même ouvrage, interdiction d'additionner des quantités de sources différentes, mention des portions non exploitées) |
| `supabase/functions/btp-analysis-worker/index.ts` | boucle par document, subdivision d'un document volumineux, stockage fin, consolidation + remapping + contrôle d'intégrité |
| `src/test/btpConsolidation.test.ts` (nouveau) | tests de remapping `factId` / `coveredByFactId` (§4) |

`_shared/btpFactsContract.ts` reste inchangé.

## 8. Ce qui devient inutile dans ce pipeline

- l'appel de lecture unique portant tous les `attachments` ;
- l'appel global `btp_factual_extraction` sur le dossier entier ;
- le second appel IA par document (extraction depuis la fiche) ;
- les états globaux `results.docData` / `results.facts` / `results.factsContract` comme uniques porteurs (remplacés par l'état par document + le consolidé) ;
- le repli « réponse non structurée conservée comme rapport final » ne subsiste que pour le cas texte libre sans pièce jointe, inchangé.

## 9. Confirmation — aucun appel global d'extraction

Confirmé : aucun chemin de code ne transmet plus le dossier consolidé à une extraction factuelle. Chaque appel d'ingestion ne voit qu'un document ou une portion. Le seul appel qui voit l'ensemble est `btp_deep_technical_analysis`, qui reçoit des fiches compactes et des faits déjà validés — c'est l'objet du rapport.

## 10. Confirmation — rien d'autre n'est touché

Non modifiés : tout le frontend (`AIAssistantPage.tsx` compris, donc aucun Publish nécessaire), Devis intelligent, `btp-quote-from-documents`, factures, TVA, PDF, RLS, tables et migrations.

## Vérification prévue

1. `bunx vitest run` — 97 tests existants verts + nouveaux tests de consolidation.
2. Déploiement de `ai-assistant` et `btp-analysis-worker`.
3. Test réel 3 documents MARTIN : 3 appels d'ingestion, 3 contrats validés non vides, logs `[btpFacts][phaseB]` par document, relations `coveredByFactId` valides après consolidation, rapport final complet et non tronqué.
