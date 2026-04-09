import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { checkAdminSystemHealth, type AdminSystemStatus } from '@/lib/adminHealth';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type ApiStatus = AdminSystemStatus;

const ApiStatusIndicator = ({ isRTL }: { isRTL: boolean }) => {
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [message, setMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setStatus('checking');

    try {
      const result = await checkAdminSystemHealth(isRTL);
      setStatus(result.status);
      setMessage(result.message);
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
