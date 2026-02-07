import { useNavigate } from 'react-router-dom';
import { 
  FileText, Scale, Car, Landmark, Send, 
  ChevronRight, FileUser, MessageSquare,
  Home, Settings, User, Brain
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const Index = () => {
  const { language, setLanguage, isRTL } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className={cn(
      "min-h-screen bg-[#0f172a] text-white pb-28 select-none",
      isRTL && "font-cairo"
    )}>
      
      {/* HEADER */}
      <header className="bg-[#1e293b] p-4 pt-12 flex justify-between items-center shadow-lg border-b border-white/5 relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#facc15] rounded-full flex items-center justify-center text-[#111827] font-black text-sm border-2 border-[#111827]">
            AF
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Ana Fi France</h1>
            <div className="h-0.5 w-full bg-[#facc15] rounded-full mt-0.5"></div>
          </div>
        </div>
        
        {/* Language Toggle */}
        <div className="flex bg-[#0f172a] p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => setLanguage('fr')} 
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
              language === 'fr' ? 'bg-[#3b82f6] text-white' : 'text-slate-500'
            )}
          >
            FR
          </button>
          <button 
            onClick={() => setLanguage('ar')} 
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
              language === 'ar' ? 'bg-[#3b82f6] text-white' : 'text-slate-500'
            )}
          >
            عربي
          </button>
        </div>
      </header>

      <main className="p-4 space-y-5">
        
        {/* AI BANNER */}
        <button 
          onClick={() => navigate('/assistant')}
          className="w-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden active:scale-95 transition-transform border border-white/10 text-left"
        >
          <div className="relative z-10">
            <div className="flex justify-between mb-4">
              <div className="flex gap-2 text-2xl">
                <span>🇫🇷</span>
                <span>🇪🇬</span>
              </div>
              <Brain className="text-white opacity-80" />
            </div>
            <h2 className={cn(
              "text-2xl font-black text-white leading-tight mb-1",
              isRTL && "text-right"
            )}>
              {isRTL ? (
                <>اسأل وأنا أجاوبك<br/><span className="opacity-90 text-lg">Posez votre question</span></>
              ) : (
                <>Posez votre question<br/><span className="font-cairo opacity-90 text-lg">اسأل وأنا أجاوبك</span></>
              )}
            </h2>
          </div>
          <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        </button>

        {/* TOOLS GRID */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* CV Button */}
          <button 
            onClick={() => navigate('/pro/cv-generator')}
            className="bg-[#e0e7ff] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform h-48 justify-center"
          >
            <div className="p-3 bg-[#4f46e5] rounded-2xl text-white shadow-lg">
              <FileUser size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#1e1b4b] text-sm leading-tight font-cairo">
                {isRTL ? 'سيرتي الذكية' : 'Mon CV Pro'}
                <br/>
                <span className="text-[11px]">{isRTL ? '(سي في)' : ''}</span>
              </h3>
              <p className="text-[10px] font-bold text-[#6366f1] mt-1">
                {isRTL ? 'اصنع سيرتك' : 'Créez votre CV'}
              </p>
            </div>
          </button>

          {/* Invoices Button */}
          <button 
            onClick={() => navigate('/pro/invoice-creator')}
            className="bg-[#ffedd5] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform h-48 justify-center"
          >
            <div className="p-3 bg-[#f97316] rounded-2xl text-white shadow-lg">
              <FileText size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#431407] text-sm leading-tight font-cairo">
                {isRTL ? 'فواتير ودوفي' : 'Factures & Devis'}
              </h3>
              <p className="text-[10px] font-bold text-[#ea580c] mt-1">
                {isRTL ? 'اعملهم صح' : 'Créez-les facilement'}
              </p>
            </div>
          </button>

          {/* Bank Button */}
          <button 
            onClick={() => navigate('/coming-soon')}
            className="bg-[#fef9c3] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform h-40 justify-center"
          >
            <div className="p-3 bg-[#eab308] rounded-2xl text-white shadow-lg">
              <Landmark size={24} />
            </div>
            <div>
              <h3 className="font-black text-[#422006] text-sm font-cairo">
                {isRTL ? 'وفّر فلوسك' : 'Économisez'}
              </h3>
              <p className="text-[10px] font-bold text-[#ca8a04]">
                {isRTL ? 'أفضل بنك' : 'Meilleure banque'}
              </p>
            </div>
          </button>

          {/* Rights Button */}
          <button 
            onClick={() => navigate('/assistant')}
            className="bg-[#d1fae5] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform h-40 justify-center"
          >
            <div className="p-3 bg-[#059669] rounded-2xl text-white shadow-lg">
              <Scale size={24} />
            </div>
            <div>
              <h3 className="font-black text-[#064e3b] text-sm font-cairo">
                {isRTL ? 'شغل وضرائب' : 'Travail & Impôts'}
              </h3>
              <p className="text-[10px] font-bold text-[#059669]">
                {isRTL ? 'اعرف حقوقك' : 'Vos droits'}
              </p>
            </div>
          </button>
        </div>

        {/* CODE DE LA ROUTE */}
        <button 
          onClick={() => navigate('/coming-soon')}
          className="w-full bg-gradient-to-r from-[#ec4899] to-[#d946ef] p-5 rounded-[2.5rem] shadow-lg flex items-center justify-between text-white active:scale-95 transition-transform border border-white/10"
        >
          <div className="bg-white/20 p-3 rounded-2xl">
            <Car size={26} />
          </div>
          <div className={cn("flex-1 px-4", isRTL ? "text-right" : "text-left")}>
            <h3 className="font-black text-lg font-cairo">
              {isRTL ? 'كود الطريق' : 'Code de la Route'}
            </h3>
            <p className="text-[10px] font-bold text-pink-100 font-cairo">
              {isRTL ? 'دروس وامتحانات بالمصري' : 'Leçons et examens'}
            </p>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <ChevronRight size={16} className={cn(isRTL && "rotate-180")} />
          </div>
        </button>

        {/* SEND MONEY */}
        <button 
          onClick={() => navigate('/coming-soon')}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 p-5 rounded-[2.5rem] shadow-lg flex items-center justify-between text-white active:scale-95 transition-transform border border-white/10"
        >
          <div className="bg-white/20 p-3 rounded-2xl">
            <Send size={26} />
          </div>
          <div className={cn("flex-1 px-4", isRTL ? "text-right" : "text-left")}>
            <h3 className="font-black text-lg font-cairo">
              {isRTL ? 'حول فلوسك' : "Envoyer de l'argent"}
            </h3>
            <p className="text-[10px] font-bold text-emerald-100 font-cairo">
              {isRTL ? 'تحويل فلوس لأهلك بأمان' : 'Transfert sécurisé'}
            </p>
          </div>
          <span className="text-[8px] font-black bg-white/20 px-2 py-1 rounded-full uppercase">
            Promo
          </span>
        </button>

      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/10 p-3 pb-8 flex justify-around items-center z-50">
        <button 
          onClick={() => navigate('/')}
          className="flex flex-col items-center gap-1 text-[#facc15]"
        >
          <Home size={24} strokeWidth={3} />
          <span className="text-[10px] font-bold">
            {isRTL ? 'الرئيسية' : 'Accueil'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/assistant')}
          className="flex flex-col items-center gap-1 text-slate-500"
        >
          <MessageSquare size={24} />
          <span className="text-[10px] font-bold">
            {isRTL ? 'استشارات' : 'Conseils'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/pro')}
          className="flex flex-col items-center gap-1 text-slate-500"
        >
          <Settings size={24} />
          <span className="text-[10px] font-bold">
            {isRTL ? 'أدوات' : 'Outils'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/profile')}
          className="flex flex-col items-center gap-1 text-slate-500"
        >
          <User size={24} />
          <span className="text-[10px] font-bold">
            {isRTL ? 'حسابي' : 'Compte'}
          </span>
        </button>
      </nav>
    </div>
  );
};

export default Index;
