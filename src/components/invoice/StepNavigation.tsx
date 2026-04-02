import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useRef, useCallback, useEffect } from 'react';

export interface WizardStep {
  id: string;
  label: string;
  icon: string;
  isComplete: boolean;
}

interface StepNavigationProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  isRTL?: boolean;
  canProceed?: boolean;
  validationMessage?: string;
}

const StepNavigation = ({ steps, currentStep, onStepChange, isRTL, canProceed = true, validationMessage }: StepNavigationProps) => {
  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Touch swipe support
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 60;
    if (Math.abs(diff) > threshold) {
      if (isRTL ? diff > 0 : diff < 0) {
        // Swipe to next
        if (!isLastStep && canProceed) onStepChange(currentStep + 1);
      } else {
        // Swipe to previous
        if (!isFirstStep) onStepChange(currentStep - 1);
      }
    }
    touchStartX.current = null;
  }, [currentStep, isLastStep, isFirstStep, canProceed, onStepChange, isRTL]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Step indicator bar */}
      <div className="p-3 rounded-xl border bg-card shadow-sm space-y-3">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {currentStep + 1}/{steps.length}
          </span>
        </div>

        {/* Step pills - scrollable */}
        <div className={cn("flex gap-1 overflow-x-auto pb-1 scrollbar-hide", isRTL && "flex-row-reverse")}>
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => {
                // Allow going back freely, but validate going forward
                if (idx <= currentStep || canProceed) onStepChange(idx);
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 whitespace-nowrap shrink-0",
                idx === currentStep
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : step.isComplete
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 cursor-pointer hover:bg-emerald-200"
                    : idx < currentStep
                      ? "bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80"
                      : "bg-muted/40 text-muted-foreground/60"
              )}
            >
              {step.isComplete && idx !== currentStep ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{step.icon}</span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Current step title */}
      <div className={cn("flex items-center gap-2 px-1", isRTL && "flex-row-reverse")}>
        <span className="text-xl">{steps[currentStep]?.icon}</span>
        <h2 className={cn("text-base font-bold text-foreground", isRTL && "font-cairo")}>
          {steps[currentStep]?.label}
        </h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {isRTL ? `الخطوة ${currentStep + 1} من ${steps.length}` : `Étape ${currentStep + 1} sur ${steps.length}`}
        </span>
      </div>

      {/* Validation message */}
      {validationMessage && (
        <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
          ⚠️ {validationMessage}
        </div>
      )}
    </div>
  );
};

export const StepButtons = ({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  canProceed = true,
  isRTL,
}: {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  canProceed?: boolean;
  isRTL?: boolean;
}) => {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className={cn("flex gap-3 pt-4", isRTL && "flex-row-reverse")}>
      {!isFirst && (
        <Button
          type="button"
          variant="outline"
          onClick={onPrev}
          className={cn("flex-1 gap-1.5", isRTL && "flex-row-reverse font-cairo")}
        >
          {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {isRTL ? 'السابق' : 'Précédent'}
        </Button>
      )}
      {!isLast && (
        <Button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className={cn("flex-1 gap-1.5", isRTL && "flex-row-reverse font-cairo", isFirst && "w-full")}
        >
          {isRTL ? 'التالي' : 'Suivant'}
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
};

export default StepNavigation;
