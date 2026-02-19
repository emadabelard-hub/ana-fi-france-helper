import { useNavigate } from 'react-router-dom';
import { Scale, MonitorSmartphone, Headphones, Paintbrush, Construction, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ComingSoonFeature {
  id: string;
  icon: React.ReactNode;
  titleAr: string;
  titleFr: string;
  descAr: string;
  descFr: string;
  path: string;
  gradient: string;
  iconGradient: string;
}

const features: ComingSoonFeature[] = [
  {
    id: 'legal',
    icon: <Scale size={24} className="text-white" />,
    titleAr: 'مستشارك القانوني والمهني',
    titleFr: 'Consultant Juridique Pro',
    descAr: 'تحليل مستندات • استشارة احترافية',
    descFr: 'Analyse de documents • Consultation pro',
    path: '/premium-consultation',
    gradient: 'from-[#FFF3E0] to-[#FFE0B2] dark:from-[#2A1F0A] dark:to-[#1F1500]',
    iconGradient: 'from-[#f59e0b] to-[#ea580c]',
  },
  {
    id: 'admin-assistant',
    icon: <MonitorSmartphone size={24} className="text-white" />,
    titleAr: 'المساعد الإداري الشامل',
    titleFr: 'Assistant Administratif Universel',
    descAr: 'صوّر أي موقع فرنسي وأنا هاشرح لك',
    descFr: 'Capturez n\'importe quel site français',
    path: '/universal-admin-assistant',
    gradient: 'from-[#E0F2F1] to-[#B2DFDB] dark:from-[#0A2A28] dark:to-[#081F1D]',
    iconGradient: 'from-[#14b8a6] to-[#0d9488]',
  },
  {
    id: 'service',
    icon: <Headphones size={24} className="text-white" />,
    titleAr: 'خدمة متخصصة',
    titleFr: 'Service Spécialisé',
    descAr: 'متخصص يقوم بالإجراءات نيابة عنك',
    descFr: 'Un spécialiste effectue vos démarches',
    path: '/service-request',
    gradient: 'from-[#E8EAF6] to-[#C5CAE9] dark:from-[#1A1A2E] dark:to-[#16213E]',
    iconGradient: 'from-[#5c6bc0] to-[#3949ab]',
  },
  {
    id: 'peinture',
    icon: <Paintbrush size={24} className="text-white" />,
    titleAr: 'دراسة الجدوى وتكاليف الشانتي',
    titleFr: 'Étude de Faisabilité & Coûts Chantier',
    descAr: 'احسب تكاليف أعمال الصباغة',
    descFr: 'Estimez vos coûts de peinture',
    path: '/pro/peinture',
    gradient: 'from-[#FCE4EC] to-[#F8BBD0] dark:from-[#2A0A1A] dark:to-[#1F0815]',
    iconGradient: 'from-[#e91e63] to-[#c2185b]',
  },
];

const ComingSoonSection = () => {
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
          "w-full bg-gradient-to-br from-muted to-muted/60 p-4 rounded-2xl flex items-center gap-3 transition-all duration-200 border border-border shadow-sm",
          isRTL && "flex-row-reverse"
        )}
      >
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2.5 rounded-xl shrink-0">
          <Construction size={22} className="text-white" />
        </div>
        <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
          <h3 className={cn("font-black text-sm text-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'حاجات جديدة بنجهزها' : 'Nouveautés en préparation'}
          </h3>
          <p className={cn("text-[10px] text-muted-foreground mt-0.5", isRTL && "font-cairo")}>
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

      {/* Expandable Content */}
      {isOpen && (
        <div className="mt-3 flex flex-col gap-2.5">
          {features.map((f) => {
            const isClickable = isAdmin;

            return (
              <div
                key={f.id}
                onClick={() => isClickable && navigate(f.path)}
                className={cn(
                  "w-full bg-gradient-to-br p-4 rounded-2xl flex items-center gap-3 border shadow-sm relative overflow-hidden",
                  f.gradient,
                  isClickable
                    ? "cursor-pointer active:scale-[0.98] transition-all duration-200 border-border"
                    : "cursor-default opacity-60 border-border/50"
                )}
              >
                <div className={cn("bg-gradient-to-br p-2.5 rounded-xl shrink-0", f.iconGradient)}>
                  {f.icon}
                </div>
                <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
                  <h4 className={cn("font-bold text-sm text-foreground leading-snug", isRTL && "font-cairo")}>
                    {isRTL ? f.titleAr : f.titleFr}
                  </h4>
                  <p className={cn("text-[10px] text-muted-foreground mt-0.5", isRTL && "font-cairo")}>
                    {isRTL ? f.descAr : f.descFr}
                  </p>
                </div>
                {!isClickable && (
                  <Lock size={14} className="text-muted-foreground/50 shrink-0" />
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
