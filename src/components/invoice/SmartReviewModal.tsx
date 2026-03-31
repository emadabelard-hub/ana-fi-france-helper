import { useState } from 'react';
import { AlertTriangle, Check, Plus, X, FileText, Coins } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { InvoiceData } from './InvoiceDisplay';

interface SuggestedAddon {
  id: string;
  label_fr: string;
  label_ar: string;
  icon: string;
  defaultPrice: number;
  price: number;
  selected: boolean;
  isParking?: boolean;
}

interface SmartReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceData: InvoiceData;
  workSiteAddress: string;
  onConfirm: (addons: SuggestedAddon[]) => void;
  onCancel: () => void;
  creditCost: number;
}

// Major French city centers that typically require parking fees
const HIGH_DENSITY_AREAS = [
  'paris', '75001', '75002', '75003', '75004', '75005', '75006', '75007', '75008', 
  '75009', '75010', '75011', '75012', '75013', '75014', '75015', '75016', '75017', 
  '75018', '75019', '75020',
  'lyon', '69001', '69002', '69003', '69004', '69005', '69006', '69007', '69008', '69009',
  'marseille', '13001', '13002', '13003', '13004', '13005', '13006', '13007', '13008',
  'toulouse', '31000', '31100', '31200', '31300', '31400', '31500',
  'nice', '06000', '06100', '06200', '06300',
  'nantes', '44000', '44100', '44200', '44300',
  'montpellier', '34000', '34070', '34080', '34090',
  'bordeaux', '33000', '33100', '33200', '33300',
  'lille', '59000', '59800',
  'strasbourg', '67000', '67100', '67200',
];

const detectHighDensityArea = (address: string): boolean => {
  const normalizedAddress = address.toLowerCase().trim();
  return HIGH_DENSITY_AREAS.some(area => normalizedAddress.includes(area));
};

