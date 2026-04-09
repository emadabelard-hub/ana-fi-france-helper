import { supabase } from '@/integrations/supabase/client';

export type AdminSystemStatus = 'checking' | 'ok' | 'warning' | 'error';

export interface AdminSystemHealthResult {
  status: AdminSystemStatus;
  message: string;
  responseTime: number;
}

const getSyncMessage = (isRTL: boolean) =>
  isRTL ? '⏳ جاري مزامنة جلسة المدير...' : '⏳ Synchronisation de la session admin...';

export async function checkAdminSystemHealth(isRTL: boolean): Promise<AdminSystemHealthResult> {
  const startTime = Date.now();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const responseTime = Date.now() - startTime;

    if (!token) {
      return {
        status: 'checking',
        message: getSyncMessage(isRTL),
        responseTime,
      };
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'ping' }],
        language: 'fr',
      }),
    });

    const elapsed = Date.now() - startTime;

    if (response.status === 401) {
      return {
        status: 'checking',
        message: getSyncMessage(isRTL),
        responseTime: elapsed,
      };
    }

    if (!response.ok) {
      if (response.status === 402) {
        return {
          status: 'error',
          message: isRTL
            ? '⚠️ تنبيه: رصيد الذكاء الاصطناعي غير كافٍ.'
            : '⚠️ Alerte : crédits IA insuffisants.',
          responseTime: elapsed,
        };
      }

      if (response.status === 429) {
        return {
          status: 'warning',
          message: isRTL ? '⚠️ حد الطلبات مرتفع، حاول لاحقاً' : '⚠️ Limite de requêtes atteinte',
          responseTime: elapsed,
        };
      }

      return {
        status: 'error',
        message: isRTL ? '❌ خطأ في الاتصال بالنظام' : '❌ Erreur de connexion au système',
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

    if (errStr.includes('402') || errStr.toLowerCase().includes('quota')) {
      return {
        status: 'error',
        message: isRTL ? '⚠️ تنبيه: رصيد الذكاء الاصطناعي غير كافٍ.' : '⚠️ Alerte : crédits IA insuffisants.',
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