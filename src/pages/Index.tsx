import { useNavigate } from 'react-router-dom';
import { FileText, FileUser, Newspaper, ChevronRight, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const Index = () => {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "min-h-screen bg-[#0b0f1a] text-white select-none overflow-x-hidden",
        isRTL && "font-cairo"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* HEADER */}
      <header className="bg-[#1e293b] p-4 pt-14 flex justify-between items-center shadow-lg border-b border-white/5 relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#facc15] rounded-xl flex items-center justify-center text-[#111827] font-black text-lg border-2 border-[#111827] italic shadow-lg shadow-yellow-500/10">
            AF
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white uppercase italic leading-none">
              {t('header.appName')}
            </h1>
            <div className="h-1 w-full bg-[#facc15] rounded-full mt-1 opacity-50"></div>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="flex bg-[#0f172a] p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => setLanguage('fr')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'fr' ? 'bg-[#3b82f6] text-white shadow-lg' : 'text-slate-500'
            )}
          >
            FR
          </button>
          <button
            onClick={() => setLanguage('ar')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'ar' ? 'bg-[#3b82f6] text-white shadow-lg' : 'text-slate-500'
            )}
          >
            عربي
          </button>
        </div>
      </header>

      <main className="space-y-5 pb-32 px-5 pt-6">
        {/* Factures & Devis */}
        <button
          onClick={() => navigate('/pro/invoice-creator')}
          className="w-full bg-[#ffedd5] p-6 rounded-[2.2rem] shadow-lg flex items-center justify-between active:scale-95 transition-transform border-b-4 border-orange-200"
        >
          <div className="bg-[#f97316] p-4 rounded-2xl text-white shadow-lg">
            <FileText size={32} />
          </div>
          <div className={cn("flex-1 pr-4", isRTL ? "text-right" : "text-left pl-4")}>
            <h3 className={cn("font-black text-[#431407] text-xl leading-tight", isRTL && "font-cairo")}>
              {t('dashboard.invoiceCard')}
            </h3>
            <p className={cn("text-[11px] font-bold text-orange-600 mt-1 uppercase opacity-60", isRTL && "font-cairo")}>
              {t('dashboard.invoiceCardSub')}
            </p>
          </div>
          <div className="bg-orange-200 p-2 rounded-full">
            <ChevronRight size={18} className={cn("text-orange-800", isRTL && "rotate-180")} />
          </div>
        </button>

        {/* Mon CV Pro */}
        <button
          onClick={() => navigate('/pro/cv-generator')}
          className="w-full bg-[#e0e7ff] p-6 rounded-[2.2rem] shadow-lg flex items-center justify-between active:scale-95 transition-transform border-b-4 border-indigo-200"
        >
          <div className="bg-[#4f46e5] p-4 rounded-2xl text-white shadow-lg">
            <FileUser size={32} />
          </div>
          <div className={cn("flex-1 pr-4", isRTL ? "text-right" : "text-left pl-4")}>
            <h3 className={cn("font-black text-[#1e1b4b] text-xl leading-tight", isRTL && "font-cairo")}>
              {t('dashboard.cvCard')}
            </h3>
            <p className={cn("text-[11px] font-bold text-indigo-600 mt-1 uppercase opacity-60", isRTL && "font-cairo")}>
              {t('dashboard.cvCardSub')}
            </p>
          </div>
          <div className="bg-indigo-200 p-2 rounded-full">
            <ChevronRight size={18} className={cn("text-indigo-800", isRTL && "rotate-180")} />
          </div>
        </button>

        {/* Assistant IA */}
        <button
          onClick={() => navigate('/ai-assistant')}
          className="w-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] p-6 rounded-[2.5rem] shadow-xl flex items-center justify-between text-white active:scale-95 transition-transform border border-white/5"
        >
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
            <Sparkles size={32} />
          </div>
          <div className={cn("flex-1 pr-4", isRTL ? "text-right" : "text-left pl-4")}>
            <h3 className={cn("font-black text-xl leading-none mb-1", isRTL && "font-cairo")}>
              {language === 'fr' ? 'Votre Assistant IA' : 'شبيك لبيك اسأل وانا اجاوب'}
            </h3>
            <p className={cn("text-[11px] font-bold opacity-80", isRTL && "font-cairo")}>
              {language === 'fr' ? 'Gratuit • Réponses instantanées' : 'مجاني • ردود فورية'}
            </p>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <ChevronRight size={18} className={isRTL ? "rotate-180" : ""} />
          </div>
        </button>

        {/* Actualités / News */}
        <button
          onClick={() => navigate('/news')}
          className="w-full bg-gradient-to-r from-[#dc2626] to-[#ef4444] p-6 rounded-[2.5rem] shadow-xl flex items-center justify-between text-white active:scale-95 transition-transform border border-white/5"
        >
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
            <Newspaper size={32} />
          </div>
          <div className={cn("flex-1 pr-4", isRTL ? "text-right" : "text-left pl-4")}>
            <h3 className={cn("font-black text-xl leading-none mb-1", isRTL && "font-cairo")}>
              {language === 'fr' ? 'Actualités' : 'أخبار'}
            </h3>
            <p className={cn("text-[11px] font-bold opacity-80", isRTL && "font-cairo")}>
              {language === 'fr' ? 'Égypte • France • Sport' : 'مصر • فرنسا • رياضة'}
            </p>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <ChevronRight size={18} className={isRTL ? "rotate-180" : ""} />
          </div>
        </button>
      </main>
    </div>
  );
};

export default Index;
