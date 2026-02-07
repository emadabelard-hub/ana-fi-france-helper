import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Scale, Car, Landmark, Send, 
  ChevronRight, ChevronLeft, FileUser, MessageSquare,
  Home, Wrench, User
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import FeedbackModal from '@/components/home/FeedbackModal';
import { useAuth } from '@/hooks/useAuth';
import DocumentTypeModal from '@/components/invoice/DocumentTypeModal';

const Index = () => {
  const { language, setLanguage, isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [documentTypeModalOpen, setDocumentTypeModalOpen] = useState(false);

  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className={cn(
      "min-h-screen bg-[#0f172a] text-white pb-24",
      isRTL && "font-cairo"
    )}>
      
      {/* HEADER - Dark Navy */}
      <header className="bg-[#1e293b] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg">
            AF
          </div>
          <h1 className="text-lg font-black tracking-tight text-white">
            Ana Fi France
          </h1>
        </div>
        
        {/* Language Buttons - Separate */}
        <div className="flex gap-2">
          <button
            onClick={() => setLanguage('ar')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
              language === 'ar' 
                ? "bg-white text-[#1e293b]" 
                : "bg-white/10 text-white/70 hover:bg-white/20"
            )}
          >
            عربي
          </button>
          <button
            onClick={() => setLanguage('fr')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
              language === 'fr' 
                ? "bg-white text-[#1e293b]" 
                : "bg-white/10 text-white/70 hover:bg-white/20"
            )}
          >
            FR
          </button>
        </div>
      </header>

      <main className="px-4 py-5 space-y-5">
        
        {/* AI BANNER - Purple/Indigo Gradient */}
        <button 
          onClick={() => navigate('/assistant')}
          className="w-full bg-gradient-to-r from-[#4f46e5] to-[#9333ea] p-6 rounded-[2rem] shadow-xl flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className={cn(
            "flex items-center gap-4",
            isRTL && "flex-row-reverse"
          )}>
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <MessageSquare size={28} className="text-white" />
            </div>
            <div className={isRTL ? "text-right" : "text-left"}>
              <h2 className="text-lg font-black text-white leading-tight">
                {isRTL ? 'اسأل وأنا أجاوبك' : 'Posez votre question'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl">🇫🇷</span>
                <span className="text-xl">🇪🇬</span>
                <span className="text-xs text-white/70 font-medium">
                  {isRTL ? 'بالعربي والفرنساوي' : 'En français et arabe'}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white/20 p-2.5 rounded-full">
            <Arrow size={18} />
          </div>
        </button>

        {/* TOOLS GRID - 2x2 */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* FACTURES & DEVIS - Orange Cream */}
          <button 
            onClick={() => setDocumentTypeModalOpen(true)}
            className={cn(
              "bg-[#fef3c7] p-5 rounded-[2rem] shadow-lg border-b-4 border-amber-300",
              "flex flex-col gap-3 active:scale-95 transition-transform",
              isRTL ? "items-end text-right" : "items-start text-left"
            )}
          >
            <div className="p-3 bg-orange-500 rounded-2xl text-white shadow-md">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm leading-tight">
                {isRTL ? 'فواتير ودوفي' : 'Factures & Devis'}
              </h3>
              <p className="text-[10px] font-bold text-orange-600 mt-1 font-cairo">
                {isRTL ? 'اعملهم صح' : 'فواتير ودوفي'}
              </p>
            </div>
          </button>

          {/* MON CV PRO - Indigo/Blue */}
          <button 
            onClick={() => navigate('/pro/cv-generator')}
            className={cn(
              "bg-[#e0e7ff] p-5 rounded-[2rem] shadow-lg border-b-4 border-indigo-300",
              "flex flex-col gap-3 active:scale-95 transition-transform",
              isRTL ? "items-end text-right" : "items-start text-left"
            )}
          >
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-md">
              <FileUser size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm leading-tight">
                {isRTL ? 'سيرتي الذاتية' : 'Mon CV Pro'}
              </h3>
              <p className="text-[10px] font-bold text-indigo-600 mt-1 font-cairo">
                {isRTL ? 'اصنع سيرتك' : 'سيرتي الذاتية'}
              </p>
            </div>
          </button>

          {/* TRAVAIL, IMPÔTS & SANTÉ - Mint Green */}
          <button 
            onClick={() => navigate('/assistant')}
            className={cn(
              "bg-[#d1fae5] p-5 rounded-[2rem] shadow-lg border-b-4 border-emerald-300",
              "flex flex-col gap-3 active:scale-95 transition-transform",
              isRTL ? "items-end text-right" : "items-start text-left"
            )}
          >
            <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-md">
              <Scale size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm leading-tight">
                {isRTL ? 'شغل وضرايب وصحة' : 'Travail, Impôts & Santé'}
              </h3>
              <p className="text-[10px] font-bold text-emerald-700 mt-1 font-cairo">
                {isRTL ? 'اعرف حقوقك' : 'شغل وضرايب وصحة'}
              </p>
            </div>
          </button>

          {/* ÉCONOMISEZ - Sand Yellow */}
          <button 
            onClick={() => navigate('/coming-soon')}
            className={cn(
              "bg-[#fef9c3] p-5 rounded-[2rem] shadow-lg border-b-4 border-yellow-300",
              "flex flex-col gap-3 active:scale-95 transition-transform",
              isRTL ? "items-end text-right" : "items-start text-left"
            )}
          >
            <div className="p-3 bg-yellow-500 rounded-2xl text-white shadow-md">
              <Landmark size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm leading-tight">
                {isRTL ? 'وفّر فلوسك' : 'Économisez'}
              </h3>
              <p className="text-[10px] font-bold text-yellow-700 mt-1 font-cairo">
                {isRTL ? 'أفضل بنك' : 'وفّر فلوسك'}
              </p>
            </div>
          </button>
        </div>

        {/* CODE DE LA ROUTE - Pink/Purple Gradient */}
        <button 
          onClick={() => navigate('/coming-soon')}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 p-5 rounded-[2rem] shadow-xl flex items-center justify-between text-white active:scale-[0.98] transition-transform"
        >
          <div className={cn(
            "flex items-center gap-4",
            isRTL && "flex-row-reverse"
          )}>
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Car size={24} />
            </div>
            <div className={isRTL ? "text-right" : "text-left"}>
              <h3 className="font-black text-sm uppercase tracking-wide">
                {isRTL ? 'كود الطريق' : 'Code de la Route'}
              </h3>
              <p className="text-[10px] opacity-80 font-cairo mt-0.5">
                {isRTL ? 'دروس وامتحانات بالمصري' : 'دروس وامتحانات بالمصري'}
              </p>
            </div>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <Arrow size={16} />
          </div>
        </button>

        {/* ENVOYER DE L'ARGENT - Green Gradient */}
        <button 
          onClick={() => navigate('/coming-soon')}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 p-5 rounded-[2rem] shadow-xl flex items-center justify-between text-white active:scale-[0.98] transition-transform"
        >
          <div className={cn(
            "flex items-center gap-4",
            isRTL && "flex-row-reverse"
          )}>
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Send size={24} />
            </div>
            <div className={isRTL ? "text-right" : "text-left"}>
              <h3 className="font-black text-sm uppercase tracking-wide">
                {isRTL ? 'حول فلوسك' : "Envoyer de l'argent"}
              </h3>
              <p className="text-[10px] opacity-80 font-cairo mt-0.5">
                {isRTL ? 'تحويل فلوس لأهلك بأمان' : 'تحويل فلوس لأهلك بأمان'}
              </p>
            </div>
          </div>
          <span className="text-[8px] font-black bg-white/25 px-2.5 py-1 rounded-full uppercase">
            Promo
          </span>
        </button>

      </main>

      {/* BOTTOM NAVIGATION - 4 Buttons */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#1e293b]/95 backdrop-blur-xl border-t border-white/10 px-6 py-3 pb-6 z-50">
        <div className={cn(
          "flex items-center justify-around",
          isRTL && "flex-row-reverse"
        )}>
          <button 
            onClick={() => navigate('/')}
            className="flex flex-col items-center gap-1 text-white"
          >
            <Home size={22} />
            <span className="text-[10px] font-bold">
              {isRTL ? 'الرئيسية' : 'Accueil'}
            </span>
          </button>
          
          <button 
            onClick={() => navigate('/assistant')}
            className="flex flex-col items-center gap-1 text-white/50"
          >
            <MessageSquare size={22} />
            <span className="text-[10px] font-medium">
              {isRTL ? 'استشارات' : 'Consultations'}
            </span>
          </button>
          
          <button 
            onClick={() => navigate('/pro')}
            className="flex flex-col items-center gap-1 text-white/50"
          >
            <Wrench size={22} />
            <span className="text-[10px] font-medium">
              {isRTL ? 'أدوات برو' : 'Outils Pro'}
            </span>
          </button>
          
          <button 
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-white/50"
          >
            <User size={22} />
            <span className="text-[10px] font-medium">
              {isRTL ? 'حسابي' : 'Mon Profil'}
            </span>
          </button>
        </div>
      </nav>

      {/* Feedback Modal */}
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      {/* Document Type Selection Modal */}
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
