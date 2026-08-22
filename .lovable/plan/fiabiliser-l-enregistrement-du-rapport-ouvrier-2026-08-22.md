# Fiabiliser l’enregistrement du rapport ouvrier

## Modification ciblée
- Ajouter une fonction backend dédiée qui reçoit les données du rapport, vérifie que l’utilisateur connecté est bien affecté au chantier (ou en est le propriétaire), déduit automatiquement l’artisan propriétaire et crée ou met à jour l’unique ligne correspondante.
- Remplacer uniquement l’écriture directe dans `saveReportRow()` par l’appel à cette fonction.
- Conserver inchangés la génération PDF, l’archivage, WhatsApp, la pagination, les signatures et l’écran artisan.

## Garanties
- Aucun rapport sans chantier valide.
- `user_id` correspond toujours au propriétaire réel du chantier et `submitted_by` à l’utilisateur connecté.
- Une seule ligne par `chantier_id + report_number`.
- WhatsApp reste bloqué si l’enregistrement échoue, avec le message d’erreur existant.

## Vérification
- Tester l’appel avec une affectation ouvrier existante.
- Vérifier en base la ligne unique, le chantier, l’artisan, l’ouvrier, le statut et le PDF.
- Vérifier que cette ligne est récupérée par l’onglet Rapports du chantier concerné.
