// Public endpoint: given a signature token, returns the document snapshot
// and short-lived signed URLs for the original and signed PDFs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIGNED_BUCKET = "signed-documents";
const DOCUMENTS_BUCKET = "documents";
const URL_TTL = 60 * 60; // 1h

// Extract candidate {bucket, path} pairs from a stored pdf_url which may be:
// - a Supabase signed URL (.../object/sign/<bucket>/<path>?token=...)
// - a Supabase public URL  (.../object/public/<bucket>/<path>)
// - a plain storage path "<userId>/.../file.pdf".
// Legacy code saved plain paths from both buckets, so try both.
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

async function createFirstSignedUrl(admin: any, refs: { bucket: string; path: string }[]): Promise<string | null> {
  for (const ref of refs) {
    const { data, error } = await admin.storage.from(ref.bucket).createSignedUrl(ref.path, URL_TTL);
    if (data?.signedUrl) return data.signedUrl;
    if (error) console.warn("[signature-info] signed URL failed:", ref.bucket, ref.path, error.message);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sigRow, error: sigErr } = await admin
      .from("signature_requests")
      .select("id, document_id, user_id, status, signer_name, signed_at, document_snapshot, signed_pdf_path, signed_pdf_url, created_at")
      .eq("token", token)
      .maybeSingle();
    if (sigErr || !sigRow) {
      return new Response(JSON.stringify({ error: "Lien invalide" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc } = await admin
      .from("documents_comptables")
      .select("pdf_url, document_number, document_type")
      .eq("id", sigRow.document_id)
      .maybeSingle();

    let originalSignedUrl: string | null = null;
    originalSignedUrl = await createFirstSignedUrl(admin, resolveStorageRefs(doc?.pdf_url));
    if (!originalSignedUrl && doc?.document_number) {
      const { data: archived } = await admin
        .from("documents")
        .select("storage_path, pdf_url")
        .eq("user_id", sigRow.user_id)
        .eq("numero", doc.document_number)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      originalSignedUrl = await createFirstSignedUrl(admin, resolveStorageRefs(archived?.storage_path || archived?.pdf_url));
    }
    if (!originalSignedUrl && doc?.pdf_url && /^https?:\/\//i.test(doc.pdf_url)) {
      originalSignedUrl = doc.pdf_url;
    }

    let signedPdfUrl: string | null = null;
    if (sigRow.signed_pdf_path) {
      const { data: u } = await admin.storage.from(SIGNED_BUCKET).createSignedUrl(sigRow.signed_pdf_path, URL_TTL);
      signedPdfUrl = u?.signedUrl || sigRow.signed_pdf_url || null;
    }

    return new Response(JSON.stringify({
      id: sigRow.id,
      status: sigRow.status,
      signer_name: sigRow.signer_name,
      signed_at: sigRow.signed_at,
      document_snapshot: sigRow.document_snapshot,
      created_at: sigRow.created_at,
      original_pdf_url: originalSignedUrl,
      signed_pdf_url: signedPdfUrl,
      document_number: doc?.document_number,
      document_type: doc?.document_type,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("signature-info error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
