import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import SignaturePadLib from 'signature_pad';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, RotateCcw, ClipboardList, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ReportInfo {
  id: string;
  report_number: string | null;
  report_date: string | null;
  status: string;
  chantier_name: string | null;
  client_name: string | null;
  supervisor_name: string | null;
  submitted_by_name: string | null;
  pdf_url: string | null;
  signed_pdf_url: string | null;
  client_signer_name: string | null;
  client_signed_at: string | null;
}

const ChantierReportSignPage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<ReportInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [isEmpty, setIsEmpty] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  const finalizeReport = async () => {
    if (!token) return;
    setFinalizing(true);
    const { data, error: fnErr } = await supabase.functions.invoke('chantier-report-finalize', {
      body: { token },
    });
    setFinalizing(false);
    if (fnErr || !data || (data as any).error) {
      console.error('[ChantierReportSign] finalize failed', (data as any)?.error || fnErr?.message);
      return;
    }
    setSignedUrl((data as any).signed_pdf_url || null);
  };

  const loadInfo = async () => {
    if (!token) return;
    const { data, error: fnErr } = await supabase.functions.invoke('chantier-report-public', {
      body: { action: 'info', token },
    });
    if (fnErr || !data || (data as any).error) {
      setError((data as any)?.error || 'Lien invalide ou expiré');
      setInfo(null);
    } else {
      setError(null);
      const row = data as ReportInfo;
      setInfo(row);
      if (row.status === 'signe_client') {
        if (row.signed_pdf_url) setSignedUrl(row.signed_pdf_url);
        else await finalizeReport();
      }
    }
  };

  useEffect(() => {
    (async () => {
      await loadInfo();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!info || info.status === 'signe_client') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255,255,255)',
      penColor: 'rgb(0,0,0)',
      minWidth: 0.6,
      maxWidth: 2.5,
    });
    padRef.current = pad;
    pad.addEventListener('endStroke', () => setIsEmpty(pad.isEmpty()));
    return () => pad.off();
  }, [info]);

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSubmit = async () => {
    if (!token || !padRef.current) return;
    if (signerName.trim().length < 2) {
      toast.error('Veuillez saisir votre nom complet');
      return;
    }
    if (padRef.current.isEmpty()) {
      toast.error('Veuillez signer dans le cadre');
      return;
    }
    setSubmitting(true);
    const dataUrl = padRef.current.toDataURL('image/png');
    const { data, error: fnErr } = await supabase.functions.invoke('chantier-report-public', {
      body: { action: 'sign', token, signer_name: signerName.trim(), signature_data: dataUrl },
    });
    setSubmitting(false);
    if (fnErr || !data || (data as any).error) {
      toast.error((data as any)?.error || fnErr?.message || 'Erreur lors de la signature');
      return;
    }
    toast.success('Rapport signé avec succès');
    await loadInfo();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-6 max-w-md text-center">
          <p className="text-lg font-semibold">Lien invalide</p>
          <p className="text-sm text-muted-foreground mt-2">
            Ce lien de signature n'est plus valide ou a expiré.
          </p>
        </Card>
      </div>
    );
  }

  const signed = info.status === 'signe_client';
  const reportDate = info.report_date ? new Date(info.report_date).toLocaleDateString('fr-FR') : '';

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4" dir="ltr">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center">
          <ClipboardList className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold mt-2">Rapport de chantier</h1>
          <p className="text-sm text-muted-foreground">Consultation et signature en ligne</p>
        </div>

        <Card className="p-5 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Rapport n°</p>
              <p className="text-lg font-bold">{info.report_number || '—'}</p>
            </div>
            {reportDate && <p className="text-sm text-muted-foreground">{reportDate}</p>}
          </div>
          {info.chantier_name && (
            <div>
              <p className="text-xs text-muted-foreground">Chantier</p>
              <p className="font-medium">{info.chantier_name}</p>
            </div>
          )}
          {info.client_name && (
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">{info.client_name}</p>
            </div>
          )}
          {(info.submitted_by_name || info.supervisor_name) && (
            <div>
              <p className="text-xs text-muted-foreground">Responsable</p>
              <p className="text-sm">{info.submitted_by_name || info.supervisor_name}</p>
            </div>
          )}
        </Card>

        {info.pdf_url && (
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Rapport PDF</p>
            </div>
            <iframe src={info.pdf_url} title="Rapport de chantier" className="w-full h-[60vh] rounded border bg-white" />
            <Button variant="outline" size="sm" onClick={() => window.open(info.pdf_url!, '_blank', 'noopener')}>
              Ouvrir le PDF
            </Button>
          </Card>
        )}

        {signed ? (
          <Card className="p-6 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
            <p className="text-lg font-semibold">Rapport signé avec succès</p>
            {info.client_signer_name && (
              <p className="text-sm text-muted-foreground">Signé par {info.client_signer_name}</p>
            )}
          </Card>
        ) : (
          <Card className="p-5 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Votre nom complet</label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Nom et prénom"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Votre signature</label>
              <canvas
                ref={canvasRef}
                className="w-full h-40 rounded border bg-white touch-none"
                style={{ touchAction: 'none' }}
              />
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleClear}>
                <RotateCcw className="h-3.5 w-3.5" />
                Effacer
              </Button>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={submitting || isEmpty}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Signer le rapport
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ChantierReportSignPage;
