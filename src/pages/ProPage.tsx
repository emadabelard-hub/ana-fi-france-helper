import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Briefcase, FileText, Receipt, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProPage = () => {
  const { isRTL } = useLanguage();

  const features = [
    {
      icon: FileText,
      title: isRTL ? 'إنشاء الفواتير' : 'Création de factures',
      description: isRTL ? 'فواتير احترافية متوافقة' : 'Factures professionnelles conformes',
    },
    {
      icon: Receipt,
      title: isRTL ? 'الدوفيهات' : 'Devis',
      description: isRTL ? 'قوالب دوفيهات جاهزة' : 'Modèles de devis prêts à l\'emploi',
    },
    {
      icon: HelpCircle,
      title: isRTL ? 'مساعدة للمحترفين' : 'Aide aux professionnels',
      description: isRTL ? 'دعم للأعمال الحرة والحرفيين' : 'Support pour auto-entrepreneurs et artisans',
    },
  ];

  return (
    <div className="py-6 space-y-6">
      {/* Title */}
      <section className={cn("text-center space-y-2", isRTL && "font-cairo")}>
        <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/20 flex items-center justify-center mb-4">
          <Briefcase className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {isRTL ? 'بوابة الأرتيزان والدوفي' : 'Espace Artisan & Devis'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'فواتير، دوفيهات، ومساعدة للمحترفين' : 'Factures, devis et aide aux professionnels'}
        </p>
      </section>

      {/* Coming Soon Notice */}
      <Card className="bg-accent/10 border-accent/20">
        <CardContent className={cn(
          "p-6 text-center",
          isRTL && "font-cairo"
        )}>
          <p className="text-lg font-medium text-foreground mb-2">
            {isRTL ? '🚧 قريباً' : '🚧 Bientôt disponible'}
          </p>
          <p className="text-sm text-muted-foreground">
            {isRTL 
              ? 'هذه الميزة قيد التطوير. سنخبرك عند إطلاقها!'
              : 'Cette fonctionnalité est en cours de développement. Nous vous tiendrons informé du lancement !'
            }
          </p>
        </CardContent>
      </Card>

      {/* Features Preview */}
      <section className="space-y-4">
        <h2 className={cn(
          "text-lg font-semibold text-foreground",
          isRTL && "text-right font-cairo"
        )}>
          {isRTL ? 'الميزات القادمة' : 'Fonctionnalités à venir'}
        </h2>

        <div className="grid gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="opacity-75">
                <CardContent className={cn(
                  "flex items-center gap-4 p-4",
                  isRTL && "flex-row-reverse"
                )}>
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className={cn("flex-1", isRTL && "text-right")}>
                    <h3 className={cn(
                      "font-semibold text-foreground",
                      isRTL && "font-cairo"
                    )}>
                      {feature.title}
                    </h3>
                    <p className={cn(
                      "text-sm text-muted-foreground",
                      isRTL && "font-cairo"
                    )}>
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ProPage;
