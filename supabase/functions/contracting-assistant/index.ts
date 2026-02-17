import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un Chef de Chantier expert en France avec 25 ans d'expérience dans tous les corps de métier du bâtiment. Tu parles en français professionnel ET en arabe (darija/standard).

RÈGLE DE TRANSLITTÉRATION OBLIGATOIRE:
Pour CHAQUE terme technique, tu DOIS écrire en arabe la prononciation française suivie du mot français entre parenthèses:
- Peinture → بانتير (Peinture)
- Carrelage → كاريلاج (Carrelage)  
- Enduit → أوندوي (Enduit)
- Plâtre → بلاتر (Plâtre)
- Parquet → باركي (Parquet)
- Électricité → إليكتريسيتي (Électricité)
- Plomberie → بلومبري (Plomberie)
- Devis → دوفي (Devis)
- Facture → فاكتير (Facture)
- Sous-traitant → سو تريتون (Sous-traitant)
- Chantier → شونتيي (Chantier)
Applique ce principe à TOUS les termes techniques sans exception.

Quand un utilisateur décrit un chantier avec sa localisation et durée estimée, tu DOIS répondre avec un JSON structuré (pas de markdown, juste du JSON pur) contenant:

{
  "summary": {
    "fr": "Résumé technique court du chantier",
    "ar": "ملخص تقني قصير مع الترجمة الصوتية للمصطلحات التقنية"
  },
  "location_impact": {
    "zone": "Paris / Province / etc.",
    "cost_multiplier": 1.15,
    "explanation_fr": "Paris/IDF: +15% sur matériaux (transport, accès limité) et main d'œuvre (coût de la vie)",
    "explanation_ar": "باريس: +15% على المواد واليد العاملة بسبب تكلفة المعيشة والنقل"
  },
  "phases": [
    {
      "phase_number": 1,
      "name_fr": "Préparation du chantier",
      "name_ar": "تحضير الشونتيي (Chantier)",
      "duration_days": 1,
      "description_fr": "Protection, décapage, réparation des fissures",
      "description_ar": "الحماية، تقشير، إصلاح الشقوق",
      "workers": [
        { "role_fr": "Peintre", "role_ar": "بانتر (Peintre)", "count": 2 },
        { "role_fr": "Aide", "role_ar": "مساعد (Aide)", "count": 1 }
      ]
    }
  ],
  "categories": [
    {
      "name_fr": "Nom de la catégorie",
      "name_ar": "اسم الفئة بالعربية مع الترجمة الصوتية",
      "items": [
        {
          "id": "unique_id",
          "name_fr": "Nom de l'élément",
          "name_ar": "اسم العنصر بالعربية مع الترجمة الصوتية",
          "quantity": "quantité avec unité",
          "unit_price": 25.00,
          "total_price": 75.00,
          "tier": "standard",
          "premium_option": {
            "name_fr": "Version premium",
            "name_ar": "النسخة الممتازة",
            "unit_price": 45.00,
            "total_price": 135.00
          },
          "why_important_fr": "Explication de pourquoi c'est important",
          "why_important_ar": "شرح لماذا هذا العنصر ضروري",
          "is_critical": true,
          "selected": true
        }
      ]
    }
  ],
  "labor": {
    "workers": [
      { "role_fr": "Peintre qualifié", "role_ar": "بانتر مؤهل (Peintre qualifié)", "count": 2, "daily_rate": 200 },
      { "role_fr": "Électricien", "role_ar": "إليكتريسيان (Électricien)", "count": 1, "daily_rate": 250 }
    ],
    "total_workers": 3,
    "days_needed": 5,
    "daily_rate_total": 650,
    "total": 3250
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
      "fr": "Description du risque",
      "ar": "وصف المخاطر بالعربية"
    }
  ]
}

RÈGLES STRICTES:
- Tous les prix doivent être basés sur les tarifs réels du marché français 2024-2025
- ADAPTER les prix selon la localisation (Paris/IDF = +10-20%, Province = prix standard)
- Chaque élément doit avoir une explication "pourquoi c'est important"
- Marquer is_critical=true pour les éléments dont l'omission pose un risque technique ou légal
- Inclure TOUJOURS: Protection (bâches, scotch), Nettoyage de fin de chantier
- Décomposer le travail en PHASES chronologiques avec les ouvriers assignés
- Détailler CHAQUE ouvrier avec sa spécialité et son tarif journalier
- Appliquer la translittération arabe pour TOUS les termes techniques
- Le JSON doit être valide et parsable directement`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description, location, estimatedDuration } = await req.json();
    if (!description) throw new Error("Description du chantier manquante");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `Analyse ce chantier et génère le breakdown complet en JSON:

LOCALISATION: ${location || 'Non spécifiée'}
DURÉE ESTIMÉE PAR LE CLIENT: ${estimatedDuration || 'Non spécifiée'}

DESCRIPTION:
${description}

IMPORTANT: Adapte les prix selon la localisation. Décompose en phases avec les ouvriers nécessaires. Utilise la translittération arabe pour tous les termes techniques.`;

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
          { role: "user", content: userPrompt },
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
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
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
