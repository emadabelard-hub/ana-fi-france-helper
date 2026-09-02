import { anthropicCompatFetch } from "../_shared/anthropic-compat.ts";

// TEST ISOLÉ — lecture d'une page de plan découpée en 4 zones.
// Cette fonction n'est appelée que par la page interne /dev/zone-vision-test.
// Elle ne remplace ni ne modifie `ai-assistant`.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ZoneIn = { index: number; label: string; dataUrl: string; width: number; height: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const prompt: string = String(body?.prompt ?? "").slice(0, 4000);
    const pageTest = Number(body?.pageTest ?? 1);
    const zones: ZoneIn[] = Array.isArray(body?.zones) ? body.zones : [];

    if (zones.length !== 4) {
      return new Response(JSON.stringify({ error: "zones_must_be_exactly_4" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Logs minimaux, sans donnée utilisateur ni contenu de document.
    console.log(`[zone-vision-test] page_test=${pageTest}`);
    console.log(`[zone-vision-test] zones_generated=${zones.length}`);
    for (const z of zones) {
      console.log(`[zone-vision-test] dimensions_zone_${z.index}=${z.width}x${z.height}`);
    }

    // Payload : prompt utilisateur + 4 zones étiquetées. Aucun PDF natif,
    // aucune page entière, aucune couche texte.
    const content: any[] = [{ type: "text", text: prompt || "Lisez ce plan." }];
    for (const z of zones.sort((a, b) => a.index - b.index)) {
      content.push({ type: "text", text: `PAGE ${pageTest} — ZONE ${z.index}/4 — ${z.label}` });
      content.push({ type: "image_url", image_url: { url: z.dataUrl } });
    }

    const resp = await anthropicCompatFetch({
      method: "POST",
      body: JSON.stringify({
        max_tokens: 4096,
        messages: [{ role: "user", content }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.log(`[zone-vision-test] provider_used=none reason=anthropic_${resp.status}`);
      return new Response(JSON.stringify({ error: errText.slice(0, 500) }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[zone-vision-test] provider_used=anthropic");
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ text, provider_used: "anthropic", page_test: pageTest }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[zone-vision-test] erreur", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
