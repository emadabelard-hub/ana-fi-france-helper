import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Forbidden scripts: Cyrillic, Greek, CJK, Hebrew, etc.
const FORBIDDEN_SCRIPTS =
  /[\u0400-\u052F\u0370-\u03FF\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF\u0590-\u05FF]/;

function hasForbiddenScripts(text: string) {
  return FORBIDDEN_SCRIPTS.test(text);
}

async function callGateway({
  apiKey,
  systemPrompt,
  userPrompt,
}: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  // AMÉLIORATION 1: Claude claude-sonnet-4-5 via Anthropic API directe
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", response.status, errorText);

    if (response.status === 429) {
      throw new Error("Rate limit exceeded, please try again later");
    }
    if (response.status === 402) {
      throw new Error("Payment required");
    }
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.content?.[0]?.text;
  if (!content) throw new Error("No response from AI");
  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Light auth: accept any Bearer token (session or anon key)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'يرجى تسجيل الدخول أولاً' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { cvData } = await req.json();

    if (!cvData) {
      return new Response(JSON.stringify({ error: "CV data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const systemPromptBase = `Tu es un expert en rédaction de CV professionnels pour le marché du travail français.
Ta mission est de traduire les informations d'un CV de l'arabe (ou du dialecte égyptien/darija) vers le français professionnel.

Règles importantes:
1. Traduis TOUT le contenu en français professionnel et formel
2. Adapte les termes aux standards français du BTP
3. Améliore les descriptions pour qu'elles soient percutantes et professionnelles
4. Garde les emails, téléphones et dates au format international
5. Pour les noms propres, translittère-les en caractères latins de manière appropriée
6. Assure-toi que le résumé professionnel soit accrocheur et adapté au marché français

📚 GLOSSAIRE BTP OBLIGATOIRE (à appliquer systématiquement) :
- سباك → Plombier qualifié
- كهربائي → Électricien
- نجار → Menuisier
- بناء → Maçon
- دهان → Peintre en bâtiment
- كارلاج → Carreleur
- جبصين → Plaquiste
- حداد → Ferronnier / Métallier
- مقاول → Entrepreneur / Artisan
- ورشة → Chantier
- مشرف → Chef de chantier
- مقاولة → Entreprise du bâtiment

✍️ VERBES D'ACTION PROFESSIONNELS (à utiliser dans les descriptions d'expérience) :
Réalisé, Géré, Supervisé, Installé, Coordonné, Assuré, Développé, Optimisé.
Commence chaque description d'expérience par l'un de ces verbes au participe passé.

Tu dois retourner UNIQUEMENT un objet JSON valide avec la même structure que l'entrée, mais avec tout le contenu traduit en français.`;

    const strictAlphabetRule = `

🔒 RÈGLE ABSOLUE (SORTIE):
- N'utilise AUCUN alphabet autre que latin (français) dans le JSON.
- Interdiction stricte: cyrillique, grec, chinois, japonais, coréen, etc.
- Si tu dévies, régénère jusqu'à obtenir du français en alphabet latin uniquement.`;

    const userPrompt = `Traduis ce CV en français professionnel. Retourne UNIQUEMENT le JSON traduit, sans commentaires ni explications:

${JSON.stringify(cvData, null, 2)}`;

    // First attempt
    let content = await callGateway({
      apiKey: ANTHROPIC_API_KEY,
      systemPrompt: systemPromptBase,
      userPrompt,
    });

    // Retry if forbidden scripts are detected
    if (hasForbiddenScripts(content)) {
      console.warn("Forbidden scripts detected in translate-cv output. Retrying...");
      content = await callGateway({
        apiKey: ANTHROPIC_API_KEY,
        systemPrompt: systemPromptBase + strictAlphabetRule,
        userPrompt,
      });
    }

    if (hasForbiddenScripts(content)) {
      throw new Error("Forbidden alphabet detected in translation output");
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let translatedCV;
    try {
      translatedCV = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Content:", content);
      return new Response(JSON.stringify({ error: "Invalid translation format" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ translatedCV }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Translation failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

