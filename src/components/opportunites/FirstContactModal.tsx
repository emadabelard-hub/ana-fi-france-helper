import { useState } from 'react';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { markFirstContactSeen } from '@/pages/opportunites/firstContactNotice';

type Props = {
  open: boolean;
  onConfirm: (dontShowAgain: boolean) => void;
};

const FirstContactModal = ({ open, onConfirm }: Props) => {
  const { isRTL } = useLanguage();
  const [dont, setDont] = useState(true);
  if (!open) return null;

  const submit = () => {
    if (dont) markFirstContactSeen();
    onConfirm(dont);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={submit}>
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3"
      >
        <div className={cn('inline-flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#EEF2F8' }}>
            <Shield size={18} color="#0F2A5E" />
          </div>
          <h2 className="text-[14px] font-extrabold" style={{ color: '#0F2A5E' }}>
            {isRTL ? 'مراسلة آمنة' : 'Messagerie sécurisée'}
          </h2>
        </div>
        <p className={cn('text-[13px] leading-relaxed text-gray-700', isRTL ? 'text-right' : 'text-left')}>
          {isRTL
            ? 'جميع المراسلات تتم فقط عبر رسائل ANAFYPRO. بياناتك الشخصية لا تظهر تلقائياً.'
            : "Les échanges s'effectuent uniquement via la messagerie sécurisée ANAFYPRO. Vos coordonnées personnelles ne sont jamais affichées automatiquement."}
        </p>
        <label className={cn('flex items-center gap-2 text-[12px] text-gray-700', isRTL && 'flex-row-reverse')}>
          <input
            type="checkbox"
            checked={dont}
            onChange={(e) => setDont(e.target.checked)}
            className="w-4 h-4"
          />
          {isRTL ? 'لا تعرض هذه الرسالة مرة أخرى' : 'Ne plus afficher ce message'}
        </label>
        <button
          onClick={submit}
          className="w-full rounded-xl py-2.5 font-extrabold text-[13px] active:scale-[0.98] transition"
          style={{ background: '#0F2A5E', color: 'white' }}
        >
          {isRTL ? 'فهمت، أكمل' : "J'ai compris, continuer"}
        </button>
      </div>
    </div>
  );
};

export default FirstContactModal;
