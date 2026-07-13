import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, Eye, Pencil, Power, PowerOff, Trash2, Loader2,
  Briefcase, MapPin, Calendar, EyeOff, Copy, Check,
} from 'lucide-react';

import { OPPORTUNITE_SECTORS } from './OpportuniteSectorPage';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  type: string;
  sector: string | null;
  title: string;
  ville: string | null;
  departement: string | null;
  description: string | null;
  photo_url: string | null;
  data: Record<string, any> | null;
  status: string;
  views_count: number;
  published_at: string;
};

const TYPE_LABELS: Record<string, { fr: string; ar: string }> = {
  emploi:     { fr: 'Je cherche du travail',                                     ar: 'أبحث عن عمل' },
  recrute:    { fr: 'Je recherche un professionnel',                             ar: 'أبحث عن عامل أو مهني' },
  services:   { fr: 'Je propose mes services',                                   ar: 'أعرض خدماتي' },
  partenaire: { fr: 'Je cherche un partenaire professionnel ou un sous-traitant', ar: 'أبحث عن شريك مهني أو سو تريتان' },
};

const STATUS_STYLES: Record<string, { fr: string; ar: string; bg: string; fg: string }> = {
  active:    { fr: 'Active',                    ar: 'نشط',                    bg: '#E8F5EE', fg: '#0F7B3D' },
  inactive:  { fr: 'Inactive',                  ar: 'متوقف',                  bg: '#FDF3E1', fg: '#8A5A00' },
  expired:   { fr: 'Expirée',                   ar: 'منتهي',                  bg: '#EEF0F5', fg: '#3F4A63' },
  deleted:   { fr: 'Supprimée',                 ar: 'محذوف',                  bg: '#FDECEC', fg: '#B91C1C' },
  moderated: { fr: 'Masquée par la modération', ar: 'تم إخفاء الإعلان للمراجعة', bg: '#FDECEC', fg: '#B91C1C' },
};

