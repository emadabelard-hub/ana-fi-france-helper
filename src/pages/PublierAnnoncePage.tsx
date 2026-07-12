import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import {
  ArrowLeft, ArrowRight, Loader2,
  HardHat, Building2, Wrench, Handshake,
} from 'lucide-react';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  goldDark: '#B8922A',
  goldLight: '#E2C060',
  pageBg: '#F2F4F8',
};

type AnnonceType = 'emploi' | 'recrute' | 'services' | 'partenaire';

const TYPES: {
  key: AnnonceType;
  icon: any;
  fr: string;
  ar: string;
}[] = [
  { key: 'emploi', icon: HardHat, fr: 'Je cherche un emploi', ar: 'أبحث عن عمل' },
  { key: 'recrute', icon: Building2, fr: 'Je recrute', ar: 'أبحث عن عامل' },
  { key: 'services', icon: Wrench, fr: 'Je propose mes services', ar: 'أعرض خدماتي' },
  { key: 'partenaire', icon: Handshake, fr: 'Je recherche un partenaire professionnel', ar: 'أبحث عن شريك مهني' },
];

const DISPO: { key: string; fr: string; ar: string }[] = [
  { key: 'immediate', fr: 'Immédiatement', ar: 'فوراً' },
  { key: 'week', fr: 'Cette semaine', ar: 'هذا الأسبوع' },
  { key: 'month', fr: 'Ce mois-ci', ar: 'هذا الشهر' },
];

// Field definitions per type. Each field: key + FR/AR labels + optional/required + type
type FieldDef = {
  key: string;
  fr: string;
  ar: string;
  required?: boolean;
  kind?: 'text' | 'textarea';
  placeholderFr?: string;
  placeholderAr?: string;
};

const FIELDS: Record<AnnonceType, FieldDef[]> = {
  emploi: [
    { key: 'prenom', fr: 'Prénom', ar: 'الاسم', required: true },
    { key: 'metier', fr: 'Métier', ar: 'المهنة', required: true },
    { key: 'experience', fr: 'Expérience', ar: 'الخبرة', placeholderFr: 'Ex: 5 ans', placeholderAr: 'مثال: 5 سنوات' },
    { key: 'ville', fr: 'Ville', ar: 'المدينة', required: true },
    { key: 'departement', fr: 'Département', ar: 'المنطقة' },
    { key: 'permis', fr: 'Permis', ar: 'رخصة القيادة', placeholderFr: 'Ex: B', placeholderAr: 'مثال: B' },
    { key: 'vehicule', fr: 'Véhicule', ar: 'وسيلة النقل', placeholderFr: 'Ex: Voiture personnelle', placeholderAr: 'مثال: سيارة' },
    { key: 'langues', fr: 'Langues parlées', ar: 'اللغات', placeholderFr: 'Ex: Français, Arabe', placeholderAr: 'مثال: عربي، فرنسي' },
    { key: 'description', fr: 'Description', ar: 'الوصف', kind: 'textarea', required: true },
  ],
  recrute: [
    { key: 'entreprise', fr: 'Entreprise', ar: 'الشركة', required: true },
    { key: 'metier_recherche', fr: 'Métier recherché', ar: 'المهنة المطلوبة', required: true },
    { key: 'ville', fr: 'Ville', ar: 'المدينة', required: true },
    { key: 'departement', fr: 'Département', ar: 'المنطقة' },
    { key: 'contrat', fr: 'Type de contrat', ar: 'نوع العقد', placeholderFr: 'CDI, CDD, Intérim…', placeholderAr: 'CDI، CDD، Intérim…' },
    { key: 'salaire', fr: 'Salaire (facultatif)', ar: 'الراتب (اختياري)' },
    { key: 'description', fr: 'Description', ar: 'الوصف', kind: 'textarea', required: true },
  ],
  services: [
    { key: 'nom', fr: 'Nom', ar: 'الاسم', required: true },
    { key: 'metier', fr: 'Métier', ar: 'المهنة', required: true },
    { key: 'specialite', fr: 'Spécialité', ar: 'التخصص' },
    { key: 'ville', fr: 'Ville', ar: 'المدينة', required: true },
    { key: 'departement', fr: 'Département', ar: 'المنطقة' },
    { key: 'zone', fr: "Zone d'intervention", ar: 'منطقة التدخل' },
    { key: 'description', fr: 'Description', ar: 'الوصف', kind: 'textarea', required: true },
  ],
  partenaire: [
    { key: 'entreprise', fr: 'Entreprise', ar: 'الشركة', required: true },
    { key: 'profession', fr: 'Profession recherchée', ar: 'المهنة المطلوبة', required: true },
    { key: 'ville', fr: 'Ville', ar: 'المدينة', required: true },
    { key: 'departement', fr: 'Département', ar: 'المنطقة' },
    { key: 'description', fr: 'Description', ar: 'الوصف', kind: 'textarea', required: true },
  ],
};

