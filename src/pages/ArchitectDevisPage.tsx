import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const ArchitectDevisPage = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/anafy-translate')}
          className={cn(
            'mb-4 gap-1 font-medium',
            isRTL && 'flex-row-reverse font-cairo'
          )}
        >
          <Arrow className="h-4 w-4" />
          {isRTL ? 'رجوع' : 'Retour'}
        </Button>

        <h1 className={cn(
          'text-2xl font-bold text-foreground mb-4',
          isRTL && 'text-right font-cairo'
        )}>
          {isRTL
            ? 'اعمل الدوفي من مستندات الأرشيتكت'
            : 'Créer un devis depuis les documents de l’architecte'}
        </h1>

        <p className={cn(
          'text-sm text-muted-foreground leading-relaxed',
          isRTL && 'text-right font-cairo'
        )}>
          {isRTL
            ? 'قريباً هتقدر تضيف مستندات الأرشيتكت ونحوّلها لك في دوفي جاهز.'
            : 'Vous pourrez bientôt ajouter les documents de l’architecte pour en générer un devis.'}
        </p>
      </div>
    </div>
  );
};

export default ArchitectDevisPage;
