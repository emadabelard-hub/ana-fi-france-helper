import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Loader2, Flag, X } from 'lucide-react';
import {
  ANNONCE_REPORT_REASONS,
  MESSAGE_REPORT_REASONS,
  ReportType,
  canSubmitReport,
  markReportSubmitted,
} from '@/pages/opportunites/reports';

type Props = {
  open: boolean;
  onClose: () => void;
  reportType: ReportType;
  annonceId?: string;
  conversationId?: string;
  messageId?: string;
  reportedUserId?: string;
};

const NAVY = '#0F2A5E';
const GOLD_DARK = '#B8922A';
const GOLD_LIGHT = '#E2C060';

const ReportDialog = ({ open, onClose, reportType, annonceId, conversationId, messageId, reportedUserId }: Props) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  const fontFamily = isRTL ? "'Tajawal', system-ui, sans-serif" : "'Poppins', system-ui, sans-serif";

  if (!open) return null;

  const reasons = reportType === 'annonce' ? ANNONCE_REPORT_REASONS : MESSAGE_REPORT_REASONS;

  const heading =
    reportType === 'annonce'
      ? (isRTL ? 'الإبلاغ عن الإعلان' : 'Signaler cette annonce')
      : reportType === 'conversation'
      ? (isRTL ? 'الإبلاغ عن المحادثة' : 'Signaler la conversation')
      : (isRTL ? 'الإبلاغ عن الرسالة' : 'Signaler ce message');

  const reset = () => {
    setReason('');
    setDetails('');
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!reason) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'اختر سبب' : 'Motif requis',
      });
      return;
    }
    if (!canSubmitReport()) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'استنى لحظة' : 'Merci de patienter un instant',
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('opportunite_reports').insert({
        reporter_id: user.id,
        report_type: reportType,
        annonce_id: annonceId ?? null,
        conversation_id: conversationId ?? null,
        message_id: messageId ?? null,
        reported_user_id: reportedUserId ?? null,
        reason,
        details: details.trim().slice(0, 1000) || null,
        status: 'pending',
      });
      if (error) {
        // Duplicate: friendly message.
        if ((error as any).code === '23505') {
          toast({
            title: isRTL ? 'تم الإبلاغ من قبل' : 'Signalement déjà envoyé',
            description: isRTL ? 'شكراً، بلاغك تم استلامه.' : 'Merci, votre signalement a déjà été enregistré.',
          });
          markReportSubmitted();
          close();
          return;
        }
        throw error;
      }
      markReportSubmitted();
      toast({
        title: isRTL ? '✅ تم إرسال البلاغ' : '✅ Signalement envoyé',
        description: isRTL ? 'شكراً على مساعدتنا.' : 'Merci de nous aider à modérer la plateforme.',
      });
      close();
    } catch (err) {
      console.error('report insert error', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'فشل الإرسال' : 'Envoi impossible',
        description: err instanceof Error ? err.message : 'Erreur',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      style={{ fontFamily }}
      onClick={close}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn('flex items-center justify-between px-5 pt-5 pb-3', isRTL && 'flex-row-reverse')}>
          <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: '#FDECEC', color: '#B91C1C' }}
            >
              <Flag size={16} />
            </div>
            <h3 className="text-[15px] font-extrabold" style={{ color: NAVY }}>
              {heading}
            </h3>
          </div>
          <button
            onClick={close}
            aria-label="close"
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div className="space-y-1.5">
            <label className={cn('block text-[12px] font-bold', isRTL ? 'text-right' : 'text-left')} style={{ color: NAVY }}>
              {isRTL ? 'السبب' : 'Motif du signalement'}
            </label>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer text-[12px]',
                    reason === r.value ? 'border-transparent' : 'border-gray-200',
                    isRTL && 'flex-row-reverse text-right',
                  )}
                  style={reason === r.value ? { background: '#FEF3F2', borderColor: '#B91C1C', color: '#B91C1C', fontWeight: 700 } : { color: NAVY }}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-red-600"
                  />
                  <span>{isRTL ? r.ar : r.fr}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={cn('block text-[12px] font-bold', isRTL ? 'text-right' : 'text-left')} style={{ color: NAVY }}>
              {isRTL ? 'اشرح المشكلة باختصار (اختياري)' : 'Expliquez brièvement le problème (facultatif)'}
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              rows={4}
              maxLength={1000}
              placeholder={isRTL ? 'اكتب هنا…' : 'Décrivez le problème…'}
              className={cn(
                'w-full rounded-xl border p-2.5 text-[13px] outline-none resize-none',
                isRTL ? 'text-right' : 'text-left',
              )}
              style={{ borderColor: '#E5E9F0' }}
            />
            <p className={cn('text-[10px] text-gray-500', isRTL ? 'text-right' : 'text-left')}>
              {details.length}/1000
            </p>
          </div>

          <div className={cn('flex items-center gap-2 pt-1', isRTL && 'flex-row-reverse')}>
            <button
              onClick={close}
              disabled={saving}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-bold border active:scale-[0.98] transition disabled:opacity-60"
              style={{ borderColor: '#E5E9F0', color: NAVY, background: 'white' }}
            >
              {isRTL ? 'إلغاء' : 'Annuler'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !reason}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-extrabold active:scale-[0.98] transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`, color: NAVY }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isRTL ? 'إرسال البلاغ' : 'Envoyer le signalement'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDialog;
