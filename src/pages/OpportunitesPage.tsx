import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, Megaphone, Handshake, ListFilter, UserRound, MessageCircle, HeadphonesIcon } from 'lucide-react';
import { OPPORTUNITE_SECTORS } from './OpportuniteSectorPage';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  navyMid: '#1E6AA8',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

const OpportunitesPage = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [sectorCounts, setSectorCounts] = useState<Record<string, number>>({});
  const [totalActive, setTotalActive] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('opportunite_annonces')
        .select('sector')
        .eq('status', 'active')
        .limit(5000);
      if (!alive) return;
      if (error) { console.error('sector counts', error); return; }
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const s = r.sector || '__unknown__';
        counts[s] = (counts[s] || 0) + 1;
      });
      setSectorCounts(counts);
      setTotalActive((data || []).length);
    })();
    return () => { alive = false; };
  }, []);

  const formatCount = (n: number) =>
    isRTL
      ? (n === 0 ? 'لا يوجد إعلانات' : n === 1 ? 'إعلان واحد' : `${n} إعلان`)
      : (n <= 1 ? `${n} annonce` : `${n} annonces`);

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

  const mainActions = [
    {
      icon: Search,
      titleFr: 'Je cherche du travail',
      titleAr: 'أبحث عن عمل',
      descFr: 'Présentez votre métier, votre expérience et votre disponibilité.',
      descAr: 'اعرض مهنتك وخبرتك ومواعيد تواجدك.',
    },
    {
      icon: Users,
      titleFr: 'Je recrute',
      titleAr: 'أبحث عن عامل',
      descFr: 'Publiez un besoin pour trouver un salarié ou un collaborateur.',
      descAr: 'انشر احتياجك لعامل أو موظف.',
    },
    {
      icon: Megaphone,
      titleFr: 'Je propose mes services',
      titleAr: 'أعرض خدماتي',
      descFr: 'Présentez votre activité et trouvez de nouvelles missions.',
      descAr: 'اعرض خدماتك ودور على شغل جديد.',
    },
    {
      icon: Handshake,
      titleFr: 'Je cherche un sous-traitant',
      titleAr: 'أبحث عن مقاول فرعي (سو تريتان)',
      descFr: 'Trouvez un professionnel ou une entreprise pour vos chantiers et missions.',
      descAr: 'دور على صنايعي أو شركة لتنفيذ الشغل.',
    },
  ];

  const categories = OPPORTUNITE_SECTORS;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: COLORS.pageBg, fontFamily }}
    >
      {/* HERO HEADER */}
      <section
        className="px-5 pt-6 pb-8"
        style={{
          background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%)`,
          color: 'white',
        }}
      >
        <div className={cn(isRTL ? 'text-right' : 'text-left')}>
          <h1 className="text-[22px] font-extrabold leading-tight">
            {isRTL ? 'الفرص المهنية' : 'Opportunités professionnelles'}
          </h1>
          <p className="text-[13px] text-white/80 mt-2 leading-relaxed">
            {isRTL
              ? 'دور على شغل، اختار صنايعي أو طوّر شغلك مع مجتمع ANAFYPRO.'
              : 'Trouvez du travail, recrutez un professionnel ou développez votre activité grâce à la communauté ANAFYPRO.'}
          </p>
        </div>
      </section>

      {/* PUBLIER + CONSULTER CTA */}
      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/opportunites/publier')}
          className="w-full rounded-2xl py-3 font-extrabold text-[14px] shadow-md active:scale-[0.98] transition"
          style={{
            background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`,
            color: COLORS.navyDark,
          }}
        >
          {isRTL ? '＋ نشر إعلان' : '＋ Publier une annonce'}
        </button>
        <button
          onClick={() => navigate('/opportunites/annonces')}
          className="w-full rounded-2xl py-3 font-extrabold text-[14px] shadow-md active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
          style={{ background: COLORS.navyDark, color: 'white' }}
        >
          <ListFilter size={16} />
          {isRTL ? 'تصفح الإعلانات' : 'Consulter les annonces'}
          {totalActive > 0 && (
            <span
              className="ms-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
              style={{ background: COLORS.goldDark, color: 'white' }}
            >
              {totalActive}
            </span>
          )}
        </button>
      </div>

      {/* MES ANNONCES + MESSAGES CTA */}
      <div className="px-4 mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/opportunites/mes-annonces')}
          className="w-full rounded-2xl py-2.5 font-extrabold text-[13px] border active:scale-[0.98] transition inline-flex items-center justify-center gap-2 bg-white"
          style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
        >
          <UserRound size={14} />
          {isRTL ? 'إعلاناتي' : 'Mes annonces'}
        </button>
        <button
          onClick={() => navigate('/opportunites/messages')}
          className="w-full rounded-2xl py-2.5 font-extrabold text-[13px] border active:scale-[0.98] transition inline-flex items-center justify-center gap-2 bg-white"
          style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
        >
          <MessageCircle size={14} />
          {isRTL ? 'الرسائل' : 'Messages'}
        </button>
      </div>

      {/* MAIN ACTIONS */}
      <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mainActions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.titleFr}
              onClick={notifySoon}
              className="rounded-2xl bg-white p-4 shadow-sm border active:scale-[0.98] transition text-left"
              style={{ borderColor: '#E5E9F0' }}
            >
              <div className={cn('flex items-start gap-3', isRTL && 'flex-row-reverse')}>
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
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                    {isRTL ? a.descAr : a.descFr}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* CATEGORIES */}
      <div className="px-4 mt-6">
        <h2
          className={cn('text-[13px] font-bold mb-3', isRTL && 'text-right')}
          style={{ color: COLORS.navyDark }}
        >
          {isRTL ? 'القطاعات المهنية' : 'Secteurs professionnels'}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((c) => {
            const Icon = c.icon;
            const count = sectorCounts[c.slug] || 0;
            return (
              <button
                key={c.slug}
                onClick={() => navigate(`/opportunites/annonces?secteur=${c.slug}`)}
                className="rounded-2xl bg-white p-3 shadow-sm border active:scale-[0.97] transition flex flex-col items-center justify-center gap-1"
                style={{ borderColor: '#E5E9F0', minHeight: 96 }}
              >
                <Icon size={22} style={{ color: COLORS.gold }} />
                <span
                  className="text-[11px] font-bold text-center leading-tight"
                  style={{ color: COLORS.navyDark }}
                >
                  {isRTL ? c.ar : c.fr}
                </span>
                <span className="text-[10px] font-semibold text-gray-500">
                  {formatCount(count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* INFO BLOCK */}
      <div className="px-4 mt-6 mb-8">
        <div
          className="bg-white rounded-2xl p-4 border shadow-sm"
          style={{ borderColor: '#E5E9F0' }}
        >
          <p
            className={cn('text-[11px] text-gray-600 leading-relaxed', isRTL && 'text-right')}
          >
            {isRTL
              ? 'ANAFYPRO بتوفر مساحة مجانية لنشر الإعلانات المهنية. ANAFYPRO مش مكتب توظيف ومش بتتدخل في الاتفاقات بين المستخدمين.'
              : "ANAFYPRO met à disposition un espace gratuit de diffusion d'annonces professionnelles. ANAFYPRO n'est pas une agence de recrutement et n'intervient pas dans les relations entre les utilisateurs."}
          </p>
        </div>
      </div>

      {/* NOUS CONTACTER */}
      <div className="px-4 pb-24">
        <button
          onClick={() => navigate('/support')}
          className="w-full rounded-2xl py-3 font-extrabold text-[14px] shadow-md active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
          style={{ background: COLORS.navyDark, color: 'white' }}
        >
          <HeadphonesIcon size={16} />
          {isRTL ? 'تواصل معنا' : 'Nous contacter'}
        </button>
      </div>
    </div>
  );
};

export default OpportunitesPage;
