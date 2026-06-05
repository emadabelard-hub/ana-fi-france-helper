// Send accountant invitation email via Resend.
// Authenticated endpoint — owner must be logged in.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const htmlEscape = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user || user.is_anonymous) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { accountantName, accountantEmail, accessToken, companyName } = await req.json();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!accountantName || !accountantEmail || !accessToken || !emailRegex.test(accountantEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const link = `https://anafypro.com/comptable?token=${encodeURIComponent(accessToken)}`;
    const nameSafe = htmlEscape(accountantName);
    const companySafe = htmlEscape(companyName || 'Notre société');
    const linkSafe = htmlEscape(link);

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2a44;line-height:1.6;max-width:600px;margin:0 auto;padding:24px">
        <div style="background:linear-gradient(135deg,#1a2a44,#243b5c);color:#fff;padding:24px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:20px">Invitation — Accès Comptable</h1>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Bonjour ${nameSafe},</p>
          <p><strong>${companySafe}</strong> vous invite à accéder à son espace comptable sécurisé sur AnafyPro.</p>
          <p>Vous y trouverez en lecture seule : le chiffre d'affaires, la TVA collectée et déductible, les factures, devis, dépenses avec justificatifs, ainsi que l'export FEC officiel.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${linkSafe}" style="display:inline-block;background:#BFA071;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600">Accéder à l'espace comptable</a>
          </div>
          <p style="font-size:12px;color:#666">Ou copiez ce lien : <br/><span style="word-break:break-all">${linkSafe}</span></p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="font-size:12px;color:#888">Ce lien est strictement personnel. Ne le partagez pas.</p>
        </div>
      </div>
    `;

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'AnafyPro <noreply@anafypro.com>',
        to: [accountantEmail],
        subject: `Invitation accès comptable — ${companyName || 'AnafyPro'}`,
        html,
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      console.error('Resend error:', resendResp.status, errText);
      return new Response(JSON.stringify({ error: `Email send failed (${resendResp.status})` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('invite-accountant error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
