import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, PenLine, FileText, User, Wallet, Settings, TrendingUp, Banknote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import LegalComplianceBanner from '@/components/shared/LegalComplianceBanner';
import SecurityBadge from '@/components/shared/SecurityBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const Dashboard = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ca, setCa] = useState(0);
  const [tresorerie, setTresorerie] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: docs } = await supabase
        .from('documents_comptables')
        .select('subtotal_ht, total_ttc, status, payment_status, document_type')
        .eq('user_id', user.id);
      const finalized = (docs || []).filter((d: any) => d.document_type === 'facture' && d.status === 'finalized');
      setCa(finalized.reduce((s: number, d: any) => s + (d.subtotal_ht || 0), 0));
      setTresorerie(finalized.filter((d: any) => d.payment_status === 'paid').reduce((s: number, d: any) => s + (d.subtotal_ht || 0), 0));
    };
    fetch();
  }, [user]);

  const actionCards = [
    {
      icon: Camera,
      title: isRTL ? 'صوّر وحلّ' : 'Scanner & Résoudre',
      subtitle: isRTL ? 'صور أي جواب وهفهملك' : 'Photographiez, je vous explique',
      path: '/assistant',
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-400/30',
      emoji: '📸',
    },
    {
      icon: PenLine,
      title: isRTL ? 'اكتبلي خطاب' : 'Écrire une Lettre',
      subtitle: isRTL ? 'خطاب رسمي بالفرنساوي' : 'Lettre officielle en français',
      path: '/assistant',
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
    <div className="min-h-[80vh] flex flex-col justify-center py-8 px-2">
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
                {isRTL ? 'إجمالي الإيرادات' : 'Chiffre d\'affaires'}
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