const SmartReviewModal = ({
  open,
  onOpenChange,
  invoiceData,
  workSiteAddress,
  onConfirm,
  onCancel,
  creditCost,
}: SmartReviewModalProps) => {
  const { isRTL } = useLanguage();
  const isHighDensity = detectHighDensityArea(workSiteAddress);

  // Initialize suggested addons
  const [addons, setAddons] = useState<SuggestedAddon[]>(() => {
    const items: SuggestedAddon[] = [];
    
    // Check if items already include these costs
    const hasTravel = invoiceData.items.some(item => 
      item.designation_fr.toLowerCase().includes('déplacement') || 
      item.designation_fr.toLowerCase().includes('carburant')
    );
    const hasWaste = invoiceData.items.some(item => 
      item.designation_fr.toLowerCase().includes('gravats') || 
      item.designation_fr.toLowerCase().includes('evacuation')
    );
    const hasMeals = invoiceData.items.some(item => 
      item.designation_fr.toLowerCase().includes('repas')
    );
    const hasParking = invoiceData.items.some(item => 
      item.designation_fr.toLowerCase().includes('stationnement') || 
      item.designation_fr.toLowerCase().includes('parking')
    );

    // Add parking suggestion if high density area and not already present
    if (isHighDensity && !hasParking) {
      items.push({
        id: 'parking',
        label_fr: 'Frais de Stationnement',
        label_ar: 'مصاريف الركن',
        icon: '🅿️',
        defaultPrice: 20,
        price: 20,
        selected: false,
        isParking: true,
      });
    }

    // Standard hidden cost suggestions
    if (!hasTravel) {
      items.push({
        id: 'travel',
        label_fr: 'Frais de déplacement (Carburant)',
        label_ar: 'مصاريف تنقل (بنزين)',
        icon: '⛽',
        defaultPrice: 30,
        price: 30,
        selected: false,
      });
    }

    if (!hasWaste) {
      items.push({
        id: 'waste',
        label_fr: 'Évacuation des gravats',
        label_ar: 'نقل المخلفات',
        icon: '🗑️',
        defaultPrice: 50,
        price: 50,
        selected: false,
      });
    }

    if (!hasMeals) {
      items.push({
        id: 'meals',
        label_fr: 'Frais de repas',
        label_ar: 'مصاريف الأكل',
        icon: '🥪',
        defaultPrice: 15,
        price: 15,
        selected: false,
      });
    }

    return items;
  });

  const toggleAddon = (id: string) => {
    setAddons(prev => prev.map(addon => 
      addon.id === id ? { ...addon, selected: !addon.selected } : addon
    ));
  };

  const updateAddonPrice = (id: string, price: number) => {
    setAddons(prev => prev.map(addon => 
      addon.id === id ? { ...addon, price } : addon
    ));
  };

  const selectedAddons = addons.filter(a => a.selected);
  const additionalTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
  const newSubtotal = invoiceData.subtotal + additionalTotal;
  const newDiscountAmount = invoiceData.discountAmount && invoiceData.discountAmount > 0
    ? (invoiceData.discountType === 'percent'
        ? Math.round(newSubtotal * ((invoiceData.discountValue ?? 0) / 100) * 100) / 100
        : Math.min(invoiceData.discountValue ?? 0, newSubtotal))
    : 0;
  const newTvaAmount = invoiceData.tvaExempt ? 0 : Math.round(newSubtotal * (invoiceData.tvaRate / 100) * 100) / 100;
  const newTotal = Math.round((newSubtotal + newTvaAmount - newDiscountAmount) * 100) / 100;
  const displayedTvaAmount = selectedAddons.length > 0 ? newTvaAmount : invoiceData.tvaAmount;
  const displayedDiscountAmount = selectedAddons.length > 0 ? newDiscountAmount : (invoiceData.discountAmount ?? 0);
  const displayedTotal = selectedAddons.length > 0 ? newTotal : invoiceData.total;
  const isAutoliquidation = !invoiceData.tvaExempt && invoiceData.tvaRate === 0 && invoiceData.legalMentions?.includes('283');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleConfirm = () => {
    onConfirm(selectedAddons);
  };

  const parkingAddon = addons.find(a => a.isParking);
  const otherAddons = addons.filter(a => !a.isParking);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-lg", isRTL && "font-cairo")}>
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse text-right")}>
            <span className="text-2xl">🔍</span>
            {isRTL ? 'مراجعة نهائية' : 'Révision Finale'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Parking Alert (if high density area) */}
          {parkingAddon && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className={cn("flex-1 space-y-2", isRTL && "text-right")}>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {isRTL 
                        ? 'هذا العنوان في منطقة مزدحمة. هل أضفت تكلفة الركن؟' 
                        : 'Cette adresse est en zone dense. Avez-vous ajouté le stationnement?'}
                    </p>
                    <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                      <Checkbox
                        id="parking"
                        checked={parkingAddon.selected}
                        onCheckedChange={() => toggleAddon(parkingAddon.id)}
                      />
                      <Label htmlFor="parking" className="text-sm cursor-pointer">
                        {parkingAddon.icon} {isRTL ? parkingAddon.label_ar : parkingAddon.label_fr}
                      </Label>
                      {parkingAddon.selected && (
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={parkingAddon.price}
                          onChange={(e) => updateAddonPrice(parkingAddon.id, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-sm"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hidden Costs Checklist */}
          {otherAddons.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className={cn(
                  "text-sm font-semibold mb-3 flex items-center gap-2",
                  isRTL && "flex-row-reverse text-right"
                )}>
                  <span>❓</span>
                  {isRTL ? 'هل نسيت؟' : 'Avez-vous oublié?'}
                </h3>
                <div className="space-y-3">
                  {otherAddons.map(addon => (
                    <div 
                      key={addon.id} 
                      className={cn(
                        "flex items-center gap-3",
                        isRTL && "flex-row-reverse"
                      )}
                    >
                      <Checkbox
                        id={addon.id}
                        checked={addon.selected}
                        onCheckedChange={() => toggleAddon(addon.id)}
                      />
                      <Label 
                        htmlFor={addon.id} 
                        className={cn("flex-1 text-sm cursor-pointer", isRTL && "text-right")}
                      >
                        {addon.icon} {isRTL ? addon.label_ar : addon.label_fr}
                      </Label>
                      {addon.selected && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={addon.price}
                            onChange={(e) => updateAddonPrice(addon.id, parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">€</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Summary */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h3 className={cn(
                "text-sm font-semibold mb-3 flex items-center gap-2",
                isRTL && "flex-row-reverse text-right"
              )}>
                <span>💰</span>
                {isRTL ? 'الملخص المالي' : 'Récapitulatif'}
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className={cn("flex justify-between", isRTL && "flex-row-reverse")}>
                  <span className="text-muted-foreground">
                    {isRTL ? 'المجموع الحالي (HT)' : 'Total actuel HT'}
                  </span>
                  <span>{formatCurrency(invoiceData.subtotal)}</span>
                </div>
                
                {selectedAddons.length > 0 && (
                  <>
                    <div className="border-t border-dashed pt-2 space-y-1">
                      {selectedAddons.map(addon => (
                        <div 
                          key={addon.id} 
                          className={cn(
                            "flex justify-between text-primary",
                            isRTL && "flex-row-reverse"
                          )}
                        >
                          <span className="flex items-center gap-1">
                            <Plus className="h-3 w-3" />
                            {addon.icon} {isRTL ? addon.label_ar : addon.label_fr}
                          </span>
                          <span>+{formatCurrency(addon.price)}</span>
                        </div>
                      ))}
                    </div>
                    <div className={cn(
                      "flex justify-between font-medium border-t pt-2",
                      isRTL && "flex-row-reverse"
                    )}>
                      <span>{isRTL ? 'المجموع الجديد (HT)' : 'Nouveau Total HT'}</span>
                      <span className="text-primary">{formatCurrency(newSubtotal)}</span>
                    </div>
                  </>
                )}
                
                <div className={cn("flex justify-between text-muted-foreground", isRTL && "flex-row-reverse")}>
                  <span>{invoiceData.tvaRate > 0 ? `TVA (${invoiceData.tvaRate}%)` : 'TVA'}</span>
                  <span>{formatCurrency(displayedTvaAmount)}</span>
                </div>

                {displayedDiscountAmount > 0 && (
                  <div className={cn("flex justify-between text-destructive", isRTL && "flex-row-reverse")}>
                    <span>
                      {invoiceData.discountType === 'percent'
                        ? `Remise (${invoiceData.discountValue}%)`
                        : 'Remise'}
                    </span>
                    <span>-{formatCurrency(displayedDiscountAmount)}</span>
                  </div>
                )}

                {(invoiceData.tvaExempt || isAutoliquidation) && (
                  <div className={cn("text-xs italic text-muted-foreground border-t pt-2", isRTL && "text-right")}>
                    {invoiceData.tvaExempt
                      ? 'TVA non applicable, art. 293 B du CGI'
                      : 'Autoliquidation de la TVA – art. 283-2 du CGI'}
                  </div>
                )}
                
                <div className={cn(
                  "flex justify-between font-bold text-lg border-t pt-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <span>{isRTL ? 'المجموع الكلي (TTC)' : 'Total TTC'}</span>
                  <span className="text-primary">{formatCurrency(displayedTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* No suggestions message */}
          {addons.length === 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="p-4">
                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                  <Check className="h-5 w-5 text-primary" />
                  <p className={cn("text-sm text-foreground", isRTL && "text-right")}>
                    {isRTL 
                      ? 'ممتاز! كل التكاليف الأساسية موجودة.' 
                      : 'Parfait! Tous les coûts essentiels sont inclus.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />
            {isRTL ? 'تعديل' : 'Modifier'}
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <FileText className="h-4 w-4" />
            {isRTL ? 'تأكيد وتحميل PDF' : 'Confirmer & Télécharger PDF'}
            {creditCost > 0 && (
              <Badge 
                variant="secondary" 
                className="ml-1 text-xs px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
              >
                <Coins className="h-3 w-3 mr-0.5" />
                {creditCost}
              </Badge>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SmartReviewModal;
