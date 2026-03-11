import { useState, useEffect } from 'react';
import { Building2, FileText, MapPin, Mail, Upload, Image, Loader2, Check, AlertCircle, Bell } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { compressImageFile } from '@/lib/imageCompression';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import ArtisanSignatureSection from './ArtisanSignatureSection';
import StampUploadSection from './StampUploadSection';
import { getSignedAssetUrl } from '@/lib/storageUtils';
import { Switch } from '@/components/ui/switch';

const DailyAlertToggle = () => {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('daily_balance_alert') === 'true');
  const handleToggle = (val: boolean) => {
    setEnabled(val);
    localStorage.setItem('daily_balance_alert', String(val));
  };
  return <Switch checked={enabled} onCheckedChange={handleToggle} />;
};

interface CompanyFormData {
  company_name: string;
  siret: string;
  company_address: string;
  email: string;
  legal_status: 'auto-entrepreneur' | 'societe';
  tva_exempt: boolean;
  header_type: 'automatic' | 'full_image';
  logo_url: string;
  header_image_url: string;
  legal_footer: string;
  capital_social: string;
  code_naf: string;
  ville_immatriculation: string;
  numero_tva: string;
  assureur_name: string;
  assureur_address: string;
  assurance_policy_number: string;
  assurance_geographic_coverage: string;
  iban: string;
  bic: string;
  accountant_email: string;
  urssaf_rate: string;
  is_rate: string;
}

