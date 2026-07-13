import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal, X, MapPin, Briefcase, Calendar, Loader2 } from 'lucide-react';
import { OPPORTUNITE_SECTORS } from './OpportuniteSectorPage';
import { getMetiers, findMetier } from '@/data/opportuniteTaxonomy';
import FavoriteButton from '@/components/opportunites/FavoriteButton';
import ShareButton from '@/components/opportunites/ShareButton';
import { fetchFavorisIds, onFavorisChanged } from '@/pages/opportunites/favoris';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

type Annonce = {
  id: string;
  reference: string;
  user_id: string;
  type: string;
  sector: string | null;
  title: string;
  ville: string | null;
  departement: string | null;
  disponibilite: string | null;
  description: string | null;
  photo_url: string | null;
  data: Record<string, any> | null;
  status: string;
  published_at: string;
};


const TYPE_LABELS: Record<string, { fr: string; ar: string }> = {
  emploi:     { fr: 'Je cherche du travail',                                     ar: 'أبحث عن عمل' },
  recrute:    { fr: 'Je recherche un professionnel',                             ar: 'أبحث عن عامل أو مهني' },
  services:   { fr: 'Je propose mes services',                                   ar: 'أعرض خدماتي' },
  partenaire: { fr: 'Je cherche un partenaire professionnel ou un sous-traitant', ar: 'أبحث عن شريك مهني أو سو تريتان' },
};

const DISPO_LABELS: Record<string, { fr: string; ar: string }> = {
  immediate: { fr: 'Immédiatement', ar: 'فوراً' },
  week:      { fr: 'Cette semaine',  ar: 'هذا الأسبوع' },
  month:     { fr: 'Ce mois-ci',     ar: 'هذا الشهر' },
};

