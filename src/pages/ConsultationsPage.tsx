import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles, Scale, ChevronRight, ShieldCheck } from 'lucide-react';
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

        {/* Premium Consultation Pro */}
        <button
          onClick={() => navigate('/premium-consultation')}
          className="w-full bg-gradient-to-r from-[#f59e0b] to-[#ea580c] p-6 rounded-[2.5rem] shadow-xl flex items-center justify-between text-white active:scale-95 transition-transform border border-white/10"
        >
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
            <Scale size={32} />
          </div>
          <div className={cn("flex-1 pr-4", isRTL ? "text-right" : "text-left pl-4")}>
            <h3 className={cn("font-black text-xl leading-none mb-1", isRTL && "font-cairo")}>
              {isRTL ? 'المستشار القانوني والمهني الاحترافي' : 'Consultation Pro'}
            </h3>
            <p className={cn("text-[11px] font-bold opacity-80", isRTL && "font-cairo")}>
              {isRTL ? 'محامي • محاسب • ترجمة • رد رسمي' : 'Avocat • Comptable • Traduction • Réponse'}
            </p>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <ChevronRight size={18} className={isRTL ? "rotate-180" : ""} />
          </div>
        </button>

        {/* Protected Consultations — Locked Premium */}
        <div className="relative w-full p-6 rounded-[2.5rem] shadow-xl flex items-center justify-between border border-white/10 bg-gradient-to-r from-slate-700/60 to-slate-800/60 opacity-70 cursor-not-allowed">
          <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
            <ShieldCheck size={32} className="text-slate-400" />
          </div>
          <div className={cn("flex-1 pr-4", isRTL ? "text-right" : "text-left pl-4")}>
            <h3 className={cn("font-black text-xl leading-none mb-1 text-slate-300", isRTL && "font-cairo")}>
              {isRTL ? 'الاستشارات المحمية' : 'Consultations Protégées'}
            </h3>
            <p className={cn("text-[11px] font-bold text-slate-400 mt-1", isRTL && "font-cairo")}>
              {isRTL 
                ? 'هذه الميزة تستخدم ذكاء اصطناعي متقدم وتتطلب اشتراك Premium 🔒'
                : 'Cette fonctionnalité utilise une IA avancée et nécessite un abonnement Premium 🔒'}
            </p>
          </div>
          <div className="bg-white/10 p-2 rounded-full">
            <ShieldCheck size={18} className="text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultationsPage;
