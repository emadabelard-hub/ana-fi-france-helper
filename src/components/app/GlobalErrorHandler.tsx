import { useEffect } from "react";

/**
 * Centralise la gestion des erreurs globales.
 * IMPORTANT: doit rester sous LanguageProvider pour respecter le verrouillage FR/AR.
 */
export default function GlobalErrorHandler() {
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
        message.includes("authretryablefetcherror") ||
        message.includes("function components cannot be given refs") ||
        message.includes("script error") ||
        message.includes("resizeobserver loop") ||
        message.includes("chunkloaderror") ||
        message.includes("loading chunk") ||
        message.includes("favicon") ||
        message.includes("vite")
      );
    };

    const isResourceLoadError = (event: ErrorEvent) => {
      const target = event.target;

      return Boolean(
        target &&
        target !== window &&
        (
          target instanceof HTMLImageElement ||
          target instanceof HTMLScriptElement ||
          target instanceof HTMLLinkElement ||
          target instanceof HTMLSourceElement
        )
      );
    };

    const isEmptyBrowserNoise = (event: ErrorEvent) => {
      const message = typeof event.message === "string" ? event.message.trim() : "";
      return !event.error && message.length === 0;
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = normalizeErrorMessage(event.reason);

      if (!message || isNonCriticalError(event.reason)) {
        event.preventDefault();
        console.debug("Non-critical rejection suppressed:", event.reason);
        return;
      }

      console.error("Unhandled promise rejection:", event.reason);
      event.preventDefault();
    };

    const handleError = (event: ErrorEvent) => {
      if (
        isResourceLoadError(event) ||
        isEmptyBrowserNoise(event) ||
        isNonCriticalError(event.error ?? event.message)
      ) {
        event.preventDefault();
        console.debug("Non-critical error suppressed:", event.error ?? event.message);
        return;
      }

      console.error("Global error:", event.error ?? event.message);
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    // SAFETY NET: Radix Dialog/AlertDialog sometimes leaves <body style="pointer-events: none">
    // after a modal unmounts unexpectedly, blocking ALL clicks app-wide.
    // We watch the body and clear it whenever no Radix dialog is actually open.
    const unlockBodyIfOrphan = () => {
      const body = document.body;
      if (!body) return;
      const hasOpenRadixDialog = document.querySelector(
        '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]'
      );
      if (!hasOpenRadixDialog) {
        if (body.style.pointerEvents === 'none') {
          body.style.pointerEvents = '';
        }
        if (body.hasAttribute('data-scroll-locked')) {
          body.removeAttribute('data-scroll-locked');
        }
      }
    };

    const bodyObserver = new MutationObserver(() => {
      // Defer to next tick so Radix has a chance to settle
      requestAnimationFrame(unlockBodyIfOrphan);
    });
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'data-scroll-locked'],
    });
    // Initial cleanup in case the page was loaded with stale state
    requestAnimationFrame(unlockBodyIfOrphan);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
      bodyObserver.disconnect();
    };
  }, []);

  return null;
}
