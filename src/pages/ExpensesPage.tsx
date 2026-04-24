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
  ChevronDown, ChevronUp, Users, HardHat, Calculator, Info, Landmark, Shield
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddExpenseModal from '@/components/archive/AddExpenseModal';
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
  const [periodFilter, setPeriodFilter] = useState('all');
  const [showAccountingMenu, setShowAccountingMenu] = useState(false);

  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [documentItems, setDocumentItems] = useState<DocumentItem[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalIncomeHT, setTotalIncomeHT] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [archiving, setArchiving] = useState(false);

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

  const handleAccountantExport = () => {
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

    const csv = generateAccountingCSV({ invoices: invoiceRows, expenses: expenseRows });
    downloadCSV(csv, `rapport_comptable_${new Date().toISOString().slice(0, 10)}.csv`);
    toast({
      title: isRTL ? 'تم التصدير بنجاح' : 'Export réussi',
      description: isRTL ? 'تم تحميل تقرير المحاسب' : 'Le rapport comptable a été téléchargé',
    });
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
      {/* Header */}
      <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <h1 className={cn('text-xl font-bold text-foreground', isRTL && 'font-cairo')}>
          {isRTL ? '💰 إدارة الحسابات' : '💰 Gestion Comptable'}
        </h1>
        <Button
          size="sm"
          className="gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="h-4 w-4" />
          {isRTL ? 'إضافة' : 'Ajouter'}
        </Button>
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

      {/* 4 Large Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

        <Card className={cn('border-indigo-500/20', profitBeforeIS >= 0 ? 'bg-indigo-500/5' : 'bg-red-500/5')}>
          <CardContent className="p-4 text-center">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2", profitBeforeIS >= 0 ? "bg-indigo-500/10" : "bg-red-500/10")}>
              <Wallet className={cn("h-5 w-5", profitBeforeIS >= 0 ? "text-indigo-400" : "text-red-400")} />
            </div>
            <p className={cn("text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1", isRTL && "font-cairo")}>
              {isRTL ? 'الربح قبل الضرائب' : 'Bénéfice avant impôt'}
            </p>
            <p className={cn("text-lg font-black", profitBeforeIS >= 0 ? "text-indigo-400" : "text-red-400")}>
              {formatCurrency(profitBeforeIS)}
            </p>
          </CardContent>
        </Card>

        <Card className={cn('border-blue-500/20', netProfit >= 0 ? 'bg-blue-500/5' : 'bg-red-500/5')}>
          <CardContent className="p-4 text-center">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2", netProfit >= 0 ? "bg-blue-500/10" : "bg-red-500/10")}>
              <Wallet className={cn("h-5 w-5", netProfit >= 0 ? "text-blue-400" : "text-red-400")} />
            </div>
            <p className={cn("text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1", isRTL && "font-cairo")}>
              {isRTL ? 'صافي الربح المقدّر' : 'Bénéfice net estimé'}
            </p>
            <p className={cn("text-lg font-black", netProfit >= 0 ? "text-blue-400" : "text-red-400")}>
              {formatCurrency(netProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown under Net Profit */}
      <div className={cn(
        "mx-2 rounded-xl bg-muted/60 border border-border/50 px-4 py-3 flex items-center gap-3 flex-wrap justify-center",
        isRTL && "font-cairo flex-row-reverse"
      )}>
        <span className="text-[16px] sm:text-[18px] text-violet-400 inline-flex items-center gap-1.5">
          <Shield size={18} className="shrink-0" />
          {isRTL ? 'بعد خصم الأورساف: ' : 'URSSAF: '}
          <span className="font-bold">{formatCurrency(totalURSSAF)}</span>
        </span>
        <span className="text-muted-foreground text-lg">|</span>
        <span className="text-[16px] sm:text-[18px] text-amber-400 inline-flex items-center gap-1.5">
          <Landmark size={18} className="shrink-0" />
          {isRTL ? 'ضريبة تقديرية: ' : 'IS estimé: '}
          <span className="font-bold">{formatCurrency(estimatedIS)}</span>
        </span>
      </div>

      {/* TVA Summary Card */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4">
          <div className={cn('flex items-center gap-2 flex-1', isRTL && 'flex-row-reverse')}>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-amber-400" />
            </div>
            <h3 className={cn('text-sm font-bold text-foreground', isRTL && 'font-cairo')}>
              {isRTL ? '📊 تقرير الضريبة (TVA)' : '📊 Rapport TVA'}
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent side={isRTL ? 'left' : 'right'} className="max-w-[240px] text-xs">
                  <p className={cn(isRTL && 'font-cairo text-right')}>
                    {isRTL
                      ? 'هذا هو المبلغ التقديري للضريبة المستحقة للدولة بعد خصم مصاريفك'
                      : 'Estimation de la TVA due à l\'État après déduction de vos dépenses'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className={cn('text-center', isRTL && 'font-cairo')}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {isRTL ? 'TVA محصّلة' : 'TVA Collectée'}
              </p>
              <p className="text-sm font-black text-emerald-400">{formatCurrency(tvaCollectee)}</p>
            </div>
            <div className={cn('text-center', isRTL && 'font-cairo')}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {isRTL ? 'TVA قابلة للخصم' : 'TVA Déductible'}
              </p>
              <p className="text-sm font-black text-red-400">{formatCurrency(tvaDeductible)}</p>
            </div>
            <div className={cn('text-center', isRTL && 'font-cairo')}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {isRTL ? 'صافي TVA' : 'TVA Nette'}
              </p>
              <p className={cn('text-sm font-black', tvaNet >= 0 ? 'text-amber-400' : 'text-emerald-400')}>
                {formatCurrency(tvaNet)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          className={cn("w-full gap-2.5 bg-primary text-primary-foreground hover:bg-primary/90 h-14 rounded-xl shadow-md", isRTL && "flex-row-reverse font-cairo")}
          onClick={handleAccountantExport}
          disabled={filtered.length === 0}
        >
          <Download className="h-5 w-5" />
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

      {/* URSSAF Summary Card */}
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardContent className="p-4">
          <div className={cn('flex items-center gap-2 flex-1 mb-3', isRTL && 'flex-row-reverse')}>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Landmark className="h-4 w-4 text-violet-400" />
            </div>
            <h3 className={cn('text-sm font-bold text-foreground', isRTL && 'font-cairo')}>
              {isRTL ? '🏛️ مساهمات الأورساف (URSSAF)' : '🏛️ Cotisations URSSAF'}
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent side={isRTL ? 'left' : 'right'} className="max-w-[240px] text-xs">
                  <p className={cn(isRTL && 'font-cairo text-right')}>
                    {isRTL
                      ? 'هذا هو المبلغ التقديري للمساهمات الاجتماعية بناءً على دخلك الحالي'
                      : 'Estimation des cotisations sociales basée sur votre revenu actuel'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className={cn('text-center', isRTL && 'font-cairo')}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {isRTL ? 'إيرادات HT' : 'CA HT'}
              </p>
              <p className="text-sm font-black text-emerald-400">{formatCurrency(filteredIncomeHT)}</p>
            </div>
            <div className={cn('text-center', isRTL && 'font-cairo')}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {isRTL ? `النسبة ${urssafRate}%` : `Taux ${urssafRate}%`}
              </p>
              <p className="text-sm font-black text-violet-400">{urssafRate}%</p>
            </div>
            <div className={cn('text-center', isRTL && 'font-cairo')}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {isRTL ? 'المبلغ المستحق' : 'Montant dû'}
              </p>
              <p className="text-sm font-black text-violet-400">{formatCurrency(totalURSSAF)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default ExpensesPage;
