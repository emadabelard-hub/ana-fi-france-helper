import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, Download, FileText, Receipt, Building2, ShieldCheck, FileSpreadsheet, Package, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

interface Doc {
  id: string;
  document_type: string;
  document_number: string;
  client_name: string | null;
  subtotal_ht: number | null;
  tva_rate: number | null;
  tva_amount: number | null;
  total_ttc: number | null;
  status: string;
  payment_status: string | null;
  pdf_url: string | null;
  created_at: string;
}
interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string | null;
  tva_amount: number | null;
  receipt_url: string | null;
  expense_date: string;
  notes: string | null;
  created_at: string;
}
interface AccountantPayload {
  accountant: { name: string; email: string };
  company: { company_name: string | null; siret: string | null; company_address: string | null; legal_status: string | null; tva_exempt: boolean | null; numero_tva: string | null } | null;
  summary: { caTotal: number; tvaCollected: number; tvaDeductible: number; netVat: number };
  documents: Doc[];
  expenses: Expense[];
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('fr-FR'); } catch { return s; }
};

const ComptablePage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AccountantPayload | null>(null);
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) { setError('Lien invalide'); setLoading(false); return; }
      try {
        const { data: resp, error: err } = await supabase.functions.invoke('accountant-data', { body: { token } });
        if (!mounted) return;
        if (err) { setError("Accès refusé"); setLoading(false); return; }
        if ((resp as any)?.error) { setError("Accès refusé ou lien désactivé"); setLoading(false); return; }
        setData(resp as AccountantPayload);
      } catch {
        if (mounted) setError("Erreur de connexion");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  const handleDownload = async (path: string | null, filename: string) => {
    if (!path) return;
    try {
      const { data: resp, error: err } = await supabase.functions.invoke('accountant-data', { body: { token, action: 'sign-url', path } });
      if (err || (resp as any)?.error || !(resp as any)?.url) { console.error('Signed URL failed', err); return; }
      const url = (resp as any).url as string;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { console.error(e); }
  };

  const handleFecExport = () => {
    if (!data) return;
    const siren = (data.company?.siret || '').replace(/\D/g, '').slice(0, 9) || '000000000';
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const filename = `FEC${siren}_${yyyy}${mm}${dd}.xlsx`;

    const rows: (string | number)[][] = [];
    rows.push(['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'Montantdevise', 'Idevise']);
    let n = 1;
    for (const d of data.documents) {
      if (d.document_type !== 'facture') continue;
      const dateStr = (d.created_at || '').slice(0, 10).replace(/-/g, '');
      rows.push(['VTE', 'Ventes', String(n), dateStr, '411000', d.client_name || 'Client', d.document_number, dateStr, `Facture ${d.document_number}`, Number(d.total_ttc || 0), 0, 0, 'EUR']);
      rows.push(['VTE', 'Ventes', String(n), dateStr, '707000', 'Ventes HT', d.document_number, dateStr, `Facture ${d.document_number}`, 0, Number(d.subtotal_ht || 0), 0, 'EUR']);
      if (Number(d.tva_amount || 0) > 0) {
        rows.push(['VTE', 'Ventes', String(n), dateStr, '445710', 'TVA collectée', d.document_number, dateStr, `TVA ${d.document_number}`, 0, Number(d.tva_amount || 0), 0, 'EUR']);
      }
      n++;
    }
    for (const e of data.expenses) {
      const dateStr = (e.expense_date || '').replace(/-/g, '');
      const ht = Number(e.amount || 0) - Number(e.tva_amount || 0);
      rows.push(['HA', 'Achats', String(n), dateStr, '606000', e.category || 'Achats', String(e.id).slice(0, 8), dateStr, e.title || 'Dépense', ht, 0, 0, 'EUR']);
      if (Number(e.tva_amount || 0) > 0) {
        rows.push(['HA', 'Achats', String(n), dateStr, '445660', 'TVA déductible', String(e.id).slice(0, 8), dateStr, `TVA ${e.title}`, Number(e.tva_amount), 0, 0, 'EUR']);
      }
      rows.push(['HA', 'Achats', String(n), dateStr, '401000', 'Fournisseur', String(e.id).slice(0, 8), dateStr, e.title || 'Dépense', 0, Number(e.amount || 0), 0, 'EUR']);
      n++;
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FEC');
    XLSX.writeFile(wb, filename);
  };

  const fetchSignedUrl = async (path: string): Promise<string | null> => {
    try {
      const { data: resp, error: err } = await supabase.functions.invoke('accountant-data', { body: { token, action: 'sign-url', path } });
      if (err || (resp as any)?.error || !(resp as any)?.url) return null;
      return (resp as any).url as string;
    } catch { return null; }
  };

  const buildFecBlob = (): Blob | null => {
    if (!data) return null;
    const rows: (string | number)[][] = [];
    rows.push(['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'Montantdevise', 'Idevise']);
    let n = 1;
    for (const d of data.documents) {
      if (d.document_type !== 'facture') continue;
      const dateStr = (d.created_at || '').slice(0, 10).replace(/-/g, '');
      rows.push(['VTE', 'Ventes', String(n), dateStr, '411000', d.client_name || 'Client', d.document_number, dateStr, `Facture ${d.document_number}`, Number(d.total_ttc || 0), 0, 0, 'EUR']);
      rows.push(['VTE', 'Ventes', String(n), dateStr, '707000', 'Ventes HT', d.document_number, dateStr, `Facture ${d.document_number}`, 0, Number(d.subtotal_ht || 0), 0, 'EUR']);
      if (Number(d.tva_amount || 0) > 0) {
        rows.push(['VTE', 'Ventes', String(n), dateStr, '445710', 'TVA collectée', d.document_number, dateStr, `TVA ${d.document_number}`, 0, Number(d.tva_amount || 0), 0, 'EUR']);
      }
      n++;
    }
    for (const e of data.expenses) {
      const dateStr = (e.expense_date || '').replace(/-/g, '');
      const ht = Number(e.amount || 0) - Number(e.tva_amount || 0);
      rows.push(['HA', 'Achats', String(n), dateStr, '606000', e.category || 'Achats', String(e.id).slice(0, 8), dateStr, e.title || 'Dépense', ht, 0, 0, 'EUR']);
      if (Number(e.tva_amount || 0) > 0) {
        rows.push(['HA', 'Achats', String(n), dateStr, '445660', 'TVA déductible', String(e.id).slice(0, 8), dateStr, `TVA ${e.title}`, Number(e.tva_amount), 0, 0, 'EUR']);
      }
      rows.push(['HA', 'Achats', String(n), dateStr, '401000', 'Fournisseur', String(e.id).slice(0, 8), dateStr, e.title || 'Dépense', 0, Number(e.amount || 0), 0, 'EUR']);
      n++;
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FEC');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const safeName = (s: string) => (s || 'doc').replace(/[^\w.\-]+/g, '_');

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const zipDocs = async (docs: Doc[], folder: string | null, zip: JSZip) => {
    for (const d of docs) {
      if (!d.pdf_url) continue;
      const url = await fetchSignedUrl(d.pdf_url);
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const name = `${safeName(d.document_number)}.pdf`;
        (folder ? zip.folder(folder)! : zip).file(name, blob);
      } catch { /* skip */ }
    }
  };

  const zipExpenses = async (zip: JSZip, folder: string) => {
    if (!data) return;
    const f = zip.folder(folder)!;
    for (const e of data.expenses) {
      if (!e.receipt_url) continue;
      const url = await fetchSignedUrl(e.receipt_url);
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const ext = (blob.type.includes('pdf') ? 'pdf' : blob.type.split('/')[1] || 'bin').split(';')[0];
        f.file(`${safeName(e.title || e.id.slice(0, 8))}_${e.id.slice(0, 6)}.${ext}`, blob);
      } catch { /* skip */ }
    }
  };

  const handleBulkInvoices = async () => {
    if (!data) return;
    setBulkLoading('factures');
    try {
      const zip = new JSZip();
      await zipDocs(data.documents.filter(d => d.document_type === 'facture'), null, zip);
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(blob, `Factures_${safeName(data.company?.company_name || 'export')}.zip`);
    } finally { setBulkLoading(null); }
  };

  const handleBulkQuotes = async () => {
    if (!data) return;
    setBulkLoading('devis');
    try {
      const zip = new JSZip();
      await zipDocs(data.documents.filter(d => d.document_type === 'devis'), null, zip);
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(blob, `Devis_${safeName(data.company?.company_name || 'export')}.zip`);
    } finally { setBulkLoading(null); }
  };

  const handleBulkAll = async () => {
    if (!data) return;
    setBulkLoading('all');
    try {
      const zip = new JSZip();
      await zipDocs(data.documents.filter(d => d.document_type === 'facture'), 'Factures', zip);
      await zipDocs(data.documents.filter(d => d.document_type === 'devis'), 'Devis', zip);
      await zipExpenses(zip, 'Depenses');
      const fec = buildFecBlob();
      if (fec) {
        const siren = (data.company?.siret || '').replace(/\D/g, '').slice(0, 9) || '000000000';
        const t = new Date();
        const fname = `FEC${siren}_${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}.xlsx`;
        zip.file(fname, fec);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(blob, `Dossier_complet_${safeName(data.company?.company_name || 'export')}.zip`);
    } finally { setBulkLoading(null); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Vérification de l'accès…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Accès refusé</h1>
          <p className="text-sm text-muted-foreground">
            {error || "Ce lien n'est plus valide ou a été désactivé par son propriétaire."}
          </p>
        </Card>
      </div>
    );
  }

  const factures = data.documents.filter(d => d.document_type === 'facture');
  const devis = data.documents.filter(d => d.document_type === 'devis');

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1a2a44] to-[#243b5c] text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#BFA071] flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-white/60">Espace comptable</p>
              <h1 className="text-2xl font-bold mt-1">{data.company?.company_name || 'Société'}</h1>
              <p className="text-sm text-white/80 mt-1">
                {data.company?.siret && <>SIRET : <span className="font-mono">{data.company.siret}</span> · </>}
                {data.company?.legal_status === 'societe' ? 'Société' : 'Auto-entrepreneur'}
              </p>
              <p className="text-xs text-white/60 mt-2">
                Accès accordé à <strong className="text-white/90">{data.accountant.name}</strong> · {data.accountant.email}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" /> Lecture seule
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Chiffre d'affaires</p>
            <p className="text-xl font-bold mt-1">{fmtEUR(data.summary.caTotal)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">TVA collectée</p>
            <p className="text-xl font-bold mt-1">{fmtEUR(data.summary.tvaCollected)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">TVA déductible</p>
            <p className="text-xl font-bold mt-1">{fmtEUR(data.summary.tvaDeductible)}</p>
          </Card>
          <Card className="p-4 border-[#BFA071]/30 bg-[#BFA071]/5">
            <p className="text-xs text-muted-foreground">NET TVA</p>
            <p className="text-xl font-bold mt-1 text-[#BFA071]">{fmtEUR(data.summary.netVat)}</p>
          </Card>
        </div>

        {/* FEC export */}
        <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold">Export FEC officiel</p>
              <p className="text-xs text-muted-foreground">Fichier des écritures comptables (art. A47 A-1 LPF)</p>
            </div>
          </div>
          <Button onClick={handleFecExport} className="gap-2 bg-[#1a2a44] hover:bg-[#243b5c]">
            <Download className="h-4 w-4" /> Télécharger FEC
          </Button>
        </Card>

        {/* Bulk ZIP downloads */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Archive className="h-5 w-5 text-[#BFA071]" />
            <h2 className="font-semibold">Téléchargements groupés</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={handleBulkInvoices}
              disabled={bulkLoading !== null || factures.length === 0}
              variant="outline"
              className="gap-2 justify-start h-auto py-3"
            >
              {bulkLoading === 'factures' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span dir="rtl" className="font-medium">تحميل كل الفواتير</span>
            </Button>
            <Button
              onClick={handleBulkQuotes}
              disabled={bulkLoading !== null || devis.length === 0}
              variant="outline"
              className="gap-2 justify-start h-auto py-3"
            >
              {bulkLoading === 'devis' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span dir="rtl" className="font-medium">تحميل كل الديفي</span>
            </Button>
            <Button
              onClick={handleBulkAll}
              disabled={bulkLoading !== null}
              className="gap-2 justify-start h-auto py-3 bg-[#BFA071] hover:bg-[#a98a5e] text-white"
            >
              {bulkLoading === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              <span dir="rtl" className="font-medium">تحميل كل المستندات</span>
            </Button>
          </div>
        </Card>

        {/* Factures */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-[#BFA071]" />
            <h2 className="font-semibold">Factures ({factures.length})</h2>
          </div>
          {factures.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune facture.</p>
          ) : (
            <div className="space-y-2">
              {factures.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 hover:bg-secondary/30">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{d.document_number}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {fmtDate(d.created_at)} · {d.client_name || '—'} · <span className={d.payment_status === 'paid' ? 'text-green-600 font-medium' : 'text-amber-600'}>{d.payment_status === 'paid' ? 'Payée' : 'En attente'}</span>
                    </p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{fmtEUR(Number(d.total_ttc || 0))}</p>
                  <Button variant="outline" size="sm" disabled={!d.pdf_url} onClick={() => handleDownload(d.pdf_url, `${d.document_number}.pdf`)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Devis */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-[#BFA071]" />
            <h2 className="font-semibold">Devis ({devis.length})</h2>
          </div>
          {devis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun devis.</p>
          ) : (
            <div className="space-y-2">
              {devis.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 hover:bg-secondary/30">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{d.document_number}</p>
                    <p className="text-xs text-muted-foreground truncate">{fmtDate(d.created_at)} · {d.client_name || '—'}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{fmtEUR(Number(d.total_ttc || 0))}</p>
                  <Button variant="outline" size="sm" disabled={!d.pdf_url} onClick={() => handleDownload(d.pdf_url, `${d.document_number}.pdf`)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Dépenses */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-5 w-5 text-[#BFA071]" />
            <h2 className="font-semibold">Dépenses ({data.expenses.length})</h2>
          </div>
          {data.expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune dépense.</p>
          ) : (
            <div className="space-y-2">
              {data.expenses.map(e => (
                <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 hover:bg-secondary/30">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{fmtDate(e.expense_date)} · {e.category || '—'}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0">{fmtEUR(Number(e.amount || 0))}</p>
                  <Button variant="outline" size="sm" disabled={!e.receipt_url} onClick={() => handleDownload(e.receipt_url, `recu-${e.id.slice(0, 8)}`)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Données fournies par AnafyPro · Accès sécurisé en lecture seule
        </p>
      </div>
    </div>
  );
};

export default ComptablePage;
