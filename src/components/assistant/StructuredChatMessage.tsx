import React, { useState, useMemo } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { cn } from '@/lib/utils';
import { 
  Sparkles, AlertTriangle, Lightbulb, CheckCircle2, 
  FileText, ChevronRight, Scale, Copy, Check, Wrench, User, ArrowRightCircle, Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import DocumentReadyCard from './DocumentReadyCard';
import DocumentViewerModal from './DocumentViewerModal';

interface ExtractedInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subject?: string;
  documentDate?: string;
}

interface StructuredStep {
  icon: 'alert' | 'lightbulb' | 'check' | 'scale';
  text: string;
}

interface ActionItem {
  label: string;
  route: string;
}

interface StructuredChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isRTL?: boolean;
  isDocumentAnalysis?: boolean;
  extractedInfo?: ExtractedInfo;
  showEnvelopeHelper?: boolean;
  dispatchInfo?: {
    recipientName?: string;
    recipientAddress?: string;
    referenceNumber?: string;
    subjectLine?: string;
  };
  letterContent?: string;
  // Actions - now support both strings and action objects
  suggestedActions?: (string | ActionItem)[];
  onActionClick?: (action: string, route?: string) => void;
}

const getStepIcon = (iconType: StructuredStep['icon']) => {
  switch (iconType) {
    case 'alert':
      return <AlertTriangle className="text-orange-500" size={18} />;
    case 'lightbulb':
      return <Lightbulb className="text-yellow-500" size={18} />;
    case 'check':
      return <CheckCircle2 className="text-green-500" size={18} />;
    case 'scale':
      return <Scale className="text-blue-500" size={18} />;
    default:
      return <Lightbulb className="text-yellow-500" size={18} />;
  }
};

/**
 * Parse AI content into structured format
 * Looks for markers like 📋, ✅, ⚖️ to create steps
 */
