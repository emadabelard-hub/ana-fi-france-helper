import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authClient = createClient(SUPABASE_URL, ANON);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user || user.is_anonymous) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      supplier_id,
      supplier_name,
      supplier_reference,
      invoice_date,
      amount_ht,
      tva_rate,
      description,
      category_code,
      notes,
      pdf_url,
      source,
    } = body ?? {};

    if (!invoice_date || amount_ht === undefined || amount_ht === null) {
      return new Response(JSON.stringify({ error: "invoice_date and amount_ht are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ht = Number(amount_ht);
    const rate = Number(tva_rate ?? 20);
    if (!isFinite(ht) || ht < 0) {
      return new Response(JSON.stringify({ error: "invalid amount_ht" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tva = Math.round(ht * rate) / 100;
    const ttc = Math.round((ht + tva) * 100) / 100;

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Resolve or create supplier
    let sid: string | null = supplier_id ?? null;
    if (!sid && supplier_name && String(supplier_name).trim()) {
      const nm = String(supplier_name).trim();
      const { data: existing } = await admin
        .from("suppliers")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", nm)
        .maybeSingle();
      if (existing?.id) {
        sid = existing.id;
      } else {
        const { data: created, error: eSup } = await admin
          .from("suppliers")
          .insert({ user_id: user.id, name: nm })
          .select("id")
          .single();
        if (eSup) throw eSup;
        sid = created.id;
      }
    }

    // Reserve invoice number
    const { data: numData, error: numErr } = await admin.rpc("get_next_supplier_invoice_number", { _user_id: user.id });
    if (numErr) throw numErr;
    const invoice_number = numData as string;

    // Insert supplier_invoices
    const { data: inv, error: eInv } = await admin
      .from("supplier_invoices")
      .insert({
        user_id: user.id,
        supplier_id: sid,
        invoice_number,
        supplier_reference: supplier_reference ?? null,
        invoice_date,
        amount_ht: ht,
        tva_rate: rate,
        amount_tva: tva,
        amount_ttc: ttc,
        status: "received",
        source: source || "manual",
        pdf_url: pdf_url ?? null,
        notes: notes ?? null,
      })
      .select("*")
      .single();
    if (eInv) throw eInv;

    // Insert single line
    const { error: eLine } = await admin.from("supplier_invoice_lines").insert({
      supplier_invoice_id: inv.id,
      description: description ?? null,
      amount_ht: ht,
      category_code: category_code ?? "601000",
    });
    if (eLine) throw eLine;

    return new Response(JSON.stringify({ success: true, invoice: inv }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-supplier-invoice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
