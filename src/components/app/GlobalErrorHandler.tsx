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
    const normalizeErrorMessage = (value: unknown) => {
      if (typeof value === "string") return value.toLowerCase();
      if (value && typeof value === "object" && "message" in value) {
        const message = (value as { message?: string }).message;
        if (typeof message === "string") return message.toLowerCase();
      }
      return String(value ?? "").toLowerCase();
    };

    const isNonCriticalError = (value: unknown) => {
      const message = normalizeErrorMessage(value);
      return (
        message.includes("row-level security") ||
        message.includes("user_activity_logs") ||
        message.includes("visit_logs") ||
        message.includes("invoice_drafts") ||
        message.includes("failed to fetch") ||
        message.includes("storage") ||
        message.includes("networkerror") ||
        message.includes("aborterror") ||
        message.includes("load failed") ||
        message.includes("anonymous sign-ins are disabled") ||
        message.includes("anonymous sign-in") ||
        message.includes("signinanonymously") ||
        message.includes("signup requires a valid password") ||
        message.includes("/auth/v1/token") ||
        message.includes("authretryablefetcherror")
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isNonCriticalError(event.reason)) {
        event.preventDefault();
        console.debug("Non-critical rejection suppressed:", event.reason);
        return;
      }

      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("error.generic"),
      });
    };

    const handleError = (event: ErrorEvent) => {
      if (isNonCriticalError(event.error ?? event.message)) {
        event.preventDefault();
        console.debug("Non-critical error suppressed:", event.error ?? event.message);
        return;
      }

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
