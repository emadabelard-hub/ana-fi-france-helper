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
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-mini", // Text-only: cost-optimized
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);

    if (response.status === 429) {
      throw new Error("Rate limit exceeded, please try again later");
    }
    if (response.status === 402) {
      throw new Error("Payment required");
    }
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from AI");
  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { cvData } = await req.json();

    if (!cvData) {
      return new Response(JSON.stringify({ error: "CV data is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPromptBase = `Tu es un expert en rédaction de CV professionnels pour le marché du travail français.
Ta mission est de traduire les informations d'un CV de l'arabe (ou du dialecte égyptien/darija) vers le français professionnel.

Règles importantes:
1. Traduis TOUT le contenu en français professionnel et formel
2. Adapte les termes aux standards français (ex: "سباك" → "Plombier qualifié")
3. Améliore les descriptions pour qu'elles soient percutantes et professionnelles
4. Garde les emails, téléphones et dates au format international
5. Pour les noms propres, translittère-les en caractères latins de manière appropriée
6. Utilise des verbes d'action pour les descriptions d'expérience
7. Assure-toi que le résumé professionnel soit accrocheur et adapté au marché français

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
      apiKey: LOVABLE_API_KEY,
      systemPrompt: systemPromptBase,
      userPrompt,
    });

    // Retry if forbidden scripts are detected
    if (hasForbiddenScripts(content)) {
      console.warn("Forbidden scripts detected in translate-cv output. Retrying...");
      content = await callGateway({
        apiKey: LOVABLE_API_KEY,
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

