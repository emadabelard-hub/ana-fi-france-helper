import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Empreinte de version = liste des scripts/styles hachés servis par index.html
const extractFingerprint = (html: string) => {
  const matches = html.match(/(?:src|href)="\/assets\/[^"]+"/g);
  if (!matches || matches.length === 0) return null;
  return matches.sort().join('|');
};

const fetchFingerprint = async (): Promise<string | null> => {
  try {
    const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return extractFingerprint(await res.text());
  } catch {
    return null;
  }
};

const AppUpdateBanner = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const baselineRef = useRef<string | null>(null);

  const check = useCallback(async () => {
    const fingerprint = await fetchFingerprint();
    if (!fingerprint) return;
    if (baselineRef.current === null) {
      baselineRef.current = fingerprint;
      return;
    }
    if (fingerprint !== baselineRef.current) setUpdateAvailable(true);
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [check]);

  // Rechargement complet : aucune donnée locale n'est effacée, la session reste intacte
  const handleUpdate = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now().toString());
    window.location.replace(url.toString());
  };

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      lang="fr"
      dir="ltr"
      className="fixed inset-x-0 bottom-16 z-[60] mx-auto flex w-[calc(100%-1rem)] max-w-md items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur md:bottom-4"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm font-medium text-foreground">
        Une nouvelle version d'ANAFYPRO est disponible.
      </p>
      <Button size="sm" onClick={handleUpdate} className="shrink-0">
        Mettre à jour
      </Button>
    </div>
  );
};

export default AppUpdateBanner;
