// Public endpoint: emails the signed PDF copy to a recipient (the client).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIGNED_BUCKET = "signed-documents";

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY non configuré");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { token, recipient_email } = await req.json();
    if (!token || !recipient_email) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sigRow } = await admin
      .from("signature_requests")
      .select("document_id, signer_name, signed_at, signed_pdf_path, signed_pdf_url, user_id")
      .eq("token", token)
      .maybeSingle();
    if (!sigRow?.signed_pdf_path) {
      return new Response(JSON.stringify({ error: "Document signé introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: blob, error: dlErr } = await admin.storage
      .from(SIGNED_BUCKET).download(sigRow.signed_pdf_path);
    if (dlErr || !blob) {
      return new Response(JSON.stringify({ error: "Téléchargement échoué" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pdfBytes = new Uint8Array(await blob.arrayBuffer());

    const { data: doc } = await admin
      .from("documents_comptables")
      .select("document_number")
      .eq("id", sigRow.document_id).maybeSingle();
    const { data: profile } = await admin
      .from("profiles").select("company_name, full_name")
      .eq("user_id", sigRow.user_id).maybeSingle();

    const docNumber = doc?.document_number || "—";
    const artisanName = profile?.company_name || profile?.full_name || "Artisan";
    const dateStr = sigRow.signed_at
      ? new Date(sigRow.signed_at).toLocaleDateString("fr-FR")
      : new Date().toLocaleDateString("fr-FR");
    const timeStr = sigRow.signed_at
      ? new Date(sigRow.signed_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : "";

    const subject = `Devis signé — n° ${docNumber}`;
    const tooLarge = pdfBytes.byteLength > 5 * 1024 * 1024;
    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e;white-space:pre-line;">
Bonjour ${sigRow.signer_name || ""},

Vous avez signé le devis n° ${docNumber} le ${dateStr}${timeStr ? " à " + timeStr : ""}.

${tooLarge && sigRow.signed_pdf_url
  ? `Votre exemplaire signé est trop volumineux pour être joint à cet email.
Télécharger votre exemplaire signé : ${sigRow.signed_pdf_url}`
  : "Veuillez trouver ci-joint votre exemplaire signé."}

Cordialement,
${artisanName}
</div>`;

    const payload: any = {
      from: "Anafy <noreply@resend.dev>",
      to: [recipient_email],
      subject,
      html,
    };
    if (!tooLarge) {
      payload.attachments = [{
        filename: `devis-${docNumber}-signe.pdf`,
        content: bytesToBase64(pdfBytes),
        type: "application/pdf",
      }];
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Resend [${r.status}]: ${t}`);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("signature-email-copy error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
