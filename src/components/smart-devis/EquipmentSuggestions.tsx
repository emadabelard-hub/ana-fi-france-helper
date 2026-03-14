import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Package, Check, X } from 'lucide-react';

interface LineItem {
  id: string;
  designation_fr: string;
  designation_ar: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category?: string;
  catalogCode?: string;
  withMaterial?: boolean;
}

interface EquipmentSuggestion {
  id: string;
  triggerKeywords: string[];
  triggerCodes: string[];
  equipment_fr: string;
  equipment_ar: string;
  unit: string;
  defaultQuantity: number;
  catalogCode?: string;
}

const EQUIPMENT_RULES: EquipmentSuggestion[] = [
  {
    id: 'echafaudage_facade',
    triggerKeywords: ['façade', 'facade', 'ravalement', 'extérieur', 'exterieur', 'peinture extérieure'],
    triggerCodes: ['PEI05', 'PEI06', 'MAC10', 'ETA01', 'ETA02'],
    equipment_fr: 'Location échafaudage',
    equipment_ar: 'كراء سقالة',
    unit: 'forfait',
    defaultQuantity: 1,
    catalogCode: 'LOC01',
  },
  {
    id: 'sableuse_piscine',
    triggerKeywords: ['décapage', 'decapage', 'piscine', 'sablage'],
    triggerCodes: ['PIS01', 'PIS02'],
    equipment_fr: 'Location sableuse + sable',
    equipment_ar: 'كراء آلة السفع الرملي + رمل',
    unit: 'forfait',
    defaultQuantity: 1,
    catalogCode: 'LOC02',
  },
  {
    id: 'betonniere_chape',
    triggerKeywords: ['chape', 'béton', 'beton', 'dalle', 'fondation'],
    triggerCodes: ['MAC01', 'MAC02', 'MAC03', 'MAC04'],
    equipment_fr: 'Location bétonnière',
    equipment_ar: 'كراء خلاطة إسمنت',
    unit: 'forfait',
    defaultQuantity: 1,
    catalogCode: 'LOC03',
  },
  {
    id: 'colle_croisillons',
    triggerKeywords: ['carrelage', 'faïence', 'faience', 'pose carrelage', 'pose faïence'],
    triggerCodes: ['CAR01', 'CAR02', 'CAR03'],
    equipment_fr: 'Colle carrelage + croisillons',
    equipment_ar: 'غراء بلاط + صلبان',
    unit: 'forfait',
    defaultQuantity: 1,
    catalogCode: 'FRC01',
  },
  {
    id: 'benne_gravats',
    triggerKeywords: ['démolition', 'demolition', 'dépose', 'depose', 'déconstruction', 'casse'],
    triggerCodes: ['MAC09', 'FRC02'],
    equipment_fr: 'Location benne à gravats',
    equipment_ar: 'كراء حاوية أنقاض',
    unit: 'forfait',
    defaultQuantity: 1,
    catalogCode: 'LOC04',
  },
  {
    id: 'nacelle_hauteur',
    triggerKeywords: ['plafond haut', 'cage escalier', 'grande hauteur', 'mezzanine'],
    triggerCodes: ['PEI07'],
    equipment_fr: 'Location nacelle élévatrice',
    equipment_ar: 'كراء رافعة',
    unit: 'forfait',
    defaultQuantity: 1,
    catalogCode: 'LOC05',
  },
  {
    id: 'aspirateur_chantier',
    triggerKeywords: ['ponçage', 'poncage', 'placo', 'placoplatre', 'enduit', 'ragréage'],
    triggerCodes: ['PEI01', 'PEI03', 'PLA01', 'PLA02'],
    equipment_fr: 'Nettoyage fin de chantier',
    equipment_ar: 'تنظيف نهاية الورشة',
    unit: 'forfait',
    defaultQuantity: 1,
    catalogCode: 'FRC03',
  },
  {
    id: 'primaire_accrochage',
    triggerKeywords: ['parquet', 'stratifié', 'stratifie', 'sol souple', 'lino', 'vinyle'],
    triggerCodes: ['PAR01', 'PAR02', 'PAR03'],
    equipment_fr: 'Primaire d\'accrochage sol',
    equipment_ar: 'طبقة تحضيرية للأرضية',
    unit: 'm²',
    defaultQuantity: 1,
    catalogCode: 'FRC04',
  },
];

