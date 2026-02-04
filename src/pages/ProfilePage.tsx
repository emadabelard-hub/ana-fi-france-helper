import { useState, useEffect } from 'react';
import { Save, LogOut, User, Loader2, MapPin, Phone, CreditCard, IdCard, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/auth/AuthModal';
import DeleteAccountSection from '@/components/profile/DeleteAccountSection';
import CreditsDisplay from '@/components/shared/CreditsDisplay';

const ProfilePage = () => {
  const { t, isRTL } = useLanguage();
  const { user, signOut } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  if (!user) {
    return (
      <div className="py-6 space-y-6">
        <section className={cn("text-center space-y-4", isRTL && "font-cairo")}>
          <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('profile.title')}
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {isRTL 
              ? "سجل الدخول لحفظ معلوماتك الشخصية واستخدامها في الرسائل الإدارية"
              : "Connectez-vous pour sauvegarder vos informations et les utiliser dans vos courriers administratifs"}
          </p>
          <Button onClick={() => setShowAuthModal(true)} className="mt-4">
            {isRTL ? "تسجيل الدخول" : "Se connecter"}
          </Button>
        </section>
        <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const formFields = [
    {
      id: 'full_name',
      label: t('profile.fullName'),
      icon: User,
      placeholder: isRTL ? 'أدخل اسمك الكامل' : 'Entrez votre nom complet',
      required: true,
    },
    {
      id: 'address',
      label: t('profile.address'),
      icon: MapPin,
      placeholder: isRTL ? 'أدخل عنوانك الكامل' : 'Entrez votre adresse complète',
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
    <div className="py-6 space-y-6">
      {/* Credits Balance */}
      <CreditsDisplay showDaily className="mx-auto max-w-sm" />

      {/* Title */}
      <section className={cn("text-center", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {t('profile.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {user.email}
        </p>
      </section>

      {/* Profile Form */}
      <Card>
        <CardContent className="p-4 space-y-5">
          {formFields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.id} className="space-y-2">
                <Label
                  htmlFor={field.id}
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium",
                    isRTL && "flex-row-reverse font-cairo"
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {field.label}
                  {!field.required && (
                    <span className="text-xs text-muted-foreground">
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
                    "h-11",
                    isRTL && "text-right font-cairo"
                  )}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className={cn("w-full gap-2 h-12", isRTL && "font-cairo")}
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {t('profile.save')}
        </Button>

        <Button
          variant="outline"
          onClick={handleSignOut}
          className={cn("w-full gap-2", isRTL && "font-cairo")}
        >
          <LogOut className="h-4 w-4" />
          {isRTL ? "تسجيل الخروج" : "Se déconnecter"}
        </Button>
      </div>

      {/* Info Note */}
      <Card className="bg-accent/50 border-accent">
        <CardContent className={cn(
          "p-4 text-center text-sm text-muted-foreground",
          isRTL && "font-cairo"
        )}>
          {isRTL 
            ? '🔒 بياناتك محفوظة بشكل آمن وتُستخدم فقط لإنشاء رسائلك الإدارية'
            : '🔒 Vos données sont stockées en toute sécurité et utilisées uniquement pour générer vos courriers'
          }
        </CardContent>
      </Card>

      {/* GDPR - Delete Account Section */}
      <DeleteAccountSection />
    </div>
  );
};

export default ProfilePage;