const CompanyProfileSection = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [siretError, setSiretError] = useState<string | null>(null);
  const [signedLogoUrl, setSignedLogoUrl] = useState<string | null>(null);
  const [signedHeaderUrl, setSignedHeaderUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CompanyFormData>({
    company_name: '',
    siret: '',
    company_address: '',
    email: '',
    legal_status: 'auto-entrepreneur',
    tva_exempt: false,
    header_type: 'automatic',
    logo_url: '',
    header_image_url: '',
    legal_footer: 'Dispensé d\'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.',
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
    accountant_email: '',
    urssaf_rate: '21.2',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: (profile as any).company_name || '',
        siret: (profile as any).siret || '',
        company_address: (profile as any).company_address || '',
        email: (profile as any).email || '',
        legal_status: (profile as any).legal_status || 'auto-entrepreneur',
        tva_exempt: (profile as any).tva_exempt || false,
        header_type: (profile as any).header_type || 'automatic',
        logo_url: (profile as any).logo_url || '',
        header_image_url: (profile as any).header_image_url || '',
        legal_footer: (profile as any).legal_footer || 'Dispensé d\'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.',
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
        accountant_email: (profile as any).accountant_email || '',
        urssaf_rate: String((profile as any).urssaf_rate ?? 21.2),
      });
    }
  }, [profile]);

  // Resolve signed URLs for display when formData URLs change
  useEffect(() => {
    if (formData.logo_url) {
      getSignedAssetUrl(formData.logo_url).then(url => setSignedLogoUrl(url));
    } else {
      setSignedLogoUrl(null);
    }
  }, [formData.logo_url]);

  useEffect(() => {
    if (formData.header_image_url) {
      getSignedAssetUrl(formData.header_image_url).then(url => setSignedHeaderUrl(url));
    } else {
      setSignedHeaderUrl(null);
    }
  }, [formData.header_image_url]);

  const handleChange = (field: keyof CompanyFormData, value: string) => {
    if (field === 'siret') {
      // Only allow digits
      const cleanValue = value.replace(/\D/g, '').slice(0, 14);
      setFormData(prev => ({ ...prev, [field]: cleanValue }));
      
      // Validate SIRET
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
      // Compress image before upload
      const compressedBlob = await compressImageFile(file, {
        maxWidth: type === 'header' ? 1920 : 500,
        maxHeight: type === 'header' ? 400 : 500,
        quality: 0.85,
      });
      
      const fileName = `${user.id}/${type}-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, compressedBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);
      
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
    if (url) {
      setFormData(prev => ({ ...prev, logo_url: url }));
    }
    setIsUploadingLogo(false);
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingHeader(true);
    const url = await uploadFile(file, 'header');
    if (url) {
      setFormData(prev => ({ ...prev, header_image_url: url }));
    }
    setIsUploadingHeader(false);
  };

  const handleSave = async () => {
    if (siretError) return;
    
    setIsSaving(true);
    const { urssaf_rate, ...rest } = formData;
    await updateProfile({ ...rest, urssaf_rate: parseFloat(urssaf_rate) || 21.2 } as any);
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Compute missing required fields
  const missingFields: { label_fr: string; label_ar: string }[] = [];
  if (!formData.company_name.trim()) missingFields.push({ label_fr: 'Nom de l\'entreprise', label_ar: 'اسم الشركة' });
  if (!formData.siret || formData.siret.replace(/\D/g, '').length !== 14) missingFields.push({ label_fr: 'SIRET (14 chiffres)', label_ar: 'رقم SIRET (14 رقم)' });
  if (!formData.company_address.trim()) missingFields.push({ label_fr: 'Adresse du siège', label_ar: 'عنوان المقر' });
  if (!formData.email.trim()) missingFields.push({ label_fr: 'Email professionnel', label_ar: 'البريد المهني' });
  if (!formData.assureur_name.trim()) missingFields.push({ label_fr: 'Assurance décennale', label_ar: 'تأمين العشر سنوات' });

  return (
    <div className="space-y-6">
      {/* Missing Fields Banner */}
      {missingFields.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className={cn("p-4", isRTL && "font-cairo")}>
            <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse text-right")}>
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {isRTL ? '⚠️ في بيانات ناقصة' : '⚠️ Champs obligatoires manquants'}
                </p>
                <ul className={cn("space-y-1", isRTL && "text-right")}>
                  {missingFields.map((f, i) => (
                    <li key={i} className="text-xs text-amber-600 dark:text-amber-300 flex items-center gap-1.5" style={isRTL ? { flexDirection: 'row-reverse' } : {}}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      {isRTL ? f.label_ar : f.label_fr}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80">
                  {isRTL 
                    ? 'كمّل البيانات دي عشان تقدر تعمل فواتير ودوفيهات صحيحة'
                    : 'Complétez ces informations pour pouvoir générer des documents conformes'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Company Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
            <Building2 className="h-5 w-5 text-primary" />
            {isRTL ? 'بيانات الشركة' : 'Informations de l\'entreprise'}
          </CardTitle>
          <CardDescription className={cn(isRTL && "text-right font-cairo")}>
            {isRTL 
              ? 'المعلومات دي هتظهر على كل فواتيرك ودوفيهاتك'
              : 'Ces informations apparaîtront sur tous vos devis et factures'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company Name */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {isRTL ? 'اسم الشركة' : 'Nom de l\'entreprise'}
            </Label>
            <Input
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder={isRTL ? 'مثال: شركة البناء للمقاولات' : 'Ex: Entreprise Martin BTP'}
              className={cn(isRTL && "text-right font-cairo")}
            />
          </div>

          {/* SIRET */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
              <FileText className="h-4 w-4 text-muted-foreground" />
              {isRTL ? 'رقم السيريت (SIRET)' : 'Numéro SIRET'}
            </Label>
            <Input
              value={formData.siret}
              onChange={(e) => handleChange('siret', e.target.value)}
              placeholder="12345678901234"
              maxLength={14}
              className={cn(
                "font-mono",
                siretError && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {siretError && (
              <p className={cn(
                "text-xs text-destructive flex items-center gap-1",
                isRTL && "flex-row-reverse font-cairo"
              )}>
                <AlertCircle className="h-3 w-3" />
                {siretError}
              </p>
            )}
            {formData.siret.length === 14 && !siretError && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                {isRTL ? 'رقم سيريت صحيح' : 'SIRET valide'}
              </p>
            )}
          </div>

          {/* Company Address */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {isRTL ? 'عنوان المقر' : 'Adresse du siège'}
            </Label>
            <Input
              value={formData.company_address}
              onChange={(e) => handleChange('company_address', e.target.value)}
              placeholder={isRTL ? 'العنوان الكامل' : 'Adresse complète'}
              className={cn(isRTL && "text-right font-cairo")}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
              <Mail className="h-4 w-4 text-muted-foreground" />
              {isRTL ? 'الإيميل المهني' : 'Email professionnel'}
            </Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="contact@entreprise.fr"
              className={cn(isRTL && "text-right")}
            />
          </div>

          {/* Legal Status */}
          <div className="space-y-3">
            <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
              {isRTL ? 'الشكل القانوني' : 'Statut juridique'}
            </Label>
            <Select
              value={formData.legal_status}
              onValueChange={(value) => handleChange('legal_status', value as 'auto-entrepreneur' | 'societe')}
            >
              <SelectTrigger className={cn(isRTL && "font-cairo")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto-entrepreneur">
                  {isRTL ? 'أوتو أونتروبرونور (Auto-entrepreneur)' : 'Auto-entrepreneur'}
                </SelectItem>
                <SelectItem value="societe">
                  {isRTL ? 'شركة (SARL, SAS, إلخ)' : 'Société (SARL, SAS, etc.)'}
                </SelectItem>
              </SelectContent>
            </Select>
            {formData.legal_status === 'auto-entrepreneur' && (
              <p className={cn(
                "text-xs text-muted-foreground bg-accent/50 p-2 rounded-md",
                isRTL && "text-right font-cairo"
              )}>
                {isRTL 
                  ? '⚠️ هيتضاف تلقائياً: "TVA non applicable, art. 293 B du CGI"'
                  : '⚠️ Sera automatiquement ajouté: "TVA non applicable, art. 293 B du CGI"'
                }
              </p>
            )}
          </div>

          {/* TVA Exemption Checkbox */}
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-lg border",
            formData.tva_exempt && "border-green-500/50 bg-green-500/5",
            isRTL && "flex-row-reverse"
          )}>
            <Checkbox
              id="tva-exempt"
              checked={formData.tva_exempt}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, tva_exempt: !!checked }))}
              className="mt-0.5"
            />
            <Label htmlFor="tva-exempt" className={cn("flex-1 cursor-pointer", isRTL && "text-right font-cairo")}>
              <span className="font-medium text-sm">
                {isRTL ? 'معفى من ضريبة القيمة المضافة (Art. 293 B)' : 'Exonéré de TVA (Art. 293 B du CGI)'}
              </span>
              <p className={cn("text-xs text-muted-foreground mt-1", isRTL && "font-cairo")}>
                {isRTL
                  ? 'لو مفعّل، مش هيظهر حقل TVA في الفواتير والدوفيهات'
                  : 'Si activé, le champ TVA n\'apparaîtra pas sur vos devis et factures'}
              </p>
            </Label>
          </div>

          {/* Numéro TVA - hidden when exempt */}
          {!formData.tva_exempt && formData.legal_status === 'societe' && (
            <div className="space-y-2">
              <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
                {isRTL ? 'رقم TVA' : 'N° TVA Intracommunautaire'}
              </Label>
              <Input
                value={formData.numero_tva}
                onChange={(e) => handleChange('numero_tva', e.target.value)}
                placeholder="FR 12 345678901"
                className={cn(isRTL && "text-right")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header Branding Card */}
      <Card>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
            <Image className="h-5 w-5 text-primary" />
            {isRTL ? 'تصميم الرأسية' : 'Style de l\'en-tête'}
          </CardTitle>
          <CardDescription className={cn(isRTL && "text-right font-cairo")}>
            {isRTL 
              ? 'اختار شكل الهيدر اللي هيظهر فوق الفواتير والدوفيهات'
              : 'Choisissez l\'apparence de l\'en-tête de vos documents'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Type Selection */}
          <RadioGroup
            value={formData.header_type}
            onValueChange={(value) => handleChange('header_type', value as 'automatic' | 'full_image')}
            className="space-y-3"
          >
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              formData.header_type === 'automatic' && "border-primary bg-primary/5",
              isRTL && "flex-row-reverse"
            )}>
              <RadioGroupItem value="automatic" id="automatic" className="mt-1" />
              <Label htmlFor="automatic" className={cn("flex-1 cursor-pointer", isRTL && "text-right")}>
                <span className={cn("font-medium", isRTL && "font-cairo")}>
                  {isRTL ? 'تلقائي (لوجو + نص)' : 'Automatique (Logo + Texte)'}
                </span>
                <p className={cn("text-sm text-muted-foreground mt-1", isRTL && "font-cairo")}>
                  {isRTL 
                    ? 'اللوجو على الشمال، واسم الشركة والعنوان على اليمين'
                    : 'Logo à gauche, nom de l\'entreprise et adresse à droite'
                  }
                </p>
              </Label>
            </div>

            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              formData.header_type === 'full_image' && "border-primary bg-primary/5",
              isRTL && "flex-row-reverse"
            )}>
              <RadioGroupItem value="full_image" id="full_image" className="mt-1" />
              <Label htmlFor="full_image" className={cn("flex-1 cursor-pointer", isRTL && "text-right")}>
                <span className={cn("font-medium", isRTL && "font-cairo")}>
                  {isRTL ? 'صورة كاملة (بانر)' : 'Image complète (Bannière)'}
                </span>
                <p className={cn("text-sm text-muted-foreground mt-1", isRTL && "font-cairo")}>
                  {isRTL 
                    ? 'صورة واحدة عريضة بعرض الصفحة كلها'
                    : 'Une seule image large sur toute la largeur de la page'
                  }
                </p>
              </Label>
            </div>
          </RadioGroup>

          {/* Logo Upload (for automatic type) */}
          {formData.header_type === 'automatic' && (
            <div className="space-y-3">
              <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
                <Upload className="h-4 w-4 text-muted-foreground" />
                {isRTL ? 'شعار الشركة (اللوجو)' : 'Logo de l\'entreprise'}
              </Label>
              
              <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
                {formData.logo_url && signedLogoUrl ? (
                  <div className="w-20 h-20 rounded-lg border overflow-hidden bg-muted">
                    <img 
                      src={signedLogoUrl} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="cursor-pointer"
                  />
                  <p className={cn("text-xs text-muted-foreground mt-1", isRTL && "font-cairo")}>
                    {isRTL ? 'PNG أو JPG، حجم مربع مفضل' : 'PNG ou JPG, format carré recommandé'}
                  </p>
                </div>
                
                {isUploadingLogo && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              </div>
            </div>
          )}

          {/* Full Header Image Upload */}
          {formData.header_type === 'full_image' && (
            <div className="space-y-3">
              <Label className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
                <Image className="h-4 w-4 text-muted-foreground" />
                {isRTL ? 'صورة الهيدر الكاملة' : 'Image de l\'en-tête'}
              </Label>
              
              <div className="space-y-3">
                {formData.header_image_url && signedHeaderUrl ? (
                  <div className="rounded-lg border overflow-hidden bg-muted">
                    <AspectRatio ratio={16/4}>
                      <img 
                        src={signedHeaderUrl} 
                        alt="Header" 
                        className="w-full h-full object-cover"
                      />
                    </AspectRatio>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50 h-24">
                    <div className={cn("text-center", isRTL && "font-cairo")}>
                      <Image className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? 'لسه مرفعتش صورة' : 'Aucune image téléchargée'}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleHeaderUpload}
                    disabled={isUploadingHeader}
                    className="cursor-pointer flex-1"
                  />
                  {isUploadingHeader && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
                
                <p className={cn(
                  "text-xs text-muted-foreground bg-accent/50 p-2 rounded-md",
                  isRTL && "text-right font-cairo"
                )}>
                  {isRTL 
                    ? '💡 عشان أحسن نتيجة، استخدم صورة عريضة (بانر) حوالي 1920×400 بكسل'
                    : '💡 Pour un meilleur résultat, utilisez une image large (bannière) d\'environ 1920×400 pixels'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Header Preview */}
          <div className="space-y-2">
            <Label className={cn("font-medium", isRTL && "font-cairo")}>
              {isRTL ? 'معاينة الهيدر' : 'Aperçu de l\'en-tête'}
            </Label>
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              {formData.header_type === 'full_image' && formData.header_image_url && signedHeaderUrl ? (
                <div className="rounded overflow-hidden">
                  <AspectRatio ratio={16/4}>
                    <img 
                      src={signedHeaderUrl} 
                      alt="Header Preview" 
                      className="w-full h-full object-cover"
                    />
                  </AspectRatio>
                </div>
              ) : (
                <div className={cn("flex items-start gap-4", isRTL && "flex-row-reverse")}>
                  {formData.logo_url && signedLogoUrl ? (
                    <img 
                      src={signedLogoUrl} 
                      alt="Logo" 
                      className="w-16 h-16 object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className={cn("flex-1 text-sm", isRTL && "text-right")}>
                    <p className="font-bold text-foreground">
                      {formData.company_name || (isRTL ? 'اسم الشركة' : 'Nom de l\'entreprise')}
                    </p>
                    <p className="text-muted-foreground">
                      {formData.company_address || (isRTL ? 'عنوان الشركة' : 'Adresse de l\'entreprise')}
                    </p>
                    {formData.siret && (
                      <p className="text-muted-foreground font-mono text-xs">
                        SIRET: {formData.siret}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
      </CardContent>
      </Card>

      {/* Legal Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
            <FileText className="h-5 w-5 text-primary" />
            {isRTL ? 'البيانات القانونية' : 'Mentions Légales (Pied de page)'}
          </CardTitle>
          <CardDescription className={cn(isRTL && "text-right font-cairo")}>
            {isRTL 
              ? 'البيانات دي هتتجمع تلقائياً في سطر قانوني أسفل كل فاتورة'
              : 'Ces informations seront assemblées automatiquement en bas de chaque document'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Forme Juridique - already handled by legal_status select above, but we need a text field for display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'رأس المال' : 'Capital Social'}
              </Label>
              <Input
                value={formData.capital_social}
                onChange={(e) => handleChange('capital_social', e.target.value)}
                placeholder="Ex: 1 000 €"
                className={cn(isRTL && "text-right")}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'كود NAF/APE' : 'Code NAF / APE'}
              </Label>
              <Input
                value={formData.code_naf}
                onChange={(e) => handleChange('code_naf', e.target.value)}
                placeholder="Ex: 4334Z"
                className={cn(isRTL && "text-right")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'مدينة التسجيل (RCS/RM)' : 'Ville d\'immatriculation (RCS/RM)'}
              </Label>
              <Input
                value={formData.ville_immatriculation}
                onChange={(e) => handleChange('ville_immatriculation', e.target.value)}
                placeholder="Ex: Paris"
                className={cn(isRTL && "text-right")}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'رقم TVA (اختياري)' : 'N° TVA Intracommunautaire'}
              </Label>
              <Input
                value={formData.numero_tva}
                onChange={(e) => handleChange('numero_tva', e.target.value)}
                placeholder="Ex: FR 12 345678901"
                className={cn(isRTL && "text-right")}
              />
            </div>
          </div>

          {/* Auto-generated footer preview */}
          <div className="space-y-2">
            <Label className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'معاينة الذيل القانوني' : 'Aperçu du pied de page généré'}
            </Label>
            <div className="bg-muted/50 rounded-md p-3 text-[10px] text-muted-foreground text-center leading-relaxed border">
              {(() => {
                const parts: string[] = [];
                if (formData.company_name) parts.push(formData.company_name);
                const statusLabel = formData.legal_status === 'auto-entrepreneur' ? 'Auto-entrepreneur' : 'Société';
                parts.push(statusLabel);
                if (formData.capital_social) parts.push(`au capital de ${formData.capital_social}`);
                if (formData.siret) parts.push(`SIRET : ${formData.siret}`);
                if (formData.code_naf) parts.push(`NAF : ${formData.code_naf}`);
                if (formData.ville_immatriculation) parts.push(`RCS ${formData.ville_immatriculation}`);
                if (formData.numero_tva) parts.push(`TVA : ${formData.numero_tva}`);
                return parts.join(' - ') || (isRTL ? 'املا الحقول عشان تشوف النص' : 'Remplissez les champs pour voir l\'aperçu');
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coordonnées bancaires */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <span className="text-xl">🏦</span>
            <CardTitle className={cn("text-lg", isRTL && "font-cairo")}>
              {isRTL ? 'بيانات البنك (IBAN / BIC)' : 'Coordonnées bancaires'}
            </CardTitle>
          </div>
          <CardDescription className={cn(isRTL && "text-right font-cairo")}>
            {isRTL
              ? '💡 هتظهر على الفاتورة عشان الزبون يعمل فيرمون (virement) بسهولة'
              : '💡 Apparaîtront sur vos factures pour faciliter les virements'}
          </CardDescription>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>IBAN</Label>
              <Input
                value={formData.iban}
                onChange={(e) => handleChange('iban' as any, e.target.value.toUpperCase())}
                placeholder="FR76 1234 5678 9012 3456 7890 123"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>BIC / SWIFT</Label>
              <Input
                value={formData.bic}
                onChange={(e) => handleChange('bic' as any, e.target.value.toUpperCase())}
                placeholder="BNPAFRPP"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Accountant Email */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'بريد المحاسب' : 'Email du comptable'}
              </Label>
            </div>
            <Input
              type="email"
              value={formData.accountant_email}
              onChange={(e) => handleChange('accountant_email' as any, e.target.value)}
              placeholder="comptable@example.com"
              className="font-mono text-sm"
              dir="ltr"
            />
            <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-cairo")}>
              {isRTL
                ? '💡 سيتم ملء هذا البريد تلقائيًا عند إرسال المستندات للمحاسب'
                : '💡 Sera pré-rempli automatiquement lors de l\'envoi au comptable'}
            </p>
          </div>

          {/* URSSAF Rate */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <span className="text-base">🏛️</span>
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'نسبة الأورساف (%)' : 'Taux URSSAF (%)'}
              </Label>
            </div>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.urssaf_rate}
              onChange={(e) => handleChange('urssaf_rate' as any, e.target.value)}
              placeholder="21.2"
              className="font-mono text-sm w-32"
              dir="ltr"
            />
            <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-cairo")}>
              {isRTL
                ? '💡 النسبة الافتراضية 21.2% للحرفيين. يمكنك تعديلها حسب نشاطك'
                : '💡 Taux par défaut 21.2% pour les artisans. Modifiable selon votre activité'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Assurance Décennale Section */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-6 space-y-4">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <span className="text-xl">🛡️</span>
            <CardTitle className={cn("text-lg", isRTL && "font-cairo")}>
              {isRTL ? 'التأمين العشري (Décennale)' : 'Assurance Décennale'}
            </CardTitle>
          </div>
          <CardDescription className={cn(isRTL && "text-right font-cairo")}>
            {isRTL
              ? '⚖️ إجباري في قطاع البناء. لازم يظهر على كل دوفي وفاكتير.'
              : '⚖️ Obligatoire dans le BTP. Doit figurer sur chaque devis et facture.'}
          </CardDescription>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'اسم شركة التأمين' : 'Nom de l\'assureur'} *
              </Label>
              <Input
                value={formData.assureur_name}
                onChange={(e) => handleChange('assureur_name', e.target.value)}
                placeholder={isRTL ? 'مثال: AXA France' : 'Ex: AXA France'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'عنوان شركة التأمين' : 'Adresse de l\'assureur'}
              </Label>
              <Input
                value={formData.assureur_address}
                onChange={(e) => handleChange('assureur_address', e.target.value)}
                placeholder={isRTL ? 'عنوان المقر' : 'Ex: 25 av. Matignon, 75008 Paris'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'رقم البوليصة' : 'N° de police / contrat'} *
              </Label>
              <Input
                value={formData.assurance_policy_number}
                onChange={(e) => handleChange('assurance_policy_number', e.target.value)}
                placeholder={isRTL ? 'رقم العقد' : 'Ex: RC-2024-123456'}
                className={cn("font-mono", isRTL && "text-right")}
              />
            </div>
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'التغطية الجغرافية' : 'Couverture géographique'}
              </Label>
              <Input
                value={formData.assurance_geographic_coverage}
                onChange={(e) => handleChange('assurance_geographic_coverage', e.target.value)}
                placeholder="France métropolitaine"
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Balance Alert Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className={cn('flex items-center justify-between gap-3', isRTL && 'flex-row-reverse')}>
            <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
              <Bell className="h-5 w-5 text-primary shrink-0" />
              <div className={cn(isRTL && 'text-right')}>
                <p className={cn('text-sm font-medium', isRTL && 'font-cairo')}>
                  {isRTL ? 'تفعيل التنبيهات اليومية للرصيد' : 'Activer les alertes quotidiennes de solde'}
                </p>
                <p className={cn('text-xs text-muted-foreground', isRTL && 'font-cairo')}>
                  {isRTL
                    ? 'سيتم إرسال إشعار يومي في حالة انخفاض الرصيد (جاهز للربط مع خدمة البريد)'
                    : 'Notification quotidienne si le solde est bas (prêt pour intégration email)'}
                </p>
              </div>
            </div>
            <DailyAlertToggle />
          </div>
        </CardContent>
      </Card>

      {/* Artisan Signature Section */}
      <ArtisanSignatureSection />

      {/* Stamp (Cachet) Upload Section */}
      <StampUploadSection />

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={isSaving || !!siretError}
        className={cn("w-full gap-2 h-12", isRTL && "font-cairo")}
      >
        {isSaving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Check className="h-5 w-5" />
        )}
        {isRTL ? 'حفظ بيانات الشركة' : 'Enregistrer les informations'}
      </Button>
    </div>
  );
};

export default CompanyProfileSection;
