import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { checkAdminSystemHealth, type AdminSystemStatus } from '@/lib/adminHealth';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Activity, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type ApiStatus = AdminSystemStatus;

interface SystemHealthCardProps {
  isRTL: boolean;
  onStatusChange?: (status: ApiStatus, message: string) => void;
}

const SystemHealthCard = ({ isRTL, onStatusChange }: SystemHealthCardProps) => {
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [message, setMessage] = useState('');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setStatus('checking');

    try {
      const result = await checkAdminSystemHealth(isRTL);

      setResponseTime(result.responseTime);
      setLastChecked(new Date());
      setStatus(result.status);
      setMessage(result.message);
      onStatusChange?.(result.status, result.message);
    } finally {
      setIsChecking(false);
    }
  }, [isRTL, onStatusChange]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const statusConfig = {
    checking: {
      color: 'bg-muted-foreground',
      bgColor: 'bg-muted/50',
      borderColor: 'border-muted',
      icon: RefreshCw,
      label: isRTL ? 'جاري الفحص...' : 'Vérification...',
      badgeVariant: 'secondary' as const,
    },
    ok: {
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      icon: CheckCircle2,
      label: isRTL ? 'نشط' : 'Actif',
      badgeVariant: 'default' as const,
    },
    warning: {
      color: 'bg-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      icon: AlertTriangle,
      label: isRTL ? 'تحذير' : 'Alerte',
      badgeVariant: 'secondary' as const,
    },
    error: {
      color: 'bg-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      icon: XCircle,
      label: isRTL ? 'خطأ' : 'Erreur',
      badgeVariant: 'destructive' as const,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className={cn('border-2 transition-colors duration-300', config.borderColor)}>
      <CardHeader className="pb-3">
        <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
          <CardTitle className={cn('text-base flex items-center gap-2', isRTL && 'flex-row-reverse font-cairo')}>
            <Activity className="h-5 w-5 text-primary" />
            {isRTL ? 'صحة النظام' : 'Santé du Système'}
          </CardTitle>
          <Badge variant={config.badgeVariant} className={cn('gap-1', isRTL && 'flex-row-reverse font-cairo')}>
            <span className={cn('h-2 w-2 rounded-full', config.color, status !== 'ok' && 'animate-pulse')} />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status message */}
        <div className={cn('p-3 rounded-lg text-sm', config.bgColor, isRTL && 'text-right font-cairo')}>
          <div className={cn('flex items-start gap-2', isRTL && 'flex-row-reverse')}>
            <StatusIcon className={cn('h-4 w-4 mt-0.5 shrink-0', isChecking && 'animate-spin')} />
            <p>{message || (isRTL ? 'جاري الفحص...' : 'Vérification...')}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className={cn('grid grid-cols-2 gap-3', isRTL && 'direction-rtl')}>
          <div className={cn('p-2 rounded-md bg-muted/50 text-center', isRTL && 'font-cairo')}>
            <p className="text-xs text-muted-foreground">{isRTL ? 'وقت الاستجابة' : 'Latence'}</p>
            <p className="text-sm font-semibold">
              {responseTime !== null ? `${responseTime}ms` : '—'}
            </p>
          </div>
          <div className={cn('p-2 rounded-md bg-muted/50 text-center', isRTL && 'font-cairo')}>
            <p className="text-xs text-muted-foreground">{isRTL ? 'الاتصال' : 'Connexion'}</p>
            <div className="flex items-center justify-center gap-1">
              {status === 'ok' || status === 'warning' ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              ) : status === 'error' ? (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              ) : (
                <Wifi className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
              )}
              <span className="text-sm font-semibold">
                {status === 'ok' ? (isRTL ? 'متصل' : 'OK') :
                 status === 'warning' ? (isRTL ? 'بطيء' : 'Lent') :
                 status === 'error' ? (isRTL ? 'منقطع' : 'Coupé') :
                 '...'}
              </span>
            </div>
          </div>
        </div>

        {/* Last checked + refresh */}
        <div className={cn('flex items-center justify-between text-xs text-muted-foreground', isRTL && 'flex-row-reverse font-cairo')}>
          <span>
            {lastChecked
              ? `${isRTL ? 'آخر فحص:' : 'Dernier check :'} ${lastChecked.toLocaleTimeString(isRTL ? 'ar' : 'fr-FR')}`
              : ''}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={isChecking}
            className={cn('gap-1.5 h-7 text-xs', isRTL && 'flex-row-reverse font-cairo')}
          >
            <RefreshCw className={cn('h-3 w-3', isChecking && 'animate-spin')} />
            {isRTL ? 'فحص يدوي' : 'Vérifier'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemHealthCard;
