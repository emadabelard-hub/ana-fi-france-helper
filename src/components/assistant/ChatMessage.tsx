import { cn } from '@/lib/utils';
import { User, Bot, Copy, Check, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import LetterSuggestionButton from './LetterSuggestionButton';
import EnvelopeHelper from './EnvelopeHelper';

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
  };
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
}: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isUser = role === 'user';

  // Parse content to separate Arabic from French letter
  const { arabic, frenchLetter } = useMemo(() => parseContent(content), [content]);
  
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
        description: isRTL ? "تم نسخ النص للحافظة" : "Le texte a été copié",
      });
    } catch {
      // Ignore copy errors
    }
  };

  const handleExportPDF = async () => {
    if (!letterRef.current) return;

    setIsExporting(true);

    try {
      const canvas = await html2canvas(letterRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const finalWidth = imgWidth * ratio * 0.95;
      const finalHeight = imgHeight * ratio * 0.95;
      const x = (pdfWidth - finalWidth) / 2;
      const y = 10;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save(`lettre-${Date.now()}.pdf`);

      toast({
        title: isRTL ? "تم التحميل" : "Téléchargé",
        description: isRTL ? "تم حفظ الملف PDF" : "Le fichier PDF a été enregistré",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في إنشاء PDF" : "Échec de la création du PDF",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // No handleDraftReply needed anymore - we use inline button

  return (
    <div
      className={cn(
        "flex gap-3 p-4 rounded-xl",
        isUser 
          ? "bg-primary/10 ml-8" 
          : "bg-muted/50 mr-8",
        isRTL && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {/* Arabic/RTL content */}
        {arabic && (
          <div
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap",
              isRTL && "text-right font-cairo"
            )}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {arabic}
          </div>
        )}

        {/* Letter Suggestion Button - appears when AI suggests writing a letter */}
        {shouldShowLetterButton && (
          <LetterSuggestionButton
            onAccept={onAcceptLetterSuggestion!}
            isLoading={isGeneratingLetter}
            isRTL={isRTL}
          />
        )}

        {/* French Letter Section - professionally formatted */}
        {frenchLetter && (
          <div className="mt-4 border-t border-border pt-4">
            <div className={cn(
              "flex items-center justify-between mb-3 flex-wrap gap-2",
              isRTL && "flex-row-reverse"
            )}>
              <span className={cn(
                "text-xs font-medium text-muted-foreground flex items-center gap-1",
                isRTL && "font-cairo flex-row-reverse"
              )}>
                <FileText className="h-4 w-4" />
                {isRTL ? "الخطاب الرسمي (بالفرنسية)" : "Lettre officielle"}
              </span>
              
              {/* Action Buttons */}
              <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(frenchLetter)}
                  className="h-7 text-xs gap-1"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{isRTL ? "📋 نسخ" : "📋 Copier"}</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="h-7 text-xs gap-1"
                >
                  {isExporting ? (
                    <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  <span>{isRTL ? "📄 PDF" : "📄 PDF"}</span>
                </Button>
              </div>
            </div>
            <div
              ref={letterRef}
              dir="ltr"
              lang="fr"
              className="french-letter bg-white text-black p-6 rounded-lg border shadow-sm"
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{frenchLetter}</div>
            </div>
            
            {/* Envelope Helper - shows recipient address for physical mail */}
            {showEnvelopeHelper && dispatchInfo && (
              <EnvelopeHelper
                recipientName={dispatchInfo.recipientName || ''}
                recipientAddress={dispatchInfo.recipientAddress}
                referenceNumber={dispatchInfo.referenceNumber}
                isRTL={isRTL}
              />
            )}
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
                  {isRTL ? "تم النسخ" : "Copié"}
                </span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span className={isRTL ? "font-cairo" : ""}>
                  {isRTL ? "نسخ" : "Copier"}
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
