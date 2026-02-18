import { cn } from '@/lib/utils';
import { User, Bot, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import LetterSuggestionButton from './LetterSuggestionButton';
import DocumentReadyCard from './DocumentReadyCard';
import DocumentViewerModal from './DocumentViewerModal';
import MarkdownRenderer from './MarkdownRenderer';

interface ExtractedInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subject?: string;
  documentDate?: string;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isRTL?: boolean;
  // Document analysis props
  isDocumentAnalysis?: boolean;
  extractedInfo?: ExtractedInfo;
  // Letter generation props
  showLetterSuggestion?: boolean;
  onAcceptLetterSuggestion?: () => void;
  isGeneratingLetter?: boolean;
  // Envelope/dispatch info
  showEnvelopeHelper?: boolean;
  dispatchInfo?: {
    recipientName?: string;
    recipientAddress?: string;
    referenceNumber?: string;
    subjectLine?: string;
  };
  // When available, keep the full document text OUT of `content`.
  // This prevents context contamination and fixes the “chat loop”.
  letterContent?: string;
}

/**
 * Detects if content contains a French formal letter section.
 * Letters are marked with ===الرسالة_الرسمية=== or contain formal French patterns.
 */
const containsFrenchLetter = (content: string): boolean => {
  // Check for letter marker from AI output
  if (content.includes('===الرسالة_الرسمية===')) return true;
  // Check for common French formal letter patterns
  const frenchPatterns = [
    /Madame,?\s*Monsieur/i,
    /Je soussigné/i,
    /Veuillez agréer/i,
    /salutations distinguées/i,
    /l'expression de mes/i,
    /Objet\s*:/i,
    /À l'attention de/i,
  ];
  return frenchPatterns.some(pattern => pattern.test(content));
};

/**
 * Detects if this message is a document/image analysis response.
 * Analysis responses typically contain الشرح (explanation) and خطة العمل (action plan).
 */
const isAnalysisResponse = (content: string): boolean => {
  const analysisMarkers = [
    '📋 **الشرح:**',
    '✅ **خطة العمل:**',
    '===شرح_المستند===',
    '===خطة_العمل===',
    'تحليل المستند',
    'المستند بيقول',
    'الجواب ده',
    'الخطاب ده',
  ];
  return analysisMarkers.some(marker => content.includes(marker));
};

/**
 * Extract reference numbers and recipient info from analysis content.
 * This is a fallback for when the backend doesn't provide structured data.
 */
const extractInfoFromContent = (content: string): ExtractedInfo => {
  const info: ExtractedInfo = {};
  
  // Extract reference numbers (various formats)
  const refPatterns = [
    /(?:N°|n°|Ref|REF|Référence|رقم المرجع|رقم الملف)[:\s]*([A-Z0-9\-\/]+)/gi,
    /(?:Dossier|ملف)[:\s]*([A-Z0-9\-\/]+)/gi,
    /([A-Z]{2,}\d{4,}[\-\/]?\d*)/g, // Generic reference like CAF2024-12345
  ];
  
  for (const pattern of refPatterns) {
    const match = content.match(pattern);
    if (match) {
      // Extract just the number part
      const numMatch = match[0].match(/[A-Z0-9\-\/]{5,}/i);
      if (numMatch) {
        info.referenceNumber = numMatch[0];
        break;
      }
    }
  }
  
  // Extract recipient names from known institutions
  const institutionPatterns = [
    /(?:جواب|خطاب|رسالة)\s+(?:من|de)\s+(CAF|CPAM|Préfecture|Pôle Emploi|URSSAF)[^.\n,]*/gi,
    /(CAF|CPAM|Préfecture|Pôle Emploi|URSSAF|RSI|Ameli)\s+(?:de\s+)?([A-Za-zÀ-ÿ\s-]+?)(?:[,.\n]|$)/gi,
    /الجهة:\s*(.+?)(?:\n|$)/,
  ];
  
  for (const pattern of institutionPatterns) {
    const match = content.match(pattern);
    if (match) {
      info.recipientName = match[0]
        .replace(/^(?:جواب|خطاب|رسالة)\s+(?:من|de)\s+/i, '')
        .replace(/^الجهة:\s*/i, '')
        .trim();
      break;
    }
  }
  
  // Extract address if present
  const addressMatch = content.match(/العنوان:\s*(.+?)(?:\n|$)/);
  if (addressMatch) {
    info.recipientAddress = addressMatch[1].trim();
  }
  
  // Extract subject from Objet line
  const subjectMatch = content.match(/(?:Objet|الموضوع)\s*:\s*([^\n]+)/i);
  if (subjectMatch) {
    info.subject = subjectMatch[1].trim();
  }
  
  return info;
};

/**
 * Splits content into Arabic explanation and French letter sections.
 */