const TITLE_FIELD: Record<AnnonceType, string> = {
  emploi: 'metier',
  recrute: 'metier_recherche',
  services: 'metier',
  partenaire: 'profession',
};

const PublierAnnoncePage = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [type, setType] = useState<AnnonceType | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dispo, setDispo] = useState<string>('immediate');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fontFamily = isRTL
    ? "'Tajawal', system-ui, sans-serif"
    : "'Poppins', system-ui, sans-serif";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'الصورة كبيرة جداً' : 'Photo trop lourde',
        description: isRTL ? 'الحد الأقصى 5 ميغا.' : 'Taille maximale 5 Mo.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!type || !user) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'يجب تسجيل الدخول' : 'Connexion requise',
        description: isRTL ? 'سجّل الدخول قبل نشر الإعلان.' : 'Connectez-vous pour publier une annonce.',
      });
      return;
    }
    const defs = FIELDS[type];

    // Build zod schema dynamically
    const shape: Record<string, z.ZodString> = {};
    for (const f of defs) {
      let s = z.string().trim().max(1000);
      if (f.required) s = s.min(1, { message: isRTL ? 'الحقل مطلوب' : 'Champ requis' });
      shape[f.key] = s;
    }
    const parsed = z.object(shape).safeParse(values);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast({
        variant: 'destructive',
        title: isRTL ? 'أكمل الحقول' : 'Champs manquants',
        description: first || (isRTL ? 'راجع المعلومات.' : 'Vérifiez les informations.'),
      });
      return;
    }
    const clean = parsed.data;

    setSaving(true);
    try {
      const titleKey = TITLE_FIELD[type];
      const title = (clean[titleKey] || '').toString().slice(0, 200) || (isRTL ? 'إعلان' : 'Annonce');

      const { error } = await supabase.from('opportunite_annonces').insert({
        user_id: user.id,
        type,
        title,
        ville: clean['ville'] || null,
        departement: clean['departement'] || null,
        disponibilite: dispo,
        description: clean['description'] || null,
        photo_url: photoDataUrl,
        data: clean as any,
        attachments: [] as any,
        status: 'active',
        views_count: 0,
        favorites_count: 0,
      });
      if (error) throw error;

      toast({
        title: isRTL ? '✅ تم نشر الإعلان' : '✅ Annonce publiée',
        description: isRTL
          ? 'إعلانك متاح الآن.'
          : 'Votre annonce est maintenant active.',
      });
      navigate('/opportunites');
    } catch (err) {
      console.error('publier annonce error', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'فشل النشر' : 'Échec de la publication',
        description: err instanceof Error ? err.message : 'Erreur',
      });
    } finally {
      setSaving(false);
    }
  };

  const showPhoto = type === 'emploi' || type === 'services';

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
          onClick={() => (type ? setType(null) : navigate('/opportunites'))}
          className={cn(
            'inline-flex items-center gap-1.5 text-[12px] font-bold text-white/85 hover:text-white',
            isRTL && 'flex-row-reverse',
          )}
        >
          <BackIcon size={14} />
          {isRTL ? 'رجوع' : 'Retour'}
        </button>
        <h1 className={cn('mt-3 text-[20px] font-extrabold leading-tight', isRTL ? 'text-right' : 'text-left')}>
          {type
            ? (isRTL ? 'نشر إعلان' : 'Publier une annonce')
            : (isRTL ? 'ماذا تريد أن تنشر ؟' : 'Que souhaitez-vous publier ?')}
        </h1>
      </section>

      {/* TYPE SELECTOR */}
      {!type && (
        <div className="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
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
                      {isRTL ? t.ar : t.fr}
                    </h3>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* FORM */}
      {type && (
        <div className="px-4 mt-4 space-y-4 pb-10">
          <div className="rounded-2xl bg-white p-4 shadow-sm border space-y-4" style={{ borderColor: '#E5E9F0' }}>
            {FIELDS[type].map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label
                  className={cn('block text-[12px] font-bold', isRTL ? 'text-right' : 'text-left')}
                  style={{ color: COLORS.navyDark }}
                >
                  {isRTL ? f.ar : f.fr}
                  {f.required && <span style={{ color: '#B91C1C' }}> *</span>}
                </label>
                {f.kind === 'textarea' ? (
                  <textarea
                    rows={4}
                    value={values[f.key] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={isRTL ? f.placeholderAr : f.placeholderFr}
                    className={cn(
                      'w-full rounded-xl border bg-white p-3 text-[14px] outline-none focus:ring-2',
                      isRTL ? 'text-right' : 'text-left',
                    )}
                    style={{ borderColor: '#E5E9F0' }}
                  />
                ) : (
                  <input
                    type="text"
                    value={values[f.key] || ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={isRTL ? f.placeholderAr : f.placeholderFr}
                    className={cn(
                      'w-full rounded-xl border bg-white p-3 text-[14px] outline-none focus:ring-2',
                      isRTL ? 'text-right' : 'text-left',
                    )}
                    style={{ borderColor: '#E5E9F0' }}
                  />
                )}
              </div>
            ))}

            {/* Disponibilité */}
            <div className="space-y-1.5">
              <label
                className={cn('block text-[12px] font-bold', isRTL ? 'text-right' : 'text-left')}
                style={{ color: COLORS.navyDark }}
              >
                {isRTL ? 'متاح' : 'Disponible'}
              </label>
              <div className={cn('flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
                {DISPO.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDispo(d.key)}
                    className="rounded-xl px-3 py-2 text-[12px] font-bold border transition"
                    style={
                      dispo === d.key
                        ? { background: COLORS.goldDark, color: 'white', borderColor: COLORS.goldDark }
                        : { background: 'white', color: COLORS.navyDark, borderColor: '#E5E9F0' }
                    }
                  >
                    {isRTL ? d.ar : d.fr}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo (emploi / services) */}
            {showPhoto && (
              <div className="space-y-1.5">
                <label
                  className={cn('block text-[12px] font-bold', isRTL ? 'text-right' : 'text-left')}
                  style={{ color: COLORS.navyDark }}
                >
                  {isRTL ? 'صورة (اختياري)' : 'Photo (facultative)'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="block w-full text-[12px]"
                />
                {photoDataUrl && (
                  <img
                    src={photoDataUrl}
                    alt="preview"
                    className="mt-2 max-h-40 rounded-xl border"
                    style={{ borderColor: '#E5E9F0' }}
                  />
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-2xl py-3 font-extrabold text-[14px] active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${COLORS.goldLight}, ${COLORS.goldDark})`,
              color: COLORS.navyDark,
            }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {isRTL ? 'نشر الإعلان' : "Publier l'annonce"}
          </button>
        </div>
      )}
    </div>
  );
};

export default PublierAnnoncePage;
