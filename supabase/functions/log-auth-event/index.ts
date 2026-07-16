// Records an admin connection log entry. Called from the client on login
// success, login failure, logout and blocked events. Uses the service_role
// key to bypass RLS on public.admin_connection_logs; the table has no
// INSERT policy so regular users can't write from the client directly.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_EVENTS = new Set(['login_success', 'login_failure', 'logout', 'blocked']);
const ALLOWED_DEVICES = new Set(['mobile', 'tablet', 'desktop', 'unknown']);

const detectDevice = (ua: string): string => {
  const s = (ua || '').toLowerCase();
  if (!s) return 'unknown';
  if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet';
  if (/mobi|iphone|android.*mobile|phone/.test(s)) return 'mobile';
  return 'desktop';
};

const extractIp = (req: Request): string | null => {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  return null;
};

const truncate = (v: string | null | undefined, max: number): string | null => {
  if (!v) return null;
  return v.length > max ? v.slice(0, max) : v;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const event: string = String(body?.event || '');
    if (!ALLOWED_EVENTS.has(event)) {
      return new Response(JSON.stringify({ error: 'invalid_event' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = truncate(body?.email ? String(body.email).toLowerCase().trim() : null, 320);
    const clientUserId = body?.user_id ? String(body.user_id) : null;

    // If a JWT is provided, verify it and prefer the authenticated user id.
    let serverUserId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const anon = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await anon.auth.getUser();
      if (data.user && !data.user.is_anonymous) {
        serverUserId = data.user.id;
      }
    }

    const userId = serverUserId ?? clientUserId ?? null;

    const ua = truncate(req.headers.get('user-agent'), 512);
    let device = String(body?.device_type || '').toLowerCase();
    if (!ALLOWED_DEVICES.has(device)) device = detectDevice(ua ?? '');

    const ip = extractIp(req);
    const country = truncate(req.headers.get('cf-ipcountry') || req.headers.get('x-country-code'), 8);

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await svc.from('admin_connection_logs').insert({
      user_id: userId,
      email,
      event,
      ip_address: ip,
      user_agent: ua,
      device_type: device,
      country,
      last_activity_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[log-auth-event] insert failed:', error);
      return new Response(JSON.stringify({ error: 'insert_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[log-auth-event] error:', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
