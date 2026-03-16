INSERT INTO public.btp_price_reference (travail, unite, prix_moyen, categorie)
VALUES ('peinture_finition', 'm2', 22, 'peinture')
ON CONFLICT (travail) DO UPDATE SET prix_moyen = 22, unite = 'm2', categorie = 'peinture';