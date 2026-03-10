import { useNavigate } from 'react-router-dom';
import { Briefcase, Sparkles, FileUser, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import WelcomeModal from '@/components/home/WelcomeModal';
import ComingSoonSection from '@/components/home/ComingSoonSection';
import GDPRTrustBox from '@/components/shared/GDPRTrustBox';
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

      <main className="px-4 flex flex-col justify-between pb-20" style={{ minHeight: 'calc(100vh - 90px)' }}>
        {/* DOMINANT CARDS — 80% of space */}
        <div className="flex flex-col gap-5 flex-1 py-4">

          {/* Hero: Devis & Factures */}
          <button
            onClick={() => handleNavigate('/document-hub', 'فتح أدوات Pro (دوفي/فاتورة)')}
            className="w-full rounded-2xl flex flex-col items-center gap-5 active:scale-[0.98] hover:scale-[1.02] transition-all duration-300 border border-[hsl(200,60%,80%)] dark:border-[hsl(220,40%,30%)] shadow-[0_12px_40px_-12px_hsl(200_60%_70%/0.3)] hover:shadow-[0_20px_50px_-12px_hsl(200_60%_60%/0.45)] hover:-translate-y-1 flex-[2] p-5 animate-fade-in bg-[#E3F2FD] dark:bg-[#0D1B2A]"
            dir="rtl"
          >
            <div className="w-20 h-20 rounded-2xl shadow-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #FFD700, #E6B800)' }}>
              <Briefcase size={44} className="text-white drop-shadow-md" />
            </div>
            <div className="text-center w-full font-cairo space-y-2.5">
              <h3 className="text-[16px] font-bold leading-relaxed flex items-center gap-1.5 justify-center flex-wrap text-[#0D1B2A] dark:text-white">
                <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
                {isRTL
                  ? 'حساباتك في جيبك ودوفيهاتك قانونية 100% 🚀'
                  : 'Vos comptes en poche, devis 100% légaux 🚀'}
              </h3>
              <p className="text-[16px] font-medium leading-relaxed text-[#1B3A5C] dark:text-gray-200">
                {isRTL
                  ? 'اكتب بالعربي وطلّع فاتورة Factur-X في ثانية.'
                  : 'Écrivez en arabe, générez une facture Factur-X en une seconde.'}
              </p>
              <p className="text-[16px] font-medium leading-relaxed text-[#1B3A5C] dark:text-gray-200">
                {isRTL
                  ? 'تفادى الغرامات، ودوس زرار وابعث للمحاسب فوراً!'
                  : 'Évitez les amendes, envoyez au comptable en un clic !'}
              </p>
            </div>
          </button>

          {/* Smart CV */}
          <button
            onClick={() => handleNavigate('/pro/cv-generator', 'فتح مُولد CV')}
            className="w-full bg-card rounded-3xl flex flex-col items-center justify-center gap-5 active:scale-[0.98] transition-all duration-300 border border-[hsl(195,100%,50%)]/20 shadow-[0_8px_30px_-10px_hsl(195_100%_40%/0.35)] hover:shadow-[0_16px_40px_-10px_hsl(195_100%_40%/0.5)] hover:-translate-y-1 flex-1 py-8 animate-fade-in"
          >
            <div className="w-20 h-20 rounded-2xl shadow-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00BFFF, #0099CC)' }}>
              <FileUser size={46} className="text-white drop-shadow-md" />
            </div>
            <div className="text-center px-6">
              <h3 className={cn("text-xl font-extrabold leading-snug text-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'Smart CV' : 'Smart CV'}
              </h3>
              <p className={cn("text-sm font-medium text-muted-foreground mt-2", isRTL && "font-cairo")}>
                {isRTL
                  ? 'اعمل سي في بالعربي وأنا أطلعهولك بالفرنساوي'
                  : 'Créez votre CV en quelques minutes'}
              </p>
            </div>
          </button>
        </div>

        

        {/* BOTTOM SECTION — flush above nav */}
        <div className="flex flex-col gap-3 mt-4">
          {/* شبيك لبيك — Elegant large card */}
          <button
            onClick={() => handleNavigate('/ai-assistant', 'فتح شبيك لبيك')}
            className="w-full rounded-2xl flex items-center gap-4 p-4 active:scale-[0.98] transition-all duration-300 border border-[#E1BEE7] shadow-[0_6px_24px_-6px_hsl(271_76%_40%/0.3)] hover:shadow-[0_14px_36px_-6px_hsl(271_76%_40%/0.45)] hover:-translate-y-1 animate-fade-in bg-[#F3E5F5] dark:bg-[#1A0A2E] dark:border-[hsl(271,40%,30%)]"
          >
            <div className="w-14 h-14 rounded-2xl shrink-0 shadow-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8A2BE2, #6A1FB0)' }}>
              <Sparkles size={28} className="text-white drop-shadow-md" />
            </div>
            <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
              <span className={cn("text-base font-bold text-foreground block", isRTL && "font-cairo")}>
                {isRTL ? 'شبيك لبيك — المساعد الذكي' : 'Assistant IA — Shabik Labik'}
              </span>
              <span className={cn("text-sm text-muted-foreground mt-0.5 block", isRTL && "font-cairo")}>
                {isRTL ? 'اسألني أي حاجة' : 'Posez-moi une question'}
              </span>
            </div>
            <svg className={cn("w-5 h-5 text-muted-foreground", isRTL && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* حاجات جديدة — absolute bottom */}
          <ComingSoonSection />

          {/* Trust Shield */}
          <GDPRTrustBox />
        </div>
      </main>
    </div>
  );
};

export default Index;
