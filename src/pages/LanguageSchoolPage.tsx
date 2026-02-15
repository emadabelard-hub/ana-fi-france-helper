import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, BookOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const levels = [
  { id: 'A1', locked: false, colorClass: 'bg-[#4a9a8a]/15 border-[#4a9a8a]/20 text-[#4a9a8a]' },
  { id: 'A2', locked: true, colorClass: 'bg-[#c2704a]/15 border-[#c2704a]/20 text-[#c2704a]' },
  { id: 'B1', locked: true, colorClass: 'bg-[#8a4a5a]/15 border-[#8a4a5a]/20 text-[#8a4a5a]' },
];

const LanguageSchoolPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  return (
    <div
      className={cn("min-h-screen bg-[#1a1d23] text-white select-none", isRTL && "font-cairo")}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="bg-[#22262e] p-4 pt-14 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
          <ArrowRight size={24} className={cn(!isRTL && "rotate-180")} />
        </button>
        <div className="flex items-center gap-3">
          <div className="bg-[#7c3aed]/15 p-2.5 rounded-xl border border-[#7c3aed]/20">
            <BookOpen size={22} className="text-[#a78bfa]" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-none">
              {isRTL ? 'مدرسة اللغة' : 'École de Langue'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {isRTL ? 'طريقك للورق' : 'Objectif Papiers'}
            </p>
          </div>
        </div>
      </header>

      <main className="px-5 pt-10 pb-32 flex flex-col gap-5">
        {levels.map((level) => (
          <button
            key={level.id}
            disabled={level.locked}
            className={cn(
              "relative w-full p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all duration-200 border border-white/8 bg-[#22262e]",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]",
              level.locked ? "opacity-50 cursor-not-allowed" : "active:scale-95"
            )}
          >
            <div className={cn("p-4 rounded-2xl border", level.colorClass)}>
              {level.locked ? (
                <Lock size={36} />
              ) : (
                <BookOpen size={36} />
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-200">{level.id}</h2>
            {level.locked && (
              <span className="text-xs text-slate-500 font-bold">
                {isRTL ? '🔒 مقفول' : '🔒 Verrouillé'}
              </span>
            )}
          </button>
        ))}
      </main>
    </div>
  );
};

export default LanguageSchoolPage;
