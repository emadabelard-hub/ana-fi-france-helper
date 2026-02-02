import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import HowItWorksModal from '@/components/home/HowItWorksModal';

const Header = () => {
  const { language, setLanguage, isRTL } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'ar' : 'fr');
  };

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground",
      "safe-area-pt"
    )}>
      <div className={cn(
        "flex items-center justify-between px-4 py-3",
        isRTL && "flex-row-reverse"
      )}>
        <div className={cn(
          "flex items-center gap-2",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
            <span className="text-accent-foreground font-bold text-sm">AF</span>
          </div>
          <h1 className={cn(
            "text-lg font-bold",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'أنا في فرنسا' : 'Ana Fi France'}
          </h1>
        </div>

        <div className={cn(
          "flex items-center gap-2",
          isRTL && "flex-row-reverse"
        )}>
          <HowItWorksModal />
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleLanguage}
            className={cn(
              "rounded-full px-4 font-medium text-sm",
              "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
            )}
          >
            {language === 'fr' ? 'العربية' : 'Français'}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
