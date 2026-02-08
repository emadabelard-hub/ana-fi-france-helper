import React from "react";
import { cn } from "@/lib/utils";
import { Mail, User, FileText } from "lucide-react";

export type AssistantQuickAction = "mail" | "cv" | "invoice";

interface QuickActionsBarProps {
  isRTL: boolean;
  onAction: (action: AssistantQuickAction) => void;
  className?: string;
}

const QuickActionsBar = ({ isRTL, onAction, className }: QuickActionsBarProps) => {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <button
        type="button"
        onClick={() => onAction("mail")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground",
          "hover:bg-muted active:scale-[0.99] transition",
          isRTL && "font-cairo"
        )}
      >
        <Mail className="h-4 w-4 text-primary" />
        <span>{isRTL ? "خطاب" : "Courrier"}</span>
      </button>

      <button
        type="button"
        onClick={() => onAction("cv")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground",
          "hover:bg-muted active:scale-[0.99] transition",
          isRTL && "font-cairo"
        )}
      >
        <User className="h-4 w-4 text-primary" />
        <span>{isRTL ? "CV" : "CV"}</span>
      </button>

      <button
        type="button"
        onClick={() => onAction("invoice")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground",
          "hover:bg-muted active:scale-[0.99] transition",
          isRTL && "font-cairo"
        )}
      >
        <FileText className="h-4 w-4 text-primary" />
        <span>{isRTL ? "فاتورة" : "Facture"}</span>
      </button>
    </div>
  );
};

export default QuickActionsBar;
