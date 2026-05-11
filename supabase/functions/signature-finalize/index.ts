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
const DOCUMENTS_BUCKET = "documents";

function resolveStorageRef(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null;
  const m1 = url.match(/\/object\/(?:sign|public)\/([^/]+)\/([^?]+)/);
  if (m1) return { bucket: m1[1], path: decodeURIComponent(m1[2]) };
  if (!/^https?:\/\//i.test(url)) return { bucket: DOCUMENTS_BUCKET, path: url };
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
      console.error("[signature-finalize] signature_requests lookup failed:", sigErr?.message, "token:", token);
      return new Response(JSON.stringify({ error: "Lien invalide" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[signature-finalize] sigRow loaded:", sigRow.id, "status:", sigRow.status);
    if (sigRow.status === "signed") {
      return new Response(JSON.stringify({ error: "Document déjà signé" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load document
    const { data: doc, error: docErr } = await admin
      .from("documents_comptables")
      .select("pdf_url, document_number, document_type, client_name")
      .eq("id", sigRow.document_id)
      .maybeSingle();
    if (docErr) console.error("[signature-finalize] documents_comptables error:", docErr.message);
    if (!doc?.pdf_url) {
      console.error("[signature-finalize] no pdf_url for document_id:", sigRow.document_id);
      return new Response(JSON.stringify({ error: "Document PDF introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[signature-finalize] doc.pdf_url:", doc.pdf_url);

    // Load original PDF bytes (resolve from any bucket / signed URL / plain path)
    let pdfBytes: Uint8Array | null = null;
    const ref = resolveStorageRef(doc.pdf_url);
    console.log("[signature-finalize] storage ref:", ref);
    if (ref) {
      const { data: blob, error: dlErr } = await admin.storage.from(ref.bucket).download(ref.path);
      if (dlErr || !blob) {
        console.error("[signature-finalize] storage download failed:", ref.bucket, ref.path, dlErr?.message);
        return new Response(JSON.stringify({ error: "Téléchargement PDF échoué: " + (dlErr?.message || "inconnu") }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = new Uint8Array(await blob.arrayBuffer());
    } else {
      const r = await fetch(doc.pdf_url);
      if (!r.ok) {
        console.error("[signature-finalize] fetch original PDF failed:", r.status);
        return new Response(JSON.stringify({ error: "Téléchargement PDF échoué" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = new Uint8Array(await r.arrayBuffer());
    }
    console.log("[signature-finalize] original PDF bytes:", pdfBytes.byteLength);

    // Decode signature data URL (PNG)
    const m = signature_data.match(/^data:image\/(png|jpeg);base64,(.+)$/);
    if (!m) {
      return new Response(JSON.stringify({ error: "Signature invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sigBytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));

    // Stamp signature onto the last page of the PDF
    let signedPdfBytes: Uint8Array;
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const sigImage = m[1] === "png" ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width } = lastPage.getSize();

      const targetW = Math.min(180, width * 0.4);
      const ratioImg = sigImage.height / sigImage.width;
      const targetH = targetW * ratioImg;
      const x = width - targetW - 50;
      const y = 90;

      lastPage.drawImage(sigImage, { x, y, width: targetW, height: targetH });
      const dateStr = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
      lastPage.drawText(`Signé par ${signer_name}`, { x, y: y - 12, size: 8 });
      lastPage.drawText(`Le ${dateStr} — Bon pour accord`, { x, y: y - 22, size: 8 });

      signedPdfBytes = await pdfDoc.save();
    } catch (pdfErr: any) {
      console.error("[signature-finalize] pdf-lib stamp error:", pdfErr?.message || pdfErr);
      return new Response(JSON.stringify({ error: "Erreur traitement PDF: " + (pdfErr?.message || "inconnue") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[signature-finalize] signed PDF bytes:", signedPdfBytes.byteLength);

    // Upload signed PDF
    const signedPath = `${sigRow.user_id}/${sigRow.document_id}_signed.pdf`;
    const { error: upErr } = await admin.storage
      .from(SIGNED_BUCKET)
      .upload(signedPath, signedPdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("[signature-finalize] storage upload failed:", signedPath, upErr.message);
      return new Response(JSON.stringify({ error: "Upload signé échoué: " + upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[signature-finalize] uploaded signed PDF to:", signedPath);

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
          const MAX_ATTACH = 5 * 1024 * 1024; // 5MB
          const tooLarge = signedPdfBytes.byteLength > MAX_ATTACH;
          const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e;white-space:pre-line;">
Bonjour ${artisanName},

${clientName} a signé le devis n° ${docNumber} le ${dateOnly}.

${tooLarge && signedPdfUrl
  ? `Le document signé est trop volumineux pour être joint à cet email.\nTélécharger votre exemplaire signé : ${signedPdfUrl}`
  : "Le document signé est disponible dans vos documents et joint à cet email."}

Cordialement,
Anafy
</div>`;
          const payload: any = {
            from: "Anafy <noreply@resend.dev>",
            to: [artisanEmail],
            subject,
            html,
          };
          if (!tooLarge) {
            payload.attachments = [{
              filename: `devis-${docNumber}-signe.pdf`,
              content: bytesToBase64(signedPdfBytes),
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
            console.error("[signature-finalize] Resend error:", r.status, t);
          } else {
            console.log("[signature-finalize] artisan email sent, attached:", !tooLarge);
          }
        } else {
          console.warn("[signature-finalize] no artisan email on profile");
        }
      } catch (mailErr) {
        console.error("[signature-finalize] email error (non-blocking):", mailErr);
      }
    } else {
      console.warn("[signature-finalize] RESEND_API_KEY missing, skipping email");
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
