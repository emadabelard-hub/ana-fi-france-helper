import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Package, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { EQUIPMENT_RULES, type EquipmentRule, type EquipmentItem } from './equipmentRules';

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

interface EquipmentSuggestionsProps {
  lineItems: LineItem[];
  isRTL: boolean;
  onAccept: (item: Omit<LineItem, 'id'>) => void;
}

const EquipmentSuggestions: React.FC<EquipmentSuggestionsProps> = ({ lineItems, isRTL, onAccept }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const suggestions = useMemo(() => {
    const allDesignations = lineItems.map(i => (i.designation_fr || '').toLowerCase()).join(' ');
    const allCodes = new Set(lineItems.map(i => (i.catalogCode || '').toUpperCase()).filter(Boolean));

    return EQUIPMENT_RULES.filter(rule => {
      if (dismissed.has(rule.id) || accepted.has(rule.id)) return false;
      const keywordMatch = rule.triggerKeywords.some(kw => allDesignations.includes(kw.toLowerCase()));
      const codeMatch = rule.triggerCodes.some(code => allCodes.has(code));
      return keywordMatch || codeMatch;
    });
  }, [lineItems, dismissed, accepted]);

  const handleAcceptAll = useCallback((rule: EquipmentRule) => {
    setAccepted(prev => new Set(prev).add(rule.id));
    rule.items.forEach(item => {
      // Skip if already in line items
      const exists = lineItems.some(li =>
        (item.catalogCode && li.catalogCode && li.catalogCode.toUpperCase() === item.catalogCode.toUpperCase()) ||
        (li.designation_fr || '').toLowerCase().includes(item.equipment_fr.toLowerCase())
      );
      if (exists) return;

      onAccept({
        designation_fr: item.equipment_fr,
        designation_ar: item.equipment_ar,
        quantity: item.defaultQuantity,
        unit: item.unit,
        unitPrice: 0,
        total: 0,
        category: 'Location Matériel',
        catalogCode: item.catalogCode,
        withMaterial: true,
      });
    });
  }, [onAccept, lineItems]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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

        {suggestions.map(rule => {
          const isExpanded = expanded.has(rule.id);
          const ruleLabel = isRTL ? rule.items[0]?.equipment_ar : rule.triggerKeywords[0];

          return (
            <div
              key={rule.id}
              className="rounded-lg border bg-card overflow-hidden"
            >
              <div className={cn(
                "flex items-center justify-between gap-2 p-2.5",
                isRTL && "flex-row-reverse"
              )}>
                <button
                  onClick={() => toggleExpand(rule.id)}
                  className={cn("flex-1 min-w-0 flex items-center gap-1.5 text-left", isRTL && "flex-row-reverse text-right")}
                >
                  {isExpanded ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  <span className={cn("text-xs font-semibold text-foreground truncate", isRTL && "font-cairo")}>
                    {rule.items.length} {isRTL ? 'عناصر' : 'éléments'}
                  </span>
                  <Badge variant="outline" className="text-[8px] shrink-0">
                    {rule.triggerKeywords[0]}
                  </Badge>
                </button>
                <div className={cn("flex items-center gap-1.5 shrink-0", isRTL && "flex-row-reverse")}>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 px-2.5 text-[10px] font-bold gap-1"
                    onClick={() => handleAcceptAll(rule)}
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

              {isExpanded && (
                <div className="border-t px-2.5 pb-2 pt-1.5 space-y-1">
                  {rule.items.map((item, idx) => (
                    <div key={idx} className={cn("flex items-center gap-2 text-[11px]", isRTL && "flex-row-reverse")}>
                      <span className="text-muted-foreground">•</span>
                      <span className={cn("text-foreground", isRTL && "font-cairo")}>
                        {isRTL ? item.equipment_ar : item.equipment_fr}
                      </span>
                      {item.catalogCode && (
                        <Badge variant="outline" className="text-[8px]">{item.catalogCode}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default EquipmentSuggestions;
