import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, FileText, Home } from 'lucide-react';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const PaymentSuccessPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const returnPath = searchParams.get('return') || '/';
  const price = searchParams.get('price') || '';

  useEffect(() => {
    toast({
      title: isRTL ? 'وضع تجريبي' : 'Mode test',
      description: isRTL
        ? 'هذه نسخة تجريبية، لم يتم إجراء أي معاملة حقيقية.'
        : 'Ceci est une version de test, aucune transaction réelle n\'est effectuée.',
    });
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className={cn(
        "w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl border-none",
        "bg-card text-card-foreground",
        "flex flex-col items-center text-center gap-6"
      )}>
        {/* Animated checkmark */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center animate-[scale-in_0.5s_ease-out]">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 animate-[bounce-in_0.6s_ease-out_0.2s_both]" />
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '2s', animationIterationCount: '3' }} />
        </div>

        {/* Main message */}
        <div className="space-y-2">
          <h1 className={cn(
            "text-2xl font-black text-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'تم قبول الدفع.. شكراً على ثقتك فينا' : 'Paiement accepté.. Merci pour votre confiance'}
            {price && <span className="block text-lg font-bold text-emerald-500 mt-1">{price} €</span>}
          </h1>
          <p className={cn(
            "text-sm text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'جاري تحضير مستندك الآن بكل دقة' : 'Votre document est en cours de préparation avec soin'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full mt-2">
          <Button
            onClick={() => navigate(returnPath)}
            size="lg"
            className="w-full gap-2 rounded-2xl text-base font-bold"
          >
            <FileText className="h-5 w-5" />
            {isRTL ? 'عرض المستند' : 'Voir le document'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            size="lg"
            className="w-full gap-2 rounded-2xl text-base font-bold"
          >
            <Home className="h-5 w-5" />
            {isRTL ? 'العودة للرئيسية' : 'Retour accueil'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PaymentSuccessPage;
