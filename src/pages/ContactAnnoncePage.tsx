import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Loader2, Send } from 'lucide-react';
import { clearPendingContact, setPendingContact } from './opportunites/messagerie';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

const MIN_LEN = 10;
const MAX_LEN = 2000;

const ContactAnnoncePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [annonce, setAnnonce] = useState<{ id: string; user_id: string; title: string; status: string } | null>(null);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Require auth. If not logged in, remember target and go to /login.
  useEffect(() => {
    if (authLoading) return;
    if (!user && id) {
      setPendingContact(id);
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, id, navigate]);

  useEffect(() => {
    let alive = true;
    if (!id || !user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunite_annonces')
        .select('id,user_id,title,status')
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();
      if (!alive) return;
      if (error) console.error('contact load annonce', error);
      setAnnonce(data);
      setLoading(false);

      if (data && data.user_id === user.id) {
        toast({
          title: isRTL ? 'ده إعلانك' : "C'est votre annonce",
          description: isRTL ? 'ما تقدرش تبعت رسالة لنفسك.' : "Vous ne pouvez pas vous envoyer un message.",
        });
        navigate(`/opportunites/annonces/${id}`, { replace: true });
      }
    })();
    return () => { alive = false; };
  }, [id, user, isRTL, navigate, toast]);

  const handleSend = async () => {
    if (!user || !annonce) return;
    const schema = z.string()
      .trim()
      .min(MIN_LEN, { message: isRTL ? `الحد الأدنى ${MIN_LEN} حروف` : `Minimum ${MIN_LEN} caractères` })
      .max(MAX_LEN, { message: isRTL ? `الحد الأقصى ${MAX_LEN} حرف` : `Maximum ${MAX_LEN} caractères` });
    const parsed = schema.safeParse(content);
    if (!parsed.success) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'الرسالة قصيرة أو طويلة' : 'Message invalide',
        description: parsed.error.issues[0]?.message,
      });
      return;
    }

    setSending(true);
    try {
      // Find existing conversation for (annonce, owner, contact) tuple
      let convId: string | null = null;
      const { data: existing } = await supabase
        .from('opportunite_conversations')
        .select('id,status')
        .eq('annonce_id', annonce.id)
        .eq('owner_id', annonce.user_id)
        .eq('contact_user_id', user.id)
        .maybeSingle();

      if (existing?.id) {
        convId = existing.id;
        if (existing.status !== 'active') {
          await supabase.from('opportunite_conversations')
            .update({ status: 'active' }).eq('id', convId);
        }
      } else {
        const { data: created, error: createErr } = await supabase
          .from('opportunite_conversations')
          .insert({
            annonce_id: annonce.id,
            owner_id: annonce.user_id,
            contact_user_id: user.id,
            status: 'active',
          })
          .select('id')
          .single();
        if (createErr) throw createErr;
        convId = created.id;
      }

      const { error: msgErr } = await supabase.from('opportunite_messages').insert({
        conversation_id: convId!,
        sender_id: user.id,
        content: parsed.data,
      });
      if (msgErr) throw msgErr;

      clearPendingContact();
      toast({ title: isRTL ? '✅ تم إرسال الرسالة' : '✅ Message envoyé' });
      navigate(`/opportunites/messages/${convId}`, { replace: true });
    } catch (err) {
      console.error('contact send error', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'فشل الإرسال' : 'Envoi impossible',
        description: err instanceof Error ? err.message : 'Erreur',
      });
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
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

  if (!annonce) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: COLORS.pageBg, fontFamily }}
      >
        <p className="text-[14px] font-bold" style={{ color: COLORS.navyDark }}>
          {isRTL ? 'الإعلان غير متاح' : 'Annonce indisponible'}
        </p>
        <button
          onClick={() => navigate('/opportunites/annonces')}
          className="mt-4 rounded-xl px-4 py-2 font-extrabold text-[13px]"
          style={{ background: COLORS.goldDark, color: 'white' }}
        >
          {isRTL ? 'رجوع' : 'Retour'}
        </button>
      </div>
    );
  }

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
          onClick={() => navigate(`/opportunites/annonces/${annonce.id}`)}
          className={cn('inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85 hover:text-white', isRTL && 'flex-row-reverse')}
        >
          <BackIcon size={14} />
          {isRTL ? 'الإعلان' : "Retour à l'annonce"}
        </button>
        <h1 className={cn('mt-3 text-[20px] font-extrabold leading-tight', isRTL ? 'text-right' : 'text-left')}>
          {isRTL ? 'ابعت رسالة' : 'Envoyer un message'}
        </h1>
        <p className={cn('text-[12px] text-white/85 mt-1 line-clamp-1', isRTL ? 'text-right' : 'text-left')}>
          {annonce.title}
        </p>
      </section>

      <div className="px-4 mt-4 pb-10 space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm border space-y-3" style={{ borderColor: '#E5E9F0' }}>
          <label
            className={cn('block text-[12px] font-bold', isRTL ? 'text-right' : 'text-left')}
            style={{ color: COLORS.navyDark }}
          >
            {isRTL ? 'اكتب رسالتك' : 'Votre message'} <span style={{ color: '#B91C1C' }}>*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
            rows={7}
            maxLength={MAX_LEN}
            placeholder={isRTL
              ? 'اشرح طلبك باختصار، وما تبعتش معلومات شخصية أو حساسة.'
              : 'Présentez brièvement votre besoin. Ne communiquez pas d’informations sensibles.'}
            className={cn(
              'w-full rounded-xl border bg-white p-3 text-[14px] outline-none focus:ring-2',
              isRTL ? 'text-right' : 'text-left',
            )}
            style={{ borderColor: '#E5E9F0' }}
          />
          <div className={cn('flex items-center justify-between text-[11px] text-gray-500', isRTL && 'flex-row-reverse')}>
            <span>
              {content.trim().length < MIN_LEN
                ? (isRTL ? `الحد الأدنى ${MIN_LEN} حروف` : `Minimum ${MIN_LEN} caractères`)
                : (isRTL ? 'الرسالة جاهزة للإرسال' : 'Message prêt à envoyer')}
            </span>
            <span>{content.length}/{MAX_LEN}</span>
          </div>
          <p className={cn('text-[11px] text-gray-500 leading-snug', isRTL ? 'text-right' : 'text-left')}>
            {isRTL
              ? 'ANAFYPRO مش مسؤولة عن الاتفاق بين المستخدمين. ما تشاركش معلومات بنكية أو بيانات حساسة.'
              : "ANAFYPRO n'intervient pas dans les échanges entre utilisateurs. Ne partagez jamais de données bancaires ou d'informations sensibles."}
          </p>
        </div>

        <div className={cn('flex flex-wrap gap-3', isRTL && 'flex-row-reverse')}>
          <button
            onClick={() => navigate(`/opportunites/annonces/${annonce.id}`)}
            disabled={sending}
            className="rounded-xl px-4 py-2.5 text-[13px] font-bold border bg-white disabled:opacity-60"
            style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
          >
            {isRTL ? 'إلغاء' : 'Annuler'}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || content.trim().length < MIN_LEN}
            className="flex-1 min-w-[140px] rounded-xl px-4 py-2.5 text-[13px] font-extrabold active:scale-[0.98] transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={{
              background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`,
              color: COLORS.navyDark,
            }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {isRTL ? 'إرسال' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactAnnoncePage;
