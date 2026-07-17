
## Phase 5B — Plan d'exécution

### Ampleur constatée
- 5 fichiers UI à modifier (~3 000 lignes cumulées).
- **133 ternaires bilingues** `isRTL ? 'ar' : 'fr'` à remplacer par `t('clé')`.
- **158 lignes** contenant de l'arabe (chaînes en dur dans les ternaires).
- `chantierProfitability.ts` : aucun texte visible utilisateur → **non modifié**.

### Approche

**Sans i18next.** J'ajoute uniquement des clés au dictionnaire existant `LanguageContext.tsx` (bloc `fr` et bloc `ar`), puis je remplace les ternaires bilingues fichier par fichier par `t('clé')`. Aucune logique métier, aucun calcul, aucune requête, aucun classement des cartes financières, aucun `dir="ltr"` déjà en place ne sera altéré.

### Nouveaux namespaces de clés (dictionnaire central)

- `expenses.*` — page dépenses + modal d'ajout (~60 clés : titres, boutons, statistiques, filtres, catégories, états vides, OCR, HT/TTC, chantier, justificatif, envoi comptable, erreurs).
- `supplierInvoices.*` — liste + détail (~45 clés : titres, recherche, statuts, rattachement chantier, association dépense, PDF/Factur-X, erreurs).
- `chantier.*` — fiche chantier + rentabilité (~50 clés : synthèse financière, budget, onglets, blocs vides, rentabilité avec 4 statuts et détail estimation).
- `common.*` — quelques ajouts si nécessaires (`common.retry`, `common.download`, etc.) — vérification préalable qu'ils n'existent pas déjà.

Total estimé : **~155 nouvelles clés**, chacune avec valeur `fr` (professionnelle) et valeur `ar` (Ammiya égyptien). Zéro arabe dans le bloc `fr`.

### Directions RTL/LTR

- Conserver tous les `dir="ltr"` déjà présents (montants, dates, ordre des cartes financières).
- Ajouter localement `dir="ltr"` sur les champs SIRET, IBAN, e-mails, URL, numéros de facture, pourcentages, formules affichées uniquement si un ternaire les inversait aujourd'hui.
- Le texte arabe descriptif reste RTL via l'attribut `dir` de la racine RTL globale (aucune modification).

### Normalisation des erreurs (local uniquement)

Dans les 5 fichiers autorisés, je remplace les `toast({description: err.message})` visibles par des messages traduits via `t('...error...')`. L'erreur technique reste en `console.error` (déjà présent). Aucun système `mapError` global créé.

### Ordre d'exécution

1. Étendre `LanguageContext.tsx` avec les ~155 clés (bloc `fr` + bloc `ar`).
2. Remplacer les ternaires dans `SupplierInvoicesPage.tsx` (le plus petit, 148 lignes).
3. Remplacer dans `SupplierInvoiceDetailPage.tsx` (408 lignes).
4. Remplacer dans `AddExpenseModal.tsx` (491 lignes).
5. Remplacer dans `ChantierDetailPage.tsx` (525 lignes).
6. Remplacer dans `ExpensesPage.tsx` (1 303 lignes — le plus lourd, potentiellement en plusieurs passes).
7. Vérification finale : `rg '[\u0600-\u06FF]'` doit ressortir vide sur ces 5 fichiers (hors chaînes provenant de `t()`).

### Zones intouchables (rappel)

Calculs HT/TVA/TTC, `amount_type`, `supplier_invoice_id`, anti-double comptage, rattachements en base, requêtes Supabase, OCR, PDF, Factur-X, FEC, exports, téléchargements, ordre des cartes financières, migrations, RLS, Edge Functions, buckets.

### Livraison finale

Rapport indiquant : fichiers modifiés, liste des namespaces et clés ajoutées, ternaires remplacés, corrections RTL/LTR appliquées, messages techniques remplacés, résultat `tsc --noEmit` et build, confirmation zéro régression fonctionnelle.

### Note importante

Cette phase représente un volume conséquent d'édition (5 fichiers, ~150 remplacements). Je peux :

- **Option A** : exécuter d'un bloc en confiant la fiabilité aux replacements ciblés + build final.
- **Option B** : livrer par fichier avec ta validation intermédiaire (plus lent, plus sûr).

Confirme l'option souhaitée avant que je lance l'exécution.
