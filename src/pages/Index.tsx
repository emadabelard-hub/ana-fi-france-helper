import { useNavigate } from 'react-router-dom';
import { Briefcase, Newspaper, GraduationCap, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { FileUser } from 'lucide-react';
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
      <div className="bg-accent/10 border-b border-accent/20 py-1.5 text-center">
        <span className="text-[11px] font-semibold text-accent tracking-wide">
          نسخة تجريبية تحت الإنشاء — Beta
        </span>
      </div>

      {/* HEADER */}
      <header className="bg-card p-4 flex justify-between items-center border-b border-border relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-accent-foreground font-black text-lg border-2 border-background italic">
            AF
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-foreground uppercase italic leading-none">
              {t('header.appName')}
            </h1>
            <div className="h-1 w-full bg-accent rounded-full mt-1 opacity-40"></div>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="flex bg-muted p-1.5 rounded-2xl border border-border">
          <button
            onClick={() => setLanguage('fr')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'fr' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            FR
          </button>
          <button
            onClick={() => setLanguage('ar')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'ar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            عربي
          </button>
        </div>
      </header>

      <main className="px-5 pt-6 pb-32">
        {/* Primary Tools - Full width, prominent */}
        <div className="flex flex-col gap-4">
          {/* Devis & Factures - Hero card */}
          <button
            onClick={() => handleNavigate('/pro', 'فتح أدوات Pro (دوفي/فاتورة)')}
            className="w-full bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] dark:from-[#0A0A0A] dark:to-[#1A1A1A] p-6 rounded-2xl flex items-center gap-5 active:scale-[0.98] transition-all duration-200 border border-[#D4A841]/30 shadow-lg min-h-[140px]"
          >
            <div className="bg-gradient-to-br from-[#D4A841] to-[#B8941F] p-4 rounded-2xl shadow-[0_4px_20px_rgba(212,168,65,0.4)] shrink-0">
              <Briefcase size={38} className="text-black" />
            </div>
            <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
              <h3 className={cn("text-[1.25rem] font-extrabold leading-snug text-white", isRTL && "font-cairo")}>
                {isRTL
                  ? 'فواتير ودوفيهات'
                  : 'Devis & Factures'}
              </h3>
              <p className={cn("text-[0.9rem] font-semibold text-[#D4A841]/80 mt-1.5 leading-snug", isRTL && "font-cairo")}>
                {isRTL
                  ? 'اعمل الفاكتير والدوفي بتوعك بسهولة أو حوّل الدوفي لفاتورة'
                  : 'Créez vos factures et devis facilement ou convertissez un devis en facture'}
              </p>
            </div>
          </button>

          {/* CV Maker */}
          <button
            onClick={() => handleNavigate('/pro/cv-generator', 'فتح مُولد CV')}
            className="w-full bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] dark:from-[#0A0A0A] dark:to-[#1A1A1A] p-5 rounded-2xl flex items-center gap-4 active:scale-[0.98] transition-all duration-200 border border-[#D4A841]/20 shadow-md"
          >
            <div className="bg-gradient-to-br from-[#D4A841] to-[#B8941F] p-3.5 rounded-2xl shadow-[0_4px_20px_rgba(212,168,65,0.3)] shrink-0">
              <FileUser size={32} className="text-black" />
            </div>
            <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
              <h3 className={cn("text-[1.15rem] font-extrabold leading-snug text-white", isRTL && "font-cairo")}>
                {isRTL ? 'Smart CV' : 'Smart CV'}
              </h3>
              <p className={cn("text-[0.85rem] font-semibold text-white/50 mt-1", isRTL && "font-cairo")}>
                {isRTL
                  ? 'اعمل سي في بالعربي وأنا أطلعهولك بالفرنساوي'
                  : 'Créez votre CV en quelques minutes'}
              </p>
            </div>
          </button>

          {/* AI Assistant */}
          <button
            onClick={() => handleNavigate('/ai-assistant', 'فتح شبيك لبيك')}
            className="w-full bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] dark:from-[#0A0A0A] dark:to-[#1A1A1A] p-5 rounded-2xl flex items-center gap-4 active:scale-[0.98] transition-all duration-200 border border-[#D4A841]/20 shadow-md"
          >
            <div className="bg-gradient-to-br from-[#D4A841] to-[#B8941F] p-3.5 rounded-2xl shadow-[0_4px_20px_rgba(212,168,65,0.3)] shrink-0">
              <Sparkles size={28} className="text-black" />
            </div>
            <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
              <h3 className={cn("text-[1.15rem] font-extrabold leading-snug text-white", isRTL && "font-cairo")}>
                {isRTL ? 'شبيك لبيك' : 'Assistant IA'}
              </h3>
              <p className={cn("text-[0.85rem] font-semibold text-white/50 mt-1", isRTL && "font-cairo")}>
                {isRTL ? 'اسأل أي سؤال وأنا هاجاوبك فوراً' : 'Réponses instantanées à toutes vos questions'}
              </p>
            </div>
          </button>
        </div>

        {/* Secondary Section - حاجات حديد بنحهزها */}
        <div className="mt-8">
          <h3 className={cn("text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2", isRTL ? "font-cairo flex-row-reverse" : "")}>
            <span className="text-base">🔧</span>
            {isRTL ? 'حاجات حديد بنحهزها' : 'En préparation'}
          </h3>
          <div className="flex flex-col gap-2">
            {/* Language School - compact */}
            <button
              onClick={() => handleNavigate('/language-school', 'فتح مدرسة اللغة')}
              className="w-full bg-card/80 dark:bg-card/50 p-3.5 rounded-xl flex items-center gap-3 active:scale-[0.98] transition-all duration-200 border border-border/50"
            >
              <div className="bg-gradient-to-br from-[#D4A841]/20 to-[#B8941F]/10 p-2.5 rounded-xl shrink-0">
                <GraduationCap size={22} className="text-[#D4A841]" />
              </div>
              <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
                <p className={cn("text-sm font-bold text-foreground", isRTL && "font-cairo")}>
                  {isRTL ? 'برنامج A1 A2 - B1 B2' : 'Programme A1 A2 - B1 B2'}
                </p>
                <p className={cn("text-[11px] text-muted-foreground mt-0.5", isRTL && "font-cairo")}>
                  {isRTL ? 'تحت التجربة والانشاء' : 'En cours de test'}
                </p>
              </div>
            </button>

            <ComingSoonSection />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
