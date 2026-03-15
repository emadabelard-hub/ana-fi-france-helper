import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical, Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import UnitGuideModal, { UnitGuideButton } from './UnitGuideModal';

export interface LineItem {
  id: string;
  designation_fr: string;
  designation_ar: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface LineItemEditorProps {
  items: LineItem[];
  onItemsChange: (items: LineItem[]) => void;
}

// Franco-Arabe unit options with phonetic transliteration
const UNIT_OPTIONS = [
  { value: 'm²', label_display: 'm² - متر كاري', label_fr: 'm²', label_ar: 'متر كاري' },
  { value: 'ml', label_display: 'ml - متر طولي', label_fr: 'ml', label_ar: 'متر طولي' },
  { value: 'u', label_display: 'U - أونيتيه', label_fr: 'Unité', label_ar: 'أونيتيه' },
  { value: 'h', label_display: 'H - ساعة', label_fr: 'Heure', label_ar: 'ساعة' },
  { value: 'jour', label_display: 'J - يوم', label_fr: 'Jour', label_ar: 'يوم' },
  { value: 'forfait', label_display: 'F - فورفيه', label_fr: 'Forfait', label_ar: 'فورفيه' },
  { value: 'ens', label_display: 'Ens - أنسومبل', label_fr: 'Ensemble', label_ar: 'أنسومبل' },
];

// Storage key for persistence when the component is visible (retain line items on refresh)
const LINE_ITEMS_STORAGE_KEY = 'lineItemEditor_items_v1';

// Match strict catalog codes like MC001, PB001, CR001, MAC01, PLM01, etc.
const CODE_REGEX = /\b([A-Z]{2,4}\d{2,3})\b/i;

const PRESET_ITEMS = [
  { 
    designation_fr: "Main d'œuvre", 
    designation_ar: 'مصنعية',
    unit: 'h',
    unitPrice: 35 
  },
  { 
    designation_fr: 'Fourniture de matériaux', 
    designation_ar: 'توريد مواد',
    unit: 'forfait',
    unitPrice: 0 
  },
  { 
    designation_fr: 'Peinture', 
    designation_ar: 'بانتيرة (دهان)',
    unit: 'm²',
    unitPrice: 25 
  },
  { 
    designation_fr: 'Enduit', 
    designation_ar: 'اندوي (معجون)',
    unit: 'm²',
    unitPrice: 15 
  },
  { 
    designation_fr: 'Pose de carrelage', 
    designation_ar: 'تركيب سيراميك',
    unit: 'm²',
    unitPrice: 40 
  },
  { 
    designation_fr: 'Plomberie', 
    designation_ar: 'بلومبري (سباكة)',
    unit: 'h',
    unitPrice: 45 
  },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const LineItemEditor = ({ items, onItemsChange }: LineItemEditorProps) => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [suggestingPriceFor, setSuggestingPriceFor] = useState<string | null>(null);
  const [translatingFor, setTranslatingFor] = useState<string | null>(null);
  // Track temporary string values for quantity and price inputs
  const [tempValues, setTempValues] = useState<Record<string, { quantity?: string; unitPrice?: string }>>({});
  // Track items that need translation before adding
  const [pendingTranslation, setPendingTranslation] = useState<Set<string>>(new Set());
  // Unit guide modal state
  const [showUnitGuide, setShowUnitGuide] = useState(false);

  // Persist line items locally so refresh/touch doesn't wipe the current work
  const hasLoadedFromStorageRef = useRef(false);

  useEffect(() => {
    if (hasLoadedFromStorageRef.current) return;
    hasLoadedFromStorageRef.current = true;

    try {
      const raw = localStorage.getItem(LINE_ITEMS_STORAGE_KEY);
      if (!raw) return;
      const stored: LineItem[] = JSON.parse(raw);
      if (stored && stored.length > 0) {
        // Only restore if the parent hasn't already populated meaningful items
        const hasMeaningfulItems = items.some(i => i.designation_fr.trim() || i.designation_ar.trim());
        if (!hasMeaningfulItems) {
          onItemsChange(stored);
        }
      }
    } catch {
      // Ignore failures (e.g., invalid JSON)
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LINE_ITEMS_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage failures (e.g., Safari private mode)
    }
  }, [items]);

  const extractLineItemCode = (text: string) => {
    const match = text?.match(CODE_REGEX);
    return match ? match[1].toUpperCase() : null;
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    const updatedItems = items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Auto-calculate total when quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) : item.quantity;
        const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
        updated.total = Math.round(qty * price * 100) / 100;
      }

