import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Check } from 'lucide-react';

export interface ProgressSection {
  id: string;
  label: string;
  icon: string;
  isComplete: boolean;
}

interface FormProgressBarProps {
  sections: ProgressSection[];
  progressPercent: number;
  isRTL?: boolean;
}

const FormProgressBar = ({ sections, progressPercent, isRTL }: FormProgressBarProps) => {
  const allComplete = progressPercent === 100;

  return (
    <div className="space-y-3 p-4 rounded-xl border bg-card shadow-sm">
      <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
        <span className={cn(
          "text-sm font-bold",
          allComplete ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
          isRTL && "font-cairo"
        )}>
          {allComplete
            ? (isRTL ? '✅ جاهز!' : '✅ Prêt!')
            : (isRTL ? `التقدم: ${progressPercent}%` : `Progression: ${progressPercent}%`)}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {sections.filter(s => s.isComplete).length}/{sections.length}
        </span>
      </div>

      <Progress 
        value={progressPercent} 
        className={cn(
          "h-2.5 rounded-full",
          allComplete && "[&>div]:bg-emerald-500"
        )} 
      />

      <div className={cn("flex flex-wrap gap-1.5", isRTL && "flex-row-reverse")}>
        {sections.map(section => (
          <div
            key={section.id}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-300",
              section.isComplete
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-muted/60 text-muted-foreground"
            )}
          >
            {section.isComplete ? (
              <Check className="h-3 w-3" />
            ) : (
              <span className="h-3 w-3 rounded-full border-2 border-current inline-block opacity-40" />
            )}
            <span>{section.icon}</span>
            <span className="hidden sm:inline">{section.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FormProgressBar;
