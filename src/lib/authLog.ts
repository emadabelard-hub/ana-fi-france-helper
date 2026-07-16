// Fire-and-forget logger for authentication events. Uses a raw fetch with
// `keepalive: true` so the request survives an immediate navigation
// (e.g. `window.location.replace('/login')` on sign-out) — supabase.functions
// .invoke() uses a normal fetch that the browser cancels on unload.
// The edge function `log-auth-event` writes the entry with the service_role
// key; failures must never block the user-facing auth flow.
import { supabase } from '@/integrations/supabase/client';

type AuthEvent = 'login_success' | 'login_failure' | 'logout' | 'blocked';

interface LogParams {
  event: AuthEvent;
  email?: string | null;
  userId?: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const detectDevice = (): 'mobile' | 'tablet' | 'desktop' | 'unknown' => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|iphone|android.*mobile|phone/.test(ua)) return 'mobile';
  return 'desktop';
};

export const logAuthEvent = async ({ event, email, userId }: LogParams): Promise<void> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    // keepalive:true lets the request finish even after navigation/unload,
    // which is required for the `logout` event (page replaces immediately).
    await fetch(`${SUPABASE_URL}/functions/v1/log-auth-event`, {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({
        event,
        email: email ?? null,
        user_id: userId ?? null,
        device_type: detectDevice(),
      }),
    });
  } catch (e) {
    // Silent — never break the auth flow because logging failed.
    console.debug('[auth-log] failed:', e);
  }
};
