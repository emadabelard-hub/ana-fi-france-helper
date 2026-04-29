import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Lock, GraduationCap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import ProgressRing from '@/components/language/ProgressRing';
import LessonEngine from '@/components/language/LessonEngine';

const levels = [
  {
    id: 'A1',
    locked: false,
    titleFr: 'A1 - Débutant',
    titleAr: 'A1 - مبتدئ',
    descFr: 'Objectif OFII',
    descAr: 'هدف OFII',
    progress: 0,
    colorClass: 'bg-[#4a9a8a]/15 border-[#4a9a8a]/25 text-[#4a9a8a]',
    iconBg: 'bg-[#4a9a8a]/10',
  },
  {
    id: 'A2',
    locked: true,
    titleFr: 'A2 - Élémentaire',
    titleAr: 'A2 - أساسي',
    descFr: 'Objectif Titre de Séjour',
    descAr: 'هدف بطاقة الإقامة',
    progress: 0,
    colorClass: 'bg-[#c2704a]/15 border-[#c2704a]/25 text-[#c2704a]',
    iconBg: 'bg-[#c2704a]/10',
  },
  {
    id: 'B1',
    locked: true,
    titleFr: 'B1 - Intermédiaire',
    titleAr: 'B1 - متوسط',
    descFr: 'Objectif Naturalisation',
    descAr: 'هدف الجنسية',
    progress: 0,
    colorClass: 'bg-[#8a4a5a]/15 border-[#8a4a5a]/25 text-[#8a4a5a]',
    iconBg: 'bg-[#8a4a5a]/10',
  },
];

const LanguageSchoolPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [activeLevel, setActiveLevel] = useState<string | null>(null);

  if (activeLevel) {
    return <LessonEngine onClose={() => setActiveLevel(null)} />;
  }

  return (
    <div
      className={cn('min-h-screen bg-[#1a1d23] text-white select-none', isRTL && 'font-cairo')}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <header className="bg-[#22262e] p-4 pt-14 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white transition-colors">
          <ArrowRight size={24} className={cn(!isRTL && 'rotate-180')} />
        </button>
        <div className="flex items-center gap-3">
          <div className="bg-[#7c3aed]/15 p-2.5 rounded-xl border border-[#7c3aed]/20">
            <GraduationCap size={22} className="text-[#a78bfa]" />
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

      {/* Level Cards */}
      <main className="px-5 pt-8 pb-32 flex flex-col gap-5">
        {levels.map((level) => (
          <button
            key={level.id}
            disabled={level.locked}
            onClick={() => !level.locked && setActiveLevel(level.id)}
            className={cn(
              'relative w-full rounded-2xl flex items-center gap-5 p-6 transition-all duration-200 border border-white/8 bg-[#22262e]',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]',
              level.locked ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.97]'
            )}
          >
            {/* Icon */}
            <div className={cn('p-4 rounded-2xl border shrink-0', level.colorClass)}>
              {level.locked ? <Lock size={28} /> : <BookOpen size={28} />}
            </div>

            {/* Text */}
            <div className="flex-1 text-start min-w-0">
              <h2 className="text-lg font-black text-slate-200 truncate">
                {isRTL ? level.titleAr : level.titleFr}
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-bold">
                {isRTL ? level.descAr : level.descFr}
              </p>
              {level.locked && (
                <span className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 inline-block">
                  {isRTL ? '🔒 مقفول' : '🔒 Verrouillé'}
                </span>
              )}
            </div>

            {/* Progress Ring */}
            <ProgressRing progress={level.progress} size={52} strokeWidth={4} />
          </button>
        ))}
      </main>
    </div>
  );
};

export default LanguageSchoolPage;
