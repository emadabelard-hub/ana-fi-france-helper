import { useNavigate } from 'react-router-dom';
import { FileText, MessageSquare, PenLine, Mail, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import ValuePropositions from '@/components/home/ValuePropositions';

const Dashboard = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const consultationItems = [
    {
      icon: MessageSquare,
      title: isRTL ? 'استشارات وحلول' : 'Consultations & Solutions',
      description: isRTL 
        ? 'صور أي جواب أو اشرح مشكلتك الإدارية، وهقولك الحل القانوني فوراً.' 
        : 'Photographiez une lettre ou décrivez votre problème administratif.',
      path: '/assistant',
      gradient: 'from-primary/20 to-primary/5',
      emoji: '📄',
    },
    {
      icon: Mail,
      title: isRTL ? 'اكتبلي خطاب/إيميل' : 'Rédiger courrier/email',
      description: isRTL 
        ? 'هكتبلك جواب رسمي أو إيميل بالفرنساوي لأي جهة.' 
        : 'Je rédige une lettre ou email officiel en français.',
      path: '/assistant',
      gradient: 'from-blue-500/20 to-blue-500/5',
      emoji: '✉️',
    },
  ];

  const proItems = [
    {
      icon: PenLine,
      title: isRTL ? 'الفواتير والدوفيهات' : 'Factures & Devis',
      description: isRTL 
        ? 'اعمل فواتيرك ودوفيهاتك باحترافية.' 
        : 'Créez vos factures et devis professionnellement.',
      path: '/pro/invoice-creator',
      gradient: 'from-green-500/20 to-green-500/5',
      emoji: '🧾',
    },
    {
      icon: Briefcase,
      title: isRTL ? 'مساعد الارتيزان' : 'Assistant Artisan',
      description: isRTL 
        ? 'حلك لمشاكل الـ URSSAF، الضرايب، ومنازعات الشغل.' 
        : 'URSSAF, impôts et litiges professionnels.',
      path: '/pro/admin-assistant',
      gradient: 'from-purple-500/20 to-purple-500/5',
      emoji: '🔧',
    },
  ];

  const renderActionCard = (action: typeof consultationItems[0]) => {
    const Icon = action.icon;
    return (
      <Card
        key={action.path + action.title}
        className={cn(
          "cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.01]",
          "border-none bg-gradient-to-br overflow-hidden",
          action.gradient
        )}
        onClick={() => navigate(action.path)}
      >
        <CardContent className={cn(
          "flex items-center gap-4 p-4",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center shadow-sm">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h3 className="font-bold text-foreground text-lg font-cairo">
              {action.emoji} {action.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 font-cairo">
              {action.description}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="py-8 space-y-6">
      {/* Welcome Section */}
      <section className="text-center space-y-3 font-cairo">
        <h1 className="text-2xl font-bold text-foreground">
          مرحباً بك في أنا في فرنسا
        </h1>
        <p className="text-muted-foreground text-lg">
          مساعدك الإداري الذكي
        </p>
      </section>

      {/* Accordion Navigation */}
      <section>
        <Accordion type="multiple" defaultValue={['consultations', 'pro']} className="space-y-3">
          {/* Consultations Section */}
          <AccordionItem value="consultations" className="border rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10">
            <AccordionTrigger className={cn(
              "px-4 py-3 hover:no-underline",
              isRTL && "flex-row-reverse"
            )}>
              <div className={cn(
                "flex items-center gap-3",
                isRTL && "flex-row-reverse"
              )}>
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className={cn(isRTL && "text-right")}>
                  <h2 className="font-bold text-foreground text-lg font-cairo">
                    📄 {isRTL ? 'استشارات وحلول' : 'Consultations & Solutions'}
                  </h2>
                  <p className="text-xs text-muted-foreground font-cairo">
                    {isRTL ? 'مساعدة في المشاكل الإدارية' : 'Aide administrative'}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 space-y-3">
              {consultationItems.map(renderActionCard)}
            </AccordionContent>
          </AccordionItem>

          {/* Professional Tools Section */}
          <AccordionItem value="pro" className="border rounded-xl overflow-hidden bg-gradient-to-br from-accent/5 to-accent/10">
            <AccordionTrigger className={cn(
              "px-4 py-3 hover:no-underline",
              isRTL && "flex-row-reverse"
            )}>
              <div className={cn(
                "flex items-center gap-3",
                isRTL && "flex-row-reverse"
              )}>
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div className={cn(isRTL && "text-right")}>
                  <h2 className="font-bold text-foreground text-lg font-cairo">
                    💪 {isRTL ? 'دراعك اليمين' : 'Votre bras droit'}
                  </h2>
                  <p className="text-xs text-muted-foreground font-cairo">
                    {isRTL ? 'أدوات الحرفيين والمستقلين' : 'Outils pour artisans'}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-2 space-y-3">
              {proItems.map(renderActionCard)}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Value Propositions Carousel */}
      <ValuePropositions />

      {/* Info Banner */}
      <section>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center font-cairo">
            <p className="text-sm text-muted-foreground">
              🇫🇷 تطبيقك للمساعدة في الإجراءات الإدارية الفرنسية
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Hidden Admin Link for Testing */}
      <button 
        onClick={() => navigate('/admin')}
        className="text-xs text-muted-foreground/50 hover:text-primary"
      >
        Admin
      </button>
    </div>
  );
};

export default Dashboard;
