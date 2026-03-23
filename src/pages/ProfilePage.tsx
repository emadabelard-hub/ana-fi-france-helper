import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, User, Loader2, Shield, Key, Building2, FileText, MapPin, Mail, Phone, Upload, Image, Check, AlertCircle, Briefcase, CreditCard, Landmark, ShieldCheck, PenTool, Stamp, CheckCircle2, Circle, PartyPopper } from 'lucide-react';
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
import DeleteAccountSection from '@/components/profile/DeleteAccountSection';
import ResetDataSection from '@/components/profile/ResetDataSection';
import ArtisanSignatureSection from '@/components/profile/ArtisanSignatureSection';
import StampUploadSection from '@/components/profile/StampUploadSection';

/* ─── Tab definitions ─── */
type TabKey = 'account' | 'company' | 'insurance' | 'signature' | 'stamp';

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'account', icon: '👤', label: 'حسابي' },
  { key: 'company', icon: '🏢', label: 'شركتي' },
  { key: 'insurance', icon: '🛡', label: 'التأمين' },
  { key: 'signature', icon: '✍️', label: 'التوقيع' },
  { key: 'stamp', icon: '🧾', label: 'الطابع' },
];

/* ─── Small UI helpers ─── */
const FieldStatus = ({ filled }: { filled: boolean }) => (
  filled
    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
    : <span className="inline-flex items-center gap-1 shrink-0">
        <Circle className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-[10px] font-medium text-destructive/70 font-cairo">مطلوب</span>
      </span>
);

const FieldLabel = ({ icon: Icon, label, required, filled }: { icon: any; label: string; required?: boolean; filled?: boolean }) => (
  <Label className="flex items-center gap-2 text-[13px] font-medium text-foreground/70 flex-row-reverse font-cairo">
    <Icon className="h-3.5 w-3.5 text-primary/50" />
    {label}
    {required && <span className="text-destructive text-xs">*</span>}
    <span className="flex-1" />
    {filled !== undefined && <FieldStatus filled={filled} />}
  </Label>
);

const StyledInput = ({ className, ...props }: React.ComponentProps<typeof Input>) => (
  <Input
    {...props}
    className={cn(
      "h-12 rounded-xl border-border/30 bg-white dark:bg-secondary/50 text-[15px] placeholder:text-muted-foreground/40 focus:bg-background focus:border-[#BFA071]/40 focus:ring-[#BFA071]/20 transition-colors text-right font-cairo",
      className
    )}
  />
);

