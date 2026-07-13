import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Briefcase } from 'lucide-react';
import {
  OPPORTUNITE_SECTORS,
  getMetiers,
  findSector,
} from '@/data/opportuniteTaxonomy';

// Re-export for backward compatibility with pages importing from here
export { OPPORTUNITE_SECTORS };

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

const OpportuniteSectorPage = () => {
  const { sector } = useParams();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  const def = findSector(sector);
  const metiers = getMetiers(sector);

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";

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

  const goToMetier = (metierSlug: string) => {
    navigate(`/opportunites/annonces?secteur=${def.slug}&metier=${metierSlug}`);
  };

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

      {/* MÉTIERS */}
      <div className="px-4 mt-4 pb-10">
        <div className={cn('mb-2 flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}>
          <h2 className="text-[13px] font-extrabold" style={{ color: COLORS.navyDark }}>
            {isRTL ? 'اختر المهنة' : 'Choisissez un métier'}
          </h2>
          <button
            onClick={() => navigate(`/opportunites/annonces?secteur=${def.slug}`)}
            className="text-[11px] font-bold underline"
            style={{ color: COLORS.navyDark }}
          >
            {isRTL ? 'كل الإعلانات' : 'Toutes les annonces'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {metiers.map((mt) => (
            <button
              key={mt.slug}
              onClick={() => goToMetier(mt.slug)}
              className="rounded-2xl bg-white p-3 shadow-sm border active:scale-[0.98] transition text-left"
              style={{ borderColor: '#E5E9F0' }}
            >
              <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})` }}
                >
                  <Briefcase size={16} style={{ color: COLORS.navyDark }} />
                </div>
                <span
                  className={cn(
                    'text-[12px] font-extrabold leading-tight line-clamp-2',
                    isRTL ? 'text-right' : 'text-left',
                  )}
                  style={{ color: COLORS.navyDark }}
                >
                  {isRTL ? mt.ar : mt.fr}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OpportuniteSectorPage;
