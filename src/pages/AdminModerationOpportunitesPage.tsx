import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Loader2, ShieldAlert, Eye, EyeOff, CheckCircle2, XCircle, MessageCircle, StickyNote } from 'lucide-react';
import {
  ANNONCE_REPORT_REASONS,
  MESSAGE_REPORT_REASONS,
  REPORT_STATUS_LABELS,
  ReportStatus,
  ReportType,
} from './opportunites/reports';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

type ReportRow = {
  id: string;
  reporter_id: string;
  report_type: ReportType;
  annonce_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  reported_user_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type AnnonceLite = {
  id: string;
  title: string;
  status: string;
  user_id: string;
};

type MessageLite = {
  id: string;
  content: string;
  conversation_id: string;
  hidden_by_moderation: boolean;
};

const reasonLabel = (value: string, kind: ReportType, isRTL: boolean) => {
  const arr = kind === 'annonce' ? ANNONCE_REPORT_REASONS : MESSAGE_REPORT_REASONS;
  const f = arr.find((r) => r.value === value);
  return f ? (isRTL ? f.ar : f.fr) : value;
};

const formatDate = (iso: string, isRTL: boolean) => {
  try {
    return new Date(iso).toLocaleString(isRTL ? 'ar-EG' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

const AdminModerationOpportunitesPage = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [annonces, setAnnonces] = useState<Record<string, AnnonceLite>>({});
  const [messages, setMessages] = useState<Record<string, MessageLite>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ReportType>('all');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);

  const fontFamily = isRTL ? "'Tajawal', system-ui, sans-serif" : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Admin gate
  useEffect(() => {
    let alive = true;
    (async () => {
      if (authLoading) return;
      if (!user || user.is_anonymous) {
        if (alive) { setIsAdmin(false); setCheckingAdmin(false); }
        return;
      }
      try {
        const { data, error } = await supabase.rpc('is_admin', { _user_id: user.id });
        if (!alive) return;
        setIsAdmin(!error && data === true);
      } catch (e) {
        console.error('admin check error', e);
        if (alive) setIsAdmin(false);
      } finally {
        if (alive) setCheckingAdmin(false);
      }
    })();
    return () => { alive = false; };
  }, [user, authLoading]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('opportunite_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) console.error('reports load error', error);
    const rows = (data as ReportRow[]) || [];
    setReports(rows);

    const annonceIds = Array.from(new Set(rows.map((r) => r.annonce_id).filter(Boolean))) as string[];
    const messageIds = Array.from(new Set(rows.map((r) => r.message_id).filter(Boolean))) as string[];

    const [aRes, mRes] = await Promise.all([
      annonceIds.length
        ? supabase.from('opportunite_annonces').select('id,title,status,user_id').in('id', annonceIds)
        : Promise.resolve({ data: [], error: null } as any),
      messageIds.length
        ? supabase.from('opportunite_messages').select('id,content,conversation_id,hidden_by_moderation').in('id', messageIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    const aMap: Record<string, AnnonceLite> = {};
    for (const a of (aRes.data as AnnonceLite[]) || []) aMap[a.id] = a;
    setAnnonces(aMap);
    const mMap: Record<string, MessageLite> = {};
    for (const m of (mRes.data as MessageLite[]) || []) mMap[m.id] = m;
    setMessages(mMap);

    setLoading(false);
  };

  useEffect(() => {
    if (!checkingAdmin && isAdmin) load();
  }, [checkingAdmin, isAdmin]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.report_type !== typeFilter) return false;
      return true;
    });
  }, [reports, statusFilter, typeFilter]);

  const updateReport = async (id: string, patch: Partial<ReportRow>) => {
    if (!user) return;
    setWorking(id);
    try {
      const { error } = await supabase.from('opportunite_reports')
        .update({ ...patch, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await load();
    } catch (e) {
      console.error('report update err', e);
      toast({ variant: 'destructive', title: isRTL ? 'فشل التحديث' : 'Mise à jour impossible' });
    } finally {
      setWorking(null);
    }
  };

  const moderateAnnonce = async (annonceId: string, newStatus: 'moderated' | 'active', reportId: string) => {
    setWorking(reportId);
    try {
      const { error } = await supabase.from('opportunite_annonces')
        .update({ status: newStatus })
        .eq('id', annonceId);
      if (error) throw error;
      await updateReport(reportId, { status: newStatus === 'moderated' ? 'resolved' : 'reviewing' });
      toast({ title: isRTL ? '✅ تم' : '✅ Action appliquée' });
    } catch (e) {
      console.error('moderate annonce err', e);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur' });
    } finally {
      setWorking(null);
    }
  };

  const hideMessage = async (messageId: string, hidden: boolean, reportId: string) => {
    setWorking(reportId);
    try {
      const { error } = await supabase.from('opportunite_messages')
        .update({ hidden_by_moderation: hidden })
        .eq('id', messageId);
      if (error) throw error;
      await updateReport(reportId, { status: hidden ? 'resolved' : 'reviewing' });
      toast({ title: isRTL ? '✅ تم' : '✅ Action appliquée' });
    } catch (e) {
      console.error('hide msg err', e);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur' });
    } finally {
      setWorking(null);
    }
  };

  const closeConversation = async (conversationId: string, reportId: string) => {
    setWorking(reportId);
    try {
      const { error } = await supabase.from('opportunite_conversations')
        .update({ status: 'closed', closed_by_moderation: true })
        .eq('id', conversationId);
      if (error) throw error;
      await updateReport(reportId, { status: 'resolved' });
      toast({ title: isRTL ? '✅ تم إغلاق المحادثة' : '✅ Conversation fermée' });
    } catch (e) {
      console.error('close conv err', e);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur' });
    } finally {
      setWorking(null);
    }
  };

  // ---------- Renders ----------
  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.pageBg, fontFamily }}>
        <Loader2 size={24} className="animate-spin" style={{ color: COLORS.navyDark }} />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ background: COLORS.pageBg, fontFamily }}
      >
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mb-3">
          <ShieldAlert size={24} />
        </div>
        <p className="text-[15px] font-extrabold" style={{ color: COLORS.navyDark }}>
          {isRTL ? 'الدخول محمي' : 'Accès réservé aux administrateurs'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 rounded-xl px-4 py-2 font-extrabold text-[13px]"
          style={{ background: COLORS.goldDark, color: 'white' }}
        >
          {isRTL ? 'الرئيسية' : 'Accueil'}
        </button>
      </div>
    );
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen overflow-x-hidden"
      style={{ background: COLORS.pageBg, fontFamily }}
    >
      <section
        className="px-5 pt-6 pb-6"
        style={{ background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%)`, color: 'white' }}
      >
        <button
          onClick={() => navigate('/admin')}
          className={cn('inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85 hover:text-white', isRTL && 'flex-row-reverse')}
        >
          <BackIcon size={14} />
          {isRTL ? 'الإدارة' : 'Admin'}
        </button>
        <h1 className={cn('mt-3 text-[20px] font-extrabold leading-tight', isRTL ? 'text-right' : 'text-left')}>
          {isRTL ? 'مراجعة إعلانات الفرص' : 'Modération des opportunités'}
        </h1>
        <p className={cn('text-[12px] text-white/80 mt-1', isRTL ? 'text-right' : 'text-left')}>
          {isRTL ? 'قائمة البلاغات وإجراءات الإدارة.' : 'Liste des signalements et actions de modération.'}
        </p>
      </section>

      <div className="px-4 mt-4 pb-10 space-y-4">
        {/* Filtres */}
        <div className="rounded-2xl bg-white p-3 shadow-sm border" style={{ borderColor: '#E5E9F0' }}>
          <div className={cn('flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border px-2 py-1.5 text-[12px]"
              style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
            >
              <option value="all">{isRTL ? 'كل الحالات' : 'Tous statuts'}</option>
              {(Object.keys(REPORT_STATUS_LABELS) as ReportStatus[]).map((s) => (
                <option key={s} value={s}>{isRTL ? REPORT_STATUS_LABELS[s].ar : REPORT_STATUS_LABELS[s].fr}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-lg border px-2 py-1.5 text-[12px]"
              style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
            >
              <option value="all">{isRTL ? 'كل الأنواع' : 'Tous types'}</option>
              <option value="annonce">{isRTL ? 'إعلان' : 'Annonce'}</option>
              <option value="conversation">{isRTL ? 'محادثة' : 'Conversation'}</option>
              <option value="message">{isRTL ? 'رسالة' : 'Message'}</option>
            </select>
            <span className="ml-auto text-[11px] text-gray-500 self-center">
              {filtered.length} / {reports.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: COLORS.navyDark }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center border" style={{ borderColor: '#E5E9F0' }}>
            <p className="text-[13px] text-gray-500">
              {isRTL ? 'مفيش بلاغات.' : 'Aucun signalement.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const st = REPORT_STATUS_LABELS[r.status];
              const a = r.annonce_id ? annonces[r.annonce_id] : null;
              const m = r.message_id ? messages[r.message_id] : null;
              return (
                <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm border" style={{ borderColor: '#E5E9F0' }}>
                  <div className={cn('flex items-center gap-1.5 flex-wrap', isRTL && 'flex-row-reverse')}>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {isRTL ? st.ar : st.fr}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold border"
                      style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
                    >
                      {r.report_type === 'annonce'
                        ? (isRTL ? 'إعلان' : 'Annonce')
                        : r.report_type === 'conversation'
                        ? (isRTL ? 'محادثة' : 'Conversation')
                        : (isRTL ? 'رسالة' : 'Message')}
                    </span>
                    <span className="text-[10px] text-gray-500">{formatDate(r.created_at, isRTL)}</span>
                  </div>

                  <h3 className={cn('mt-2 text-[13px] font-extrabold', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
                    {reasonLabel(r.reason, r.report_type === 'annonce' ? 'annonce' : 'message', isRTL)}
                  </h3>

                  {a && (
                    <p className={cn('mt-1 text-[11px] text-gray-600 line-clamp-1', isRTL ? 'text-right' : 'text-left')}>
                      {isRTL ? 'الإعلان: ' : 'Annonce : '}<span className="font-bold">{a.title}</span>
                      {' '}<span className="opacity-70">({a.status})</span>
                    </p>
                  )}
                  {m && (
                    <p className={cn('mt-1 text-[11px] text-gray-600 line-clamp-3', isRTL ? 'text-right' : 'text-left')}>
                      «&nbsp;{m.hidden_by_moderation ? (isRTL ? '[مخفي]' : '[Masqué]') : m.content}&nbsp;»
                    </p>
                  )}
                  {r.details && (
                    <p className={cn('mt-2 text-[11px] text-gray-700 bg-gray-50 rounded-lg px-2 py-1.5', isRTL ? 'text-right' : 'text-left')}>
                      {r.details}
                    </p>
                  )}

                  {/* Actions */}
                  <div className={cn('mt-3 flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
                    {a && (
                      <>
                        <button
                          onClick={() => navigate(`/opportunites/annonces/${a.id}`)}
                          disabled={a.status !== 'active'}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border disabled:opacity-50"
                          style={{ borderColor: '#E5E9F0', color: COLORS.navyDark, background: 'white' }}
                        >
                          <Eye size={12} /> {isRTL ? 'عرض' : "Voir l'annonce"}
                        </button>
                        {a.status !== 'moderated' ? (
                          <button
                            onClick={() => moderateAnnonce(a.id, 'moderated', r.id)}
                            disabled={working === r.id}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                            style={{ background: '#FDECEC', color: '#B91C1C' }}
                          >
                            <EyeOff size={12} /> {isRTL ? 'إخفاء الإعلان' : 'Masquer'}
                          </button>
                        ) : (
                          <button
                            onClick={() => moderateAnnonce(a.id, 'active', r.id)}
                            disabled={working === r.id}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                            style={{ background: '#E8F5EE', color: '#0F7B3D' }}
                          >
                            <Eye size={12} /> {isRTL ? 'إعادة تفعيل' : 'Réactiver'}
                          </button>
                        )}
                      </>
                    )}

                    {m && (
                      <button
                        onClick={() => hideMessage(m.id, !m.hidden_by_moderation, r.id)}
                        disabled={working === r.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                        style={{ background: m.hidden_by_moderation ? '#E8F5EE' : '#FDECEC', color: m.hidden_by_moderation ? '#0F7B3D' : '#B91C1C' }}
                      >
                        {m.hidden_by_moderation ? <Eye size={12} /> : <EyeOff size={12} />}
                        {m.hidden_by_moderation
                          ? (isRTL ? 'إظهار الرسالة' : 'Réafficher')
                          : (isRTL ? 'إخفاء الرسالة' : 'Masquer message')}
                      </button>
                    )}

                    {r.conversation_id && (
                      <button
                        onClick={() => closeConversation(r.conversation_id!, r.id)}
                        disabled={working === r.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                        style={{ background: '#FDF3E1', color: '#8A5A00' }}
                      >
                        <MessageCircle size={12} /> {isRTL ? 'إغلاق المحادثة' : 'Fermer conv.'}
                      </button>
                    )}

                    {r.status !== 'resolved' && (
                      <button
                        onClick={() => updateReport(r.id, { status: 'resolved' })}
                        disabled={working === r.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                        style={{ background: '#E8F5EE', color: '#0F7B3D' }}
                      >
                        <CheckCircle2 size={12} /> {isRTL ? 'تم المعالجة' : 'Traité'}
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button
                        onClick={() => updateReport(r.id, { status: 'rejected' })}
                        disabled={working === r.id}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                        style={{ background: '#EEF0F5', color: '#3F4A63' }}
                      >
                        <XCircle size={12} /> {isRTL ? 'رفض' : 'Classer'}
                      </button>
                    )}
                  </div>

                  {/* Notes internes */}
                  <div className="mt-3">
                    <label className={cn('block text-[10px] font-bold text-gray-500 mb-1 inline-flex items-center gap-1', isRTL && 'flex-row-reverse')}>
                      <StickyNote size={10} /> {isRTL ? 'ملاحظة داخلية' : 'Note interne'}
                    </label>
                    <div className={cn('flex gap-2', isRTL && 'flex-row-reverse')}>
                      <input
                        value={notesDraft[r.id] ?? (r.admin_notes || '')}
                        onChange={(e) => setNotesDraft((n) => ({ ...n, [r.id]: e.target.value.slice(0, 1000) }))}
                        placeholder={r.admin_notes || (isRTL ? 'اكتب ملاحظة…' : 'Ajouter une note…')}
                        className="flex-1 rounded-lg border px-2 py-1.5 text-[12px]"
                        style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
                      />
                      <button
                        onClick={() => updateReport(r.id, { admin_notes: (notesDraft[r.id] ?? r.admin_notes ?? '').toString() })}
                        disabled={working === r.id}
                        className="rounded-lg px-3 py-1.5 text-[12px] font-extrabold"
                        style={{ background: COLORS.navyDark, color: 'white' }}
                      >
                        {isRTL ? 'حفظ' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-[9px] text-gray-400 select-all">
                    id: {r.id}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModerationOpportunitesPage;
