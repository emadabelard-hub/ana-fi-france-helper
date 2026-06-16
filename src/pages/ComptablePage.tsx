import { useEffect, useState } from 'react';
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
        const r = resp as any;
        if (r?.error === 'expired_token') { setError("Ce lien a expiré."); setLoading(false); return; }
        if (r?.error) { setError("Accès refusé ou lien désactivé"); setLoading(false); return; }
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

  const fetchSignedUrl = async (path: string): Promise<string | null> => {
    try {
      const { data: resp, error: err } = await supabase.functions.invoke('accountant-data', { body: { token, action: 'sign-url', path } });
      if (err || (resp as any)?.error || !(resp as any)?.url) return null;
      return (resp as any).url as string;
    } catch { return null; }
  };

  const buildFecBlob = (): Blob | null => {
    if (!data) return null;
    const round2 = (x: number) => Math.round((Number(x) || 0) * 100) / 100;
    const rows: (string | number)[][] = [];
    rows.push(['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'Montantdevise', 'Idevise']);
    let n = 1;
    // Suivi des écritures pour contrôle d'équilibre par EcritureNum
    const balanceByNum: Record<string, { debit: number; credit: number }> = {};
    const pushRow = (r: (string | number)[]) => {
      const num = String(r[2]);
      const debit = Number(r[9]) || 0;
      const credit = Number(r[10]) || 0;
      if (!balanceByNum[num]) balanceByNum[num] = { debit: 0, credit: 0 };
      balanceByNum[num].debit += debit;
      balanceByNum[num].credit += credit;
      rows.push(r);
    };

    for (const d of data.documents) {
      if (d.document_type !== 'facture') continue;
      const dateStr = (d.created_at || '').slice(0, 10).replace(/-/g, '');
      // Recalcul strict : on reconstruit le TTC depuis HT + TVA recalculés.
      // Regroupement par taux : si plusieurs taux existent dans lines[], on crée une ligne 445710 par taux.
      const lines: any[] = Array.isArray((d as any).lines) ? (d as any).lines : [];
      const htByRate: Record<string, number> = {};
      const tvaByRate: Record<string, number> = {};
      let htTotal = 0;
      let tvaTotal = 0;
      if (lines.length > 0) {
        for (const ln of lines) {
          const lineHt = Number(ln.total_ht ?? ln.totalHT ?? ((Number(ln.quantity || 0)) * Number(ln.unit_price || ln.unitPrice || 0))) || 0;
          const rate = Number(ln.tva_rate ?? ln.tvaRate ?? d.tva_rate ?? 0) || 0;
          const lineTva = round2(lineHt * rate / 100);
          const key = rate.toFixed(2);
          htByRate[key] = (htByRate[key] || 0) + lineHt;
          tvaByRate[key] = (tvaByRate[key] || 0) + lineTva;
          htTotal += lineHt;
          tvaTotal += lineTva;
        }
        htTotal = round2(htTotal);
        tvaTotal = round2(tvaTotal);
      } else {
        // Fallback : utiliser les champs stockés mais TVA recalculée à partir du taux pour garantir l'équilibre
        htTotal = round2(Number(d.subtotal_ht || 0));
        const rate = Number(d.tva_rate || 0);
        tvaTotal = rate > 0 ? round2(htTotal * rate / 100) : round2(Number(d.tva_amount || 0));
        const key = (rate || 0).toFixed(2);
        htByRate[key] = htTotal;
        tvaByRate[key] = tvaTotal;
      }
      const ttc = round2(htTotal + tvaTotal);
      pushRow(['VTE', 'Ventes', String(n), dateStr, '411000', d.client_name || 'Client', d.document_number, dateStr, `Facture ${d.document_number}`, ttc, 0, 0, 'EUR']);
      pushRow(['VTE', 'Ventes', String(n), dateStr, '707000', 'Ventes HT', d.document_number, dateStr, `Facture ${d.document_number}`, 0, htTotal, 0, 'EUR']);
      for (const key of Object.keys(tvaByRate)) {
        const tvaAmt = round2(tvaByRate[key]);
        if (tvaAmt > 0) {
          const rateLabel = parseFloat(key).toFixed(2).replace(/\.00$/, '');
          pushRow(['VTE', 'Ventes', String(n), dateStr, '445710', `TVA collectée ${rateLabel}%`, d.document_number, dateStr, `TVA ${d.document_number}`, 0, tvaAmt, 0, 'EUR']);
        }
      }
      n++;
    }
    for (const e of data.expenses) {
      const dateStr = (e.expense_date || '').replace(/-/g, '');
      const ht = round2(Number(e.amount || 0) - Number(e.tva_amount || 0));
      const tva = round2(Number(e.tva_amount || 0));
      const ttc = round2(ht + tva);
      pushRow(['ACH', 'Achats', String(n), dateStr, '606000', e.category || 'Achats', String(e.id).slice(0, 8), dateStr, e.title || 'Dépense', ht, 0, 0, 'EUR']);
      if (tva > 0) {
        pushRow(['ACH', 'Achats', String(n), dateStr, '445660', 'TVA déductible', String(e.id).slice(0, 8), dateStr, `TVA ${e.title}`, tva, 0, 0, 'EUR']);
      }
      pushRow(['ACH', 'Achats', String(n), dateStr, '401000', 'Fournisseur', String(e.id).slice(0, 8), dateStr, e.title || 'Dépense', 0, ttc, 0, 'EUR']);
      n++;
    }

    // Contrôle automatique d'équilibre (FEC)
    let totalDebit = 0;
    let totalCredit = 0;
    const unbalanced: string[] = [];
    for (const [num, b] of Object.entries(balanceByNum)) {
      totalDebit += b.debit;
      totalCredit += b.credit;
      if (Math.abs(round2(b.debit) - round2(b.credit)) > 0.01) {
        unbalanced.push(`EcritureNum ${num}: débit ${round2(b.debit)} ≠ crédit ${round2(b.credit)}`);
      }
    }
    if (unbalanced.length > 0) {
      console.warn('[FEC] Écritures déséquilibrées détectées:', unbalanced);
    }
    if (Math.abs(round2(totalDebit) - round2(totalCredit)) > 0.01) {
      console.warn(`[FEC] Total débit ${round2(totalDebit)} ≠ Total crédit ${round2(totalCredit)} (écart ${round2(totalDebit - totalCredit)})`);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FEC');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const handleFecExport = () => {
    if (!data) return;
    const fec = buildFecBlob();
    if (!fec) return;
    const siren = (data.company?.siret || '').replace(/\D/g, '').slice(0, 9) || '000000000';
    const t = new Date();
    const fname = `FEC${siren}_${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}.xlsx`;
    triggerBlobDownload(fec, fname);
  };

  const handleFecTxtExport = async () => {
    if (!data) return;
    const fec = buildFecBlob();
    if (!fec) return;
    // Réutilise exactement les données du xlsx (même logique, même équilibre) en relisant le buffer.
    const buf = await fec.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][];
    const fmtAmt = (v: any) => {
      const n = Number(v) || 0;
      return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
    };
    const sanitize = (v: any) => String(v ?? '').replace(/[\t\r\n]/g, ' ');
    const lines: string[] = [];
    rows.forEach((r, i) => {
      if (!r || r.length === 0) return;
      const cells = r.slice(0, 13).map((c, idx) => {
        if (i === 0) return sanitize(c);
        // Colonnes 9,10,11 = Debit, Credit, Montantdevise → format FR
        if (idx === 9 || idx === 10 || idx === 11) return fmtAmt(c);
        return sanitize(c);
      });
      while (cells.length < 13) cells.push('');
      lines.push(cells.join('\t'));
    });
    const txt = lines.join('\r\n');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const siret = (data.company?.siret || '').replace(/\D/g, '').slice(0, 14) || '00000000000000';
    const t = new Date();
    const fname = `FEC${siret}_${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}.txt`;
    triggerBlobDownload(blob, fname);
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

  const handleBulkExpenses = async () => {
    if (!data) return;
    setBulkLoading('depenses');
    try {
      const zip = new JSZip();
      await zipExpenses(zip, 'Depenses');
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(blob, `Depenses_${safeName(data.company?.company_name || 'export')}.zip`);
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
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ colorScheme: 'light' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#1a2a44' }} />
          <p className="text-sm text-gray-600">Vérification de l'accès…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6" style={{ colorScheme: 'light' }}>
        <Card className="max-w-md w-full p-8 text-center space-y-4 bg-white border border-gray-200">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Accès refusé</h1>
          <p className="text-sm text-gray-600">
            {error || "Ce lien n'est plus valide ou a été désactivé par son propriétaire."}
          </p>
        </Card>
      </div>
    );
  }

  const factures = data.documents.filter(d => d.document_type === 'facture');
  const devis = data.documents.filter(d => d.document_type === 'devis');

  return (
    <div className="min-h-screen bg-white text-gray-900 pb-24" style={{ colorScheme: 'light' }} dir="ltr" lang="fr">
      {/* Header */}
      <div className="text-white" style={{ background: 'linear-gradient(135deg,#1a2a44,#243b5c)' }}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#BFA071' }}>
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
          <Card className="p-4 bg-white border border-gray-200">
            <p className="text-xs text-gray-500">Chiffre d'affaires</p>
            <p className="text-xl font-bold mt-1 text-gray-900">{fmtEUR(data.summary.caTotal)}</p>
          </Card>
          <Card className="p-4 bg-white border border-gray-200">
            <p className="text-xs text-gray-500">TVA collectée</p>
            <p className="text-xl font-bold mt-1 text-gray-900">{fmtEUR(data.summary.tvaCollected)}</p>
          </Card>
          <Card className="p-4 bg-white border border-gray-200">
            <p className="text-xs text-gray-500">TVA déductible</p>
            <p className="text-xl font-bold mt-1 text-gray-900">{fmtEUR(data.summary.tvaDeductible)}</p>
          </Card>
          <Card className="p-4 border bg-[#FBF7EE]" style={{ borderColor: '#BFA071' }}>
            <p className="text-xs text-gray-600">NET TVA</p>
            <p className="text-xl font-bold mt-1" style={{ color: '#8a6d3b' }}>{fmtEUR(data.summary.netVat)}</p>
          </Card>
        </div>

        {/* FEC export */}
        <Card className="p-5 flex flex-wrap items-center justify-between gap-4 bg-white border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Export FEC officiel</p>
              <p className="text-xs text-gray-500">Fichier des écritures comptables (art. A47 A-1 LPF)</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleFecExport} className="gap-2 text-white" style={{ background: '#BFA071' }}>
              <Download className="h-4 w-4" /> FEC (.xlsx)
            </Button>
            <Button onClick={handleFecTxtExport} variant="outline" className="gap-2" style={{ borderColor: '#BFA071', color: '#8a6d3b' }}>
              <Download className="h-4 w-4" /> FEC officiel (.txt)
            </Button>
          </div>
        </Card>

        {/* Bulk ZIP downloads */}
        <Card className="p-5 space-y-3 bg-white border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Archive className="h-5 w-5" style={{ color: '#BFA071' }} />
            <h2 className="font-semibold text-gray-900">Téléchargements groupés</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              onClick={handleBulkInvoices}
              disabled={bulkLoading !== null || factures.length === 0}
              variant="outline"
              className="gap-2 justify-start h-auto py-3 border-gray-300 text-gray-900 bg-white hover:bg-gray-50"
            >
              {bulkLoading === 'factures' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="font-medium">Télécharger toutes les factures</span>
            </Button>
            <Button
              onClick={handleBulkExpenses}
              disabled={bulkLoading !== null || data.expenses.length === 0}
              variant="outline"
              className="gap-2 justify-start h-auto py-3 border-gray-300 text-gray-900 bg-white hover:bg-gray-50"
            >
              {bulkLoading === 'depenses' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              <span className="font-medium">Télécharger toutes les dépenses</span>
            </Button>
            <Button
              onClick={handleBulkQuotes}
              disabled={bulkLoading !== null || devis.length === 0}
              variant="outline"
              className="gap-2 justify-start h-auto py-3 border-gray-300 text-gray-900 bg-white hover:bg-gray-50"
            >
              {bulkLoading === 'devis' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="font-medium">Télécharger tous les devis</span>
            </Button>
            <Button
              onClick={handleBulkAll}
              disabled={bulkLoading !== null}
              className="gap-2 justify-start h-auto py-3 text-white"
              style={{ background: '#1a2a44' }}
            >
              {bulkLoading === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              <span className="font-medium">Télécharger tous les documents</span>
            </Button>
          </div>
        </Card>

        {/* Factures */}
        <Card className="p-5 bg-white border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" style={{ color: '#BFA071' }} />
            <h2 className="font-semibold text-gray-900">Factures ({factures.length})</h2>
          </div>
          {factures.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune facture.</p>
          ) : (
            <div className="space-y-2">
              {factures.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-900">{d.document_number}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {fmtDate(d.created_at)} · {d.client_name || '—'} · <span className={d.payment_status === 'paid' ? 'text-green-700 font-medium' : 'text-amber-700'}>{d.payment_status === 'paid' ? 'Payée' : 'En attente'}</span>
                    </p>
                  </div>
                  <p className="text-sm font-bold shrink-0 text-gray-900">{fmtEUR(Number(d.total_ttc || 0))}</p>
                  <Button variant="outline" size="sm" disabled={!d.pdf_url} onClick={() => handleDownload(d.pdf_url, `${d.document_number}.pdf`)} className="border-gray-300 text-gray-900 bg-white hover:bg-gray-50">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Devis */}
        <Card className="p-5 bg-white border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5" style={{ color: '#BFA071' }} />
            <h2 className="font-semibold text-gray-900">Devis ({devis.length})</h2>
          </div>
          {devis.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun devis.</p>
          ) : (
            <div className="space-y-2">
              {devis.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-900">{d.document_number}</p>
                    <p className="text-xs text-gray-500 truncate">{fmtDate(d.created_at)} · {d.client_name || '—'}</p>
                  </div>
                  <p className="text-sm font-bold shrink-0 text-gray-900">{fmtEUR(Number(d.total_ttc || 0))}</p>
                  <Button variant="outline" size="sm" disabled={!d.pdf_url} onClick={() => handleDownload(d.pdf_url, `${d.document_number}.pdf`)} className="border-gray-300 text-gray-900 bg-white hover:bg-gray-50">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Dépenses */}
        <Card className="p-5 bg-white border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="h-5 w-5" style={{ color: '#BFA071' }} />
            <h2 className="font-semibold text-gray-900">Dépenses ({data.expenses.length})</h2>
          </div>
          {data.expenses.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune dépense.</p>
          ) : (
            <div className="space-y-2">
              {data.expenses.map(e => {
                const ttc = Number(e.amount || 0);
                const tva = Number(e.tva_amount || 0);
                const ht = ttc - tva;
                return (
                  <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-gray-900 truncate">{e.title}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {fmtDate(e.expense_date)} · {e.category || '—'}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        HT : <strong>{fmtEUR(ht)}</strong> · TVA : <strong>{fmtEUR(tva)}</strong> · TTC : <strong>{fmtEUR(ttc)}</strong>
                      </p>
                    </div>
                    <Button
                      variant="outline" size="sm"
                      disabled={!e.receipt_url}
                      onClick={() => handleDownload(e.receipt_url, `justificatif-${e.id.slice(0, 8)}`)}
                      className="border-gray-300 text-gray-900 bg-white hover:bg-gray-50 gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Justificatif</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-gray-500 pt-4">
          Données fournies par AnafyPro · Accès sécurisé en lecture seule
        </p>
      </div>
    </div>
  );
};

export default ComptablePage;
