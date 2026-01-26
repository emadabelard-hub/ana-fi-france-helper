import { useState } from 'react';
import { Save, User, MapPin, Phone, CreditCard, IdCard, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ProfilePage = () => {
  const { t, isRTL } = useLanguage();
  const [profile, setProfile] = useState({
    fullName: '',
    address: '',
    phone: '',
    cafNumber: '',
    foreignerNumber: '',
    socialSecurity: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Save to localStorage for now - will be replaced with Supabase
    localStorage.setItem('ana-fi-france-profile', JSON.stringify(profile));
    toast.success(isRTL ? 'تم حفظ الملف الشخصي بنجاح' : 'Profil enregistré avec succès');
  };

  // Load saved profile on mount
  useState(() => {
    const saved = localStorage.getItem('ana-fi-france-profile');
    if (saved) {
      setProfile(JSON.parse(saved));
    }
  });

  const formFields = [
    {
      id: 'fullName',
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
      id: 'cafNumber',
      label: t('profile.cafNumber'),
      icon: CreditCard,
      placeholder: isRTL ? 'رقم المستفيد من CAF' : 'Numéro d\'allocataire CAF',
      required: false,
    },
    {
      id: 'foreignerNumber',
      label: t('profile.foreignerNumber'),
      icon: IdCard,
      placeholder: isRTL ? 'رقم بطاقة الإقامة' : 'Numéro de carte de séjour',
      required: false,
    },
    {
      id: 'socialSecurity',
      label: t('profile.socialSecurity'),
      icon: Shield,
      placeholder: isRTL ? 'رقم الضمان الاجتماعي' : 'Numéro de sécurité sociale',
      required: false,
    },
  ];

  return (
    <div className="py-6 space-y-6">
      {/* Title */}
      <section className={cn("text-center", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {t('profile.title')}
        </h1>
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
                  value={profile[field.id as keyof typeof profile]}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  className={cn(
                    "h-11",
                    isRTL && "text-right font-cairo"
                  )}
                />
              </div>
            );
          })}

          <Button
            onClick={handleSave}
            className={cn(
              "w-full h-12 gap-2 text-base mt-4",
              isRTL && "font-cairo"
            )}
          >
            <Save className="h-5 w-5" />
            {t('profile.save')}
          </Button>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default ProfilePage;
