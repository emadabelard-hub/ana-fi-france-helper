import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const { data: { user }, error: authErr } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user || user.is_anonymous) {
      console.error("auth failed", authErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mt = (mimeType || "").toLowerCase();
    const isPdf = mt.includes("pdf");
    const dataUrl = fileBase64.startsWith("data:")
      ? fileBase64
      : `data:${mimeType || (isPdf ? "application/pdf" : "image/jpeg")};base64,${fileBase64}`;

    const systemPrompt = `Tu es un extracteur OCR de factures fournisseurs françaises (BTP).
Extrais ces champs et renvoie STRICTEMENT du JSON valide (aucun texte autour) :
{
  "supplier_name": string|null,
  "supplier_reference": string|null,
  "invoice_date": "YYYY-MM-DD"|null,
  "amount_ht": number|null,
  "tva_rate": 0|5.5|10|20|null,
  "amount_tva": number|null,
  "amount_ttc": number|null,
  "description": string|null,
  "category_code": "601000"|"602000"|"606100"|"606300"|"611000"|"613000"|"615000"|"616000"|"618000"|"622600"|"624100"|"625100"|"626000"|null
}
Codes: 601000 achats fournitures, 602000 autres approvisionnements, 606100 électricité, 606300 petit équipement, 611000 sous-traitance, 613000 locations, 615000 entretien, 616000 assurances, 618000 documentation, 622600 honoraires, 624100 transports, 625100 déplacements, 626000 télécom.
Si un champ est illisible → null.`;

    const userContent: any[] = [
      { type: "text", text: "Extrais les données de cette facture fournisseur." },
    ];
    if (isPdf) {
      userContent.push({
        type: "file",
        file: { filename: "facture.pdf", file_data: dataUrl },
      });
    } else {
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const payload = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("ocr-supplier-invoice gateway error", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "payment_required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_failed", details: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
    }

    console.log("ocr-supplier-invoice extracted:", JSON.stringify(parsed));

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-supplier-invoice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
