import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles, Scale, ChevronRight, Lock, Euro } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ConsultationsPage = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="py-4 space-y-6 pb-32">
      <section className={cn("text-center", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isRTL ? 'استشارات' : 'Consultations'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'اسأل واحصل على إجابات فورية' : 'Posez vos questions et obtenez des réponses instantanées'}
        </p>
      </section>

      <div className="space-y-5">
        {/* Assistant IA - Free */}
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

        {/* Premium Consultation Pro — with Premium badge & lock */}
        <button
          onClick={() => navigate('/premium-consultation')}
          className="relative w-full bg-gradient-to-r from-[#f59e0b] to-[#ea580c] p-6 rounded-[2.5rem] shadow-xl flex items-center justify-between text-white active:scale-95 transition-transform border border-white/10"
        >
          <Badge className="absolute top-3 right-3 bg-white/25 text-white border-0 text-[10px] font-bold px-2.5 py-1 backdrop-blur-sm flex items-center gap-1 z-10">
            <Lock size={10} />
            Premium
          </Badge>
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
            <Scale size={32} />
          </div>
          <div className={cn("flex-1 pr-4", isRTL ? "text-right" : "text-left pl-4")}>
            <h3 className={cn("font-black text-xl leading-none mb-1", isRTL && "font-cairo")}>
              {isRTL ? 'المستشار القانوني والمهني الاحترافي' : 'Consultation Pro'}
            </h3>
            <p className={cn("text-[11px] font-bold opacity-80", isRTL && "font-cairo")}>
              {isRTL ? 'محامي • محاسب • ترجمة • رد رسمي • 8 €' : 'Avocat • Comptable • Traduction • Réponse • 8 €'}
            </p>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <ChevronRight size={18} className={isRTL ? "rotate-180" : ""} />
          </div>
        </button>
      </div>
    </div>
  );
};

export default ConsultationsPage;
