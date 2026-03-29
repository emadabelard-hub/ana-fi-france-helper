import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Sparkles, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';

interface DualModeAnalysisProps {
  analysisData: any;
  fullContent: string;
  isRTL: boolean;
}

const DualModeAnalysis = ({ analysisData, fullContent, isRTL }: DualModeAnalysisProps) => {
  const [showExpert, setShowExpert] = useState(false);

  const hasQuickData = analysisData?.quickSummary_ar || analysisData?.quickSummary_fr;

  // If no structured quick data, fall back to full content
  if (!hasQuickData) {
    return <MarkdownRenderer content={fullContent} isRTL={isRTL} />;
  }

  const summary = isRTL ? analysisData.quickSummary_ar : analysisData.quickSummary_fr;
  const tasks: string[] = isRTL
    ? (analysisData.quickTasks_ar || [])
    : (analysisData.quickTasks_fr || []);
  const duration = isRTL ? analysisData.quickDuration_ar : analysisData.quickDuration_fr;
  const phase = analysisData.chantierPhase;

  const phaseConfig: Record<string, { emoji: string; labelAr: string; labelFr: string; color: string }> = {
    demolition: { emoji: '🔨', labelAr: 'هدم', labelFr: 'Démolition', color: 'text-red-500' },
    finition: { emoji: '🎨', labelAr: 'تشطيب', labelFr: 'Finition', color: 'text-green-500' },
    renovation: { emoji: '🔧', labelAr: 'تجديد', labelFr: 'Rénovation', color: 'text-amber-500' },
  };

  const phaseInfo = phaseConfig[phase] || phaseConfig.renovation;

  return (
    <div className="space-y-3">
      {/* Quick Mode Card */}
      <Card className="p-4 border-primary/20 bg-primary/5 space-y-3">
        {/* Phase Badge */}
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <span className="text-lg">{phaseInfo.emoji}</span>
          <span className={cn("text-xs font-bold uppercase tracking-wide", phaseInfo.color)}>
            {isRTL ? phaseInfo.labelAr : phaseInfo.labelFr}
          </span>
        </div>

        {/* Summary */}
        <p className={cn(
          "text-sm font-medium text-foreground leading-relaxed",
          isRTL && "text-right font-cairo"
        )} dir={isRTL ? 'rtl' : 'ltr'}>
          {summary}
        </p>

        {/* Quick Tasks */}
        {tasks.length > 0 && (
          <div className="space-y-1.5" dir={isRTL ? 'rtl' : 'ltr'}>
            {tasks.map((task, i) => (
              <div key={i} className={cn("flex items-start gap-2", isRTL && "flex-row-reverse")}>
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className={cn("text-xs text-foreground/80", isRTL && "font-cairo")}>
                  {task}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Duration */}
        {duration && (
          <div className={cn("flex items-center gap-2 pt-1", isRTL && "flex-row-reverse")}>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={cn("text-xs text-muted-foreground font-medium", isRTL && "font-cairo")}>
              {duration}
            </span>
          </div>
        )}
      </Card>

      {/* Toggle Expert Mode */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowExpert(!showExpert)}
        className={cn(
          "w-full text-xs font-bold gap-2 border-primary/30 hover:bg-primary/5",
          isRTL && "flex-row-reverse font-cairo"
        )}
      >
        {showExpert
          ? (isRTL ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />)
          : (isRTL ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
        }
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {showExpert
          ? (isRTL ? 'إخفاء التفاصيل' : 'Masquer les détails')
          : (isRTL ? 'عرض التفاصيل الكاملة 🔍' : 'Voir l\'analyse complète 🔍')
        }
      </Button>

      {/* Expert Mode Content */}
      {showExpert && (
        <Card className="p-4 border-border bg-card space-y-3 animate-in slide-in-from-top-2 fade-in duration-300">
          <MarkdownRenderer content={fullContent} isRTL={isRTL} />
        </Card>
      )}
    </div>
  );
};

export default DualModeAnalysis;
