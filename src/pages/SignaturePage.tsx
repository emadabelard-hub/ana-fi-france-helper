import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import SignaturePadLib from 'signature_pad';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, RotateCcw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Snapshot {
  document_number?: string;
  document_type?: string;
  client_name?: string;
  total_ttc?: number;
  nature_operation?: string;
  date?: string;
  artisan_name?: string;
}

interface SignatureRow {
  id: string;
  status: string;
  signer_name: string | null;
  signed_at: string | null;
  document_snapshot: Snapshot;
  created_at: string;
}

const formatEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

const SignaturePage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [row, setRow] = useState<SignatureRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [isEmpty, setIsEmpty] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase.rpc('get_signature_request_by_token', { _token: token });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setError('Lien invalide ou expiré');
      } else {
        setRow(Array.isArray(data) ? (data[0] as any) : (data as any));
      }
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    if (!row || row.status === 'signed') return;
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
  }, [row]);

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
    const { error } = await supabase.rpc('submit_signature', {
      _token: token,
      _signer_name: signerName.trim(),
      _signature_data: dataUrl,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || 'Erreur lors de la signature');
      return;
    }
    toast.success('Document signé avec succès');
    // refresh row
    const { data } = await supabase.rpc('get_signature_request_by_token', { _token: token });
    if (data) setRow(Array.isArray(data) ? (data[0] as any) : (data as any));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !row) {
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

  const snap = row.document_snapshot || {};
  const docDate = snap.date ? new Date(snap.date).toLocaleDateString('fr-FR') : '';
  const docTypeLabel = (snap.document_type || 'document').toLowerCase() === 'facture' ? 'la facture' : 'le devis';

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="text-center">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold mt-2">Signature électronique</h1>
          <p className="text-sm text-muted-foreground">
            Document à signer en ligne
          </p>
        </div>

        <Card className="p-5 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {snap.document_type === 'facture' ? 'Facture' : 'Devis'} n°
              </p>
              <p className="text-lg font-bold">{snap.document_number || '—'}</p>
            </div>
            {docDate && <p className="text-sm text-muted-foreground">{docDate}</p>}
          </div>
          {snap.client_name && (
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">{snap.client_name}</p>
            </div>
          )}
          {snap.nature_operation && (
            <div>
              <p className="text-xs text-muted-foreground">Objet</p>
              <p className="text-sm">{snap.nature_operation}</p>
            </div>
          )}
          {typeof snap.total_ttc === 'number' && (
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-sm font-medium">Total TTC</span>
              <span className="text-lg font-bold text-primary">{formatEUR(snap.total_ttc)}</span>
            </div>
          )}
        </Card>

        {row.status === 'signed' ? (
          <Card className="p-6 text-center bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <p className="mt-3 text-lg font-semibold">Document signé</p>
            <p className="text-sm text-muted-foreground">
              Signé par <strong>{row.signer_name}</strong>
              {row.signed_at && <> le {new Date(row.signed_at).toLocaleDateString('fr-FR')}</>}
            </p>
            {row.document_snapshot?.artisan_name && (
              <p className="text-xs text-muted-foreground mt-2">
                Une copie a été transmise à {row.document_snapshot.artisan_name}.
              </p>
            )}
          </Card>
        ) : (
          <Card className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium">Votre nom complet</label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Prénom NOM"
                className="mt-1"
                lang="fr"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Signature</label>
              <div className="relative mt-1 border-2 border-dashed border-primary/40 rounded-lg bg-white overflow-hidden">
                <canvas ref={canvasRef} className="w-full touch-none" style={{ height: 180 }} />
                {isEmpty && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-muted-foreground/60 text-sm">✍️ Signez ici avec votre doigt</p>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isEmpty}
                className="mt-2"
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Effacer
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/50 p-3 rounded">
              En signant, vous acceptez {docTypeLabel} n° <strong>{snap.document_number}</strong>
              {docDate && <> du {docDate}</>} — Mention manuscrite : <em>Bon pour accord</em>
            </p>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-6 text-base"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
              Je signe et accepte
            </Button>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Signature sécurisée — anafypro.com
        </p>
      </div>
    </div>
  );
};

export default SignaturePage;
