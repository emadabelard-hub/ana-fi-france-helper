// Fire-and-forget logger for authentication events. The edge function
// `log-auth-event` writes the entry with the service_role key; failures
// must never block the user-facing sign-in / sign-out flow.
import { supabase } from '@/integrations/supabase/client';

type AuthEvent = 'login_success' | 'login_failure' | 'logout' | 'blocked';

interface LogParams {
  event: AuthEvent;
  email?: string | null;
  userId?: string | null;
}

const detectDevice = (): 'mobile' | 'tablet' | 'desktop' | 'unknown' => {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|iphone|android.*mobile|phone/.test(ua)) return 'mobile';
  return 'desktop';
};

export const logAuthEvent = async ({ event, email, userId }: LogParams): Promise<void> => {
  try {
    await supabase.functions.invoke('log-auth-event', {
      body: {
        event,
        email: email ?? null,
        user_id: userId ?? null,
        device_type: detectDevice(),
      },
    });
  } catch (e) {
    // Silent — never break the auth flow because logging failed.
    console.debug('[auth-log] failed:', e);
  }
};