      // Force known item codes to use fixed prices (no hallucinated defaults)
      if (field === 'designation_fr' || field === 'designation_ar') {
        const code = extractLineItemCode(String(updated.designation_fr || updated.designation_ar || ''));
        if (code) {
          const override = LINE_ITEM_CODE_OVERRIDES[code];
          if (override !== undefined) {
            const qty = Number(updated.quantity) || 0;
            updated.unitPrice = override;
            updated.total = Math.round(qty * override * 100) / 100;
          }
        }
      }
      
      return updated;
    });
    
    onItemsChange(updatedItems);
  };

  const applyCodePricing = (item: LineItem, price: number) => {
    updateItem(item.id, 'unitPrice', price);
  };

  const fetchPriceFromCatalog = async (code: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('artisan_price_catalog')
        .select('total_price')
        .eq('code', code)
        .maybeSingle();

      if (error) throw error;
      return data?.total_price ?? 0;
    } catch (e) {
      console.warn('Price catalog lookup failed:', e);
      return 0;
    }
  };

  const lookupAndApplyCodePrice = async (item: LineItem) => {
    const code = extractLineItemCode(item.designation_fr || item.designation_ar || '');
    if (!code) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'أدخل رمزًا (مثل PNT001) للحصول على السعر' : 'Entrez un code (ex : PNT001) pour obtenir le prix',
      });
      return;
    }

    const override = LINE_ITEM_CODE_OVERRIDES[code];
    if (override !== undefined) {
      applyCodePricing(item, override);
      return;
    }

    setSuggestingPriceFor(item.id);
    try {
      const price = await fetchPriceFromCatalog(code);
      applyCodePricing(item, price);
      if (price === 0) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Erreur',
          description: isRTL ? 'لم أجد السعر في الكتالوج' : 'Prix introuvable dans le catalogue',
        });
      } else {
        toast({
          title: isRTL ? '💡 تم ضبط السعر' : '💡 Prix appliqué',
          description: isRTL ? `السعر: ${price}€` : `Prix : ${price}€`,
        });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل البحث عن السعر' : 'Échec de la recherche du prix',
      });
    } finally {
      setSuggestingPriceFor(null);
    }
  };

  // Handle focus - select all text
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  // Handle change for numeric fields - allow empty string while typing
  const handleNumericChange = (id: string, field: 'quantity' | 'unitPrice', value: string) => {
    setTempValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  // Handle blur - validate and set final value
  const handleNumericBlur = (id: string, field: 'quantity' | 'unitPrice', defaultValue: number) => {
    const tempValue = tempValues[id]?.[field];
    const numValue = tempValue === undefined || tempValue === '' ? defaultValue : parseFloat(tempValue) || defaultValue;
    
    // Clear temp value
    setTempValues(prev => {
      const newTempValues = { ...prev };
      if (newTempValues[id]) {
        delete newTempValues[id][field];
        if (Object.keys(newTempValues[id]).length === 0) {
          delete newTempValues[id];
        }
      }
      return newTempValues;
    });
    
    updateItem(id, field, numValue);
  };

  // Auto-translate Arabic to French
  const handleArabicBlur = async (item: LineItem) => {
    const arabicText = item.designation_ar?.trim();
    
    // Only translate if there's Arabic text
    if (!arabicText) return;
    
    setTranslatingFor(item.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('invoice-mentor', {
        body: {
          action: 'translate_to_french',
          text: arabicText,
        },
      });

      if (error) throw error;

      if (data?.translation) {
        updateItem(item.id, 'designation_fr', data.translation);
        lookupAndApplyCodePrice({ ...item, designation_fr: data.translation });
        toast({
          title: isRTL ? '✨ تم الترجمة!' : '✨ Traduit!',
          description: isRTL 
            ? `تم ترجمة "${arabicText.substring(0, 20)}..." للفرنسية`
            : `"${arabicText.substring(0, 20)}..." traduit en français`,
        });
      }
    } catch (error) {
      console.error('Translation error:', error);
      // Silently fail - user can still type manually
    } finally {
      setTranslatingFor(null);
      // Remove from pending translation set
      setPendingTranslation(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Mark item as needing translation when Arabic field changes
  const handleArabicChange = (id: string, value: string) => {
    updateItem(id, 'designation_ar', value);
    // If there's Arabic text and French is empty, mark as pending
    const item = items.find(i => i.id === id);
    if (value.trim() && (!item?.designation_fr || item.designation_fr.trim() === '')) {
      setPendingTranslation(prev => new Set(prev).add(id));
    }
  };

  // Force translation before adding - called when clicking the add button
  const forceTranslationIfNeeded = async () => {
    // Find items with Arabic text but no French translation
    const itemsNeedingTranslation = items.filter(
      item => item.designation_ar?.trim() && !item.designation_fr?.trim()
    );
    
    if (itemsNeedingTranslation.length === 0) return true;
    
    // Translate all pending items
    for (const item of itemsNeedingTranslation) {
      await handleArabicBlur(item);
    }
    
    return true;
  };

  // Get display value for numeric fields
  const getNumericDisplayValue = (id: string, field: 'quantity' | 'unitPrice', actualValue: number): string => {
    const tempValue = tempValues[id]?.[field];
    return tempValue !== undefined ? tempValue : String(actualValue);
  };

  const suggestPrice = async (item: LineItem) => {
    if (!item.designation_fr.trim()) {
      toast({
        variant: "destructive",
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'اكتب وصف الشغل الأول' : 'Entrez d\'abord une description',
      });
      return;
    }

    setSuggestingPriceFor(item.id);
    try {
      await lookupAndApplyCodePrice(item);
    } finally {
      setSuggestingPriceFor(null);
    }
  };

  const addPresetItem = (preset: typeof PRESET_ITEMS[0]) => {
    const newItem: LineItem = {
      id: generateId(),
      designation_fr: preset.designation_fr,
      designation_ar: preset.designation_ar,
      quantity: 1,
      unit: preset.unit,
      unitPrice: preset.unitPrice,
      total: preset.unitPrice,
    };
    onItemsChange([...items, newItem]);
  };

  const addFreeItem = () => {
    const newItem: LineItem = {
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: 1,
      unit: 'm²',
      unitPrice: 0,
      total: 0,
    };
    onItemsChange([...items, newItem]);
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-4">
      {/* Unit Guide Modal */}
      <UnitGuideModal open={showUnitGuide} onOpenChange={setShowUnitGuide} />

      {/* Quick Add Presets */}
      <div className="space-y-2">
        <Label className={cn("text-sm font-medium", isRTL && "font-cairo text-right block")}>
          {isRTL ? '➕ إضافة سريعة' : '➕ Ajout rapide'}
        </Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_ITEMS.map((preset, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => addPresetItem(preset)}
              className={cn("text-xs", isRTL && "font-cairo")}
            >
              {isRTL ? preset.designation_ar : preset.designation_fr}
            </Button>
          ))}
        </div>
      </div>

      {/* Line Items List */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <Card key={item.id} className="relative">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0 cursor-grab" />
                
                <div className="flex-1 space-y-3">
                  {/* Description Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Arabic Input - PRIMARY INPUT (Step 1) */}
                    <div className="order-2 md:order-1">
                      <Label className={cn("text-xs font-medium text-foreground", isRTL && "font-cairo block text-right")}>
                        {isRTL ? '🪄 اكتب بالعربي وانا اترجم' : "🪄 Écris en arabe et je traduis"}
                      </Label>
                      <Textarea
                        value={item.designation_ar}
                        onChange={(e) => handleArabicChange(item.id, e.target.value)}
                        onBlur={() => handleArabicBlur(item)}
                        placeholder={isRTL 
                          ? "مثال: زليج / بانتير / كليما..." 
                          : "Ex: zelij / bantoura / clima..."
                        }
                        className={cn(
                          "text-sm min-h-[60px] resize-none",
                          isRTL && "text-right font-cairo"
                        )}
                        dir="rtl"
                      />
                      <p className={cn(
                        "text-xs text-muted-foreground mt-1",
                        isRTL && "font-cairo text-right"
                      )}>
                        {isRTL 
                          ? '⬆️ لما تخلص، هيظهر بالفرنسي فوق تلقائي'
                          : '⬆️ Quand tu finis, ça apparaît en français au-dessus'}
                      </p>
                      {translatingFor === item.id && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs text-primary mt-1",
                          isRTL && "flex-row-reverse font-cairo"
                        )}>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{isRTL ? 'جاري الترجمة...' : 'Traduction en cours...'}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* French Output - RESULT (Step 2) */}
                    <div className="order-1 md:order-2">
                      <Label className={cn("text-xs font-medium text-foreground flex items-center gap-1", isRTL && "font-cairo flex-row-reverse")}>
                        {isRTL ? '📄 الوصف بالفرنسية (Désignation)' : '📄 Désignation (Français)'}
                        {translatingFor === item.id && (
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        )}
                      </Label>
                      <Textarea
                        value={item.designation_fr}
                        onChange={(e) => updateItem(item.id, 'designation_fr', e.target.value)}
                        onBlur={() => lookupAndApplyCodePrice(item)}
                        placeholder={isRTL ? "Peinture salon / Pose carrelage..." : "Peinture salon / Pose carrelage..."}
                        className={cn(
                          "text-sm",
                          // Highlight if Arabic exists but French is empty
                          item.designation_ar?.trim() && !item.designation_fr?.trim() && "border-destructive/50 bg-destructive/5"
                        )}
                        rows={2}
                      />
                      {item.designation_ar?.trim() && !item.designation_fr?.trim() ? (
                        <p className={cn("text-xs text-destructive mt-1 flex items-center gap-1", isRTL && "font-cairo flex-row-reverse")}>
                          <AlertCircle className="h-3 w-3" />
                          {isRTL ? 'استنى الترجمة أو اكتب بنفسك' : 'Traduction en cours ou écrivez vous-même'}
                        </p>
                      ) : (
                        <p className={cn("text-xs text-muted-foreground mt-1", isRTL && "font-cairo text-right")}>
                          {isRTL ? '✅ ده اللي هيظهر في الفاتورة' : '✅ C\'est ce qui apparaîtra sur la facture'}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Numbers Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {isRTL ? 'الكمية' : 'Quantité'}
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={getNumericDisplayValue(item.id, 'quantity', item.quantity)}
                        onFocus={handleFocus}
                        onChange={(e) => handleNumericChange(item.id, 'quantity', e.target.value)}
                        onBlur={() => handleNumericBlur(item.id, 'quantity', 1)}
                        className="text-sm"
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <div className={cn(
                        "flex items-center justify-between gap-1 mb-1",
                        isRTL && "flex-row-reverse"
                      )}>
                        <Label className="text-xs text-muted-foreground">
                          {isRTL ? 'الوحدة' : 'Unité'}
                        </Label>
                        {index === 0 && (
                          <UnitGuideButton onClick={() => setShowUnitGuide(true)} />
                        )}
                      </div>
                      <Select
                        value={item.unit}
                        onValueChange={(value) => updateItem(item.id, 'unit', value)}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                          {UNIT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label_display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-xs text-muted-foreground">
                        {isRTL ? 'سعر الوحدة €' : 'Prix Unit. €'}
                      </Label>
                      <div className="flex gap-1">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={getNumericDisplayValue(item.id, 'unitPrice', item.unitPrice)}
                          onFocus={handleFocus}
                          onChange={(e) => handleNumericChange(item.id, 'unitPrice', e.target.value)}
                          onBlur={() => handleNumericBlur(item.id, 'unitPrice', 0)}
                          className="text-sm flex-1"
                          placeholder="0"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 text-primary hover:bg-primary/10"
                          onClick={() => suggestPrice(item)}
                          disabled={suggestingPriceFor === item.id}
                          title={isRTL ? 'اقترح سعر' : 'Suggérer un prix'}
                        >
                          {suggestingPriceFor === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Label className="text-xs text-muted-foreground">
                        {isRTL ? 'الإجمالي' : 'Total'}
                      </Label>
                      <div className="h-10 px-3 py-2 bg-muted rounded-md text-sm font-medium flex items-center">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Free Item Button */}
      <Button
        variant="outline"
        onClick={async () => {
          // First force any pending translations
          await forceTranslationIfNeeded();
          // Then add the new item
          addFreeItem();
        }}
        className={cn("w-full border-dashed border-2 py-6", isRTL && "font-cairo")}
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        {isRTL ? '➕ أضف سطر جديد' : '➕ Ajouter une nouvelle ligne'}
      </Button>
      
      {/* Explanation text under button */}
      <p className={cn(
        "text-xs text-muted-foreground text-center -mt-2",
        isRTL && "font-cairo"
      )}>
        {isRTL 
          ? '👆 اكتب بالعربي في الخانة، وهيظهر بالفرنسي تلقائي' 
          : '👆 Écrivez en arabe, ça se traduit automatiquement en français'}
      </p>

      {/* Grand Total */}
      {items.length > 0 && (
        <div className={cn(
          "flex justify-between items-center p-4 bg-primary/10 rounded-lg",
          isRTL && "flex-row-reverse"
        )}>
          <span className={cn("font-medium", isRTL && "font-cairo")}>
            {isRTL ? '💰 المجموع الكلي (HT):' : '💰 Total HT:'}
          </span>
          <span className="text-xl font-bold text-primary">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      )}
    </div>
  );
};

export default LineItemEditor;
