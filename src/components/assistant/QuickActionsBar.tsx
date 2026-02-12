import React from "react";
import { cn } from "@/lib/utils";
import { Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type AssistantQuickAction = "mail";

interface QuickActionsBarProps {
  onAction: (action: AssistantQuickAction) => void;
  className?: string;
}

const QuickActionsBar = ({ onAction, className }: QuickActionsBarProps) => {
  const { isRTL } = useLanguage();

  return (
    <div className={cn("flex justify-center", className)}>
      <button
        type="button"
        onClick={() => onAction("mail")}
        className={cn(
          "flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-full",
          "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
          "border border-emerald-200 dark:border-emerald-700",
          "text-xs font-bold shadow-sm",
          "active:scale-95 transition-transform",
          isRTL && "font-cairo"
        )}
      >
        <Mail className="h-4 w-4" />
        <span>مراسلات الجهات الرسمية والحكومية والإدارية والطبية وغيره</span>
      </button>
    </div>
  );
};

export default QuickActionsBar;
