import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import SignaturePadLib from 'signature_pad';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, RotateCcw, ShieldCheck, Download, Mail, FileText } from 'lucide-react';
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

interface SignatureInfo {
  id: string;
  status: string;
  signer_name: string | null;
  signed_at: string | null;
  document_snapshot: Snapshot;
  created_at: string;
  original_pdf_url: string | null;
  signed_pdf_url: string | null;
  document_number?: string;
  document_type?: string;
}

const formatEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

const SignaturePage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<SignatureInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [isEmpty, setIsEmpty] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [showEmailField, setShowEmailField] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  const loadInfo = async () => {
    if (!token) return;
    const { data, error } = await supabase.functions.invoke('signature-info', { body: { token } });
    if (error || !data || (data as any).error) {
      setError((data as any)?.error || 'Lien invalide ou expiré');
    } else {
      setInfo(data as SignatureInfo);
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
    if (!info || info.status === 'signed') return;
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
    if (!info?.original_pdf_url) {
      toast.error('Le PDF doit être affiché avant signature');
      return;
    }
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
    const { data, error } = await supabase.functions.invoke('signature-finalize', {
      body: { token, signer_name: signerName.trim(), signature_data: dataUrl },
    });
    setSubmitting(false);
    if (error || !data || (data as any).error) {
      const msg = (data as any)?.error || error?.message || 'Erreur lors de la signature';
      toast.error(msg);
      return;
    }
    toast.success('Document signé avec succès');
    await loadInfo();
  };

  const handleDownload = () => {
    if (info?.signed_pdf_url) window.open(info.signed_pdf_url, '_blank', 'noopener');
  };

  const handleSendEmail = async () => {
    if (!token || !emailRecipient.trim()) {
      toast.error('Saisissez votre email');
      return;
    }
    setEmailing(true);
    const { data, error } = await supabase.functions.invoke('signature-email-copy', {
      body: { token, recipient_email: emailRecipient.trim() },
    });
    setEmailing(false);
    if (error || !data || (data as any).error) {
      toast.error((data as any)?.error || error?.message || 'Envoi impossible');
      return;
    }
    toast.success('Email envoyé');
    setShowEmailField(false);
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

  const snap = info.document_snapshot || {};
  const docNumber = info.document_number || snap.document_number || '—';
  const docDate = snap.date ? new Date(snap.date).toLocaleDateString('fr-FR') : '';
  const docType = (info.document_type || snap.document_type || 'document').toLowerCase();
  const docTypeLabel = docType === 'facture' ? 'la facture' : 'le devis';

  const signedAt = info.signed_at ? new Date(info.signed_at) : null;
  const signedDate = signedAt ? signedAt.toLocaleDateString('fr-FR') : '';
  const signedTime = signedAt ? signedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center">
          <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold mt-2">Signature électronique</h1>
          <p className="text-sm text-muted-foreground">Document à signer en ligne</p>
        </div>

        <Card className="p-5 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {docType === 'facture' ? 'Facture' : 'Devis'} n°
              </p>
              <p className="text-lg font-bold">{docNumber}</p>
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

        {info.status !== 'signed' && (
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Veuillez lire le document avant de signer</p>
            </div>
            {info.original_pdf_url ? (
              <>
                <iframe
                  src={info.original_pdf_url}
                  title="Document à signer"
                  className="w-full border rounded bg-white"
                  style={{ height: '70vh', minHeight: 480 }}
                />
                <a
                  href={info.original_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline"
                >
                  Ouvrir le PDF dans un nouvel onglet
                </a>
              </>
            ) : (
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                Le PDF est momentanément indisponible. La signature est bloquée tant que le document n'est pas visible.
              </p>
            )}
          </Card>
        )}

        {info.status === 'signed' ? (
          <Card className="p-6 text-center bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <div>
              <p className="text-lg font-semibold">✅ Document signé avec succès</p>
              <p className="text-sm mt-2">Bonjour {info.signer_name},</p>
              <p className="text-sm">
                Vous avez signé le {docType === 'facture' ? 'la facture' : 'le devis'} n° <strong>{docNumber}</strong>
                {signedDate && <> le {signedDate}</>}
                {signedTime && <> à {signedTime}</>}.
              </p>
              {snap.artisan_name && (
                <p className="text-xs text-muted-foreground mt-2">
                  Une copie a été transmise à {snap.artisan_name}.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={handleDownload} disabled={!info.signed_pdf_url} className="gap-2">
                <Download className="h-4 w-4" />
                Télécharger mon exemplaire signé
              </Button>
              <Button variant="outline" onClick={() => setShowEmailField((v) => !v)} className="gap-2">
                <Mail className="h-4 w-4" />
                Envoyer par email
              </Button>
            </div>

            {info.signed_pdf_url && (
              <div className="text-left space-y-2 pt-2">
                <p className="text-sm font-medium">Exemplaire signé</p>
                <iframe
                  src={info.signed_pdf_url}
                  title="Document signé"
                  className="w-full border rounded bg-white"
                  style={{ height: '70vh', minHeight: 480 }}
                />
              </div>
            )}

            {showEmailField && (
              <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto pt-2">
                <Input
                  type="email"
                  placeholder="votre@email.com"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  lang="fr"
                />
                <Button onClick={handleSendEmail} disabled={emailing}>
                  {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer'}
                </Button>
              </div>
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
              En signant, vous acceptez {docTypeLabel} n° <strong>{docNumber}</strong>
              {docDate && <> du {docDate}</>} — <em>Bon pour accord — Lu et approuvé</em>
            </p>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full py-6 text-base">
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
