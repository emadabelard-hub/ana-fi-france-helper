import { useState } from 'react';
import { X, HelpCircle, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UnitGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUnit?: (unitValue: string) => void;
}

const UNIT_GUIDE = [
  {
    code: 'm²',
    name_fr: 'Mètre Carré',
    name_ar: 'متر كاري',
    description_fr: 'Pour surfaces : Peinture, Carrelage, Parquet.',
    description_ar: 'للمساحات: دهان، سيراميك، باركيه.',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-100 dark:border-blue-800',
    badgeColor: 'bg-blue-600 text-white',
    selectedRing: 'ring-blue-500',
  },
  {
    code: 'ml',
    name_fr: 'Mètre Linéaire',
    name_ar: 'متر طولي',
    description_fr: 'Pour longueurs : Plinthes, Tuyaux, Câbles.',
    description_ar: 'للأطوال: قواعد، مواسير، كابلات.',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-100 dark:border-orange-800',
    badgeColor: 'bg-orange-500 text-white',
    selectedRing: 'ring-orange-500',
  },
  {
    code: 'U',
    name_fr: 'Unité (ou Pièce)',
    name_ar: 'أونيتيه (قطعة)',
    description_fr: 'Objets uniques : Porte, Robinet, Chauffe-eau.',
    description_ar: 'قطع منفردة: باب، حنفية، سخان.',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-100 dark:border-green-800',
    badgeColor: 'bg-green-600 text-white',
    selectedRing: 'ring-green-500',
  },
  {
    code: 'H',
    name_fr: 'Heure',
    name_ar: 'ساعة',
    description_fr: "Main d'œuvre, Dépannage rapide.",
    description_ar: 'مصنعية، صيانة سريعة.',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-100 dark:border-purple-800',
    badgeColor: 'bg-purple-600 text-white',
    selectedRing: 'ring-purple-500',
  },
  {
    code: 'J',
    name_fr: 'Jour',
    name_ar: 'يوم',
    description_fr: 'Travaux à la journée.',
    description_ar: 'شغل باليوم.',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-100 dark:border-amber-800',
    badgeColor: 'bg-amber-600 text-white',
    selectedRing: 'ring-amber-500',
  },
  {
    code: 'Forfait',
    name_fr: 'Forfait Global',
    name_ar: 'فورفيه (شامل)',
    description_fr: 'Pour un ensemble de tâches indissociables.',
    description_ar: 'لمجموعة أعمال مش بتتفصل.',
    bgColor: 'bg-slate-50 dark:bg-slate-800/30',
    borderColor: 'border-slate-200 dark:border-slate-700',
    badgeColor: 'bg-slate-600 text-white',
    selectedRing: 'ring-slate-500',
  },
];

const UNIT_CODE_TO_VALUE: Record<string, string> = {
  'm²': 'm²',
  'ml': 'ml',
  'U': 'u',
  'H': 'h',
  'J': 'jour',
  'Forfait': 'forfait',
};

const UnitGuideModal = ({ open, onOpenChange, onSelectUnit }: UnitGuideModalProps) => {
  const { isRTL } = useLanguage();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const handleSelect = (unit: typeof UNIT_GUIDE[0]) => {
    if (!onSelectUnit) return;
    setSelectedCode(unit.code);
    setTimeout(() => {
      onSelectUnit(UNIT_CODE_TO_VALUE[unit.code] || unit.code.toLowerCase());
      onOpenChange(false);
      // Reset after close animation
      setTimeout(() => setSelectedCode(null), 200);
    }, 180);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedCode(null); }}>
      <DialogContent className={cn(
        "max-w-sm sm:max-w-md p-0 gap-0 rounded-[2rem] overflow-hidden",
        isRTL && "font-cairo"
      )}>
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <div className={cn("flex justify-between items-center", isRTL && "flex-row-reverse")}>
            <DialogTitle className={cn(
              "text-lg font-black uppercase tracking-tight text-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? '📐 دليل الوحدات' : '📐 Guide des Unités'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-full h-8 w-8"
            >
              <X size={18} />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {UNIT_GUIDE.map((unit) => {
            const isSelected = selectedCode === unit.code;
            return (
              <div
                key={unit.code}
                role={onSelectUnit ? "button" : undefined}
                tabIndex={onSelectUnit ? 0 : undefined}
                onClick={() => handleSelect(unit)}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-2xl border transition-all duration-150",
                  unit.bgColor,
                  unit.borderColor,
                  isRTL && "flex-row-reverse",
                  onSelectUnit && "cursor-pointer hover:brightness-95 dark:hover:brightness-110 active:scale-[0.96]",
                  isSelected && `ring-2 ${unit.selectedRing} scale-[0.96]`
                )}
              >
                <div className={cn(
                  "relative font-black text-xs w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-150",
                  unit.badgeColor,
                  isSelected && "scale-110"
                )}>
                  {isSelected ? <Check size={18} strokeWidth={3} /> : unit.code}
                </div>
                <div className={cn("flex-1", isRTL && "text-right")}>
                  <p className={cn(
                    "font-bold text-sm text-foreground",
                    isRTL && "font-cairo"
                  )}>
                    {isRTL ? unit.name_ar : unit.name_fr}
                  </p>
                  <p className={cn(
                    "text-[10px] text-muted-foreground mt-0.5",
                    isRTL && "font-cairo"
                  )}>
                    {isRTL ? unit.description_ar : unit.description_fr}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 pt-2 border-t bg-muted/30">
          <Button
            onClick={() => onOpenChange(false)}
            className={cn(
              "w-full rounded-xl font-bold text-xs uppercase",
              isRTL && "font-cairo"
            )}
          >
            {isRTL ? 'فهمت! 👍' : "J'ai compris 👍"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const UnitGuideButton = ({ onClick }: { onClick: () => void }) => {
  const { isRTL } = useLanguage();
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-2 py-1 rounded-full",
        isRTL && "flex-row-reverse font-cairo"
      )}
    >
      <HelpCircle size={10} />
      <span>{isRTL ? 'إيه الوحدات؟' : 'Aide Unités'}</span>
    </button>
  );
};

export default UnitGuideModal;
