import { useNavigate } from 'react-router-dom';
import { FileText, Receipt, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const actionButtons = [
    {
      icon: FileText,
      title: 'تصحيح أو كتابة خطاب',
      subtitle: 'رسائل إدارية باللغة الفرنسية',
      path: '/assistant',
      gradient: 'from-primary/20 to-primary/5',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      icon: Receipt,
      title: 'عمل دوفي أو فاتورة',
      subtitle: 'للحرفيين والمقاولين',
      path: '/pro/invoice-creator',
      gradient: 'from-accent/20 to-accent/5',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
    {
      icon: MessageSquare,
      title: 'المساعد الإداري',
      subtitle: 'اسأل أي سؤال إداري أو قانوني',
      path: '/pro/admin-assistant',
      gradient: 'from-green-500/20 to-green-500/5',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-600',
    },
  ];

  return (
    <div className="py-8 space-y-8">
      {/* Welcome Section */}
      <section className="text-center space-y-3 font-cairo">
        <h1 className="text-2xl font-bold text-foreground">
          مرحباً بك في أنا في فرنسا
        </h1>
        <p className="text-muted-foreground text-lg">
          مساعدك الإداري الذكي
        </p>
      </section>

      {/* Action Buttons */}
      <section className="space-y-4">
        {actionButtons.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.path}
              className={cn(
                "cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
                "border-none bg-gradient-to-br overflow-hidden",
                action.gradient
              )}
              onClick={() => navigate(action.path)}
            >
              <CardContent className={cn(
                "flex items-center gap-5 p-6",
                isRTL && "flex-row-reverse"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm",
                  action.iconBg
                )}>
                  <Icon className={cn("h-8 w-8", action.iconColor)} />
                </div>
                
                <div className={cn(
                  "flex-1",
                  isRTL && "text-right"
                )}>
                  <h3 className="font-bold text-foreground text-xl font-cairo">
                    {action.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 font-cairo">
                    {action.subtitle}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

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
    </div>
  );
};

export default Dashboard;
