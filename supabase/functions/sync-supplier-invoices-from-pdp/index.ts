import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const API_KEY = Deno.env.get("CHORUS_PRO_API_KEY");
  const API_URL = Deno.env.get("CHORUS_PRO_API_URL");
  const SYSTEM_USER_ID = Deno.env.get("SYSTEM_USER_ID");

  if (!API_KEY || !API_URL || !SYSTEM_USER_ID) {
    console.log("❌ Missing secrets: CHORUS_PRO_API_KEY, CHORUS_PRO_API_URL, SYSTEM_USER_ID");
    return new Response(
      JSON.stringify({ imported: 0, skipped: 0, error: "Missing configuration", timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE);

  let imported_count = 0;
  let skipped_count = 0;
  const error_log: Array<{ chorus_id: string; supplier_name: string; error_message: string }> = [];

  // 2. Call Chorus Pro API
  let payload: any;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(`${API_URL}/api/v1/invoices?status=received&type=supplier_invoice&limit=100`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Chorus Pro API failed:", resp.status, txt);
      return new Response(
        JSON.stringify({ imported: 0, skipped: 0, error: `API failed: ${resp.status} ${txt}`, timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    payload = await resp.json();
  } catch (e) {
    console.error("Chorus Pro API error:", e);
    return new Response(
      JSON.stringify({ imported: 0, skipped: 0, error: `API failed: ${e instanceof Error ? e.message : "unknown"}`, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const invoices: any[] = Array.isArray(payload?.invoices) ? payload.invoices : [];

  for (const inv of invoices) {
    const chorus_id: string | null = inv?.id ?? null;
    const supplier_name: string = inv?.supplier_name ?? "";
    const supplier_siret: string | null = inv?.supplier_siret ?? null;

    // a. chorus_id validation
    if (!chorus_id) {
      continue;
    }

    try {
      // b. Deduplication
      const { data: existing } = await supabase
        .from("supplier_invoices")
        .select("id")
        .eq("chorus_reference", chorus_id)
        .maybeSingle();
      if (existing?.id) {
        skipped_count++;
        continue;
      }

      // c. Supplier upsert
      let supplier_id: string | null = null;
      if (supplier_siret) {
        const { data: upserted, error: eUp } = await supabase
          .from("suppliers")
          .upsert({ user_id: null, name: supplier_name, siret: supplier_siret }, { onConflict: "siret", ignoreDuplicates: false })
          .select("id")
          .single();
        if (eUp) throw eUp;
        supplier_id = upserted?.id ?? null;
      }

      // d. Amount calculation
      const amount_ht = Number(inv?.amount_ht ?? 0);
      const tva_amount = Number(inv?.tva_amount ?? 0);
      const tva_rate = amount_ht > 0 ? Math.round((tva_amount / amount_ht) * 10000) / 100 : 20;
      const amount_ttc = Math.round((amount_ht + tva_amount) * 100) / 100;

      // e. Invoice number via RPC
      const { data: nextNumber, error: eNum } = await supabase.rpc("get_next_supplier_invoice_number", { _user_id: SYSTEM_USER_ID });
      if (eNum) throw eNum;

      // g. INSERT supplier_invoices
      const { data: newInv, error: eInv } = await supabase
        .from("supplier_invoices")
        .insert({
          user_id: null,
          supplier_id,
          invoice_number: nextNumber,
          invoice_date: inv?.invoice_date,
          amount_ht,
          tva_rate,
          amount_tva: tva_amount,
          amount_ttc,
          status: "received",
          source: "pdp",
          factur_x_url: inv?.factur_x_url ?? null,
          chorus_reference: chorus_id,
          supplier_reference: inv?.invoice_number ?? null,
        })
        .select("id")
        .single();
      if (eInv) throw eInv;

      // h. INSERT supplier_invoice_lines
      const { error: eLine } = await supabase.from("supplier_invoice_lines").insert({
        supplier_invoice_id: newInv.id,
        description: `Facture Chorus Pro - ${inv?.invoice_number ?? chorus_id}`,
        amount_ht,
        category_code: "601000",
      });
      if (eLine) {
        // rollback the invoice insert
        await supabase.from("supplier_invoices").delete().eq("id", newInv.id);
        throw eLine;
      }

      imported_count++;
    } catch (err) {
      error_log.push({
        chorus_id,
        supplier_name,
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return new Response(
    JSON.stringify({
      imported: imported_count,
      skipped: skipped_count,
      errors: error_log,
      timestamp: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
