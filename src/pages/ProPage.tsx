import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { PenLine, Settings, ArrowRight, ArrowLeft, FileUser, Paintbrush } from 'lucide-react';
import { cn } from '@/lib/utils';
import QuoteToInvoiceIcon from '@/components/pro/QuoteToInvoiceIcon';

const ProPage = () => {
  const { isRTL, t } = useLanguage();
  const navigate = useNavigate();

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const mainTools = [
    {
      icon: PenLine,
      emoji: '📄',
      title: t('pro.invoices'),
      description: t('pro.invoicesDesc'),
      path: '/pro/invoice-creator',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: null, // Custom icon component
      customIcon: QuoteToInvoiceIcon,
      emoji: null,
      title: t('pro.quoteToInvoice'),
      description: t('pro.quoteToInvoiceDesc'),
      path: '/pro/quote-to-invoice',
      gradient: 'from-amber-500 to-emerald-500',
    },
    {
      icon: FileUser,
      emoji: '📄',
      title: t('pro.cvGenerator'),
      description: t('pro.cvGeneratorDesc'),
      description2: t('pro.cvGeneratorDesc2'),
      path: '/pro/cv-generator',
      gradient: 'from-indigo-500 to-purple-600',
    },
    {
      icon: Paintbrush,
      customIcon: null,
      emoji: '🎨',
      title: isRTL ? 'قبل ما تعمل الدوفي احسب التكاليف والجدوى معانا. احنا والذكاء الصناعي واحد' : 'Calcule tes coûts et ta rentabilité avant de faire ton devis. L\'IA à ton service.',
      description: isRTL ? 'حاسبة الصباغة والتكاليف' : 'Module Peinture & Estimation',
      path: '/pro/peinture',
      gradient: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <div className="py-4 space-y-6">
      {/* Page Header */}
      <section className={cn("text-center", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('pro.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('pro.subtitle')}
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
                    {tool.description2 && (
                      <p className={cn(
                        "text-white/80 text-sm",
                        isRTL && "font-cairo"
                      )}>
                        {tool.description2}
                      </p>
                    )}
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
              {t('pro.settings')}
            </h3>
            <p className={cn(
              "text-xs text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              {t('pro.settingsDesc')}
            </p>
          </div>
          <Arrow className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>

    </div>
  );
};

export default ProPage;