const parseStructuredContent = (content: string): {
  title: string;
  steps: StructuredStep[];
  actions: string[];
  rawContent: string;
} => {
  const lines = content.split('\n').filter(line => line.trim());
  const steps: StructuredStep[] = [];
  let title = '';
  let actions: string[] = [];
  let rawContent = content;

  // Try to extract a reassuring title from the first meaningful line
  const firstLine = lines[0] || '';
  if (!firstLine.includes('📋') && !firstLine.includes('✅') && !firstLine.startsWith('**')) {
    title = firstLine.replace(/^[#*]+\s*/, '').trim();
  }

  // Parse structured sections
  lines.forEach((line, index) => {
    const cleanLine = line.replace(/^\*\*|\*\*$/g, '').trim();
    
    // Explanation section
    if (line.includes('📋') || line.includes('الشرح')) {
      const text = lines[index + 1]?.trim() || cleanLine.replace(/📋.*?:?\s*/, '');
      if (text && !text.includes('📋')) {
        steps.push({ icon: 'lightbulb', text });
      }
    }
    // Action plan section
    else if (line.includes('✅') || line.includes('خطة العمل')) {
      const text = lines[index + 1]?.trim() || cleanLine.replace(/✅.*?:?\s*/, '');
      if (text && !text.includes('✅')) {
        steps.push({ icon: 'check', text });
      }
    }
    // Legal notes section
    else if (line.includes('⚖️') || line.includes('ملاحظات قانونية')) {
      const text = lines[index + 1]?.trim() || cleanLine.replace(/⚖️.*?:?\s*/, '');
      if (text && !text.includes('⚖️')) {
        steps.push({ icon: 'scale', text });
      }
    }
    // Warning/Alert
    else if (line.includes('⚠️') || line.includes('تحذير')) {
      steps.push({ icon: 'alert', text: cleanLine.replace(/⚠️\s*/, '') });
    }
    // Letter suggestion
    else if (line.includes('تحب أكتبلك خطاب رسمي') || line.includes('اكتبلي رد')) {
      actions.push('اكتب الخطاب الرسمي');
    }
  });

  // If no structured content found, create a simple step from content
  if (steps.length === 0 && content.trim()) {
    // Split by numbered items or bullet points
    const bulletLines = content.split(/[\n\r]+/).filter(l => 
      l.trim().match(/^[\d\-•\*\u0660-\u0669]/) || l.trim().length > 20
    );
    
    if (bulletLines.length > 1) {
      bulletLines.slice(0, 4).forEach((line, i) => {
        const cleanLine = line.replace(/^[\d\-•\*\.\)\u0660-\u0669]+\s*/, '').trim();
        if (cleanLine) {
          steps.push({ 
            icon: i === 0 ? 'lightbulb' : i === bulletLines.length - 1 ? 'check' : 'alert', 
            text: cleanLine 
          });
        }
      });
    }
  }

  // Generate default title if none found
  if (!title && steps.length > 0) {
    title = 'خليك مطمئن، هنحل المشكلة سوا 👌';
  }

  // Default actions if AI suggested letter writing
  if (actions.length === 0 && content.includes('تحب أكتبلك')) {
    actions = ['اكتب الخطاب الرسمي', 'اسأل سؤال تاني'];
  }

  return { title, steps, actions, rawContent };
};

const StructuredChatMessage = ({
  role,
  content,
  isRTL = true,
  isDocumentAnalysis,
  extractedInfo,
  showEnvelopeHelper = false,
  dispatchInfo,
  letterContent,
  suggestedActions = [],
  onActionClick,
}: StructuredChatMessageProps) => {
  const [copied, setCopied] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const { toast } = useToast();
  const isUser = role === 'user';

  // Parse structured content for assistant messages
  const { title, steps, actions: parsedActions, rawContent } = useMemo(
    () => isUser ? { title: '', steps: [], actions: [], rawContent: content } : parseStructuredContent(content),
    [content, isUser]
  );

  // Normalize actions to ActionItem format for consistency
  const normalizedActions: ActionItem[] = useMemo(() => {
    const combined = [...suggestedActions, ...parsedActions];
    return combined.filter((v, i, a) => {
      const getLabel = (item: string | ActionItem) => typeof item === 'object' ? item.label : item;
      return a.findIndex(x => getLabel(x) === getLabel(v)) === i;
    }).map(action => {
      if (typeof action === 'object') return action;
      return { label: action, route: '' };
    });
  }, [suggestedActions, parsedActions]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: isRTL ? "تم النسخ" : "Copié",
        description: isRTL ? "تم نسخ النص للحافظة" : "Le texte a été copié",
      });
    } catch {
      // Ignore copy errors
    }
  };

  // User message - simple bubble style
  if (isUser) {
    return (
      <div className={cn("flex", isRTL ? "justify-start" : "justify-end")}>
        <div className={cn(
          "bg-primary text-primary-foreground p-4 rounded-2xl max-w-[85%] shadow-md text-sm font-medium",
          isRTL ? "rounded-tr-none font-cairo" : "rounded-tl-none"
        )}>
          {content}
        </div>
      </div>
    );
  }

  // Has document to show
  const hasDocument = !!letterContent;

  // Assistant message - structured format
  return (
    <div className={cn("flex gap-3", isRTL ? "justify-start flex-row-reverse" : "justify-start")}>
      {/* AI Avatar */}
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
        <Sparkles size={14} className="text-primary" />
      </div>

      <div className="max-w-[95%] space-y-3 animate-in slide-in-from-left-4 fade-in duration-500 w-full">
        {/* Structured Response Card */}
        {(title || steps.length > 0) ? (
          <div className={cn(
            "bg-card p-5 rounded-2xl shadow-sm border border-border",
            isRTL ? "text-right rounded-tr-none font-cairo" : "text-left rounded-tl-none"
          )}>
            {/* Title */}
            {title && (
              <h3 className={cn(
                "font-black text-card-foreground text-sm mb-4 flex items-center gap-2 border-b border-border pb-3",
                isRTL && "flex-row-reverse"
              )}>
                {!isRTL && <Lightbulb size={18} className="text-yellow-500" />}
                {title}
                {isRTL && <Lightbulb size={18} className="text-yellow-500" />}
              </h3>
            )}

            {/* Steps */}
            {steps.length > 0 && (
              <div className="space-y-0">
                {steps.map((step, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "py-3 border-b border-border last:border-0 flex gap-3 items-start",
                      isRTL && "flex-row-reverse"
                    )}
                  >
                    <div className="mt-0.5 shrink-0 bg-muted p-1.5 rounded-lg">
                      {getStepIcon(step.icon)}
                    </div>
                    <p className={cn(
                      "text-[13px] text-muted-foreground font-medium leading-snug pt-1",
                      isRTL && "font-cairo leading-relaxed"
                    )}>
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            {normalizedActions.length > 0 && onActionClick && (
              <div className="mt-6 space-y-2">
                <p className={cn(
                  "text-[9px] font-black text-muted-foreground uppercase tracking-widest",
                  isRTL && "text-right"
                )}>
                  {isRTL ? 'الحل عندنا:' : 'LA SOLUTION ANA FI FRANCE :'}
                </p>
                {normalizedActions.map((action, i) => {
                  const actionLabel = action.label;
                  const actionRoute = action.route || undefined;
                  
                  // Determine icon based on route or label
                  const getActionIcon = () => {
                    if (actionRoute === 'cv' || actionLabel.includes("CV") || actionLabel.includes("سيرة")) {
                      return <User size={18} className="text-primary-foreground/70" />;
                    }
                    if (actionRoute === 'invoice-edit' || actionLabel.includes("Facture") || actionLabel.includes("Devis") || actionLabel.includes("فاتورة") || actionLabel.includes("دوفي")) {
                      return <FileText size={18} className="text-primary-foreground/70" />;
                    }
                    return <ArrowRightCircle size={18} className="text-primary-foreground/70" />;
                  };

                  return (
                    <button
                      key={i}
                      onClick={() => onActionClick(actionLabel, actionRoute)}
                      className={cn(
                        "w-full bg-primary text-primary-foreground p-3.5 rounded-xl flex items-center justify-between font-black text-xs shadow-lg active:scale-[0.98] transition-all",
                        isRTL && "flex-row-reverse"
                      )}
                    >
                      <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                        {getActionIcon()}
                        <span className={isRTL ? "font-cairo" : ""}>{actionLabel}</span>
                      </div>
                      <ChevronRight size={16} className={cn("text-primary-foreground", isRTL && "rotate-180")} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Copy button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className={cn("mt-4 h-7 text-xs gap-1", isRTL && "flex-row-reverse")}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  <span className={isRTL ? "font-cairo" : ""}>{isRTL ? "تم النسخ" : "Copié"}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span className={isRTL ? "font-cairo" : ""}>{isRTL ? "نسخ" : "Copier"}</span>
                </>
              )}
            </Button>
          </div>
        ) : (
          // Simple text response (fallback)
          <div className={cn(
            "bg-card p-5 rounded-2xl shadow-sm border border-border",
            isRTL ? "text-right font-cairo rounded-tr-none" : "text-left rounded-tl-none"
          )}>
            <MarkdownRenderer content={content} isRTL={isRTL} />
          </div>
        )}

        {/* Document Ready Card + Fullscreen Viewer */}
        {hasDocument && (
          <div className="mt-4 border-t border-border pt-4">
            <DocumentReadyCard
              title={dispatchInfo?.subjectLine || extractedInfo?.subject}
              isRTL={isRTL}
              onOpen={() => setIsViewerOpen(true)}
            />
            <DocumentViewerModal
              open={isViewerOpen}
              onOpenChange={setIsViewerOpen}
              isRTL={isRTL}
              title={dispatchInfo?.subjectLine || extractedInfo?.subject}
              documentText={letterContent!}
              dispatchInfo={showEnvelopeHelper ? dispatchInfo : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StructuredChatMessage;
