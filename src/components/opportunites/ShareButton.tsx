import { useState } from 'react';
import { Share2, Copy, Check, MessageCircle, Facebook, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Props = {
  annonceId: string;
  reference?: string | null;
  title?: string | null;
  variant?: 'card' | 'hero';
  className?: string;
};

const buildUrl = (annonceId: string) => {
  try { return `${window.location.origin}/opportunites/annonces/${annonceId}`; }
  catch { return `/opportunites/annonces/${annonceId}`; }
};

const ShareButton = ({ annonceId, reference, title, variant = 'card', className }: Props) => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = buildUrl(annonceId);
  const shareTitle = title || (isRTL ? 'إعلان ANAFYPRO' : 'Annonce ANAFYPRO');
  const shareText = reference
    ? (isRTL ? `شوف الإعلان (رقم ${reference}) على ANAFYPRO` : `Découvrez cette annonce (Réf. ${reference}) sur ANAFYPRO`)
    : (isRTL ? 'شوف الإعلان دي على ANAFYPRO' : 'Découvrez cette annonce sur ANAFYPRO');

  const recordShare = () => {
    supabase.rpc('increment_annonce_shares', { _annonce_id: annonceId })
      .then(({ error }) => { if (error) console.warn('share incr', error); });
  };

  const nativeShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({ title: shareTitle, text: shareText, url });
        recordShare();
        return;
      } catch { /* user cancelled */ }
    }
    setOpen(true);
  };

  const shareWhatsApp = () => {
    const link = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
    window.open(link, '_blank', 'noopener,noreferrer');
    recordShare();
    setOpen(false);
  };
  const shareFacebook = () => {
    const link = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(link, '_blank', 'noopener,noreferrer');
    recordShare();
    setOpen(false);
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: isRTL ? 'تم نسخ الرابط' : 'Lien copié' });
      recordShare();
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const size = variant === 'hero' ? 18 : 16;
  const cls = variant === 'hero'
    ? 'rounded-full p-2 bg-white/10 border border-white/20 text-white'
    : 'rounded-full p-1.5 bg-white border';

  return (
    <>
      <button
        type="button"
        onClick={nativeShare}
        aria-label={isRTL ? 'مشاركة' : 'Partager'}
        className={cn(cls, 'active:scale-[0.9] transition inline-flex items-center justify-center', className)}
        style={variant === 'card' ? { borderColor: '#E5E9F0' } : undefined}
      >
        <Share2 size={size} color={variant === 'hero' ? '#FFFFFF' : '#0F2A5E'} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        >
          <div
            dir={isRTL ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-extrabold" style={{ color: '#0F2A5E' }}>
                {isRTL ? 'مشاركة الإعلان' : "Partager l'annonce"}
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={shareWhatsApp}
                className="rounded-xl border p-3 flex flex-col items-center gap-1 text-[11px] font-bold active:scale-[0.98]"
                style={{ borderColor: '#E5E9F0', color: '#0F2A5E' }}
              >
                <MessageCircle size={22} color="#25D366" />
                WhatsApp
              </button>
              <button
                onClick={shareFacebook}
                className="rounded-xl border p-3 flex flex-col items-center gap-1 text-[11px] font-bold active:scale-[0.98]"
                style={{ borderColor: '#E5E9F0', color: '#0F2A5E' }}
              >
                <Facebook size={22} color="#1877F2" />
                Facebook
              </button>
              <button
                onClick={copyLink}
                className="rounded-xl border p-3 flex flex-col items-center gap-1 text-[11px] font-bold active:scale-[0.98]"
                style={{ borderColor: '#E5E9F0', color: '#0F2A5E' }}
              >
                {copied ? <Check size={22} color="#059669" /> : <Copy size={22} color="#0F2A5E" />}
                {isRTL ? 'نسخ الرابط' : 'Copier le lien'}
              </button>
            </div>
            <p className="mt-3 text-[10px] text-gray-500 break-all" dir="ltr">{url}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ShareButton;
