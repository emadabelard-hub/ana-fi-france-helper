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

      <main className="px-5 pt-8 pb-32">
        <ComingSoonSection />

        <h2 className={cn("text-lg font-black text-foreground mb-4", isRTL ? "font-cairo text-right" : "text-left")}>
          {isRTL ? '🤝 أنا جاي أساعدك' : '🤝 Je suis là pour t\'aider'}
        </h2>

        {/* Position 1: Solutions Pro (Devis/Factures) */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => handleNavigate('/pro', 'فتح أدوات Pro (دوفي/فاتورة)')}
            className="w-full bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB] dark:from-[#0A1628] dark:to-[#0D1B2A] p-6 rounded-2xl flex items-center gap-5 active:scale-[0.98] transition-all duration-200 border border-[#64B5F6]/30 dark:border-[#3B82F6]/20 shadow-sm min-h-[120px]"
          >
            <div className="bg-gradient-to-br from-[#A5D6A7] to-[#66BB6A] dark:from-[#10B981] dark:to-[#059669] p-4 rounded-2xl shadow-[0_4px_20px_rgba(102,187,106,0.3)] dark:shadow-[0_4px_20px_rgba(16,185,129,0.3)] shrink-0">
              <Briefcase size={36} className="text-white" />
            </div>
            <h3 className={cn("text-[1.2rem] font-extrabold leading-snug text-black", isRTL ? "font-cairo text-right" : "text-left")}>
              {isRTL
                ? 'اعمل دوفيهاتك وفواتيرك بالعربي يطلعوا لك بالفرنساوي'
                : 'Smart: le système intelligent pour générer les factures et les devis'}
            </h3>
          </button>
        </div>

        {/* Position 2: CV Maker */}
        <button
          onClick={() => handleNavigate('/pro/cv-generator', 'فتح مُولد CV')}
          className="w-full mt-4 bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] dark:from-[#0A2A14] dark:to-[#081F0D] p-5 rounded-2xl flex items-center gap-4 active:scale-[0.98] transition-all duration-200 border border-[#81C784]/30 dark:border-[#22C55E]/20 shadow-sm"
        >
          <div className="bg-gradient-to-br from-[#26A69A] to-[#00897B] dark:from-[#14B8A6] dark:to-[#0D9488] p-4 rounded-2xl shadow-[0_4px_20px_rgba(38,166,154,0.3)] dark:shadow-[0_4px_20px_rgba(20,184,166,0.3)] shrink-0">
            <FileUser size={32} className="text-white" />
          </div>
          <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
            <p className={cn("text-[1.2rem] font-extrabold text-black leading-snug", isRTL && "font-cairo")}>
              {isRTL
                ? 'اعمل سي في بالعربي وأنا أطلعهولك بالفرنساوي'
                : 'Smart CV en quelques minutes'}
            </p>
          </div>
        </button>

        {/* Position 3: AI Assistant */}
        <button
          onClick={() => handleNavigate('/ai-assistant', 'فتح شبيك لبيك')}
          className="w-full mt-4 bg-gradient-to-br from-[#EDE7F6] to-[#D1C4E9] dark:from-[#1A0A2E] dark:to-[#140820] p-5 rounded-2xl flex items-center gap-4 active:scale-[0.98] transition-all duration-200 border border-[#B39DDB]/30 dark:border-[#7C3AED]/20 shadow-sm"
        >
          <div className="bg-gradient-to-br from-[#7c3aed] to-[#a855f7] p-3.5 rounded-2xl shadow-[0_4px_20px_rgba(124,58,237,0.3)] shrink-0">
            <Sparkles size={28} className="text-white" />
          </div>
          <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
            <h3 className={cn("text-[1.2rem] font-extrabold leading-snug text-black", isRTL && "font-cairo")}>
              {isRTL ? 'شبيك لبيك' : 'Assistant IA'}
            </h3>
            <p className={cn("text-[1rem] font-bold text-black/80 mt-1", isRTL && "font-cairo")}>
              {isRTL ? 'اسأل أي سؤال وأنا هاجاوبك فوراً يا فندم' : 'Smart : réponses instantanées à toutes vos questions'}
            </p>
          </div>
        </button>

        {/* News Card */}
        <button
          onClick={() => handleNavigate('/news', 'فتح الأخبار')}
          className="w-full mt-4 bg-gradient-to-r from-[#FFEBEE] to-[#FFCDD2] dark:from-[#2A0A0A] dark:to-[#1F0808] p-5 rounded-2xl flex items-center justify-center gap-4 text-[#1A1A1C] active:scale-95 transition-all duration-200 border border-[#EF9A9A]/30 dark:border-[#EF4444]/20 shadow-sm"
        >
          <div className="bg-gradient-to-br from-[#90CAF9] to-[#42A5F5] dark:from-[#3B82F6] dark:to-[#2563EB] p-4 rounded-2xl shadow-[0_4px_20px_rgba(66,165,245,0.3)] dark:shadow-[0_4px_20px_rgba(59,130,246,0.3)]">
            <Newspaper size={32} className="text-white" />
          </div>
          <h3 className={cn("text-[1.2rem] font-extrabold leading-tight text-center text-black", isRTL && "font-cairo")}>
            {isRTL ? 'أخبار' : 'Actualités / News'}
          </h3>
        </button>

        {/* Language School Card */}
        <button
          onClick={() => handleNavigate('/language-school', 'فتح مدرسة اللغة')}
          className="w-full mt-4 bg-gradient-to-r from-[#F3E5F5] to-[#E1BEE7] dark:from-[#1A0A2A] dark:to-[#140820] p-5 rounded-2xl flex items-center justify-center gap-4 text-[#1A1A1C] active:scale-95 transition-all duration-200 border border-[#CE93D8]/30 dark:border-[#8B5CF6]/20 shadow-sm"
        >
          <div className="bg-gradient-to-br from-[#CE93D8] to-[#AB47BC] dark:from-[#8B5CF6] dark:to-[#7C3AED] p-4 rounded-2xl shadow-[0_4px_20px_rgba(171,71,188,0.3)] dark:shadow-[0_4px_20px_rgba(139,92,246,0.3)]">
            <GraduationCap size={32} className="text-white" />
          </div>
          <div className={cn("text-[1.2rem] font-extrabold leading-tight text-center text-black", isRTL && "font-cairo")}>
            {isRTL ? (
              <>
                <div>برنامج A1 A2 - B1 B2</div>
                <div className="text-[1rem] font-bold mt-1 text-black/70">تحت التجربة والانشاء</div>
              </>
            ) : (
              <>
                <div>Programme A1 A2 - B1 B2</div>
                <div className="text-[1rem] font-bold mt-1 text-black/70">En cours de test et construction</div>
              </>
            )}
          </div>
        </button>
      </main>
    </div>
  );
};

export default Index;
