import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Scale, Car, Landmark, Send, 
  ChevronRight, ChevronLeft, FileUser, Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import FeedbackModal from '@/components/home/FeedbackModal';
import CreditsDisplay from '@/components/shared/CreditsDisplay';
import { useAuth } from '@/hooks/useAuth';
import DocumentTypeModal from '@/components/invoice/DocumentTypeModal';

const Index = () => {
  const { language, setLanguage, isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [documentTypeModalOpen, setDocumentTypeModalOpen] = useState(false);

  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  const toggleLanguage = (lang: 'fr' | 'ar') => {
    setLanguage(lang);
  };

  return (
    <div className={cn(
      "min-h-[85vh] flex flex-col py-4 px-3 max-w-lg mx-auto",
      isRTL && "font-cairo"
    )}>
      
      {/* Language Toggle */}
      <div className={cn(
        "flex gap-3 mb-4",
        isRTL && "flex-row-reverse justify-end"
      )}>
        <button
          onClick={() => toggleLanguage('fr')}
          className={cn(
            "text-2xl p-2 rounded-xl transition-all duration-200",
            "hover:scale-110 active:scale-95",
            language === 'fr' 
              ? "bg-primary/20 shadow-lg ring-2 ring-primary/50" 
              : "bg-muted hover:bg-muted/80"
          )}
          aria-label="Switch to French"
        >
          🇫🇷
        </button>
        <button
          onClick={() => toggleLanguage('ar')}
          className={cn(
            "text-2xl p-2 rounded-xl transition-all duration-200",
            "hover:scale-110 active:scale-95",
            language === 'ar' 
              ? "bg-primary/20 shadow-lg ring-2 ring-primary/50" 
              : "bg-muted hover:bg-muted/80"
          )}
          aria-label="Switch to Arabic"
        >
          🇪🇬
        </button>
      </div>

      {/* Credits Display - Only show if logged in */}
      {user && (
        <CreditsDisplay showDaily className="mb-4" />
      )}

      {/* SECTION 1: GRILLE 2 COLONNES - OUTILS PRINCIPAUX */}
      <div className={cn(
        "grid grid-cols-2 gap-4 mb-4",
        isRTL && "direction-rtl"
      )}>
        
        {/* BOUTON 1: FACTURES & DEVIS */}
        <button 
          onClick={() => setDocumentTypeModalOpen(true)}
          className={cn(
            "bg-orange-100 p-5 rounded-[2rem] shadow-sm border-b-4 border-orange-200",
            "flex flex-col gap-3 active:scale-95 transition-transform",
            isRTL ? "items-end text-right" : "items-start text-left"
          )}
        >
          <div className="p-3 bg-orange-500 rounded-2xl text-white shadow-sm">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm leading-tight">
              {isRTL ? 'فواتير ودوفي' : 'Factures & Devis'}
            </h3>
            <p className={cn(
              "text-[10px] font-bold mt-1",
              isRTL ? "text-orange-600" : "text-orange-600 font-cairo"
            )}>
              {isRTL ? 'اعملهم صح' : 'فواتير ودوفي'}
            </p>
          </div>
        </button>

        {/* BOUTON 2: CV PROFESSIONNEL */}
        <button 
          onClick={() => navigate('/pro/cv-generator')}
          className={cn(
            "bg-indigo-100 p-5 rounded-[2rem] shadow-sm border-b-4 border-indigo-200",
            "flex flex-col gap-3 active:scale-95 transition-transform",
            isRTL ? "items-end text-right" : "items-start text-left"
          )}
        >
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-sm">
            <FileUser size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm leading-tight">
              {isRTL ? 'سيرة ذاتية احترافية' : 'CV Professionnel'}
            </h3>
            <p className={cn(
              "text-[10px] font-bold mt-1",
              isRTL ? "text-indigo-600" : "text-indigo-600 font-cairo"
            )}>
              {isRTL ? 'اصنع سيرتك' : 'سيرة ذاتية احترافية'}
            </p>
          </div>
        </button>

        {/* BOUTON 3: DROIT & SANTÉ */}
        <button 
          onClick={() => navigate('/assistant')}
          className={cn(
            "bg-teal-100 p-5 rounded-[2rem] shadow-sm border-b-4 border-teal-200",
            "flex flex-col gap-3 active:scale-95 transition-transform",
            isRTL ? "items-end text-right" : "items-start text-left"
          )}
        >
          <div className="p-3 bg-teal-600 rounded-2xl text-white shadow-sm">
            <Scale size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm leading-tight">
              {isRTL ? 'حقوق وتأمين' : 'Droit & Santé'}
            </h3>
            <p className={cn(
              "text-[10px] font-bold mt-1",
              isRTL ? "text-teal-700" : "text-teal-700 font-cairo"
            )}>
              {isRTL ? 'اعرف حقوقك' : 'حقوق وتأمين'}
            </p>
          </div>
        </button>

        {/* BOUTON 4: BANQUE PRO */}
        <button 
          onClick={() => navigate('/coming-soon')}
          className={cn(
            "bg-red-100 p-5 rounded-[2rem] shadow-sm border-b-4 border-red-200",
            "flex flex-col gap-3 active:scale-95 transition-transform",
            isRTL ? "items-end text-right" : "items-start text-left"
          )}
        >
          <div className="p-3 bg-red-500 rounded-2xl text-white shadow-sm">
            <Landmark size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm leading-tight">
              {isRTL ? 'وفر فلوسك' : 'Banque Pro'}
            </h3>
            <p className={cn(
              "text-[10px] font-bold mt-1",
              isRTL ? "text-red-600" : "text-red-600 font-cairo"
            )}>
              {isRTL ? 'أفضل بنك' : 'وفر فلوسك'}
            </p>
          </div>
        </button>
      </div>

      {/* BANNIÈRE CODE DE LA ROUTE */}
      <button 
        onClick={() => navigate('/coming-soon')}
        className={cn(
          "w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 p-6 rounded-[2rem] shadow-lg",
          "flex items-center justify-between text-white active:scale-95 transition-transform mb-4"
        )}
      >
        <div className={cn(
          "flex items-center gap-4",
          isRTL && "flex-row-reverse"
        )}>
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
            <Car size={24} />
          </div>
          <div className={isRTL ? "text-right" : "text-left"}>
            <h3 className="font-black text-sm uppercase">
              {isRTL ? 'كود الطريق' : 'Code de la Route'}
            </h3>
            <p className="text-[10px] opacity-90 font-cairo">
              {isRTL ? 'دروس وامتحانات بالمصري' : 'دروس وامتحانات بالمصري'}
            </p>
          </div>
        </div>
        <div className="bg-white/20 p-2 rounded-full">
          <Arrow size={16} />
        </div>
      </button>

      {/* BANNIÈRE TRANSFERT D'ARGENT */}
      <button 
        onClick={() => navigate('/coming-soon')}
        className={cn(
          "w-full bg-emerald-500 p-5 rounded-[2rem] shadow-lg",
          "flex items-center justify-between text-white active:scale-95 transition-transform border-b-4 border-emerald-600 mb-4"
        )}
      >
        <div className={cn(
          "flex items-center gap-4",
          isRTL && "flex-row-reverse"
        )}>
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
            <Send size={24} />
          </div>
          <div className={isRTL ? "text-right" : "text-left"}>
            <h3 className="font-black text-sm uppercase">
              {isRTL ? 'حول فلوسك' : "Envoyer de l'argent"}
            </h3>
            <p className="text-[10px] opacity-90 font-cairo">
              {isRTL ? 'تحويل فلوس لأهلك بأمان' : 'تحويل فلوس لأهلك بأمان'}
            </p>
          </div>
        </div>
        <span className="text-[8px] font-black bg-white/20 px-2 py-1 rounded">PROMO</span>
      </button>

      {/* SECTION FEEDBACK */}
      <div className="mt-auto">
        <Button
          variant="outline"
          className={cn(
            "w-full py-5 border-2 border-dashed border-amber-400/50",
            "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
            "hover:border-amber-500 hover:shadow-lg transition-all duration-300",
            "group rounded-2xl"
          )}
          onClick={() => setFeedbackOpen(true)}
        >
          <div className={cn(
            "flex items-center gap-3 w-full",
            isRTL && "flex-row-reverse"
          )}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Lightbulb className="h-5 w-5 text-white" />
            </div>
            <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
              <p className="font-semibold text-foreground text-sm">
                {isRTL ? 'رأيك يهمنا' : 'Avis & Suggestions ✨'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'قولنا إيه رأيك في التطبيق 💡' : 'Partagez votre avis. 💡'}
              </p>
            </div>
            <Arrow className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </div>
        </Button>
      </div>

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

      {/* Hidden Admin Link */}
      <button 
        onClick={() => navigate('/admin')}
        className="absolute bottom-4 left-4 text-xs text-muted-foreground/30 hover:text-primary"
      >
        Admin
      </button>
    </div>
  );
};

export default Index;
