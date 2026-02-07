import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Scale, Car, Landmark, Send, 
  ChevronRight, FileUser, MessageSquare,
  Home, Settings, User
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import FeedbackModal from '@/components/home/FeedbackModal';
import DocumentTypeModal from '@/components/invoice/DocumentTypeModal';

const Index = () => {
  const { language, setLanguage, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [documentTypeModalOpen, setDocumentTypeModalOpen] = useState(false);

  return (
    <div className={cn(
      "min-h-screen bg-[#111827] text-white pb-28 select-none",
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
          className="w-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden active:scale-95 transition-transform group border border-white/10"
        >
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-2">
                <span className="text-2xl drop-shadow-md">🇫🇷</span>
                <span className="text-2xl drop-shadow-md">🇪🇬</span>
              </div>
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                <MessageSquare size={20} className="text-white" />
              </div>
            </div>
            
            <div className={cn("text-right", !isRTL && "text-left")}>
              <h2 className="text-2xl font-black font-cairo mb-1 leading-tight">
                {isRTL ? 'اسأل وأنا أجاوبك' : 'Posez votre question'}
              </h2>
              <p className="text-[11px] font-bold text-indigo-100 font-cairo bg-white/10 px-2 py-1 rounded-lg inline-block">
                {isRTL ? 'بالعربي والفرنساوي 🇫🇷 🇪🇬' : 'En français et arabe 🇫🇷 🇪🇬'}
              </p>
            </div>
          </div>
          
          {/* Decoration */}
          <div className="absolute left-[-20px] top-[20px] w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
          <div className={cn(
            "absolute bottom-4 bg-white/20 p-2 rounded-full",
            isRTL ? "left-4" : "right-4"
          )}>
            <ChevronRight size={16} className={cn(isRTL && "rotate-180")} />
          </div>
        </button>

        {/* TOOLS GRID */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* CV Button */}
          <button 
            onClick={() => navigate('/pro/cv-generator')}
            className="bg-[#e0e7ff] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform group"
          >
            <div className="p-3.5 bg-[#4f46e5] rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <FileUser size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#1e1b4b] text-[15px] font-cairo leading-tight">
                {isRTL ? 'سيرتي الذكية' : 'Mon CV Pro'}
                {isRTL && <><br/>(سي في)</>}
              </h3>
              <p className="text-[10px] font-bold text-[#6366f1] mt-1 font-cairo">
                {isRTL ? 'اصنع سيرتك' : 'Créez votre CV'}
              </p>
            </div>
          </button>

          {/* Invoices Button */}
          <button 
            onClick={() => setDocumentTypeModalOpen(true)}
            className="bg-[#ffedd5] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform group"
          >
            <div className="p-3.5 bg-[#f97316] rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <FileText size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#431407] text-[15px] font-cairo leading-tight">
                {isRTL ? 'فواتير ودوفي' : 'Factures & Devis'}
              </h3>
              <p className="text-[10px] font-bold text-[#ea580c] mt-1 font-cairo">
                {isRTL ? 'اعملهم صح' : 'Créez-les facilement'}
              </p>
            </div>
          </button>

          {/* Bank Button */}
          <button 
            onClick={() => navigate('/coming-soon')}
            className="bg-[#fef9c3] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform group"
          >
            <div className="p-3.5 bg-[#eab308] rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <Landmark size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#422006] text-[15px] font-cairo leading-tight">
                {isRTL ? 'وفّر فلوسك' : 'Économisez'}
              </h3>
              <p className="text-[10px] font-bold text-[#ca8a04] mt-1 font-cairo">
                {isRTL ? 'أفضل بنك' : 'Meilleure banque'}
              </p>
            </div>
          </button>

          {/* Rights Button */}
          <button 
            onClick={() => navigate('/assistant')}
            className="bg-[#d1fae5] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform group"
          >
            <div className="p-3.5 bg-[#059669] rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <Scale size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#064e3b] text-[13px] font-cairo leading-tight">
                {isRTL ? 'شغل وضرائب وصحة' : 'Travail, Impôts & Santé'}
              </h3>
              <p className="text-[10px] font-bold text-[#059669] mt-1 font-cairo">
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
          <span className="text-[8px] font-black bg-white/25 px-2.5 py-1 rounded-full uppercase">
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
          <span className="text-[10px] font-bold font-cairo">
            {isRTL ? 'الرئيسية' : 'Accueil'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/assistant')}
          className="flex flex-col items-center gap-1 text-slate-500"
        >
          <MessageSquare size={24} />
          <span className="text-[10px] font-bold font-cairo">
            {isRTL ? 'استشارات' : 'Consultations'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/pro')}
          className="flex flex-col items-center gap-1 text-slate-500"
        >
          <Settings size={24} />
          <span className="text-[10px] font-bold font-cairo">
            {isRTL ? 'أدوات' : 'Outils Pro'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/profile')}
          className="flex flex-col items-center gap-1 text-slate-500"
        >
          <User size={24} />
          <span className="text-[10px] font-bold font-cairo">
            {isRTL ? 'حسابي' : 'Mon Profil'}
          </span>
        </button>
      </nav>

      {/* Modals */}
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <DocumentTypeModal
        open={documentTypeModalOpen}
        onOpenChange={setDocumentTypeModalOpen}
        onSelect={(type) => {
          setDocumentTypeModalOpen(false);
          navigate(`/pro/invoice-creator?type=${type}`);
        }}
      />
    </div>
  );
};

export default Index;
