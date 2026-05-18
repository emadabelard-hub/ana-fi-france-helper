import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Receipt, Plus, TrendingUp, TrendingDown, Wallet, Banknote,
  Loader2, Download, Eye, FileText, Archive,
  ChevronDown, ChevronUp, Users, HardHat, Calculator, Info, Landmark, Shield,
  AlertTriangle, RotateCcw
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import AddExpenseModal from '@/components/archive/AddExpenseModal';
import OcrInvoiceScannerModal from '@/components/archive/OcrInvoiceScannerModal';
import UnpaidInvoicesBlock from '@/components/archive/UnpaidInvoicesBlock';
import SecurityBadge from '@/components/shared/SecurityBadge';
import { generateProfessionalCSV, generateAccountingCSV, downloadCSV, type CsvDocumentRow } from '@/lib/csvExport';
import { useProfile } from '@/hooks/useProfile';
import type { DocumentItem } from '@/components/archive/DocumentCard';

interface UnifiedRow {
  id: string;
  date: string;
  type: 'devis' | 'facture' | 'expense';
  label: string;
  clientName: string;
  projectName: string | null;
  projectId: string | null;
  clientId: string | null;
  amount: number;
  amountHT: number;
  tvaAmount: number;
  status: string | null;
  paymentStatus: string | null;
  pdfUrl: string | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const ExpensesPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [showAccountingMenu, setShowAccountingMenu] = useState(false);

  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [documentItems, setDocumentItems] = useState<DocumentItem[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalIncomeHT, setTotalIncomeHT] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [resettingClient, setResettingClient] = useState<string | null>(null);


