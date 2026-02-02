import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, PenLine, ArrowRight, ArrowLeft, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import DismissibleTip from '@/components/shared/DismissibleTip';

const ProPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const features = [
    {
      icon: PenLine,
      title: 'مساعد الفواتير والدوفي',
      titleFr: 'Assistant Devis & Factures',
      description: 'اعمل فواتيرك بسهولة، وافهم الفرق بينهم، وظبط أسعارك عشان تكسب صح.',
      descriptionFr: 'Créez vos devis et factures facilement',
      path: '/pro/invoice-creator',
      gradient: 'from-green-500/20 to-green-500/5',
      available: true,
    },
    {
      icon: Briefcase,
      title: 'مساعد الارتيزان الذكي',
      titleFr: 'Assistant Artisan Intelligent',
      description: 'حلك لمشاكل الـ URSSAF، الضرايب، ومنازعات الشغل.',
      descriptionFr: 'URSSAF, impôts et litiges professionnels',
      path: '/pro/admin-assistant',
      gradient: 'from-blue-500/20 to-blue-500/5',
      available: true,
    },
    {
      icon: Settings,
      title: 'هويتي المهنية',
      titleFr: 'Mon identité pro',
      description: 'بيانات شركتك، اللوجو، وشكل الفواتير',
      descriptionFr: 'Infos entreprise, logo et style des documents',
      path: '/pro/settings',
      gradient: 'from-purple-500/20 to-purple-500/5',
      available: true,
    },
  ];

  return (
    <div className="py-6 space-y-6">
      {/* Header with Back Button */}
      <section className={cn(
        "flex items-center gap-4",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="shrink-0"
        >
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn(
            "text-2xl font-bold text-foreground",
            isRTL && "font-cairo"
          )}>
            دراعك اليمين 💪
          </h1>
          <p className={cn(
            "text-sm text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'كل أدوات شغلك وفواتيرك في مكان واحد' : 'Tous vos outils professionnels en un seul endroit'}
          </p>
        </div>
      </section>

      {/* Contextual Training Tip */}
      <DismissibleTip
        storageKey="pro_tip_dismissed"
        title="💡 شرح سريع"
        text="اكتب مقاسات الشغل أو تفاصيل الفاتورة كتابة، وأنا هحسبلك الحسبة وأعملك الدوفي."
      />

      {/* Feature Cards */}
      <section className="space-y-4">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Card
              key={index}
              className={cn(
                "cursor-pointer transition-all duration-300 hover:shadow-lg",
                "border-none bg-gradient-to-br overflow-hidden group",
                feature.gradient,
                !feature.available && "opacity-60"
              )}
              onClick={() => feature.available && navigate(feature.path)}
            >
              <CardContent className={cn(
                "flex items-center gap-4 p-6",
                isRTL && "flex-row-reverse"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center",
                  "bg-card shadow-sm group-hover:scale-105 transition-transform"
                )}>
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                
                <div className={cn("flex-1", isRTL && "text-right")}>
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      "font-semibold text-foreground text-lg",
                      isRTL && "font-cairo"
                    )}>
                      {isRTL ? feature.title : (feature.titleFr || feature.title)}
                    </h3>
                    {!feature.available && (
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground",
                        isRTL && "font-cairo"
                      )}>
                        {isRTL ? 'قريباً' : 'Bientôt'}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-sm text-muted-foreground mt-1",
                    isRTL && "font-cairo"
                  )}>
                    {isRTL ? feature.description : (feature.descriptionFr || feature.description)}
                  </p>
                </div>

                {feature.available && (
                  <Arrow className={cn(
                    "h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors",
                    "group-hover:translate-x-1",
                    isRTL && "group-hover:-translate-x-1 group-hover:translate-x-0"
                  )} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Info Notice */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className={cn(
          "p-4 text-center",
          isRTL && "font-cairo"
        )}>
          <p className="text-sm text-muted-foreground">
            {isRTL 
              ? '🧰 أدوات مخصصة للحرفيين وأصحاب العمل الحر في فرنسا'
              : '🧰 Outils dédiés aux artisans et auto-entrepreneurs en France'
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProPage;
