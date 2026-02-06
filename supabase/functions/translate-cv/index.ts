import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cvData } = await req.json();

    if (!cvData) {
      return new Response(
        JSON.stringify({ error: "CV data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un expert en rédaction de CV professionnels pour le marché du travail français.
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

    const userPrompt = `Traduis ce CV en français professionnel. Retourne UNIQUEMENT le JSON traduit, sans commentaires ni explications:

${JSON.stringify(cvData, null, 2)}`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
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
      // Return original data if parsing fails
      translatedCV = cvData;
    }

    return new Response(
      JSON.stringify({ translatedCV }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Translation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
