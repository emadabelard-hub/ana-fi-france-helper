import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

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

const UNIT_OPTIONS = [
  { value: 'h', label_fr: 'Heure(s)', label_ar: 'ساعة' },
  { value: 'm²', label_fr: 'm²', label_ar: 'متر مربع' },
  { value: 'ml', label_fr: 'ml (mètre linéaire)', label_ar: 'متر طولي' },
  { value: 'u', label_fr: 'Unité(s)', label_ar: 'وحدة' },
  { value: 'forfait', label_fr: 'Forfait', label_ar: 'مقطوعية' },
  { value: 'jour', label_fr: 'Jour(s)', label_ar: 'يوم' },
];

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
    designation_fr: 'Frais de déplacement', 
    designation_ar: 'مصاريف تنقل',
    unit: 'forfait',
    unitPrice: 30 
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
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const LineItemEditor = ({ items, onItemsChange }: LineItemEditorProps) => {
  const { isRTL } = useLanguage();

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
      
      return updated;
    });
    
    onItemsChange(updatedItems);
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
      unit: 'u',
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
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Description (FR)
                      </Label>
                      <Input
                        value={item.designation_fr}
                        onChange={(e) => updateItem(item.id, 'designation_fr', e.target.value)}
                        placeholder="Ex: Main d'œuvre - 5ème étage"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
                        {isRTL ? 'الوصف (عربي)' : 'Description (AR)'}
                      </Label>
                      <Input
                        value={item.designation_ar}
                        onChange={(e) => updateItem(item.id, 'designation_ar', e.target.value)}
                        placeholder="مثال: مصنعية - الدور الخامس"
                        className={cn("text-sm", isRTL && "text-right font-cairo")}
                        dir="rtl"
                      />
                    </div>
                  </div>
                  
                  {/* Numbers Row */}
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {isRTL ? 'الكمية' : 'Quantité'}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {isRTL ? 'الوحدة' : 'Unité'}
                      </Label>
                      <Select
                        value={item.unit}
                        onValueChange={(value) => updateItem(item.id, 'unit', value)}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {isRTL ? option.label_ar : option.label_fr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        {isRTL ? 'سعر الوحدة €' : 'Prix Unit. €'}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="text-sm"
                      />
                    </div>
                    <div>
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
        onClick={addFreeItem}
        className={cn("w-full border-dashed", isRTL && "font-cairo")}
      >
        <Plus className="h-4 w-4 mr-2" />
        {isRTL ? '+ إضافة سطر حر' : '+ Ajouter une ligne libre'}
      </Button>

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
