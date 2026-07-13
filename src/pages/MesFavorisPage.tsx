import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Heart, Loader2, Briefcase, MapPin, Calendar } from 'lucide-react';
import { OPPORTUNITE_SECTORS } from './OpportuniteSectorPage';
import { onFavorisChanged } from '@/pages/opportunites/favoris';
import FavoriteButton from '@/components/opportunites/FavoriteButton';
import ShareButton from '@/components/opportunites/ShareButton';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

const formatDate = (iso: string, isRTL: boolean) => {
  try { return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const MesFavorisPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const fontFamily = isRTL ? "'Tajawal', system-ui, sans-serif" : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: favs, error: fErr } = await supabase
      .from('opportunite_favoris')
      .select('annonce_id, created_at, opportunite_annonces!inner(id,reference,type,sector,title,ville,departement,description,photo_url,data,status,published_at,user_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (fErr) console.error('favoris', fErr);
    const active = (favs || [])
      .map((f: any) => f.opportunite_annonces)
      .filter((a: any) => a && a.status === 'active');
    // Cleanup: remove favorites whose annonce is not active anymore
    const removed = (favs || [])
      .filter((f: any) => !f.opportunite_annonces || f.opportunite_annonces.status !== 'active');
    if (removed.length > 0) {
      const ids = removed.map((r: any) => r.annonce_id);
      supabase.from('opportunite_favoris').delete().eq('user_id', user.id).in('annonce_id', ids)
        .then(({ error }) => { if (error) console.warn('cleanup fav', error); });
    }
    setRows(active);
    setLoading(false);
  };

  useEffect(() => {
    load();
    return onFavorisChanged(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen overflow-x-hidden" style={{ backgroundColor: COLORS.pageBg, fontFamily }}>
      <section className="px-5 pt-6 pb-6" style={{ background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navy} 100%)`, color: 'white' }}>
        <button onClick={() => navigate('/opportunites')} className={cn('inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85', isRTL && 'flex-row-reverse')}>
          <BackIcon size={14} />
          {isRTL ? 'الفرص المهنية' : 'Opportunités'}
        </button>
        <h1 className={cn('mt-3 text-[20px] font-extrabold leading-tight inline-flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <Heart size={20} fill="#DC2626" color="#DC2626" />
          {isRTL ? 'إعلاناتي المفضلة' : 'Mes favoris'}
        </h1>
      </section>

      <div className="px-4 mt-4 pb-10">
        {loading || authLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: COLORS.navyDark }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm border text-center space-y-3" style={{ borderColor: '#E5E9F0' }}>
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: '#FEF2F2' }}>
              <Heart size={22} color="#DC2626" />
            </div>
            <p className="text-[13px] font-bold" style={{ color: COLORS.navyDark }}>
              {isRTL ? 'مفيش إعلانات مفضلة لسه.' : 'Aucun favori pour le moment.'}
            </p>
            <p className="text-[11px] text-gray-600">
              {isRTL ? 'دوس على ❤️ في أي إعلان علشان تحفظه هنا.' : 'Cliquez sur ❤️ dans une annonce pour la retrouver ici.'}
            </p>
            <button
              onClick={() => navigate('/opportunites/annonces')}
              className="w-full rounded-xl py-2.5 font-extrabold text-[13px]"
              style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`, color: COLORS.navyDark }}
            >
              {isRTL ? 'تصفح الإعلانات' : 'Consulter les annonces'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((a: any) => {
              const sec = OPPORTUNITE_SECTORS.find((s) => s.slug === a.sector);
              const d = a.data || {};
              const displayName = d.prenom || d.nom || d.entreprise || '';
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/opportunites/annonces/${a.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/opportunites/annonces/${a.id}`); }}
                  className="w-full rounded-2xl bg-white p-4 shadow-sm border active:scale-[0.99] transition cursor-pointer"
                  style={{ borderColor: '#E5E9F0' }}
                >
                  <div className={cn('flex items-start gap-3', isRTL && 'flex-row-reverse')}>
                    {a.photo_url ? (
                      <img src={a.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 border" style={{ borderColor: '#E5E9F0' }} />
                    ) : (
                      <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})` }}>
                        <Briefcase size={26} style={{ color: COLORS.navyDark }} />
                      </div>
                    )}
                    <div className={cn('flex-1 min-w-0', isRTL ? 'text-right' : 'text-left')}>
                      <h3 className="text-[14px] font-extrabold leading-tight line-clamp-1" style={{ color: COLORS.navyDark }}>{a.title}</h3>
                      {displayName && <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-1">{displayName}</p>}
                      <div className={cn('mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-600', isRTL && 'flex-row-reverse')}>
                        {(a.ville || a.departement) && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} />{[a.ville, a.departement].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {sec && <span>· {isRTL ? sec.ar : sec.fr}</span>}
                        <span className="inline-flex items-center gap-1"><Calendar size={10} />{formatDate(a.published_at, isRTL)}</span>
                      </div>
                    </div>
                    <div className={cn('flex flex-col items-center gap-2 shrink-0')} onClick={(e) => e.stopPropagation()}>
                      <FavoriteButton annonceId={a.id} ownerUserId={a.user_id} isFavInitial />
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

export default MesFavorisPage;
