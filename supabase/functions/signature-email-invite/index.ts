// Public endpoint: send a signature invitation email to the client.
// Given a signature token, resolves recipient/artisan server-side and
// sends the public sign link via Resend from ANAFYPRO <noreply@anafypro.com>.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const htmlEscape = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const maskToken = (t: string): string =>
  !t ? "" : t.length <= 8 ? "***" : `${t.slice(0, 4)}…${t.slice(-4)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Service e-mail non configuré." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body?.token;
    const recipientOverride: string | undefined = body?.recipientEmail;
    const signUrlOverride: string | undefined = body?.signUrl;

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Jeton de signature manquant." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: sigRow, error: sigErr } = await admin
      .from("signature_requests")
      .select("id, document_id, user_id, status")
      .eq("token", token)
      .maybeSingle();

    if (sigErr || !sigRow) {
      console.error("[signature-email-invite] signature not found:", maskToken(token), sigErr?.message);
      return new Response(JSON.stringify({ error: "Demande de signature introuvable." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc } = await admin
      .from("documents_comptables")
      .select("document_number, document_type, client_name, document_data, chantier_id")
      .eq("id", sigRow.document_id)
      .maybeSingle();

    const { data: profile } = await admin
      .from("profiles")
      .select("company_name, full_name, email")
      .eq("user_id", sigRow.user_id)
      .maybeSingle();

    // Try to extract an email from the JSON snapshot without inventing a column.
    const snap: any = (doc as any)?.document_data && typeof (doc as any).document_data === "object"
      ? (doc as any).document_data
      : {};
    const snapEmailCandidates = [
      snap?.client_email,
      snap?.client?.email,
      snap?.client?.contact_email,
      snap?.contact_email,
    ];
    const snapEmail = snapEmailCandidates
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((v) => v && emailRegex.test(v)) || "";

    // Fallback: contact_email from clients table, linked via chantier when available.
    let clientEmailFromDb = "";
    const chantierId = (doc as any)?.chantier_id;
    if (chantierId) {
      const { data: ch } = await admin
        .from("chantiers")
        .select("client_id")
        .eq("id", chantierId)
        .maybeSingle();
      const clientId = (ch as any)?.client_id;
      if (clientId) {
        const { data: cli } = await admin
          .from("clients")
          .select("contact_email")
          .eq("id", clientId)
          .maybeSingle();
        const ce = typeof (cli as any)?.contact_email === "string" ? (cli as any).contact_email.trim() : "";
        if (ce && emailRegex.test(ce)) clientEmailFromDb = ce;
      }
    }

    // Recipient priority: 1) explicit override from UI, 2) snapshot email, 3) clients.contact_email.
    const overrideEmail = typeof recipientOverride === "string" ? recipientOverride.trim() : "";
    const recipient = (overrideEmail && emailRegex.test(overrideEmail))
      ? overrideEmail
      : (snapEmail || clientEmailFromDb || "");
    if (!recipient) {
      return new Response(JSON.stringify({ error: "Adresse e-mail du client requise." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Public sign URL — rebuild server-side; accept override only for host prefix if provided by trusted UI.
    const signUrl = (signUrlOverride && /^https?:\/\/[^\s]+\/sign\/[A-Za-z0-9-]+$/i.test(signUrlOverride))
      ? signUrlOverride
      : `https://anafypro.com/sign/${encodeURIComponent(token)}`;

    const clientName = (doc as any)?.client_name
      || (typeof snap?.client_name === "string" ? snap.client_name : "")
      || (typeof snap?.client?.name === "string" ? snap.client.name : "")
      || "";
    const companyName = profile?.company_name || profile?.full_name || "Votre artisan";
    const docNumber = (doc as any)?.document_number || "";
    const replyTo = profile?.email && emailRegex.test(profile.email) ? profile.email : undefined;

    const subject = "Votre devis est prêt à être signé";
    const greeting = clientName ? `Bonjour ${htmlEscape(clientName)},` : "Bonjour,";
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2a44;line-height:1.6;max-width:600px;margin:0 auto;padding:24px">
        <div style="background:linear-gradient(135deg,#1a2a44,#243b5c);color:#fff;padding:24px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:20px">Votre devis est prêt à être signé</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>${greeting}</p>
          <p><strong>${htmlEscape(companyName)}</strong> vous invite à consulter et signer votre devis${docNumber ? ` n° ${htmlEscape(docNumber)}` : ""} en ligne.</p>
          <p>Le lien ci-dessous vous permet de consulter le document avant de le signer électroniquement.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${htmlEscape(signUrl)}" style="display:inline-block;background:#BFA071;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600">Consulter et signer le devis</a>
          </div>
          <p style="font-size:12px;color:#666">Ou copiez ce lien dans votre navigateur :<br/><span style="word-break:break-all">${htmlEscape(signUrl)}</span></p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="font-size:12px;color:#888">Ce lien est personnel. Merci de ne pas le partager.</p>
        </div>
      </div>
    `;

    const payload: Record<string, unknown> = {
      from: "ANAFYPRO <noreply@anafypro.com>",
      to: [recipient],
      subject,
      html,
    };
    if (replyTo) payload.reply_to = replyTo;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      console.error(`[signature-email-invite] Resend ${resendResp.status}:`, errText);
      return new Response(JSON.stringify({ error: `Échec de l'envoi de l'e-mail (${resendResp.status}).` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, message: "E-mail envoyé au client." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[signature-email-invite] error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Erreur interne lors de l'envoi de l'e-mail." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
