import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'afi_session_id';
const IP_KEY = 'afi_user_ip';

async function getUserIp(): Promise<string | null> {
  const cached = sessionStorage.getItem(IP_KEY);
  if (cached) return cached;
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    if (data?.ip) {
      sessionStorage.setItem(IP_KEY, data.ip);
      return data.ip;
    }
  } catch { /* silent */ }
  return null;
}

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function getDeviceInfo(): string {
  const w = window.innerWidth;
  return w < 768 ? 'Mobile' : w < 1024 ? 'Tablette' : 'Desktop';
}

const PAGE_LABELS: Record<string, string> = {
  '/': 'الرئيسية',
  '/home': 'الرئيسية',
  '/news': 'الأخبار',
  '/profile': 'حسابي',
  '/pro': 'أدوات Pro',
  '/pro/invoice-creator': 'الفاتورة / الدوفي',
  '/pro/quote-to-invoice': 'تحويل دوفي لفاتورة',
  '/pro/admin-assistant': 'مساعد إداري Pro',
  '/pro/cv-generator': 'مُولد CV',
  '/pro/settings': 'إعدادات Pro',
  '/pro/peinture': 'دوفي بانتير',
  '/ai-assistant': 'شبيك لبيك',
  '/premium-consultation': 'استشارة مميزة',
  '/consultations': 'استشارات',
  '/language-school': 'مدرسة اللغة',
  '/universal-admin-assistant': 'المساعد الإداري',
  '/service-request': 'طلب خدمة',
  '/admin': 'لوحة التحكم',
  '/legal': 'قانوني',
};

const useActivityTracker = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const enterTimeRef = useRef<number>(Date.now());
  const lastPageRef = useRef<string>(pathname);

  const logActivity = useCallback(async (
    action: string,
    page: string,
    sessionId: string,
    durationSeconds: number | null
  ) => {
    try {
      const ip = await getUserIp();
      await supabase.from('user_activity_logs').insert({
        user_id: user?.id || null,
        user_email: user?.email || null,
        is_guest: !user,
        page,
        action,
        session_id: sessionId,
        duration_seconds: durationSeconds,
        device_info: getDeviceInfo(),
        ip_address: ip,
        metadata: {},
      } as any);
    } catch {
      // Silent fail
    }
  }, [user]);

  // Log page view on route change
  useEffect(() => {
    const sessionId = getSessionId();
    const pageLabel = PAGE_LABELS[pathname] || pathname;

    // Send duration for previous page
    const now = Date.now();
    const durationSec = Math.round((now - enterTimeRef.current) / 1000);
    if (lastPageRef.current !== pathname && durationSec > 0) {
      const prevLabel = PAGE_LABELS[lastPageRef.current] || lastPageRef.current;
      logActivity('page_exit', prevLabel, sessionId, durationSec);
    }

    enterTimeRef.current = now;
    lastPageRef.current = pathname;

    logActivity('page_view', pageLabel, sessionId, null);
  }, [pathname, user, logActivity]);

  // Log session end on tab close
  useEffect(() => {
    const handleUnload = () => {
      const sessionId = getSessionId();
      const durationSec = Math.round((Date.now() - enterTimeRef.current) / 1000);
      const pageLabel = PAGE_LABELS[lastPageRef.current] || lastPageRef.current;

      const ip = sessionStorage.getItem(IP_KEY) || null;
      const payload = JSON.stringify({
        user_id: user?.id || null,
        user_email: user?.email || null,
        is_guest: !user,
        page: pageLabel,
        action: 'session_end',
        session_id: sessionId,
        duration_seconds: durationSec,
        device_info: getDeviceInfo(),
        ip_address: ip,
        metadata: {},
      });

      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_activity_logs`;
      navigator.sendBeacon(
        url + `?apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        new Blob([payload], { type: 'application/json' })
      );
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  // Expose a function to log custom feature actions
  const trackFeatureClick = useCallback((featureName: string) => {
    const sessionId = getSessionId();
    logActivity('feature_click', featureName, sessionId, null);
  }, [logActivity]);

  return { trackFeatureClick };
};

export default useActivityTracker;
