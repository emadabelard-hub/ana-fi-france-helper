import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Scale, 
  Car,
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

const Index = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const toolCards = [
    {
      icon: FileText,
      title: isRTL ? 'الفواتير' : 'Factures',
      subtitle: isRTL ? 'إنشاء فواتير احترافية' : 'Créer des factures pro',
      path: '/pro/invoice-creator',
      gradient: 'from-orange-400 to-amber-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      iconColor: 'text-orange-600',
      emoji: '📄',
    },
    {
      icon: Scale,
      title: isRTL ? 'دليل القوانين' : 'Guide Juridique',
      subtitle: isRTL ? 'حقوقك وواجباتك' : 'Vos droits & devoirs',
      path: '/assistant',
      gradient: 'from-teal-400 to-emerald-500',
      bgColor: 'bg-teal-50 dark:bg-teal-950/30',
      iconColor: 'text-teal-600',
      emoji: '⚖️',
    },
    {
      icon: Car,
      title: 'Code de la Route',
      subtitle: isRTL ? 'تعلم السياقة' : 'Apprenez à conduire',
      path: '/assistant',
      gradient: 'from-violet-400 to-purple-500',
      bgColor: 'bg-violet-50 dark:bg-violet-950/30',
      iconColor: 'text-violet-600',
      emoji: '🚗',
    },
  ];

  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className={cn(
      "min-h-[85vh] flex flex-col py-6 px-3 max-w-lg mx-auto",
      isRTL && "font-cairo"
    )}>
      {/* Hero Section - Chat Card */}
      <section className="mb-8">
        <Card
          className={cn(
            "cursor-pointer transition-all duration-300",
            "hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98]",
            "border-none overflow-hidden",
            "bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700",
            "shadow-xl shadow-indigo-500/25"
          )}
          onClick={() => navigate('/assistant')}
        >
          <CardContent className="p-0">
            <div className="relative p-8">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className={cn(
                "flex items-center gap-5 relative z-10",
                isRTL && "flex-row-reverse"
              )}>
                {/* Icon */}
                <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg">
                  <span className="text-5xl">🤖</span>
                </div>

                {/* Text */}
                <div className={cn("flex-1", isRTL && "text-right")}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span className="text-xs text-white/80 uppercase tracking-wider">
                      {isRTL ? 'ذكاء اصطناعي' : 'Intelligence IA'}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-white mb-1">
                    {isRTL ? 'استفساراتي' : 'Mes Consultations'}
                  </h1>
                  <p className="text-white/80 text-sm">
                    {isRTL ? 'المساعد الإداري الذكي' : 'Assistant administratif intelligent'}
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
      </section>

      {/* Tools Section */}
      <section className="mb-8">
        <h2 className={cn(
          "text-lg font-bold text-foreground mb-4 flex items-center gap-2",
          isRTL && "flex-row-reverse text-right"
        )}>
          <span className="text-2xl">💪</span>
          {isRTL ? 'دراعك اليمين' : 'Votre bras droit'}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {toolCards.map((card) => (
            <Card
              key={card.path + card.title}
              className={cn(
                "cursor-pointer transition-all duration-300",
                "hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]",
                "border border-border/50 overflow-hidden",
                card.bgColor
              )}
              onClick={() => navigate(card.path)}
            >
              <CardContent className="p-4">
                <div className={cn(
                  "flex flex-col gap-3",
                  isRTL && "items-end"
                )}>
                  {/* Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    `bg-gradient-to-br ${card.gradient}`
                  )}>
                    <span className="text-2xl">{card.emoji}</span>
                  </div>

                  {/* Text */}
                  <div className={isRTL ? "text-right" : ""}>
                    <h3 className="font-bold text-foreground text-sm mb-0.5">
                      {card.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Feedback Section */}
      <section className="mt-auto">
        <Button
          variant="outline"
          className={cn(
            "w-full py-6 border-2 border-dashed border-amber-400/50",
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
                {isRTL ? 'آراء ومقترحات' : 'Avis & Suggestions'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'شاركنا رأيك 💡' : 'Partagez votre avis 💡'}
              </p>
            </div>
            <Arrow className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </div>
        </Button>
      </section>

      {/* Feedback Modal */}
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />

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
