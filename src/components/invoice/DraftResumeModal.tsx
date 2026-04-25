import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText, Receipt, Trash2, Check, AlertTriangle } from 'lucide-react';
import {
  listAvailableDrafts,
  clearCurrentDocument,
  type AvailableDraftSummary,
} from '@/lib/invoiceDraftStorage';

interface DraftResumeModalProps {
  /** When true the page wants the user to pick a draft to resume.
   *  Modal stays hidden if no drafts are available. */
  open: boolean;
  /** Called with the chosen draft type ('devis' | 'facture'). */
  onResume: (type: 'devis' | 'facture') => void;
  /** Called after user discarded all drafts. */
  onStartFresh: () => void;
  /** Called when modal is closed without action (e.g. Escape). */
  onClose?: () => void;
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

const DraftResumeModal = ({ open, onResume, onStartFresh, onClose }: DraftResumeModalProps) => {
  const { isRTL } = useLanguage();
  const [drafts, setDrafts] = useState<AvailableDraftSummary[]>([]);

  // Refresh the list each time the modal is opened so we always show the
  // latest auto-saved snapshot.
  useEffect(() => {
    if (!open) return;
    setDrafts(listAvailableDrafts());
  }, [open]);

  const visibleDrafts = useMemo(() => drafts, [drafts]);

  // Nothing to resume → don't show the dialog at all.
  if (!open || visibleDrafts.length === 0) return null;

  const handleDiscardAll = () => {
    visibleDrafts.forEach((d) => clearCurrentDocument(d.documentType));
    onStartFresh();
  };

  const handleDiscardOne = (type: 'devis' | 'facture') => {
    clearCurrentDocument(type);
    setDrafts((prev) => prev.filter((d) => d.documentType !== type));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose?.();
      }}
    >
      <DialogContent className={cn('max-w-md', isRTL && 'font-cairo')}>
        <DialogHeader>
          <DialogTitle className={cn('text-base', isRTL && 'text-right font-cairo')}>
            {isRTL
              ? '🔄 عندك دوفي لسه مكملتش'
              : '🔄 Vous avez un document en cours'}
          </DialogTitle>
          <DialogDescription className={cn('text-sm', isRTL && 'text-right font-cairo')}>
            {isRTL
              ? 'تكمل من حيث وقفت؟'
              : 'Reprendre où vous vous êtes arrêté ?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 mt-2">
          {visibleDrafts.map((draft) => {
            const isDevis = draft.documentType === 'devis';
            const Icon = isDevis ? FileText : Receipt;
            const typeLabel = isRTL
              ? isDevis ? 'دوفي (عرض سعر)' : 'فاتورة'
              : isDevis ? 'Devis' : 'Facture';
            return (
              <div
                key={draft.documentType}
                className={cn(
                  'rounded-lg border p-3 flex items-center gap-3',
                  draft.isStale
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-emerald-500/30 bg-emerald-500/5',
                  isRTL && 'flex-row-reverse text-right',
                )}
              >
                <div
                  className={cn(
                    'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
                    isDevis
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                      : 'bg-primary/15 text-primary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-semibold flex items-center gap-1.5', isRTL && 'flex-row-reverse')}>
                    <span>{typeLabel}</span>
                    {draft.isStale && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" />
                        {isRTL ? 'قديم' : 'ancien'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {draft.clientName || (isRTL ? 'بدون اسم زبون' : 'Client non renseigné')}
                    {' · '}
                    {isRTL ? `${draft.itemsCount} بند` : `${draft.itemsCount} ligne(s)`}
                    {' · '}
                    {formatRelativeTime(draft.savedAt, isRTL)}
                  </div>
                </div>
                <div className={cn('flex flex-col gap-1.5', isRTL && 'items-start')}>
                  <Button
                    size="sm"
                    onClick={() => onResume(draft.documentType)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-2.5 text-xs"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {isRTL ? 'أيوه كمّل' : 'Reprendre'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDiscardOne(draft.documentType)}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {isRTL ? 'امسح' : 'Effacer'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className={cn('flex gap-2 mt-3', isRTL && 'flex-row-reverse')}>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDiscardAll}
          >
            🗑️ {isRTL ? 'لا ابدأ من أول' : 'Tout effacer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DraftResumeModal;