const formatDate = (iso: string, isRTL: boolean) => {
  try {
    return new Date(iso).toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
};

type PendingAction =
  | { kind: 'deactivate'; id: string }
  | { kind: 'reactivate'; id: string }
  | { kind: 'delete'; id: string }
  | null;

const MesAnnoncesPage = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [pending, setPending] = useState<PendingAction>(null);
  const [working, setWorking] = useState(false);

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Redirect unauthenticated visitors to auth, come back after login.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('opportunite_annonces')
      .select('id,type,sector,title,ville,departement,description,photo_url,data,status,views_count,published_at')
      .eq('user_id', user.id)
      .order('published_at', { ascending: false })
      .limit(500);
    if (error) console.error('mes annonces error', error);
    setAnnonces((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const runAction = async () => {
    if (!pending || !user) return;
    setWorking(true);
    try {
      const patch =
        pending.kind === 'deactivate' ? { status: 'inactive' } :
        pending.kind === 'reactivate' ? { status: 'active' } :
        { status: 'deleted' };
      const { error } = await supabase.from('opportunite_annonces')
        .update(patch)
        .eq('id', pending.id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({
        title: isRTL ? '✅ تم الحفظ' : '✅ Modifications enregistrées',
      });
      setPending(null);
      await load();
    } catch (err) {
      console.error('mes annonces action', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'فشل العملية' : 'Action impossible',
        description: err instanceof Error ? err.message : 'Erreur',
      });
    } finally {
      setWorking(false);
    }
  };

  const emptyState = (
    <div className="rounded-2xl bg-white p-6 shadow-sm border text-center space-y-4" style={{ borderColor: '#E5E9F0' }}>
      <p className="text-[13px] font-bold" style={{ color: COLORS.navyDark }}>
        {isRTL ? 'لسه ما نشرتش أي إعلان.' : 'Vous n’avez encore publié aucune annonce.'}
      </p>
      <p className="text-[12px] text-gray-600">
        {isRTL ? 'انشر أول إعلان ليك مجاناً.' : 'Publiez gratuitement votre première annonce.'}
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
  );

  const dlg = (() => {
    if (!pending) return { title: '', desc: '', confirm: '', danger: false };
    if (pending.kind === 'deactivate') return {
      title: isRTL ? 'إيقاف الإعلان' : "Désactiver l'annonce",
      desc: isRTL
        ? 'الإعلان مش هيظهر للناس، وتقدر تفعّله تاني بعدين.'
        : 'Cette annonce ne sera plus visible publiquement. Vous pourrez la réactiver plus tard.',
      confirm: isRTL ? 'تأكيد' : 'Confirmer',
      danger: false,
    };
    if (pending.kind === 'reactivate') return {
      title: isRTL ? 'إعادة تفعيل الإعلان' : "Réactiver l'annonce",
      desc: isRTL
        ? 'الإعلان هيرجع يظهر للناس مباشرة.'
        : 'Cette annonce redeviendra immédiatement visible publiquement.',
      confirm: isRTL ? 'تأكيد' : 'Confirmer',
      danger: false,
    };
    return {
      title: isRTL ? 'حذف الإعلان' : "Supprimer l'annonce",
      desc: isRTL
        ? 'متأكد إنك عايز تحذف الإعلان؟ مش هتقدر ترجعه بعد الحذف.'
        : 'Voulez-vous vraiment supprimer cette annonce ? Cette action est irréversible.',
      confirm: isRTL ? 'حذف نهائي' : 'Supprimer définitivement',
      danger: true,
    };
  })();

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
          {isRTL ? 'إعلاناتي' : 'Mes annonces'}
        </h1>
        <p className={cn('text-[12px] text-white/80 mt-1', isRTL ? 'text-right' : 'text-left')}>
          {isRTL ? 'إدارة الإعلانات الخاصة بيك.' : 'Gérez vos annonces publiées.'}
        </p>
      </section>

      <div className="px-4 mt-4 pb-10">
        {loading || authLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin" style={{ color: COLORS.navyDark }} />
          </div>
        ) : annonces.length === 0 ? (
          emptyState
        ) : (
          <div className="space-y-3">
            {annonces.map((a) => {
              const tl = TYPE_LABELS[a.type];
              const sec = OPPORTUNITE_SECTORS.find((s) => s.slug === a.sector);
              const d = a.data || {};
              const metier = d.metier || d.metier_recherche || d.profession || d.specialite || '';
              const st = STATUS_STYLES[a.status] || STATUS_STYLES.active;
              const isDeleted = a.status === 'deleted';
              const isActive = a.status === 'active';
              const isModerated = a.status === 'moderated';
              return (
                <div
                  key={a.id}
                  className="rounded-2xl bg-white p-4 shadow-sm border"
                  style={{ borderColor: '#E5E9F0', opacity: isDeleted ? 0.7 : 1 }}
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
                          style={{ background: st.bg, color: st.fg }}
                        >
                          {isRTL ? st.ar : st.fr}
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
                      </div>
                      <h3 className="text-[14px] font-extrabold mt-1 leading-tight line-clamp-1" style={{ color: COLORS.navyDark }}>
                        {a.title}
                      </h3>
                      {metier && metier !== a.title && (
                        <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-1">{metier}</p>
                      )}
                      <div className={cn('mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-500', isRTL && 'flex-row-reverse')}>
                        {(a.ville || a.departement) && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} />
                            {[a.ville, a.departement].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={11} />
                          {formatDate(a.published_at, isRTL)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye size={11} />
                          {a.views_count ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Moderation notice */}
                  {isModerated && (
                    <div
                      className={cn('mt-3 rounded-xl p-3 text-[11px] leading-relaxed', isRTL ? 'text-right' : 'text-left')}
                      style={{ background: '#FDECEC', color: '#7F1D1D', border: '1px solid #FCA5A5' }}
                    >
                      {isRTL
                        ? 'الإعلان اتوقف مؤقتاً للمراجعة. لو عندك سؤال، تواصل مع دعم ANAFYPRO.'
                        : "Cette annonce a été temporairement masquée à la suite d’un contrôle de modération. Pour toute question, contactez le support ANAFYPRO."}
                    </div>
                  )}

                  {/* ACTIONS */}
                  <div className={cn('mt-3 flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
                    {isActive && (
                      <button
                        onClick={() => navigate(`/opportunites/annonces/${a.id}`)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border active:scale-[0.98] transition"
                        style={{ borderColor: '#E5E9F0', color: COLORS.navyDark, background: 'white' }}
                      >
                        <Eye size={12} />
                        {isRTL ? 'عرض' : 'Voir'}
                      </button>
                    )}
                    {!isDeleted && !isModerated && (
                      <button
                        onClick={() => navigate(`/opportunites/mes-annonces/${a.id}/modifier`)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border active:scale-[0.98] transition"
                        style={{ borderColor: '#E5E9F0', color: COLORS.navyDark, background: 'white' }}
                      >
                        <Pencil size={12} />
                        {isRTL ? 'تعديل' : 'Modifier'}
                      </button>
                    )}
                    {a.status === 'active' && (
                      <button
                        onClick={() => setPending({ kind: 'deactivate', id: a.id })}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold active:scale-[0.98] transition"
                        style={{ background: '#FDF3E1', color: '#8A5A00' }}
                      >
                        <PowerOff size={12} />
                        {isRTL ? 'إيقاف الإعلان' : 'Désactiver'}
                      </button>
                    )}
                    {a.status === 'inactive' && (
                      <button
                        onClick={() => setPending({ kind: 'reactivate', id: a.id })}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold active:scale-[0.98] transition"
                        style={{ background: '#E8F5EE', color: '#0F7B3D' }}
                      >
                        <Power size={12} />
                        {isRTL ? 'إعادة تفعيل الإعلان' : 'Réactiver'}
                      </button>
                    )}
                    {!isDeleted && !isModerated && (
                      <button
                        onClick={() => setPending({ kind: 'delete', id: a.id })}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold active:scale-[0.98] transition"
                        style={{ background: '#FDECEC', color: '#B91C1C' }}
                      >
                        <Trash2 size={12} />
                        {isRTL ? 'حذف' : 'Supprimer'}
                      </button>
                    )}
                    {isDeleted && (
                      <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-gray-500">
                        <EyeOff size={12} />
                        {isRTL ? 'تم الحذف' : 'Annonce supprimée'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && !working && setPending(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} style={{ fontFamily }}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(isRTL && 'text-right')}>{dlg.title}</AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && 'text-right')}>
              {dlg.desc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>
              {isRTL ? 'إلغاء' : 'Annuler'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runAction(); }}
              disabled={working}
              className={dlg.danger ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : ''}
            >
              {working && <Loader2 size={14} className="animate-spin mr-2" />}
              {dlg.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MesAnnoncesPage;
