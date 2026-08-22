// Génère (une seule fois) le PDF final signé d'un rapport de chantier.
// Entrée : { token } (client_signature_token)
// Sortie : { signed_pdf_url } (URL signée courte durée)
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { token } = await req.json();
    if (!token) return json({ error: "Lien invalide" }, 400);

    const { data: row, error: rowErr } = await admin
      .from("chantier_reports")
      .select("id, user_id, chantier_id, report_number, report_date, status, pdf_url, signed_pdf_url, client_signer_name, client_signed_at, client_signature_data")
      .eq("client_signature_token", token)
      .maybeSingle();

    if (rowErr || !row) return json({ error: "Lien invalide" }, 404);
    if (row.status !== "signe_client") return json({ error: "Rapport non signé" }, 400);

    const signUrl = async (path: string) => {
      if (/^https?:\/\//i.test(path)) return path;
      const { data } = await admin.storage.from("documents").createSignedUrl(path, 3600);
      return data?.signedUrl || null;
    };

    // Déjà généré : on ne recrée jamais un second PDF
    if (row.signed_pdf_url) {
      return json({ signed_pdf_url: await signUrl(row.signed_pdf_url) });
    }

    if (!row.pdf_url) return json({ error: "PDF original introuvable" }, 400);

    // 1. Récupérer le PDF original (chemin storage ou URL publique)
    let originalBytes: Uint8Array | null = null;
    if (/^https?:\/\//i.test(row.pdf_url)) {
      const res = await fetch(row.pdf_url);
      if (res.ok) originalBytes = new Uint8Array(await res.arrayBuffer());
    } else {
      const { data: file } = await admin.storage.from("documents").download(row.pdf_url);
      if (file) originalBytes = new Uint8Array(await file.arrayBuffer());
    }
    if (!originalBytes) return json({ error: "PDF original illisible" }, 400);

    // 2. Nom du chantier
    let chantierName = "";
    if (row.chantier_id) {
      const { data: ch } = await admin.from("chantiers").select("name").eq("id", row.chantier_id).maybeSingle();
      chantierName = ch?.name || "";
    }

    // 3. Ajouter la page « VALIDATION DU CLIENT » (pages originales intactes)
    const pdfDoc = await PDFDocument.load(originalBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const black = rgb(0, 0, 0);
    const gray = rgb(0.45, 0.45, 0.45);
    const M = 56;

    let y = height - 90;
    page.drawText("VALIDATION DU CLIENT", { x: M, y, size: 20, font: fontBold, color: black });
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 46;

    const signedAt = row.client_signed_at ? new Date(row.client_signed_at) : null;
    const dateStr = signedAt
      ? `${signedAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} à ${signedAt.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}`
      : "";

    const rows: [string, string][] = [
      ["Rapport n°", row.report_number || "—"],
      ["Chantier", chantierName || "—"],
      ["Signataire", row.client_signer_name || "—"],
      ["Date et heure de signature", dateStr || "—"],
    ];
    for (const [label, value] of rows) {
      page.drawText(label, { x: M, y, size: 9, font, color: gray });
      page.drawText(String(value), { x: M, y: y - 15, size: 12, font: fontBold, color: black });
      y -= 44;
    }

    y -= 8;
    page.drawText("Signature du client", { x: M, y, size: 9, font, color: gray });
    y -= 150;
    const boxW = 260, boxH = 130;
    page.drawRectangle({ x: M, y, width: boxW, height: boxH, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });

    const sigData: string = row.client_signature_data || "";
    const b64 = sigData.includes(",") ? sigData.split(",")[1] : sigData;
    if (b64) {
      try {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const img = /^data:image\/jpe?g/i.test(sigData)
          ? await pdfDoc.embedJpg(bin)
          : await pdfDoc.embedPng(bin);
        const scale = Math.min((boxW - 16) / img.width, (boxH - 16) / img.height);
        const w = img.width * scale, h = img.height * scale;
        page.drawImage(img, { x: M + (boxW - w) / 2, y: y + (boxH - h) / 2, width: w, height: h });
      } catch (e) {
        console.error("[chantier-report-finalize] signature embed failed:", e);
      }
    }

    y -= 44;
    page.drawText("Rapport validé et signé par le client", { x: M, y, size: 11, font: fontBold, color: rgb(0.02, 0.45, 0.34) });

    const finalBytes = await pdfDoc.save();

    // 4. Enregistrer dans le bucket documents
    const safeNum = (row.report_number || row.id).toString().replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `${row.user_id}/rapports-chantier-signes/${safeNum}-signe.pdf`;
    const { error: upErr } = await admin.storage.from("documents").upload(path, finalBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      console.error("[chantier-report-finalize] upload failed:", upErr.message);
      return json({ error: "Enregistrement du PDF signé impossible" }, 500);
    }

    const { error: updErr } = await admin
      .from("chantier_reports")
      .update({ signed_pdf_url: path })
      .eq("id", row.id);
    if (updErr) console.error("[chantier-report-finalize] update failed:", updErr.message);

    return json({ signed_pdf_url: await signUrl(path) });
  } catch (e) {
    console.error("[chantier-report-finalize] error:", e);
    return json({ error: "Erreur serveur" }, 500);
  }
});
