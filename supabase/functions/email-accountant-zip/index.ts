import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY non configuré");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authErr } = await supa.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      accountantEmail,
      artisanName,
      companyName,
      periodLabel,
      fileName,
      zipBase64,
      summary,
    } = body || {};

    if (!accountantEmail || !zipBase64 || !fileName) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderName = companyName || artisanName || "Artisan";
    const period = periodLabel || "période en cours";
    const subject = `Documents comptables — ${senderName} — ${period}`;
    const inv = summary?.invoices ?? 0;
    const exp = summary?.expenses ?? 0;
    const totalTTC = summary?.totalTTC ?? 0;
    const netVAT = summary?.netVAT ?? 0;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color:#1a1a2e;">
        <h2 style="color:#1a1a2e;margin-bottom:8px;">Documents comptables — ${senderName}</h2>
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-joint, sous forme d'archive ZIP, les documents comptables de
        <strong>${senderName}</strong> pour la période : <strong>${period}</strong>.</p>
        <p>L'archive contient :</p>
        <ul>
          <li><strong>rapport_comptable.xlsx</strong> — journal détaillé des écritures (ventes &amp; achats)</li>
          <li><strong>rapport_FEC.txt</strong> — Fichier des Écritures Comptables (norme DGFiP)</li>
          <li><strong>synthese_TVA.xlsx</strong> — synthèse de la TVA collectée et déductible</li>
        </ul>
        <h3 style="margin-top:24px;color:#1a1a2e;">Récapitulatif des chiffres clés</h3>
        <table style="width:100%;border-collapse:collapse;margin:8px 0 24px;">
          <tr style="background:#f5f5f7;"><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Nombre de factures</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${inv}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Nombre de notes de frais</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${exp}</td></tr>
          <tr style="background:#f5f5f7;"><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Total facturé TTC</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${fmtEUR(totalTTC)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Net de TVA à déclarer</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${fmtEUR(netVAT)}</td></tr>
        </table>
        <p>Je reste à votre disposition pour toute information complémentaire.</p>
        <p style="margin-top:24px;">Cordialement,<br/><strong>${senderName}</strong></p>
        <p style="color:#888;font-size:12px;margin-top:32px;">Envoyé automatiquement via Anafy.</p>
      </div>
    `;

    const emailPayload = {
      from: "Anafy <noreply@resend.dev>",
      to: [accountantEmail],
      subject,
      html,
      attachments: [
        { filename: fileName, content: zipBase64, type: "application/zip" },
      ],
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      throw new Error(`Resend [${resendRes.status}]: ${errBody}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("email-accountant-zip error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
