import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { splitPdfPageIntoZones, type PdfZoneSplitResult } from '@/lib/pdfZoneTest';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import { supabase } from '@/integrations/supabase/client';

/**
 * TEST ISOLÉ (non exposé publiquement) — route /dev/zone-vision-test.
 * Découpe UNE page d'un PDF en 4 zones avec chevauchement et les envoie
 * seules à Claude. N'affecte pas l'Assistant IA normal.
 */
const ZoneVisionTestPage = () => {
  const [pageNumber, setPageNumber] = useState(1);
  const [prompt, setPrompt] = useState(
    'Lisez attentivement ces 4 zones d\'une même page de plan technique. Listez toutes les cotes, annotations et repères que vous pouvez lire, en précisant la zone.',
  );
  const [split, setSplit] = useState<PdfZoneSplitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setAnswer('');
    setSplit(null);
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error('read_failed'));
        r.readAsDataURL(file);
      });
      const res = await splitPdfPageIntoZones(dataUrl, pageNumber);
      setSplit(res);
      console.log('[zone-test] page_test=' + res.pageNumber);
      console.log('[zone-test] zones_generated=' + res.zones.length);
      res.zones.forEach((z) =>
        console.log(`[zone-test] dimensions_zone_${z.index}=${z.width}x${z.height} (~${Math.round(z.approxBytes / 1024)} Ko)`),
      );
    } catch (err) {
      console.error(err);
      setError('Découpage impossible.');
    }
    setBusy(false);
  };

  const send = async () => {
    if (!split) return;
    setBusy(true);
    setError('');
    setAnswer('');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zone-vision-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt,
          pageTest: split.pageNumber,
          zones: split.zones.map((z) => ({
            index: z.index,
            label: z.label,
            dataUrl: z.dataUrl,
            width: z.width,
            height: z.height,
          })),
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(String(json?.error ?? 'erreur'));
      } else {
        setAnswer(String(json?.text ?? ''));
        console.log('[zone-test] provider_used=' + json?.provider_used);
      }
    } catch (err) {
      console.error(err);
      setError('Erreur réseau.');
    }
    setBusy(false);
  };

  return (
    <div className="p-4 space-y-4 pb-32" dir="ltr" lang="fr">
      <h1 className="text-lg font-bold text-foreground">Test isolé — lecture par zones</h1>
      <p className="text-xs text-muted-foreground">
        Une seule page, 4 zones avec chevauchement, envoyées seules à Claude.
      </p>

      <div className="flex flex-col gap-3">
        <input type="file" accept="application/pdf" onChange={onFile} className="w-full text-sm" />
        <div className="flex items-center gap-2">
          <label className="text-sm text-foreground">Page&nbsp;:</label>
          <input
            type="text"
            inputMode="numeric"
            value={pageNumber}
            onChange={(e) => setPageNumber(Math.max(1, parseInt(e.target.value.replace(/\D/g, '') || '1', 10)))}
            className="w-20 rounded-md border border-border bg-background px-2 py-2 text-base"
          />
        </div>
      </div>

      <Textarea rows={8} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full text-base min-h-[200px]" />

      {split && (
        <div className="rounded-xl border border-border p-3 space-y-2 text-xs text-muted-foreground">
          <p>
            Page rendue : {split.pageWidth}×{split.pageHeight} px (échelle ×{split.renderScale}) — page {split.pageNumber}/{split.pageCount}
          </p>
          <p>
            Chevauchement : {Math.round(split.overlapRatio * 100)} % — JPEG qualité {split.jpegQuality}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {split.zones.map((z) => (
              <div key={z.index} className="space-y-1">
                <p className="text-foreground">
                  ZONE {z.index}/4 — {z.label} — {z.width}×{z.height} — ~{Math.round(z.approxBytes / 1024)} Ko
                </p>
                <img src={z.dataUrl} alt="" className="w-full rounded border border-border" />
              </div>
            ))}
          </div>
        </div>
      )}

      <Button onClick={send} disabled={!split || busy} className="w-full">
        {busy ? <Loader2 className="animate-spin" size={16} /> : 'Envoyer les 4 zones à Claude'}
      </Button>

      {error && <p className="text-xs text-muted-foreground">{error}</p>}
      {answer && (
        <div className="rounded-xl bg-muted p-3">
          <MarkdownRenderer content={answer} isRTL={false} />
        </div>
      )}
    </div>
  );
};

export default ZoneVisionTestPage;
