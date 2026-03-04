import { useNavigate } from 'react-router-dom';
import { Briefcase, Sparkles, FileUser } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import WelcomeModal from '@/components/home/WelcomeModal';
import ComingSoonSection from '@/components/home/ComingSoonSection';
import { useTracker } from '@/contexts/ActivityTrackerContext';

const Index = () => {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const navigate = useNavigate();
  const { trackFeatureClick } = useTracker();

  const handleNavigate = (path: string, featureName: string) => {
    trackFeatureClick(featureName);
    navigate(path);
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground select-none overflow-x-hidden",
        isRTL && "font-cairo"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <WelcomeModal />

      {/* BETA BANNER */}
      <div className="bg-primary/8 border-b border-primary/15 py-1.5 text-center">
        <span className="text-[11px] font-semibold text-primary tracking-wide">
          نسخة تجريبية تحت الإنشاء — Beta
        </span>
      </div>

      {/* HEADER */}
      <header className="bg-card/80 backdrop-blur-xl p-4 flex justify-between items-center border-b border-border relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-black text-lg italic shadow-lg">
            AF
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-foreground uppercase italic leading-none">
              {t('header.appName')}
            </h1>
            <div className="h-0.5 w-full bg-primary/40 rounded-full mt-1"></div>
          </div>
        </div>

        {/* Language Toggle */}
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

      <main className="px-4 pt-4 pb-20 flex flex-col" style={{ minHeight: 'calc(100vh - 90px)' }}>
        {/* DOMINANT CARDS — fill available space */}
        <div className="flex flex-col gap-4 flex-1">

          {/* Hero: Devis & Factures */}
          <button
            onClick={() => handleNavigate('/pro', 'فتح أدوات Pro (دوفي/فاتورة)')}
            className="w-full bg-card rounded-3xl flex flex-col items-center justify-center gap-5 active:scale-[0.98] transition-all duration-200 border border-primary/25 shadow-[0_12px_40px_-12px_hsl(37_37%_60%/0.3)] flex-[1.4]"
          >
            <div className="bg-gradient-to-br from-[hsl(37,50%,55%)] to-[hsl(30,45%,40%)] p-6 rounded-2xl shadow-xl">
              <Briefcase size={52} className="text-white" />
            </div>
            <div className="text-center px-6">
              <h3 className={cn("text-2xl font-extrabold leading-snug text-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'فواتير ودوفيهات' : 'Devis & Factures'}
              </h3>
              <p className={cn("text-[0.95rem] font-medium text-muted-foreground mt-2 leading-relaxed", isRTL && "font-cairo")}>
                {isRTL
                  ? 'اعمل الفاكتير والدوفي بتوعك بسهولة أو حوّل الدوفي لفاتورة'
                  : 'Créez vos factures et devis facilement ou convertissez un devis en facture'}
              </p>
            </div>
          </button>

          {/* Smart CV */}
          <button
            onClick={() => handleNavigate('/pro/cv-generator', 'فتح مُولد CV')}
            className="w-full bg-card rounded-3xl flex flex-col items-center justify-center gap-5 active:scale-[0.98] transition-all duration-200 border border-[hsl(210,60%,50%)]/20 shadow-[0_8px_30px_-10px_hsl(210_60%_40%/0.35)] flex-1"
          >
            <div className="bg-gradient-to-br from-[hsl(210,65%,50%)] to-[hsl(220,60%,38%)] p-5 rounded-2xl shadow-xl">
              <FileUser size={46} className="text-white" />
            </div>
            <div className="text-center px-6">
              <h3 className={cn("text-xl font-extrabold leading-snug text-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'Smart CV' : 'Smart CV'}
              </h3>
              <p className={cn("text-sm font-medium text-muted-foreground mt-1.5", isRTL && "font-cairo")}>
                {isRTL
                  ? 'اعمل سي في بالعربي وأنا أطلعهولك بالفرنساوي'
                  : 'Créez votre CV en quelques minutes'}
              </p>
            </div>
          </button>
        </div>

        {/* BOTTOM SLIM SECTION */}
        <div className="flex flex-col gap-2 mt-3">
          {/* شبيك لبيك — Compact bar */}
          <button
            onClick={() => handleNavigate('/ai-assistant', 'فتح شبيك لبيك')}
            className="w-full bg-card/70 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 active:scale-[0.98] transition-all duration-200 border border-border"
          >
            <div className="bg-gradient-to-br from-[hsl(260,45%,55%)] to-[hsl(260,45%,40%)] p-1.5 rounded-lg shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className={cn("text-xs font-bold text-foreground flex-1", isRTL ? "text-right font-cairo" : "text-left")}>
              {isRTL ? 'شبيك لبيك — المساعد الذكي' : 'Assistant IA — Shabik Labik'}
            </span>
            <svg className={cn("w-3.5 h-3.5 text-muted-foreground", isRTL && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* حاجات جديدة — Minimal */}
          <ComingSoonSection />
        </div>
      </main>
    </div>
  );
};

export default Index;
