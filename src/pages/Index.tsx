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
        "min-h-screen bg-background text-foreground select-none overflow-x-hidden",
        isRTL && "font-cairo"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* HEADER */}
      <header className="bg-card p-4 pt-14 flex justify-between items-center border-b border-border relative z-50">
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
        {/* Top Row: 2 Square Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1 - Consultations (Muted Burnt Orange) */}
          <button
            onClick={() => navigate('/consultations')}
            className="bg-card p-5 rounded-2xl flex flex-col items-center justify-center text-foreground active:scale-95 transition-all duration-200 border border-border aspect-square shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
          >
            <div className="bg-orange-500/15 p-4 rounded-2xl mb-4 border border-orange-500/20">
              <MessageCircle size={36} className="text-orange-400" />
            </div>
            <h3 className={cn("font-black text-center text-sm leading-tight text-foreground", isRTL && "font-cairo")}>
              {isRTL
                ? 'انا جاي اساعدك واقول لك اي حاجة عايز تعرفها'
                : 'Je suis là pour t\'aider et répondre à toutes tes questions'}
            </h3>
          </button>

          {/* Card 2 - Tools (Muted Deep Teal) */}
          <button
            onClick={() => navigate('/pro')}
            className="bg-card p-5 rounded-2xl flex flex-col items-center justify-center text-foreground active:scale-95 transition-all duration-200 border border-border aspect-square shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
          >
            <div className="bg-teal-500/15 p-4 rounded-2xl mb-4 border border-teal-500/20">
              <Briefcase size={36} className="text-teal-400" />
            </div>
            <h3 className={cn("font-black text-center text-sm leading-tight text-foreground", isRTL && "font-cairo")}>
              {isRTL
                ? 'حلول مهنية واحترافية وصانع سي في سهل وسريع على أعلى مستوى'
                : 'Solutions pro et générateur de CV facile et rapide au plus haut niveau'}
            </h3>
          </button>
        </div>

        {/* Bottom Row: 2 Wide Cards */}
        <button
          onClick={() => navigate('/news')}
          className="w-full mt-4 bg-card p-5 rounded-2xl flex items-center justify-center gap-4 text-foreground active:scale-95 transition-all duration-200 border border-border shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
        >
          <div className="bg-rose-500/15 p-4 rounded-2xl border border-rose-500/20">
            <Newspaper size={32} className="text-rose-400" />
          </div>
          <h3 className={cn("font-black text-lg leading-tight text-center text-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'أخبار' : 'Actualités / News'}
          </h3>
        </button>

        {/* Language School Card (Muted Pastel Purple) */}
        <button
          onClick={() => navigate('/language-school')}
          className="w-full mt-4 bg-card p-5 rounded-2xl flex items-center justify-center gap-4 text-foreground active:scale-95 transition-all duration-200 border border-border shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
        >
          <div className="bg-violet-500/15 p-4 rounded-2xl border border-violet-500/20">
            <GraduationCap size={32} className="text-violet-400" />
          </div>
          <h3 className={cn("font-black text-lg leading-tight text-center text-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'مدرسة اللغة - طريقك للورق' : 'École de Langue - Objectif Papiers'}
          </h3>
        </button>
      </main>
    </div>
  );
};

export default Index;