interface EquipmentSuggestionsProps {
  lineItems: LineItem[];
  isRTL: boolean;
  onAccept: (item: Omit<LineItem, 'id'>) => void;
}

const EquipmentSuggestions: React.FC<EquipmentSuggestionsProps> = ({ lineItems, isRTL, onAccept }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const suggestions = useMemo(() => {
    const allDesignations = lineItems.map(i => (i.designation_fr || '').toLowerCase()).join(' ');
    const allCodes = new Set(lineItems.map(i => (i.catalogCode || '').toUpperCase()).filter(Boolean));

    return EQUIPMENT_RULES.filter(rule => {
      if (dismissed.has(rule.id) || accepted.has(rule.id)) return false;
      // Don't suggest if already in line items
      const alreadyExists = lineItems.some(i =>
        (i.catalogCode && rule.catalogCode && i.catalogCode.toUpperCase() === rule.catalogCode.toUpperCase()) ||
        (i.designation_fr || '').toLowerCase().includes(rule.equipment_fr.toLowerCase())
      );
      if (alreadyExists) return false;

      const keywordMatch = rule.triggerKeywords.some(kw => allDesignations.includes(kw.toLowerCase()));
      const codeMatch = rule.triggerCodes.some(code => allCodes.has(code));
      return keywordMatch || codeMatch;
    });
  }, [lineItems, dismissed, accepted]);

  const handleAccept = useCallback((rule: EquipmentSuggestion) => {
    setAccepted(prev => new Set(prev).add(rule.id));
    onAccept({
      designation_fr: rule.equipment_fr,
      designation_ar: rule.equipment_ar,
      quantity: rule.defaultQuantity,
      unit: rule.unit,
      unitPrice: 0,
      total: 0,
      category: 'Location Matériel',
      catalogCode: rule.catalogCode,
      withMaterial: true,
    });
  }, [onAccept]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  }, []);

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-2 border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-3 space-y-2">
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <Package className="h-4 w-4 text-amber-600" />
          <p className={cn("text-xs font-bold text-amber-700 dark:text-amber-300", isRTL && "font-cairo")}>
            {isRTL
              ? '🔧 هاد الخدمة غالباً كتحتاج المعدات التالية:'
              : '🔧 Ce travail nécessite probablement le matériel suivant :'}
          </p>
        </div>

        {suggestions.map(rule => (
          <div
            key={rule.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5",
              isRTL && "flex-row-reverse"
            )}
          >
            <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
              <p className={cn("text-xs font-semibold text-foreground truncate", isRTL && "font-cairo")}>
                {isRTL ? rule.equipment_ar : rule.equipment_fr}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isRTL ? rule.equipment_fr : rule.equipment_ar}
              </p>
              {rule.catalogCode && (
                <Badge variant="outline" className="text-[8px] mt-0.5">{rule.catalogCode}</Badge>
              )}
            </div>
            <div className={cn("flex items-center gap-1.5 shrink-0", isRTL && "flex-row-reverse")}>
              <Button
                size="sm"
                variant="default"
                className="h-7 px-2.5 text-[10px] font-bold gap-1"
                onClick={() => handleAccept(rule)}
              >
                <Check className="h-3 w-3" />
                {isRTL ? 'نعم' : 'Oui'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-[10px] text-muted-foreground gap-1"
                onClick={() => handleDismiss(rule.id)}
              >
                <X className="h-3 w-3" />
                {isRTL ? 'لا' : 'Non'}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default EquipmentSuggestions;
