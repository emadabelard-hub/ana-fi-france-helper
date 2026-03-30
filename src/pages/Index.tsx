import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Wallet, Building2, Bot } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import WelcomeModal from '@/components/home/WelcomeModal';
import GDPRTrustBox from '@/components/shared/GDPRTrustBox';
import { useTracker } from '@/contexts/ActivityTrackerContext';

const Index = () => {
  const { language, setLanguage, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { trackFeatureClick } = useTracker();

  useEffect(() => {
    document.documentElement.style.overscrollBehaviorY = 'auto';
    document.body.style.overscrollBehaviorY = 'auto';
    return () => {
      document.documentElement.style.overscrollBehaviorY = 'contain';
      document.body.style.overscrollBehaviorY = 'contain';
    };
  }, []);

  const handleNavigate = (path: string, featureName: string) => {
    trackFeatureClick(featureName);
    navigate(path);
  };

  const cards = [
    {
      icon: <Briefcase size={32} className="text-white drop-shadow-md" />,
      gradient: 'linear-gradient(135deg, #FFD700, #E6B800)',
      titleAr: 'دوفيرات وفواتير بسهولة ⚡',
      titleFr: 'Devis & Factures facilement ⚡',
      descAr: 'حول الدوفي لفاتورة في ثانية',
      descFr: 'Convertissez un devis en facture en un clic',
      path: '/document-hub',
      feature: 'فتح قسم الفواتير',
      bg: 'bg-[#E3F2FD] dark:bg-[#0D1B2A]',
      border: 'border-[hsl(200,60%,80%)] dark:border-[hsl(220,40%,30%)]',
    },
    {
      icon: <Wallet size={32} className="text-white drop-shadow-md" />,
      gradient: 'linear-gradient(135deg, #0D9488, #16A34A)',
      titleAr: 'إدارة الحسابات 💼',
      titleFr: 'Gestion Comptable 💼',
      descAr: 'تابع المصاريف والأرباح بسهولة',
      descFr: 'Suivez vos dépenses et revenus facilement',
      path: '/expenses',
      feature: 'فتح قسم الحسابات',
      bg: 'bg-[#E8F5E9] dark:bg-[#0A1F12]',
      border: 'border-[hsl(160,50%,75%)] dark:border-[hsl(160,30%,25%)]',
    },
    {
      icon: <Building2 size={32} className="text-white drop-shadow-md" />,
      gradient: 'linear-gradient(135deg, #3F51B5, #1A237E)',
      titleAr: 'معلومات شركتك 🏢',
      titleFr: 'Infos Entreprise 🏢',
      descAr: 'SIRET والبيانات القانونية',
      descFr: 'SIRET et données légales',
      path: '/profile',
      feature: 'فتح بيانات شركتي',
      bg: 'bg-[#E8EAF6] dark:bg-[#0D0F2A]',
      border: 'border-[hsl(220,50%,80%)] dark:border-[hsl(220,30%,25%)]',
    },
    {
      icon: <Bot size={32} className="text-white drop-shadow-md" />,
      gradient: 'linear-gradient(135deg, #8A2BE2, #6A1FB0)',
      titleAr: 'مساعد الشانتي الذكي 🤖',
      titleFr: 'Assistant Chantier IA 🤖',
      descAr: 'حلل الصور واعرف الشغل المطلوب',
      descFr: 'Analysez vos photos et identifiez les travaux',
      path: '/ai-assistant',
      feature: 'فتح المساعد الذكي',
      bg: 'bg-[#F3E5F5] dark:bg-[#1A0A2E]',
      border: 'border-[#E1BEE7] dark:border-[hsl(271,40%,30%)]',
    },
  ];

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground select-none overflow-x-hidden",
        isRTL && "font-cairo"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <WelcomeModal />

      {/* HEADER */}
      <header className="bg-card/80 backdrop-blur-xl p-4 flex justify-between items-center border-b border-border relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-black text-lg italic shadow-lg">
            AF
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-foreground uppercase italic leading-none">
              أنا في فرنسا 🇫🇷
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-cairo">
              {isRTL
                ? 'حلل الشانتي وطلع الدوفي في دقائق 🚀'
                : 'Analysez le chantier et créez vos devis en minutes 🚀'}
            </p>
          </div>
        </div>

        <div className="flex bg-muted p-1 rounded-2xl border border-border">
          <button
            onClick={() => setLanguage('fr')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'fr' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground'
            )}
          >
            FR
          </button>
          <button
            onClick={() => setLanguage('ar')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'ar' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground'
            )}
          >
            عربي
          </button>
        </div>
      </header>

      <main className="px-4 pb-20 pt-4 flex flex-col gap-3" style={{ minHeight: 'calc(100vh - 90px)' }}>
        {cards.map((card) => (
          <button
            key={card.path}
            onClick={() => handleNavigate(card.path, card.feature)}
            className={cn(
              "w-full rounded-2xl flex items-center gap-4 p-5 active:scale-[0.98] hover:scale-[1.02] transition-all duration-300 border shadow-sm hover:shadow-lg hover:-translate-y-0.5 animate-fade-in",
              card.bg,
              card.border
            )}
            dir="rtl"
          >
            <div
              className="w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center shrink-0"
              style={{ background: card.gradient }}
            >
              {card.icon}
            </div>
            <div className="flex-1 text-right font-cairo space-y-1">
              <h3 className="text-[15px] font-bold leading-snug text-foreground">
                {isRTL ? card.titleAr : card.titleFr}
              </h3>
              <p className="text-[13px] font-medium leading-snug text-muted-foreground">
                {isRTL ? card.descAr : card.descFr}
              </p>
            </div>
            <svg className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}

        <div className="mt-auto pt-4">
          <GDPRTrustBox />
        </div>
      </main>
    </div>
  );
};

export default Index;
