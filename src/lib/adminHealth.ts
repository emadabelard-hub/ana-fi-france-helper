import { supabase } from '@/integrations/supabase/client';

export type AdminSystemStatus = 'checking' | 'ok' | 'warning' | 'error';

export interface AdminSystemHealthResult {
  status: AdminSystemStatus;
  message: string;
  responseTime: number;
}

const HEALTH_TIMEOUT_MS = 8000;

const getSyncMessage = (isRTL: boolean) =>
  isRTL ? '⏳ جاري مزامنة جلسة المدير...' : '⏳ Synchronisation de la session admin...';

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
    const token = session?.access_token;
    const userId = session?.user?.id;
    const responseTime = Date.now() - startTime;

    if (!token || !userId || session.user.is_anonymous) {
      return {
        status: 'checking',
        message: getSyncMessage(isRTL),
        responseTime,
      };
    }

    const [authResult, adminResult] = await withHealthTimeout(Promise.all([
      supabase.auth.getUser(token),
      supabase.rpc('is_admin', { _user_id: userId }),
    ]));

    const elapsed = Date.now() - startTime;

    if (authResult.error || !authResult.data.user) {
      return {
        status: 'checking',
        message: getSyncMessage(isRTL),
        responseTime: elapsed,
      };
    }

    if (adminResult.error) {
      return {
        status: 'warning',
        message: isRTL
          ? '⚠️ الجلسة متصلة لكن التحقق الإداري ما زال قيد المزامنة'
          : '⚠️ Session connectée, vérification admin encore en cours',
        responseTime: elapsed,
      };
    }

    if (adminResult.data !== true) {
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
        message: isRTL ? '⚠️ النظام بطيء - وقت الاستجابة مرتفع' : '⚠️ Système lent - temps de réponse élevé',
        responseTime: elapsed,
      };
    }

    return {
      status: 'ok',
      message: isRTL ? '✅ النظام جاهز ويعمل بشكل طبيعي' : '✅ Système opérationnel',
      responseTime: elapsed,
    };
  } catch (error) {
    const errStr = String((error as Error)?.message || error || '');

    if (errStr.includes('health-timeout')) {
      return {
        status: 'warning',
        message: isRTL ? '⚠️ الاتصال بطيء - أعد المحاولة بعد لحظة' : '⚠️ Connexion lente - réessayez dans un instant',
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
      status: 'error',
      message: isRTL ? '❌ خطأ في الاتصال' : '❌ Erreur de connexion',
      responseTime: Date.now() - startTime,
    };
  }
}