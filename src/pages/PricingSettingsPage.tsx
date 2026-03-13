import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Settings, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useArtisanPricing, DEFAULT_CATALOG, type PriceCatalogItem } from '@/hooks/useArtisanPricing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORY_META: Record<string, { icon: string; labelFr: string; labelAr: string }> = {
  peinture: { icon: '🎨', labelFr: 'Peinture', labelAr: 'بنتيرة' },
  placo: { icon: '🧱', labelFr: 'Placo', labelAr: 'بلاكو' },
  carrelage: { icon: '🔲', labelFr: 'Carrelage', labelAr: 'كارلاج' },
  parquet: { icon: '🪵', labelFr: 'Parquet', labelAr: 'باركيه' },
  plomberie: { icon: '🔧', labelFr: 'Plomberie', labelAr: 'سباكة' },
  electricite: { icon: '⚡', labelFr: 'Électricité', labelAr: 'كهرباء' },
  maconnerie: { icon: '🏗️', labelFr: 'Maçonnerie', labelAr: 'ماسونري' },
  piscine: { icon: '🏊', labelFr: 'Piscine', labelAr: 'مسبح' },
  general: { icon: '🧹', labelFr: 'Général', labelAr: 'عام' },
};

const UNIT_LABELS: Record<string, string> = {
  m2: '€/m²',
  m3: '€/m³',
  unit: '€/u',
  forfait: '€',
};

const PricingSettingsPage = () => {
  const { isRTL } = useLanguage();
  const isFr = !isRTL;
  const navigate = useNavigate();
  const { catalog, isLoading, isSaving, saveCatalog } = useArtisanPricing();
  const [form, setForm] = useState<PriceCatalogItem[]>(DEFAULT_CATALOG);

  useEffect(() => {
    if (!isLoading) setForm(catalog);
  }, [isLoading, catalog]);

  const updateItem = (code: string, field: 'material_price' | 'labor_price' | 'total_price', value: number) => {
    setForm(prev => prev.map(item => {
      if (item.code !== code) return item;
      const updated = { ...item, [field]: value };
      // Auto-calc total when material or labor changes
      if (field === 'material_price' || field === 'labor_price') {
        updated.total_price = updated.material_price + updated.labor_price;
      }
      return updated;
    }));
  };

  const handleSave = async () => {
    const ok = await saveCatalog(form);
    if (ok) {
      toast.success(isFr ? 'Tarifs sauvegardés ✓' : 'تم حفظ التعريفة ✓');
    } else {
      toast.error(isFr ? 'Erreur de sauvegarde' : 'خطأ في الحفظ');
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_CATALOG);
    toast.info(isFr ? 'Valeurs par défaut restaurées' : 'تم استعادة القيم الافتراضية');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Group by category
  const categories = [...new Set(form.map(i => i.category))];

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
                {isFr ? '23 postes de référence — Matériaux / Main d\'œuvre / Total' : '23 بند مرجعي — مواد / يد عاملة / إجمالي'}
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
                ? '💡 Ces tarifs alimentent le Devis Intelligent. Le total se calcule automatiquement (Matériaux + Main d\'œuvre).'
                : '💡 هذه التعريفة تغذي الدوفي الذكي. الإجمالي يُحسب تلقائيًا (مواد + يد عاملة).'}
            </p>
          </CardContent>
        </Card>

        {categories.map((cat) => {
          const meta = CATEGORY_META[cat] || { icon: '📋', labelFr: cat, labelAr: cat };
          const items = form.filter(i => i.category === cat);

          return (
            <Card key={cat}>
              <CardContent className="p-4">
                <h3 className={cn(
                  "text-sm font-semibold mb-3 flex items-center gap-2",
                  isRTL && "flex-row-reverse text-right"
                )}>
                  <span>{meta.icon}</span>
                  {isFr ? meta.labelFr : meta.labelAr}
                </h3>

                <div className="space-y-3">
                  {/* Column headers */}
                  <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground font-medium px-1">
                    <div className="col-span-4">{isFr ? 'Désignation' : 'التسمية'}</div>
                    <div className="col-span-2 text-center">{isFr ? 'Mat.' : 'مواد'}</div>
                    <div className="col-span-3 text-center">{isFr ? 'M.O.' : 'يد عاملة'}</div>
                    <div className="col-span-3 text-center">{isFr ? 'Total' : 'إجمالي'}</div>
                  </div>

                  {items.map(item => {
                    const unitLabel = UNIT_LABELS[item.unit] || `€/${item.unit}`;
                    return (
                      <div key={item.code} className="grid grid-cols-12 gap-1 items-center">
                        <div className={cn("col-span-4 text-xs", isRTL && "text-right")}>
                          <span className="font-medium">{item.description}</span>
                          <span className="block text-[10px] text-muted-foreground">{item.code} · {unitLabel}</span>
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={item.material_price}
                            onChange={(e) => updateItem(item.code, 'material_price', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-center px-1"
                            dir="ltr"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={item.labor_price}
                            onChange={(e) => updateItem(item.code, 'labor_price', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-center px-1"
                            dir="ltr"
                          />
                        </div>
                        <div className="col-span-3">
                          <div className="h-8 flex items-center justify-center text-xs font-bold text-primary bg-primary/5 rounded-md border border-primary/20">
                            {item.total_price}€
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleReset} className="flex-1 gap-2">
            <RotateCcw className="h-4 w-4" />
            {isFr ? 'Par défaut' : 'الافتراضية'}
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
