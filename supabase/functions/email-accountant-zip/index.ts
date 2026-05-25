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

    // --- Input validation & sanitization ---
    const escapeHtml = (s: unknown): string =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipient = String(accountantEmail).trim();
    if (!emailRe.test(recipient) || recipient.length > 254) {
      return new Response(JSON.stringify({ error: "Adresse email destinataire invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize filename: only safe characters, force .zip extension
    const rawName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const safeFileName = rawName.toLowerCase().endsWith(".zip") ? rawName : `${rawName}.zip`;

    // Cap attachment size (~15 MB base64)
    if (typeof zipBase64 !== "string" || zipBase64.length > 20_000_000) {
      return new Response(JSON.stringify({ error: "Pièce jointe trop volumineuse" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderNameRaw = (companyName || artisanName || "Artisan").toString().slice(0, 120);
    const periodRaw = (periodLabel || "période en cours").toString().slice(0, 120);
    const senderNameSafe = escapeHtml(senderNameRaw);
    const periodSafe = escapeHtml(periodRaw);
    const subject = `Documents comptables — ${senderNameRaw} — ${periodRaw}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color:#1a1a2e; white-space: pre-line;">
Bonjour,

Veuillez trouver ci-joint les documents comptables de ${senderNameSafe} pour la période ${periodSafe}.

Cordialement,
${senderNameSafe}
      </div>
    `;

    const emailPayload = {
      from: "Anafy <noreply@resend.dev>",
      to: [recipient],
      subject,
      html,
      attachments: [
        { filename: safeFileName, content: zipBase64, type: "application/zip" },
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
