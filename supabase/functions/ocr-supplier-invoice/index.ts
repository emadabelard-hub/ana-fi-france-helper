import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { anthropicCompatFetch } from "../_shared/anthropic-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isPdf = (mimeType || "").includes("pdf");
    const content: any[] = [
      {
        type: "text",
        text: `Tu es un extracteur OCR de factures fournisseurs françaises (BTP).
Extrais ces champs et renvoie STRICTEMENT du JSON valide :
- supplier_name: nom du fournisseur/vendeur
- supplier_reference: numéro de facture du fournisseur (si visible)
- invoice_date: date au format YYYY-MM-DD
- amount_ht: montant HT (nombre)
- tva_rate: taux TVA (0, 5.5, 10 ou 20)
- amount_tva: montant TVA (nombre)
- amount_ttc: montant TTC (nombre)
- description: nature de l'achat en français (courte)
- category_code: code comptable français parmi 601000 (achats fournitures), 602000 (autres approvisionnements), 606100 (électricité), 606300 (petit équipement), 611000 (sous-traitance), 613000 (locations), 615000 (entretien), 616000 (assurances), 618000 (documentation), 622600 (honoraires), 624100 (transports), 625100 (déplacements), 626000 (télécom). Choisis le plus pertinent.

Si un champ est illisible → null. Réponds UNIQUEMENT en JSON.`,
      },
    ];

    if (isPdf) {
      content.push({ type: "file", file: { filename: "facture.pdf", file_data: `data:${mimeType};base64,${fileBase64}` } });
    } else {
      const dataUrl = fileBase64.startsWith("data:") ? fileBase64 : `data:${mimeType || "image/jpeg"};base64,${fileBase64}`;
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const payload = {
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    };

    const response = await anthropicCompatFetch({
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: "ai_failed" }), {
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
