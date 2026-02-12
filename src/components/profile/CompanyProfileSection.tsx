import { useState, useEffect } from 'react';
import { Building2, FileText, MapPin, Mail, Upload, Image, Loader2, Check, AlertCircle } from 'lucide-react';
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

interface CompanyFormData {
  company_name: string;
  siret: string;
  company_address: string;
  email: string;
  legal_status: 'auto-entrepreneur' | 'societe';
  header_type: 'automatic' | 'full_image';
  logo_url: string;
  header_image_url: string;
  legal_footer: string;
  capital_social: string;
  code_naf: string;
  ville_immatriculation: string;
  numero_tva: string;
}

const CompanyProfileSection = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [siretError, setSiretError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CompanyFormData>({
    company_name: '',
    siret: '',
    company_address: '',
    email: '',
    legal_status: 'auto-entrepreneur',
    header_type: 'automatic',
    logo_url: '',
    header_image_url: '',
    legal_footer: 'Dispensé d\'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.',
    capital_social: '',
    code_naf: '',
    ville_immatriculation: '',
    numero_tva: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: (profile as any).company_name || '',
        siret: (profile as any).siret || '',
        company_address: (profile as any).company_address || '',
        email: (profile as any).email || '',
        legal_status: (profile as any).legal_status || 'auto-entrepreneur',
        header_type: (profile as any).header_type || 'automatic',
        logo_url: (profile as any).logo_url || '',
        header_image_url: (profile as any).header_image_url || '',
        legal_footer: (profile as any).legal_footer || 'Dispensé d\'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.',
        capital_social: (profile as any).capital_social || '',
        code_naf: (profile as any).code_naf || '',
        ville_immatriculation: (profile as any).ville_immatriculation || '',
        numero_tva: (profile as any).numero_tva || '',
      });
    }
  }, [profile]);

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
    await updateProfile(formData as any);
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

  return (
    <div className="space-y-6">
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
              {isRTL ? 'البريد الإلكتروني المهني' : 'Email professionnel'}
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
              {isRTL ? 'الوضع القانوني' : 'Statut juridique'}
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
                  {isRTL ? 'رائد أعمال ذاتي (Auto-entrepreneur)' : 'Auto-entrepreneur'}
                </SelectItem>
                <SelectItem value="societe">
                  {isRTL ? 'شركة (SARL, SAS, etc.)' : 'Société (SARL, SAS, etc.)'}
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
                    ? 'صورة عرضية واحدة بعرض الصفحة كاملة'
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
                {formData.logo_url ? (
                  <div className="w-20 h-20 rounded-lg border overflow-hidden bg-muted">
                    <img 
                      src={formData.logo_url} 
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
                {formData.header_image_url ? (
                  <div className="rounded-lg border overflow-hidden bg-muted">
                    <AspectRatio ratio={16/4}>
                      <img 
                        src={formData.header_image_url} 
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
                        {isRTL ? 'لم يتم رفع صورة بعد' : 'Aucune image téléchargée'}
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
                    ? '💡 للحصول على أفضل نتيجة، استخدم صورة عريضة (بانر) بأبعاد 1920×400 بكسل تقريباً'
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
              {formData.header_type === 'full_image' && formData.header_image_url ? (
                <div className="rounded overflow-hidden">
                  <AspectRatio ratio={16/4}>
                    <img 
                      src={formData.header_image_url} 
                      alt="Header Preview" 
                      className="w-full h-full object-cover"
                    />
                  </AspectRatio>
                </div>
              ) : (
                <div className={cn("flex items-start gap-4", isRTL && "flex-row-reverse")}>
                  {formData.logo_url ? (
                    <img 
                      src={formData.logo_url} 
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
                return parts.join(' - ') || (isRTL ? 'املأ الحقول لمعاينة النص' : 'Remplissez les champs pour voir l\'aperçu');
              })()}
            </div>
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
