import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminAlertBannerProps {
  isRTL: boolean;
  status: 'ok' | 'warning' | 'error' | 'checking';
  message: string;
}

const AdminAlertBanner = ({ isRTL, status, message }: AdminAlertBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || status === 'ok' || status === 'checking') return null;

  const isError = status === 'error';

  return (
    <div className={cn(
      'sticky top-0 z-50 px-4 py-3 flex items-center gap-3 text-sm font-medium shadow-md',
      isError
        ? 'bg-destructive text-destructive-foreground'
        : 'bg-amber-500 text-amber-950',
      isRTL && 'flex-row-reverse font-cairo'
    )}>
      <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
      <span className="flex-1">
        {message || (isRTL
          ? 'تنبيه: رصيد العمليات منخفض جداً! اضغط هنا للشحن'
          : 'Alerte : Solde API très bas ! Rechargez immédiatement.'
        )}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 shrink-0',
          isError ? 'text-destructive-foreground hover:bg-destructive/80' : 'text-amber-950 hover:bg-amber-400'
        )}
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default AdminAlertBanner;
