# Activation contrôlée de la correction 4A bis

## Portée et autorisations

Préparer uniquement l’activation du SQL 4A bis, du worker `btp-analysis-job` et des messages de l’écran « Analyser mon projet ».

**L’approbation de ce plan n’autorise aucune intervention en production.** Chaque étape de maintenance, migration, déploiement, publication ou retour arrière nécessite une autorisation explicite distincte. Aucune analyse de test, aucun appel IA payant, aucune reprise de `cba81e5f`, aucun changement de données d’analyse existantes.

## Préconditions vérifiées le 20 novembre 2026

- Version préparée : commit `0c991665`, copie initialement propre ; 245 tests validés, dont 26 SQL locaux, sans nouvelle exécution.
- Lectures entre 21:19 et 21:21 UTC : **0 job queued/running et 0 lease présent**. Cette observation devra être renouvelée immédiatement avant intervention ; elle ne bloque pas les nouveaux départs.
- `cba81e5f` reste `failed`, 12 tentatives, sans lease, dernière modification à 16:07:39 UTC.
- Les deux nouvelles tables et les nouvelles fonctions de réservation ne sont pas installées.
- Colonnes/types et clé primaire compatibles ; signatures RPC conservées, accès réservé au service. Heartbeat et jeton interne inchangés.
- Les deux tâches automatiques dispatch/stale sont actives, chacune toutes les minutes. Aucun changement de fréquence n’est prévu.
- Bundle publié : `index-D1EUG1WL.js` / `ProjectAnalysisPage-BoBVTbOG.js`. Parcours projet présent, messages `ANALYSIS_ATTEMPT_LIMIT:` et conservation absents : publication nécessaire pour ces messages.

## Conditions encore à satisfaire avant production

1. **Sauvegarde réelle** : obtenir l’horodatage UTC du dernier instantané dans More → Database → Manage → Backups. L’inventaire des sauvegardes n’est pas accessible aux outils utilisés ; sa disponibilité n’est pas confirmée.
2. **Retour arrière vérifiable** : archiver les définitions/permissions SQL lues, préparer et tester leur inverse hors production. Archiver le worker réellement déployé et l’interface publiée. Git conserve le code préparé, mais la correspondance du worker en ligne n’est pas établie par les outils/journaux consultés.
3. **Fenêtre sans nouveaux départs** : préparer/tester hors production une exclusion temporaire de ce worker. Les tâches suspendues seules ne suffisent pas : `mode=create` lance `triggerNext`. Le traitement Word partage ce worker ; sa suspension temporaire doit être explicitement acceptée. Aucun autre parcours fermé.
4. **Portée de publication** : identifier la version publiée et comparer les changements. Une publication remplace tout le bundle, pas une page. Si des changements extérieurs non autorisés apparaissent, préparer une version strictement limitée avant de demander l’accord de publication.

Il s’agit de préconditions opérationnelles, pas d’une nouvelle anomalie fonctionnelle identifiée dans les 245 tests. **Le passage en production reste suspendu à leur résolution.**

## Sauvegarde et retour arrière

- Lovable Cloud documente une sauvegarde quotidienne, conservée environ 14 jours, du schéma et des données de la base. Les fichiers stockés ne sont pas inclus ; aucun stockage n’est changé par cette activation.
- Restauration uniquement aux instantanés quotidiens, pas à un instant arbitraire.
- Une restauration complète écrase le schéma et les données créés/modifiés depuis l’instantané et rend temporairement la base indisponible. **Elle n’est ni le retour arrière prévu ni autorisée ici.**
- Export supplémentaire éventuel via More → Database → Manage → Settings → Export data, sur accord distinct ; aucun dump par script.
- Retour arrière privilégié : sous exclusion ciblée et après autorisation, rétablir le worker/interface depuis leurs archives vérifiées, en conservant le SQL compatible et les traces.
- Inversion SQL éventuelle : accord distinct et migration compensatrice rétablissant uniquement les anciennes RPC/permissions. Conserver les nouvelles tables/traces ; aucune purge, réécriture de résultats ou restauration globale.
- Restaurer les anciennes fonctions peut réintroduire les défauts de reprise historiques : ne pas rouvrir le parcours tant que l’ensemble SQL/worker n’est pas jugé sûr.
- Si des traitements ou écritures apparaissent durant la fenêtre, suspendre la procédure et demander une décision ; ne pas les arrêter ou modifier automatiquement.

## Ordre exact proposé — un accord distinct à chaque intervention

### 0. Préparation hors production

Finaliser les préconditions, archives, script inverse et exclusion testée hors production. Aucune activation, aucun changement de prompt ou de moteur.

### 1. Exclusion temporaire et arrêt des déclenchements

Après autorisation spécifique : bloquer temporairement les nouveaux départs create/work de ce worker et suspendre uniquement les deux tâches dispatch/stale. Aucun job existant n’est mis à jour. Vérifier une nouvelle fois qu’il ne reste aucun job queued/running ni lease ; si ce n’est pas le cas, ne pas poursuivre.

