## Refonte complète du système de facturation par échéance

### Objectif
Remplacer le tracking actuel (basé sur `document_data.milestoneId` dans `documents_comptables`) par une table dédiée `milestone_invoices` qui devient la **seule source de vérité**.

---

### ÉTAPE 1 — Suppression

**Fichiers à supprimer :**
- `src/components/invoice/MilestoneInvoiceActions.tsx`
- `src/lib/milestoneInvoicePrefill.ts`

**Fichiers à nettoyer (retirer toutes les références) :**
- `src/pages/DocumentsListPage.tsx`
  - Imports de `MilestoneInvoiceActions`
  - Bouton "أقساط" sur les cartes devis (version actuelle)
  - Toute logique de comptage `milestoneInfoMap`
  - `allDocuments` passé à ce composant
- `src/components/invoice/InvoiceFormBuilder.tsx`
  - Bloc qui injecte `milestoneId` / `milestoneLabel` dans `linkedDocumentData`
  - Lecture sessionStorage `milestoneInvoiceData` (sera réécrit)
  - Logs `console.log('milestoneId à sauvegarder:'…)`

---

### ÉTAPE 2 — Nouvelle base de données

**Migration Supabase :**

```sql
CREATE TABLE public.milestone_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  devis_id uuid NOT NULL,
  devis_number text NOT NULL,
  milestone_index integer NOT NULL,
  milestone_label text,
  milestone_percent numeric,
  montant_ttc numeric,
  facture_id uuid,
  facture_number text,
  statut text NOT NULL DEFAULT 'facturee',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.milestone_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.milestone_invoices
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_milestone_invoices_devis ON public.milestone_invoices(devis_id, milestone_index);
CREATE INDEX idx_milestone_invoices_user ON public.milestone_invoices(user_id);
```

Statuts possibles : `'facturee'`, `'payee'`, `'cancelled'`.

---

### ÉTAPE 3 — Nouveau code

**Nouveau fichier `src/lib/milestonePrefill.ts`** (remplace `milestoneInvoicePrefill.ts`)
- Construit le prefill du formulaire (désignation, montant HT, notes…) — logique copiée mais simplifiée
- N'injecte plus rien dans `document_data` — juste les champs du formulaire

**Nouveau composant `src/components/invoice/MilestoneInvoiceActions.tsx`** (recréé from scratch)
- Props : `devisDoc` uniquement (plus de `allDocuments`)
- Charge directement `milestone_invoices` via Supabase (filtré par `devis_id`)
- Construit la map `index → { facture_id, facture_number, statut }`
- Affiche la liste des échéances avec badges (`en_attente` / `facturée` / `payée` / `annulée`)
- Au clic "Créer la facture" :
  1. Stocke prefill en sessionStorage (`milestoneInvoicePrefill`)
  2. Navigate vers `/pro/invoice-creator?prefill=milestone`
- Expose un mécanisme de refetch via React Query (clé `['milestone-invoices', devisId]`)

**Modification `InvoiceFormBuilder.tsx`**
- Après INSERT réussi de la facture, si `prefillData.source === 'milestone_invoice'` :
  ```ts
  await supabase.from('milestone_invoices').insert({
    user_id, devis_id, devis_number,
    milestone_index, milestone_label, milestone_percent,
    montant_ttc, facture_id: insertedDoc.id,
    facture_number: insertedDoc.document_number,
    statut: 'facturee',
  });
  ```
- Plus aucune injection dans `document_data`.

**Modification `DocumentsListPage.tsx`**
- Réintégrer `MilestoneInvoiceActions` (nouvelle version) avec uniquement `devisDoc` + callback `onViewInvoice`
- Bouton "أقساط X/Y" sur les cartes devis : compteur calculé depuis un hook `useMilestoneCounts(devisId)` qui lit `milestone_invoices`

---

### Vérification post-implémentation
1. Créer un devis avec 3 échéances
2. Facturer l'échéance 1 → vérifier badge "Facturée" + 1/3 dans le compteur
3. Recharger la page → état persiste
4. Sélectionner échéance 1 → bouton désactivé (déjà facturée)
5. Vérifier en base : 1 ligne dans `milestone_invoices` avec `facture_id` rempli

---

### Note technique
La migration ne touche pas `documents_comptables` — les anciennes factures milestone restent valides mais ne seront plus trackées via `document_data.milestoneId`. Si besoin, un script de backfill peut être ajouté ensuite (non inclus ici).
