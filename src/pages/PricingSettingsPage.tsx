import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Settings, Paintbrush, Hammer, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useArtisanPricing, DEFAULT_PRICING, type ArtisanPricing } from '@/hooks/useArtisanPricing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PriceFieldProps {
  label: string;
  labelAr: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  isRTL: boolean;
}

const PriceField = ({ label, labelAr, value, onChange, unit, isRTL }: PriceFieldProps) => (
  <div className="space-y-1.5">
    <Label className={cn("text-sm font-medium", isRTL && "text-right block")}>
      {isRTL ? labelAr : label}
      <span className="text-muted-foreground text-xs ml-1">({unit})</span>
    </Label>
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="0"
        step="0.5"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-28 text-center font-semibold"
        dir="ltr"
      />
      <span className="text-sm text-muted-foreground">€</span>
    </div>
  </div>
);

const PricingSettingsPage = () => {
  const { isRTL } = useLanguage();
  const isFr = !isRTL;
  const navigate = useNavigate();
  const { pricing, isLoading, isSaving, savePricing } = useArtisanPricing();
  const [form, setForm] = useState<ArtisanPricing>(DEFAULT_PRICING);

  useEffect(() => {
    if (!isLoading) setForm(pricing);
  }, [isLoading, pricing]);

  const update = (key: keyof ArtisanPricing, value: number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const ok = await savePricing(form);
    if (ok) {
      toast.success(isFr ? 'Tarifs sauvegardés ✓' : 'تم حفظ التعريفة ✓');
    } else {
      toast.error(isFr ? 'Erreur de sauvegarde' : 'خطأ في الحفظ');
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_PRICING);
    toast.info(isFr ? 'Valeurs par défaut restaurées' : 'تم استعادة القيم الافتراضية');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sections = [
    {
      icon: '🖌️',
      title: isFr ? 'Enduit' : 'أندوي (Enduit)',
      fields: [
        { key: 'enduit_full' as const, label: 'Fourniture + Pose', labelAr: 'مع المواد', unit: '€/m²' },
        { key: 'enduit_labor' as const, label: 'Main d\'œuvre seule', labelAr: 'يد عاملة فقط', unit: '€/m²' },
      ],
    },
    {
      icon: '🎨',
      title: isFr ? 'Peinture Mur' : 'بنتيرة الحيطان',
      fields: [
        { key: 'peinture_mur_full' as const, label: 'Fourniture + Pose', labelAr: 'مع المواد', unit: '€/m²' },
        { key: 'peinture_mur_labor' as const, label: 'Main d\'œuvre seule', labelAr: 'يد عاملة فقط', unit: '€/m²' },
      ],
    },
    {
      icon: '⬆️',
      title: isFr ? 'Peinture Plafond' : 'بنتيرة السقف',
      fields: [
        { key: 'peinture_plafond_full' as const, label: 'Fourniture + Pose', labelAr: 'مع المواد', unit: '€/m²' },
        { key: 'peinture_plafond_labor' as const, label: 'Main d\'œuvre seule', labelAr: 'يد عاملة فقط', unit: '€/m²' },
      ],
    },
    {
      icon: '🪟',
      title: isFr ? 'Fenêtres / Menuiseries' : 'شبابيك / Menuiseries',
      fields: [
        { key: 'fenetre_full' as const, label: 'Fourniture + Pose', labelAr: 'مع المواد', unit: '€/u' },
        { key: 'fenetre_labor' as const, label: 'Main d\'œuvre seule', labelAr: 'يد عاملة فقط', unit: '€/u' },
      ],
    },
    {
      icon: '🧹',
      title: isFr ? 'Nettoyage Chantier' : 'نيتواياج الشانتي',
      fields: [
        { key: 'nettoyage_forfait' as const, label: 'Forfait', labelAr: 'فورفي (Forfait)', unit: '€' },
      ],
    },
    {
      icon: '🔧',
      title: isFr ? 'Préparation' : 'تحضير',
      fields: [
        { key: 'sous_couche_full' as const, label: 'Sous-couche', labelAr: 'سوكوش', unit: '€/m²' },
        { key: 'poncage_full' as const, label: 'Ponçage', labelAr: 'بونساج', unit: '€/m²' },
      ],
    },
  ];

  return (
    <div className={cn("min-h-screen bg-background pb-24", isRTL && "font-cairo")} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/10 to-background px-4 pt-5 pb-4">
        <div className="max-w-lg mx-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3">
            <ArrowLeft className={cn("h-4 w-4", isRTL && "rotate-180")} />
            <span className="ml-1">{isFr ? 'Retour' : 'رجوع'}</span>
          </Button>
          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-xl font-bold text-foreground", isRTL && "text-right")}>
                {isFr ? 'Réglages Tarifs' : 'إعدادات التعريفة'}
              </h1>
              <p className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>
                {isFr ? 'Personnalisez vos prix de référence' : 'خصّص أسعارك المرجعية'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Info banner */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <p className={cn("text-xs text-muted-foreground leading-relaxed", isRTL && "text-right")}>
              {isFr
                ? '💡 Ces tarifs seront utilisés automatiquement par le Devis Intelligent pour calculer vos prix. Modifiez-les selon vos habitudes.'
                : '💡 هذه التعريفة ستُستخدم تلقائيًا من طرف الدوفي الذكي لحساب أسعارك. عدّلها حسب عاداتك.'}
            </p>
          </CardContent>
        </Card>

        {sections.map((section, idx) => (
          <Card key={idx}>
            <CardContent className="p-4">
              <h3 className={cn(
                "text-sm font-semibold mb-3 flex items-center gap-2",
                isRTL && "flex-row-reverse text-right"
              )}>
                <span>{section.icon}</span>
                {section.title}
              </h3>
              <div className={cn("grid gap-4", section.fields.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {section.fields.map(field => (
                  <PriceField
                    key={field.key}
                    label={field.label}
                    labelAr={field.labelAr}
                    value={form[field.key]}
                    onChange={(v) => update(field.key, v)}
                    unit={field.unit}
                    isRTL={isRTL}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            {isFr ? 'Valeurs par défaut' : 'القيم الافتراضية'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1 gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isFr ? 'Sauvegarder' : 'حفظ'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PricingSettingsPage;
