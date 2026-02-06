import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { PenLine, Scale, Settings, ArrowRight, ArrowLeft, FileUser } from 'lucide-react';
import { cn } from '@/lib/utils';
import QuoteToInvoiceIcon from '@/components/pro/QuoteToInvoiceIcon';

const ProPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const mainTools = [
    {
      icon: PenLine,
      emoji: '📄',
      title: isRTL ? 'فواتير ودوفيهات' : 'Devis & Factures',
      description: isRTL 
        ? 'اعمل الفاكتير والدوفي بتوعك بسهولة' 
        : 'Créez vos devis et factures facilement',
      path: '/pro/invoice-creator',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: null, // Custom icon component
      customIcon: QuoteToInvoiceIcon,
      emoji: null,
      title: isRTL ? 'حوّل الدوفي لفاكتير' : 'Devis → Facture',
      description: isRTL 
        ? 'ارفع الدوفي وأنا أملّي الفاكتير تلقائي!' 
        : 'L\'IA remplit votre facture automatiquement',
      path: '/pro/quote-to-invoice',
      gradient: 'from-amber-500 to-emerald-500',
    },
    {
      icon: Scale,
      emoji: '⚖️',
      title: isRTL ? 'قوانين الشغل والضرايب' : 'Guide Juridique',
      description: isRTL 
        ? 'اعرف حقوقك وواجباتك' 
        : 'Comprendre le droit du travail et les impôts',
      path: '/pro/admin-assistant',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      icon: FileUser,
      emoji: '📄',
      title: isRTL ? 'مُولّد CV Pro' : 'Générateur de CV',
      description: isRTL 
        ? 'اكتب بالعربي والذكاء الاصطناعي يترجم للفرنسية' 
        : 'Écrivez en arabe, l\'IA traduit en français',
      path: '/pro/cv-generator',
      gradient: 'from-indigo-500 to-purple-600',
    },
  ];

  return (
    <div className="py-4 space-y-6">
      {/* Page Header */}
      <section className={cn("text-center", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isRTL ? 'دراعك اليمين 💪' : 'Votre Bras Droit 💪'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRTL 
            ? 'كل اللي يحتاجه الصنايعي والحرفي في فرنسا' 
            : 'Outils pour artisans et indépendants'}
        </p>
      </section>

      {/* Main Tool Cards */}
      <section className="space-y-4">
        {mainTools.map((tool) => {
          const Icon = tool.icon;
          const CustomIcon = tool.customIcon;
          return (
            <Card
              key={tool.path}
              className={cn(
                "cursor-pointer transition-all duration-300",
                "hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]",
                "border-none overflow-hidden",
                `bg-gradient-to-r ${tool.gradient}`
              )}
              onClick={() => navigate(tool.path)}
            >
              <CardContent className="p-0">
                <div className={cn(
                  "flex items-center gap-5 p-6",
                  isRTL && "flex-row-reverse"
                )}>
                  {/* Icon Circle */}
                  <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    {CustomIcon ? (
                      <CustomIcon className="h-10 w-10" />
                    ) : (
                      <span className="text-3xl">{tool.emoji}</span>
                    )}
                  </div>

                  {/* Text */}
                  <div className={cn("flex-1", isRTL && "text-right")}>
                    <h2 className={cn(
                      "text-xl font-bold text-white mb-1",
                      isRTL && "font-cairo"
                    )}>
                      {tool.title}
                    </h2>
                    <p className={cn(
                      "text-white/80 text-sm",
                      isRTL && "font-cairo"
                    )}>
                      {tool.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  <Arrow className="h-6 w-6 text-white/60" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Settings Link */}
      <Card 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => navigate('/pro/settings')}
      >
        <CardContent className={cn(
          "flex items-center gap-4 p-4",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h3 className={cn(
              "font-medium text-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'بيانات شركتي' : 'Mon identité pro'}
            </h3>
            <p className={cn(
              "text-xs text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'الاسم واللوجو والـ SIRET' : 'Infos entreprise et logo'}
            </p>
          </div>
          <Arrow className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Info Notice */}
      <div className={cn(
        "text-center text-sm text-muted-foreground pt-4",
        isRTL && "font-cairo"
      )}>
        🧰 {isRTL 
          ? 'أدوات مخصصة للصنايعية والحرفيين في فرنسا' 
          : 'Outils dédiés aux artisans en France'}
      </div>
    </div>
  );
};

export default ProPage;
