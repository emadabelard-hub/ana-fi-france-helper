import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, MapPin, Calendar, Eye, Loader2, Briefcase, MessageCircle, Flag, Copy, Check } from 'lucide-react';
import { OPPORTUNITE_SECTORS } from './OpportuniteSectorPage';
import { readPendingContact, clearPendingContact, setPendingContact } from './opportunites/messagerie';
import ReportDialog from '@/components/opportunites/ReportDialog';
import FavoriteButton from '@/components/opportunites/FavoriteButton';
import ShareButton from '@/components/opportunites/ShareButton';
import FirstContactModal from '@/components/opportunites/FirstContactModal';
import { hasSeenFirstContact } from '@/pages/opportunites/firstContactNotice';
import { useToast } from '@/hooks/use-toast';


const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
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

// Fields to show in details, in order. Keys resolved from either row column
// or the JSON `data` bag. `contrat` intentionally never displayed.
const DETAIL_FIELDS: { key: string; fr: string; ar: string }[] = [
  { key: 'entreprise',      fr: 'Entreprise',        ar: 'الشركة' },
  { key: 'metier',          fr: 'Métier',            ar: 'المهنة' },
  { key: 'metier_recherche',fr: 'Métier recherché',  ar: 'المهنة المطلوبة' },
  { key: 'profession',      fr: 'Profession',        ar: 'المهنة' },
  { key: 'specialite',      fr: 'Spécialité',        ar: 'التخصص' },
  { key: 'experience',      fr: 'Expérience',        ar: 'الخبرة' },
  { key: 'ville',           fr: 'Ville',             ar: 'المدينة' },
  { key: 'departement',     fr: 'Département',       ar: 'المنطقة' },
  { key: 'zone',            fr: "Zone d'intervention",ar: 'منطقة التدخل' },
  { key: 'permis',          fr: 'Permis',            ar: 'رخصة القيادة' },
  { key: 'vehicule',        fr: 'Véhicule',          ar: 'وسيلة النقل' },
  { key: 'langues',         fr: 'Langues parlées',   ar: 'اللغات' },
  { key: 'salaire',         fr: 'Salaire',           ar: 'الراتب' },
];

