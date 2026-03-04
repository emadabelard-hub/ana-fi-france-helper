import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, User, Loader2, Shield, Key, Building2, FileText, MapPin, Mail, Phone, Upload, Image, Check, AlertCircle, Briefcase, CreditCard, Landmark, ShieldCheck, PenTool, Stamp, CheckCircle2, Circle, PartyPopper } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import ApiKeySettingsModal from '@/components/layout/ApiKeySettingsModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { compressImageFile } from '@/lib/imageCompression';
import { getSignedAssetUrl } from '@/lib/storageUtils';
import AuthModal from '@/components/auth/AuthModal';
import DeleteAccountSection from '@/components/profile/DeleteAccountSection';
import ArtisanSignatureSection from '@/components/profile/ArtisanSignatureSection';
import StampUploadSection from '@/components/profile/StampUploadSection';

/* ─── Reusable styled section card ─── */
const SectionCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md",
    className
  )}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, isRTL }: { icon: any; title: string; subtitle?: string; isRTL: boolean }) => (
  <div className={cn("px-5 pt-5 pb-3", isRTL && "text-right")}>
    <div className={cn("flex items-center gap-2.5", isRTL && "flex-row-reverse")}>
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <div className="flex-1">
        <h2 className={cn("text-[15px] font-semibold text-foreground tracking-tight", isRTL ? "font-[IBMPlexSansArabic]" : "font-[Inter]")}>
          {title}
        </h2>
        {subtitle && (
          <p className={cn("text-xs text-muted-foreground mt-0.5", isRTL && "font-[IBMPlexSansArabic]")}>{subtitle}</p>
        )}
      </div>
    </div>
  </div>
);

const FieldGroup = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("px-5 pb-5 space-y-4", className)}>{children}</div>
);

const FieldStatus = ({ filled, isRTL }: { filled: boolean; isRTL: boolean }) => (
  filled ? (
    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
  ) : (
    <span className="inline-flex items-center gap-1 shrink-0">
      <Circle className="h-3 w-3 text-muted-foreground/40" />
      <span className={cn("text-[10px] font-medium text-destructive/70", isRTL && "font-[IBMPlexSansArabic]")}>
        {isRTL ? 'مطلوب' : 'Requis'}
      </span>
    </span>
  )
);

