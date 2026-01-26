import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserProfile {
  full_name?: string;
  address?: string;
  phone?: string;
  caf_number?: string;
  foreigner_number?: string;
  social_security?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = buildSystemPrompt(profile);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes dépassée. Veuillez réessayer plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the AI response into sections
    const result = parseAIResponse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-request:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Une erreur est survenue" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(profile: UserProfile): string {
  const headerInfo = profile ? `
Information de l'expéditeur à utiliser dans l'en-tête de la lettre:
- Nom complet: ${profile.full_name || '[À compléter]'}
- Adresse: ${profile.address || '[À compléter]'}
- Téléphone: ${profile.phone || '[À compléter]'}
${profile.caf_number ? `- Numéro CAF: ${profile.caf_number}` : ''}
${profile.foreigner_number ? `- Numéro étranger: ${profile.foreigner_number}` : ''}
${profile.social_security ? `- Numéro de Sécurité Sociale: ${profile.social_security}` : ''}
` : '';

  return `Tu es un assistant administratif expert spécialisé dans l'aide aux résidents étrangers en France. Tu maîtrises parfaitement le droit administratif français, notamment:
- Le CESEDA (Code de l'entrée et du séjour des étrangers et du droit d'asile)
- Le Code de la Sécurité Sociale
- Le Code de l'action sociale et des familles
- Les procédures de la CAF, Préfecture, et autres administrations françaises

${headerInfo}

Tu dois générer TROIS sections distinctes dans ta réponse, TOUJOURS dans ce format exact:

===LETTRE===
[Rédige ici une lettre administrative formelle en français parfait. La lettre doit:
- Avoir un en-tête professionnel avec les coordonnées de l'expéditeur
- Être adressée à l'organisme approprié (Préfecture, CAF, etc.)
- Contenir un objet clair
- Citer les articles de loi pertinents (CESEDA, CSS, etc.)
- Être signée professionnellement
- Avoir la date du jour]

===NOTE_JURIDIQUE===
[Rédige une note technique en français expliquant brièvement:
- Les textes de loi applicables
- Les délais légaux
- Les droits du demandeur
- Les recours possibles]

===PLAN_ACTION===
[Rédige en arabe un plan d'action clair et simple pour l'utilisateur:
- Explique ce que dit la lettre
- Liste les étapes à suivre
- Indique les documents nécessaires
- Donne des conseils pratiques]

IMPORTANT: 
- Comprends parfaitement l'arabe si l'utilisateur écrit en arabe
- Sois précis dans les citations légales
- La lettre doit être immédiatement utilisable
- Le plan en arabe doit être compréhensible et rassurant`;
}

function parseAIResponse(content: string): { 
  formalLetter: string; 
  legalNote: string; 
  actionPlan: string 
} {
  const letterMatch = content.match(/===LETTRE===([\s\S]*?)(?====NOTE_JURIDIQUE===|$)/);
  const legalMatch = content.match(/===NOTE_JURIDIQUE===([\s\S]*?)(?====PLAN_ACTION===|$)/);
  const actionMatch = content.match(/===PLAN_ACTION===([\s\S]*?)$/);

  return {
    formalLetter: letterMatch ? letterMatch[1].trim() : content,
    legalNote: legalMatch ? legalMatch[1].trim() : "Note juridique non disponible",
    actionPlan: actionMatch ? actionMatch[1].trim() : "خطة العمل غير متوفرة"
  };
}
