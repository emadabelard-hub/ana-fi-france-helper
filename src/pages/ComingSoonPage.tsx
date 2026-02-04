import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Construction } from 'lucide-react';

const ComingSoonPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className={cn(
      "min-h-[85vh] flex flex-col items-center justify-center py-8 px-4 max-w-lg mx-auto text-center",
      isRTL && "font-cairo"
    )}>
      {/* Construction Icon */}
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-6 shadow-xl">
        <Construction className="h-12 w-12 text-white" />
      </div>

      {/* Main Emoji */}
      <div className="text-6xl mb-6">🚧</div>

      {/* Main Text */}
      <h1 className={cn(
        "text-xl font-bold text-foreground mb-4 leading-relaxed",
        isRTL && "font-cairo"
      )}>
        {isRTL 
          ? 'تعرف انك ممكن تمتحن الكود بالعربي مع وجود مترجم؟'
          : 'Saviez-vous que vous pouvez passer l\'examen en arabe avec un traducteur ?'}
      </h1>

      {/* Subtext */}
      <p className={cn(
        "text-muted-foreground text-base mb-8",
        isRTL && "font-cairo"
      )}>
        {isRTL 
          ? 'قريباً... دروس وشرح كامل هنا'
          : 'Bientôt... des leçons et explications complètes ici'}
      </p>

      {/* Car Emoji */}
      <div className="text-4xl mb-8">🚗</div>

      {/* Back Button */}
      <Button
        onClick={() => navigate('/')}
        className={cn(
          "gap-2 px-6 py-3 text-base",
          "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
          isRTL && "flex-row-reverse"
        )}
      >
        <BackArrow className="h-5 w-5" />
        {isRTL ? 'العودة للرئيسية' : 'Retour à l\'accueil'}
      </Button>
    </div>
  );
};

export default ComingSoonPage;
