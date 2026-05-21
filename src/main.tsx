import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(<App />);