const ProfilePage = () => {
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>('company');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [siretError, setSiretError] = useState<string | null>(null);
  const [signedLogoUrl, setSignedLogoUrl] = useState<string | null>(null);
  const [signedHeaderUrl, setSignedHeaderUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: '', job: '', company_name: '', siret: '', company_address: '',
    email: '', phone: '', legal_status: 'auto-entrepreneur' as string,
    tva_exempt: false, header_type: 'automatic' as string,
    logo_url: '', header_image_url: '',
    legal_footer: "Dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.",
    capital_social: '', code_naf: '', ville_immatriculation: '', numero_tva: '',
    assureur_name: '', assureur_address: '', assurance_policy_number: '',
    assurance_geographic_coverage: 'France métropolitaine',
    iban: '', bic: '', accountant_email: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '', job: profile.job || '',
        company_name: profile.company_name || '', siret: profile.siret || '',
        company_address: profile.company_address || '', email: profile.email || '',
        phone: profile.phone || '', legal_status: profile.legal_status || 'auto-entrepreneur',
        tva_exempt: profile.tva_exempt || false, header_type: profile.header_type || 'automatic',
        logo_url: profile.logo_url || '', header_image_url: profile.header_image_url || '',
        legal_footer: profile.legal_footer || "Dispensé d'immatriculation au registre du commerce et des sociétés (RCS) et au répertoire des métiers (RM). TVA non applicable, art. 293 B du CGI.",
        capital_social: profile.capital_social || '', code_naf: profile.code_naf || '',
        ville_immatriculation: profile.ville_immatriculation || '',
        numero_tva: profile.numero_tva || '', assureur_name: profile.assureur_name || '',
        assureur_address: profile.assureur_address || '',
        assurance_policy_number: profile.assurance_policy_number || '',
        assurance_geographic_coverage: profile.assurance_geographic_coverage || 'France métropolitaine',
        iban: profile.iban || '', bic: profile.bic || '', accountant_email: profile.accountant_email || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc('is_admin', { _user_id: user.id }).then(({ data }) => setIsAdmin(data === true));
  }, [user]);

  useEffect(() => {
    if (formData.logo_url) getSignedAssetUrl(formData.logo_url).then(url => setSignedLogoUrl(url));
    else setSignedLogoUrl(null);
  }, [formData.logo_url]);

  useEffect(() => {
    if (formData.header_image_url) getSignedAssetUrl(formData.header_image_url).then(url => setSignedHeaderUrl(url));
    else setSignedHeaderUrl(null);
  }, [formData.header_image_url]);

  const handleChange = (field: string, value: string) => {
    if (field === 'siret') {
      const cleanValue = value.replace(/\D/g, '').slice(0, 14);
      setFormData(prev => ({ ...prev, [field]: cleanValue }));
      setSiretError(cleanValue.length > 0 && cleanValue.length !== 14 ? 'رقم السيريت لازم يكون 14 رقم' : null);
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const uploadFile = async (file: File, type: 'logo' | 'header'): Promise<string | null> => {
    if (!user) return null;
    try {
      const compressedBlob = await compressImageFile(file, {
        maxWidth: type === 'header' ? 1920 : 500, maxHeight: type === 'header' ? 400 : 500, quality: 0.85,
      });
      const fileName = `${user.id}/${type}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, compressedBlob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(fileName);
      return publicUrl;
    } catch (error) { console.error('Upload error:', error); return null; }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsUploadingLogo(true);
    const url = await uploadFile(file, 'logo');
    if (url) setFormData(prev => ({ ...prev, logo_url: url }));
    setIsUploadingLogo(false);
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
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

  /* ─── Completion tracking ─── */
  const mandatoryFields = useMemo(() => [
    { key: 'full_name', tab: 'account' as TabKey, filled: !!formData.full_name.trim() },
    { key: 'job', tab: 'account' as TabKey, filled: !!formData.job.trim() },
    { key: 'siret', tab: 'company' as TabKey, filled: formData.siret.length === 14 },
    { key: 'company_address', tab: 'company' as TabKey, filled: !!formData.company_address.trim() },
    { key: 'email', tab: 'company' as TabKey, filled: !!formData.email.trim() },
    { key: 'assureur_name', tab: 'insurance' as TabKey, filled: !!formData.assureur_name.trim() },
    { key: 'assurance_policy_number', tab: 'insurance' as TabKey, filled: !!formData.assurance_policy_number.trim() },
  ], [formData]);

  const progressPercent = useMemo(() => {
    const filled = mandatoryFields.filter(f => f.filled).length;
    return Math.round((filled / mandatoryFields.length) * 100);
  }, [mandatoryFields]);

  const tabHasIncomplete = (tabKey: TabKey) => mandatoryFields.some(f => f.tab === tabKey && !f.filled);
  const isFieldFilled = (key: string) => mandatoryFields.find(f => f.key === key)?.filled ?? false;

  /* ─── Status summary items ─── */
  const statusItems = useMemo(() => [
    { label: 'جاهز للفواتير', done: progressPercent === 100 },
    { label: 'التأمين مضاف', done: !!formData.assureur_name.trim() && !!formData.assurance_policy_number.trim() },
    { label: 'التوقيع محفوظ', done: !!profile?.artisan_signature_url },
  ], [progressPercent, formData, profile]);

  const userInitial = formData.full_name
    ? formData.full_name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || '?';

  /* ─── Guards ─── */
  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-cairo">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const progressColor = progressPercent < 50 ? 'bg-destructive' : progressPercent < 100 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-background pb-36" dir="rtl">
      <div className="max-w-lg mx-auto">

        {/* ═══════ Header ═══════ */}
        <div className="px-4 pt-6 pb-4 space-y-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4 flex-row-reverse">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#BFA071] to-[#D4B896] flex items-center justify-center shadow-lg shadow-[#BFA071]/20">
              <span className="text-2xl font-bold text-white font-[Inter]">{userInitial}</span>
            </div>
            <div className="flex-1 text-right">
              <h1 className="text-lg font-bold text-foreground font-cairo">
                {formData.full_name || 'حسابي'}
              </h1>
              <p className="text-xs text-muted-foreground font-[Inter] mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* Status summary chips */}
          <div className="flex flex-wrap gap-2 justify-end">
            {statusItems.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-cairo",
                  item.done
                    ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20"
                    : "bg-secondary text-muted-foreground border border-border/30"
                )}
              >
                {item.done ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                {item.label}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-border/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-bold", progressPercent < 50 ? "text-destructive" : progressPercent < 100 ? "text-yellow-600" : "text-green-600")}>
                {progressPercent}%
              </span>
              <span className="text-xs text-muted-foreground font-cairo">
                ملفك {progressPercent === 100 ? 'مكتمل' : 'غير مكتمل'}
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full rounded-full transition-all duration-700 ease-out", progressColor)} style={{ width: `${progressPercent}%` }} />
            </div>
            {progressPercent === 100 && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 flex-row-reverse">
                <PartyPopper className="h-4 w-4 text-green-500 shrink-0" />
                <p className="text-[11px] font-semibold text-green-700 dark:text-green-400 font-cairo">ملفك القانوني مكتمل 🎉</p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ TAB BAR ═══════ */}
        <div className="sticky top-0 z-20 bg-[#FAFAFA] dark:bg-background border-b border-border/20">
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex gap-1 px-4 py-2 min-w-max flex-row-reverse">
              {TABS.map(tab => {
                const isActive = activeTab === tab.key;
                const hasWarning = tabHasIncomplete(tab.key);
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium font-cairo transition-all whitespace-nowrap",
                      isActive
                        ? "bg-[#BFA071] text-white shadow-md shadow-[#BFA071]/25"
                        : "bg-white dark:bg-card text-muted-foreground hover:bg-secondary border border-border/20"
                    )}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {hasWarning && !isActive && (
                      <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-destructive border-2 border-[#FAFAFA] dark:border-background" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════ TAB CONTENT ═══════ */}
        <div className="px-4 pt-4 space-y-4">

          {/* ── TAB: حسابي ── */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border/20 space-y-5">
                <div className="space-y-2">
                  <FieldLabel icon={User} label="الاسم الكامل" filled={isFieldFilled('full_name')} />
                  <StyledInput value={formData.full_name} onChange={(e) => handleChange('full_name', e.target.value)} placeholder="اكتب اسمك الكامل" />
                </div>
                <div className="space-y-2">
                  <FieldLabel icon={Briefcase} label="المهنة" required filled={isFieldFilled('job')} />
                  <StyledInput value={formData.job} onChange={(e) => handleChange('job', e.target.value)} placeholder="مثال: كهربائي، سبّاك، مقاول عام" />
                </div>
                <div className="space-y-2">
                  <FieldLabel icon={Phone} label="رقم الهاتف" filled={!!formData.phone.trim()} />
                  <StyledInput value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="06 12 34 56 78" className="font-[Inter] text-left" dir="ltr" />
                </div>
              </div>

              {/* Admin + Pricing + Logout */}
              {isAdmin && (
                <button onClick={() => navigate('/admin')} className="w-full bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-border/20 flex items-center gap-3 flex-row-reverse text-right">
                  <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground font-cairo">لوحة الإدارة</p>
                    <p className="text-xs text-muted-foreground font-cairo mt-0.5">مراقبة النظام والإحصائيات</p>
                  </div>
                </button>
              )}

              <button onClick={() => navigate('/pro/pricing-settings')} className="w-full bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-border/20 flex items-center gap-3 flex-row-reverse text-right">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground font-cairo">إعدادات التعريفة</p>
                  <p className="text-xs text-muted-foreground font-cairo mt-0.5">خصّص أسعارك المرجعية</p>
                </div>
              </button>

              {isAdmin && (
                <>
                  <button onClick={() => setShowApiKey(true)} className="w-full bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-border/20 flex items-center gap-3 flex-row-reverse text-right">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-semibold text-sm text-foreground font-cairo">مفتاح API</p>
                  </button>
                  <ApiKeySettingsModal open={showApiKey} onOpenChange={setShowApiKey} />
                </>
              )}

              <Separator className="opacity-20" />

              {/* RGPD */}
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4">
                <div className="flex items-start gap-3 flex-row-reverse">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs text-foreground/70 leading-relaxed flex-1 text-right font-cairo">
                    بياناتك محمية ومشفرة وفقاً للمعايير الأوروبية (RGPD). نحن لا نشارك بياناتك مع أي جهة خارجية.
                  </p>
                </div>
              </div>

              <Button variant="outline" onClick={handleSignOut}
                className="w-full gap-2 h-12 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/5 font-semibold font-cairo">
                <LogOut className="h-4 w-4" />
                خروج
              </Button>

              <ResetDataSection />
              <DeleteAccountSection />

              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                <button onClick={() => navigate('/legal')} className="hover:text-primary underline">سياسة الخصوصية</button>
                <span className="text-border">•</span>
                <button onClick={() => navigate('/legal#terms')} className="hover:text-primary underline">شروط الاستخدام</button>
              </div>
            </div>
          )}

          {/* ── TAB: شركتي ── */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              {/* Company Info Card */}
              <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border/20 space-y-5">
                <p className="text-xs text-muted-foreground font-cairo text-right">المعلومات دي هتظهر على كل فواتيرك ودوفيهاتك</p>

                <div className="space-y-2">
                  <FieldLabel icon={Building2} label="اسم الشركة" filled={!!formData.company_name.trim()} />
                  <StyledInput value={formData.company_name} onChange={(e) => handleChange('company_name', e.target.value)} placeholder="شركة البناء للمقاولات" />
                </div>

                <div className="space-y-2">
                  <FieldLabel icon={FileText} label="رقم السيريت (SIRET)" filled={isFieldFilled('siret')} />
                  <StyledInput value={formData.siret} onChange={(e) => handleChange('siret', e.target.value)} placeholder="12345678901234" maxLength={14}
                    className={cn("font-mono text-left", siretError && "border-destructive")} dir="ltr" />
                  {siretError && <p className="text-xs text-destructive flex items-center gap-1 flex-row-reverse"><AlertCircle className="h-3 w-3" />{siretError}</p>}
                  {formData.siret.length === 14 && !siretError && (
                    <p className="text-xs text-green-500 flex items-center gap-1 flex-row-reverse"><Check className="h-3 w-3" />رقم سيريت صحيح ✓</p>
                  )}
                </div>

                <div className="space-y-2">
                  <FieldLabel icon={Mail} label="الإيميل المهني" filled={isFieldFilled('email')} />
                  <StyledInput type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="contact@entreprise.fr" className="font-[Inter] text-left" dir="ltr" />
                </div>

                <div className="space-y-2">
                  <FieldLabel icon={MapPin} label="عنوان المقر" filled={isFieldFilled('company_address')} />
                  <StyledInput value={formData.company_address} onChange={(e) => handleChange('company_address', e.target.value)} placeholder="العنوان الكامل" />
                </div>
              </div>

              {/* Legal Status Card */}
              <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border/20 space-y-5">
                <div className="space-y-2">
                  <FieldLabel icon={FileText} label="الشكل القانوني" />
                  <Select value={formData.legal_status} onValueChange={(v) => handleChange('legal_status', v)}>
                    <SelectTrigger className="h-12 rounded-xl border-border/30 bg-white dark:bg-secondary/50 text-[15px] font-cairo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto-entrepreneur">أوتو أونتروبرونور</SelectItem>
                      <SelectItem value="societe">شركة (SARL, SAS, إلخ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className={cn(
                  "flex items-start gap-3 p-3.5 rounded-xl border transition-colors flex-row-reverse",
                  formData.tva_exempt ? "border-green-500/40 bg-green-50 dark:bg-green-500/5" : "border-border/30 bg-secondary/30"
                )}>
                  <Checkbox id="tva-exempt" checked={formData.tva_exempt}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, tva_exempt: !!checked }))} className="mt-0.5" />
                  <Label htmlFor="tva-exempt" className="flex-1 cursor-pointer text-right font-cairo">
                    <span className="font-medium text-sm">معفى من TVA (Art. 293 B)</span>
                  </Label>
                </div>

                {!formData.tva_exempt && formData.legal_status === 'societe' && (
                  <div className="space-y-2">
                    <FieldLabel icon={FileText} label="رقم TVA Intracommunautaire" />
                    <StyledInput value={formData.numero_tva} onChange={(e) => handleChange('numero_tva', e.target.value)} placeholder="FR 12 345678901" className="font-mono text-left" dir="ltr" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <FieldLabel icon={Landmark} label="رأس المال" />
                    <StyledInput value={formData.capital_social} onChange={(e) => handleChange('capital_social', e.target.value)}
                      placeholder={formData.legal_status === 'auto-entrepreneur' ? '0 €' : '1 000 €'} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel icon={FileText} label="كود NAF" />
                    <StyledInput value={formData.code_naf} onChange={(e) => handleChange('code_naf', e.target.value)} placeholder="4334Z" className="font-mono text-left" dir="ltr" />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel icon={MapPin} label="مدينة التسجيل (RCS/RM)" />
                  <StyledInput value={formData.ville_immatriculation} onChange={(e) => handleChange('ville_immatriculation', e.target.value)} placeholder="Paris" />
                </div>
              </div>

              {/* Banking Card */}
              <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border/20 space-y-5">
                <p className="text-sm font-semibold text-foreground font-cairo text-right flex items-center gap-2 flex-row-reverse">
                  <CreditCard className="h-4 w-4 text-[#BFA071]" />
                  البيانات البنكية
                </p>
                <div className="space-y-2">
                  <FieldLabel icon={CreditCard} label="IBAN" />
                  <StyledInput value={formData.iban} onChange={(e) => handleChange('iban', e.target.value.toUpperCase())} placeholder="FR76 1234..." className="font-mono text-sm text-left" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <FieldLabel icon={CreditCard} label="BIC / SWIFT" />
                  <StyledInput value={formData.bic} onChange={(e) => handleChange('bic', e.target.value.toUpperCase())} placeholder="BNPAFRPP" className="font-mono text-sm text-left" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <FieldLabel icon={Mail} label="بريد المحاسب (اختياري)" filled={!!formData.accountant_email?.trim()} />
                  <StyledInput type="email" value={formData.accountant_email} onChange={(e) => handleChange('accountant_email', e.target.value)} placeholder="comptable@example.com" className="font-mono text-sm text-left" dir="ltr" />
                </div>
              </div>

              {/* Logo / Header Card */}
              <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border/20 space-y-5">
                <p className="text-sm font-semibold text-foreground font-cairo text-right flex items-center gap-2 flex-row-reverse">
                  <Image className="h-4 w-4 text-[#BFA071]" />
                  الشعار والهيدر
                </p>
                <RadioGroup value={formData.header_type} onValueChange={(v) => handleChange('header_type', v)} className="space-y-2">
                  <div className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors flex-row-reverse",
                    formData.header_type === 'automatic' ? "border-[#BFA071]/40 bg-[#BFA071]/5" : "border-border/30"
                  )}>
                    <RadioGroupItem value="automatic" id="auto-h" />
                    <Label htmlFor="auto-h" className="flex-1 cursor-pointer text-sm text-right font-cairo">تلقائي (لوجو + نص)</Label>
                  </div>
                  <div className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors flex-row-reverse",
                    formData.header_type === 'full_image' ? "border-[#BFA071]/40 bg-[#BFA071]/5" : "border-border/30"
                  )}>
                    <RadioGroupItem value="full_image" id="full-h" />
                    <Label htmlFor="full-h" className="flex-1 cursor-pointer text-sm text-right font-cairo">صورة كاملة (بانر)</Label>
                  </div>
                </RadioGroup>

                {formData.header_type === 'automatic' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 flex-row-reverse">
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
                        className="cursor-pointer flex-1 h-12 rounded-xl border-border/30 bg-white dark:bg-secondary/50" />
                      {isUploadingLogo && <Loader2 className="h-5 w-5 animate-spin text-[#BFA071]" />}
                    </div>
                  </div>
                )}

                {formData.header_type === 'full_image' && (
                  <div className="space-y-2">
                    {formData.header_image_url && signedHeaderUrl ? (
                      <div className="rounded-xl border border-border/30 overflow-hidden bg-secondary/50">
                        <AspectRatio ratio={16 / 4}>
                          <img src={signedHeaderUrl} alt="Header" className="w-full h-full object-cover" />
                        </AspectRatio>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-border/40 flex items-center justify-center bg-secondary/30 h-20">
                        <Image className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-row-reverse">
                      <Input type="file" accept="image/*" onChange={handleHeaderUpload} disabled={isUploadingHeader}
                        className="cursor-pointer flex-1 h-12 rounded-xl border-border/30 bg-white dark:bg-secondary/50" />
                      {isUploadingHeader && <Loader2 className="h-5 w-5 animate-spin text-[#BFA071]" />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: التأمين ── */}
          {activeTab === 'insurance' && (
            <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border/20 space-y-5">
              <div className="flex items-center gap-2 flex-row-reverse">
                <ShieldCheck className="h-5 w-5 text-[#BFA071]" />
                <p className="text-sm font-semibold text-foreground font-cairo">التأمين العشري (Décennale)</p>
              </div>
              <p className="text-xs text-muted-foreground font-cairo text-right">هذا القسم منفصل عن بيانات الشركة – ضروري قانونياً</p>

              <div className="space-y-2">
                <FieldLabel icon={Building2} label="اسم شركة التأمين" required filled={isFieldFilled('assureur_name')} />
                <StyledInput value={formData.assureur_name} onChange={(e) => handleChange('assureur_name', e.target.value)} placeholder="AXA France" />
              </div>
              <div className="space-y-2">
                <FieldLabel icon={MapPin} label="عنوان شركة التأمين" />
                <StyledInput value={formData.assureur_address} onChange={(e) => handleChange('assureur_address', e.target.value)} placeholder="25 av. Matignon, Paris" />
              </div>
              <div className="space-y-2">
                <FieldLabel icon={FileText} label="رقم البوليصة" required filled={isFieldFilled('assurance_policy_number')} />
                <StyledInput value={formData.assurance_policy_number} onChange={(e) => handleChange('assurance_policy_number', e.target.value)} placeholder="RC-2024-123456" className="font-mono text-left" dir="ltr" />
              </div>
              <div className="space-y-2">
                <FieldLabel icon={MapPin} label="التغطية الجغرافية" />
                <StyledInput value={formData.assurance_geographic_coverage} onChange={(e) => handleChange('assurance_geographic_coverage', e.target.value)} placeholder="France métropolitaine" />
              </div>
            </div>
          )}

          {/* ── TAB: التوقيع ── */}
          {activeTab === 'signature' && (
            <ArtisanSignatureSection />
          )}

          {/* ── TAB: الطابع ── */}
          {activeTab === 'stamp' && (
            <StampUploadSection />
          )}

          {/* ═══════ GLOBAL SAVE BUTTON ═══════ */}
          <div className="pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !!siretError}
              className="w-full gap-2.5 h-14 text-base font-semibold rounded-2xl shadow-lg shadow-[#BFA071]/20 bg-gradient-to-l from-[#BFA071] to-[#D4B896] hover:from-[#A8894F] hover:to-[#C4A880] text-white transition-all font-cairo"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              حفظ التعديلات
            </Button>
          </div>

          {/* Factur-X notice */}
          <div className="rounded-2xl bg-accent/10 border border-accent/20 p-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed text-right font-cairo">
              ℹ️ هذه المعلومات ضرورية لإنشاء عروض أسعار وفواتير قانونية مطابقة لنظام Factur-X.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
