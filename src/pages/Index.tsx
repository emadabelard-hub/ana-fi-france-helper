import { useNavigate } from 'react-router-dom';
import { MessageCircle, Briefcase, Newspaper } from 'lucide-react';
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

      <main className="px-5 pt-8 pb-32">
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1 - Consultations (Glassmorphism Purple) */}
          <button
            onClick={() => navigate('/consultations')}
            className="relative overflow-hidden bg-[#7c3aed]/25 backdrop-blur-xl p-5 rounded-[2rem] shadow-[0_8px_32px_rgba(124,58,237,0.3)] flex flex-col items-center justify-center text-white active:scale-95 transition-all duration-300 border border-white/20 aspect-square hover:shadow-[0_8px_40px_rgba(124,58,237,0.45)] hover:border-white/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/30 to-[#a855f7]/20 rounded-[2rem]" />
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="bg-white/15 p-4 rounded-2xl backdrop-blur-md mb-4 border border-white/10 shadow-lg">
                <MessageCircle size={36} />
              </div>
              <h3 className={cn("font-black text-center text-sm leading-tight", isRTL && "font-cairo")}>
                {isRTL
                  ? 'انا جاي اساعدك واقول لك اي حاجة عايز تعرفها'
                  : 'Je suis là pour t\'aider et répondre à toutes tes questions'}
              </h3>
            </div>
          </button>

          {/* Card 2 - Tools (Glassmorphism Orange) */}
          <button
            onClick={() => navigate('/pro')}
            className="relative overflow-hidden bg-[#f59e0b]/25 backdrop-blur-xl p-5 rounded-[2rem] shadow-[0_8px_32px_rgba(245,158,11,0.3)] flex flex-col items-center justify-center text-white active:scale-95 transition-all duration-300 border border-white/20 aspect-square hover:shadow-[0_8px_40px_rgba(245,158,11,0.45)] hover:border-white/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#f59e0b]/30 to-[#ea580c]/20 rounded-[2rem]" />
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="bg-white/15 p-4 rounded-2xl backdrop-blur-md mb-4 border border-white/10 shadow-lg">
                <Briefcase size={36} />
              </div>
              <h3 className={cn("font-black text-center text-sm leading-tight", isRTL && "font-cairo")}>
                {isRTL
                  ? 'حلول مهنية واحترافية وصانع سي في سهل وسريع على أعلى مستوى'
                  : 'Solutions pro et générateur de CV facile et rapide au plus haut niveau'}
              </h3>
            </div>
          </button>
        </div>

          {/* Card 3 - News (Glassmorphism Red) */}
          <button
            onClick={() => navigate('/news')}
            className="relative overflow-hidden bg-[#ef4444]/25 backdrop-blur-xl p-5 rounded-[2rem] shadow-[0_8px_32px_rgba(239,68,68,0.3)] flex flex-col items-center justify-center gap-4 text-white active:scale-95 transition-all duration-300 border border-white/20 hover:shadow-[0_8px_40px_rgba(239,68,68,0.45)] hover:border-white/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#ef4444]/30 to-[#dc2626]/20 rounded-[2rem]" />
            <div className="relative z-10 flex items-center justify-center gap-4">
              <div className="bg-white/15 p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
                <Newspaper size={32} />
              </div>
              <h3 className={cn("font-black text-lg leading-tight text-center", isRTL && "font-cairo")}>
                {isRTL ? 'أخبار' : 'Actualités / News'}
              </h3>
            </div>
          </button>
      </main>
    </div>
  );
};

export default Index;
