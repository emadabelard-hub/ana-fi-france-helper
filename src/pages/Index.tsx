import { useNavigate } from 'react-router-dom';
import { MessageCircle, Briefcase, Newspaper, GraduationCap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const Index = () => {
  const { language, setLanguage, isRTL, t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "min-h-screen bg-[#1a1d23] text-white select-none overflow-x-hidden",
        isRTL && "font-cairo"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* HEADER */}
      <header className="bg-[#22262e] p-4 pt-14 flex justify-between items-center border-b border-white/5 relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#facc15] rounded-xl flex items-center justify-center text-[#111827] font-black text-lg border-2 border-[#111827] italic">
            AF
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white uppercase italic leading-none">
              {t('header.appName')}
            </h1>
            <div className="h-1 w-full bg-[#facc15] rounded-full mt-1 opacity-40"></div>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="flex bg-[#14161a] p-1.5 rounded-2xl border border-white/8">
          <button
            onClick={() => setLanguage('fr')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'fr' ? 'bg-[#3b82f6] text-white' : 'text-slate-500'
            )}
          >
            FR
          </button>
          <button
            onClick={() => setLanguage('ar')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'ar' ? 'bg-[#3b82f6] text-white' : 'text-slate-500'
            )}
          >
            عربي
          </button>
        </div>
      </header>

      <main className="px-5 pt-8 pb-32">
        {/* Top Row: 2 Square Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1 - Consultations (Muted Burnt Orange) */}
          <button
            onClick={() => navigate('/consultations')}
            className="bg-[#2e2420] p-5 rounded-2xl flex flex-col items-center justify-center text-white active:scale-95 transition-all duration-200 border border-[#4a3628]/40 aspect-square shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
          >
            <div className="bg-[#c2704a]/15 p-4 rounded-2xl mb-4 border border-[#c2704a]/20">
              <MessageCircle size={36} className="text-[#c2704a]" />
            </div>
            <h3 className={cn("font-black text-center text-sm leading-tight text-slate-200", isRTL && "font-cairo")}>
              {isRTL
                ? 'انا جاي اساعدك واقول لك اي حاجة عايز تعرفها'
                : 'Je suis là pour t\'aider et répondre à toutes tes questions'}
            </h3>
          </button>

          {/* Card 2 - Tools (Muted Deep Teal) */}
          <button
            onClick={() => navigate('/pro')}
            className="bg-[#1c2a2e] p-5 rounded-2xl flex flex-col items-center justify-center text-white active:scale-95 transition-all duration-200 border border-[#2a4a50]/40 aspect-square shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
          >
            <div className="bg-[#4a9a8a]/15 p-4 rounded-2xl mb-4 border border-[#4a9a8a]/20">
              <Briefcase size={36} className="text-[#4a9a8a]" />
            </div>
            <h3 className={cn("font-black text-center text-sm leading-tight text-slate-200", isRTL && "font-cairo")}>
              {isRTL
                ? 'حلول مهنية واحترافية وصانع سي في سهل وسريع على أعلى مستوى'
                : 'Solutions pro et générateur de CV facile et rapide au plus haut niveau'}
            </h3>
          </button>
        </div>

        {/* Bottom Row: 2 Wide Cards */}
        <button
          onClick={() => navigate('/news')}
          className="w-full mt-4 bg-[#2a1e24] p-5 rounded-2xl flex items-center justify-center gap-4 text-white active:scale-95 transition-all duration-200 border border-[#4a2838]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
        >
          <div className="bg-[#8a4a5a]/15 p-4 rounded-2xl border border-[#8a4a5a]/20">
            <Newspaper size={32} className="text-[#8a4a5a]" />
          </div>
          <h3 className={cn("font-black text-lg leading-tight text-center text-slate-200", isRTL && "font-cairo")}>
            {isRTL ? 'أخبار' : 'Actualités / News'}
          </h3>
        </button>

        {/* Language School Card (Muted Pastel Purple) */}
        <button
          onClick={() => navigate('/language-school')}
          className="w-full mt-4 bg-[#241e2e] p-5 rounded-2xl flex items-center justify-center gap-4 text-white active:scale-95 transition-all duration-200 border border-[#3a2850]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
        >
          <div className="bg-[#7c3aed]/15 p-4 rounded-2xl border border-[#7c3aed]/20">
            <GraduationCap size={32} className="text-[#a78bfa]" />
          </div>
          <h3 className={cn("font-black text-lg leading-tight text-center text-slate-200", isRTL && "font-cairo")}>
            {isRTL ? 'مدرسة اللغة - طريقك للورق' : 'École de Langue - Objectif Papiers'}
          </h3>
        </button>
      </main>
    </div>
  );
};

export default Index;
