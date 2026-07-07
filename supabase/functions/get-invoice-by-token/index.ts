import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: t, error: tErr } = await admin
      .from('invoice_tokens')
      .select('id, document_id, expires_at, client_email, viewed_at')
      .eq('token', token)
      .maybeSingle();

    if (tErr || !t) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(t.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: 'expired', expires_at: t.expires_at }), {
        status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: doc, error: docErr } = await admin
      .from('documents_comptables')
      .select('*')
      .eq('id', t.document_id)
      .eq('document_type', 'facture')
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('invoice_access_log').insert({ token_id: t.id, action: 'viewed' });
    await admin.from('invoice_tokens').update({ viewed_at: new Date().toISOString(), status: 'viewed' }).eq('id', t.id);

    return new Response(
      JSON.stringify({ document: doc, client_email: t.client_email, expires_at: t.expires_at }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('get-invoice-by-token error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
