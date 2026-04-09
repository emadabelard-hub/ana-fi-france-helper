import { supabase } from '@/integrations/supabase/client';
import { isAuthenticatedSession, normalizeEmail, PRIMARY_ADMIN_EMAIL } from '@/lib/auth';

export type AdminSystemStatus = 'checking' | 'ok' | 'warning' | 'error';

export interface AdminSystemHealthResult {
  status: AdminSystemStatus;
  message: string;
  responseTime: number;
}

const HEALTH_TIMEOUT_MS = 8000;

const getSyncMessage = (isRTL: boolean) =>
  isRTL ? '⏳ جاري مزامنة جلسة المدير...' : '⏳ Synchronisation de la session admin...';

const getReadyMessage = (isRTL: boolean) =>
  isRTL ? '✅ جلسة المدير مستقرة' : '✅ Session admin stable';

const getSlowMessage = (isRTL: boolean) =>
  isRTL ? '⚠️ الجلسة مستقرة لكن التحقق بطيء قليلاً' : '⚠️ Session stable mais vérification un peu lente';

const getRoleSyncMessage = (isRTL: boolean) =>
  isRTL ? '⚠️ الجلسة صالحة لكن التحقق الإضافي ما زال جارياً' : '⚠️ Session valide, vérification complémentaire en cours';

const getDegradedMessage = (isRTL: boolean) =>
  isRTL ? '⚠️ الجلسة صالحة لكن فحص الصحة مؤقتاً غير متاح' : '⚠️ Session valide, contrôle de santé temporairement indisponible';

const withHealthTimeout = async <T>(operation: Promise<T>): Promise<T> => {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error('health-timeout'));
        }, HEALTH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
};

export async function checkAdminSystemHealth(isRTL: boolean): Promise<AdminSystemHealthResult> {
  const startTime = Date.now();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const responseTime = Date.now() - startTime;

    if (!session || !isAuthenticatedSession(session) || !session.user) {
      return {
        status: 'checking',
        message: getSyncMessage(isRTL),
        responseTime,
      };
    }

    if (session.user.email && normalizeEmail(session.user.email) === PRIMARY_ADMIN_EMAIL) {
      return {
        status: responseTime > 5000 ? 'warning' : 'ok',
        message: responseTime > 5000 ? getSlowMessage(isRTL) : getReadyMessage(isRTL),
        responseTime,
      };
    }

    const { data: isAdmin, error: adminError } = await withHealthTimeout(
      supabase.rpc('is_admin', { _user_id: session.user.id })
    );

    const elapsed = Date.now() - startTime;

    if (adminError) {
      return {
        status: 'warning',
        message: getRoleSyncMessage(isRTL),
        responseTime: elapsed,
      };
    }

    if (isAdmin !== true) {
      return {
        status: 'warning',
        message: isRTL
          ? '⚠️ الجلسة صالحة لكن صلاحيات المدير لم تُؤكَّد بعد'
          : '⚠️ Session valide, droits admin pas encore confirmés',
        responseTime: elapsed,
      };
    }

    if (elapsed > 5000) {
      return {
        status: 'warning',
        message: getSlowMessage(isRTL),
        responseTime: elapsed,
      };
    }

    return {
      status: 'ok',
      message: getReadyMessage(isRTL),
      responseTime: elapsed,
    };
  } catch (error) {
    const errStr = String((error as Error)?.message || error || '');

    if (errStr.includes('health-timeout')) {
      return {
        status: 'warning',
        message: getSlowMessage(isRTL),
        responseTime: Date.now() - startTime,
      };
    }

    if (errStr.toLowerCase().includes('session') || errStr.toLowerCase().includes('jwt')) {
      return {
        status: 'checking',
        message: getSyncMessage(isRTL),
        responseTime: Date.now() - startTime,
      };
    }

    return {
      status: 'warning',
      message: getDegradedMessage(isRTL),
      responseTime: Date.now() - startTime,
    };
  }
}