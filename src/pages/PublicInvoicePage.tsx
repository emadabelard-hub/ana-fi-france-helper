import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Download, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface DocData {
  id: string;
  document_number: string;
  client_name: string | null;
  created_at: string;
  total_ttc: number;
  subtotal_ht: number;
  tva_amount: number;
  document_data: any;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'ok' | 'expired' | 'notfound' | 'error'>('loading');
  const [doc, setDoc] = useState<DocData | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('notfound');
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-invoice-by-token', {
          body: { token },
        });
        if (error) {
          const ctxAny = (error as any).context;
          let payload: any = null;
          try {
            if (ctxAny?.text) payload = JSON.parse(await ctxAny.text());
          } catch {
            // ignore
          }
          if (payload?.error === 'expired') { setState('expired'); return; }
          if (payload?.error === 'not_found') { setState('notfound'); return; }
          setState('error');
          return;
        }
        setDoc(data.document as DocData);
        setExpiresAt(data.expires_at);
        setState('ok');
      } catch (e) {
        console.error(e);
        setState('error');
      }
    })();
  }, [token]);

  const handleDownload = async () => {
    if (!token) return;
    setDownloading(true);
    try {
      await supabase.functions.invoke('mark-invoice-downloaded', { body: { token } });
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <span className="font-bold">Anafy Pro</span>
            <span className="text-slate-500 text-sm">— Facture Sécurisée</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {state === 'loading' && (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {state === 'notfound' && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <h1 className="text-lg font-bold mb-2">Facture non trouvée</h1>
            <p className="text-slate-600 text-sm">Le lien est invalide.</p>
          </div>
        )}

        {state === 'expired' && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <h1 className="text-lg font-bold mb-2">Le lien a expiré</h1>
            <p className="text-slate-600 text-sm">Contactez l'artisan pour obtenir un nouveau lien.</p>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <h1 className="text-lg font-bold mb-2">Erreur</h1>
            <p className="text-slate-600 text-sm">Impossible de charger la facture.</p>
          </div>
        )}

        {state === 'ok' && doc && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Facture {doc.document_number}</h1>
              <p className="text-sm text-slate-500 mt-1">
                Émise le {new Date(doc.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Client</p>
                <p className="font-medium">{doc.client_name || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Numéro</p>
                <p className="font-medium">{doc.document_number}</p>
              </div>
              <div>
                <p className="text-slate-500">Montant HT</p>
                <p className="font-medium">{formatCurrency(doc.subtotal_ht)}</p>
              </div>
              <div>
                <p className="text-slate-500">TVA</p>
                <p className="font-medium">{formatCurrency(doc.tva_amount)}</p>
              </div>
              <div className="col-span-2 pt-4 border-t border-slate-200">
                <p className="text-slate-500 text-xs">Total TTC</p>
                <p className="text-2xl font-bold">{formatCurrency(doc.total_ttc)}</p>
              </div>
            </div>

            {doc.document_data?.objet && (
              <div className="text-sm">
                <p className="text-slate-500">Objet</p>
                <p className="font-medium">{doc.document_data.objet}</p>
              </div>
            )}

            {Array.isArray(doc.document_data?.items) && doc.document_data.items.length > 0 && (
              <div>
                <p className="text-slate-500 text-sm mb-2">Détails</p>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2">Désignation</th>
                        <th className="text-right px-3 py-2">Qté</th>
                        <th className="text-right px-3 py-2">PU HT</th>
                        <th className="text-right px-3 py-2">Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.document_data.items.map((it: any, i: number) => (
                        <tr key={i} className="border-t border-slate-200">
                          <td className="px-3 py-2">{it.description || it.designation || '-'}</td>
                          <td className="px-3 py-2 text-right">{it.quantity ?? it.qty ?? '-'}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(Number(it.unitPrice ?? it.pu ?? 0))}</td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(Number(it.totalHT ?? (Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0))))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Button onClick={handleDownload} disabled={downloading} className="w-full gap-2 print:hidden">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Télécharger la facture
            </Button>
          </div>
        )}

        {state === 'ok' && expiresAt && (
          <p className="text-center text-xs text-slate-500 mt-6 print:hidden">
            Accès sécurisé. Le lien expire le {new Date(expiresAt).toLocaleString('fr-FR')} (48h).
          </p>
        )}
      </main>
    </div>
  );
}
