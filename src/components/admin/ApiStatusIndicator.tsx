import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type ApiStatus = 'checking' | 'ok' | 'warning' | 'error';

const ApiStatusIndicator = ({ isRTL }: { isRTL: boolean }) => {
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setStatus('checking');
    try {
      // Test the AI gateway via a lightweight edge function call
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: [{ role: 'user', content: 'ping' }],
          language: 'fr',
        },
      });

      if (error) {
        const errMsg = error.message || '';
        if (errMsg.includes('402') || errMsg.includes('insufficient_quota') || errMsg.includes('Payment')) {
          setStatus('warning');
          setMessage(isRTL
            ? '⚠️ تنبيه: رصيد العمليات منخفض، يرجى شحن الحساب لضمان استمرار الخدمة.'
            : '⚠️ Alerte : Solde API bas, veuillez recharger pour garantir le service.');
        } else if (errMsg.includes('429') || errMsg.includes('rate')) {
          setStatus('warning');
          setMessage(isRTL ? '⚠️ حد الطلبات مرتفع، حاول لاحقاً' : '⚠️ Limite de requêtes atteinte');
        } else {
          setStatus('error');
          setMessage(isRTL ? '❌ خطأ في الاتصال بالنظام' : '❌ Erreur de connexion au système');
        }
      } else {
        setStatus('ok');
        setMessage(isRTL ? '✅ النظام جاهز' : '✅ Système opérationnel');
      }
    } catch (err: any) {
      const errStr = String(err?.message || err || '');
      if (errStr.includes('402') || errStr.includes('quota')) {
        setStatus('warning');
        setMessage(isRTL
          ? '⚠️ تنبيه: رصيد العمليات منخفض، يرجى شحن الحساب لضمان استمرار الخدمة.'
          : '⚠️ Alerte : Solde API bas, veuillez recharger.');
      } else {
        setStatus('error');
        setMessage(isRTL ? '❌ خطأ في الاتصال' : '❌ Erreur de connexion');
      }
    } finally {
      setIsChecking(false);
    }
  }, [isRTL]);

  useEffect(() => {
    checkStatus();
    // Re-check every 5 minutes
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const dotColor = {
    checking: 'bg-muted-foreground animate-pulse',
    ok: 'bg-emerald-500',
    warning: 'bg-amber-500 animate-pulse',
    error: 'bg-red-500 animate-pulse',
  }[status];

  const StatusIcon = {
    checking: RefreshCw,
    ok: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
  }[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkStatus}
          disabled={isChecking}
          className={cn(
            'gap-2 h-8 px-2 text-xs',
            isRTL && 'flex-row-reverse font-cairo'
          )}
        >
          <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', dotColor)} />
          <StatusIcon className={cn('h-3.5 w-3.5', isChecking && 'animate-spin')} />
          <span className="hidden sm:inline">
            {isRTL ? 'حالة النظام' : 'API Status'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className={cn('max-w-[280px]', isRTL && 'font-cairo text-right')}>
        <p className="text-xs">{message || (isRTL ? 'جاري الفحص...' : 'Vérification...')}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default ApiStatusIndicator;
