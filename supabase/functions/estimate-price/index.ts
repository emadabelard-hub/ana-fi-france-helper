import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { items, qualityTier, projectType } = await req.json() as {
      items: Array<{
        id: string;
        designation_fr: string;
        designation_ar: string;
        unit: string;
        quantity: number;
        laborOnly: boolean;
      }>;
      qualityTier?: 'standard' | 'pro' | 'luxury';
      projectType?: 'direct' | 'sous_traitance';
    };

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const tier = qualityTier || 'standard';
    const pType = projectType || 'direct';

    // Calculate total quantity to detect small jobs
    const totalSurface = items
      .filter(i => i.unit === 'm²')
      .reduce((sum, i) => sum + i.quantity, 0);
    const isSmallJob = totalSurface > 0 && totalSurface < 15;
    const itemCount = items.length;

    const itemDescriptions = items.map((item) =>
      `Item ID="${item.id}" : "${item.designation_fr}" (${item.designation_ar}) — unité: ${item.unit}, qté: ${item.quantity}, ${item.laborOnly ? 'MAIN D\'OEUVRE SEULE (pas de fourniture)' : 'FOURNITURE ET POSE (matériaux + main d\'oeuvre)'}`
    ).join("\n");

    const systemPrompt = `Tu es شبيك لبيك (Shubbaik Lubbaik), le métreur-chiffreur IA de l'Artisan (المعلم).
⛔ MARCHÉ FRANÇAIS UNIQUEMENT — Prix BTP France métropolitaine 2024-2025. JAMAIS de référence au marché égyptien ou étranger.

═══════════════════════════════════════════
🧠 LOGIQUE DE CHIFFRAGE STANDARDISÉE
═══════════════════════════════════════════

Tu appliques une FORMULE SYSTÉMATIQUE pour chaque ligne :

📐 ÉTAPE 1 — DÉCOMPOSITION DU PRIX UNITAIRE
Pour chaque tâche, décompose mentalement :
  • Coût matériaux (CM) : prix d'achat des matériaux au m²/u/ml
  • Coût main d'œuvre (CMO) : temps × taux horaire artisan (35-50€/h selon spécialité)
  • Frais fixes (FF) : déplacement, protection, nettoyage, amortissement outillage
  • Marge artisan (MA) : bénéfice net de l'artisan

📊 ÉTAPE 2 — APPLICATION DE LA GAMME
${tier === 'standard' ? `🔧 GAMME STANDARD :
  • CM = prix entrée de gamme (marques distributeur, premiers prix)
  • MA = 15-20% du total HT (marge minimale viable)
  • Objectif : prix compétitif pour remporter le marché face aux concurrents` :
tier === 'pro' ? `⭐ GAMME PRO :
  • CM = prix qualité pro (Tollens, Grohe, grès cérame rectifié, marques reconnues)
  • CM majoré de +20-30% vs standard
  • MA = 20-25% du total HT (marge confortable)
  • Objectif : valoriser le savoir-faire, justifier la qualité supérieure` :
`💎 GAMME LUXURY :
  • CM = prix premium (Farrow & Ball, Hansgrohe Axor, grand format, marbre)
  • CM majoré de +50-80% vs standard
  • MA = 25-35% du total HT (marge premium justifiée par l'expertise)
  • Objectif : positionnement haut de gamme, clientèle exigeante`}

🤝 ÉTAPE 3 — APPLICATION DU TYPE DE CLIENT
${pType === 'direct' ? `CLIENT DIRECT (particulier ou professionnel) :
  • Prix marché normal avec marges artisan standard
  • Le client paie le prix juste pour un travail de qualité` :
`SOUS-TRAITANCE (donneur d'ordres / entreprise générale) :
  • Réduction de -15% à -20% sur le prix client direct
  • La marge est réduite mais le VOLUME compense
  • Ne JAMAIS descendre sous le seuil de rentabilité (CMO + CM + FF minimum)
  • Logique : accepter une marge plus faible pour sécuriser un flux de chantiers régulier`}

💡 ÉTAPE 4 — INTELLIGENCE CONTEXTUELLE
${isSmallJob ? `⚠️ PETIT CHANTIER DÉTECTÉ (< 15 m² total) :
  • Applique un COEFFICIENT PETIT CHANTIER de x1.3 à x1.5 sur les prix unitaires
  • Les frais fixes (déplacement, installation, protection) se répartissent sur peu de surface
  • Un artisan ne peut pas se déplacer pour un petit chantier au même prix/m² qu'un grand` : 
`📏 CHANTIER NORMAL (≥ 15 m²) :
  • Prix unitaires standards — les frais fixes sont absorbés par le volume`}
${itemCount >= 8 ? `📦 CHANTIER MULTI-POSTES (${itemCount} lignes) :
  • L'artisan est déjà sur place pour plusieurs tâches
  • Légère optimisation possible (-3% à -5%) sur les postes connexes (même corps de métier)` : ''}

🎯 ÉTAPE 5 — VALIDATION FINALE
Avant de répondre, vérifie pour CHAQUE ligne :
  ✅ Le prix couvre les matériaux (si F+P)
  ✅ Le prix couvre la main d'œuvre au taux horaire correct
  ✅ La marge artisan est incluse et viable
  ✅ Le prix est compétitif par rapport au marché français
  ✅ L'artisan GAGNE DE L'ARGENT sur chaque ligne (jamais à perte)
  ✅ Le devis total est cohérent et permet de REMPORTER LE MARCHÉ

═══════════════════════════════════════════
📋 BARÈME DE RÉFÉRENCE FRANCE 2024-2025
═══════════════════════════════════════════
(Prix CLIENT DIRECT, gamme STANDARD, F+P / MO seule)

PEINTURE :
  • Murs (2 couches) : 25-35€/m² (F+P) | 14-20€/m² (MO)
  • Plafond (2 couches) : 28-38€/m² (F+P) | 16-22€/m² (MO)
  • Boiseries/huisseries : 20-35€/ml (F+P) | 12-18€/ml (MO)
  • Sous-couche/impression : 8-15€/m² (F+P) | 5-8€/m² (MO)

PRÉPARATION SURFACES :
  • Enduit de ratissage : 18-28€/m² (F+P) | 10-16€/m² (MO)
  • Enduit de rebouchage : 12-20€/m² (F+P) | 8-12€/m² (MO)
  • Ponçage : 8-15€/m² (F+P) | 6-10€/m² (MO)
  • Décapage/décollage papier peint : 12-22€/m² | 8-15€/m² (MO)
  • Impression hydrofuge / anti-humidité : 10-18€/m² (F+P) | 6-10€/m² (MO)

CARRELAGE :
  • Sol standard : 45-70€/m² (F+P) | 28-45€/m² (MO)
  • Mural : 50-75€/m² (F+P) | 30-48€/m² (MO)
  • Faïence SDB : 55-85€/m² (F+P) | 35-50€/m² (MO)
  • Dépose ancien carrelage : 15-25€/m²

PLOMBERIE :
  • Pose WC complet : 300-550€/u (F+P) | 120-220€/u (MO)
  • Pose lavabo/vasque : 250-450€/u (F+P) | 100-180€/u (MO)
  • Robinetterie : 150-350€/u (F+P) | 60-120€/u (MO)
  • Colonne de douche : 350-700€/u (F+P) | 150-250€/u (MO)

ÉLECTRICITÉ :
  • Point lumineux : 80-150€/u (F+P) | 40-80€/u (MO)
  • Prise électrique : 80-140€/u (F+P) | 40-70€/u (MO)
  • Tableau électrique : 800-1500€/u (F+P) | 400-700€/u (MO)

DÉMOLITION / GROS ŒUVRE :
  • Démolition cloison : 25-50€/m²
  • Démolition mur porteur (avec reprise) : 150-300€/ml
  • Ragréage sol : 15-25€/m² (F+P) | 8-14€/m² (MO)
  • Chape : 25-40€/m² (F+P) | 15-25€/m² (MO)

DIVERS :
  • Protection chantier : 3-8€/m²
  • Nettoyage fin de chantier : 8-18€/m²
  • Évacuation gravats : 35-60€/m³
  • Échafaudage intérieur : 15-30€/m²/jour

NOTE GAMME : PRO = barème × 1.25 | LUXURY = barème × 1.6
NOTE SOUS-TRAITANCE : prix final × 0.82 (réduction -18% moyenne)

═══════════════════════════════════════════
📤 FORMAT DE RÉPONSE
═══════════════════════════════════════════
Réponds UNIQUEMENT avec un JSON valide :
{ "prices": [ { "id": "<EXACT ITEM ID>", "unitPrice": 35, "unit": "m²" } ] }

RÈGLES :
- "id" = copie EXACTE de l'Item ID fourni en entrée
- unitPrice = nombre entier arrondi
- Pour MO seule : prix main d'œuvre uniquement (la MO ne varie PAS selon la gamme)
- Pour F+P : prix total matériaux + main d'œuvre (les matériaux varient selon la gamme)
- Pas de texte, pas d'explication, JUSTE le JSON`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Chiffre ces ${itemCount} postes BTP (${tier.toUpperCase()} / ${pType === 'direct' ? 'CLIENT DIRECT' : 'SOUS-TRAITANCE'}${isSmallJob ? ' / ⚠️ PETIT CHANTIER' : ''}) :\n\n${itemDescriptions}\n\nJSON uniquement.` },
        ],
        temperature: 0.15,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Service surchargé, réessayez dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA indisponibles." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erreur estimation IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    let parsed: { prices: Array<{ id: string; unitPrice: number; unit?: string }> };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI price response:", rawContent);
      return new Response(JSON.stringify({ error: "Réponse IA invalide", raw: rawContent }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Post-processing: ensure no zero prices and apply sanity checks
    if (parsed.prices) {
      parsed.prices = parsed.prices.map(p => ({
        ...p,
        unitPrice: Math.max(p.unitPrice, 5), // minimum 5€ per unit
      }));
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-price error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
