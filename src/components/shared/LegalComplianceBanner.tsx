import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const LegalComplianceBanner = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile, isLoading } = useProfile();
  const navigate = useNavigate();

  // Don't show if not logged in, loading, or no profile
  if (!user || isLoading || !profile) return null;

  // Check if legal fields are complete
  const hasAssurance = !!(profile as any).assureur_name && !!(profile as any).assurance_policy_number;
  const hasSiret = !!profile.siret;

  // If both are filled, banner disappears
  if (hasAssurance && hasSiret) return null;

  return (
    <div className={cn(
      "w-full rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 mb-4",
      isRTL && "text-right"
    )}>
      <div className={cn(
        "flex items-start gap-3",
        isRTL && "flex-row-reverse"
      )}>
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 space-y-2">
          <p className={cn(
            "font-bold text-sm text-amber-800 dark:text-amber-300",
            isRTL && "font-cairo"
          )}>
            ⚠️ {isRTL
              ? 'إجراء مطلوب: أكمل بياناتك القانونية لتفعيل حماية 2026'
              : 'Action requise : Complétez vos informations légales pour activer la protection 2026'}
          </p>
          <ul className={cn(
            "text-xs text-amber-700 dark:text-amber-400 space-y-1",
            isRTL && "font-cairo"
          )}>
            {!hasSiret && (
              <li>• {isRTL ? 'رقم SIRET ناقص' : 'Numéro SIRET manquant'}</li>
            )}
            {!hasAssurance && (
              <li>• {isRTL
                ? 'تأمين عشري (Décennale) غير مكتمل: اسم المؤمّن، رقم العقد، منطقة التغطية'
                : 'Assurance Décennale incomplète : Assureur, N° de contrat, Zone de couverture'}
              </li>
            )}
          </ul>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/profile?tab=company')}
            className={cn(
              "mt-1 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20",
              isRTL && "font-cairo"
            )}
          >
            <Settings className="h-4 w-4 mr-1.5" />
            {isRTL ? 'الإعدادات' : 'Paramètres'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LegalComplianceBanner;
