import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Settings, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useArtisanPricing, DEFAULT_CATALOG, type PriceCatalogItem } from '@/hooks/useArtisanPricing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORY_META: Record<string, { icon: string; labelFr: string; labelAr: string }> = {
  maconnerie: { icon: '🏗️', labelFr: 'Maçonnerie', labelAr: 'ماسونري' },
  peinture: { icon: '🎨', labelFr: 'Peinture', labelAr: 'بنتيرة' },
  carrelage: { icon: '🔲', labelFr: 'Carrelage / Sol', labelAr: 'كارلاج' },
  plomberie: { icon: '🔧', labelFr: 'Plomberie', labelAr: 'سباكة' },
  electricite: { icon: '⚡', labelFr: 'Électricité', labelAr: 'كهرباء' },
  menuiserie: { icon: '🚪', labelFr: 'Menuiserie', labelAr: 'نجارة' },
  toiture: { icon: '🏠', labelFr: 'Toiture', labelAr: 'سقف' },
  piscine: { icon: '🏊', labelFr: 'Piscine', labelAr: 'مسبح' },
  location: { icon: '🏗️', labelFr: 'Location Matériel', labelAr: 'إيجار معدات' },
  frais_chantier: { icon: '🧹', labelFr: 'Frais Chantier', labelAr: 'مصاريف الشانتي' },
};

const UNIT_LABELS: Record<string, string> = {
  m2: '€/m²',
  m3: '€/m³',
  ml: '€/ml',
  unit: '€/u',
  forfait: '€',
  day: '€/jour',
  m2_day: '€/m²/j',
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

  const updateItem = (code: string, field: 'material_price' | 'labor_price' | 'equipment_price' | 'total_price', value: number) => {
    setForm(prev => prev.map(item => {
      if (item.code !== code) return item;
      const updated = { ...item, [field]: value };
      if (field === 'material_price' || field === 'labor_price' || field === 'equipment_price') {
        updated.total_price = updated.material_price + updated.labor_price + updated.equipment_price;
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

  const categories = [...new Set(form.map(i => i.category))];
  const hasEquipment = (items: PriceCatalogItem[]) => items.some(i => i.equipment_price > 0);
  const isLocationCategory = (cat: string) => cat === 'location';

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
                {isFr ? `${form.length} postes de référence — Mat. / M.O. / Équip. / Total` : `${form.length} بند مرجعي — مواد / يد عاملة / معدات / إجمالي`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <p className={cn("text-xs text-muted-foreground leading-relaxed", isRTL && "text-right")}>
              {isFr
                ? '💡 Ces tarifs alimentent le Devis Intelligent. Le total se calcule automatiquement (Mat. + M.O. + Équip.).'
                : '💡 هذه التعريفة تغذي الدوفي الذكي. الإجمالي يُحسب تلقائيًا (مواد + يد عاملة + معدات).'}
            </p>
          </CardContent>
        </Card>

        {categories.map((cat) => {
          const meta = CATEGORY_META[cat] || { icon: '📋', labelFr: cat, labelAr: cat };
          const items = form.filter(i => i.category === cat);
          const showEquip = hasEquipment(items) || isLocationCategory(cat);

          return (
            <Card key={cat}>
              <CardContent className="p-4">
                <h3 className={cn(
                  "text-sm font-semibold mb-3 flex items-center gap-2",
                  isRTL && "flex-row-reverse text-right"
                )}>
                  <span>{meta.icon}</span>
                  {isFr ? meta.labelFr : meta.labelAr}
                  <span className="text-[10px] text-muted-foreground font-normal">({items.length})</span>
                </h3>

                <div className="space-y-3">
                  {/* Column headers */}
                  <div className={cn(
                    "grid gap-1 text-[10px] text-muted-foreground font-medium px-1",
                    showEquip ? "grid-cols-[1fr_50px_50px_50px_60px]" : "grid-cols-[1fr_55px_55px_60px]"
                  )}>
                    <div>{isFr ? 'Désignation' : 'التسمية'}</div>
                    <div className="text-center">{isFr ? 'Mat.' : 'مواد'}</div>
                    <div className="text-center">{isLocationCategory(cat) ? (isFr ? 'Tarif' : 'تعريفة') : (isFr ? 'M.O.' : 'يد عاملة')}</div>
                    {showEquip && <div className="text-center">{isFr ? 'Équip.' : 'معدات'}</div>}
                    <div className="text-center">{isFr ? 'Total' : 'إجمالي'}</div>
                  </div>

                  {items.map(item => {
                    const unitLabel = UNIT_LABELS[item.unit] || `€/${item.unit}`;
                    return (
                      <div key={item.code} className={cn(
                        "grid gap-1 items-center",
                        showEquip ? "grid-cols-[1fr_50px_50px_50px_60px]" : "grid-cols-[1fr_55px_55px_60px]"
                      )}>
                        <div className={cn("text-xs", isRTL && "text-right")}>
                          <span className="font-medium">{item.description}</span>
                          <span className="block text-[10px] text-muted-foreground">{item.code} · {unitLabel}</span>
                        </div>
                        <div>
                          <Input
                            type="number" min="0" step="1"
                            value={item.material_price}
                            onChange={(e) => updateItem(item.code, 'material_price', parseFloat(e.target.value) || 0)}
                            className="h-7 text-[11px] text-center px-1" dir="ltr"
                          />
                        </div>
                        <div>
                          <Input
                            type="number" min="0" step="1"
                            value={item.labor_price}
                            onChange={(e) => updateItem(item.code, 'labor_price', parseFloat(e.target.value) || 0)}
                            className="h-7 text-[11px] text-center px-1" dir="ltr"
                          />
                        </div>
                        {showEquip && (
                          <div>
                            <Input
                              type="number" min="0" step="1"
                              value={item.equipment_price}
                              onChange={(e) => updateItem(item.code, 'equipment_price', parseFloat(e.target.value) || 0)}
                              className="h-7 text-[11px] text-center px-1" dir="ltr"
                            />
                          </div>
                        )}
                        <div>
                          <div className="h-7 flex items-center justify-center text-[11px] font-bold text-primary bg-primary/5 rounded-md border border-primary/20">
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
