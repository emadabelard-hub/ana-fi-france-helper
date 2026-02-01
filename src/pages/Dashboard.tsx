import { useNavigate } from 'react-router-dom';
import { Music, HelpCircle, Briefcase, ArrowRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const quickAccessCards = [
    {
      icon: Music,
      title: 'بوابة الترفيه',
      description: 'قرآن، أجواء مصرية، ونكتة اليوم',
      path: '/radio',
      gradient: 'from-accent/20 to-accent/5',
    },
    {
      icon: HelpCircle,
      title: 'أريد حلاً',
      description: 'تحليل الأوراق وكتابة الخطابات',
      path: '/assistant',
      gradient: 'from-primary/20 to-primary/5',
    },
    {
      icon: Briefcase,
      title: 'بوابة الأرتيزان والدوفي',
      description: 'فواتير، دوفيهات، ومساعدة للمحترفين',
      path: '/pro',
      gradient: 'from-green-500/20 to-green-500/5',
    },
  ];

  return (
    <div className="py-6 space-y-8">
      {/* Welcome Section */}
      <section className={cn("text-center space-y-2", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {t('dashboard.welcome')}
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </section>

      {/* Quick Access Cards */}
      <section className="space-y-4">
        <h2 className={cn(
          "text-lg font-semibold text-foreground",
          isRTL && "text-right font-cairo"
        )}>
          {t('dashboard.quickAccess')}
        </h2>

        <div className="grid gap-4">
          {quickAccessCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.path}
                className={cn(
                  "cursor-pointer transition-all duration-300 hover:shadow-lg",
                  "border-none bg-gradient-to-br",
                  card.gradient,
                  "overflow-hidden group"
                )}
                onClick={() => navigate(card.path)}
              >
                <CardContent className={cn(
                  "flex items-center gap-4 p-6",
                  isRTL && "flex-row-reverse"
                )}>
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center",
                    "bg-card shadow-sm group-hover:scale-105 transition-transform"
                  )}>
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  
                  <div className={cn(
                    "flex-1",
                    isRTL && "text-right"
                  )}>
                    <h3 className={cn(
                      "font-semibold text-foreground text-lg",
                      isRTL && "font-cairo"
                    )}>
                      {card.title}
                    </h3>
                    <p className={cn(
                      "text-sm text-muted-foreground mt-1",
                      isRTL && "font-cairo"
                    )}>
                      {card.description}
                    </p>
                  </div>

                  <Arrow className={cn(
                    "h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors",
                    "group-hover:translate-x-1",
                    isRTL && "group-hover:-translate-x-1 group-hover:translate-x-0"
                  )} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Info Banner */}
      <section>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className={cn(
            "p-4 text-center",
            isRTL && "font-cairo"
          )}>
            <p className="text-sm text-muted-foreground">
              {isRTL 
                ? '🇫🇷 تطبيقك للمساعدة في الإجراءات الإدارية الفرنسية'
                : '🇫🇷 Votre application d\'aide aux démarches administratives françaises'
              }
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