const formatDate = (iso: string, isRTL: boolean) => {
  try {
    return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch { return ''; }
};

const AnnonceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [annonce, setAnnonce] = useState<any | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [firstContactOpen, setFirstContactOpen] = useState(false);
  const viewedRef = useRef(false);
  const pendingHandledRef = useRef(false);


  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    let alive = true;
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('opportunite_annonces')
        .select('id,reference,user_id,type,sector,title,ville,departement,disponibilite,description,photo_url,data,status,published_at,views_count')
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle();
      if (!alive) return;
      if (error) console.error('annonce detail error', error);
      setAnnonce(data);
      setLoading(false);

      // Basic per-session view dedup
      if (data && !viewedRef.current) {
        const key = `anafypro:annonce_viewed:${id}`;
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            viewedRef.current = true;
            supabase.rpc('increment_annonce_views', { _annonce_id: id }).then(({ error: e }) => {
              if (e) console.warn('view incr failed', e);
            });
          }
        } catch { /* ignore */ }
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // If the visitor was redirected to login before contacting, resume the contact flow.
  useEffect(() => {
    if (!user || !id || pendingHandledRef.current) return;
    const pending = readPendingContact();
    if (pending && pending === id) {
      pendingHandledRef.current = true;
      clearPendingContact();
      navigate(`/opportunites/annonces/${id}/contact`, { replace: true });
    }
  }, [user, id, navigate]);

  if (loading) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.pageBg, fontFamily }}
      >
        <Loader2 size={22} className="animate-spin" style={{ color: COLORS.navyDark }} />
      </div>
    );
  }

  if (!annonce) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: COLORS.pageBg, fontFamily }}
      >
        <p className="text-[14px] font-bold" style={{ color: COLORS.navyDark }}>
          {isRTL ? 'الإعلان غير متاح' : 'Annonce introuvable ou inactive'}
        </p>
        <button
          onClick={() => navigate('/opportunites/annonces')}
          className="mt-4 rounded-xl px-4 py-2 font-extrabold text-[13px]"
          style={{ background: COLORS.goldDark, color: 'white' }}
        >
          {isRTL ? 'رجوع' : 'Retour'}
        </button>
      </div>
    );
  }

  const tl = TYPE_LABELS[annonce.type];
  const sec = OPPORTUNITE_SECTORS.find((s) => s.slug === annonce.sector);
  const d: Record<string, any> = annonce.data || {};
  const displayName = d.prenom || d.nom || d.entreprise || '';
  const dispoLbl = annonce.disponibilite ? DISPO_LABELS[annonce.disponibilite] : null;

  const rowsToShow = DETAIL_FIELDS
    .map((f) => {
      const rawFromRow = (annonce as any)[f.key];
      const val = (rawFromRow ?? d[f.key] ?? '').toString().trim();
      return val ? { ...f, val } : null;
    })
    .filter(Boolean) as { key: string; fr: string; ar: string; val: string }[];

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
          onClick={() => navigate('/opportunites/annonces')}
          className={cn('inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85 hover:text-white', isRTL && 'flex-row-reverse')}
        >
          <BackIcon size={14} />
          {isRTL ? 'الإعلانات' : 'Annonces'}
        </button>

        <div className={cn('mt-3 flex flex-wrap items-center gap-1.5', isRTL && 'flex-row-reverse')}>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
            style={{ background: '#E8F5EE', color: '#0F7B3D' }}
          >
            {isRTL ? 'نشط' : 'Active'}
          </span>
          {tl && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-white/10 border border-white/20 text-white">
              {isRTL ? tl.ar : tl.fr}
            </span>
          )}
          {sec && (
            <span className="text-[10px] text-white/80">• {isRTL ? sec.ar : sec.fr}</span>
          )}
        </div>

        <h1 className={cn('mt-2 text-[22px] font-extrabold leading-tight', isRTL ? 'text-right' : 'text-left')}>
          {annonce.title}
        </h1>

        {displayName && (
          <p className={cn('mt-1 text-[12px] text-white/85', isRTL ? 'text-right' : 'text-left')}>
            {displayName}
          </p>
        )}

        <div className={cn('mt-3 flex items-center flex-wrap gap-3 text-[11px] text-white/80', isRTL && 'flex-row-reverse')}>
          {(annonce.ville || annonce.departement) && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {[annonce.ville, annonce.departement].filter(Boolean).join(' · ')}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(annonce.published_at, isRTL)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye size={12} />
            {annonce.views_count ?? 0}
          </span>
        </div>

        {annonce.reference && (
          <div className={cn('mt-3 inline-flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold bg-white/10 border border-white/20"
              dir="ltr"
              style={{ color: 'white' }}
            >
              <span className="opacity-80">{isRTL ? 'رقم الإعلان:' : 'Réf.'}</span>
              <span className="font-mono tracking-tight">{annonce.reference}</span>
            </span>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(annonce.reference);
                  setRefCopied(true);
                  toast({ title: isRTL ? 'تم نسخ رقم الإعلان' : 'Référence copiée' });
                  setTimeout(() => setRefCopied(false), 1500);
                } catch { /* ignore */ }
              }}
              aria-label={isRTL ? 'نسخ رقم الإعلان' : 'Copier la référence'}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold bg-white/10 border border-white/20 text-white active:scale-[0.98] transition"
            >
              {refCopied ? <Check size={11} /> : <Copy size={11} />}
              {isRTL ? 'نسخ' : 'Copier'}
            </button>
          </div>
        )}
      </section>


      {/* PHOTO */}
      {annonce.photo_url && (
        <div className="px-4 mt-4">
          <img
            src={annonce.photo_url}
            alt=""
            className="w-full rounded-2xl border shadow-sm object-cover max-h-[360px]"
            style={{ borderColor: '#E5E9F0' }}
          />
        </div>
      )}

      {/* DETAILS */}
      <div className="px-4 mt-4 pb-10 space-y-4">
        {rowsToShow.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-sm border" style={{ borderColor: '#E5E9F0' }}>
            <h2 className={cn('text-[13px] font-extrabold mb-3 inline-flex items-center gap-2', isRTL && 'flex-row-reverse')} style={{ color: COLORS.navyDark }}>
              <Briefcase size={14} />
              {isRTL ? 'تفاصيل الإعلان' : "Détails de l'annonce"}
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {rowsToShow.map((f) => (
                <div key={f.key} className={cn('flex justify-between gap-2 py-1.5 border-b last:border-b-0', isRTL && 'flex-row-reverse')} style={{ borderColor: '#F1F3F7' }}>
                  <dt className="text-[11px] font-bold text-gray-500">{isRTL ? f.ar : f.fr}</dt>
                  <dd className={cn('text-[12px] font-semibold', isRTL ? 'text-left' : 'text-right')} style={{ color: COLORS.navyDark }}>
                    {f.val}
                  </dd>
                </div>
              ))}
              {dispoLbl && (
                <div className={cn('flex justify-between gap-2 py-1.5', isRTL && 'flex-row-reverse')}>
                  <dt className="text-[11px] font-bold text-gray-500">{isRTL ? 'التوفر' : 'Disponibilité'}</dt>
                  <dd className={cn('text-[12px] font-semibold', isRTL ? 'text-left' : 'text-right')} style={{ color: COLORS.navyDark }}>
                    {isRTL ? dispoLbl.ar : dispoLbl.fr}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {annonce.description && (
          <div className="rounded-2xl bg-white p-4 shadow-sm border" style={{ borderColor: '#E5E9F0' }}>
            <h2 className={cn('text-[13px] font-extrabold mb-2', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
              {isRTL ? 'الوصف' : 'Description'}
            </h2>
            <p className={cn('text-[13px] text-gray-700 whitespace-pre-line leading-relaxed', isRTL ? 'text-right' : 'text-left')}>
              {annonce.description}
            </p>
          </div>
        )}

        {/* CONTACTER */}
        {annonce.status === 'active' && (
          user && user.id === annonce.user_id ? (
            <div
              className="rounded-2xl p-4 border text-center"
              style={{ borderColor: '#E5E9F0', background: '#EEF2F8' }}
            >
              <p className={cn('text-[13px] font-extrabold', isRTL ? 'text-right' : 'text-left')} style={{ color: COLORS.navyDark }}>
                {isRTL ? 'ده إعلانك' : "C'est votre annonce"}
              </p>
              <p className={cn('text-[11px] text-gray-600 mt-1', isRTL ? 'text-right' : 'text-left')}>
                {isRTL ? 'شوف الرسائل من صفحة « إعلاناتي ».' : 'Consultez les messages depuis « Mes annonces ».'}
              </p>
            </div>
          ) : (
            <button
              onClick={() => {
                if (!user) {
                  setPendingContact(annonce.id);
                  navigate('/login');
                  return;
                }
                navigate(`/opportunites/annonces/${annonce.id}/contact`);
              }}
              className="w-full rounded-2xl py-3 font-extrabold text-[14px] active:scale-[0.98] transition inline-flex items-center justify-center gap-2 shadow-md"
              style={{
                background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`,
                color: COLORS.navyDark,
              }}
            >
              <MessageCircle size={16} />
              {isRTL ? 'تواصل مع صاحب الإعلان' : 'Contacter'}
            </button>
          )
        )}

        {/* Report button (hidden for the owner) */}
        {(!user || user.id !== annonce.user_id) && (
          <button
            onClick={() => {
              if (!user) {
                setPendingContact(annonce.id);
                navigate('/login');
                return;
              }
              setReportOpen(true);
            }}
            className={cn(
              'w-full rounded-2xl py-2.5 text-[13px] font-bold border inline-flex items-center justify-center gap-2 active:scale-[0.98] transition',
              isRTL && 'flex-row-reverse',
            )}
            style={{ borderColor: '#FCA5A5', color: '#B91C1C', background: '#FEF2F2' }}
          >
            <Flag size={14} />
            {isRTL ? 'الإبلاغ عن الإعلان' : 'Signaler cette annonce'}
          </button>
        )}

        <div
          className="rounded-2xl p-4 border"
          style={{ borderColor: '#E5E9F0', background: '#FBF5E7' }}
        >
          <p className={cn('text-[11px] text-gray-700 leading-relaxed', isRTL ? 'text-right' : 'text-left')}>
            {isRTL
              ? 'ANAFYPRO مساحة نشر مجانية. الاتفاق بين المستخدمين مسؤولية شخصية.'
              : "ANAFYPRO met à disposition un espace gratuit de diffusion. Les échanges et accords entre utilisateurs relèvent de leur seule responsabilité."}
          </p>
        </div>
      </div>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        reportType="annonce"
        annonceId={annonce.id}
        reportedUserId={annonce.user_id}
      />
    </div>
  );
};

export default AnnonceDetailPage;
