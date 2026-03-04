
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { PenLine, Settings, ArrowRight, ArrowLeft, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

import QuoteToInvoiceIcon from '@/components/pro/QuoteToInvoiceIcon';
const ProPage = () => {
  const { isRTL, t } = useLanguage();
  const navigate = useNavigate();

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const mainTools = [
    {
      icon: null,
      customIcon: null,
      emoji: '🏗️',
      title: isRTL ? 'تحويل الصور، الخرائط، الـ PDF، وطلبات الزبون' : 'Smart Devis IA',
      description: isRTL ? 'ارفع طلباتك.. وأنا أعملك الدوفي قبل ما تخلص شرب قهوتك ☕' : 'Photos, plans, PDF → Devis intelligent par IA ☕',
      path: '/pro/smart-devis',
      gradient: 'from-blue-600 to-emerald-500',
    },
    {
      icon: PenLine,
      emoji: '📄',
      title: isRTL ? 'فواتير ودوفيهات' : 'Factures & Devis',
      description: isRTL ? 'اعمل الفاكتير والدوفي بتوعك بسهولة أو حوّل الدوفي لفاتورة' : 'Créez vos factures et devis facilement ou convertissez un devis en facture',
      path: '/pro/invoice-creator',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: null,
      customIcon: QuoteToInvoiceIcon,
      emoji: null,
      title: t('pro.quoteToInvoice'),
      description: t('pro.quoteToInvoiceDesc'),
      path: '/pro/quote-to-invoice',
      gradient: 'from-amber-500 to-emerald-500',
    },
    {
      icon: FolderOpen,
      customIcon: null,
      emoji: null,
      title: isRTL ? 'مستنداتي المحاسبية' : 'Mes Documents',
      description: isRTL ? 'شوف كل الدوفيهات والفواتير اللي عملتها' : 'Consultez vos devis et factures sauvegardés',
      path: '/pro/documents',
      gradient: 'from-yellow-600 to-amber-700',
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
                  </div>

                  {/* Arrow */}
                  <Arrow className="h-6 w-6 text-white/60" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Settings Link - بيانات شركتي */}
      <Card 
        className="cursor-pointer bg-red-700 hover:bg-red-800 border-red-800 transition-colors"
        onClick={() => navigate('/pro/settings')}
      >
        <CardContent className={cn(
          "flex items-center gap-6 p-8",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center">
            <Settings className="h-8 w-8 text-white" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h3 className={cn(
              "font-bold text-white text-2xl",
              isRTL && "font-cairo"
            )}>
              {t('pro.settings')}
            </h3>
            <p className={cn(
              "text-base text-white/80 font-bold mt-1",
              isRTL && "font-cairo"
            )}>
              {t('pro.settingsDesc')}
            </p>
          </div>
          <Arrow className="h-6 w-6 text-white" />
        </CardContent>
      </Card>

    </div>
  );
};

export default ProPage;
