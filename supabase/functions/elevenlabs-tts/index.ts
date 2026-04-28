// ElevenLabs TTS for the Translator module — French (Antoine) / Arabic (Tariq)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TTSRequest {
  text: string;
  lang: "ar" | "fr";
}

// Cached resolved voice IDs (per cold start)
let cachedFrVoiceId: string | null = null;
let cachedArVoiceId: string | null = null;

async function resolveVoiceId(
  apiKey: string,
  preferredName: string,
  lang: "ar" | "fr",
): Promise<string> {
  const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs voices fetch failed: ${res.status}`);
  }
  const data = await res.json();
  const voices: any[] = data?.voices || [];

  // 1. Try exact preferred name match
  const preferred = voices.find(
    (v) => (v?.name || "").toLowerCase() === preferredName.toLowerCase(),
  );
  if (preferred?.voice_id) return preferred.voice_id;

  // 2. Fallback: first male voice in the requested language
  const langCode = lang === "fr" ? "fr" : "ar";
  const matchLang = (v: any) => {
    const labels = v?.labels || {};
    const verified = v?.verified_languages || [];
    const langField = (labels.language || labels.accent || "").toLowerCase();
    if (langField.includes(langCode)) return true;
    if (Array.isArray(verified)) {
      return verified.some((vl: any) =>
        (vl?.language || "").toLowerCase().startsWith(langCode),
      );
    }
    return false;
  };
  const isMale = (v: any) => {
    const g = (v?.labels?.gender || "").toLowerCase();
    return g.includes("male") && !g.includes("female");
  };

  const maleInLang = voices.find((v) => matchLang(v) && isMale(v));
  if (maleInLang?.voice_id) return maleInLang.voice_id;

  // 3. Any voice in the language
  const anyInLang = voices.find(matchLang);
  if (anyInLang?.voice_id) return anyInLang.voice_id;

  // 4. Hard fallback: known multilingual male voice (George / multilingual)
  return lang === "fr"
    ? "JBFqnCBsd6RMkjVDRZzb" // George (multilingual, masculine)
    : "pqHfZKP75CvOlQylNhV4"; // Bill (multilingual, masculine)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as TTSRequest;
    const text = (body.text || "").trim();
    const lang = body.lang;

    if (!text) {
      return new Response(JSON.stringify({ error: "Empty text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (lang !== "ar" && lang !== "fr") {
      return new Response(JSON.stringify({ error: "Invalid lang" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve voice
    let voiceId: string;
    if (lang === "fr") {
      if (!cachedFrVoiceId) {
        cachedFrVoiceId = await resolveVoiceId(ELEVENLABS_API_KEY, "Adama", "fr");
      }
      voiceId = cachedFrVoiceId;
    } else {
      if (!cachedArVoiceId) {
        cachedArVoiceId = await resolveVoiceId(ELEVENLABS_API_KEY, "Hanafi", "ar");
      }
      voiceId = cachedArVoiceId;
    }

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("ElevenLabs TTS error:", ttsRes.status, errText);
      return new Response(JSON.stringify({ error: `TTS failed: ${ttsRes.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    return new Response(audioBuffer, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error("elevenlabs-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