  const formatEUR0 = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));


  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch documents
      const docsQ = supabase
        .from('documents_comptables')
        .select('id, document_type, document_number, client_name, subtotal_ht, total_ttc, tva_amount, status, payment_status, created_at, chantier_id, pdf_url, document_data, converted_to_invoice, linked_invoice_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch expenses
      const expQ = supabase
        .from('expenses')
        .select('id, title, amount, tva_amount, expense_date, chantier_id, document_id, created_at')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false });

      // Fetch chantiers for name lookup
      const chQ = supabase.from('chantiers').select('id, name, client_id').eq('user_id', user.id);

      // Fetch clients for ID lookup
      const clQ = supabase.from('clients').select('id, name, contact_phone').eq('user_id', user.id);

      const [docsRes, expRes, chRes, clRes] = await Promise.all([docsQ, expQ, chQ, clQ]);

      const chantierMap: Record<string, { name: string; clientId: string }> = {};
      (chRes.data || []).forEach((c: any) => { chantierMap[c.id] = { name: c.name, clientId: c.client_id }; });

      const clientMap: Record<string, string> = {};
      const clientPhoneMap: Record<string, string> = {};
      (clRes.data || []).forEach((c: any) => {
        clientMap[c.name] = c.id;
        clientPhoneMap[c.name] = c.contact_phone || '';
      });
      // Also map by id
      const clientIdMap: Record<string, string> = {};
      (clRes.data || []).forEach((c: any) => { clientIdMap[c.id] = c.name; });

      let incomeSum = 0;
      let incomeHTSum = 0;
      let collectedSum = 0;
      let expenseSum = 0;

      const unified: UnifiedRow[] = [];
      const mappedDocuments: DocumentItem[] = [];

      // Documents
      (docsRes.data || []).forEach((d: any) => {
        const ch = d.chantier_id ? chantierMap[d.chantier_id] : null;
        // Comptabilité 100% encaissement : seules les factures payées comptent
        if (d.document_type === 'facture' && d.status === 'finalized' && d.payment_status === 'paid') {
          incomeSum += d.total_ttc || 0;
          incomeHTSum += d.subtotal_ht || 0;
          collectedSum += d.total_ttc || 0;
        }

        unified.push({
          id: d.id,
          date: d.created_at,
          type: d.document_type === 'devis' ? 'devis' : 'facture',
          label: d.document_number,
          clientName: d.client_name || '',
          projectName: ch?.name || null,
          projectId: d.chantier_id || null,
          clientId: clientMap[d.client_name] || null,
          amount: d.total_ttc || 0,
          amountHT: d.subtotal_ht || 0,
          tvaAmount: d.tva_amount || 0,
          status: d.status || null,
          paymentStatus: d.payment_status || null,
          pdfUrl: d.pdf_url || null,
        });

        mappedDocuments.push({
          id: d.id,
          type: d.document_type === 'devis' ? 'devis' : 'facture',
          number: d.document_number,
          clientName: d.client_name || '',
          date: new Date(d.created_at).toLocaleDateString('fr-FR'),
          amountHT: d.subtotal_ht || 0,
          amountTTC: d.total_ttc || 0,
          status: d.status === 'finalized' ? 'finalized' : d.status === 'cancelled' ? 'cancelled' : 'draft',
          paymentStatus: d.payment_status || 'unpaid',
          rawData: {
            ...d,
            resolved_client_phone: clientPhoneMap[d.client_name] || '',
          },
        });
      });

      // Expenses
      (expRes.data || []).forEach((e: any) => {
        expenseSum += e.amount || 0;
        const ch = e.chantier_id ? chantierMap[e.chantier_id] : null;
        const clientName = ch ? (clientIdMap[ch.clientId] || '') : '';
        unified.push({
          id: e.id,
          date: e.expense_date || e.created_at,
          type: 'expense',
          label: e.title,
          clientName,
          projectName: ch?.name || null,
          projectId: e.chantier_id || null,
          clientId: ch ? (ch.clientId || null) : null,
          amount: e.amount || 0,
          amountHT: e.amount || 0,
          tvaAmount: e.tva_amount || 0,
          status: null,
          paymentStatus: null,
          pdfUrl: null,
        });
      });

      // Sort by date descending
      unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRows(unified);
      setDocumentItems(mappedDocuments);
      setTotalIncome(incomeSum);
      setTotalIncomeHT(incomeHTSum);
      setTotalCollected(collectedSum);
      setTotalExpenses(expenseSum);
    } catch {
      // fetch error handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [user]);

  const filtered = useMemo(() => {
    if (periodFilter === 'all') return rows;
    const now = new Date();
    let start: Date;
    switch (periodFilter) {
      case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'quarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case 'year': start = new Date(now.getFullYear(), 0, 1); break;
      default: start = new Date(0);
    }
    return rows.filter(r => new Date(r.date) >= start);
  }, [rows, periodFilter]);

  // TVA robuste : TTC - HT si les deux existent, sinon fallback TTC * 0.1667
  const computeRowTva = (r: UnifiedRow) => {
    if (r.tvaAmount > 0) return r.tvaAmount;
    if (r.amountHT > 0 && r.amount > r.amountHT) return Math.round((r.amount - r.amountHT) * 100) / 100;
    if (r.amountHT === 0 && r.amount > 0) return Math.round(r.amount * 0.1667 * 100) / 100;
    return 0;
  };

  // Comptabilité 100% encaissement : uniquement factures payées
  const paidInvoices = useMemo(() =>
    filtered.filter(r => r.type === 'facture' && r.status === 'finalized' && r.paymentStatus === 'paid'),
    [filtered]);

  // Diagnostic: paid invoices grouped by client (over ALL data, ignoring period filter)
  const paidByClient = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    rows.forEach(r => {
      if (r.type === 'facture' && r.status === 'finalized' && r.paymentStatus === 'paid') {
        const k = r.clientName || '(sans nom)';
        if (!map[k]) map[k] = { count: 0, total: 0 };
        map[k].count += 1;
        map[k].total += r.amount;
      }
    });
    return Object.entries(map)
      .map(([clientName, v]) => ({ clientName, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);
  const totalPaidCount = paidByClient.reduce((s, c) => s + c.count, 0);

  const handleResetClientPaid = async (clientName: string) => {
    if (!user) return;
    setResettingClient(clientName);
    try {
      const { error } = await supabase
        .from('documents_comptables')
        .update({ payment_status: 'unpaid' })
        .eq('user_id', user.id)
        .eq('document_type', 'facture')
        .eq('status', 'finalized')
        .eq('payment_status', 'paid')
        .eq('client_name', clientName);
      if (error) throw error;
      toast({
        title: isRTL ? '✅ تم' : '✅ Réinitialisé',
        description: isRTL
          ? `تم وضع علامة "غير مدفوع" على فواتير ${clientName}`
          : `Factures de ${clientName} marquées comme impayées`,
      });
      await fetchAll();
    } catch (e: any) {
      console.error('Reset paid status error:', e);
      toast({
        title: isRTL ? 'خطأ' : 'Erreur',
        description: e?.message || '',
        variant: 'destructive',
      });
    } finally {
      setResettingClient(null);
    }
  };

  const tvaCollectee = useMemo(() =>
    paidInvoices.reduce((s, r) => s + computeRowTva(r), 0),
    [paidInvoices]);
  const tvaDeductible = useMemo(() =>
    filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.tvaAmount, 0),
    [filtered]);
  const tvaNet = tvaCollectee - tvaDeductible;
  const tvaAPayer = Math.max(0, tvaNet);

  // URSSAF calculations
  const urssafRate = (profile as any)?.urssaf_rate ?? 21.2;
  const isRate = (profile as any)?.is_rate ?? 15;
  const filteredIncomeHT = useMemo(() =>
    paidInvoices.reduce((s, r) => s + r.amountHT, 0),
    [paidInvoices]);
  const filteredExpensesHT = useMemo(() =>
    filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.amountHT, 0),
    [filtered]);

  // URSSAF sur bénéfice brut (CA HT - dépenses), jamais négatif
  const beneficeBrut = Math.max(0, filteredIncomeHT - filteredExpensesHT);
  const totalURSSAF = Math.round(beneficeBrut * (urssafRate / 100) * 100) / 100;
  const estimatedIS = Math.max(0, Math.round((beneficeBrut - totalURSSAF) * (isRate / 100) * 100) / 100);

   // Bénéfice avant impôt = encaissé - TVA - URSSAF - dépenses
   const profitBeforeIS = totalCollected - tvaAPayer - totalURSSAF - totalExpenses;

   // Bénéfice net estimé = encaissé - TVA à payer - dépenses - URSSAF - IS
   // Ne peut jamais dépasser l'encaissement
   const rawNetProfit = totalCollected - tvaAPayer - totalExpenses - totalURSSAF - estimatedIS;
   const netProfit = Math.min(rawNetProfit, totalCollected);

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const csvRows: CsvDocumentRow[] = filtered.map(r => ({
      date: r.date,
      type: r.type,
      reference: r.label,
      clientName: r.clientName,
      projectName: r.projectName,
      totalHT: null,
      tvaRate: 0,
      tvaAmount: null,
      totalTTC: r.amount,
    }));
    const csv = generateProfessionalCSV(csvRows);
    downloadCSV(csv, `comptes_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const [sendingToAccountant, setSendingToAccountant] = useState(false);

  const handleAccountantExport = async () => {
    // 1. Vérifier email comptable enregistré dans le profil
    const accountantEmail = (profile?.accountant_email || '').trim();
    if (!accountantEmail) {
      toast({
        title: isRTL ? 'إيميل المحاسب مفقود' : 'Email comptable manquant',
        description: isRTL ? 'أضف إيميل المحاسب في الإعدادات أولاً' : "Ajoutez l'email du comptable dans les paramètres",
        variant: 'destructive',
      });
      navigate('/pro/settings');
      return;
    }

    if (filtered.length === 0 || sendingToAccountant) return;
    setSendingToAccountant(true);

    try {
      const invoiceRows: CsvDocumentRow[] = filtered
        .filter(r => r.type === 'facture' && (r.status === 'finalized' || r.status === 'converted'))
        .map(r => ({
          date: r.date,
          type: 'facture' as const,
          reference: r.label,
          clientName: r.clientName,
          projectName: r.projectName,
          totalHT: r.amountHT,
          tvaRate: r.tvaAmount > 0 && r.amountHT > 0 ? (r.tvaAmount / r.amountHT) * 100 : 0,
          tvaAmount: r.tvaAmount,
          totalTTC: r.amount,
          status: r.status,
          paymentStatus: r.paymentStatus,
        }));

      const expenseRows: CsvDocumentRow[] = filtered
        .filter(r => r.type === 'expense')
        .map(r => ({
          date: r.date,
          type: 'expense' as const,
          reference: r.label,
          clientName: r.clientName,
          projectName: r.projectName,
          totalHT: r.amountHT,
          tvaRate: r.tvaAmount > 0 && r.amountHT > 0 ? (r.tvaAmount / r.amountHT) * 100 : 0,
          tvaAmount: r.tvaAmount,
          totalTTC: r.amount,
        }));

      const periodLabelMap: Record<string, string> = {
        all: 'Toutes périodes',
        month: 'Ce mois',
        quarter: 'Ce trimestre',
        year: 'Cette année',
      };
      const periodLabel = periodLabelMap[periodFilter] || 'Période en cours';
      const artisanName = profile?.company_name || profile?.full_name || 'Artisan';

      const { buildAccountantZip } = await import('@/lib/accountantPackage');
      const pkg = await buildAccountantZip(
        {
          invoices: invoiceRows,
          expenses: expenseRows,
          company: {
            companyName: profile?.company_name,
            siret: profile?.siret,
            tvaNumber: profile?.numero_tva,
          },
          period: { label: periodLabel },
        },
        { artisanName, periodLabel, companyName: profile?.company_name },
      );

      const { error } = await supabase.functions.invoke('email-accountant-zip', {
        body: {
          accountantEmail,
          artisanName,
          companyName: profile?.company_name,
          periodLabel,
          fileName: pkg.fileName,
          zipBase64: pkg.zipBase64,
          summary: pkg.summary,
        },
      });
      if (error) throw error;

      toast({
        title: isRTL ? '✅ تم إرسال الملفات للمحاسب بنجاح' : '✅ Documents envoyés au comptable',
        description: isRTL ? `إلى : ${accountantEmail}` : `Envoyé à : ${accountantEmail}`,
      });
    } catch (err: any) {
      console.error('handleAccountantExport error:', err);
      toast({
        title: isRTL ? 'تعذر الإرسال' : "Échec de l'envoi",
        description: err?.message || (isRTL ? 'حاول مرة أخرى لاحقًا' : 'Veuillez réessayer'),
        variant: 'destructive',
      });
    } finally {
      setSendingToAccountant(false);
    }
  };

  const handleArchiveDownload = async () => {
    if (!user || filtered.length === 0) return;
    setArchiving(true);
    try {
      const zip = new JSZip();
      const fmtDate = (d: string) => new Date(d).toISOString().slice(0, 10);
      let filesAdded = 0;

      // Helper: extract storage path from a Supabase URL for a given bucket
      const extractPath = (url: string, bucket: string): string | null => {
        const marker = `${bucket}/`;
        const idx = url.indexOf(marker);
        if (idx === -1) return null;
        return url.substring(idx + marker.length).split('?')[0];
      };

      // Helper: fetch a blob from a URL, trying signed URL first for storage paths
      const fetchBlob = async (url: string, bucket: string): Promise<Blob | null> => {
        // Try to extract storage path and create a signed URL
        const storagePath = extractPath(url, bucket);
        if (storagePath) {
          const { data: signedData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, 300);
          if (signedData?.signedUrl) {
            const res = await fetch(signedData.signedUrl);
            if (res.ok) return await res.blob();
          }
        }
        // Fallback: try direct fetch (for external/public URLs)
        try {
          const res = await fetch(url);
          if (res.ok) return await res.blob();
        } catch { /* ignore */ }
        return null;
      };

      // --- Collect document PDFs (all factures/devis, with or without pdfUrl) ---
      const docs = filtered.filter(r => r.type === 'facture' || r.type === 'devis');
      
      // Fetch full document_data for generating PDFs when no file exists
      const docIds = docs.map(d => d.id);
      const { data: fullDocsData } = docIds.length > 0
        ? await supabase
            .from('documents_comptables')
            .select('id, document_number, document_type, client_name, client_address, subtotal_ht, tva_amount, tva_rate, total_ttc, tva_exempt, document_data, created_at, work_site_address, nature_operation')
            .eq('user_id', user.id)
            .in('id', docIds)
        : { data: [] };
      const fullDocsMap = new Map((fullDocsData || []).map(d => [d.id, d]));

      for (const doc of docs) {
        const clientFolder = (doc.clientName || 'Sans_Client').replace(/[\/\\]/g, '_');
        const projectFolder = (doc.projectName || 'Sans_Projet').replace(/[\/\\]/g, '_');
        const typeFolder = doc.type === 'facture' ? 'Factures' : 'Devis';
        const fileName = `${fmtDate(doc.date)}_${doc.label.replace(/[\/\\]/g, '-')}.pdf`;
        const folderPath = `${clientFolder}/${projectFolder}/${typeFolder}`;

        let blob: Blob | null = null;

        // Try fetching existing PDF first
        if (doc.pdfUrl) {
          try {
            blob = await fetchBlob(doc.pdfUrl, 'signed-documents');
            if (!blob) blob = await fetchBlob(doc.pdfUrl, 'company-assets');
          } catch {
            // stored PDF not available
          }
        }

        // If no stored PDF, generate one from document data
        if (!blob || blob.size === 0) {
          try {
            const fullDoc = fullDocsMap.get(doc.id);
            if (fullDoc) {
              const { jsPDF } = await import('jspdf');
              const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
              const docData = fullDoc.document_data as any;
              const items = docData?.items || docData?.lineItems || [];

              // Company header (top-left)
              const companyName = profile?.company_name || profile?.full_name || '';
              const companySiret = profile?.siret || '';
              const companyAddress = profile?.company_address || profile?.address || '';
              let headerY = 16;
              if (companyName) {
                pdf.setFontSize(13);
                pdf.setFont(undefined!, 'bold');
                pdf.text(companyName, 14, headerY);
                headerY += 6;
              }
              if (companySiret) {
                pdf.setFontSize(9);
                pdf.setFont(undefined!, 'normal');
                pdf.text(`SIRET: ${companySiret}`, 14, headerY);
                headerY += 5;
              }
              if (companyAddress) {
                pdf.setFontSize(9);
                pdf.setFont(undefined!, 'normal');
                pdf.text(companyAddress.substring(0, 60), 14, headerY);
                headerY += 5;
              }
              
              // Document title (top-right)
              pdf.setFontSize(18);
              pdf.setFont(undefined!, 'bold');
              const docTitle = fullDoc.document_type === 'facture' ? 'FACTURE' : 'DEVIS';
              pdf.text(docTitle, 196, 16, { align: 'right' });
              pdf.setFontSize(11);
              pdf.setFont(undefined!, 'normal');
              pdf.text(`N° ${fullDoc.document_number}`, 196, 24, { align: 'right' });
              pdf.text(`Date: ${fmtDate(fullDoc.created_at)}`, 196, 30, { align: 'right' });

              // Separator
              pdf.setDrawColor(200, 200, 200);
              pdf.line(14, Math.max(headerY + 2, 36), 196, Math.max(headerY + 2, 36));
              
              // Client info
              let clientY = Math.max(headerY + 8, 42);
              pdf.setFontSize(9);
              pdf.setFont(undefined!, 'bold');
              pdf.text('Client:', 14, clientY);
              pdf.setFontSize(11);
              pdf.setFont(undefined!, 'normal');
              clientY += 6;
              pdf.text(fullDoc.client_name || '-', 14, clientY);
              if (fullDoc.client_address) { clientY += 5; pdf.text(fullDoc.client_address, 14, clientY); }
              if (fullDoc.work_site_address) {
                clientY += 5;
                pdf.setFontSize(9);
                pdf.text(`Adresse chantier: ${fullDoc.work_site_address}`, 14, clientY);
              }

              // Items table
              let y = clientY + 12;
              pdf.setFontSize(9);
              pdf.setFont(undefined!, 'bold');
              pdf.text('Description', 14, y);
              pdf.text('Qté', 110, y, { align: 'right' });
              pdf.text('Prix unit. HT', 145, y, { align: 'right' });
              pdf.text('Total HT', 190, y, { align: 'right' });
              pdf.line(14, y + 1, 196, y + 1);
              y += 7;
              pdf.setFont(undefined!, 'normal');

              for (const item of items) {
                if (y > 260) { pdf.addPage(); y = 20; }
                const desc = item.description || item.label || '-';
                const qty = item.quantity ?? item.qty ?? 1;
                const unit = item.unitPrice ?? item.unit_price ?? item.price ?? 0;
                const total = qty * unit;
                pdf.text(desc.substring(0, 55), 14, y);
                pdf.text(String(qty), 110, y, { align: 'right' });
                pdf.text(`${Number(unit).toFixed(2)} €`, 145, y, { align: 'right' });
                pdf.text(`${total.toFixed(2)} €`, 190, y, { align: 'right' });
                y += 6;
              }

              // Totals
              y += 5;
              pdf.line(120, y, 196, y);
              y += 6;
              pdf.setFont(undefined!, 'bold');
              pdf.text(`Total HT:`, 140, y);
              pdf.text(`${Number(fullDoc.subtotal_ht).toFixed(2)} €`, 190, y, { align: 'right' });
              y += 6;
              if (!fullDoc.tva_exempt) {
                pdf.setFont(undefined!, 'normal');
                pdf.text(`TVA (${Number(fullDoc.tva_rate)}%):`, 140, y);
                pdf.text(`${Number(fullDoc.tva_amount).toFixed(2)} €`, 190, y, { align: 'right' });
                y += 6;
              }
              pdf.setFont(undefined!, 'bold');
              pdf.setFontSize(11);
              pdf.text(`Total TTC:`, 140, y);
              pdf.text(`${Number(fullDoc.total_ttc).toFixed(2)} €`, 190, y, { align: 'right' });

              if (fullDoc.tva_exempt) {
                y += 10;
                pdf.setFontSize(8);
                pdf.setFont(undefined!, 'italic');
                pdf.text('TVA non applicable, art. 293 B du CGI.', 14, y);
              }

              // Footer on every page
              const pageCount = pdf.getNumberOfPages();
              for (let p = 1; p <= pageCount; p++) {
                pdf.setPage(p);
                pdf.setFontSize(7);
                pdf.setFont(undefined!, 'normal');
                pdf.setTextColor(150, 150, 150);
                const footerText = companyName
                  ? `Document généré par ${companyName}${companySiret ? ` — SIRET ${companySiret}` : ''}`
                  : 'Document généré automatiquement';
                pdf.text(footerText, 105, 290, { align: 'center' });
                pdf.text(`Page ${p}/${pageCount}`, 196, 290, { align: 'right' });
                pdf.setTextColor(0, 0, 0);
              }

              blob = pdf.output('blob');
            }
          } catch {
            // PDF generation failed silently
          }
        }

        if (blob && blob.size > 0) {
          zip.file(`${folderPath}/${fileName}`, blob);
          filesAdded++;
        }
      }

      // --- Collect expense receipts ---
      const expenseRows = filtered.filter(r => r.type === 'expense');
      if (expenseRows.length > 0) {
        const { data: expenseRecords } = await supabase
          .from('expenses')
          .select('id, title, expense_date, receipt_url, chantier_id')
          .eq('user_id', user.id)
          .in('id', expenseRows.map(e => e.id));

        for (const exp of (expenseRecords || [])) {
          if (!exp.receipt_url) continue;
          const matchRow = expenseRows.find(e => e.id === exp.id);
          const clientFolder = (matchRow?.clientName || 'Sans_Client').replace(/[\/\\]/g, '_');
          const projectFolder = (matchRow?.projectName || 'Sans_Projet').replace(/[\/\\]/g, '_');
          const ext = exp.receipt_url.split('.').pop()?.split('?')[0] || 'jpg';
          const fileName = `${fmtDate(exp.expense_date)}_${exp.title.replace(/[\/\\:]/g, '_').slice(0, 40)}.${ext}`;

          try {
            const blob = await fetchBlob(exp.receipt_url, 'expense-receipts');
            if (blob && blob.size > 0) {
              zip.file(`${clientFolder}/${projectFolder}/Depenses/${fileName}`, blob);
              filesAdded++;
            }
          } catch {
            // receipt fetch failed silently
          }
        }
      }

      if (filesAdded === 0) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'الأرشيف فارغ' : 'Archive vide',
          description: isRTL ? 'لم يتم العثور على ملفات مرفقة للتحميل' : 'Aucun fichier attaché trouvé',
        });
        return;
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archive_comptable_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: isRTL ? 'تم تحميل الأرشيف' : 'Archive téléchargée',
        description: isRTL ? `تم تحميل ${filesAdded} ملف(ات) في ملف مضغوط` : `${filesAdded} fichier(s) archivé(s)`,
      });
    } catch {
      // archive error handled via toast
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل تحميل الأرشيف' : "Échec du téléchargement de l'archive",
      });
    } finally {
      setArchiving(false);
    }
  };

  const typeConfig: Record<string, { label: { fr: string; ar: string }; color: string }> = {
    devis: { label: { fr: 'Devis', ar: 'دوفي' }, color: 'bg-blue-500/15 text-blue-400' },
    facture: { label: { fr: 'Facture', ar: 'فاتورة' }, color: 'bg-emerald-500/15 text-emerald-400' },
    expense: { label: { fr: 'Dépense', ar: 'مصروف' }, color: 'bg-red-500/15 text-red-400' },
  };

  if (!user) {
    return (
      <div className="py-8 text-center">
        <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{isRTL ? 'يرجى تسجيل الدخول' : 'Veuillez vous connecter'}</p>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      {/* Avertissement comptable — EN PREMIER */}
      <div
        className="rounded-xl border p-3 flex items-start gap-2"
        style={{ backgroundColor: '#FFF8E1', borderColor: '#F59E0B' }}
      >
        <span className="text-base leading-none mt-0.5">⚠️</span>
        <p
          className={cn('text-[12px] leading-snug font-medium', isRTL && 'text-right font-cairo')}
          style={{ color: '#7C5A00' }}
        >
          {isRTL
            ? 'هذه الأرقام مبنية على فواتيرك فقط — تواصل مع محاسبك للحسابات الدقيقة'
            : 'Ces chiffres sont basés uniquement sur vos factures — consultez votre comptable pour les calculs exacts'}
        </p>
      </div>

      {/* Header */}
      <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <h1 className={cn('text-xl font-bold text-foreground', isRTL && 'font-cairo')}>
          {isRTL ? '💰 إدارة الحسابات' : '💰 Gestion Comptable'}
        </h1>
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-accent/40 text-accent hover:bg-accent/10"
            onClick={() => setShowOcrModal(true)}
          >
            <Receipt className="h-4 w-4" />
            {isRTL ? '📷 مسح فاتورة' : 'Scanner'}
          </Button>
          <Button
            size="sm"
            className="gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4" />
            {isRTL ? 'إضافة' : 'Ajouter'}
          </Button>
        </div>
      </div>

      {/* Comptabilité submenu */}
      <Card className="border-border bg-card">
        <CardContent className="p-3 space-y-3">
          <Button
            variant="ghost"
            className={cn("w-full h-11 justify-between", isRTL && "flex-row-reverse")}
            onClick={() => setShowAccountingMenu(prev => !prev)}
          >
            <span className={cn("text-sm font-bold", isRTL && "font-cairo")}>
              {isRTL ? 'المحاسبة' : 'Comptabilité'}
            </span>
            {showAccountingMenu ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {showAccountingMenu && (
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-12 gap-2" onClick={() => navigate('/pro/documents')}>
                <FileText className="h-4 w-4 text-primary" />
                <span className={cn("text-sm font-bold", isRTL && "font-cairo")}>
                  {isRTL ? 'المستندات' : 'Documents'}
                </span>
              </Button>
              <Button variant="outline" className="h-12 gap-2" onClick={() => navigate('/clients')}>
                <Users className="h-4 w-4 text-primary" />
                <span className={cn("text-sm font-bold", isRTL && "font-cairo")}>
                  {isRTL ? 'العملاء' : 'Clients'}
                </span>
              </Button>
              <Button variant="outline" className="h-12 gap-2" onClick={() => navigate('/chantiers')}>
                <HardHat className="h-4 w-4 text-primary" />
                <span className={cn("text-sm font-bold", isRTL && "font-cairo")}>
                  {isRTL ? 'مشاريعي (الشانتيات)' : 'Chantiers'}
                </span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2 Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-cyan-500/20 bg-cyan-500/5">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-2">
              <Banknote className="h-5 w-5 text-cyan-400" />
            </div>
            <p className={cn("text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1", isRTL && "font-cairo")}>
              {isRTL ? '💰 الأموال المحصلة' : '💰 Trésorerie encaissée'}
            </p>
            <p className="text-lg font-black text-cyan-400">{formatCurrency(totalCollected)}</p>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-2">
              <TrendingDown className="h-5 w-5 text-red-400" />
            </div>
            <p className={cn("text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1", isRTL && "font-cairo")}>
              {isRTL ? 'إجمالي المصروفات' : 'Total Dépenses'}
            </p>
            <p className="text-lg font-black text-red-400">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          className={cn("w-full gap-2.5 bg-primary text-primary-foreground hover:bg-primary/90 h-14 rounded-xl shadow-md", isRTL && "flex-row-reverse font-cairo")}
          onClick={handleAccountantExport}
          disabled={filtered.length === 0 || sendingToAccountant}
        >
          {sendingToAccountant ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          <span className="font-bold" style={{ fontSize: '16px' }}>
            {isRTL ? 'تصدير بيانات المحاسب' : 'Export comptable'}
          </span>
        </Button>
        <Button
          variant="outline"
          className={cn("w-full gap-2.5 h-14 rounded-xl border-2 border-accent/30 shadow-md", isRTL && "flex-row-reverse font-cairo")}
          onClick={handleArchiveDownload}
          disabled={filtered.length === 0 || archiving}
        >
          {archiving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Archive className="h-5 w-5" />}
          <span className="font-bold" style={{ fontSize: '16px' }}>
            {isRTL ? 'تحميل أرشيف المستندات' : 'Archive documents'}
          </span>
        </Button>
      </div>

      {/* Unpaid invoices reminder block */}
      <UnpaidInvoicesBlock documents={documentItems} isRTL={isRTL} />

      {/* Test data diagnostic / reset panel */}
      {totalPaidCount > 0 && (
        <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-900/10">
          <CardContent className="p-3 space-y-2">
            <button
              type="button"
              onClick={() => setShowDiagnostic(s => !s)}
              className={cn('w-full flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}
            >
              <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className={cn('text-sm font-bold text-amber-800 dark:text-amber-300', isRTL && 'font-cairo')}>
                  {isRTL
                    ? `🧪 تشخيص: ${totalPaidCount} فاتورة مدفوعة`
                    : `🧪 Diagnostic : ${totalPaidCount} facture${totalPaidCount > 1 ? 's' : ''} marquée${totalPaidCount > 1 ? 's' : ''} payée${totalPaidCount > 1 ? 's' : ''}`}
                </span>
              </div>
              {showDiagnostic ? <ChevronUp className="h-4 w-4 text-amber-700" /> : <ChevronDown className="h-4 w-4 text-amber-700" />}
            </button>

            {showDiagnostic && (
              <div className="space-y-1.5 pt-1">
                <p className={cn('text-[11px] text-muted-foreground', isRTL && 'text-right font-cairo')}>
                  {isRTL
                    ? 'إذا كانت هذه بيانات اختبار، اضغط لإعادة التعيين إلى "غير مدفوع".'
                    : 'Si ce sont des données de test, réinitialisez-les à « impayé » par client.'}
                </p>
                {paidByClient.map(c => (
                  <div
                    key={c.clientName}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md bg-background/60 border border-border px-2.5 py-1.5',
                      isRTL && 'flex-row-reverse'
                    )}
                  >
                    <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                      <p className="text-xs font-semibold truncate">{c.clientName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.count} × · {formatCurrency(c.total)}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] border-amber-500/40 text-amber-700 dark:text-amber-400 gap-1 shrink-0"
                          disabled={resettingClient === c.clientName}
                        >
                          {resettingClient === c.clientName
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <RotateCcw className="h-3 w-3" />}
                          {isRTL ? 'غير مدفوع' : 'Impayé'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className={cn(isRTL && 'text-right font-cairo')}>
                            {isRTL ? 'تأكيد إعادة التعيين' : 'Confirmer la réinitialisation'}
                          </AlertDialogTitle>
                          <AlertDialogDescription className={cn(isRTL && 'text-right font-cairo')}>
                            {isRTL
                              ? `سيتم وضع علامة "غير مدفوع" على ${c.count} فاتورة لـ ${c.clientName}. لن يتم حذف أي مستند.`
                              : `${c.count} facture(s) de "${c.clientName}" (${formatCurrency(c.total)}) seront marquées comme impayées. Aucun document ne sera supprimé.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Annuler'}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleResetClientPaid(c.clientName)}>
                            {isRTL ? 'تأكيد' : 'Confirmer'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}



      <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <h2 className={cn('text-base font-bold text-foreground', isRTL && 'font-cairo')}>
          {isRTL ? '📋 آخر العمليات' : '📋 Dernières Opérations'}
        </h2>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-28 h-8 text-xs bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? 'الكل' : 'Tout'}</SelectItem>
            <SelectItem value="month">{isRTL ? 'هذا الشهر' : 'Ce mois'}</SelectItem>
            <SelectItem value="quarter">{isRTL ? 'هذا الربع' : 'Ce trimestre'}</SelectItem>
            <SelectItem value="year">{isRTL ? 'هذه السنة' : 'Cette année'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Unified Timeline */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-12 text-center">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className={cn('text-sm text-muted-foreground', isRTL && 'font-cairo')}>
              {isRTL ? 'لا توجد عمليات بعد' : 'Aucune opération enregistrée'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => {
          const tc = typeConfig[row.type];
            const date = new Date(row.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
            const isOverdue = row.type === 'facture' && (new Date().getTime() - new Date(row.date).getTime()) > 30 * 24 * 60 * 60 * 1000;

            return (
              <Card key={`${row.type}-${row.id}`} className="border-border hover:border-accent/30 transition-colors">
                <CardContent className={cn('p-3', isRTL && 'text-right')}>
                  <div className={cn('flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}>
                    <div className={cn('flex items-center gap-2.5 flex-1 min-w-0', isRTL && 'flex-row-reverse')}>
                      {/* Date chip */}
                      <span className="text-[11px] font-semibold text-muted-foreground bg-muted/50 rounded-md px-2 py-1 shrink-0">
                        {date}
                      </span>

                      {/* Type badge */}
                      <Badge variant="secondary" className={cn('text-[10px] shrink-0', tc.color)}>
                        {isRTL ? tc.label.ar : tc.label.fr}
                      </Badge>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-[10px] shrink-0 animate-pulse">
                          {isRTL ? 'متأخرة' : 'En retard'}
                        </Badge>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className={cn('flex items-center gap-1.5 flex-wrap', isRTL && 'flex-row-reverse')}>
                          {/* Clickable document label */}
                          <button
                            className="text-sm font-bold text-foreground hover:text-accent truncate transition-colors flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (row.pdfUrl) {
                                window.open(row.pdfUrl, '_blank');
                              } else if (row.type !== 'expense') {
                                navigate('/pro/documents', { state: { openDocumentId: row.id } });
                              }
                            }}
                          >
                            {row.type !== 'expense' && <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            <span className="truncate">{row.label}</span>
                          </button>
                        </div>
                        <div className={cn('flex items-center gap-1.5 text-xs mt-0.5 flex-wrap', isRTL && 'flex-row-reverse')}>
                          {/* Clickable client */}
                          {row.clientName && (
                            <button
                              className="text-muted-foreground hover:text-accent transition-colors truncate"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (row.clientId) navigate(`/clients/${row.clientId}`);
                              }}
                            >
                              {row.clientName}
                            </button>
                          )}
                          {row.clientName && row.projectName && <span className="text-muted-foreground/40">•</span>}
                          {/* Clickable project */}
                          {row.projectName && (
                            <button
                              className="text-accent/70 hover:text-accent transition-colors truncate"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (row.projectId) navigate(`/chantiers/${row.projectId}`);
                              }}
                            >
                              {row.projectName}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount */}
                    <span className={cn(
                      'text-sm font-black shrink-0',
                      row.type === 'expense' ? 'text-red-400' : row.type === 'facture' ? 'text-emerald-400' : 'text-blue-400'
                    )}>
                      {row.type === 'expense' ? '-' : ''}{formatCurrency(row.amount)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


      {/* Security Badge */}
      <SecurityBadge />

      <AddExpenseModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        isRTL={isRTL}
        userId={user.id}
        onExpenseAdded={fetchAll}
      />

      <OcrInvoiceScannerModal
        open={showOcrModal}
        onOpenChange={setShowOcrModal}
        isRTL={isRTL}
        userId={user.id}
        onSaved={fetchAll}
      />
    </div>
  );
};

export default ExpensesPage;
