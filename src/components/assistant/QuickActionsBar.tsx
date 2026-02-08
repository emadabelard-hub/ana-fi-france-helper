import React from "react";
import { cn } from "@/lib/utils";
import { Mail, User, FileText } from "lucide-react";

export type AssistantQuickAction = "mail" | "cv" | "invoice";

interface QuickActionsBarProps {
  isRTL: boolean;
  onAction: (action: AssistantQuickAction) => void;
  className?: string;
}

/**
 * 3 Fixed Action Buttons - Always visible above keyboard
 * Labels in Egyptian Arabic as per spec
 */
const QuickActionsBar = ({ isRTL, onAction, className }: QuickActionsBarProps) => {
  return (
    <div className={cn("flex justify-center gap-3", className)}>
      {/* CV Button */}
      <button
        type="button"
        onClick={() => onAction("cv")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-full",
          "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
          "border border-indigo-200 dark:border-indigo-700",
          "text-xs font-bold shadow-sm",
          "active:scale-95 transition-transform",
          "font-cairo"
        )}
      >
        <User className="h-4 w-4" />
        <span>👤 عايز تعمل سي في</span>
      </button>

      {/* Invoice Button */}
      <button
        type="button"
        onClick={() => onAction("invoice")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-full",
          "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
          "border border-orange-200 dark:border-orange-700",
          "text-xs font-bold shadow-sm",
          "active:scale-95 transition-transform",
          "font-cairo"
        )}
      >
        <FileText className="h-4 w-4" />
        <span>📄 عايز تكتب فاتورة</span>
      </button>

      {/* Mail Reply Button */}
      <button
        type="button"
        onClick={() => onAction("mail")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-full",
          "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
          "border border-emerald-200 dark:border-emerald-700",
          "text-xs font-bold shadow-sm",
          "active:scale-95 transition-transform",
          "font-cairo"
        )}
      >
        <Mail className="h-4 w-4" />
        <span>✉️ الرد على خطاب</span>
      </button>
    </div>
  );
};

export default QuickActionsBar;
