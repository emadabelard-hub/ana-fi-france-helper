# Phase 5C — Francisation Assistant IA & Navigation basse

## Fichiers identifiés (audit lecture seule effectué)

1. **`src/pages/AIAssistantPage.tsx`** (1315 lignes) — page assistant IA visible sur la capture.
2. **`src/components/layout/BottomNavigation.tsx`** (189 lignes) — composant réel de la nav basse (utilisé via `MainLayout`, confirmé par la présence des onglets Comptabilité / Accueil / Contactez-nous / Mon Compte / Admin).
3. **`src/contexts/LanguageContext.tsx`** (921 lignes) — ajout des clés `aiAssistant.*` et `bottomNav.*`.

Aucun autre fichier ne sera touché.

## Périmètre strict — ce qui sera modifié

### AIAssistantPage.tsx (textes visibles uniquement)
- ~44 ternaires bilingues `isRTL ? 'ar' : 'fr'` remplacés par `t('aiAssistant.*')`.
- Onboarding (titre, sous-titre, placeholder nom, boutons genre, CTA « Commencer »).
- 4 catégories : libellés visibles (`Pro / Admin / Juridique / Personnel` vs `مهني / إداري / قانوني / شخصي`).
- Barre de saisie : placeholder, tooltips micro / pièce jointe / envoi / nouvelle conv / historique / effacer.
- États : chargement, réponse en cours, aucune conversation, fichier non pris en charge, micro indisponible, session expirée, erreur générique.
- Toasts d'erreur (`err.message` masqué → messages génériques traduits, détails vers `console.error`).
- Suggestions et exemples de questions visibles.

### BottomNavigation.tsx
- Remplacement des paires `labelAr` / `labelFr` par `t('bottomNav.*')`.
- Libellés FR : `Comptabilité`, `Accueil`, `Contactez-nous`, `Mon compte`, `Administration`.
- Libellés AR : `المحاسبة`, `الرئيسية`, `تواصل معنا`, `حسابي`, `الإدارة`.
- Onglets `team` (Rapport / Contact) traduits aussi.
- Routes, icônes, ordre, état actif, logique admin (`is_admin` RPC), visibilité conditionnelle : **inchangés**.

### LanguageContext.tsx
- Ajout uniquement des clés nécessaires sous `aiAssistant.*` et `bottomNav.*`.
- Valeurs FR dans `fr`, valeurs AR (arabe égyptien conservé) dans `ar`. Zéro AR dans le bloc `fr`.

## Ce qui NE sera PAS touché (garde-fous critiques)

- **`CategoryKey` = valeurs arabes fonctionnelles** (`'مهني' | 'اداري' | 'قانوني' | 'شخصي'`) : ces chaînes servent d'identifiants techniques transmis à l'Edge Function `ai-assistant` pour le contexte du prompt système. **Seuls les libellés d'affichage** changent ; les valeurs internes restent identiques.
- **Triggers arabes de commandes comptables** (`isAccountingCommand` : « كام كسبت الشهر », etc.) : ce sont des règles NLP côté client, pas du texte visible. **Non touchés**.
- **Contenu généré par `generateAccountingReport`** (rapport comptable en arabe) : c'est une sortie métier IA-adjacent. **Non touché** (hors périmètre « logique IA »).
- **Markers de parsing** (`===الرسالة_الرسمية===`, `--- بالعربي ---`) : structure de réponse IA. **Non touchés**.
- **Prompts, appels API, streaming, dictation, upload, storage, RLS, edge functions, routes, auth, `is_admin`** : intacts.

## RTL / LTR

- Placeholder input : alignement selon `isRTL` (déjà en place, vérifié).
- `dir="ltr"` local ajouté uniquement sur : e-mails, URLs, noms de fichiers, nombres, références affichés dans l'UI arabe (audit ciblé, minimal).

## Erreurs techniques

Dans les toasts et messages visibles : remplacer tout affichage de `err.message` par des messages génériques traduits. `console.error(err)` conservé partout.

## Tests

- `tsgo --noEmit` après modifications.
- Lecture visuelle FR/AR sur la page assistant IA + nav basse (viewport 407×800 via Playwright si besoin de vérification visuelle).

## Rapport final

Livré à la fin conformément à la section 13 du brief.

## Exécution

Les 3 fichiers seront modifiés en une seule passe (dépendances entre clés du contexte et usages dans les deux consommateurs). Aucune autre phase ne sera lancée sans validation.
