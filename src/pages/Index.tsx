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

      <main className="px-5 pt-6 pb-32">
        {/* PRIMARY TOOLS — Full width, high-impact elegant cards */}
        <div className="flex flex-col gap-5">

          {/* Hero: Devis & Factures */}
          <button
            onClick={() => handleNavigate('/pro', 'فتح أدوات Pro (دوفي/فاتورة)')}
            className="w-full bg-card p-7 rounded-3xl flex items-center gap-5 active:scale-[0.98] transition-all duration-200 border border-primary/20 shadow-[0_8px_30px_-12px_hsl(37_37%_60%/0.25)] min-h-[150px]"
          >
            <div className="bg-gradient-to-br from-primary to-primary/70 p-4 rounded-2xl shadow-lg shrink-0">
              <Briefcase size={36} className="text-primary-foreground" />
            </div>
            <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
              <h3 className={cn("text-xl font-extrabold leading-snug text-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'فواتير ودوفيهات' : 'Devis & Factures'}
              </h3>
              <p className={cn("text-[0.9rem] font-medium text-muted-foreground mt-2 leading-relaxed", isRTL && "font-cairo")}>
                {isRTL
                  ? 'اعمل الفاكتير والدوفي بتوعك بسهولة أو حوّل الدوفي لفاتورة'
                  : 'Créez vos factures et devis facilement ou convertissez un devis en facture'}
              </p>
            </div>
          </button>

          {/* Smart CV */}
          <button
            onClick={() => handleNavigate('/pro/cv-generator', 'فتح مُولد CV')}
            className="w-full bg-card p-6 rounded-3xl flex items-center gap-4 active:scale-[0.98] transition-all duration-200 border border-border shadow-[0_4px_20px_-8px_hsl(220_40%_20%/0.3)]"
          >
            <div className="bg-gradient-to-br from-[hsl(220,40%,30%)] to-[hsl(220,40%,20%)] p-3.5 rounded-2xl shadow-lg shrink-0">
              <FileUser size={30} className="text-[hsl(40,20%,92%)]" />
            </div>
            <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
              <h3 className={cn("text-lg font-extrabold leading-snug text-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'Smart CV' : 'Smart CV'}
              </h3>
              <p className={cn("text-sm font-medium text-muted-foreground mt-1", isRTL && "font-cairo")}>
                {isRTL
                  ? 'اعمل سي في بالعربي وأنا أطلعهولك بالفرنساوي'
                  : 'Créez votre CV en quelques minutes'}
              </p>
            </div>
          </button>

          {/* AI Assistant */}
          <button
            onClick={() => handleNavigate('/ai-assistant', 'فتح شبيك لبيك')}
            className="w-full bg-card p-6 rounded-3xl flex items-center gap-4 active:scale-[0.98] transition-all duration-200 border border-border shadow-[0_4px_20px_-8px_hsl(220_40%_20%/0.3)]"
          >
            <div className="bg-gradient-to-br from-[hsl(260,45%,55%)] to-[hsl(260,45%,40%)] p-3.5 rounded-2xl shadow-lg shrink-0">
              <Sparkles size={28} className="text-white" />
            </div>
            <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
              <h3 className={cn("text-lg font-extrabold leading-snug text-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'شبيك لبيك' : 'Assistant IA'}
              </h3>
              <p className={cn("text-sm font-medium text-muted-foreground mt-1", isRTL && "font-cairo")}>
                {isRTL ? 'اسأل أي سؤال وأنا هاجاوبك فوراً' : 'Réponses instantanées à toutes vos questions'}
              </p>
            </div>
          </button>
        </div>

        {/* SECONDARY SECTION — حاجات جديدة */}
        <div className="mt-10">
          <ComingSoonSection />
        </div>
      </main>
    </div>
  );
};

export default Index;
