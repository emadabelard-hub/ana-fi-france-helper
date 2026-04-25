import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText, Check } from 'lucide-react';

interface CVDraftResumeModalProps {
  open: boolean;
  onResume: () => void;
  onStartFresh: () => void;
  onClose?: () => void;
  savedAt: number;
}

const formatRelativeTime = (timestamp: number, isRTL: boolean): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  if (minutes < 1) return isRTL ? 'دلوقتي' : 'à l’instant';
  if (minutes < 60) return isRTL ? `من ${minutes} دقيقة` : `il y a ${minutes} min`;
  if (hours < 24) return isRTL ? `من ${hours} ساعة` : `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return isRTL ? `من ${days} يوم` : `il y a ${days} j`;
};

const CVDraftResumeModal = ({ open, onResume, onStartFresh, onClose, savedAt }: CVDraftResumeModalProps) => {
  const { isRTL } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose?.(); }}>
      <DialogContent className={cn('max-w-md', isRTL && 'font-cairo')}>
        <DialogHeader>
          <DialogTitle className={cn('text-base', isRTL && 'text-right font-cairo')}>
            {isRTL ? '🔄 عندك CV لسه مكملتش' : '🔄 Vous avez un CV en cours'}
          </DialogTitle>
          <DialogDescription className={cn('text-sm', isRTL && 'text-right font-cairo')}>
            {isRTL ? 'تكمل من حيث وقفت؟' : 'Reprendre où vous vous êtes arrêté ?'}
          </DialogDescription>
        </DialogHeader>

        <div className={cn(
          'rounded-lg border p-3 flex items-center gap-3 mt-2',
          'border-emerald-500/30 bg-emerald-500/5',
          isRTL && 'flex-row-reverse text-right',
        )}>
          <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0 bg-primary/15 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{isRTL ? 'CV' : 'CV'}</div>
            <div className="text-xs text-muted-foreground">{formatRelativeTime(savedAt, isRTL)}</div>
          </div>
        </div>

        <div className={cn('flex gap-2 mt-3', isRTL && 'flex-row-reverse')}>
          <Button onClick={onResume} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Check className="h-4 w-4 mr-1" />
            {isRTL ? 'أيوه كمّل' : 'Reprendre'}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onStartFresh}>
            🗑️ {isRTL ? 'لا ابدأ من أول' : 'Recommencer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CVDraftResumeModal;
