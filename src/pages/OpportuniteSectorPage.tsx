import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, ArrowRight,
  HardHat, Truck, UtensilsCrossed, Store, Sparkles as SparklesIcon,
  Factory, Laptop, Baby, Sprout, Package,
  HardHat as WorkerIcon, Building2, Wrench, Handshake,
} from 'lucide-react';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

type SectorDef = {
  slug: string;
  icon: any;
  fr: string;
  ar: string;
  descFr: string;
  descAr: string;
};

export const OPPORTUNITE_SECTORS: SectorDef[] = [
  { slug: 'btp', icon: HardHat, fr: 'BTP et travaux', ar: 'البناء والأشغال',
    descFr: 'Tous les métiers du bâtiment et des travaux.',
    descAr: 'كل مهن البناء والأشغال.' },
  { slug: 'transport', icon: Truck, fr: 'Transport et livraison', ar: 'النقل والتوصيل',
    descFr: 'Chauffeurs, livreurs, coursiers et logistique de transport.',
    descAr: 'سواقين، موصلين، ومهن النقل.' },
  { slug: 'restauration', icon: UtensilsCrossed, fr: 'Restauration', ar: 'المطاعم',
    descFr: 'Cuisine, service en salle, restauration rapide et traiteur.',
    descAr: 'مطبخ، خدمة، مطاعم سريعة وتموين.' },
  { slug: 'commerce', icon: Store, fr: 'Commerce et vente', ar: 'التجارة والبيع',
    descFr: 'Vendeurs, commerciaux et métiers du commerce.',
    descAr: 'باعة ومهن التجارة.' },
  { slug: 'nettoyage', icon: SparklesIcon, fr: 'Nettoyage', ar: 'التنظيف',
    descFr: 'Ménage, entretien de locaux et propreté professionnelle.',
    descAr: 'تنظيف المنازل والمحلات والمكاتب.' },
  { slug: 'industrie', icon: Factory, fr: 'Industrie et logistique', ar: 'الصناعة واللوجستيك',
    descFr: 'Opérateurs, manutention, entrepôt et production.',
    descAr: 'عمال الإنتاج والمخازن واللوجستيك.' },
  { slug: 'informatique', icon: Laptop, fr: 'Informatique et services', ar: 'المعلوماتية والخدمات',
    descFr: 'Développeurs, support informatique et services numériques.',
    descAr: 'المطورين والدعم الفني والخدمات الرقمية.' },
  { slug: 'services-personne', icon: Baby, fr: 'Services à la personne', ar: 'خدمات الأفراد',
    descFr: 'Aide à domicile, garde d\'enfants, accompagnement des personnes.',
    descAr: 'المساعدة في المنزل ورعاية الأطفال وكبار السن.' },
  { slug: 'agriculture', icon: Sprout, fr: 'Agriculture', ar: 'الزراعة',
    descFr: 'Métiers agricoles, maraîchage et espaces verts.',
    descAr: 'مهن الزراعة والمساحات الخضراء.' },
  { slug: 'autres', icon: Package, fr: 'Autres métiers', ar: 'مهن أخرى',
    descFr: 'Tous les autres métiers et activités professionnelles.',
    descAr: 'باقي المهن والأنشطة المهنية.' },
];

const OpportuniteSectorPage = () => {
  const { sector } = useParams();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  const def = OPPORTUNITE_SECTORS.find((s) => s.slug === sector);

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";

  const notifySoon = () => {
    toast({
      title: isRTL ? 'قريباً' : 'Bientôt disponible',
      description: isRTL
        ? 'الخدمة دي هتكون متاحة قريباً.'
        : 'Cette fonctionnalité sera bientôt disponible.',
    });
  };

  if (!def) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: COLORS.pageBg, fontFamily }}
      >
        <p className="text-[14px] font-bold" style={{ color: COLORS.navyDark }}>
          {isRTL ? 'القطاع غير موجود' : 'Secteur introuvable'}
        </p>
        <button
          onClick={() => navigate('/opportunites')}
          className="mt-4 rounded-xl px-4 py-2 font-extrabold text-[13px]"
          style={{ background: COLORS.goldDark, color: 'white' }}
        >
          {isRTL ? 'رجوع' : 'Retour'}
        </button>
      </div>
    );
  }

  const SectorIcon = def.icon;
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const actions = [
    { icon: WorkerIcon, titleFr: 'Je cherche un emploi', titleAr: 'أبحث عن عمل' },
    { icon: Building2, titleFr: 'Je recrute', titleAr: 'أبحث عن عامل' },
    { icon: Wrench, titleFr: 'Je propose mes services', titleAr: 'أعرض خدماتي' },
    { icon: Handshake, titleFr: 'Je cherche un sous-traitant', titleAr: 'أبحث عن مقاول فرعي' },
  ];

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: COLORS.pageBg, fontFamily }}
    >
      {/* HERO */}
      <section
        className="px-5 pt-6 pb-8"
        style={{
          background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%)`,
          color: 'white',
        }}
      >
        <button
          onClick={() => navigate('/opportunites')}
          className={cn(
            'inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85 hover:text-white',
            isRTL && 'flex-row-reverse',
          )}
        >
          <BackIcon size={14} />
          {isRTL ? 'الفرص المهنية' : 'Opportunités'}
        </button>

        <div className={cn('mt-4 flex items-center gap-3', isRTL && 'flex-row-reverse')}>
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})` }}
          >
            <SectorIcon size={24} style={{ color: COLORS.navyDark }} />
          </div>
          <div className={cn('flex-1 min-w-0', isRTL ? 'text-right' : 'text-left')}>
            <h1 className="text-[20px] font-extrabold leading-tight">
              {isRTL ? def.ar : def.fr}
            </h1>
            <p className="text-[12px] text-white/80 mt-1 leading-snug">
              {isRTL ? def.descAr : def.descFr}
            </p>
          </div>
        </div>
      </section>

      {/* ACTIONS */}
      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.titleFr}
              onClick={notifySoon}
              className="rounded-2xl bg-white p-4 shadow-sm border active:scale-[0.98] transition"
              style={{ borderColor: '#E5E9F0' }}
            >
              <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})` }}
                >
                  <Icon size={22} style={{ color: COLORS.navyDark }} />
                </div>
                <div className={cn('flex-1 min-w-0', isRTL ? 'text-right' : 'text-left')}>
                  <h3 className="text-[14px] font-extrabold" style={{ color: COLORS.navyDark }}>
                    {isRTL ? a.titleAr : a.titleFr}
                  </h3>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="h-8" />
    </div>
  );
};

export default OpportuniteSectorPage;
