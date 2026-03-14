import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAr = language === "ar";

    const systemPrompt = `You are an expert construction estimator. Analyze the room photo and estimate its dimensions.

RULES:
- Estimate length, width, and height in meters based on visual cues (doors ~2.04m high, outlets ~0.30m, standard ceiling ~2.50m, tiles ~0.30-0.60m).
- Be conservative and realistic. Typical rooms: 2-6m each dimension, height 2.40-2.80m.
- Return ONLY valid JSON, no markdown, no code blocks.

Return this exact JSON format:
{
  "length": <number>,
  "width": <number>,
  "height": <number>,
  "confidence": "<low|medium|high>",
  "notes": "<brief observation about the room>"
}`;

    // Extract base64 data and mime type
    let mimeType = "image/jpeg";
    let base64Data = imageBase64;
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                },
                {
                  type: "text",
                  text: isAr
                    ? "قدّر أبعاد هذه الغرفة (الطول والعرض والارتفاع بالمتر). أجب بـ JSON فقط."
                    : "Estimez les dimensions de cette pièce (longueur, largeur, hauteur en mètres). Répondez en JSON uniquement.",
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: isAr ? "الخدمة مشغولة، جرب تاني" : "Service surchargé, réessayez" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: isAr ? "الرصيد خلص" : "Crédits insuffisants" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", status);
      return new Response(
        JSON.stringify({ error: isAr ? "خطأ في التحليل" : "Erreur d'analyse" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let dimensions;
    try {
      // Try to extract JSON from possible markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        dimensions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      // Return sensible defaults
      dimensions = {
        length: 4.0,
        width: 3.5,
        height: 2.5,
        confidence: "low",
        notes: isAr ? "لم نتمكن من تحليل الصورة بدقة، عدّل القيم يدوياً" : "Analyse imprécise, ajustez manuellement",
      };
    }

    // Validate and clamp values
    dimensions.length = Math.max(1, Math.min(20, Number(dimensions.length) || 4));
    dimensions.width = Math.max(1, Math.min(20, Number(dimensions.width) || 3.5));
    dimensions.height = Math.max(2, Math.min(5, Number(dimensions.height) || 2.5));

    return new Response(JSON.stringify(dimensions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-room error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
