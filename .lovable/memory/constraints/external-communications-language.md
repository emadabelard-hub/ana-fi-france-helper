---
name: External communications language
description: All outbound communications to non-users (clients, banks, admin, suppliers) must be strictly French — no Arabic. Bilingual FR/AR is reserved for the connected ANAFYPRO user's interface only.
type: constraint
---

**Règle absolue :** Toute communication destinée à une personne extérieure à ANAFYPRO doit être **exclusivement en français**. Aucun mot, phrase, bouton ni message en arabe ne doit apparaître.

**Concernés (français uniquement) :**
- Devis, factures, avoirs, bons de commande
- E-mails, SMS, messages WhatsApp
- Liens et pages de signature électronique, confirmations de signature
- Notifications client, relances de paiement
- PDF, documents administratifs, documents de création d'entreprise
- Exports remis à des tiers

**Bilinguisme FR/AR réservé à l'utilisateur connecté :**
- Interface, menus, boutons, formulaires
- Assistants IA, aides, tutoriels, explications
- Opportunités professionnelles, tableaux de bord, comptabilité, paramètres

**Why:** L'artisan a besoin d'une UI bilingue pour travailler ; les tiers (clients, administrations, banques, fournisseurs) doivent voir une application 100 % professionnelle en français.

**How to apply:** À tout nouveau développement touchant une sortie vers un tiers, vérifier qu'aucune chaîne AR n'est présente (sujets d'e-mails, corps, boutons de CTA, footers PDF, SMS, pages publiques de signature, etc.). Exception unique : l'utilisateur choisit explicitement une autre langue pour ses documents.
