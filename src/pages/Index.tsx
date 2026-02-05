import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import FeedbackModal from '@/components/home/FeedbackModal';
import CreditsDisplay from '@/components/shared/CreditsDisplay';
import { useAuth } from '@/hooks/useAuth';
import { PromoCard, PromoBanner } from '@/components/home/PromoCard';
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
      {/* SECTION 1: Ask Hero Card with Language Toggle */}
      <Card
        className={cn(
          "cursor-pointer transition-all duration-300 mb-4",
          "hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]",
          "border-none overflow-hidden",
          "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700",
          "shadow-xl shadow-indigo-500/25"
        )}
        onClick={() => navigate('/assistant')}
      >
        <CardContent className="p-0">
          <div className="relative p-6">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            {/* Language Toggle - Large & Vibrant */}
            <div className={cn(
              "flex gap-3 mb-4 relative z-20",
              isRTL && "flex-row-reverse justify-end"
            )}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLanguage('fr');
                }}
                className={cn(
                  "text-3xl p-2 rounded-xl transition-all duration-200",
                  "hover:scale-110 active:scale-95",
                  language === 'fr' 
                    ? "bg-white/30 shadow-lg ring-2 ring-white/50" 
                    : "bg-white/10 hover:bg-white/20"
                )}
                aria-label="Switch to French"
              >
                🇫🇷
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLanguage('ar');
                }}
                className={cn(
                  "text-3xl p-2 rounded-xl transition-all duration-200",
                  "hover:scale-110 active:scale-95",
                  language === 'ar' 
                    ? "bg-white/30 shadow-lg ring-2 ring-white/50" 
                    : "bg-white/10 hover:bg-white/20"
                )}
                aria-label="Switch to Arabic"
              >
                🇪🇬
              </button>
            </div>

            <div className={cn(
              "flex items-center gap-4 relative z-10",
              isRTL && "flex-row-reverse"
            )}>
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg">
                <span className="text-4xl">🤖</span>
              </div>

              {/* Text */}
              <div className={cn("flex-1", isRTL && "text-right")}>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span className="text-xs text-white/80 uppercase tracking-wider">
                    {isRTL ? 'ذكاء اصطناعي' : 'Intelligence IA'}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-white mb-1">
                  {isRTL ? 'اسأل وأنا أجاوب' : 'Posez votre question'}
                </h1>
                <p className="text-white/80 text-xs leading-relaxed">
                  {isRTL 
                    ? 'هاشرحلك ايه الموضوع وتعمل ايه ولو تطلب الأمر هعمل لك الرد المظبوط' 
                    : 'Je vous explique la situation et prépare votre réponse'}
                </p>
              </div>

              {/* Arrow */}
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Arrow className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credits Display - Only show if logged in */}
      {user && (
        <CreditsDisplay showDaily className="mb-4" />
      )}

      {/* SECTION 2: Artisan Tools Grid - "Dira'ak El Yameen" */}
      <div className="mb-4">
        <h2 className={cn(
          "text-base font-bold text-foreground mb-1 flex items-center gap-2",
          isRTL && "flex-row-reverse text-right"
        )}>
          <span className="text-xl">💪</span>
          {isRTL ? 'دراعك اليمين' : 'Vos outils'}
        </h2>
        
        {/* Subtitle */}
        <p className={cn(
          "text-xs text-muted-foreground mb-3 px-1",
          isRTL ? "text-right" : "text-left"
        )}>
          {isRTL 
            ? 'دراعك اليمين لعمل فواتيرك ودوفيهاتك وكل ما يتعلق بقوانين العمل والضرايب' 
            : 'Votre assistant pour factures, devis et tout ce qui concerne le travail et les impôts'}
        </p>

        {/* Asymmetrical Grid: 65/35 split */}
        <div className={cn(
          "grid gap-3",
          "grid-cols-[1.8fr_1fr]",
          isRTL && "grid-cols-[1fr_1.8fr]"
        )}>
          {/* Invoices Card - Primary Action, THE BIG ONE */}
          <Card
            className={cn(
              "cursor-pointer transition-all duration-300",
              "hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]",
              "border-2 border-orange-400/60 overflow-hidden",
              "bg-gradient-to-br from-orange-200 via-amber-100 to-yellow-100",
              "shadow-lg shadow-orange-500/25",
              isRTL && "order-2"
            )}
            onClick={() => setDocumentTypeModalOpen(true)}
          >
            <CardContent className="p-5">
              <div className={cn(
                "flex flex-col gap-4",
                isRTL && "items-end"
              )}>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                  <span className="text-4xl">📄</span>
                </div>
                <div className={isRTL ? "text-right" : ""}>
                  <h3 className="font-extrabold text-slate-900 text-xl mb-1 leading-relaxed">
                    {isRTL ? 'فواتيرك ودوفيهاتك' : 'Factures & Devis'}
                  </h3>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">
                    {isRTL ? 'اعمل فواتيرك ودوفيهاتك بطريقة سليمة وحسابات مظبوطة' : 'Créez vos documents avec des calculs précis'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Laws Card - Secondary, THE SMALLER ONE */}
          <Card
            className={cn(
              "cursor-pointer transition-all duration-300",
              "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
              "border border-emerald-400/50 overflow-hidden",
              "bg-gradient-to-br from-emerald-200 via-teal-100 to-cyan-100",
              "shadow-md",
              isRTL && "order-1"
            )}
            onClick={() => navigate('/assistant')}
          >
            <CardContent className="p-4">
              <div className={cn(
                "flex flex-col gap-3",
                isRTL && "items-end"
              )}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
                  <span className="text-xl">⚖️</span>
                </div>
                <div className={isRTL ? "text-right" : ""}>
                  <h3 className="font-bold text-slate-900 text-sm mb-1 leading-relaxed">
                    {isRTL ? 'قوانين العمل والضرائب والتأمين' : 'Travail, Impôts & Santé'}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {isRTL ? 'حقوقك وواجباتك' : 'Vos droits & devoirs'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Promo Spot A: Bank Promo */}
        <PromoCard
          promoId="bank_promo"
          icon="🏦"
          titleAr="وفر فلوسك"
          titleFr="Économisez"
          subtitleAr="أفضل بنك للمحترفين"
          subtitleFr="Best Bank for Pros"
          variant="gold"
          className="mt-3"
        />
      </div>

      {/* SECTION 3: Code de la Route - Bottom, Full Width */}
      <Card
        className={cn(
          "cursor-pointer transition-all duration-300 mb-4",
          "hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]",
          "border-none overflow-hidden",
          "bg-gradient-to-br from-pink-500 via-fuchsia-500 to-violet-600",
          "shadow-xl shadow-fuchsia-500/25"
        )}
        onClick={() => navigate('/coming-soon')}
      >
        <CardContent className="p-0">
          <div className="relative p-6">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-28 h-28 bg-white/10 rounded-full -translate-y-1/2 -translate-x-1/2" />
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 translate-x-1/2" />
            
            <div className={cn(
              "flex items-center gap-4 relative z-10",
              isRTL && "flex-row-reverse"
            )}>
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg">
                <span className="text-4xl">🚗</span>
              </div>

              {/* Text */}
              <div className={cn("flex-1", isRTL && "text-right")}>
                <h2 className="text-lg font-bold text-white mb-1">
                  {isRTL ? 'اتعلم كود دي لا روت بالعربي' : 'Code de la Route'}
                </h2>
                <p className="text-white/80 text-sm">
                  {isRTL ? 'وامتحنه برضه بالعربي' : 'Leçons vidéo et exercices'}
                </p>
              </div>

              {/* Arrow */}
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Arrow className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promo Spot B: Transfer Promo Banner */}
      <PromoBanner
        promoId="transfer_promo"
        textAr="حول فلوسك لأهلك في مصر بأمان"
        textFr="Transférez votre argent vers l'Égypte en toute sécurité"
        className="mb-4"
      />

      {/* SECTION 4: Feedback Button */}
      <div className="mt-auto">
        <Button
          variant="outline"
          className={cn(
            "w-full py-5 border-2 border-dashed border-amber-400/50",
            "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
            "hover:border-amber-500 hover:shadow-lg transition-all duration-300",
            "group"
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
                {isRTL ? 'آراء ومقترحات' : 'Avis & Suggestions ✨'}
              </p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'شاركنا رأيك 💡' : 'Partagez votre avis. 💡'}
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
