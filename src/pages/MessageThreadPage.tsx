import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Loader2, Send, Flag } from 'lucide-react';
import ReportDialog from '@/components/opportunites/ReportDialog';
import { ReportType } from './opportunites/reports';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

const MAX_LEN = 2000;

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  is_deleted: boolean;
  hidden_by_moderation?: boolean;
};

type Conversation = {
  id: string;
  annonce_id: string;
  owner_id: string;
  contact_user_id: string;
  status: string;
  opportunite_annonces?: { title: string; reference: string | null } | null;
};


const formatTime = (iso: string, isRTL: boolean) => {
  try {
    return new Date(iso).toLocaleString(isRTL ? 'ar-EG' : 'fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const MessageThreadPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<{ type: ReportType; messageId?: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/login', { replace: true });
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!id || !user) return;
    const [{ data: c, error: ec }, { data: m, error: em }] = await Promise.all([
      supabase.from('opportunite_conversations')
        .select('id,annonce_id,owner_id,contact_user_id,status, opportunite_annonces(title,reference)')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('opportunite_messages')
        .select('id,conversation_id,sender_id,content,created_at,read_at,is_deleted,hidden_by_moderation')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
        .limit(500),
    ]);
    if (ec) console.error('thread conv error', ec);
    if (em) console.error('thread msgs error', em);
    setConv((c as any) || null);
    setMessages((m as any) || []);
    setLoading(false);

    // Mark unread messages sent to me as read.
    if (m && user) {
      const unreadIds = (m as Message[])
        .filter((x) => !x.read_at && x.sender_id !== user.id)
        .map((x) => x.id);
      if (unreadIds.length > 0) {
        supabase.from('opportunite_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds)
          .then(({ error }) => { if (error) console.warn('mark read failed', error); });
      }
    }
  };

  useEffect(() => {
    if (user) { setLoading(true); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const isParticipant = !!(conv && user && (conv.owner_id === user.id || conv.contact_user_id === user.id));
  const canSend = !!(conv && conv.status === 'active' && isParticipant);

  const handleSend = async () => {
    if (!user || !conv || !canSend) return;
    const clean = draft.trim();
    if (clean.length < 1 || clean.length > MAX_LEN) return;

    setSending(true);
    try {
      const { error } = await supabase.from('opportunite_messages').insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content: clean,
      });
      if (error) throw error;
      setDraft('');
      await load();
    } catch (err) {
      console.error('send msg error', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'فشل الإرسال' : 'Envoi impossible',
        description: err instanceof Error ? err.message : 'Erreur',
      });
    } finally {
      setSending(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.pageBg, fontFamily }}
      >
        <Loader2 size={22} className="animate-spin" style={{ color: COLORS.navyDark }} />
      </div>
    );
  }

  if (!conv || !isParticipant) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: COLORS.pageBg, fontFamily }}
      >
        <p className="text-[14px] font-bold" style={{ color: COLORS.navyDark }}>
          {isRTL ? 'المحادثة غير متاحة' : 'Conversation indisponible'}
        </p>
        <button
          onClick={() => navigate('/opportunites/messages')}
          className="mt-4 rounded-xl px-4 py-2 font-extrabold text-[13px]"
          style={{ background: COLORS.goldDark, color: 'white' }}
        >
          {isRTL ? 'رجوع' : 'Retour'}
        </button>
      </div>
    );
  }

  const annonceTitle = conv.opportunite_annonces?.title || (isRTL ? 'إعلان' : 'Annonce');
  const annonceRef = conv.opportunite_annonces?.reference || null;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: COLORS.pageBg, fontFamily }}
    >
      <section
        className="px-5 pt-6 pb-4"
        style={{
          background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%)`,
          color: 'white',
        }}
      >
        <button
          onClick={() => navigate('/opportunites/messages')}
          className={cn('inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85 hover:text-white', isRTL && 'flex-row-reverse')}
        >
          <BackIcon size={14} />
          {isRTL ? 'الرسائل' : 'Messages'}
        </button>
        <h1 className={cn('mt-2 text-[16px] font-extrabold leading-tight line-clamp-1', isRTL ? 'text-right' : 'text-left')}>
          {annonceTitle}
        </h1>
        {annonceRef && (
          <p className={cn('mt-1 text-[10px] text-white/70 font-mono', isRTL ? 'text-right' : 'text-left')} dir="ltr">
            {isRTL ? `رقم الإعلان: ${annonceRef}` : `Réf. ${annonceRef}`}
          </p>
        )}

        <div className={cn('mt-1 flex items-center gap-3', isRTL && 'flex-row-reverse')}>
          <button
            onClick={() => navigate(`/opportunites/annonces/${conv.annonce_id}`)}
            className="text-[11px] text-white/80 underline"
          >
            {isRTL ? 'عرض الإعلان' : "Voir l'annonce"}
          </button>
          <button
            onClick={() => setReport({ type: 'conversation' })}
            className="text-[11px] text-white/80 underline inline-flex items-center gap-1"
          >
            <Flag size={11} />
            {isRTL ? 'الإبلاغ عن المحادثة' : 'Signaler la conversation'}
          </button>
        </div>
      </section>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-[12px] text-gray-500 py-10">
            {isRTL ? 'مفيش رسائل لسه.' : 'Aucun message.'}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user!.id;
            const hidden = !!m.hidden_by_moderation;
            return (
              <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                <div
                  className="max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line shadow-sm"
                  style={
                    hidden
                      ? { background: '#F3F4F6', color: '#6B7280', fontStyle: 'italic', border: '1px dashed #D1D5DB' }
                      : mine
                      ? { background: COLORS.navyDark, color: 'white' }
                      : { background: 'white', color: COLORS.navyDark, border: '1px solid #E5E9F0' }
                  }
                >
                  <div>
                    {hidden
                      ? (isRTL ? 'تم إخفاء الرسالة بواسطة الإدارة.' : 'Ce message a été masqué par la modération.')
                      : m.content}
                  </div>
                  <div className={cn('mt-1 text-[9px]', hidden ? 'text-gray-400' : mine ? 'text-white/70' : 'text-gray-500')}>
                    {formatTime(m.created_at, isRTL)}
                  </div>
                </div>
                {!mine && !hidden && (
                  <button
                    onClick={() => setReport({ type: 'message', messageId: m.id })}
                    className="mt-0.5 text-[9px] text-gray-400 hover:text-red-700 inline-flex items-center gap-1 underline"
                  >
                    <Flag size={9} />
                    {isRTL ? 'الإبلاغ عن الرسالة' : 'Signaler ce message'}
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t bg-white px-3 py-2 pb-[max(env(safe-area-inset-bottom),8px)]" style={{ borderColor: '#E5E9F0' }}>
        {conv.status !== 'active' ? (
          <p className="text-center text-[11px] text-gray-500 py-2">
            {isRTL ? 'المحادثة مغلقة.' : 'Conversation fermée.'}
          </p>
        ) : (
          <div className={cn('flex items-end gap-2', isRTL && 'flex-row-reverse')}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
              rows={1}
              placeholder={isRTL ? 'اكتب رسالتك…' : 'Écrire un message…'}
              className={cn(
                'flex-1 rounded-xl border bg-white p-2.5 text-[13px] outline-none resize-none max-h-32',
                isRTL ? 'text-right' : 'text-left',
              )}
              style={{ borderColor: '#E5E9F0' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || draft.trim().length === 0}
              className="rounded-xl px-3 py-2.5 text-[13px] font-extrabold active:scale-[0.98] transition inline-flex items-center gap-1 disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`,
                color: COLORS.navyDark,
              }}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        )}
      </div>

      <ReportDialog
        open={!!report}
        onClose={() => setReport(null)}
        reportType={report?.type || 'conversation'}
        conversationId={conv.id}
        annonceId={conv.annonce_id}
        messageId={report?.messageId}
        reportedUserId={user!.id === conv.owner_id ? conv.contact_user_id : conv.owner_id}
      />
    </div>
  );
};

export default MessageThreadPage;
