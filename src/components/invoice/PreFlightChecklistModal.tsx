import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { LineItem } from './LineItemEditor';

interface PreFlightChecklistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  items: LineItem[];
}

interface ChecklistItem {
  id: string;
  fr: string;
  ar: string;
}

const KEYWORD_SUGGESTIONS: { keywords: RegExp; items: ChecklistItem[] }[] = [
  {
    keywords: /peinture|enduit|peint|badigeon|crépi/i,
    items: [
      { id: 'bache', fr: 'Bâche de protection', ar: 'بلاستيك حماية' },
      { id: 'scotch', fr: 'Scotch de masquage', ar: 'سكوتش ماسكاج' },
      { id: 'souscouche', fr: 'Sous-couche / Primaire', ar: 'طبقة تحتية' },
      { id: 'poncage', fr: 'Ponçage / Préparation', ar: 'صنفرة / تجهيز' },
    ],
  },
  {
    keywords: /sol|carrelage|carreau|faïence|dalle|parquet/i,
    items: [
      { id: 'colle', fr: 'Colle à carrelage', ar: 'غراء البلاط' },
      { id: 'joints', fr: 'Joints', ar: 'جوانات' },
      { id: 'plinthes', fr: 'Plinthes', ar: 'بلينت (إطارات أرضية)' },
      { id: 'seuil', fr: 'Barres de seuil', ar: 'بار دو سوي' },
    ],
  },
  {
    keywords: /élec|electri|lumière|luminaire|prise|interrupteur|spot/i,
    items: [
      { id: 'boitiers', fr: "Boîtiers d'encastrement", ar: 'علب كهربا' },
      { id: 'ampoules', fr: 'Ampoules / LED', ar: 'لمبات' },
      { id: 'disjoncteur', fr: 'Disjoncteur / Tableau', ar: 'قاطع كهربا' },
    ],
  },
];

const UNIVERSAL_ITEMS: ChecklistItem[] = [
  { id: 'deplacement', fr: 'Frais de déplacement', ar: 'مصاريف النقل' },
  { id: 'gravats', fr: 'Évacuation des gravats (Déchetterie)', ar: 'نقل المخلفات (ديشيتري)' },
  { id: 'nettoyage', fr: 'Nettoyage fin de chantier', ar: 'تنظيف بعد الشغل' },
];

const PreFlightChecklistModal = ({ open, onOpenChange, onConfirm, items }: PreFlightChecklistModalProps) => {
  const { isRTL } = useLanguage();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const suggestions = useMemo(() => {
    const allText = items.map(i => `${i.designation_fr} ${i.designation_ar || ''}`).join(' ');
    const matched: ChecklistItem[] = [];
    const seenIds = new Set<string>();

    for (const group of KEYWORD_SUGGESTIONS) {
      if (group.keywords.test(allText)) {
        for (const item of group.items) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            matched.push(item);
          }
        }
      }
    }

    return matched;
  }, [items]);

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderItem = (item: ChecklistItem) => (
    <label
      key={item.id}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors cursor-pointer",
        isRTL && "flex-row-reverse"
      )}
    >
      <Checkbox
        checked={checked.has(item.id)}
        onCheckedChange={() => toggleCheck(item.id)}
      />
      <span className={cn("text-sm flex-1", isRTL && "text-right font-cairo")}>
        {isRTL ? item.ar : item.fr}
      </span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md max-h-[85vh] overflow-y-auto", isRTL && "font-cairo")}>
        <DialogHeader>
          <DialogTitle className={cn("text-lg", isRTL && "text-right font-cairo")}>
            {isRTL ? '🔍 شيك على الحاجات دي ممكن تكون مهمة' : '🔍 As-tu pensé à ça ?'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Keyword-based suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className={cn("text-xs font-bold text-primary uppercase tracking-wide", isRTL && "text-right font-cairo")}>
                {isRTL ? '💡 حسب الشغل اللي كتبته' : '💡 Selon vos prestations'}
              </h4>
              {suggestions.map(renderItem)}
            </div>
          )}

          {/* Universal items */}
          <div className="space-y-2">
            <h4 className={cn("text-xs font-bold text-muted-foreground uppercase tracking-wide", isRTL && "text-right font-cairo")}>
              {isRTL ? '📋 عام (لكل شانتييه)' : '📋 Général (tout chantier)'}
            </h4>
            {UNIVERSAL_ITEMS.map(renderItem)}
          </div>

          {/* Disclaimer */}
          <p className={cn("text-[10px] text-muted-foreground text-center italic")}>
            Liste indicative / قائمة للتذكير فقط
          </p>
        </div>

        <DialogFooter className={cn("flex-col sm:flex-row gap-2 pt-2", isRTL && "sm:flex-row-reverse")}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={cn("gap-2", isRTL && "font-cairo flex-row-reverse")}
          >
            <ArrowLeft className={cn("h-4 w-4", isRTL && "rotate-180")} />
            {isRTL ? 'نسيت حاجة، أرجع أعدّل' : "J'ai oublié un truc"}
          </Button>
          <Button
            onClick={onConfirm}
            className={cn("gap-2", isRTL && "font-cairo")}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isRTL ? 'تمام، ورّيني الدوفي' : "C'est bon, voir le devis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreFlightChecklistModal;
