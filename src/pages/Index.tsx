import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import WelcomeModal from '@/components/home/WelcomeModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTeamRole } from '@/hooks/useTeamRole';
import { Bot, Shield, Lock, FileText, FilePlus, Languages, UserSquare2, Sparkles, FolderOpen, BarChart2, Users, ClipboardList } from 'lucide-react';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  navyMid: '#1E6AA8',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

const fmtEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

interface RecentDoc {
  id: string;
  document_number: string;
  client_name: string;
  total_ttc: number;
  payment_status: string | null;
  status: string;
  created_at: string;
  due_date?: string | null;
}

const Index = () => {
  const { language, setLanguage, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isTeamMemberOnly, loading: teamLoading } = useTeamRole();

  useEffect(() => {
    if (!teamLoading && isTeamMemberOnly) {
      navigate('/chantier-report', { replace: true });
    }
  }, [teamLoading, isTeamMemberOnly, navigate]);

  const [volumeAffaires, setVolumeAffaires] = useState(0);
  const [revenusEncaisses, setRevenusEncaisses] = useState(0);
  const [creancesTotal, setCreancesTotal] = useState(0);
  const [creancesCount, setCreancesCount] = useState(0);
  const [beneficeNet, setBeneficeNet] = useState(0);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);

  // Load Google Fonts (Tajawal + Poppins)
  useEffect(() => {
    const id = 'home-fonts-link';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: docs } = await supabase
      .from('documents_comptables')
      .select('id, document_number, client_name, subtotal_ht, total_ttc, status, payment_status, document_type, created_at')
      .eq('user_id', user.id)
      .eq('document_type', 'facture')
      .order('created_at', { ascending: false });

    const list = (docs || []) as any[];
    const issued = list.filter(d => ['finalized', 'converted'].includes(d.status));
    const paid = issued.filter(d => d.payment_status === 'paid');
    const unpaid = issued.filter(d => d.payment_status !== 'paid' && d.status !== 'cancelled');

    const sumTTC = (arr: any[]) => arr.reduce((s, d) => s + (Number(d.total_ttc) || 0), 0);
    const sumHT = (arr: any[]) => arr.reduce((s, d) => s + (Number(d.subtotal_ht) || 0), 0);

    setVolumeAffaires(sumTTC(issued));
    setRevenusEncaisses(sumTTC(paid));
    setCreancesTotal(sumTTC(unpaid));
    setCreancesCount(unpaid.length);
    const urssafRate = (profile?.urssaf_rate ?? 22) / 100;
    setBeneficeNet(sumHT(paid) * (1 - urssafRate));

    setRecentDocs(issued.slice(0, 3).map(d => ({
      id: d.id,
      document_number: d.document_number,
      client_name: d.client_name,
      total_ttc: Number(d.total_ttc) || 0,
      payment_status: d.payment_status,
      status: d.status,
      created_at: d.created_at,
    })));
  }, [user, profile?.urssaf_rate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const cleanupOldCaches = async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
      } catch (e) {
        console.warn('cache cleanup failed', e);
      }
    };

    cleanupOldCaches();
  }, []);

  const firstName = (() => {
    const full = profile?.full_name?.trim();
    if (full) return full.split(/\s+/)[0];
    const meta = (user?.user_metadata as any)?.full_name as string | undefined;
    if (meta) return meta.split(/\s+/)[0];
    if (user?.email) return user.email.split('@')[0];
    return isRTL ? 'صديقي' : 'Bienvenue';
  })();

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";

  const quickActions = [
    { icon: FilePlus, ar: 'دوفي جديد', fr: 'Nouveau devis', path: '/pro/invoice-creator?type=devis' },
    { icon: FileText, ar: 'فاتورة جديدة', fr: 'Nouvelle facture', path: '/pro/invoice-creator?type=facture' },
    { icon: Sparkles, ar: 'دوفي ذكي', fr: 'Devis intelligent', path: '/pro/smart-devis' },
    { icon: FolderOpen, ar: 'مستنداتي المحاسبية', fr: 'Mes documents', path: '/my-documents' },
    { icon: BarChart2, ar: 'حساباتي', fr: 'Mes Comptes', path: '/expenses' },
    { icon: ClipboardList, ar: 'تقرير الشانتي', fr: 'Rapport chantier', path: '/chantier-report' },
  ];

  const statusBadge = (d: RecentDoc) => {
    const isPaid = d.payment_status === 'paid';
    const isLate = !isPaid && d.due_date && new Date(d.due_date) < new Date();
    if (isPaid) return { bg: '#DCFCE7', fg: '#15803D', ar: 'مدفوعة', fr: 'Payée' };
    if (isLate) return { bg: '#FEE2E2', fg: '#B91C1C', ar: 'متأخرة', fr: 'En retard' };
    return { bg: '#FFEDD5', fg: '#C2410C', ar: 'قيد الانتظار', fr: 'En attente' };
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen overflow-x-hidden relative"
      style={{ backgroundColor: COLORS.pageBg, fontFamily }}
    >
      <WelcomeModal />

      {/* HERO HEADER */}
      <section
        className="relative px-5 pb-20 pt-6"
        style={{
          background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%)`,
          color: 'white',
        }}
      >
        <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
          <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
              style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`, color: COLORS.navyDark }}
            >
              AF
            </div>
            <span className="font-extrabold text-base tracking-tight">Anafy Pro</span>
          </div>
          <div className="flex bg-white/10 backdrop-blur-sm rounded-full p-0.5 text-[11px] font-bold">
            <button
              onClick={() => setLanguage('ar')}
              className={cn('px-3 py-1 rounded-full transition', language === 'ar' ? 'bg-white text-[color:var(--navy)]' : 'text-white/80')}
              style={language === 'ar' ? { color: COLORS.navy } : undefined}
            >AR</button>
            <button
              onClick={() => setLanguage('fr')}
              className={cn('px-3 py-1 rounded-full transition', language === 'fr' ? 'bg-white' : 'text-white/80')}
              style={language === 'fr' ? { color: COLORS.navy } : undefined}
            >FR</button>
          </div>
        </div>

        <div className={cn('mt-5', isRTL ? 'text-right' : 'text-left')}>
          <h1 className="text-[22px] font-extrabold leading-tight">
            {isRTL ? `مرحبا ${firstName} 👋` : `Bonjour ${firstName} 👋`}
          </h1>
          <p className="text-[13px] text-white/80 mt-1">
            {isRTL ? 'إليك ملخص نشاطك لهذا الشهر' : "Résumé de votre activité ce mois-ci"}
          </p>
        </div>
      </section>

      {/* HERO CARDS — overlapping */}
      <div className="px-4 -mt-14 relative z-10 grid grid-cols-2 gap-3">
        <div
          className="rounded-2xl p-4 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${COLORS.goldDark}, ${COLORS.goldLight})`, color: '#1A1A1A' }}
        >
          <p className={cn('text-[10px] font-bold uppercase opacity-80', isRTL && 'text-right')}>
            {isRTL ? 'حجم الأعمال' : "Volume d'affaires"}
          </p>
          <p className={cn('text-[20px] font-extrabold mt-1.5 leading-none', isRTL && 'text-right')}>
            {fmtEUR(volumeAffaires)}
          </p>
          <p className={cn('text-[10px] mt-2 opacity-75', isRTL && 'text-right')}>
            {isRTL ? 'إجمالي الفواتير الصادرة' : 'Total factures émises'}
          </p>
        </div>
        <div
          className="rounded-2xl p-4 shadow-lg text-white"
          style={{ background: `linear-gradient(135deg, ${COLORS.navyDark}, ${COLORS.navyMid})` }}
        >
          <p className={cn('text-[10px] font-bold uppercase opacity-80', isRTL && 'text-right')}>
            {isRTL ? 'الإيرادات المحصَّلة' : 'Revenus encaissés'}
          </p>
          <p className={cn('text-[20px] font-extrabold mt-1.5 leading-none', isRTL && 'text-right')}>
            {fmtEUR(revenusEncaisses)}
          </p>
          <p className={cn('text-[10px] mt-2 opacity-75', isRTL && 'text-right')}>
            {isRTL ? 'الفواتير المدفوعة فعلياً' : 'Factures effectivement payées'}
          </p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 border" style={{ background: '#E8F1FB', borderColor: '#CFE0F2' }}>
          <p className={cn('text-[10px] font-bold uppercase', isRTL && 'text-right')} style={{ color: COLORS.navy }}>
            {isRTL ? 'صافي الربح المقدَّر' : 'Bénéfice net estimé'}
          </p>
          <p className={cn('text-[18px] font-extrabold mt-1.5 leading-none', isRTL && 'text-right')} style={{ color: COLORS.navyDark }}>
            {fmtEUR(beneficeNet)}
          </p>
          <p className={cn('text-[10px] mt-2 opacity-70', isRTL && 'text-right')} style={{ color: COLORS.navyDark }}>
            {isRTL ? 'بعد خصم المساهمات' : 'Après cotisations sociales'}
          </p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ background: '#FDECEC', borderColor: '#F7C9C9' }}>
          <p className={cn('text-[10px] font-bold uppercase', isRTL && 'text-right')} style={{ color: '#B91C1C' }}>
            {isRTL ? 'مستحقات غير محصَّلة' : 'Créances non encaissées'}
          </p>
          <p className={cn('text-[18px] font-extrabold mt-1.5 leading-none', isRTL && 'text-right')} style={{ color: '#7F1D1D' }}>
            {fmtEUR(creancesTotal)}
          </p>
          <p className={cn('text-[10px] mt-2', isRTL && 'text-right')} style={{ color: '#7F1D1D' }}>
            {creancesCount} {isRTL ? 'فاتورة' : creancesCount > 1 ? 'factures' : 'facture'}
          </p>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="px-4 mt-6">
        <h2 className={cn('text-[13px] font-bold mb-3', isRTL && 'text-right')} style={{ color: COLORS.navyDark }}>
          {isRTL ? 'إجراءات سريعة' : 'Actions rapides'}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((a) => (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className="rounded-2xl bg-white p-4 shadow-sm border active:scale-[0.97] transition flex flex-col items-center justify-center gap-1.5"
              style={{ borderColor: '#E5E9F0', minHeight: 88 }}
            >
              {(() => { const Icon = a.icon; return <Icon size={24} style={{ color: COLORS.gold }} className="leading-none" />; })()}
              <span className="text-[12px] font-bold text-center" style={{ color: COLORS.navyDark }}>
                {isRTL ? a.ar : a.fr}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ASSISTANT IA CARD */}
      <div className="px-4 mt-6">
        <div
          className="rounded-2xl p-4 shadow-lg text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${COLORS.navyDark}, ${COLORS.navy})` }}
        >
          <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})` }}
            >
              <Bot size={24} style={{ color: COLORS.navyDark }} />
            </div>
            <div className={cn('flex-1', isRTL ? 'text-right' : 'text-left')}>
              <h3 className="text-[15px] font-extrabold">
                {isRTL ? 'المساعد الذكي' : 'Assistant IA'}
              </h3>
              <p className="text-[11px] text-white/80 mt-0.5">
                {isRTL ? 'اسأل أي سؤال وهجاوبك فوراً' : 'Posez une question, je réponds instantanément'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/ai-assistant')}
            className="mt-3 w-full rounded-xl py-2.5 font-extrabold text-[13px] active:scale-[0.98] transition"
            style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`, color: COLORS.navyDark }}
          >
            {isRTL ? 'ابدأ المحادثة' : 'Démarrer'}
          </button>
        </div>
      </div>

      {/* RECENT INVOICES */}
      <div className="px-4 mt-6">
        <div className={cn('flex items-center justify-between mb-3', isRTL && 'flex-row-reverse')}>
          <h2 className="text-[13px] font-bold" style={{ color: COLORS.navyDark }}>
            {isRTL ? 'آخر الفواتير' : 'Dernières factures'}
          </h2>
          <button
            onClick={() => navigate('/my-documents')}
            className="text-[11px] font-bold"
            style={{ color: COLORS.gold }}
          >
            {isRTL ? 'عرض الكل' : 'Voir tout'}
          </button>
        </div>
        <div className="bg-white rounded-2xl border divide-y" style={{ borderColor: '#E5E9F0' }}>
          {recentDocs.length === 0 ? (
            <div className="p-5 text-center text-[12px] text-gray-500">
              {isRTL ? 'لا توجد فواتير بعد' : 'Aucune facture pour le moment'}
            </div>
          ) : recentDocs.map((d) => {
            const b = statusBadge(d);
            return (
              <div key={d.id} className={cn('flex items-center justify-between p-3.5', isRTL && 'flex-row-reverse')}>
                <div className={cn('min-w-0 flex-1', isRTL ? 'text-right' : 'text-left')}>
                  <p className="text-[13px] font-bold truncate" style={{ color: COLORS.navyDark }}>
                    {d.document_number}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">{d.client_name}</p>
                </div>
                <div className={cn('flex flex-col items-end gap-1 shrink-0', isRTL ? 'items-start' : 'items-end')}>
                  <span className="text-[13px] font-extrabold" style={{ color: COLORS.navyDark }} dir="ltr">
                    {fmtEUR(d.total_ttc)}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: b.bg, color: b.fg }}
                  >
                    {isRTL ? b.ar : b.fr}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RGPD BANNER */}
      <div className="px-4 mt-6 mb-8">
        <div className="bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: '#E5E9F0' }}>
          <div className={cn('flex items-center justify-between mb-2', isRTL && 'flex-row-reverse')}>
            <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
              <Lock size={14} style={{ color: COLORS.navy }} />
              <Shield size={14} style={{ color: COLORS.navy }} />
              <span className="text-sm">🇪🇺</span>
            </div>
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
              style={{ background: COLORS.gold, color: '#1A1A1A' }}
            >
              RGPD
            </span>
          </div>
          <p className={cn('text-[12px] font-bold', isRTL && 'text-right')} style={{ color: COLORS.navyDark }}>
            {isRTL ? 'بياناتك محمية ومشفّرة' : 'Vos données sont protégées et chiffrées'}
          </p>
          <p className={cn('text-[11px] text-gray-500 mt-0.5', isRTL && 'text-right')}>
            {isRTL ? 'تخزين أوروبي — تشفير بنكي — مطابق لـ RGPD' : 'Hébergement européen — chiffrement bancaire — conforme RGPD'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
