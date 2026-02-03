import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageCircle, PenLine } from 'lucide-react';

interface ExtractedInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subject?: string;
  documentDate?: string;
}

interface PostAnalysisActionsProps {
  onContinueChat: () => void;
  onDraftReply: () => void;
  extractedInfo?: ExtractedInfo;
  isRTL?: boolean;
}

/**
 * Action buttons displayed after document analysis.
 * Provides options to either continue discussing or draft a formal reply.
 */
const PostAnalysisActions = ({
  onContinueChat,
  onDraftReply,
  extractedInfo,
  isRTL = true,
}: PostAnalysisActionsProps) => {
  return (
    <div className={cn(
      "mt-4 pt-4 border-t border-border",
      isRTL && "font-cairo"
    )}>
      <p className={cn(
        "text-sm font-medium mb-3",
        isRTL && "text-right"
      )}>
        {isRTL ? '🎯 إيه اللي عايز تعمله دلوقتي؟' : '🎯 Que souhaitez-vous faire?'}
      </p>
      
      <div className={cn(
        "flex gap-2 flex-wrap",
        isRTL && "flex-row-reverse"
      )}>
        {/* Continue Discussion Button */}
        <Button
          variant="outline"
          onClick={onContinueChat}
          className={cn(
            "flex-1 min-w-[140px] gap-2 h-auto py-3",
            isRTL && "flex-row-reverse"
          )}
        >
          <MessageCircle className="h-4 w-4 text-blue-600" />
          <div className={cn("text-left", isRTL && "text-right")}>
            <div className="font-medium text-sm">
              {isRTL ? 'كمّل الكلام' : 'Continuer'}
            </div>
            <div className="text-xs text-muted-foreground">
              {isRTL ? 'اسألني أي سؤال' : 'Posez vos questions'}
            </div>
          </div>
        </Button>

        {/* Draft Reply Button */}
        <Button
          variant="default"
          onClick={onDraftReply}
          className={cn(
            "flex-1 min-w-[140px] gap-2 h-auto py-3",
            isRTL && "flex-row-reverse"
          )}
        >
          <PenLine className="h-4 w-4" />
          <div className={cn("text-left", isRTL && "text-right")}>
            <div className="font-medium text-sm">
              {isRTL ? '✍️ اكتبلي رد' : '✍️ Rédiger'}
            </div>
            <div className="text-xs opacity-90">
              {isRTL ? 'جواب رسمي بالفرنسي' : 'Lettre officielle'}
            </div>
          </div>
        </Button>
      </div>

      {/* Show extracted reference if available */}
      {extractedInfo?.referenceNumber && (
        <div className={cn(
          "mt-3 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800",
          isRTL && "text-right"
        )}>
          <p className="text-xs text-green-700 dark:text-green-300">
            📎 {isRTL ? 'تم استخراج رقم المرجع:' : 'Référence extraite:'}{' '}
            <span className="font-mono font-medium">{extractedInfo.referenceNumber}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default PostAnalysisActions;