const FieldLabel = ({ icon: Icon, label, required, isRTL, filled }: { icon: any; label: string; required?: boolean; isRTL: boolean; filled?: boolean }) => (
  <Label className={cn("flex items-center gap-2 text-[13px] font-medium text-foreground/70", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
    <Icon className="h-3.5 w-3.5 text-primary/50" />
    {label}
    {required && <span className="text-destructive text-xs">*</span>}
    <span className="flex-1" />
    {filled !== undefined && <FieldStatus filled={filled} isRTL={isRTL} />}
  </Label>
);

const StyledInput = ({ isRTL, className, ...props }: React.ComponentProps<typeof Input> & { isRTL?: boolean }) => (
  <Input
    {...props}
    className={cn(
      "h-12 rounded-xl border-border/30 bg-secondary/50 text-[15px] placeholder:text-muted-foreground/50 focus:bg-background focus:border-primary/40 transition-colors",
      isRTL && "text-right font-[IBMPlexSansArabic]",
      className
    )}
  />
);

const ProfilePage = () => {
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  const navigate = useNavigate();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [siretError, setSiretError] = useState<string | null>(null);
  const [signedLogoUrl, setSignedLogoUrl] = useState<string | null>(null);
  const [signedHeaderUrl, setSignedHeaderUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    job: '',
    company_name: '',
    siret: '',
    company_address: '',
    email: '',
    phone: '',
    legal_status: 'auto-entrepreneur' as string,
    tva_exempt: false,
    header_type: 'automatic' as string,
    logo_url: '',
    header_image_url: '',
    legal_footer: "Dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.",
    capital_social: '',
    code_naf: '',
    ville_immatriculation: '',
    numero_tva: '',
    assureur_name: '',
    assureur_address: '',
    assurance_policy_number: '',
    assurance_geographic_coverage: 'France métropolitaine',
    iban: '',
    bic: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: (profile as any).full_name || '',
        job: (profile as any).job || '',
        company_name: (profile as any).company_name || '',
        siret: (profile as any).siret || '',
        company_address: (profile as any).company_address || '',
        email: (profile as any).email || '',
        phone: (profile as any).phone || '',
        legal_status: (profile as any).legal_status || 'auto-entrepreneur',
        tva_exempt: (profile as any).tva_exempt || false,
        header_type: (profile as any).header_type || 'automatic',
        logo_url: (profile as any).logo_url || '',
        header_image_url: (profile as any).header_image_url || '',
        legal_footer: (profile as any).legal_footer || "Dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.",
        capital_social: (profile as any).capital_social || '',
        code_naf: (profile as any).code_naf || '',
        ville_immatriculation: (profile as any).ville_immatriculation || '',
        numero_tva: (profile as any).numero_tva || '',
        assureur_name: (profile as any).assureur_name || '',
        assureur_address: (profile as any).assureur_address || '',
        assurance_policy_number: (profile as any).assurance_policy_number || '',
        assurance_geographic_coverage: (profile as any).assurance_geographic_coverage || 'France métropolitaine',
        iban: (profile as any).iban || '',
        bic: (profile as any).bic || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc('is_admin', { _user_id: user.id }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  useEffect(() => {
    if (formData.logo_url) {
      getSignedAssetUrl(formData.logo_url).then(url => setSignedLogoUrl(url));
    } else { setSignedLogoUrl(null); }
  }, [formData.logo_url]);

  useEffect(() => {
    if (formData.header_image_url) {
      getSignedAssetUrl(formData.header_image_url).then(url => setSignedHeaderUrl(url));
    } else { setSignedHeaderUrl(null); }
  }, [formData.header_image_url]);

  const handleChange = (field: string, value: string) => {
    if (field === 'siret') {
      const cleanValue = value.replace(/\D/g, '').slice(0, 14);
      setFormData(prev => ({ ...prev, [field]: cleanValue }));
      if (cleanValue.length > 0 && cleanValue.length !== 14) {
        setSiretError(isRTL ? 'رقم السيريت لازم يكون 14 رقم' : 'Le SIRET doit contenir 14 chiffres');
      } else {
        setSiretError(null);
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const uploadFile = async (file: File, type: 'logo' | 'header'): Promise<string | null> => {
    if (!user) return null;
    try {
      const compressedBlob = await compressImageFile(file, {
        maxWidth: type === 'header' ? 1920 : 500,
        maxHeight: type === 'header' ? 400 : 500,
        quality: 0.85,
      });
      const fileName = `${user.id}/${type}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, compressedBlob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(fileName);
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    const url = await uploadFile(file, 'logo');
    if (url) setFormData(prev => ({ ...prev, logo_url: url }));
    setIsUploadingLogo(false);
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHeader(true);
    const url = await uploadFile(file, 'header');
    if (url) setFormData(prev => ({ ...prev, header_image_url: url }));
    setIsUploadingHeader(false);
  };

  const handleSave = async () => {
    if (siretError) return;
    setIsSaving(true);
    await updateProfile(formData as any);
    setIsSaving(false);
  };

  const mandatoryFields = useMemo(() => [
    { key: 'full_name', filled: !!formData.full_name.trim() },
    { key: 'job', filled: !!formData.job.trim() },
    { key: 'siret', filled: formData.siret.length === 14 },
    { key: 'company_address', filled: !!formData.company_address.trim() },
    { key: 'email', filled: !!formData.email.trim() },
    { key: 'assureur_name', filled: !!formData.assureur_name.trim() },
    { key: 'assurance_policy_number', filled: !!formData.assurance_policy_number.trim() },
  ], [formData]);

  const progressPercent = useMemo(() => {
    const filled = mandatoryFields.filter(f => f.filled).length;
    return Math.round((filled / mandatoryFields.length) * 100);
  }, [mandatoryFields]);

  const progressColor = progressPercent < 50 ? 'bg-destructive' : progressPercent < 100 ? 'bg-yellow-500' : 'bg-green-500';
  const isFieldFilled = (key: string) => mandatoryFields.find(f => f.key === key)?.filled ?? false;

  const handleSignOut = async () => { await signOut(); };

  const userInitial = formData.full_name
    ? formData.full_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || '?';

  /* ─── Unauthenticated state ─── */
  if (!user) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-md mx-auto space-y-8">
          <section className={cn("text-center space-y-5", isRTL && "font-[IBMPlexSansArabic]")}>
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/20 flex items-center justify-center shadow-lg">
              <User className="h-12 w-12 text-primary/60" />
            </div>
            <h1 className="text-2xl font-bold text-foreground font-[Inter]">
              {isRTL ? 'حسابي' : 'Mon compte'}
            </h1>
            <p className={cn("text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed", isRTL && "font-[IBMPlexSansArabic]")}>
              {isRTL
                ? "سجّل دخولك عشان تحفظ بياناتك وتستخدمها في الخطابات الإدارية"
                : "Connectez-vous pour sauvegarder vos informations"}
            </p>
            <Button onClick={() => setShowAuthModal(true)} className="h-12 px-10 rounded-xl text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
              {isRTL ? "ادخل حسابك" : "Se connecter"}
            </Button>
          </section>
          <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
        </div>
      </div>
    );
  }

  /* ─── Loading state ─── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Chargement...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 px-4 pb-32">
      <div className="max-w-lg mx-auto space-y-5">

        {/* ═══════ Avatar & Identity ═══════ */}
        <section className={cn("text-center space-y-3 pt-2", isRTL && "font-[IBMPlexSansArabic]")}>
          <div className="w-[88px] h-[88px] mx-auto rounded-full bg-gradient-to-br from-primary via-primary/80 to-accent/60 flex items-center justify-center shadow-xl shadow-primary/15 ring-[3px] ring-background">
            <span className="text-3xl font-bold text-primary-foreground font-[Inter]">{userInitial}</span>
          </div>
          <div className="space-y-1">
            <h1 className={cn("text-xl font-bold text-foreground tracking-tight", isRTL ? "font-[IBMPlexSansArabic]" : "font-[Inter]")}>
              {formData.full_name || (isRTL ? 'حسابي' : 'Mon compte')}
            </h1>
            <p className="text-sm text-muted-foreground font-[Inter]">{user.email}</p>
          </div>
        </section>

        {/* ═══════ RGPD Banner ═══════ */}
        <div className={cn("rounded-2xl bg-primary/5 border border-primary/15 p-4", isRTL && "text-right")}>
          <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <p className={cn("text-xs text-foreground/70 leading-relaxed flex-1", isRTL && "font-[IBMPlexSansArabic]")}>
              {isRTL
                ? 'بياناتك محمية ومشفرة وفقاً للمعايير الأوروبية (RGPD). نحن لا نشارك بياناتك مع أي جهة خارجية.'
                : 'Vos données sont protégées et chiffrées conformément au RGPD. Nous ne partageons vos données avec aucun tiers.'}
            </p>
          </div>
        </div>

        {/* ═══════ Progress Bar ═══════ */}
        <SectionCard>
          <div className="p-5 space-y-3">
            <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
              <h3 className={cn("text-sm font-semibold text-foreground", isRTL ? "font-[IBMPlexSansArabic]" : "font-[Inter]")}>
                {isRTL ? 'نسبة اكتمال الملف القانوني' : 'Complétude du dossier légal'}
              </h3>
              <span className={cn("text-sm font-bold", progressPercent < 50 ? "text-destructive" : progressPercent < 100 ? "text-yellow-500" : "text-green-500")}>
                {progressPercent}%
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all duration-700 ease-out", progressColor)}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-[IBMPlexSansArabic]")}>
              {isRTL
                ? `${mandatoryFields.filter(f => f.filled).length} من ${mandatoryFields.length} حقول مكتملة`
                : `${mandatoryFields.filter(f => f.filled).length} sur ${mandatoryFields.length} champs complétés`}
            </p>
            {progressPercent === 100 && (
              <div className={cn(
                "flex items-center gap-2.5 p-3 rounded-xl bg-green-500/10 border border-green-500/30",
                isRTL && "flex-row-reverse text-right"
              )}>
                <PartyPopper className="h-5 w-5 text-green-500 shrink-0" />
                <p className={cn("text-xs font-semibold text-green-600 dark:text-green-400", isRTL && "font-[IBMPlexSansArabic]")}>
                  {isRTL
                    ? 'ملفك القانوني مكتمل وجاهز لإصدار فواتير Factur-X!'
                    : 'Votre dossier légal est complet et prêt pour émettre des factures Factur-X !'}
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ═══════ Admin Dashboard ═══════ */}
        {isAdmin && (
          <SectionCard className="border-accent/30">
            <button onClick={() => navigate('/admin')} className={cn("flex items-center gap-3 w-full p-4", isRTL && "flex-row-reverse text-right")}>
              <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className={cn("font-semibold text-sm text-foreground", isRTL ? "font-[IBMPlexSansArabic]" : "font-[Inter]")}>{isRTL ? 'لوحة الإدارة' : 'Admin Dashboard'}</p>
                <p className={cn("text-xs text-muted-foreground mt-0.5", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'مراقبة النظام والإحصائيات' : 'Monitoring système et analytics'}</p>
              </div>
            </button>
          </SectionCard>
        )}

        {/* ═══════ SECTION 1: Personal Info ═══════ */}
        <SectionCard>
          <SectionHeader icon={User} title={isRTL ? 'المعلومات الشخصية' : 'Informations personnelles'} isRTL={isRTL} />
          <FieldGroup>
            <div className="space-y-2">
              <FieldLabel icon={User} label={isRTL ? 'الاسم الكامل' : 'Nom complet'} isRTL={isRTL} />
              <StyledInput
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder={isRTL ? 'اكتب اسمك الكامل' : 'Entrez votre nom complet'}
                isRTL={isRTL}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel icon={Briefcase} label={isRTL ? 'المهنة' : 'Métier'} required isRTL={isRTL} />
              <StyledInput
                value={formData.job}
                onChange={(e) => handleChange('job', e.target.value)}
                placeholder={isRTL ? 'مثال: كهربائي، سبّاك، مقاول عام' : 'Ex: Électricien, Plombier, Entrepreneur'}
                isRTL={isRTL}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel icon={Phone} label={isRTL ? 'رقم الهاتف' : 'Téléphone'} isRTL={isRTL} />
              <StyledInput
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder={isRTL ? 'مثال: 06 12 34 56 78' : 'Ex: 06 12 34 56 78'}
                isRTL={isRTL}
              />
            </div>
          </FieldGroup>
        </SectionCard>

        {/* ═══════ SECTION 2: Company / Legal ═══════ */}
        <SectionCard>
          <SectionHeader
            icon={Building2}
            title={isRTL ? 'بيانات المؤسسة القانونية' : "Informations légales de l'entreprise"}
            subtitle={isRTL ? 'المعلومات دي هتظهر على كل فواتيرك ودوفيهاتك' : 'Ces informations apparaîtront sur tous vos devis et factures'}
            isRTL={isRTL}
          />
          <FieldGroup>
            <div className="space-y-2">
              <FieldLabel icon={Building2} label={isRTL ? 'اسم الشركة' : "Nom de l'entreprise"} isRTL={isRTL} />
              <StyledInput
                value={formData.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                placeholder={isRTL ? 'مثال: شركة البناء للمقاولات' : 'Ex: Entreprise Martin BTP'}
                isRTL={isRTL}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel icon={FileText} label={isRTL ? 'رقم السيريت (SIRET)' : 'Numéro SIRET'} isRTL={isRTL} />
              <StyledInput
                value={formData.siret}
                onChange={(e) => handleChange('siret', e.target.value)}
                placeholder="12345678901234" maxLength={14}
                className={cn("font-mono", siretError && "border-destructive")}
              />
              {siretError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{siretError}</p>}
              {formData.siret.length === 14 && !siretError && (
                <p className="text-xs text-green-500 flex items-center gap-1"><Check className="h-3 w-3" />{isRTL ? 'رقم سيريت صحيح' : 'SIRET valide'}</p>
              )}
            </div>

            <div className="space-y-2">
              <FieldLabel icon={Mail} label={isRTL ? 'الإيميل المهني' : 'Email professionnel'} isRTL={isRTL} />
              <StyledInput
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contact@entreprise.fr"
                isRTL={isRTL}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel icon={MapPin} label={isRTL ? 'عنوان المقر' : 'Adresse du siège'} isRTL={isRTL} />
              <StyledInput
                value={formData.company_address}
                onChange={(e) => handleChange('company_address', e.target.value)}
                placeholder={isRTL ? 'العنوان الكامل' : 'Adresse complète'}
                isRTL={isRTL}
              />
            </div>

            <Separator className="my-1 opacity-30" />

            <div className="space-y-2">
              <FieldLabel icon={FileText} label={isRTL ? 'الشكل القانوني' : 'Statut juridique'} isRTL={isRTL} />
              <Select value={formData.legal_status} onValueChange={(v) => handleChange('legal_status', v)}>
                <SelectTrigger className={cn("h-12 rounded-xl border-border/30 bg-secondary/50 text-[15px]", isRTL && "font-[IBMPlexSansArabic]")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto-entrepreneur">{isRTL ? 'أوتو أونتروبرونور' : 'Auto-entrepreneur'}</SelectItem>
                  <SelectItem value="societe">{isRTL ? 'شركة (SARL, SAS, إلخ)' : 'Société (SARL, SAS, etc.)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* TVA Exemption */}
            <div className={cn(
              "flex items-start gap-3 p-3.5 rounded-xl border transition-colors",
              formData.tva_exempt ? "border-green-500/40 bg-green-500/5" : "border-border/30 bg-secondary/30",
              isRTL && "flex-row-reverse"
            )}>
              <Checkbox id="tva-exempt" checked={formData.tva_exempt}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, tva_exempt: !!checked }))} className="mt-0.5" />
              <Label htmlFor="tva-exempt" className={cn("flex-1 cursor-pointer", isRTL && "text-right font-[IBMPlexSansArabic]")}>
                <span className="font-medium text-sm">{isRTL ? 'معفى من TVA (Art. 293 B)' : 'Exonéré de TVA (Art. 293 B du CGI)'}</span>
              </Label>
            </div>

            {!formData.tva_exempt && formData.legal_status === 'societe' && (
              <div className="space-y-2">
                <FieldLabel icon={FileText} label={isRTL ? 'رقم TVA' : 'N° TVA Intracommunautaire'} isRTL={isRTL} />
                <StyledInput
                  value={formData.numero_tva}
                  onChange={(e) => handleChange('numero_tva', e.target.value)}
                  placeholder="FR 12 345678901"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldLabel icon={Landmark} label={isRTL ? 'رأس المال' : 'Capital Social'} isRTL={isRTL} />
                <StyledInput
                  value={formData.capital_social}
                  onChange={(e) => handleChange('capital_social', e.target.value)}
                  placeholder="1 000 €"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel icon={FileText} label={isRTL ? 'كود NAF' : 'Code NAF'} isRTL={isRTL} />
                <StyledInput
                  value={formData.code_naf}
                  onChange={(e) => handleChange('code_naf', e.target.value)}
                  placeholder="4334Z"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldLabel icon={MapPin} label={isRTL ? 'مدينة RCS' : 'Ville RCS/RM'} isRTL={isRTL} />
                <StyledInput
                  value={formData.ville_immatriculation}
                  onChange={(e) => handleChange('ville_immatriculation', e.target.value)}
                  placeholder="Paris"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel icon={CreditCard} label="IBAN" isRTL={isRTL} />
                <StyledInput
                  value={formData.iban}
                  onChange={(e) => handleChange('iban', e.target.value.toUpperCase())}
                  placeholder="FR76 1234..."
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel icon={CreditCard} label="BIC / SWIFT" isRTL={isRTL} />
              <StyledInput
                value={formData.bic}
                onChange={(e) => handleChange('bic', e.target.value.toUpperCase())}
                placeholder="BNPAFRPP"
                className="font-mono text-sm"
              />
            </div>
          </FieldGroup>
        </SectionCard>

        {/* ═══════ SECTION 3: Insurance ═══════ */}
        <SectionCard className="border-primary/20">
          <SectionHeader
            icon={ShieldCheck}
            title={isRTL ? 'التأمين العشري (Décennale)' : 'Assurance Décennale'}
            isRTL={isRTL}
          />
          <FieldGroup>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <FieldLabel icon={Building2} label={isRTL ? 'اسم شركة التأمين' : "Nom de l'assureur"} required isRTL={isRTL} />
                <StyledInput
                  value={formData.assureur_name}
                  onChange={(e) => handleChange('assureur_name', e.target.value)}
                  placeholder={isRTL ? 'مثال: AXA France' : 'Ex: AXA France'}
                  isRTL={isRTL}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel icon={MapPin} label={isRTL ? 'عنوان شركة التأمين' : "Adresse de l'assureur"} isRTL={isRTL} />
                <StyledInput
                  value={formData.assureur_address}
                  onChange={(e) => handleChange('assureur_address', e.target.value)}
                  placeholder={isRTL ? 'عنوان المقر' : 'Ex: 25 av. Matignon, Paris'}
                  isRTL={isRTL}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel icon={FileText} label={isRTL ? 'رقم البوليصة' : 'N° de police'} required isRTL={isRTL} />
                <StyledInput
                  value={formData.assurance_policy_number}
                  onChange={(e) => handleChange('assurance_policy_number', e.target.value)}
                  placeholder="RC-2024-123456"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel icon={MapPin} label={isRTL ? 'التغطية الجغرافية' : 'Couverture géographique'} isRTL={isRTL} />
                <StyledInput
                  value={formData.assurance_geographic_coverage}
                  onChange={(e) => handleChange('assurance_geographic_coverage', e.target.value)}
                  placeholder="France métropolitaine"
                  isRTL={isRTL}
                />
              </div>
            </div>
          </FieldGroup>
        </SectionCard>

        {/* ═══════ SECTION 4: Visual Assets ═══════ */}
        <SectionCard>
          <SectionHeader icon={Image} title={isRTL ? 'الشعار والتوقيع والختم' : 'Logo, Signature & Cachet'} isRTL={isRTL} />
          <FieldGroup>
            {/* Header Type */}
            <RadioGroup value={formData.header_type} onValueChange={(v) => handleChange('header_type', v)} className="space-y-2">
              <div className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
                formData.header_type === 'automatic' ? "border-primary/40 bg-primary/5" : "border-border/30",
                isRTL && "flex-row-reverse"
              )}>
                <RadioGroupItem value="automatic" id="auto-h" />
                <Label htmlFor="auto-h" className={cn("flex-1 cursor-pointer text-sm", isRTL && "text-right font-[IBMPlexSansArabic]")}>
                  {isRTL ? 'تلقائي (لوجو + نص)' : 'Automatique (Logo + Texte)'}
                </Label>
              </div>
              <div className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
                formData.header_type === 'full_image' ? "border-primary/40 bg-primary/5" : "border-border/30",
                isRTL && "flex-row-reverse"
              )}>
                <RadioGroupItem value="full_image" id="full-h" />
                <Label htmlFor="full-h" className={cn("flex-1 cursor-pointer text-sm", isRTL && "text-right font-[IBMPlexSansArabic]")}>
                  {isRTL ? 'صورة كاملة (بانر)' : 'Image complète (Bannière)'}
                </Label>
              </div>
            </RadioGroup>

            {/* Logo Upload */}
            {formData.header_type === 'automatic' && (
              <div className="space-y-2">
                <FieldLabel icon={Upload} label={isRTL ? 'شعار الشركة' : "Logo de l'entreprise"} isRTL={isRTL} />
                <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
                  {formData.logo_url && signedLogoUrl ? (
                    <div className="w-16 h-16 rounded-xl border border-border/30 overflow-hidden bg-secondary/50">
                      <img src={signedLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border/40 flex items-center justify-center bg-secondary/30">
                      <Building2 className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo}
                    className="cursor-pointer flex-1 h-12 rounded-xl border-border/30 bg-secondary/50" />
                  {isUploadingLogo && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
              </div>
            )}

            {/* Full Header Upload */}
            {formData.header_type === 'full_image' && (
              <div className="space-y-2">
                <FieldLabel icon={Image} label={isRTL ? 'صورة الهيدر الكاملة' : "Image de l'en-tête"} isRTL={isRTL} />
                {formData.header_image_url && signedHeaderUrl ? (
                  <div className="rounded-xl border border-border/30 overflow-hidden bg-secondary/50">
                    <AspectRatio ratio={16/4}>
                      <img src={signedHeaderUrl} alt="Header" className="w-full h-full object-cover" />
                    </AspectRatio>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-border/40 flex items-center justify-center bg-secondary/30 h-20">
                    <Image className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                  <Input type="file" accept="image/*" onChange={handleHeaderUpload} disabled={isUploadingHeader}
                    className="cursor-pointer flex-1 h-12 rounded-xl border-border/30 bg-secondary/50" />
                  {isUploadingHeader && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
              </div>
            )}
          </FieldGroup>
        </SectionCard>

        {/* Artisan Signature & Stamp */}
        <ArtisanSignatureSection />
        <StampUploadSection />

        {/* Factur-X Legal Notice */}
        <div className={cn("rounded-2xl bg-accent/10 border border-accent/20 p-4", isRTL && "text-right")}>
          <p className={cn("text-xs text-muted-foreground leading-relaxed", isRTL && "font-[IBMPlexSansArabic]")}>
            {isRTL
              ? 'ℹ️ هذه المعلومات ضرورية لإنشاء عروض أسعار وفواتير قانونية مطابقة لنظام Factur-X.'
              : 'ℹ️ Ces informations sont nécessaires pour créer des devis et factures conformes au format Factur-X.'}
          </p>
        </div>

        {/* ═══════ Save Button ═══════ */}
        <Button
          onClick={handleSave}
          disabled={isSaving || !!siretError}
          className={cn(
            "w-full gap-2.5 h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all",
            isRTL && "font-[IBMPlexSansArabic]"
          )}
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isRTL ? 'حفظ التعديلات' : 'Enregistrer les modifications'}
        </Button>

        {/* Legal Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
          <button onClick={() => navigate('/legal')} className="hover:text-primary underline transition-colors">
            {isRTL ? 'سياسة الخصوصية' : 'Confidentialité'}
          </button>
          <span className="text-border">•</span>
          <button onClick={() => navigate('/legal#terms')} className="hover:text-primary underline transition-colors">
            {isRTL ? 'شروط الاستخدام' : "Conditions d'utilisation"}
          </button>
        </div>

        {/* Admin API Key */}
        {isAdmin && (
          <>
            <SectionCard className="border-border/20">
              <button onClick={() => setShowApiKey(true)} className={cn("flex items-center gap-3 w-full p-4", isRTL ? "flex-row-reverse text-right" : "text-left")}>
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">{isRTL ? 'مفتاح API' : 'Clé API IA'}</p>
                </div>
              </button>
            </SectionCard>
            <ApiKeySettingsModal open={showApiKey} onOpenChange={setShowApiKey} />
          </>
        )}

        {/* Log Out */}
        <Button variant="outline" onClick={handleSignOut}
          className={cn(
            "w-full gap-2 h-12 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive font-semibold transition-colors",
            isRTL && "font-[IBMPlexSansArabic]"
          )}>
          <LogOut className="h-4 w-4" />
          {isRTL ? "خروج" : "Se déconnecter"}
        </Button>

        <DeleteAccountSection />

      </div>
    </div>
  );
};

export default ProfilePage;