const formatDate = (iso: string, isRTL: boolean) => {
  try {
    return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
};

const AnnoncesListPage = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const [q, setQ] = useState('');
  const [secteur, setSecteur] = useState<string>(searchParams.get('secteur') || '');
  const [type, setType] = useState<string>(searchParams.get('type') || '');
  const [metier, setMetier] = useState(searchParams.get('metier') || '');
  const [ville, setVille] = useState('');
  const [departement, setDepartement] = useState('');
  const [dispo, setDispo] = useState('');

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunite_annonces')
        .select('id,reference,user_id,type,sector,title,ville,departement,disponibilite,description,photo_url,data,status,published_at')
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(500);
      if (!alive) return;
      if (error) console.error('annonces list error', error);
      setAnnonces((data as any) || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user) { setFavIds(new Set()); return; }
    const load = async () => setFavIds(await fetchFavorisIds(user.id));
    load();
    return onFavorisChanged(load);
  }, [user]);

  const filtered = useMemo(() => {
    const norm = (s: string | null | undefined) => (s || '').toString().toLowerCase().trim();
    const qn = norm(q);
    const qRef = qn.toUpperCase().replace(/\s+/g, '');
    const looksLikeRef = /^OPP-\d{4}-\d{1,6}$/.test(qRef);
    return annonces.filter((a) => {
      if (secteur && a.sector !== secteur) return false;
      if (type && a.type !== type) return false;
      if (dispo && a.disponibilite !== dispo) return false;
      if (ville && !norm(a.ville).includes(norm(ville))) return false;
      if (departement && !norm(a.departement).includes(norm(departement))) return false;
      if (metier) {
        const d = a.data || {};
        // Match on slug (exact) if present, otherwise fallback to text match on FR/AR labels
        if (d.metier_slug) {
          if (d.metier_slug !== metier) return false;
        } else {
          const mDef = findMetier(a.sector, metier);
          const needle = norm(mDef?.fr || metier);
          const bag = [d.metier, d.metier_recherche, d.profession, d.specialite].map(norm).join(' | ');
          if (!bag.includes(needle)) return false;
        }
      }
      if (qn) {
        // Exact reference match short-circuit
        if (looksLikeRef) {
          return (a.reference || '').toUpperCase() === qRef;
        }
        const d = a.data || {};
        const bag = [
          a.reference, a.title, a.ville, a.departement, a.description,
          d.metier, d.metier_recherche, d.profession, d.specialite, d.zone,
        ].map(norm).join(' | ');
        if (!bag.includes(qn)) return false;
      }
      return true;
    });
  }, [annonces, q, secteur, type, metier, ville, departement, dispo]);


  const applyFilters = () => {
    const params: Record<string, string> = {};
    if (secteur) params.secteur = secteur;
    if (metier) params.metier = metier;
    if (type) params.type = type;
    setSearchParams(params, { replace: true });
    setShowFilters(false);
  };

  const resetFilters = () => {
    setQ(''); setSecteur(''); setType(''); setMetier('');
    setVille(''); setDepartement(''); setDispo('');
    setSearchParams({}, { replace: true });
  };

  const activeFiltersCount =
    (secteur ? 1 : 0) + (type ? 1 : 0) + (metier ? 1 : 0) +
    (ville ? 1 : 0) + (departement ? 1 : 0) + (dispo ? 1 : 0);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: COLORS.pageBg, fontFamily }}
    >
      {/* HERO */}
      <section
        className="px-5 pt-6 pb-6"
        style={{
          background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%)`,
          color: 'white',
        }}
      >
        <button
          onClick={() => navigate('/opportunites')}
          className={cn('inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85 hover:text-white', isRTL && 'flex-row-reverse')}
        >
          <BackIcon size={14} />
          {isRTL ? 'الفرص المهنية' : 'Opportunités'}
        </button>
        <h1 className={cn('mt-3 text-[20px] font-extrabold leading-tight', isRTL ? 'text-right' : 'text-left')}>
          {isRTL ? 'تصفح الإعلانات' : 'Consulter les annonces'}
        </h1>

        {/* Search */}
        <div className="mt-4 relative">
          <Search
            size={16}
            className={cn('absolute top-1/2 -translate-y-1/2', isRTL ? 'right-3' : 'left-3')}
            style={{ color: COLORS.navyDark }}
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isRTL ? 'ابحث عن مهنة أو مدينة أو رقم إعلان' : 'Rechercher un métier, une ville ou une réf. OPP-…'}
            className={cn(
              'w-full rounded-xl bg-white py-3 text-[13px] outline-none',
              isRTL ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left',
            )}
            style={{ color: COLORS.navyDark }}
          />
        </div>

        <div className={cn('mt-3 flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold bg-white/10 border border-white/20 text-white active:scale-[0.98] transition"
          >
            <SlidersHorizontal size={14} />
            {isRTL ? 'تصفية' : 'Filtres'}
            {activeFiltersCount > 0 && (
              <span
                className="ms-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                style={{ background: COLORS.goldDark, color: 'white' }}
              >
                {activeFiltersCount}
              </span>
            )}
          </button>
          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[12px] font-bold bg-white/10 border border-white/20 text-white active:scale-[0.98] transition"
            >
              <X size={12} />
              {isRTL ? 'مسح البحث' : 'Réinitialiser'}
            </button>
          )}
        </div>
      </section>

      {/* FILTERS PANEL */}
      {showFilters && (
        <div className="px-4 mt-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm border space-y-3" style={{ borderColor: '#E5E9F0' }}>
            {/* Secteur */}
            <div>
              <label className={cn('block text-[11px] font-bold mb-1', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
                {isRTL ? 'القطاع' : 'Secteur'}
              </label>
              <select
                value={secteur}
                onChange={(e) => { setSecteur(e.target.value); setMetier(''); }}
                className={cn('w-full rounded-xl border bg-white p-2.5 text-[13px] outline-none', isRTL ? 'text-right' : 'text-left')}
                style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
              >
                <option value="">{isRTL ? 'كل القطاعات' : 'Tous les secteurs'}</option>
                {OPPORTUNITE_SECTORS.map((s) => (
                  <option key={s.slug} value={s.slug}>{isRTL ? s.ar : s.fr}</option>
                ))}
              </select>
            </div>

            {/* Métier (dépend du secteur) */}
            {secteur && getMetiers(secteur).length > 0 && (
              <div>
                <label className={cn('block text-[11px] font-bold mb-1', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
                  {isRTL ? 'المهنة' : 'Métier'}
                </label>
                <select
                  value={metier}
                  onChange={(e) => setMetier(e.target.value)}
                  className={cn('w-full rounded-xl border bg-white p-2.5 text-[13px] outline-none', isRTL ? 'text-right' : 'text-left')}
                  style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
                >
                  <option value="">{isRTL ? 'كل المهن' : 'Tous les métiers'}</option>
                  {getMetiers(secteur).map((mt) => (
                    <option key={mt.slug} value={mt.slug}>{isRTL ? mt.ar : mt.fr}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Type */}
            <div>
              <label className={cn('block text-[11px] font-bold mb-1', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
                {isRTL ? 'نوع الإعلان' : "Type d'annonce"}
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={cn('w-full rounded-xl border bg-white p-2.5 text-[13px] outline-none', isRTL ? 'text-right' : 'text-left')}
                style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
              >
                <option value="">{isRTL ? 'كل الأنواع' : 'Tous les types'}</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.fr}</option>
                ))}
              </select>
            </div>

            {/* Ville + Département */}
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: isRTL ? 'المدينة' : 'Ville', value: ville, set: setVille },
                { label: isRTL ? 'المنطقة' : 'Département', value: departement, set: setDepartement },
              ].map((f) => (
                <div key={f.label}>
                  <label className={cn('block text-[11px] font-bold mb-1', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className={cn('w-full rounded-xl border bg-white p-2.5 text-[13px] outline-none', isRTL ? 'text-right' : 'text-left')}
                    style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
                  />
                </div>
              ))}
            </div>

            {/* Dispo */}
            <div>
              <label className={cn('block text-[11px] font-bold mb-1', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
                {isRTL ? 'التوفر' : 'Disponibilité'}
              </label>
              <select
                value={dispo}
                onChange={(e) => setDispo(e.target.value)}
                className={cn('w-full rounded-xl border bg-white p-2.5 text-[13px] outline-none', isRTL ? 'text-right' : 'text-left')}
                style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
              >
                <option value="">{isRTL ? 'الكل' : 'Toutes'}</option>
                {Object.entries(DISPO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.fr}</option>
                ))}
              </select>
            </div>

            <button
              onClick={applyFilters}
              className="w-full rounded-xl py-2.5 font-extrabold text-[13px] active:scale-[0.98] transition"
              style={{
                background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`,
                color: COLORS.navyDark,
              }}
            >
              {isRTL ? 'تطبيق البحث' : 'Appliquer les filtres'}
            </button>
          </div>
        </div>
      )}

      {/* LIST */}
      <div className="px-4 mt-4 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: COLORS.navyDark }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm border text-center space-y-4" style={{ borderColor: '#E5E9F0' }}>
            <p className="text-[13px] font-bold" style={{ color: COLORS.navyDark }}>
              {isRTL ? 'مفيش إعلانات متاحة دلوقتي.' : 'Aucune annonce disponible pour le moment.'}
            </p>
            <p className="text-[12px] text-gray-600">
              {isRTL ? 'خليك أول واحد ينشر إعلان مجاناً.' : 'Soyez le premier à publier une annonce gratuitement.'}
            </p>
            <button
              onClick={() => navigate('/opportunites/publier')}
              className="w-full rounded-xl py-2.5 font-extrabold text-[13px] active:scale-[0.98] transition"
              style={{
                background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`,
                color: COLORS.navyDark,
              }}
            >
              {isRTL ? 'نشر إعلان' : 'Publier une annonce'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className={cn('text-[11px] font-bold', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
              {isRTL
                ? (filtered.length === 1 ? 'إعلان واحد' : `${filtered.length} إعلان`)
                : (filtered.length <= 1 ? `${filtered.length} annonce` : `${filtered.length} annonces`)}
            </p>
            {filtered.map((a) => {
              const tl = TYPE_LABELS[a.type];
              const sec = OPPORTUNITE_SECTORS.find((s) => s.slug === a.sector);
              const d = a.data || {};
              const mDef = d.metier_slug ? findMetier(a.sector, d.metier_slug) : null;
              const metierLabel = mDef ? (isRTL ? mDef.ar : mDef.fr) : (d.metier || d.metier_recherche || d.profession || '');
              const displayName = d.prenom || d.nom || d.entreprise || '';
              const experience = d.experience;
              const dispoLbl = a.disponibilite ? DISPO_LABELS[a.disponibilite] : null;
              const shortDesc = (a.description || '').slice(0, 140);
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/opportunites/annonces/${a.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/opportunites/annonces/${a.id}`); }}
                  className="w-full rounded-2xl bg-white p-4 shadow-sm border active:scale-[0.99] transition text-left cursor-pointer"
                  style={{ borderColor: '#E5E9F0' }}
                >
                  <div className={cn('flex items-start gap-3', isRTL && 'flex-row-reverse')}>
                    {a.photo_url ? (
                      <img
                        src={a.photo_url}
                        alt=""
                        className="w-16 h-16 rounded-xl object-cover shrink-0 border"
                        style={{ borderColor: '#E5E9F0' }}
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})` }}
                      >
                        <Briefcase size={26} style={{ color: COLORS.navyDark }} />
                      </div>
                    )}
                    <div className={cn('flex-1 min-w-0', isRTL ? 'text-right' : 'text-left')}>
                      <div className={cn('flex items-center gap-1.5 flex-wrap', isRTL && 'flex-row-reverse')}>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                          style={{ background: '#E8F5EE', color: '#0F7B3D' }}
                        >
                          {isRTL ? 'نشط' : 'Active'}
                        </span>
                        {tl && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold border"
                            style={{ borderColor: '#E5E9F0', color: COLORS.navyDark }}
                          >
                            {isRTL ? tl.ar : tl.fr}
                          </span>
                        )}
                        {sec && (
                          <span className="text-[10px] text-gray-500">
                            • {isRTL ? sec.ar : sec.fr}
                          </span>
                        )}
                        {metierLabel && (
                          <span className="text-[10px] font-bold text-gray-600">
                            › {metierLabel}
                          </span>
                        )}
                      </div>

                      <h3 className="text-[14px] font-extrabold mt-1 leading-tight line-clamp-1" style={{ color: COLORS.navyDark }}>
                        {a.title}
                      </h3>

                      {displayName && (
                        <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-1">{displayName}</p>
                      )}

                      <div className={cn('mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-600', isRTL && 'flex-row-reverse')}>
                        {(a.ville || a.departement) && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} />
                            {[a.ville, a.departement].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {experience && <span>· {experience}</span>}
                        {dispoLbl && <span>· {isRTL ? dispoLbl.ar : dispoLbl.fr}</span>}
                      </div>

                      {shortDesc && (
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-snug">{shortDesc}</p>
                      )}

                      <div className={cn('mt-2 flex items-center justify-between gap-2 flex-wrap', isRTL && 'flex-row-reverse')}>
                        <div className={cn('flex items-center gap-2 flex-wrap', isRTL && 'flex-row-reverse')}>
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                            <Calendar size={10} />
                            {formatDate(a.published_at, isRTL)}
                          </span>
                          {a.reference && (
                            <span
                              className="text-[9px] font-mono font-bold tracking-tight px-1.5 py-0.5 rounded"
                              style={{ background: '#F1F3F7', color: COLORS.navyDark }}
                              dir="ltr"
                            >
                              {isRTL ? `رقم: ${a.reference}` : `Réf. ${a.reference}`}
                            </span>
                          )}
                        </div>
                        <span
                          className="rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                          style={{ background: COLORS.navyDark, color: 'white' }}
                        >
                          {isRTL ? 'عرض الإعلان' : "Voir l'annonce"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <FavoriteButton annonceId={a.id} ownerUserId={a.user_id} isFavInitial={favIds.has(a.id)} />
                      <ShareButton annonceId={a.id} reference={a.reference} title={a.title} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnoncesListPage;
