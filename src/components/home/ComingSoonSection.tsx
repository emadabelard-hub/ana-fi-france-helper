import { useNavigate } from 'react-router-dom';
import { Scale, MonitorSmartphone, Headphones, Paintbrush, GraduationCap, Gift, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ComingSoonFeature {
  id: string;
  icon: React.ReactNode;
  titleAr: string;
  titleFr: string;
  descAr: string;
  descFr: string;
  path: string;
}

const features: ComingSoonFeature[] = [
  {
    id: 'language-school',
    icon: <GraduationCap size={20} className="text-[hsl(37,37%,60%)]" />,
    titleAr: 'برنامج A1 A2 - B1 B2',
    titleFr: 'Programme A1 A2 - B1 B2',
    descAr: 'تحت التجربة والانشاء',
    descFr: 'En cours de test',
    path: '/language-school',
  },
  {
    id: 'legal',
    icon: <Scale size={20} className="text-[hsl(37,37%,60%)]" />,
    titleAr: 'مستشارك القانوني والمهني',
    titleFr: 'Consultant Juridique Pro',
    descAr: 'تحليل مستندات • استشارة احترافية',
    descFr: 'Analyse de documents • Consultation pro',
    path: '/premium-consultation',
  },
  {
    id: 'admin-assistant',
    icon: <MonitorSmartphone size={20} className="text-[hsl(220,40%,45%)]" />,
    titleAr: 'المساعد الإداري الشامل',
    titleFr: 'Assistant Administratif Universel',
    descAr: 'صوّر أي موقع فرنسي وأنا هاشرح لك',
    descFr: 'Capturez n\'importe quel site français',
    path: '/universal-admin-assistant',
  },
  {
    id: 'service',
    icon: <Headphones size={20} className="text-[hsl(220,40%,45%)]" />,
    titleAr: 'خدمة متخصصة',
    titleFr: 'Service Spécialisé',
    descAr: 'متخصص يقوم بالإجراءات نيابة عنك',
    descFr: 'Un spécialiste effectue vos démarches',
    path: '/service-request',
  },
  {
    id: 'peinture',
    icon: <Paintbrush size={20} className="text-[hsl(0,0%,60%)]" />,
    titleAr: 'دراسة الجدوى وتكاليف الشانتي',
    titleFr: 'Étude de Faisabilité & Coûts Chantier',
    descAr: 'احسب تكاليف أعمال الصباغة',
    descFr: 'Estimez vos coûts de peinture',
    path: '/pro/peinture',
  },
];

const ComingSoonSection = forwardRef<HTMLDivElement>((_, ref) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc('is_admin', { _user_id: user.id }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  return (
    <div className="mb-6">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-card p-4 rounded-3xl flex items-center gap-3 transition-all duration-200 border border-border shadow-sm",
          isRTL && "flex-row-reverse"
        )}
      >
        <div className="bg-gradient-to-br from-[hsl(260,45%,55%)] to-[hsl(260,45%,40%)] p-2.5 rounded-xl shrink-0">
          <Gift size={20} className="text-white" />
        </div>
        <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
          <h3 className={cn("font-bold text-base text-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'حاجات جديدة بنجهزها' : 'Nouveautés en préparation'}
          </h3>
          <p className={cn("text-xs text-muted-foreground mt-0.5", isRTL && "font-cairo")}>
            {isRTL ? 'تحت الإنشاء' : 'En construction'}
          </p>
        </div>
        <svg
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable List */}
      {isOpen && (
        <div className="mt-2 flex flex-col gap-1 bg-card rounded-3xl border border-border overflow-hidden p-2">
          {features.map((f) => {
            const isClickable = isAdmin;

            return (
              <div
                key={f.id}
                onClick={() => isClickable && navigate(f.path)}
                className={cn(
                  "w-full px-4 py-3 rounded-2xl flex items-center gap-3 transition-all duration-150",
                  isClickable
                    ? "cursor-pointer hover:bg-muted/60 active:scale-[0.98]"
                    : "cursor-default opacity-50",
                  isRTL && "flex-row-reverse"
                )}
              >
                <div className="shrink-0">{f.icon}</div>
                <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
                  <p className={cn("font-semibold text-sm text-foreground leading-snug", isRTL && "font-cairo")}>
                    {isRTL ? f.titleAr : f.titleFr}
                  </p>
                  <p className={cn("text-xs text-muted-foreground mt-0.5", isRTL && "font-cairo")}>
                    {isRTL ? f.descAr : f.descFr}
                  </p>
                </div>
                {!isClickable && (
                  <Lock size={12} className="text-muted-foreground/40 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ComingSoonSection;
