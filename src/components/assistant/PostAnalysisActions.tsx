import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageCircle, PenLine, Mail, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExtractedInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subject?: string;
  documentDate?: string;
}

interface PostAnalysisActionsProps {
  onContinueChat: () => void;
  onDraftReply: (mode: 'email' | 'courrier') => void;
  extractedInfo?: ExtractedInfo;
  isRTL?: boolean;
  isGenerating?: boolean;
}

/**
 * Smart action buttons displayed after document analysis.
 * Provides "Ask More" or "Draft Reply" with mode selection.
 */
const PostAnalysisActions = ({
  onContinueChat,
  onDraftReply,
  extractedInfo,
  isRTL = true,
  isGenerating = false,
}: PostAnalysisActionsProps) => {
  const [showModeDialog, setShowModeDialog] = React.useState(false);

  const handleDraftClick = () => {
    setShowModeDialog(true);
  };

  const handleModeSelect = (mode: 'email' | 'courrier') => {
    setShowModeDialog(false);
    onDraftReply(mode);
  };

  return (
    <>
      <div className={cn(
        "mt-4 pt-4 border-t border-border",
        isRTL && "font-cairo"
      )}>
        <p className={cn(
          "text-base font-semibold mb-3",
          isRTL && "text-right"
        )}>
          {isRTL ? '🎯 عايز تعمل إيه دلوقتي؟' : '🎯 Que souhaitez-vous faire?'}
        </p>
        
        <div className={cn(
          "flex gap-3",
          isRTL && "flex-row-reverse"
        )}>
          {/* Ask More Button */}
          <Button
            variant="outline"
            onClick={onContinueChat}
            disabled={isGenerating}
            className={cn(
              "flex-1 gap-2 h-14 text-base",
              isRTL && "flex-row-reverse"
            )}
          >
            <MessageCircle className="h-5 w-5 text-blue-600" />
            <span className="font-medium">
              {isRTL ? '❓ سؤال تاني' : '❓ Question'}
            </span>
          </Button>

          {/* Draft Reply Button */}
          <Button
            variant="default"
            onClick={handleDraftClick}
            disabled={isGenerating}
            className={cn(
              "flex-1 gap-2 h-14 text-base",
              isRTL && "flex-row-reverse"
            )}
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <PenLine className="h-5 w-5" />
            )}
            <span className="font-medium">
              {isGenerating 
                ? (isRTL ? 'جاري الكتابة...' : 'Rédaction...') 
                : (isRTL ? '📝 اكتبلي رد' : '📝 Rédiger')}
            </span>
          </Button>
        </div>

        {/* Show extracted reference if available */}
        {extractedInfo?.referenceNumber && (
          <div className={cn(
            "mt-3 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800",
            isRTL && "text-right"
          )}>
            <p className="text-sm text-green-700 dark:text-green-300">
              📎 {isRTL ? 'رقم المرجع:' : 'Référence:'}{' '}
              <span className="font-mono font-semibold">{extractedInfo.referenceNumber}</span>
            </p>
          </div>
        )}
      </div>

      {/* Mode Selection Dialog */}
      <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <DialogContent className={cn("sm:max-w-[380px]", isRTL && "font-cairo")}>
          <DialogHeader>
            <DialogTitle className={cn("text-xl text-center", isRTL && "font-cairo")}>
              {isRTL ? '📬 هتبعته ازاي؟' : '📬 Mode d\'envoi?'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-3 mt-4">
            {/* Email Option */}
            <Button
              variant="outline"
              onClick={() => handleModeSelect('email')}
              className={cn(
                "h-16 justify-start gap-4 text-lg",
                isRTL && "flex-row-reverse"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div className={cn("text-left", isRTL && "text-right")}>
                <div className="font-semibold">
                  {isRTL ? '📧 إيميل' : '📧 Email'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isRTL ? 'ابعته أونلاين' : 'Envoyer en ligne'}
                </div>
              </div>
            </Button>

            {/* Registered Mail Option */}
            <Button
              variant="outline"
              onClick={() => handleModeSelect('courrier')}
              className={cn(
                "h-16 justify-start gap-4 text-lg",
                isRTL && "flex-row-reverse"
              )}
            >
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Send className="h-6 w-6 text-orange-600" />
              </div>
              <div className={cn("text-left", isRTL && "text-right")}>
                <div className="font-semibold">
                  {isRTL ? '📮 جواب مسجل' : '📮 Courrier Recommandé'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isRTL ? 'بالبوستة للإثبات' : 'Par La Poste avec AR'}
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostAnalysisActions;
