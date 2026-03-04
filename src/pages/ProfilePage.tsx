import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, User, Loader2, Shield, Key, Building2, FileText, MapPin, Mail, Phone, Upload, Image, Check, AlertCircle, Briefcase } from 'lucide-react';
import ApiKeySettingsModal from '@/components/layout/ApiKeySettingsModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { compressImageFile } from '@/lib/imageCompression';
import { getSignedAssetUrl } from '@/lib/storageUtils';
import AuthModal from '@/components/auth/AuthModal';
import DeleteAccountSection from '@/components/profile/DeleteAccountSection';
import TransactionHistory from '@/components/profile/TransactionHistory';
import ArtisanSignatureSection from '@/components/profile/ArtisanSignatureSection';
import StampUploadSection from '@/components/profile/StampUploadSection';

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
    // Personal
    full_name: '',
    job: '',
    // Company
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

  const handleSignOut = async () => { await signOut(); };

  const userInitial = formData.full_name
    ? formData.full_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || '?';

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#121214] py-8 px-4">
        <div className="max-w-md mx-auto space-y-6">
          <section className={cn("text-center space-y-4", isRTL && "font-[IBMPlexSansArabic]")}>
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center shadow-sm">
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
            <Button onClick={() => setShowAuthModal(true)} className="mt-4 h-12 px-8 rounded-xl text-base font-semibold">
              {isRTL ? "ادخل حسابك" : "Se connecter"}
            </Button>
          </section>
          <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#121214] py-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#121214] py-6 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Avatar & Identity Header */}
        <section className={cn("text-center space-y-3", isRTL && "font-[IBMPlexSansArabic]")}>
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-[#1A1A1C]">
            <span className="text-3xl font-bold text-primary-foreground font-[Inter]">{userInitial}</span>
          </div>
          <div>
            <h1 className={cn("text-xl font-bold text-foreground", isRTL ? "font-[IBMPlexSansArabic]" : "font-[Inter]")}>
              {formData.full_name || (isRTL ? 'حسابي' : 'Mon compte')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-[Inter]">{user.email}</p>
          </div>
        </section>

        {/* RGPD Protection Banner */}
        <Card className="border-primary/30 bg-primary/5 rounded-[1.25rem]">
          <CardContent className={cn("p-4", isRTL && "font-[IBMPlexSansArabic]")}>
            <div className={cn("flex items-start gap-3", isRTL ? "flex-row-reverse text-right" : "text-left")}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed flex-1">
                {isRTL
                  ? 'بياناتك محمية ومشفرة وفقاً للمعايير الأوروبية (RGPD). نحن لا نشارك بياناتك مع أي جهة خارجية.'
                  : 'Vos données sont protégées et chiffrées conformément au RGPD. Nous ne partageons vos données avec aucun tiers.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Admin Dashboard Button */}
        {isAdmin && (
          <Card className="bg-white dark:bg-[#1A1A1C] border border-amber-200 dark:border-amber-800/50 rounded-[1.25rem]">
            <CardContent className={cn("p-4", isRTL && "font-[IBMPlexSansArabic]")}>
              <button onClick={() => navigate('/admin')} className={cn("flex items-center gap-3 w-full", isRTL ? "flex-row-reverse text-right" : "text-left")}>
                <div className="w-11 h-11 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">{isRTL ? 'لوحة الإدارة' : 'Admin Dashboard'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'مراقبة النظام والإحصائيات' : 'Monitoring système et analytics'}</p>
                </div>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        <TransactionHistory />

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 1: Personal Info */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-white dark:bg-[#1A1A1C] border border-border/50 rounded-[1.5rem] shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className={cn("flex items-center gap-2 text-base", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
              <User className="h-5 w-5 text-primary" />
              {isRTL ? 'المعلومات الشخصية' : 'Informations personnelles'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2 text-sm font-semibold text-foreground/80", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                <User className="h-4 w-4 text-primary/60" />
                {isRTL ? 'الاسم الكامل' : 'Nom complet'}
              </Label>
              <Input
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder={isRTL ? 'اكتب اسمك الكامل' : 'Entrez votre nom complet'}
                className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40 text-base", isRTL && "text-right font-[IBMPlexSansArabic]")}
              />
            </div>

            {/* Job / Métier */}
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2 text-sm font-semibold text-foreground/80", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                <Briefcase className="h-4 w-4 text-primary/60" />
                {isRTL ? 'المهنة' : 'Métier'} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.job}
                onChange={(e) => handleChange('job', e.target.value)}
                placeholder={isRTL ? 'مثال: كهربائي، سبّاك، مقاول عام' : 'Ex: Électricien, Plombier, Entrepreneur'}
                className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40 text-base", isRTL && "text-right font-[IBMPlexSansArabic]")}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2 text-sm font-semibold text-foreground/80", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                <Phone className="h-4 w-4 text-primary/60" />
                {isRTL ? 'رقم الهاتف' : 'Téléphone'}
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder={isRTL ? 'مثال: 06 12 34 56 78' : 'Ex: 06 12 34 56 78'}
                className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40 text-base", isRTL && "text-right font-[IBMPlexSansArabic]")}
              />
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 2: Company / Legal Info */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-white dark:bg-[#1A1A1C] border border-border/50 rounded-[1.5rem] shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className={cn("flex items-center gap-2 text-base", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
              <Building2 className="h-5 w-5 text-primary" />
              {isRTL ? 'بيانات المؤسسة القانونية' : 'Informations légales de l\'entreprise'}
            </CardTitle>
            <CardDescription className={cn("text-xs", isRTL && "text-right font-[IBMPlexSansArabic]")}>
              {isRTL
                ? 'المعلومات دي هتظهر على كل فواتيرك ودوفيهاتك'
                : 'Ces informations apparaîtront sur tous vos devis et factures'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Name */}
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2 text-sm", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {isRTL ? 'اسم الشركة' : "Nom de l'entreprise"}
              </Label>
              <Input value={formData.company_name} onChange={(e) => handleChange('company_name', e.target.value)}
                placeholder={isRTL ? 'مثال: شركة البناء للمقاولات' : 'Ex: Entreprise Martin BTP'}
                className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40", isRTL && "text-right font-[IBMPlexSansArabic]")} />
            </div>

            {/* SIRET */}
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2 text-sm", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                <FileText className="h-4 w-4 text-muted-foreground" />
                {isRTL ? 'رقم السيريت (SIRET)' : 'Numéro SIRET'}
              </Label>
              <Input value={formData.siret} onChange={(e) => handleChange('siret', e.target.value)}
                placeholder="12345678901234" maxLength={14}
                className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40 font-mono", siretError && "border-destructive")} />
              {siretError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{siretError}</p>}
              {formData.siret.length === 14 && !siretError && <p className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" />{isRTL ? 'رقم سيريت صحيح' : 'SIRET valide'}</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2 text-sm", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                <Mail className="h-4 w-4 text-muted-foreground" />
                {isRTL ? 'الإيميل المهني' : 'Email professionnel'}
              </Label>
              <Input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contact@entreprise.fr"
                className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40", isRTL && "text-right")} />
            </div>

            {/* Company Address */}
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2 text-sm", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {isRTL ? 'عنوان المقر' : 'Adresse du siège'}
              </Label>
              <Input value={formData.company_address} onChange={(e) => handleChange('company_address', e.target.value)}
                placeholder={isRTL ? 'العنوان الكامل' : 'Adresse complète'}
                className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40", isRTL && "text-right font-[IBMPlexSansArabic]")} />
            </div>

            {/* Legal Status */}
            <div className="space-y-3">
              <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>
                {isRTL ? 'الشكل القانوني' : 'Statut juridique'}
              </Label>
              <Select value={formData.legal_status} onValueChange={(v) => handleChange('legal_status', v)}>
                <SelectTrigger className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40", isRTL && "font-[IBMPlexSansArabic]")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto-entrepreneur">{isRTL ? 'أوتو أونتروبرونور' : 'Auto-entrepreneur'}</SelectItem>
                  <SelectItem value="societe">{isRTL ? 'شركة (SARL, SAS, إلخ)' : 'Société (SARL, SAS, etc.)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* TVA Exemption */}
            <div className={cn("flex items-start gap-3 p-3 rounded-xl border", formData.tva_exempt && "border-green-500/50 bg-green-500/5", isRTL && "flex-row-reverse")}>
              <Checkbox id="tva-exempt" checked={formData.tva_exempt}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, tva_exempt: !!checked }))} className="mt-0.5" />
              <Label htmlFor="tva-exempt" className={cn("flex-1 cursor-pointer", isRTL && "text-right font-[IBMPlexSansArabic]")}>
                <span className="font-medium text-sm">{isRTL ? 'معفى من TVA (Art. 293 B)' : 'Exonéré de TVA (Art. 293 B du CGI)'}</span>
              </Label>
            </div>

            {/* TVA Number */}
            {!formData.tva_exempt && formData.legal_status === 'societe' && (
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'رقم TVA' : 'N° TVA Intracommunautaire'}</Label>
                <Input value={formData.numero_tva} onChange={(e) => handleChange('numero_tva', e.target.value)}
                  placeholder="FR 12 345678901"
                  className="h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40" />
              </div>
            )}

            {/* Capital & NAF */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'رأس المال' : 'Capital Social'}</Label>
                <Input value={formData.capital_social} onChange={(e) => handleChange('capital_social', e.target.value)}
                  placeholder="1 000 €" className="h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40" />
              </div>
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'كود NAF' : 'Code NAF'}</Label>
                <Input value={formData.code_naf} onChange={(e) => handleChange('code_naf', e.target.value)}
                  placeholder="4334Z" className="h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40" />
              </div>
            </div>

            {/* RCS & TVA row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'مدينة RCS' : 'Ville RCS/RM'}</Label>
                <Input value={formData.ville_immatriculation} onChange={(e) => handleChange('ville_immatriculation', e.target.value)}
                  placeholder="Paris" className="h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40" />
              </div>
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>IBAN</Label>
                <Input value={formData.iban} onChange={(e) => handleChange('iban', e.target.value.toUpperCase())}
                  placeholder="FR76 1234..." className="h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40 font-mono text-sm" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>BIC / SWIFT</Label>
              <Input value={formData.bic} onChange={(e) => handleChange('bic', e.target.value.toUpperCase())}
                placeholder="BNPAFRPP" className="h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40 font-mono text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 3: Insurance */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-white dark:bg-[#1A1A1C] border border-blue-500/20 bg-blue-500/5 rounded-[1.5rem] shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <span className="text-xl">🛡️</span>
              <CardTitle className={cn("text-base", isRTL && "font-[IBMPlexSansArabic]")}>
                {isRTL ? 'التأمين العشري (Décennale)' : 'Assurance Décennale'}
              </CardTitle>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'اسم شركة التأمين' : "Nom de l'assureur"} *</Label>
                <Input value={formData.assureur_name} onChange={(e) => handleChange('assureur_name', e.target.value)}
                  placeholder={isRTL ? 'مثال: AXA France' : 'Ex: AXA France'}
                  className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40", isRTL && "text-right font-[IBMPlexSansArabic]")} />
              </div>
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'عنوان شركة التأمين' : "Adresse de l'assureur"}</Label>
                <Input value={formData.assureur_address} onChange={(e) => handleChange('assureur_address', e.target.value)}
                  placeholder={isRTL ? 'عنوان المقر' : 'Ex: 25 av. Matignon, Paris'}
                  className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40", isRTL && "text-right font-[IBMPlexSansArabic]")} />
              </div>
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'رقم البوليصة' : 'N° de police'} *</Label>
                <Input value={formData.assurance_policy_number} onChange={(e) => handleChange('assurance_policy_number', e.target.value)}
                  placeholder="RC-2024-123456"
                  className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40 font-mono", isRTL && "text-right")} />
              </div>
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "font-[IBMPlexSansArabic]")}>{isRTL ? 'التغطية الجغرافية' : 'Couverture géographique'}</Label>
                <Input value={formData.assurance_geographic_coverage} onChange={(e) => handleChange('assurance_geographic_coverage', e.target.value)}
                  placeholder="France métropolitaine"
                  className={cn("h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40", isRTL && "text-right font-[IBMPlexSansArabic]")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════ */}
        {/* SECTION 4: Logo, Header, Signature, Stamp */}
        {/* ═══════════════════════════════════════════ */}
        <Card className="bg-white dark:bg-[#1A1A1C] border border-border/50 rounded-[1.5rem] shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className={cn("flex items-center gap-2 text-base", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
              <Image className="h-5 w-5 text-primary" />
              {isRTL ? 'الشعار والتوقيع والختم' : 'Logo, Signature & Cachet'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Header Type */}
            <RadioGroup value={formData.header_type} onValueChange={(v) => handleChange('header_type', v)} className="space-y-2">
              <div className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer", formData.header_type === 'automatic' && "border-primary bg-primary/5", isRTL && "flex-row-reverse")}>
                <RadioGroupItem value="automatic" id="auto-h" />
                <Label htmlFor="auto-h" className={cn("flex-1 cursor-pointer text-sm", isRTL && "text-right font-[IBMPlexSansArabic]")}>
                  {isRTL ? 'تلقائي (لوجو + نص)' : 'Automatique (Logo + Texte)'}
                </Label>
              </div>
              <div className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer", formData.header_type === 'full_image' && "border-primary bg-primary/5", isRTL && "flex-row-reverse")}>
                <RadioGroupItem value="full_image" id="full-h" />
                <Label htmlFor="full-h" className={cn("flex-1 cursor-pointer text-sm", isRTL && "text-right font-[IBMPlexSansArabic]")}>
                  {isRTL ? 'صورة كاملة (بانر)' : 'Image complète (Bannière)'}
                </Label>
              </div>
            </RadioGroup>

            {/* Logo Upload */}
            {formData.header_type === 'automatic' && (
              <div className="space-y-2">
                <Label className={cn("flex items-center gap-2 text-sm", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  {isRTL ? 'شعار الشركة' : 'Logo de l\'entreprise'}
                </Label>
                <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
                  {formData.logo_url && signedLogoUrl ? (
                    <div className="w-16 h-16 rounded-lg border overflow-hidden bg-muted">
                      <img src={signedLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="cursor-pointer flex-1" />
                  {isUploadingLogo && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
              </div>
            )}

            {/* Full Header Upload */}
            {formData.header_type === 'full_image' && (
              <div className="space-y-2">
                <Label className={cn("flex items-center gap-2 text-sm", isRTL && "flex-row-reverse font-[IBMPlexSansArabic]")}>
                  <Image className="h-4 w-4 text-muted-foreground" />
                  {isRTL ? 'صورة الهيدر الكاملة' : 'Image de l\'en-tête'}
                </Label>
                {formData.header_image_url && signedHeaderUrl ? (
                  <div className="rounded-lg border overflow-hidden bg-muted">
                    <AspectRatio ratio={16/4}>
                      <img src={signedHeaderUrl} alt="Header" className="w-full h-full object-cover" />
                    </AspectRatio>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50 h-20">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                  <Input type="file" accept="image/*" onChange={handleHeaderUpload} disabled={isUploadingHeader} className="cursor-pointer flex-1" />
                  {isUploadingHeader && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Artisan Signature & Stamp */}
        <ArtisanSignatureSection />
        <StampUploadSection />

        {/* Factur-X Legal Necessity Mention */}
        <Card className="border-border/30 bg-accent/30 rounded-[1.25rem]">
          <CardContent className={cn("p-4", isRTL && "font-[IBMPlexSansArabic]")}>
            <p className={cn("text-xs text-muted-foreground leading-relaxed", isRTL && "text-right")}>
              {isRTL
                ? 'ℹ️ هذه المعلومات ضرورية لإنشاء عروض أسعار وفواتير قانونية مطابقة لنظام Factur-X.'
                : 'ℹ️ Ces informations sont nécessaires pour créer des devis et factures conformes au format Factur-X.'}
            </p>
          </CardContent>
        </Card>

        {/* Single Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving || !!siretError}
          className={cn("w-full gap-2 h-13 text-base font-semibold rounded-xl shadow-md", isRTL && "font-[IBMPlexSansArabic]")}
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isRTL ? 'حفظ التعديلات' : 'Enregistrer les modifications'}
        </Button>

        {/* Legal Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <button onClick={() => navigate('/legal')} className="hover:text-primary underline">
            {isRTL ? 'سياسة الخصوصية' : 'Confidentialité'}
          </button>
          <span>•</span>
          <button onClick={() => navigate('/legal#terms')} className="hover:text-primary underline">
            {isRTL ? 'شروط الاستخدام' : "Conditions d'utilisation"}
          </button>
        </div>

        {/* API Key - Admin only */}
        {isAdmin && (
          <>
            <Card className="bg-white dark:bg-[#1A1A1C] border border-border/30 rounded-[1.25rem]">
              <CardContent className={cn("p-4", isRTL && "font-[IBMPlexSansArabic]")}>
                <button onClick={() => setShowApiKey(true)} className={cn("flex items-center gap-3 w-full", isRTL ? "flex-row-reverse text-right" : "text-left")}>
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">{isRTL ? 'مفتاح API' : 'Clé API IA'}</p>
                  </div>
                </button>
              </CardContent>
            </Card>
            <ApiKeySettingsModal open={showApiKey} onOpenChange={setShowApiKey} />
          </>
        )}

        {/* Log Out */}
        <Button variant="outline" onClick={handleSignOut}
          className={cn("w-full gap-2 h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive font-semibold", isRTL && "font-[IBMPlexSansArabic]")}>
          <LogOut className="h-4 w-4" />
          {isRTL ? "اخرج" : "Se déconnecter"}
        </Button>

        <DeleteAccountSection />
      </div>
    </div>
  );
};

export default ProfilePage;
