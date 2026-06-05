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

function resolveStorageRefs(url: string | null | undefined): { bucket: string; path: string }[] {
  if (!url) return [];
  const m1 = url.match(/\/object\/(?:sign|public)\/([^/]+)\/([^?]+)/);
  if (m1) return [{ bucket: m1[1], path: decodeURIComponent(m1[2]) }];
  if (!/^https?:\/\//i.test(url)) {
    return [
      { bucket: DOCUMENTS_BUCKET, path: url },
      { bucket: SIGNED_BUCKET, path: url },
    ];
  }
  return [];
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function downloadFirstPdf(admin: any, refs: { bucket: string; path: string }[]): Promise<{ bytes: Uint8Array; ref: { bucket: string; path: string } } | null> {
  for (const ref of refs) {
    const { data: blob, error } = await admin.storage.from(ref.bucket).download(ref.path);
    if (blob) return { bytes: new Uint8Array(await blob.arrayBuffer()), ref };
    console.error("[signature-finalize] storage download failed:", ref.bucket, ref.path, error?.message || JSON.stringify(error || {}));
  }
  return null;
}

async function stampWithPdfLib(
  pdfBytes: Uint8Array,
  sigBytes: Uint8Array,
  sigKind: "png" | "jpeg",
  signer_name: string,
  dateOnly: string,
  timeOnly: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const sigImage = sigKind === "png" ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width: pageW } = lastPage.getSize();
  const boxLeft = 32;
  const boxRight = Math.max(boxLeft + 200, pageW * 0.62);
  const boxWidth = boxRight - boxLeft;
  const boxBottomY = 70;
  const sigAreaH = 22;
  const sigAreaY = boxBottomY + 4;
  const sigAreaX = boxLeft + 8;
  const sigAreaW = boxWidth - 16;
  const ratioImg = sigImage.height / sigImage.width;
  let sigW = sigAreaW * 0.55;
  let sigH = sigW * ratioImg;
  if (sigH > sigAreaH) { sigH = sigAreaH; sigW = sigH / ratioImg; }
  const sigX = sigAreaX + (sigAreaW - sigW) / 2;
  const sigY = sigAreaY + (sigAreaH - sigH) / 2;
  lastPage.drawImage(sigImage, { x: sigX, y: sigY, width: sigW, height: sigH });
  const fieldsY = sigAreaY + sigAreaH + 10;
  const nomX = boxLeft + 14;
  const dateX = boxLeft + boxWidth / 2 + 4;
  lastPage.drawText(signer_name, { x: nomX, y: fieldsY, size: 8 });
  lastPage.drawText(dateOnly, { x: dateX, y: fieldsY, size: 8 });
  lastPage.drawText(`Signé électroniquement le ${dateOnly} à ${timeOnly}`, { x: sigAreaX, y: boxBottomY - 8, size: 6.5 });
  return await pdfDoc.save();
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
      .select("id, document_id, user_id, status, document_snapshot, html_snapshot")
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
    const refs = resolveStorageRefs(doc.pdf_url);
    console.log("[signature-finalize] storage refs:", refs);
    const downloaded = await downloadFirstPdf(admin, refs);
    if (downloaded) {
      pdfBytes = downloaded.bytes;
      console.log("[signature-finalize] original PDF downloaded from:", downloaded.ref);
    } else if (doc.document_number) {
      const { data: archived, error: archiveErr } = await admin
        .from("documents")
        .select("storage_path, pdf_url")
        .eq("user_id", sigRow.user_id)
        .eq("numero", doc.document_number)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (archiveErr) console.error("[signature-finalize] archive lookup failed:", archiveErr.message);
      const archiveRefs = resolveStorageRefs(archived?.storage_path || archived?.pdf_url);
      console.log("[signature-finalize] archive storage refs:", archiveRefs);
      const archivedDownload = await downloadFirstPdf(admin, archiveRefs);
      if (archivedDownload) {
        pdfBytes = archivedDownload.bytes;
        console.log("[signature-finalize] original PDF downloaded from archive:", archivedDownload.ref);
      }
    }
    if (!pdfBytes && /^https?:\/\//i.test(doc.pdf_url)) {
      const r = await fetch(doc.pdf_url);
      if (!r.ok) {
        console.error("[signature-finalize] fetch original PDF failed:", r.status);
        return new Response(JSON.stringify({ error: "Téléchargement PDF échoué" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = new Uint8Array(await r.arrayBuffer());
    }
    if (!pdfBytes) {
      return new Response(JSON.stringify({ error: "Téléchargement PDF échoué: fichier introuvable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Build signed PDF
    let signedPdfBytes: Uint8Array;
    const signedAtDate = new Date();
    const signedDateStr = signedAtDate.toLocaleDateString("fr-FR");
    const signedTimeStr = signedAtDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const htmlSnapshot: string | null = (sigRow as any).html_snapshot || null;
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");

    if (htmlSnapshot && BROWSERLESS_API_KEY) {
      try {
        // Inject client signature into the "Le client" zone
        const safeName = escapeHtml(signer_name.trim());
        const nameHtml = `<div data-sig-slot="name" style="font-size:7pt;font-weight:600;color:#111;line-height:1.1;padding-bottom:1px;border-bottom:1px solid #111">${safeName}</div>`;
        const dateHtml = `<div data-sig-slot="date" style="font-size:7pt;font-weight:600;color:#111;line-height:1.1;padding-bottom:1px;border-bottom:1px solid #111">${signedDateStr}</div>`;
        const sigHtml = `<div data-sig-slot="signature" style="text-align:center;border:1px solid #111;border-radius:2px;padding:2px"><img src="${signature_data}" style="max-width:150px;max-height:60px;display:inline-block"/><div style="font-size:6pt;color:#059669;font-weight:600;margin-top:1px">✅ Signé électroniquement</div></div>`;

        let html = htmlSnapshot;
        html = html.replace(/<div\b[^>]*\bdata-sig-slot=["']name["'][^>]*>[\s\S]*?<\/div>/i, nameHtml);
        html = html.replace(/<div\b[^>]*\bdata-sig-slot=["']date["'][^>]*>[\s\S]*?<\/div>/i, dateHtml);
        html = html.replace(/<div\b[^>]*\bdata-sig-slot=["']signature["'][^>]*>[\s\S]*?<\/div>/i, sigHtml);

        const browserlessUrl = `https://chrome.browserless.io/pdf?token=${BROWSERLESS_API_KEY}`;
        const browserlessRes = await fetch(browserlessUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html,
            options: {
              printBackground: true,
              preferCSSPageSize: false,
              format: "A4",
              margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
            },
            gotoOptions: { waitUntil: "networkidle0", timeout: 25000 },
          }),
        });
        if (!browserlessRes.ok) {
          const t = await browserlessRes.text();
          throw new Error(`Browserless ${browserlessRes.status}: ${t.slice(0, 300)}`);
        }
        signedPdfBytes = new Uint8Array(await browserlessRes.arrayBuffer());
        console.log("[signature-finalize] signed PDF generated via HTML snapshot:", signedPdfBytes.byteLength);
      } catch (htmlErr: any) {
        console.error("[signature-finalize] HTML regen failed, falling back to pdf-lib stamp:", htmlErr?.message || htmlErr);
        signedPdfBytes = await stampWithPdfLib(pdfBytes, sigBytes, m[1] as "png" | "jpeg", signer_name, signedDateStr, signedTimeStr);
      }
    } else {
      if (!htmlSnapshot) console.log("[signature-finalize] no html_snapshot, using pdf-lib stamp");
      if (!BROWSERLESS_API_KEY) console.warn("[signature-finalize] BROWSERLESS_API_KEY missing, using pdf-lib stamp");
      signedPdfBytes = await stampWithPdfLib(pdfBytes, sigBytes, m[1] as "png" | "jpeg", signer_name, signedDateStr, signedTimeStr);
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
          const docNumberSafe = escapeHtml(docNumber);
          const artisanNameSafe = escapeHtml(artisanName);
          const clientNameSafe = escapeHtml(clientName);
          const signedUrlSafe = escapeHtml(signedPdfUrl || "");
          const subject = `✅ Devis n° ${docNumber} signé par ${clientName}`.slice(0, 200);
          const MAX_ATTACH = 5 * 1024 * 1024; // 5MB
          const tooLarge = signedPdfBytes.byteLength > MAX_ATTACH;
          const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e;white-space:pre-line;">
Bonjour ${artisanNameSafe},

${clientNameSafe} a signé le devis n° ${docNumberSafe} le ${dateOnly}.

${tooLarge && signedPdfUrl
  ? `Le document signé est trop volumineux pour être joint à cet email.\nTélécharger votre exemplaire signé : ${signedUrlSafe}`
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

    // Send confirmation email to the client (devis only)
    if (RESEND_API_KEY && (doc.document_type === 'devis' || !doc.document_type)) {
      try {
        const snap: any = sigRow.document_snapshot || {};
        const clientNameForLookup: string = snap.client_name || doc.client_name || '';
        let clientEmail: string | null = snap.client_email || null;
        if (!clientEmail && clientNameForLookup) {
          const { data: clientRow } = await admin
            .from("clients")
            .select("contact_email")
            .eq("user_id", sigRow.user_id)
            .eq("name", clientNameForLookup)
            .maybeSingle();
          clientEmail = clientRow?.contact_email || null;
        }

        if (clientEmail) {
          const { data: profile2 } = await admin
            .from("profiles")
            .select("company_name, full_name")
            .eq("user_id", sigRow.user_id)
            .maybeSingle();
          const companyName = profile2?.company_name || profile2?.full_name || "Votre artisan";
          const docNumber = doc.document_number || "—";
          const totalTtc = typeof snap.total_ttc === 'number'
            ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(snap.total_ttc)
            : '—';
          const subject = `Confirmation de signature — Devis N°${docNumber}`;
          const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e;white-space:pre-line;">
Bonjour ${escapeHtml(signer_name.trim())},

Nous vous confirmons la bonne réception de votre signature électronique concernant le devis suivant :

• Numéro de devis : ${escapeHtml(docNumber)}
• Montant TTC : ${totalTtc}
• Date de signature : ${signedDateStr}
• Heure de signature : ${signedTimeStr}

Ce devis signé constitue un accord ferme entre vous et la société ${escapeHtml(companyName)}.

Nous vous remercions de votre confiance et restons à votre disposition pour toute question.

Cordialement,
${escapeHtml(companyName)}
</div>`;
          const r2 = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Anafy <noreply@resend.dev>",
              to: [clientEmail],
              subject,
              html,
            }),
          });
          if (!r2.ok) {
            const t = await r2.text();
            console.error("[signature-finalize] client confirmation Resend error:", r2.status, t);
          } else {
            console.log("[signature-finalize] client confirmation email sent to:", clientEmail);
          }
        } else {
          console.warn("[signature-finalize] no client email found, skipping client confirmation");
        }
      } catch (mailErr) {
        console.error("[signature-finalize] client confirmation error (non-blocking):", mailErr);
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
