// Public endpoint — accountant data access via token.
// Validates token, returns owner's accounting data (read-only).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { token, action, path } = body as { token?: string; action?: string; path?: string };

    if (!token || !UUID_RE.test(token)) {
      return new Response(JSON.stringify({ error: 'invalid_token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const svc = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: access, error: accessErr } = await svc
      .from('accountant_access')
      .select('user_id, is_active, accountant_name, accountant_email, expires_at')
      .eq('access_token', token)
      .maybeSingle();

    if (accessErr || !access || !access.is_active) {
      return new Response(JSON.stringify({ error: 'invalid_token' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (access.expires_at && new Date(access.expires_at as string).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'expired_token' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ownerId = access.user_id as string;

    // ─── Signed-URL action ───
    if (action === 'sign-url' && typeof path === 'string' && path.length > 0) {
      if (path.includes('..')) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Locate the stored value in ONE of the three owner-scoped tables.
      // The client passes exactly what the app stored (bare path OR full https URL);
      // we never trust a client-provided bucket.
      type Kind = 'supplier' | 'document' | 'expense';
      let kind: Kind | null = null;
      let stored: string | null = null;

      const { data: si } = await svc
        .from('supplier_invoices')
        .select('id')
        .eq('user_id', ownerId)
        .eq('pdf_url', path)
        .maybeSingle();
      if (si) { kind = 'supplier'; stored = path; }

      if (!kind) {
        const { data: dc } = await svc
          .from('documents_comptables')
          .select('id')
          .eq('user_id', ownerId)
          .eq('pdf_url', path)
          .maybeSingle();
        if (dc) { kind = 'document'; stored = path; }
      }
      if (!kind) {
        const { data: ex } = await svc
          .from('expenses')
          .select('id')
          .eq('user_id', ownerId)
          .eq('receipt_url', path)
          .maybeSingle();
        if (ex) { kind = 'expense'; stored = path; }
      }

      if (!kind || !stored) {
        console.warn('[accountant-data] sign-url path not owned', { ownerId, sample: stored?.slice(0, 80) });
        return new Response(JSON.stringify({ error: 'invalid_path' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Resolve bucket + objectPath from the STORED value (source of truth).
      let bucket: string | null = null;
      let objectPath = stored;
      const httpsMatch = stored.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/([^?#]+)/);
      if (httpsMatch) {
        bucket = decodeURIComponent(httpsMatch[1]);
        try { objectPath = decodeURIComponent(httpsMatch[2]); } catch { objectPath = httpsMatch[2]; }
      } else {
        // Bare path — resolve bucket by kind + heuristics.
        if (kind === 'supplier') bucket = 'documents';
        else if (kind === 'document') bucket = 'signed-documents';
        else bucket = objectPath.includes('/notes-frais/') ? 'documents' : 'expense-receipts';
      }

      if (!bucket || !objectPath) {
        return new Response(JSON.stringify({ error: 'invalid_path' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Ownership guard: object path must live under ownerId/.
      if (!objectPath.startsWith(`${ownerId}/`)) {
        console.warn('[accountant-data] sign-url ownership mismatch', { ownerId, bucket });
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: signed, error: signErr } = await svc.storage.from(bucket).createSignedUrl(objectPath, 600);
      if (signErr || !signed) {
        return new Response(JSON.stringify({ error: 'sign_failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ url: signed.signedUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Default: fetch all data ───
    const [profileRes, docsRes, expensesRes, supplierInvRes, suppliersRes] = await Promise.all([
      svc.from('profiles').select('company_name, siret, company_address, legal_status, tva_exempt, numero_tva').eq('user_id', ownerId).maybeSingle(),
      svc.from('documents_comptables')
        .select('id, document_type, document_number, client_name, subtotal_ht, tva_rate, tva_amount, total_ttc, status, payment_status, pdf_url, created_at')
        .eq('user_id', ownerId)
        .in('status', ['finalized', 'converted', 'cancelled'])
        .order('created_at', { ascending: false }),
      svc.from('expenses')
        .select('id, title, amount, category, tva_amount, receipt_url, expense_date, notes, created_at')
        .eq('user_id', ownerId)
        .order('expense_date', { ascending: false }),
      svc.from('supplier_invoices')
        .select('id, invoice_number, supplier_reference, supplier_id, invoice_date, amount_ht, tva_rate, amount_tva, amount_ttc, status, source, pdf_url, created_at')
        .eq('user_id', ownerId)
        .order('invoice_date', { ascending: false }),
      svc.from('suppliers').select('id, name').eq('user_id', ownerId),
    ]);

    const profile = profileRes.data || null;
    const docs = docsRes.data || [];
    const expenses = expensesRes.data || [];
    const supplierInvoicesRaw = supplierInvRes.data || [];
    const suppliersMap = new Map<string, string>();
    for (const s of (suppliersRes.data || [])) suppliersMap.set(s.id as string, (s.name as string) || '');
    const supplier_invoices = supplierInvoicesRaw.map((si: any) => ({
      ...si,
      supplier_name: si.supplier_id ? (suppliersMap.get(si.supplier_id) || null) : null,
    }));

    // Compute totals (paid invoices only — encaissement)
    let caTotal = 0;
    let tvaCollected = 0;
    for (const d of docs) {
      if (d.document_type === 'facture' && d.payment_status === 'paid') {
        caTotal += Number(d.total_ttc || 0);
        tvaCollected += Number(d.tva_amount || 0);
      }
    }
    const tvaDeductible = expenses.reduce((s, e) => s + Number(e.tva_amount || 0), 0);
    const netVat = tvaCollected - tvaDeductible;

    return new Response(JSON.stringify({
      accountant: { name: access.accountant_name, email: access.accountant_email },
      company: profile,
      summary: {
        caTotal: Math.round(caTotal * 100) / 100,
        tvaCollected: Math.round(tvaCollected * 100) / 100,
        tvaDeductible: Math.round(tvaDeductible * 100) / 100,
        netVat: Math.round(netVat * 100) / 100,
      },
      documents: docs,
      expenses,
      supplier_invoices,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('accountant-data error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
