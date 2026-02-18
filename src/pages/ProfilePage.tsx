import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, User, Loader2, MapPin, Phone, CreditCard, IdCard, Shield, Key } from 'lucide-react';
import ApiKeySettingsModal from '@/components/layout/ApiKeySettingsModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/auth/AuthModal';
import DeleteAccountSection from '@/components/profile/DeleteAccountSection';
import TransactionHistory from '@/components/profile/TransactionHistory';
import CreditsDisplay from '@/components/shared/CreditsDisplay';

const ProfilePage = () => {
  const { t, isRTL } = useLanguage();
  const { user, signOut } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  const navigate = useNavigate();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    address: '',
    phone: '',
    caf_number: '',
    foreigner_number: '',
    social_security: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        address: profile.address || '',
        phone: profile.phone || '',
        caf_number: profile.caf_number || '',
        foreigner_number: profile.foreigner_number || '',
        social_security: profile.social_security || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc('is_admin', { _user_id: user.id }).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateProfile(formData);
    setIsSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Get user initial for avatar
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
              {t('profile.title')}
            </h1>
            <p className={cn(
              "text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed",
              isRTL && "font-[IBMPlexSansArabic]"
            )}>
              {isRTL 
                ? "سجّل دخولك عشان تحفظ بياناتك وتستخدمها في الخطابات الإدارية"
                : "Connectez-vous pour sauvegarder vos informations et les utiliser dans vos courriers administratifs"}
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

  const formFields = [
    {
      id: 'full_name',
      label: t('profile.fullName'),
      icon: User,
      placeholder: isRTL ? 'اكتب اسمك الكامل' : 'Entrez votre nom complet',
      required: true,
    },
    {
      id: 'address',
      label: t('profile.address'),
      icon: MapPin,
      placeholder: isRTL ? 'اكتب عنوانك الكامل' : 'Entrez votre adresse complète',
      required: true,
    },
    {
      id: 'phone',
      label: t('profile.phone'),
      icon: Phone,
      placeholder: isRTL ? 'مثال: 06 12 34 56 78' : 'Ex: 06 12 34 56 78',
      required: true,
    },
    {
      id: 'caf_number',
      label: t('profile.cafNumber'),
      icon: CreditCard,
      placeholder: isRTL ? 'رقم المستفيد من CAF' : 'Numéro d\'allocataire CAF',
      required: false,
    },
    {
      id: 'foreigner_number',
      label: t('profile.foreignerNumber'),
      icon: IdCard,
      placeholder: isRTL ? 'رقم بطاقة الإقامة' : 'Numéro de carte de séjour',
      required: false,
    },
    {
      id: 'social_security',
      label: t('profile.socialSecurity'),
      icon: Shield,
      placeholder: isRTL ? 'اكتب الـ 15 رقم اللي على الكارت فيتال' : 'Les 15 chiffres sur la Carte Vitale',
      required: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#121214] py-6 px-4">
      <div className="max-w-md mx-auto space-y-5">
        
        {/* Avatar & Identity Header */}
        <section className={cn("text-center space-y-3", isRTL && "font-[IBMPlexSansArabic]")}>
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-[#1A1A1C]">
            <span className="text-3xl font-bold text-white font-[Inter]">{userInitial}</span>
          </div>
          <div>
            <h1 className={cn(
              "text-xl font-bold text-foreground",
              isRTL ? "font-[IBMPlexSansArabic]" : "font-[Inter]"
            )}>
              {formData.full_name || (isRTL ? 'حسابي' : 'Mon compte')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-[Inter]">
              {user.email}
            </p>
          </div>
        </section>

        {/* Credits Balance */}
        <CreditsDisplay showDaily className="mx-auto max-w-sm" />

        {/* Admin Dashboard Button - only visible to admins */}
        {isAdmin && (
          <Card className="bg-white dark:bg-[#1A1A1C] border border-amber-200 dark:border-amber-800/50 rounded-[1.25rem]">
            <CardContent className={cn("p-4", isRTL && "font-[IBMPlexSansArabic]")}>
              <button
                onClick={() => navigate('/admin')}
                className={cn(
                  "flex items-center gap-3 w-full",
                  isRTL ? "flex-row-reverse text-right" : "text-left"
                )}
              >
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

        {/* Profile Form Card */}
        <Card className="bg-white dark:bg-[#1A1A1C] border border-border/50 rounded-[1.5rem] shadow-sm overflow-hidden">
          <CardContent className="p-5 space-y-5">
            {formFields.map((field) => {
              const Icon = field.icon;
              return (
                <div key={field.id} className="space-y-2">
                  <Label
                    htmlFor={field.id}
                    className={cn(
                      "flex items-center gap-2 text-sm font-semibold text-foreground/80",
                      isRTL && "flex-row-reverse font-[IBMPlexSansArabic]"
                    )}
                  >
                    <Icon className="h-4 w-4 text-primary/60" />
                    {field.label}
                    {!field.required && (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {t('profile.optional')}
                      </span>
                    )}
                  </Label>
                  <Input
                    id={field.id}
                    value={formData[field.id as keyof typeof formData]}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className={cn(
                      "h-12 rounded-xl bg-[#F5F5F7] dark:bg-[#121214] border-border/40 text-base focus:ring-2 focus:ring-primary/20 transition-all",
                      isRTL && "text-right font-[IBMPlexSansArabic]"
                    )}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "w-full gap-2 h-13 text-base font-semibold rounded-xl shadow-md",
            isRTL && "font-[IBMPlexSansArabic]"
          )}
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {t('profile.save')}
        </Button>

        {/* User Guide Section */}
        <Card className="bg-[#F0F0F2] dark:bg-[#18181A] border border-border/30 rounded-[1.5rem]">
          <CardContent className={cn("p-5 space-y-4", isRTL && "font-[IBMPlexSansArabic]")}>
            <h3 className={cn(
              "text-base font-bold text-foreground",
              isRTL ? "text-right font-[IBMPlexSansArabic]" : "font-[Inter]"
            )}>
              {isRTL ? 'دليل الاستخدام' : "Guide d'utilisation"}
            </h3>
            {[
              {
                icon: '🔍',
                titleFr: 'Analyse de documents',
                titleAr: 'تحليل الورق',
                descFr: 'Photographiez ou importez vos courriers pour une analyse instantanée par l\'IA.',
                descAr: 'صوّر أو ارفع جوابك وأنا هحلّله لك فوراً بالذكاء الاصطناعي.',
              },
              {
                icon: '⚖️',
                titleFr: 'Conseils juridiques',
                titleAr: 'استشارات قانونية',
                descFr: 'Posez vos questions sur vos droits, démarches et obligations en France.',
                descAr: 'اسأل عن حقوقك وإجراءاتك والتزاماتك في فرنسا.',
              },
              {
                icon: '💰',
                titleFr: 'Système de crédits',
                titleAr: 'نظام الرصيد',
                descFr: 'Vous recevez des crédits gratuits chaque jour pour utiliser les services.',
                descAr: 'بتاخد رصيد مجاني كل يوم عشان تستخدم الخدمات.',
              },
              {
                icon: '📋',
                titleFr: 'Historique',
                titleAr: 'السجل',
                descFr: 'Retrouvez toutes vos transactions et activités dans votre compte.',
                descAr: 'ارجع لكل معاملاتك ونشاطاتك في حسابك.',
              },
            ].map((item, i) => (
              <div key={i} className={cn(
                "flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-[#1A1A1C]",
                isRTL && "flex-row-reverse text-right"
              )}>
                <span className="text-xl mt-0.5 shrink-0">{item.icon}</span>
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-bold text-foreground">
                    {isRTL ? item.titleAr : item.titleFr}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isRTL ? item.descAr : item.descFr}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security Info Note */}
        <Card className="bg-white dark:bg-[#1A1A1C] border border-border/30 rounded-[1.25rem]">
          <CardContent className={cn(
            "p-4 text-center text-sm text-muted-foreground leading-relaxed",
            isRTL && "font-[IBMPlexSansArabic]"
          )}>
            {isRTL 
              ? '🔒 بياناتك محفوظة بأمان وبنستخدمها بس عشان نعملّك خطاباتك الإدارية'
              : '🔒 Vos données sont stockées en toute sécurité et utilisées uniquement pour générer vos courriers'
            }
          </CardContent>
        </Card>

        {/* API Key Settings - Admin only */}
        {isAdmin && (
          <>
            <Card className="bg-white dark:bg-[#1A1A1C] border border-border/30 rounded-[1.25rem]">
              <CardContent className={cn("p-4", isRTL && "font-[IBMPlexSansArabic]")}>
                <button
                  onClick={() => setShowApiKey(true)}
                  className={cn(
                    "flex items-center gap-3 w-full",
                    isRTL ? "flex-row-reverse text-right" : "text-left"
                  )}
                >
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">{isRTL ? 'مفتاح API للذكاء الاصطناعي' : 'Clé API IA'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? 'تحديث مفتاح OpenAI' : 'Mettre à jour la clé OpenAI'}</p>
                  </div>
                </button>
              </CardContent>
            </Card>
            <ApiKeySettingsModal open={showApiKey} onOpenChange={setShowApiKey} />
          </>
        )}

        {/* Log Out Button */}
        <Button
          variant="outline"
          onClick={handleSignOut}
          className={cn(
            "w-full gap-2 h-12 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive font-semibold",
            isRTL && "font-[IBMPlexSansArabic]"
          )}
        >
          <LogOut className="h-4 w-4" />
          {isRTL ? "اخرج" : "Se déconnecter"}
        </Button>

        {/* GDPR - Delete Account Section */}
        <DeleteAccountSection />
      </div>
    </div>
  );
};

export default ProfilePage;