const parseContent = (content: string): { arabic: string; frenchLetter: string | null } => {
  const letterMarker = '===الرسالة_الرسمية===';
  const nextMarker = /===[\u0600-\u06FF_]+===/g;
  
  if (content.includes(letterMarker)) {
    const parts = content.split(letterMarker);
    const arabicPart = parts[0].trim();
    let frenchPart = parts[1] || '';
    
    // Remove any following markers (like ===ملاحظات_قانونية===)
    const nextMatch = frenchPart.match(nextMarker);
    if (nextMatch) {
      frenchPart = frenchPart.split(nextMatch[0])[0];
    }
    
    return {
      arabic: arabicPart,
      frenchLetter: frenchPart.trim() || null,
    };
  }
  
  return { arabic: content, frenchLetter: null };
};

const ChatMessage = ({ 
  role, 
  content, 
  isRTL = true,
  isDocumentAnalysis,
  extractedInfo: propExtractedInfo,
  showLetterSuggestion = false,
  onAcceptLetterSuggestion,
  isGeneratingLetter = false,
  showEnvelopeHelper = false,
  dispatchInfo,
  letterContent,
}: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const { toast } = useToast();
  const isUser = role === 'user';

  // Parse content to separate Arabic from French letter
  const { arabic, frenchLetter: parsedFrenchLetter } = useMemo(() => parseContent(content), [content]);
  const frenchLetter = useMemo(() => {
    const direct = typeof letterContent === 'string' ? letterContent.trim() : '';
    if (direct) return direct;
    return parsedFrenchLetter;
  }, [letterContent, parsedFrenchLetter]);
  
  // Detect if this is an analysis message
  const isAnalysis = useMemo(() => 
    !isUser && (isDocumentAnalysis || isAnalysisResponse(content)), 
    [isUser, isDocumentAnalysis, content]
  );
  
  // Extract info from content if not provided
  const extractedInfo = useMemo(() => 
    propExtractedInfo || (isAnalysis ? extractInfoFromContent(content) : undefined),
    [propExtractedInfo, isAnalysis, content]
  );
  
  // Detect if AI is suggesting to write a letter (contains the suggestion prompt)
  const hasSuggestionPrompt = useMemo(() => 
    content.includes('تحب أكتبلك خطاب رسمي') || 
    content.includes("لو عايز أكتبلك رد رسمي، قولي"),
    [content]
  );
  
  // Show inline button when: AI suggests letter, callback provided, and not already showing letter
  const shouldShowLetterButton = showLetterSuggestion && hasSuggestionPrompt && onAcceptLetterSuggestion && !frenchLetter;

  const handleCopy = async (textToCopy?: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy || content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: isRTL ? "تم النسخ" : "Copié",
        description: isRTL ? "النص اتنسخ" : "Le texte a été copié",
      });
    } catch {
      // Ignore copy errors
    }
  };

  // No inline document rendering anymore — document opens in a dedicated viewer modal.

  return (
    <div
      className={cn(
        // Force internal padding so RTL Arabic never touches the bubble edge.
        // Spec requested: padding: 15px 20px !important; + border-box sizing.
        "flex gap-4 rounded-xl box-border !py-[15px] !px-5",
        // Maximum width: bubbles take ~98% width on mobile (only 1% margin each side)
        "mx-[1%] sm:mx-[2%]",
        // Background colors only, no directional offsets to maximize width
        isUser ? "bg-primary/10" : "bg-muted/50",
        isRTL && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content - with internal padding for breathing room */}
      <div className={cn(
        // min-w-0 is critical in flex layouts so long words can wrap instead of overflowing.
        "flex-1 min-w-0 space-y-4",
        // Extra padding inside content area for text breathing room
        isRTL ? "pr-3 pl-1" : "pl-3 pr-1"
      )}>
        {/* Arabic/RTL content */}
        {arabic && (
          isUser ? (
            <div
              className={cn(
                "text-[17px] whitespace-pre-line break-words font-medium",
                isRTL && "text-justify text-right font-cairo leading-[2.2] pr-2",
                !isRTL && "leading-[1.6] pl-2"
              )}
              dir={isRTL ? "rtl" : "ltr"}
            >
              {arabic}
            </div>
          ) : (
            <MarkdownRenderer
              content={arabic}
              isRTL={isRTL}
              className="text-[15px] leading-[1.7] font-medium break-words"
            />
          )
        )}

        {/* Letter Suggestion Button - appears when AI suggests writing a letter */}
        {shouldShowLetterButton && (
          <LetterSuggestionButton
            onAccept={onAcceptLetterSuggestion!}
            isLoading={isGeneratingLetter}
            isRTL={isRTL}
          />
        )}

        {/* Document Ready Card + Fullscreen Viewer */}
        {frenchLetter && (
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
              documentText={frenchLetter}
              dispatchInfo={showEnvelopeHelper ? dispatchInfo : undefined}
            />
          </div>
        )}

        {/* Copy button for assistant messages (whole message) */}
        {!isUser && !frenchLetter && !shouldShowLetterButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy()}
            className={cn("h-7 text-xs gap-1", isRTL && "flex-row-reverse")}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                <span className={isRTL ? "font-cairo" : ""}>
                  {isRTL ? "اتنسخ" : "Copié"}
                </span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span className={isRTL ? "font-cairo" : ""}>
                  {isRTL ? "انسخ" : "Copier"}
                </span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
