import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

/**
 * Centralise la gestion des erreurs globales.
 * IMPORTANT: doit rester sous LanguageProvider pour respecter le verrouillage FR/AR.
 */
export default function GlobalErrorHandler() {
  const { t } = useLanguage();

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Ignore non-critical errors (analytics, logging, RLS policy violations)
      const reason = event.reason;
      const message = reason?.message || reason?.toString?.() || '';
      const isNonCritical = 
        message.includes('row-level security') ||
        message.includes('user_activity_logs') ||
        message.includes('visit_logs') ||
        message.includes('invoice_drafts') ||
        message.includes('Failed to fetch') ||
        message.includes('storage') ||
        message.includes('NetworkError') ||
        message.includes('AbortError') ||
        message.includes('Load failed');
      
      if (isNonCritical) {
        event.preventDefault();
        console.debug("Non-critical rejection suppressed:", message);
        return;
      }
      
      console.error("Unhandled promise rejection:", event.reason);
      // Prevent default crash behavior
      event.preventDefault();
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("error.generic"),
      });
    };

    const handleError = (event: ErrorEvent) => {
      console.error("Global error:", event.error);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("error.generic"),
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, [t]);

  return null;
}
