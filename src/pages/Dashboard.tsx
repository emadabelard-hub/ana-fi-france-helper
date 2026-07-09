import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, PenLine, FileText, User, Wallet, Settings, TrendingUp, Banknote, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import LegalComplianceBanner from '@/components/shared/LegalComplianceBanner';
import SecurityBadge from '@/components/shared/SecurityBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmt2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const PULL_THRESHOLD = 80;

type VatPeriod = 'month' | 'quarter' | 'year';

const Dashboard = () => {
  const { isRTL, t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ca, setCa] = useState(0);
  const [tresorerie, setTresorerie] = useState(0);
  const [paidInvoices, setPaidInvoices] = useState<any[]>([]);
  const [expensesAll, setExpensesAll] = useState<any[]>([]);
  const [vatPeriod, setVatPeriod] = useState<VatPeriod>('quarter');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [{ data: docs }, { data: exps }] = await Promise.all([
      supabase
        .from('documents_comptables')
        .select('subtotal_ht, total_ttc, tva_amount, status, payment_status, document_type, created_at, updated_at')
        .eq('user_id', user.id),
      supabase
        .from('expenses')
        .select('amount, tva_amount, expense_date')
        .eq('user_id', user.id),
    ]);
    const paid = (docs || []).filter((d: any) => d.document_type === 'facture' && d.status === 'finalized' && d.payment_status === 'paid');
    setCa(paid.reduce((s: number, d: any) => s + (d.subtotal_ht || 0), 0));
    setTresorerie(paid.reduce((s: number, d: any) => s + (d.subtotal_ht || 0), 0));
    setPaidInvoices(paid);
    setExpensesAll(exps || []);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bornes de la période sélectionnée (mois / trimestre / année en cours)
  const periodBounds = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (vatPeriod === 'month') return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
    if (vatPeriod === 'year') return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
    const qStart = Math.floor(m / 3) * 3;
    return { start: new Date(y, qStart, 1), end: new Date(y, qStart + 3, 1) };
  })();

  const inPeriod = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= periodBounds.start && d < periodBounds.end;
  };

  const tvaCollectee = paidInvoices
    .filter((d: any) => inPeriod(d.updated_at || d.created_at))
    .reduce((s: number, d: any) => s + (Number(d.tva_amount) || 0), 0);

  const tvaDeductible = expensesAll
    .filter((e: any) => inPeriod(e.expense_date))
    .reduce((s: number, e: any) => s + (Number(e.tva_amount) || 0), 0);

  const tvaNette = tvaCollectee - tvaDeductible;

  const periodLabel = (() => {
    const y = periodBounds.start.getFullYear();
    if (vatPeriod === 'month') {
      return periodBounds.start.toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR', { month: 'long', year: 'numeric' });
    }
    if (vatPeriod === 'year') return String(y);
    const q = Math.floor(periodBounds.start.getMonth() / 3) + 1;
    if (isRTL) {
      const qNames = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
      return `الربع ${qNames[q - 1]} ${y}`;
    }
    return `T${q} ${y}`;
  })();

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    setPullDistance(0);
  }, [fetchData]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;
    if (container.scrollTop > 0) {
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      const damped = Math.min(delta * 0.5, 120);
      setPullDistance(damped);
      if (damped >= PULL_THRESHOLD) {
        e.preventDefault();
      }
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (isRefreshing) return;
    if (pullDistance >= PULL_THRESHOLD) {
      doRefresh();
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing, pullDistance, doRefresh]);

  const actionCards = [
    {
      icon: Camera,
      title: isRTL ? 'صوّر وحلّ' : 'Scanner & Résoudre',
      subtitle: isRTL ? 'صور أي جواب وهفهملك' : 'Photographiez, je vous explique',
      path: '/ai-assistant',
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-400/30',
      emoji: '📸',
    },
    {
      icon: PenLine,
      title: isRTL ? 'اكتبلي خطاب' : 'Écrire une Lettre',
      subtitle: isRTL ? 'خطاب رسمي بالفرنساوي' : 'Lettre officielle en français',
      path: '/ai-assistant',
      gradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-400/30',
      emoji: '✍️',
    },
    {
      icon: FileText,
      title: isRTL ? 'فواتير ودوفيهات' : 'Factures & Devis',
      subtitle: isRTL ? 'اعمل الفاكتير والدوفي بتوعك بسهولة أو حوّل الدوفي لفاتورة' : 'Créez vos factures et devis facilement',
      path: '/document-hub',
      gradient: 'from-amber-500 to-orange-500',
      iconBg: 'bg-amber-400/30',
      emoji: '📄',
    },
    // CV card hidden for now - kept for future reactivation
    // {
    //   icon: User,
    //   title: isRTL ? 'سيرة ذاتية احترافية' : 'CV Professionnel',
    //   subtitle: isRTL ? 'اصنع سيرتك الذاتية في دقائق' : 'Créez un CV pro en quelques minutes',
    //   path: '/pro/cv-generator',
    //   gradient: 'from-indigo-500 to-violet-600',
    //   iconBg: 'bg-indigo-400/30',
    //   emoji: '👤',
    // },
    {
      icon: Wallet,
      title: isRTL ? 'المحاسبة' : 'Comptabilité',
      subtitle: isRTL ? 'الحسابات، العملاء، والمشاريع في مكان واحد' : 'Dépenses, clients et chantiers au même endroit',
      path: '/expenses',
      gradient: 'from-cyan-500 to-teal-600',
      iconBg: 'bg-cyan-400/30',
      emoji: '💼',
    },
    {
      icon: Settings,
      title: isRTL ? 'إعدادات الأسعار' : 'Réglages Tarifs',
      subtitle: isRTL ? 'خصّص أسعارك المرجعية للدوفي الذكي' : 'Personnalisez vos prix de référence',
      path: '/pro/pricing-settings',
      gradient: 'from-slate-500 to-slate-700',
      iconBg: 'bg-slate-400/30',
      emoji: '⚙️',
    },
  ];

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-[80vh] flex flex-col justify-center py-8 px-2 overflow-y-auto"
    >
      {/* Pull to refresh indicator */}
      <div
        className="flex items-center justify-center transition-all duration-150 overflow-hidden"
        style={{
          height: pullDistance,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <Loader2
            className={cn(
              'h-5 w-5 text-primary transition-transform duration-300',
              isRefreshing && 'animate-spin',
              !isRefreshing && pullDistance >= PULL_THRESHOLD && 'rotate-180'
            )}
          />
          <span className="text-[11px] text-muted-foreground font-cairo">
            {isRefreshing
              ? (isRTL ? 'جاري التحديث...' : 'Actualisation...')
              : pullDistance >= PULL_THRESHOLD
                ? (isRTL ? 'افلت للتحديث' : 'Relâchez pour actualiser')
                : (isRTL ? 'اسحب للتحديث' : 'Tirez pour actualiser')}
          </span>
        </div>
      </div>

      {/* Legal Compliance Banner */}
      <div className="max-w-md mx-auto w-full">
        <LegalComplianceBanner />
      </div>

      {/* Welcome Header */}
      <section className="text-center mb-10 font-cairo">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {isRTL ? 'أهلاً بيك 👋' : 'Bienvenue 👋'}
        </h1>
        <p className="text-lg text-muted-foreground">
          {isRTL ? 'اختار اللي محتاجه' : 'Que puis-je faire pour vous ?'}
        </p>
      </section>

      {/* Big Action Cards */}
      <section className="space-y-4 max-w-md mx-auto w-full">
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.path + card.title}
              className={cn(
                'cursor-pointer transition-all duration-300',
                'hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]',
                'border-none overflow-hidden',
                `bg-gradient-to-r ${card.gradient}`,
              )}
              onClick={() => navigate(card.path)}
            >
              <CardContent className="p-0">
                <div className={cn(
                  'flex items-center gap-5 p-6',
                  isRTL && 'flex-row-reverse'
                )}>
                  {/* Icon Circle */}
                  <div className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center shrink-0',
                    card.iconBg
                  )}>
                    <span className="text-3xl">{card.emoji}</span>
                  </div>

                  {/* Text */}
                  <div className={cn('flex-1', isRTL && 'text-right')}>
                    <h2 className="text-xl font-bold text-white font-cairo mb-1">
                      {card.title}
                    </h2>
                    <p className="text-white/80 text-sm font-cairo">
                      {card.subtitle}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className={cn(
                    'text-white/60 text-2xl',
                    isRTL ? 'rotate-180' : ''
                  )}>
                    →
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Financial Indicators */}
      {user && (
        <section className="max-w-md mx-auto w-full mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-emerald-500/20 p-4">
            <div className={cn('flex items-center gap-2 mb-2', isRTL && 'flex-row-reverse')}>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className={cn('text-[11px] font-bold text-emerald-400', isRTL && 'font-cairo')}>
                {isRTL ? 'رقم المعاملات المحصل' : 'Chiffre d\'affaires'}
              </span>
            </div>
            <p className={cn('text-xl font-black text-emerald-400', isRTL && 'text-right')}>{fmt(ca)}</p>
            <p className={cn('text-[9px] text-muted-foreground mt-1', isRTL && 'font-cairo text-right')}>
              {isRTL ? 'كل الفواتير المعتمدة' : 'Toutes factures finalisées'}
            </p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 border border-cyan-500/20 p-4">
            <div className={cn('flex items-center gap-2 mb-2', isRTL && 'flex-row-reverse')}>
              <Banknote className="h-4 w-4 text-cyan-400" />
              <span className={cn('text-[11px] font-bold text-cyan-400', isRTL && 'font-cairo')}>
                {isRTL ? '💰 الأموال المحصلة' : '💰 Trésorerie'}
              </span>
            </div>
            <p className={cn('text-xl font-black text-cyan-400', isRTL && 'text-right')}>{fmt(tresorerie)}</p>
            <p className={cn('text-[9px] text-muted-foreground mt-1', isRTL && 'font-cairo text-right')}>
              {isRTL ? 'الفواتير المدفوعة فقط' : 'Factures payées uniquement'}
            </p>
          </div>
        </section>
      )}

      {/* Estimation TVA */}
      {user && (
        <section className="max-w-md mx-auto w-full mt-3">
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-600/5 border border-amber-500/20 p-4">
            <div className={cn('flex items-center justify-between gap-2 mb-3', isRTL && 'flex-row-reverse')}>
              <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                <span className="text-base">🧾</span>
                <span className={cn('text-[12px] font-bold text-amber-500', isRTL && 'font-cairo')}>
                  {isRTL ? 'تقدير الـ TVA' : 'Estimation TVA'}
                </span>
              </div>
              <span className={cn('text-[10px] text-muted-foreground', isRTL && 'font-cairo')}>{periodLabel}</span>
            </div>

            {/* Period toggle */}
            <div className={cn('flex gap-1 mb-3', isRTL && 'flex-row-reverse')}>
              {([
                { k: 'month' as VatPeriod, fr: 'Ce mois', ar: 'هذا الشهر' },
                { k: 'quarter' as VatPeriod, fr: 'Trimestre', ar: 'الربع' },
                { k: 'year' as VatPeriod, fr: 'Année', ar: 'السنة' },
              ]).map(opt => (
                <button
                  key={opt.k}
                  onClick={() => setVatPeriod(opt.k)}
                  className={cn(
                    'flex-1 text-[10px] px-2 py-1 rounded-lg border transition-colors',
                    isRTL && 'font-cairo',
                    vatPeriod === opt.k
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-300 font-bold'
                      : 'bg-transparent border-border text-muted-foreground'
                  )}
                >
                  {isRTL ? opt.ar : opt.fr}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 text-[12px]" dir="ltr">
              <div className={cn('flex justify-between', isRTL && 'flex-row-reverse')}>
                <span className={cn('text-muted-foreground', isRTL && 'font-cairo')}>{isRTL ? 'الـ TVA المحصلة' : 'TVA collectée'}</span>
                <span className="font-mono font-bold text-foreground">{fmt2(tvaCollectee)}</span>
              </div>
              <div className={cn('flex justify-between', isRTL && 'flex-row-reverse')}>
                <span className={cn('text-muted-foreground', isRTL && 'font-cairo')}>{isRTL ? 'الـ TVA القابلة للخصم' : 'TVA déductible'}</span>
                <span className="font-mono font-bold text-foreground">- {fmt2(tvaDeductible)}</span>
              </div>
              <div className={cn(
                'flex justify-between rounded-lg px-3 py-2 mt-2 font-bold',
                tvaNette >= 0
                  ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                isRTL && 'flex-row-reverse'
              )}>
                <span className={cn(isRTL && 'font-cairo')}>
                  {tvaNette >= 0
                    ? (isRTL ? 'الصافي المستحق' : 'TVA nette à payer')
                    : (isRTL ? 'رصيد TVA' : 'Crédit TVA')}
                </span>
                <span className="font-mono">{fmt2(Math.abs(tvaNette))}</span>
              </div>
            </div>

            <p className={cn('text-[9px] text-muted-foreground mt-3 leading-snug', isRTL && 'font-cairo text-right')}>
              {isRTL
                ? 'تقدير إرشادي مبني على فواتيرك المدفوعة ومصاريفك. يجب التحقق منه مع محاسبك.'
                : 'Estimation indicative basée sur vos factures payées et dépenses. À faire valider par votre comptable.'}
            </p>
          </div>
        </section>
      )}

      {/* Simple Footer */}
      <section className="text-center mt-8">
        <p className="text-sm text-muted-foreground font-cairo">
          🇫🇷 {isRTL ? 'مساعدك في فرنسا' : 'Votre assistant en France'}
        </p>
      </section>

      {/* Security Badge */}
      <div className="max-w-md mx-auto w-full px-2">
        <SecurityBadge />
      </div>

      {/* Hidden Admin Link */}
      <button 
        onClick={() => navigate('/admin')}
        className="absolute bottom-4 left-4 text-xs text-muted-foreground/30 hover:text-primary"
      >
        Admin
      </button>
    </div>
  );
};

export default Dashboard;
