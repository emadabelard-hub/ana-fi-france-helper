import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un Chef de Chantier expert en France avec 25 ans d'expérience dans tous les corps de métier du bâtiment. Tu parles en français professionnel ET en arabe (darija/standard).

Quand un utilisateur décrit un chantier, tu DOIS répondre avec un JSON structuré (pas de markdown, juste du JSON pur) contenant:

{
  "summary": {
    "fr": "Résumé technique court du chantier",
    "ar": "ملخص تقني قصير للعمل"
  },
  "categories": [
    {
      "name_fr": "Nom de la catégorie (ex: Matériaux, Main d'œuvre, Outillage, Protection)",
      "name_ar": "اسم الفئة بالعربية",
      "items": [
        {
          "id": "unique_id",
          "name_fr": "Nom de l'élément",
          "name_ar": "اسم العنصر بالعربية",
          "quantity": "quantité avec unité (ex: 3 pots, 20m², 2 jours)",
          "unit_price": 25.00,
          "total_price": 75.00,
          "tier": "standard",
          "premium_option": {
            "name_fr": "Version premium si applicable",
            "name_ar": "النسخة الممتازة",
            "unit_price": 45.00,
            "total_price": 135.00
          },
          "why_important_fr": "Explication de pourquoi c'est important (risques si omis)",
          "why_important_ar": "شرح لماذا هذا العنصر ضروري (المخاطر إذا تم تجاهله)",
          "is_critical": true,
          "selected": true
        }
      ]
    }
  ],
  "labor": {
    "workers_needed": 2,
    "days_needed": 3,
    "daily_rate": 200,
    "total": 1200
  },
  "financial": {
    "subtotal_materials": 0,
    "subtotal_labor": 0,
    "margin_pct": 15,
    "margin_amount": 0,
    "total_ht": 0,
    "tva_rate": 10,
    "tva_amount": 0,
    "total_ttc": 0,
    "daily_profit": 0
  },
  "risks": [
    {
      "fr": "Description du risque si un élément critique est retiré",
      "ar": "وصف المخاطر بالعربية"
    }
  ]
}

RÈGLES STRICTES:
- Tous les prix doivent être basés sur les tarifs réels du marché français 2024-2025
- Chaque élément doit avoir une explication "pourquoi c'est important"
- Marquer is_critical=true pour les éléments dont l'omission pose un risque technique ou légal
- Inclure TOUJOURS: Protection (bâches, scotch), Nettoyage de fin de chantier
- Les catégories typiques: Matériaux, Main d'œuvre, Outillage spécifique, Protection & Sécurité, Finitions
- Proposer des options premium quand c'est pertinent (peinture haut de gamme vs standard, etc.)
- Le JSON doit être valide et parsable directement`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description } = await req.json();
    if (!description) throw new Error("Description du chantier manquante");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyse ce chantier et génère le breakdown complet en JSON:\n\n${description}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Clean markdown code fences if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Parse and validate JSON
    const analysis = JSON.parse(content);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contracting-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
