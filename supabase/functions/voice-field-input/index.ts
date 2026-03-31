import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRANSCRIPTION_HINT = [
  "The audio may mix French and Arabic dialect used by construction artisans in France.",
  "Construction vocabulary examples:",
  "بانتيرة = peinture",
  "كارلاج = carrelage",
  "كهربا = électricité",
  "سباكة = plomberie",
  "دجراسياج = dégrossissage",
  "دهان = peinture",
  "حيطان = murs",
  "أوض / أوضه = chambres / pièces",
].join(" ");

function mimeTypeToExtension(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function decodeBase64Audio(base64: string) {
  const cleanBase64 = base64.includes(",") ? base64.split(",").pop() ?? "" : base64;
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function transcribeAudio(audioBytes: Uint8Array, mimeType: string, openAiKey: string, forceLanguage?: string) {
  const file = new File([audioBytes], `voice-input.${mimeTypeToExtension(mimeType)}`, {
    type: mimeType,
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "gpt-4o-transcribe");
  formData.append("response_format", "text");
  formData.append("prompt", TRANSCRIPTION_HINT);
  if (forceLanguage) {
    formData.append("language", forceLanguage);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("voice-field-input transcription error:", response.status, errorText);

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Service vocal temporairement saturé, réessaie dans un instant." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "La transcription vocale a échoué." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return (await response.text()).trim();
}

async function rewriteForConstruction(rawText: string, lovableApiKey: string) {
  const systemPrompt = `Tu es un assistant de normalisation vocale pour artisans du bâtiment en France.

Ta mission:
- comprendre un texte transcrit pouvant mélanger arabe dialectal, ammiya, français oral et mots mal reconnus
- détecter les mots de chantier et les convertir en français professionnel
- supprimer le bruit, les répétitions, les hésitations et les mots parasites
- produire une seule formulation courte, propre, naturelle et directement exploitable dans un devis ou une facture

Règles:
- sortie en français uniquement
- pas de guillemets
- pas d'explication
- pas de phrase longue
- style professionnel terrain
- corriger le vocabulaire métier: peinture, carrelage, électricité, plomberie, enduit, ponçage, dégrossissage, faux plafond, placo, etc.
- si l'entrée parle de pièces/chambres/murs/plafonds, garde l'information utile
- si plusieurs formulations sont possibles, choisis la plus naturelle pour un artisan en France

Exemples:
- "رندة 3 أوض دهان" -> "Peinture de 3 chambres"
- "بانتيرة الحيطان" -> "Peinture des murs"
- "كهربا المطبخ" -> "Travaux d'électricité dans la cuisine"
- "سباكة الحمام" -> "Travaux de plomberie dans la salle de bains"`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      stream: false,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Texte transcrit à nettoyer: ${rawText}` },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("voice-field-input rewrite error:", response.status, errorText);

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Le nettoyage IA est temporairement saturé, réessaie dans un instant." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Le service IA n'est pas disponible pour le moment." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Le traitement IA du texte a échoué." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await response.json();
  const cleaned = data.choices?.[0]?.message?.content?.trim()?.replace(/^"|"$/g, "") ?? "";
  return cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64 : "";
    const mimeType = typeof body?.mimeType === "string" && body.mimeType ? body.mimeType : "audio/webm";

    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "Audio manquant." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!openAiKey || !lovableApiKey) {
      return new Response(JSON.stringify({ error: "Configuration vocale incomplète." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBytes = decodeBase64Audio(audioBase64);
    if (!audioBytes.byteLength) {
      return new Response(JSON.stringify({ error: "Audio invalide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawTranscript = await transcribeAudio(audioBytes, mimeType, openAiKey);
    if (rawTranscript instanceof Response) return rawTranscript;

    if (!rawTranscript) {
      return new Response(JSON.stringify({ error: "Aucune parole détectée." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanedText = await rewriteForConstruction(rawTranscript, lovableApiKey);
    if (cleanedText instanceof Response) return cleanedText;

    if (!cleanedText) {
      return new Response(JSON.stringify({ error: "Impossible de produire un texte exploitable." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: cleanedText, raw: rawTranscript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("voice-field-input error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
