import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/auth/AuthModal';
import CompanyProfileSection from '@/components/profile/CompanyProfileSection';

const ProSettingsPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!user) {
    return (
      <div className="py-6 space-y-6">
        <section className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
          <Button variant="ghost" size="icon" onClick={() => navigate('/pro')} className="shrink-0">
            {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </Button>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn("text-2xl font-bold text-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'إعدادات الشركة' : 'Paramètres entreprise'}
            </h1>
          </div>
        </section>
        <div className={cn("text-center space-y-4 py-8", isRTL && "font-cairo")}>
          <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Settings className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'غير متاح حاليا' : 'Non disponible pour le moment'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <section className={cn(
        "flex items-center gap-4",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/pro')}
          className="shrink-0"
        >
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn(
            "text-2xl font-bold text-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'هويتي المهنية' : 'Mon identité professionnelle'}
          </h1>
          <p className={cn(
            "text-sm text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'بيانات الشركة للفواتير والدوفيهات' : 'Informations entreprise pour vos documents'}
          </p>
        </div>
      </section>

      {/* Company Profile Form */}
      <CompanyProfileSection />
    </div>
  );
};

export default ProSettingsPage;
