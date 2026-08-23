# Analyser mon projet — pipeline par document (fiches compactes)

## Objectif

Aujourd'hui, tous les documents sont envoyés à l'IA en un seul appel. Sur un dossier réel (3 documents MARTIN), la réponse est tronquée à la limite de tokens : le bloc structuré est illisible, le contrat de faits est vide, et le rapport final est produit sur des données partielles.

Nouvelle chaîne cible :

```text
Documents
   ↓  un appel IA PAR document
Fiche technique compacte par document
   ↓  regroupement serveur (aucun appel IA)
Dossier consolidé
   ↓  extraction factuelle (contrat existant)
   ↓  Claude — analyse technique approfondie
Rapport utilisateur
```

Chaque document est lu seul, donc jamais tronqué. Le regroupement est du code, pas de l'IA.

## Ce qui change

### 1. Étape « Lecture par document » (btp-analysis-worker)

L'étape 1 actuelle (un appel avec `attachments` complet) devient une boucle document par document :

- pour chaque pièce jointe : un appel `ai-assistant` avec **une seule** pièce (`attachment`, `attachments: [doc]`), qui produit la fiche compacte `<ANAFYPRO_DOCUMENT_DATA>` déjà utilisée aujourd'hui ;
- chaque fiche est enregistrée immédiatement dans `step_results.docSheets[index]` → étape **idempotente** : une fiche déjà obtenue n'est jamais rejouée, y compris après reprise (self-chaining) ;
- vérification du budget de temps après chaque document, avec reprise automatique existante ;
- un document illisible n'arrête pas le dossier : il est marqué en échec dans sa fiche et signalé dans le rapport (« document non exploitable »), sans invention de contenu ;
- texte libre saisi sans pièce jointe : comportement actuel inchangé (un seul appel).

Progression : l'avancement de l'étape `analyze` est réparti sur le nombre de documents (ex. 3 documents = 3 paliers) pour que l'utilisateur voie où en est la lecture.

### 2. Étape « Regroupement des fiches » (code, aucun appel IA)

Fusion des fiches en un dossier consolidé, en conservant l'origine de chaque élément :

- concaténation des prestations/observations de chaque fiche, chaque élément gardant son document source (nom de fichier) ;
- conservation des doublons **sans fusion silencieuse** : deux documents décrivant la même prestation restent deux sources de la même ligne (règle « plusieurs sources ≠ plusieurs prestations » déjà actée) ;
- aucune addition de quantités, aucun arbitrage automatique.

Le résultat remplace `results.docData` et alimente l'étape existante `btp_factual_extraction` sans changer son contrat.

### 3. Étape « Analyse technique approfondie » (prompt)

`btp_deep_technical_analysis` reçoit :

- le dossier consolidé (fiches regroupées, avec les documents sources) ;
- le contrat de faits validé (`factsContractText`), source unique des faits, inchangé.

Ajustement minimal du prompt : indiquer que les données proviennent de plusieurs documents distincts, mentionner les documents non exploitables, ne jamais additionner des quantités provenant de sources différentes.

### 4. Robustesse tokens

- la limite de tokens reste inchangée, mais elle n'est plus atteinte puisqu'un appel = un document ;
- si une fiche isolée est encore tronquée (document très volumineux), l'échec est explicite pour ce document uniquement ; le reste du dossier continue.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `supabase/functions/btp-analysis-worker/index.ts` | boucle par document, stockage `docSheets`, regroupement, progression |
| `supabase/functions/ai-assistant/index.ts` | ajustement du prompt `btp_deep_technical_analysis` (multi-documents) |
| `src/pages/AIAssistantPage.tsx` | libellé de progression « Lecture du document X/Y » (affichage uniquement) |

## Non touché

- Contrat `_shared/btpFactsContract.ts` (Phases A/B validées, 97 tests).
- Devis, factures, TVA, prix, PDF, RLS, extraction `btp-quote-from-documents`.
- Phases C/D/E (transfert vers Devis intelligent) : abandonnées, hors périmètre.

## Vérification

1. `bunx vitest run` : les 97 tests existants restent verts.
2. Déploiement de `btp-analysis-worker` et `ai-assistant`.
3. Test réel avec les 3 documents MARTIN : vérifier dans les journaux 3 fiches compactes distinctes, un contrat de faits non vide, des logs `[btpFacts][phaseB]` présents, et un rapport final complet.