Maintenir l’exclusion pendant le déploiement final. Sans dispositif vérifié empêchant une réouverture prématurée, ne pas commencer l’activation.

### 2. Migration SQL définitive

Après autorisation spécifique : appliquer en une transaction le SQL testé sous `supabase/pending/20261120190100_analysis_attempt_safety.sql`.

- Créer les deux tables de traces, leurs contraintes, droits et politiques de lecture propriétaire.
- Installer les fonctions de budget, prochaine étape, clôture documentaire et réservation/journalisation.
- Remplacer claim/commit/fail/stale, signatures historiques conservées.
- Aucune mise à jour de jobs au niveau principal du SQL ; les mises à jour sont dans les fonctions, non appelées sur de vrais jobs pour les contrôles.
- Ne pas ajouter de tâche planifiée, changer de secret, modifier les tables métier ou les politiques existantes.
- Le SQL est **à appliquer une seule fois** : les créations de tables ne sont pas idempotentes. En cas de résultat incertain, contrôler le schéma avant toute nouvelle tentative.

**SQL avant worker** : celui-ci dépend des nouvelles RPC. Les signatures compatibles avec l’ancien worker ne dispensent pas d’exclusion pendant la transition.

### 3. Déploiement limité du worker

Après autorisation et contrôles SQL réussis : activer uniquement `btp-analysis-job` et ses modules partagés corrigés. Aucun autre worker redéployé. Exclusion et tâches suspendues maintenues. Modèle, paramètres, prompts, extraction et consolidation inchangés ; vérifier réussite et version effective.

### 4. Publication de l’interface

Après autorisation et contrôle de portée : publier les messages 4A et l’affichage des sources non exploitées. Vérifier le bundle réellement servi sur anafypro.com, pas uniquement le dépôt/aperçu.

Si les messages avaient été publiés entre-temps et sont prouvés présents, éviter une publication redondante.

### 5. Réouverture contrôlée

Après autorisation et contrôles sans IA : retirer l’exclusion et réactiver seulement les deux tâches aux horaires initiaux. Aucun dispatch, récupération ou analyse déclenché manuellement.

Les tâches existantes représentent 1 440 exécutions/jour chacune, 2 880 au total ; leur réactivation restaure cette cadence existante, sans augmentation.

## Contrôles immédiatement après chaque étape — sans IA ni modification de jobs

### Après le SQL, avant le worker

- Lire les tables, contraintes, politiques et droits : propriétaire authentifié en lecture seulement ; rôle de service pour les écritures/RPC ; pas d’accès anonyme.
- Comparer chaque signature, type de retour et définition RPC au SQL figé.
- Exécuter uniquement les deux helpers purs sur des JSON fictifs, sans identifiant de job : `analysis_step_limit` (doc=2, global/Word=3) et `analysis_next_step` (sources failed/needs_chunking présentes → source suivante ou dossier).
- Ne pas appeler claim/begin/record/commit/fail/stale sur un vrai job : ces fonctions peuvent écrire même lorsque leur appel est formulé comme une requête de lecture.
- Vérifier traces vides, nombre de jobs et empreintes des résultats/statuts inchangés, `cba81e5f` identique. Capturer des empreintes/compteurs, pas de corps documentaires.

### Après le worker

- Contrôler le résultat/version du déploiement et l’absence d’erreur d’import/RPC dans les nouveaux journaux techniques.
- Sondes sans analyse : OPTIONS attendu 200 ; create sans Authorization attendu 401 ; work sans jeton interne attendu 403. Aucun document, aucun jeton interne, aucun identifiant de vrai job transmis.
- Vérifier que ces sondes n’ont créé ni job ni trace d’appel IA, ni modifié un résultat.

### Après l’interface et après réouverture

- Lire le HTML et les fichiers JS effectivement servis ; confirmer les nouveaux messages et la version du bundle.
- Contrôler l’écran avec la session existante si disponible, sans importer de document ni cliquer sur « Analyser ». Aucun compte de test n’est créé.
- Recontrôler la configuration des tâches, les erreurs techniques, l’absence de reprise de `cba81e5f` et la conservation de ses résultats.
- Génération, qualité de rapport et consommation Claude non testées : accord ultérieur distinct requis.

## Détails techniques figés

- SQL SHA-256 : `f7c5e1f3c035428c4f4d35b107a00366e7f00b4b69992104374eaa272c6db250`.
- Worker et modules corrigés : commit `0c991665`.
- RPC inchangées en signature : claim(uuid,uuid), heartbeat(uuid,uuid), commit(uuid,uuid,text,jsonb,integer,text,text,text optionnel), fail(uuid,uuid,text,boolean optionnel), stale().
- Nouvelles RPC appelées par le worker : begin(uuid,uuid,text,text,bigint,bigint,bigint) → uuid ; record(uuid,uuid,text,double precision,bigint,bigint,text,integer) → boolean.
- Aucun changement de données existantes, aucune activation, aucun nouveau test ni appel IA n’a été effectué pendant la préparation de ce plan.