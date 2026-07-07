import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { document_id, client_email } = await req.json();
    if (!document_id || !client_email || typeof client_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify ownership and type
    const { data: doc, error: docErr } = await supabase
      .from('documents_comptables')
      .select('id, document_number, user_id, document_type')
      .eq('id', document_id)
      .eq('user_id', userId)
      .eq('document_type', 'facture')
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: 'Facture introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenValue = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: inserted, error: insErr } = await supabase
      .from('invoice_tokens')
      .insert({
        user_id: userId,
        document_id,
        client_email,
        token: tokenValue,
        expires_at: expiresAt,
        status: 'sent',
      })
      .select('id, token, expires_at')
      .single();

    if (insErr || !inserted) {
      console.error('Token insert failed:', insErr);
      return new Response(JSON.stringify({ error: 'Impossible de créer le lien' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://anafypro.com/invoice/${inserted.token}`;
    const subject = `Votre facture ${doc.document_number ?? ''}`.trim();
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color:#111;">Votre facture</h2>
        <p>Bonjour,</p>
        <p>Voici votre facture <strong>${doc.document_number ?? ''}</strong>. Le lien est valide 48 heures.</p>
        <p style="margin: 24px 0;">
          <a href="${url}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Voir la facture</a>
        </p>
        <p style="color:#555;font-size:13px;">Ou copiez ce lien : <br/><a href="${url}">${url}</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="color:#999;font-size:12px;">Accès sécurisé. Ce lien expire dans 48h.</p>
      </div>
    `;

    let emailSent = false;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Anafy Pro <onboarding@resend.dev>',
          to: [client_email],
          subject,
          html,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        console.error('Resend send failed', resp.status, body);
      } else {
        emailSent = true;
      }
    } else {
      console.error('RESEND_API_KEY missing');
    }

    return new Response(
      JSON.stringify({ token: inserted.token, expires_at: inserted.expires_at, email_sent: emailSent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('send-invoice-to-client error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
