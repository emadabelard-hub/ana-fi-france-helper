import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Loader2, MessageCircle, Inbox } from 'lucide-react';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

type ConvRow = {
  id: string;
  annonce_id: string;
  owner_id: string;
  contact_user_id: string;
  status: string;
  last_message_at: string;
  opportunite_annonces?: { title: string; type: string } | null;
};

const formatDate = (iso: string, isRTL: boolean) => {
  try {
    return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
};

const MessagesListPage = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConvRow[]>([]);

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/login', { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    let alive = true;
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunite_conversations')
        .select('id,annonce_id,owner_id,contact_user_id,status,last_message_at, opportunite_annonces(title,type)')
        .or(`owner_id.eq.${user.id},contact_user_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })
        .limit(200);
      if (!alive) return;
      if (error) console.error('messages list error', error);
      setRows((data as any) || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: COLORS.pageBg, fontFamily }}
    >
      <section
        className="px-5 pt-6 pb-6"
        style={{
          background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%)`,
          color: 'white',
        }}
      >
        <button
          onClick={() => navigate('/opportunites')}
          className={cn('inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85 hover:text-white', isRTL && 'flex-row-reverse')}
        >
          <BackIcon size={14} />
          {isRTL ? 'الفرص المهنية' : 'Opportunités'}
        </button>
        <h1 className={cn('mt-3 text-[20px] font-extrabold leading-tight inline-flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <MessageCircle size={20} />
          {isRTL ? 'الرسائل' : 'Messages'}
        </h1>
      </section>

      <div className="px-4 mt-4 pb-10">
        {loading || authLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: COLORS.navyDark }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm border text-center space-y-3" style={{ borderColor: '#E5E9F0' }}>
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: '#EEF2F8' }}>
              <Inbox size={22} style={{ color: COLORS.navyDark }} />
            </div>
            <p className="text-[13px] font-bold" style={{ color: COLORS.navyDark }}>
              {isRTL ? 'مفيش رسائل لسه.' : 'Aucun message pour le moment.'}
            </p>
            <p className="text-[11px] text-gray-600">
              {isRTL
                ? 'الرسائل بينك وبين أصحاب الإعلانات هتظهر هنا.'
                : 'Vos échanges avec les auteurs des annonces apparaîtront ici.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const isOwner = user && r.owner_id === user.id;
              const roleLabel = isOwner
                ? (isRTL ? 'رسالة واردة' : 'Message reçu')
                : (isRTL ? 'محادثة أنت بدأتها' : 'Conversation initiée');
              const title = r.opportunite_annonces?.title || (isRTL ? 'إعلان' : 'Annonce');
              return (
                <button
                  key={r.id}
                  onClick={() => navigate(`/opportunites/messages/${r.id}`)}
                  className="w-full rounded-2xl bg-white p-3 shadow-sm border text-left active:scale-[0.99] transition"
                  style={{ borderColor: '#E5E9F0' }}
                >
                  <div className={cn('flex items-start gap-3', isRTL && 'flex-row-reverse')}>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})` }}
                    >
                      <MessageCircle size={18} style={{ color: COLORS.navyDark }} />
                    </div>
                    <div className={cn('flex-1 min-w-0', isRTL ? 'text-right' : 'text-left')}>
                      <div className={cn('flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: '#EEF2F8', color: COLORS.navyDark }}
                        >
                          {roleLabel}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatDate(r.last_message_at, isRTL)}</span>
                      </div>
                      <h3 className="text-[13px] font-extrabold mt-1 line-clamp-1" style={{ color: COLORS.navyDark }}>
                        {title}
                      </h3>
                      {r.status !== 'active' && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {isRTL ? 'محادثة مغلقة' : 'Conversation fermée'}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesListPage;
