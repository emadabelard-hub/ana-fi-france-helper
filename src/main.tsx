import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { recoverStaleChunk } from "./lib/staleChunkRecovery";

// Vite emits this BEFORE a rejected lazy import reaches React and unmounts the app.
window.addEventListener("vite:preloadError", (event) => {
  const error = (event as Event & { payload?: unknown }).payload;
  if (recoverStaleChunk(error)) event.preventDefault();
});

const clearLegacyServiceWorkerCaches = async () => {
  if (typeof window === "undefined") return;

  const wasServiceWorkerControlled =
    "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);

  await Promise.allSettled([
    "serviceWorker" in navigator
      ? navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister())),
          )
      : Promise.resolve(),
    "caches" in window
      ? caches.keys().then((cacheNames) => Promise.all(cacheNames.map((name) => caches.delete(name))))
      : Promise.resolve(),
  ]);

  if (wasServiceWorkerControlled && sessionStorage.getItem("legacy-sw-cleared") !== "true") {
    sessionStorage.setItem("legacy-sw-cleared", "true");
    window.location.reload();
  }
};

void clearLegacyServiceWorkerCaches();

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
