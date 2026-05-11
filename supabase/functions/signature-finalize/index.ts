// Public endpoint: finalize a signature request.
// 1. Validates the token
// 2. Downloads the original PDF
// 3. Stamps the client signature image onto the last page
// 4. Uploads the signed PDF to storage
// 5. Updates the signature_requests row
// 6. Sends an email notification with the signed PDF attached to the artisan
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIGNED_BUCKET = "signed-documents";

function pathFromSignedUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const m = url.match(new RegExp(`/object/sign/${bucket}/([^?]+)`));
  if (m) return decodeURIComponent(m[1]);
  const m2 = url.match(new RegExp(`/object/public/${bucket}/([^?]+)`));
  if (m2) return decodeURIComponent(m2[1]);
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { token, signer_name, signature_data } = await req.json();
    if (!token || !signer_name || !signature_data) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (signer_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nom invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load signature request
    const { data: sigRow, error: sigErr } = await admin
      .from("signature_requests")
      .select("id, document_id, user_id, status, document_snapshot")
      .eq("token", token)
      .maybeSingle();
    if (sigErr || !sigRow) {
      return new Response(JSON.stringify({ error: "Lien invalide" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (sigRow.status === "signed") {
      return new Response(JSON.stringify({ error: "Document déjà signé" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load document
    const { data: doc } = await admin
      .from("documents_comptables")
      .select("pdf_url, document_number, document_type, client_name")
      .eq("id", sigRow.document_id)
      .maybeSingle();
    if (!doc?.pdf_url) {
      return new Response(JSON.stringify({ error: "Document PDF introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load original PDF bytes (via storage if path detected, else direct fetch)
    let pdfBytes: Uint8Array | null = null;
    const originalPath = pathFromSignedUrl(doc.pdf_url, SIGNED_BUCKET);
    if (originalPath) {
      const { data: blob, error: dlErr } = await admin.storage.from(SIGNED_BUCKET).download(originalPath);
      if (dlErr || !blob) {
        return new Response(JSON.stringify({ error: "Téléchargement PDF échoué: " + (dlErr?.message || "inconnu") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = new Uint8Array(await blob.arrayBuffer());
    } else {
      const r = await fetch(doc.pdf_url);
      if (!r.ok) {
        return new Response(JSON.stringify({ error: "Téléchargement PDF échoué" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = new Uint8Array(await r.arrayBuffer());
    }

    // Decode signature data URL (PNG)
    const m = signature_data.match(/^data:image\/(png|jpeg);base64,(.+)$/);
    if (!m) {
      return new Response(JSON.stringify({ error: "Signature invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sigBytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));

    // Stamp signature onto the last page of the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const sigImage = m[1] === "png" ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // Place signature in lower-right area (typical "Signature client" zone)
    const targetW = Math.min(180, width * 0.4);
    const ratio = sigImage.height / sigImage.width;
    const targetH = targetW * ratio;
    const x = width - targetW - 50;
    const y = 90;

    lastPage.drawImage(sigImage, { x, y, width: targetW, height: targetH });

    // Add signer name + date below the signature
    const dateStr = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    lastPage.drawText(`Signé par ${signer_name}`, { x, y: y - 12, size: 8 });
    lastPage.drawText(`Le ${dateStr} — Bon pour accord`, { x, y: y - 22, size: 8 });

    const signedPdfBytes = await pdfDoc.save();

    // Upload signed PDF
    const signedPath = `${sigRow.user_id}/${sigRow.document_id}_signed.pdf`;
    const { error: upErr } = await admin.storage
      .from(SIGNED_BUCKET)
      .upload(signedPath, signedPdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ error: "Upload signé échoué: " + upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedUrlData } = await admin.storage
      .from(SIGNED_BUCKET)
      .createSignedUrl(signedPath, 60 * 60 * 24 * 30); // 30 days
    const signedPdfUrl = signedUrlData?.signedUrl || null;

    // Update signature_requests
    const signedAt = new Date().toISOString();
    const { error: updErr } = await admin
      .from("signature_requests")
      .update({
        signer_name: signer_name.trim(),
        signature_data,
        signed_at: signedAt,
        status: "signed",
        signed_pdf_path: signedPath,
        signed_pdf_url: signedPdfUrl,
        updated_at: signedAt,
      })
      .eq("id", sigRow.id);
    if (updErr) {
      return new Response(JSON.stringify({ error: "Mise à jour échouée: " + updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notification email to artisan
    if (RESEND_API_KEY) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("email, full_name, company_name")
          .eq("user_id", sigRow.user_id)
          .maybeSingle();
        const artisanEmail = profile?.email;
        const artisanName = profile?.company_name || profile?.full_name || "Artisan";
        const clientName = (sigRow.document_snapshot as any)?.client_name || doc.client_name || signer_name;
        const docNumber = doc.document_number || "—";
        const dateOnly = new Date(signedAt).toLocaleDateString("fr-FR");

        if (artisanEmail) {
          const subject = `✅ Devis n° ${docNumber} signé par ${clientName}`;
          const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e;white-space:pre-line;">
Bonjour ${artisanName},

${clientName} a signé le devis n° ${docNumber} le ${dateOnly}.

Le document signé est disponible dans vos documents.

Cordialement,
Anafy
</div>`;
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Anafy <noreply@resend.dev>",
              to: [artisanEmail],
              subject,
              html,
              attachments: [{
                filename: `devis-${docNumber}-signe.pdf`,
                content: bytesToBase64(signedPdfBytes),
                type: "application/pdf",
              }],
            }),
          });
        }
      } catch (mailErr) {
        console.error("[signature-finalize] email error (non-blocking):", mailErr);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      signed_pdf_url: signedPdfUrl,
      signer_name: signer_name.trim(),
      signed_at: signedAt,
      document_number: doc.document_number,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("signature-finalize error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
