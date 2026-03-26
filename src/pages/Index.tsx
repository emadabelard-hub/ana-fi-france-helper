import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Sparkles, FileUser, ShieldCheck, Wallet, Building2 } from 'lucide-react';
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

  // Allow pull-to-refresh only on home page
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
        {/* MAIN ACTION CARDS */}
        <div className="flex flex-col gap-4 flex-1 py-4">

          {/* 1. قسم الفواتير والدوفيهات — Document Hub */}
          <button
            onClick={() => handleNavigate('/document-hub', 'فتح قسم الفواتير والدوفيهات')}
            className="w-full rounded-2xl flex items-center gap-4 p-5 active:scale-[0.98] hover:scale-[1.02] transition-all duration-300 border border-[hsl(200,60%,80%)] dark:border-[hsl(220,40%,30%)] shadow-[0_12px_40px_-12px_hsl(200_60%_70%/0.3)] hover:shadow-[0_20px_50px_-12px_hsl(200_60%_60%/0.45)] hover:-translate-y-1 animate-fade-in bg-[#E3F2FD] dark:bg-[#0D1B2A]"
            dir="rtl"
          >
            <div className="w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #FFD700, #E6B800)' }}>
              <Briefcase size={36} className="text-white drop-shadow-md" />
            </div>
            <div className="flex-1 text-right font-cairo space-y-1.5">
              <h3 className="text-[16px] font-bold leading-relaxed flex items-center gap-1.5 justify-start flex-wrap text-[#0D1B2A] dark:text-white">
                <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
                {isRTL ? 'قسم الفواتير والدوفيهات' : 'Factures & Devis'}
              </h3>
              <p className="text-[14px] font-medium leading-relaxed text-[#1B3A5C] dark:text-gray-300">
                {isRTL
                  ? 'اكتب بالعربي وطلّع فاتورة Factur-X في ثانية 🚀'
                  : 'Créez vos factures et devis Factur-X en un clic 🚀'}
              </p>
            </div>
            <svg className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* 2. قسم الحسابات — Accounting */}
          <button
            onClick={() => handleNavigate('/expenses', 'فتح قسم الحسابات')}
            className="w-full rounded-2xl flex items-center gap-4 p-5 active:scale-[0.98] hover:scale-[1.02] transition-all duration-300 border border-[hsl(160,50%,75%)] dark:border-[hsl(160,30%,25%)] shadow-[0_8px_30px_-10px_hsl(160_50%_40%/0.3)] hover:shadow-[0_16px_40px_-10px_hsl(160_50%_40%/0.45)] hover:-translate-y-1 animate-fade-in bg-[#E8F5E9] dark:bg-[#0A1F12]"
            dir="rtl"
          >
            <div className="w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #0D9488, #16A34A)' }}>
              <Wallet size={36} className="text-white drop-shadow-md" />
            </div>
            <div className="flex-1 text-right font-cairo space-y-1.5">
              <h3 className="text-[16px] font-bold leading-relaxed text-[#0D1B2A] dark:text-white">
                {isRTL ? 'قسم الحسابات' : 'Comptabilité'}
              </h3>
              <p className="text-[14px] font-medium leading-relaxed text-[#1B3A5C] dark:text-gray-300">
                {isRTL
                  ? 'الحسابات، العملاء، والمشاريع في مكان واحد 💼'
                  : 'Dépenses, clients et chantiers au même endroit 💼'}
              </p>
            </div>
            <svg className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* 3. بيانات شركتي — Company Profile */}
          <button
            onClick={() => handleNavigate('/profile', 'فتح بيانات شركتي')}
            className="w-full rounded-2xl flex items-center gap-4 p-5 active:scale-[0.98] hover:scale-[1.02] transition-all duration-300 border border-[hsl(220,50%,80%)] dark:border-[hsl(220,30%,25%)] shadow-[0_8px_30px_-10px_hsl(220_50%_40%/0.3)] hover:shadow-[0_16px_40px_-10px_hsl(220_50%_40%/0.45)] hover:-translate-y-1 animate-fade-in bg-[#E8EAF6] dark:bg-[#0D0F2A]"
            dir="rtl"
          >
            <div className="w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #3F51B5, #1A237E)' }}>
              <Building2 size={36} className="text-white drop-shadow-md" />
            </div>
            <div className="flex-1 text-right font-cairo space-y-1.5">
              <h3 className="text-[16px] font-bold leading-relaxed text-[#0D1B2A] dark:text-white">
                {isRTL ? 'بيانات شركتي' : 'Mon Entreprise'}
              </h3>
              <p className="text-[14px] font-medium leading-relaxed text-[#1B3A5C] dark:text-gray-300">
                {isRTL
                  ? 'SIRET، العنوان، التأمين، والختم 🏢'
                  : 'SIRET, adresse, assurance et cachet 🏢'}
              </p>
            </div>
            <svg className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Smart CV */}
          <button
            onClick={() => handleNavigate('/pro/cv-generator', 'فتح مُولد CV')}
            className="w-full bg-card rounded-3xl flex items-center gap-4 p-5 active:scale-[0.98] transition-all duration-300 border border-[hsl(195,100%,50%)]/20 shadow-[0_8px_30px_-10px_hsl(195_100%_40%/0.35)] hover:shadow-[0_16px_40px_-10px_hsl(195_100%_40%/0.5)] hover:-translate-y-1 animate-fade-in"
            dir="rtl"
          >
            <div className="w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #00BFFF, #0099CC)' }}>
              <FileUser size={36} className="text-white drop-shadow-md" />
            </div>
            <div className="flex-1 text-right font-cairo space-y-1.5">
              <h3 className="text-[16px] font-bold leading-relaxed text-foreground">
                Smart CV
              </h3>
              <p className="text-[14px] font-medium text-muted-foreground">
                {isRTL
                  ? 'اعمل سي في بالعربي وأنا أطلعهولك بالفرنساوي 📝'
                  : 'Créez votre CV en quelques minutes 📝'}
              </p>
            </div>
            <svg className="w-5 h-5 text-muted-foreground rotate-180 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* BOTTOM SECTION */}
        <div className="flex flex-col gap-3 mt-4">
          {/* شبيك لبيك — Assistant */}
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

          <ComingSoonSection />
          <GDPRTrustBox />
        </div>
      </main>
    </div>
  );
};

export default Index;
