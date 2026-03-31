import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRANSCRIPTION_HINT = [
  "Transcribe the speech as spoken without translating.",
  "The audio may mix French and Arabic dialect used by construction artisans in France.",
  "Keep Arabic words in Arabic script when spoken in Arabic, and keep French words in French when spoken in French.",
  "Construction vocabulary that may appear includes: بانتيرة، كارلاج، كهربا، سباكة، دجراسياج، دهان، حيطان، أوض.",
].join(" ");

const DUAL_MODE_TRANSCRIPTION_HINT = [
  "Transcribe the speech verbatim.",
  "If the speaker uses Arabic dialect, keep the output in Arabic script.",
  "Do not translate Arabic into French.",
  "Do not normalize construction words into French.",
  "Preserve short phrases, materials, finishes, quantities, colors, and numbers exactly as spoken.",
  "Keep chantier expressions like توريد, تركيب, باركيه, بتركيبه, ساتينيه, لوز, plinthe if spoken.",
  "Example raw outputs: رندة 3 أوض دهان ; بانتيرة الحيطان ; كهربا المطبخ ; توريد وتركيب باركيه لوز ; بانتيرة ازرق ساتينيه ; توريد وتركيب بتركيبه",
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

function deduplicateTranscript(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/);
  if (words.length <= 1) return trimmed;

  const deduped = [words[0]];
  for (let i = 1; i < words.length; i++) {
    if (words[i] !== words[i - 1]) {
      deduped.push(words[i]);
    }
  }

  for (let patternLen = 4; patternLen >= 2; patternLen--) {
    let i = 0;
    while (i + patternLen * 2 <= deduped.length) {
      const current = deduped.slice(i, i + patternLen).join(" ");
      const next = deduped.slice(i + patternLen, i + patternLen * 2).join(" ");
      if (current === next) {
        deduped.splice(i + patternLen, patternLen);
        continue;
      }
      i += 1;
    }
  }

  return deduped.join(" ").trim();
}

function normalizeConstructionTranscript(text: string) {
  return text
    .replace(/توريد\s*(?:و)?\s*تركيب/gu, "توريد وتركيب")
    .replace(/(?:باركيه|بركيه|باركي|بركي|parquet|parket|parke|parki)/giu, "باركيه")
    .replace(/بتركيب(?:ه|ة)?/gu, "باركيه")
    .replace(/(?:لوز|لووز|louz|loose|louse|losange)/giu, "لوز")
    .replace(/(?:ساتينيه|ساتيني|satinée|satinee|satiné|satin)/giu, "ساتينيه")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeConstructionOutput(text: string) {
  return text
    .replace(/fourniture et pose de\s+fourniture et pose de/gi, "Fourniture et pose de")
    .replace(/\bparquet\s+parquet\b/gi, "parquet")
    .replace(/\bpose en losange\s+pose en losange\b/gi, "pose en losange")
    .replace(/\bde\s+de\b/gi, "de")
    .replace(/\s+/g, " ")
    .trim();
}

async function transcribeAudio(
  audioBytes: Uint8Array,
  mimeType: string,
  openAiKey: string,
  options?: { forceLanguage?: string; prompt?: string },
) {
  const fileBytes = new Uint8Array(audioBytes.byteLength);
  fileBytes.set(audioBytes);

  const file = new File([fileBytes], `voice-input.${mimeTypeToExtension(mimeType)}`, {
    type: mimeType,
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "gpt-4o-transcribe");
  formData.append("response_format", "text");
  formData.append("prompt", options?.prompt ?? TRANSCRIPTION_HINT);
  if (options?.forceLanguage) {
    formData.append("language", options.forceLanguage);
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
- ne répète jamais deux fois la même tâche
- corriger le vocabulaire métier: peinture, carrelage, électricité, plomberie, enduit, ponçage, dégrossissage, faux plafond, placo, etc.
- si l'entrée mentionne fourniture, pose, dépose, parquet, plinthes, couleur ou finition (mat, satiné, brillant), conserve ces infos
- si l'entrée dit توريد وتركيب ou équivalent, rends "Fourniture et pose de ..."
- si l'entrée contient لوز / louz / loose, rends "pose en losange"
- si l'entrée contient بتركيبه / بتركيبة dans un contexte de sol ou de توريد وتركيب, comprends "parquet"
- si l'entrée parle de pièces/chambres/murs/plafonds, garde l'information utile
- si plusieurs formulations sont possibles, choisis la plus naturelle pour un artisan en France

Exemples:
- "رندة 3 أوض دهان" -> "Peinture de 3 chambres"
- "بانتيرة الحيطان" -> "Peinture des murs"
- "كهربا المطبخ" -> "Travaux d'électricité dans la cuisine"
- "سباكة الحمام" -> "Travaux de plomberie dans la salle de bains"
- "توريد وتركيب باركيه" -> "Fourniture et pose de parquet"
- "توريد وتركيب بتركيبه" -> "Fourniture et pose de parquet"
- "باركيه لوز" -> "Fourniture et pose de parquet en losange"
- "بانتيرة ازرق ساتينيه" -> "Peinture bleue satinée"
- "بانتيرة ازرق ساتينيه وتوريد وتركيب باركيه لوز" -> "Peinture bleue satinée et fourniture et pose de parquet en losange"`;

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
  return normalizeConstructionOutput(cleaned);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const audioBase64 = typeof body?.audioBase64 === "string" ? body.audioBase64 : "";
    const rawTextInput = typeof body?.rawText === "string" ? body.rawText.trim() : "";
    const mimeType = typeof body?.mimeType === "string" && body.mimeType ? body.mimeType : "audio/webm";
    const dualMode = body?.dualMode === true;

    if (!audioBase64 && !rawTextInput) {
      return new Response(JSON.stringify({ error: "Audio ou texte manquant." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey || (!rawTextInput && !openAiKey)) {
      return new Response(JSON.stringify({ error: "Configuration vocale incomplète." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawTranscript = deduplicateTranscript(normalizeConstructionTranscript(rawTextInput));

    if (!rawTranscript) {
      if (!openAiKey) {
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

      // In dual mode: transcribe in Arabic for raw field, then rewrite to French
      // In normal mode: transcribe auto-detect, then rewrite to French
      const transcribed = await transcribeAudio(audioBytes, mimeType, openAiKey, {
        forceLanguage: dualMode ? "ar" : undefined,
        prompt: dualMode ? DUAL_MODE_TRANSCRIPTION_HINT : TRANSCRIPTION_HINT,
      });
      if (transcribed instanceof Response) return transcribed;
      rawTranscript = deduplicateTranscript(normalizeConstructionTranscript(transcribed));
    }

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
