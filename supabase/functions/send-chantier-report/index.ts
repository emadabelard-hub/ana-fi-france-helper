// Send a chantier report (text only) via email using Resend.
// Authenticated endpoint — requires a logged-in user.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const htmlEscape = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user || user.is_anonymous) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      recipientEmail,
      clientName,
      chantierName,
      reportDate,
      reportContent,
      companyName,
    } = body as {
      recipientEmail?: string;
      clientName?: string;
      chantierName?: string;
      reportDate?: string;
      reportContent?: string;
      companyName?: string;
    };

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'recipientEmail manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: 'Email destinataire invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromName = (companyName || 'AnafyPro').toString().slice(0, 120);
    const fromNameSafe = htmlEscape(fromName);
    const clientNameSafe = htmlEscape(clientName || '');
    const chantierNameSafe = htmlEscape(chantierName || '');
    const reportDateSafe = htmlEscape(reportDate || '');
    const contentHtml = htmlEscape(reportContent || '').replace(/\n/g, '<br/>');
    const subject = `Rapport de chantier — ${chantierName || ''} — ${reportDate || ''}`.slice(0, 200);

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#1a2a44;line-height:1.6;max-width:640px;margin:0 auto;padding:24px">
        <div style="background:linear-gradient(135deg,#0F2A5E,#1B4F8A);color:#fff;padding:20px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:20px">Rapport de chantier</h1>
          <p style="margin:4px 0 0;opacity:.9">${chantierNameSafe}</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Bonjour ${clientNameSafe || ''},</p>
          <p>Veuillez trouver ci-dessous le résumé du rapport du chantier <strong>${chantierNameSafe}</strong> en date du <strong>${reportDateSafe}</strong>.</p>
          <div style="background:#F2F4F8;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap">${contentHtml}</div>
          <p style="margin-top:16px;color:#475569;font-size:13px">
            📎 Le rapport complet (avec photos et signatures) est disponible sur <strong>Anafy Pro</strong>.
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="margin:0">Cordialement,<br/><strong>${fromNameSafe}</strong></p>
        </div>
      </div>
    `;

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName.replace(/[<>"\r\n]/g, '')} <noreply@anafypro.com>`,
        to: [recipientEmail],
        subject,
        html,
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      console.error('Resend error:', resendResp.status, errText);
      return new Response(
        JSON.stringify({ error: `Resend error (${resendResp.status}): ${errText.slice(0, 400)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await resendResp.json();
    return new Response(JSON.stringify({ success: true, id: result?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-chantier-report error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
