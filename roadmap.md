# Statut terminal sans rapport global
- [x] Vérifier le type de statut et les décisions serveur/interface : texte sans CHECK, aucune migration.
- [x] Réserver completed aux rapports sauvegardés et afficher la raison sans rapport.
- [x] Tester les décisions et simuler 800 faits, 1 600 faits et un document hors budget : 247 tests réussis, 26 SQL non exécutés, sans IA ni production.

# Amélioration d’Analyser mon projet
- [x] Vérifier la sélection multiple et la limite de 20 documents.
- [x] Renforcer les prompts du parcours projet sans changer les autres parcours.
- [x] Contrôler les références après analyse sans réécrire le rapport.
- [x] Tester plusieurs dossiers et vérifier les fichiers modifiés.

# Correction technique n°3
- [x] Renforcer les contrôles déterministes des sections, références et valeurs contextualisées.
- [x] Afficher les anomalies et limites en français/arabe, avec compatibilité des anciens rapports.
- [x] Tester les 22 scénarios demandés et la reprise simulée ; vérifier l’isolation des prompts et autres parcours.
- [x] Éviter les faux écarts de dimensions reformulées et tester les valeurs décimales équivalentes.

# Correction n°4A
- [x] Préparer la migration des plafonds par étape et de l’historique des tentatives, sans l’appliquer au Cloud.
- [x] Instrumenter les appels du parcours projet et afficher l’échec avec conservation des documents.
- [x] Tester plafonds, concurrence, interruptions, traces et isolation des autres parcours : 208 tests réussis ; états mobiles FR/AR simulés vérifiés.
- [ ] Exécuter la migration : en attente d’autorisation spécifique ; aucun déploiement prévu.

# Correction n°4A BIS
- [x] Préserver la poursuite du dossier après plafond documentaire et interruption.
- [x] Vérifier les confirmations RPC et uniformiser les erreurs sans contenu sensible.
- [x] Neutraliser les journaux et tester les traitements projet/Word uniquement en local : 245 tests réussis.
- [x] Vérifier le diff et remettre le rapport ; SQL non appliqué, activation non autorisée.

# Préparation de l’activation contrôlée 4A bis
- [x] Vérifier en lecture seule les jobs/leases, les signatures SQL, les tâches automatiques et l’interface publiée.
- [x] Définir l’ordre d’activation, les contrôles sans IA et les autorisations séparées.
- [ ] Confirmer la sauvegarde réelle : horodatage UTC attendu de l’utilisateur.
- [ ] Valider le retour arrière et la portée de publication : version réellement déployée non identifiée, archives correspondantes à vérifier.
- [ ] Garantir une fenêtre sans nouveaux départs : exclusion ciblée non encore préparée ni autorisée.