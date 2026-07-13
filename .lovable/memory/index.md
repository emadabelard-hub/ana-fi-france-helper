# Project Memory

## Core
- **Language**: Strict French for generated documents. Egyptian Ammiya for Arabic UI (no Darija). Zero Arabic/Cyrillic in French UI.
- **External comms FR only**: Devis, factures, avoirs, e-mails, SMS, WhatsApp, signature électronique, notifications client, relances, PDF, docs admin/création d'entreprise, exports tiers → **français exclusivement, zéro arabe**. Bilinguisme FR/AR réservé à l'UI utilisateur connecté.
- **Financial**: EU format (1.250,00 €). RTL right-aligned. Calc: HT -> Discount -> Subtotal HT -> VAT -> TTC.
- **Design**: 'Luxury Business' theme. 'Inter' for Latin, 'IBM Plex Sans Arabic' for Arabic. 'Sober Pro' for documents.
- **Quotes (Devis)**: NEVER show 'Net à payer' or 'Restant'. Use 'Acompte à la commande'.
- **UX**: Visual silence. No generic red error banners. Number/address fields forced LTR (lang='fr').
- **Protected Systems**: NEVER modify tax engines, RLS, or PDF exports without explicit request.
- **Devis→Facture**: VERROUILLÉ. Copie stricte, désignation inviolable, zéro valeur par défaut, acompte séparé uniquement.

## Memories
- [External communications language](mem://constraints/external-communications-language) — Zero Arabic in any outbound document, email, SMS, WhatsApp, signature page, PDF, admin doc, or third-party export
