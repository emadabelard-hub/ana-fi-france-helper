import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { PenLine, Scale, Settings, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const mainTools = [
    {
      icon: PenLine,
      emoji: '📄',
      title: isRTL ? 'فواتير ودوفي' : 'Devis & Factures',
      description: isRTL 
        ? 'اعمل فواتيرك وتقديراتك بسهولة' 
        : 'Créez vos devis et factures facilement',
      path: '/pro/invoice-creator',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: Scale,
      emoji: '⚖️',
      title: isRTL ? 'دليل القوانين' : 'Guide Juridique',
      description: isRTL 
        ? 'افهم قوانين الشغل والضرايب' 
        : 'Comprendre le droit du travail et les impôts',
      path: '/pro/admin-assistant',
      gradient: 'from-blue-500 to-blue-600',
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
            ? 'أدوات للحرفيين وأصحاب العمل الحر' 
            : 'Outils pour artisans et indépendants'}
        </p>
      </section>

      {/* Main Tool Cards */}
      <section className="space-y-4">
        {mainTools.map((tool) => {
          const Icon = tool.icon;
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
                    <span className="text-3xl">{tool.emoji}</span>
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
              {isRTL ? 'هويتي المهنية' : 'Mon identité pro'}
            </h3>
            <p className={cn(
              "text-xs text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'بيانات الشركة واللوجو' : 'Infos entreprise et logo'}
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
          ? 'أدوات مخصصة للحرفيين في فرنسا' 
          : 'Outils dédiés aux artisans en France'}
      </div>
    </div>
  );
};

export default ProPage;
