// Public endpoint (token-based) for the client signature of a chantier report.
// action=info : returns report data + a short-lived signed URL for the PDF
// action=sign : records the client signature via submit_chantier_report_signature
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

    const { action, token, signer_name, signature_data } = await req.json();
    if (!token) return json({ error: "Lien invalide" }, 400);

    if (action === "sign") {
      const { error } = await admin.rpc("submit_chantier_report_signature", {
        _token: token,
        _signer_name: signer_name,
        _signature_data: signature_data,
      });
      if (error) {
        console.error("[chantier-report-public] sign failed:", error.message);
        return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    const { data, error } = await admin.rpc("get_chantier_report_by_token", { _token: token });
    if (error) {
      console.error("[chantier-report-public] info failed:", error.message);
      return json({ error: "Lien invalide" }, 400);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return json({ error: "Lien invalide ou expiré" }, 404);

    let pdfUrl: string | null = row.pdf_url || null;
    if (pdfUrl && !/^https?:\/\//i.test(pdfUrl)) {
      const { data: signed } = await admin.storage.from("documents").createSignedUrl(pdfUrl, 3600);
      pdfUrl = signed?.signedUrl || null;
    }

    let signedPdfUrl: string | null = row.signed_pdf_url || null;
    if (signedPdfUrl && !/^https?:\/\//i.test(signedPdfUrl)) {
      const { data: s } = await admin.storage.from("documents").createSignedUrl(signedPdfUrl, 3600);
      signedPdfUrl = s?.signedUrl || null;
    }

    return json({ ...row, pdf_url: pdfUrl, signed_pdf_url: signedPdfUrl });
  } catch (e) {
    console.error("[chantier-report-public] error:", e);
    return json({ error: "Erreur serveur" }, 500);
  }
});
