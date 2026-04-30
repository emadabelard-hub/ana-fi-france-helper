import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Search, Sparkles, FileText, Receipt, ReceiptText, FolderArchive, Download, ScanLine, Filter, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

import FinancialSummary from '@/components/archive/FinancialSummary';
import UnpaidInvoicesBlock from '@/components/archive/UnpaidInvoicesBlock';
import ShbikLbikCard from '@/components/archive/ShbikLbikCard';
import DocumentCard, { type DocumentItem } from '@/components/archive/DocumentCard';
import AddExpenseModal from '@/components/archive/AddExpenseModal';
import SendToAccountantModal from '@/components/archive/SendToAccountantModal';
import { useProfile } from '@/hooks/useProfile';
import { generateProfessionalCSV, generateAccountingCSV, generateFECCsv, computeVATSynthesis, downloadCSV, type CsvDocumentRow, type AccountingExportData } from '@/lib/csvExport';
import VATSynthesisCard from '@/components/archive/VATSynthesisCard';

const isStoredNatureType = (value: unknown): value is 'service' | 'goods' | 'mixed' =>
  value === 'service' || value === 'goods' || value === 'mixed';

const getStoredWorkDescription = (docData: any, storedNatureOperation?: string | null) =>
  docData?.descriptionChantier
  || docData?.objet
  || (isStoredNatureType(storedNatureOperation) ? '' : (storedNatureOperation || ''));

const ArchiveAccountingPage = () => {
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [expenses, setExpenses] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSendAccountant, setShowSendAccountant] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { profile } = useProfile();
  const convertedSourceNumbers = useMemo(() => {
    const values = documents
      .filter((d) => d.type === 'facture')
      .map((d) => d.rawData?.document_data?.convertedFromDevis)
      .filter(Boolean);
    return new Set(values);
  }, [documents]);
  const isConvertedQuote = (doc: DocumentItem) =>
    doc.type === 'devis' &&
    (doc.rawData?.status === 'converted' ||
      Boolean(doc.rawData?.converted_to_invoice) ||
      Boolean(doc.rawData?.linked_invoice_id) ||
      convertedSourceNumbers.has(doc.number));

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    if (user.is_anonymous) {
      setIsAdmin(false);
      return;
    }
    (async () => {
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      setIsAdmin(data === true);
    })();
  }, [user]);

  // Fetch documents + expenses
  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return; }
    const fetchAll = async () => {
      setLoading(true);

      // SECURITY: Always scope by user_id, even for admins. Admin panel is in /admin.
      const docsQuery = (supabase.from('documents_comptables') as any)
        .select('id, document_type, document_number, client_name, subtotal_ht, tva_amount, total_ttc, status, created_at, nature_operation, document_data, work_site_address, client_address, chantier_id, payment_status, converted_to_invoice, linked_invoice_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const expensesQuery = (supabase.from('expenses') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const [docsRes, expRes] = await Promise.all([docsQuery, expensesQuery]);

      if (docsRes.data) {
        setDocuments(docsRes.data.map((d: any) => ({
          id: d.id,
          type: d.document_type as 'devis' | 'facture',
          number: d.document_number,
          clientName: d.client_name,
          date: new Date(d.created_at).toLocaleDateString('fr-FR'),
          amountHT: d.subtotal_ht,
          amountTTC: d.total_ttc,
          status: d.status === 'finalized' ? 'finalized' : d.status === 'cancelled' ? 'cancelled' : 'draft',
          paymentStatus: d.payment_status || 'unpaid',
          rawData: d,
        })));
      }

      if (expRes.data) {
        setExpenses(expRes.data.map((e: any) => ({
          id: e.id,
          type: 'expense' as const,
          number: `EXP-${e.id.slice(0, 6).toUpperCase()}`,
          clientName: e.title,
          date: new Date(e.expense_date || e.created_at).toLocaleDateString('fr-FR'),
          amountHT: e.amount,
          amountTTC: e.amount + (e.tva_amount || 0),
          status: 'paid' as const,
          rawData: e,
        })));
      }

      setLoading(false);
    };
    fetchAll();
  }, [user, isAdmin, authLoading]);

  // Combine and filter
  const allItems = useMemo(() => [...documents, ...expenses], [documents, expenses]);

  const filtered = useMemo(() => {
    let result = activeTab === 'all' ? allItems
      : activeTab === 'devis' ? allItems.filter(d => d.type === 'devis')
      : activeTab === 'factures' ? allItems.filter(d => d.type === 'facture')
      : allItems.filter(d => d.type === 'expense');

    if (periodFilter !== 'all') {
      const now = new Date();
      let start: Date;
      switch (periodFilter) {
        case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'quarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
        case 'year': start = new Date(now.getFullYear(), 0, 1); break;
        default: start = new Date(0);
      }
      result = result.filter(d => {
        const parts = d.date.split('/');
        const dt = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        return dt >= start;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(d =>
        d.clientName?.toLowerCase().includes(q) ||
        d.number?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allItems, activeTab, periodFilter, searchQuery]);

  // ── Financial totals — 100% encaissement (factures payées uniquement) ──
  const totalFactures = useMemo(() => documents.filter(d => d.type === 'facture').length, [documents]);
  const facturesValidees = useMemo(() =>
    documents.filter(d => d.type === 'facture' && d.status === 'finalized'), [documents]);
  const ignoredFactures = useMemo(() => totalFactures - facturesValidees.length, [totalFactures, facturesValidees]);

  // Seules les factures payées entrent dans les calculs
  const facturesPayees = useMemo(() =>
    facturesValidees.filter(d => d.paymentStatus === 'paid'), [facturesValidees]);

  const caHT = useMemo(() =>
    facturesPayees.reduce((s, d) => s + d.amountHT, 0), [facturesPayees]);
  const depensesHT = useMemo(() =>
    expenses.reduce((s, e) => s + e.amountHT, 0), [expenses]);

  // TVA robuste : TTC - HT si les deux existent, sinon fallback TTC * 0.1667
  const computeTvaForDoc = (d: DocumentItem) => {
    const ttc = d.amountTTC || 0;
    const ht = d.amountHT || 0;
    const dbTva = d.rawData?.tva_amount || 0;
    if (dbTva > 0) return dbTva;
    if (ht > 0 && ttc > ht) return Math.round((ttc - ht) * 100) / 100;
    if (ht === 0 && ttc > 0) return Math.round(ttc * 0.1667 * 100) / 100;
    return 0;
  };

  const tvaCollectee = useMemo(() =>
    facturesPayees.reduce((s, d) => s + computeTvaForDoc(d), 0), [facturesPayees]);
  const tvaDeductible = useMemo(() =>
    expenses.reduce((s, e) => s + (e.rawData?.tva_amount || 0), 0), [expenses]);

  // Trésorerie encaissée = factures payées (TTC)
  const tresorerieEncaissee = useMemo(() =>
    facturesPayees.reduce((s, d) => s + d.amountTTC, 0),
    [facturesPayees]);

  const urssafRate = (profile as any)?.urssaf_rate ?? 21.2;
  const isRate = (profile as any)?.is_rate ?? 15;
  const isTvaExempt = (profile as any)?.tva_exempt ?? false;

  const handleMarkPaid = async (doc: DocumentItem) => {
    if (!user) return;
    await (supabase.from('documents_comptables') as any)
      .update({ payment_status: 'paid' })
      .eq('id', doc.id)
      .eq('user_id', user.id);
    setDocuments(prev => prev.map(d =>
      d.id === doc.id ? { ...d, paymentStatus: 'paid' as const } : d
    ));
    toast({ title: isRTL ? '✅ تم الدفع' : '✅ Marqué comme payé' });
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const doc = documents.find(d => d.id === id);
    // Block deletion of finalized/paid/cancelled invoices
    if (doc && doc.type === 'facture' && (doc.status === 'finalized' || doc.status === ('cancelled' as any) || doc.rawData?.payment_status === 'paid')) {
      toast({
        variant: 'destructive',
        title: isRTL ? '⛔ حذف ممنوع' : '⛔ Suppression interdite',
        description: isRTL
          ? 'لا يمكن حذف فاتورة نهائية أو مدفوعة. يمكنك إلغاؤها بدلاً من ذلك.'
          : 'Impossible de supprimer une facture finalisée ou payée. Utilisez "Annuler la facture".',
      });
      return;
    }
    const isExpense = expenses.some(e => e.id === id);
    if (isExpense) {
      await (supabase.from('expenses') as any).delete().eq('id', id).eq('user_id', user.id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } else {
      await (supabase.from('documents_comptables') as any).delete().eq('id', id).eq('user_id', user.id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    }
    toast({ title: isRTL ? '✅ تم الحذف' : '✅ Supprimé' });
  };

  const handleCancelInvoice = async (doc: DocumentItem) => {
    if (!user) return;
    const { error } = await (supabase.from('documents_comptables') as any)
      .update({ status: 'cancelled' })
      .eq('id', doc.id)
      .eq('user_id', user.id);
    if (!error) {
      setDocuments(prev => prev.map(d =>
        d.id === doc.id ? { ...d, status: 'cancelled' as any } : d
      ));
      toast({
        title: isRTL ? '✅ تم إلغاء الفاتورة' : '✅ Facture annulée',
        description: isRTL ? 'لن يتم احتسابها في الإيرادات.' : 'Elle ne sera plus comptabilisée dans le CA.',
      });
    } else {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: error.message });
    }
  };

  const handleConvert = (doc: DocumentItem) => {
    // Prevent double conversion
    if (isConvertedQuote(doc)) {
      toast({
        title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
        description: isRTL ? 'تم إنشاء فاتورة بالفعل من هذا الدوفي' : 'Une facture a déjà été créée depuis ce devis',
        variant: 'destructive',
      });
      return;
    }
    const raw = doc.rawData;
    if (!raw) return;
    const docData = raw.document_data || {};
    const items = docData.items || [];
    const prefill = {
      clientName: raw.client_name || '',
      clientAddress: raw.client_address || '',
      clientPhone: docData.client?.phone || '',
      clientEmail: docData.client?.email || '',
      workSiteAddress: raw.work_site_address || '',
      natureOperation: isStoredNatureType(docData.natureOperation) ? docData.natureOperation : undefined,
      items: items.map((item: any) => ({
        designation_fr: item.designation_fr || '',
        designation_ar: item.designation_ar || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'm²',
        unitPrice: item.unitPrice || 0,
      })),
      descriptionChantier: getStoredWorkDescription(docData, raw.nature_operation),
      source: 'devis_conversion',
      sourceDocumentId: raw.id,
      sourceDocumentNumber: raw.document_number,
    };
    sessionStorage.setItem('quoteToInvoiceData', JSON.stringify(prefill));
    navigate('/pro/invoice-creator?type=facture&prefill=quote');
  };

  const handleOpenDocument = (doc: DocumentItem) => {
    if (doc.type === 'expense') return;
    navigate('/pro/documents', { state: { openDocumentId: doc.id } });
  };

  // ── Période d'export (sélecteur de dates personnalisé en plus des presets) ──
  const [exportStart, setExportStart] = useState<string>('');
  const [exportEnd, setExportEnd] = useState<string>('');

  const periodBoundaries = useMemo(() => {
    // Si dates personnalisées renseignées, elles priment
    if (exportStart && exportEnd) {
      return { start: new Date(exportStart), end: new Date(exportEnd + 'T23:59:59') };
    }
    const now = new Date();
    switch (periodFilter) {
      case 'month':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3);
        return { start: new Date(now.getFullYear(), q * 3, 1), end: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59) };
      }
      case 'year':
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
      default:
        return null;
    }
  }, [periodFilter, exportStart, exportEnd]);

  const periodLabel = useMemo(() => {
    if (!periodBoundaries) return 'Toutes périodes';
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR');
    return `Du ${fmt(periodBoundaries.start)} au ${fmt(periodBoundaries.end)}`;
  }, [periodBoundaries]);

  const inPeriod = (isoDate: string) => {
    if (!periodBoundaries) return true;
    const d = new Date(isoDate);
    return d >= periodBoundaries.start && d <= periodBoundaries.end;
  };

  const buildCsvRows = (): AccountingExportData => {
    const invoices: CsvDocumentRow[] = facturesValidees
      .filter(d => inPeriod(d.rawData?.created_at || ''))
      .map(d => ({
        date: d.rawData?.created_at || new Date().toISOString(),
        type: 'facture' as const,
        reference: d.number,
        clientName: d.clientName || '',
        documentNumber: d.number,
        totalHT: d.amountHT,
        tvaRate: d.rawData?.tva_rate ?? 0,
        tvaAmount: d.rawData?.tva_amount ?? 0,
        totalTTC: d.amountTTC,
        tvaExempt: d.rawData?.tva_exempt ?? false,
        paymentStatus: d.paymentStatus,
        updatedAt: d.rawData?.updated_at,
      }));
    const expRows: CsvDocumentRow[] = expenses
      .filter(e => inPeriod(e.rawData?.expense_date || e.rawData?.created_at || ''))
      .map(e => ({
        date: e.rawData?.expense_date || e.rawData?.created_at || new Date().toISOString(),
        type: 'expense' as const,
        reference: e.clientName || '',
        clientName: e.clientName || 'Fournisseur',
        totalHT: e.amountHT,
        tvaRate: e.rawData?.tva_amount && e.amountHT ? ((e.rawData.tva_amount / e.amountHT) * 100) : 0,
        tvaAmount: e.rawData?.tva_amount ?? 0,
        totalTTC: e.amountTTC,
        paymentStatus: 'paid',
      }));

    const p: any = profile || {};
    return {
      invoices,
      expenses: expRows,
      company: {
        companyName: p.company_name || p.full_name || '',
        siret: p.siret || '',
        tvaNumber: p.numero_tva || '',
        address: p.company_address || p.address || '',
      },
      period: {
        start: periodBoundaries?.start.toISOString(),
        end: periodBoundaries?.end.toISOString(),
        label: periodLabel,
      },
    };
  };

  const vatSynthesis = useMemo(() => {
    try {
      const data = buildCsvRows();
      if (data.invoices.length === 0 && data.expenses.length === 0) return null;
      return computeVATSynthesis(data);
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturesValidees, expenses, periodBoundaries]);

  const handleExportCSV = () => {
    if (allItems.length === 0) return;
    const allRows: CsvDocumentRow[] = allItems.map(d => ({
      date: d.rawData?.created_at || d.rawData?.expense_date || new Date().toISOString(),
      type: d.type as 'devis' | 'facture' | 'expense',
      reference: d.number,
      clientName: d.clientName || '',
      projectName: d.rawData?.chantier_id ? '' : null,
      totalHT: d.amountHT,
      tvaRate: d.rawData?.tva_rate ?? 0,
      tvaAmount: d.rawData?.tva_amount ?? 0,
      totalTTC: d.amountTTC,
    }));
    const csv = generateProfessionalCSV(allRows);
    downloadCSV(csv, `archive_${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: isRTL ? '✅ تم التصدير' : '✅ Export CSV réussi' });
  };

  const handleExportComptable = () => {
    try {
      const data = buildCsvRows();
      const csv = generateAccountingCSV(data);
      downloadCSV(csv, `comptabilite_${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: isRTL ? '✅ تم التصدير' : '✅ Export comptable réussi' });
    } catch (err: any) {
      toast({ title: '❌ Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const handleExportFEC = () => {
    try {
      const data = buildCsvRows();
      const fec = generateFECCsv(data);
      const blob = new Blob([fec], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const siret = ((profile as any)?.siret || 'FEC').replace(/\s+/g, '');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `${siret}FEC${dateStr}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: isRTL ? '✅ تم تصدير FEC' : '✅ Export FEC réussi' });
    } catch (err: any) {
      toast({ title: '❌ Erreur FEC', description: err.message, variant: 'destructive' });
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <p className={cn('text-muted-foreground', isRTL && 'font-cairo')}>Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <p className={cn('text-muted-foreground', isRTL && 'font-cairo')}>Session invitée indisponible.</p>
      </div>
    );
  }

  const tabItems = [
    { value: 'all', icon: FolderArchive, label: isRTL ? 'الكل' : 'Tout', count: allItems.length },
    { value: 'devis', icon: FileText, label: isRTL ? 'عروض أسعار' : 'Devis', count: documents.filter(d => d.type === 'devis').length },
    { value: 'factures', icon: Receipt, label: isRTL ? 'فواتير' : 'Factures', count: documents.filter(d => d.type === 'facture').length },
    { value: 'expenses', icon: ReceiptText, label: isRTL ? 'حسابات' : 'Dépenses', count: expenses.length },
  ];

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
        <FolderArchive className="h-8 w-8 text-accent/40" />
      </div>
      <p className={cn('text-sm text-muted-foreground', isRTL && 'font-cairo')}>
        {isRTL ? 'لا توجد مستندات في هذه الفئة' : 'Aucun document dans cette catégorie'}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <section className={cn('flex items-center gap-3 py-4 shrink-0', isRTL && 'flex-row-reverse')}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/pro')} className="shrink-0 text-muted-foreground hover:text-accent">
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn('flex items-center gap-3 flex-1', isRTL && 'flex-row-reverse')}>
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center border border-accent/30">
            <FolderArchive className="h-5 w-5 text-accent" />
          </div>
          <div className={cn('flex-1', isRTL && 'text-right')}>
            <h1 className={cn('text-lg font-black text-accent', isRTL && 'font-cairo')}>
              {isRTL ? 'أرشيفك الذكي والمحاسبة' : 'Archive & Comptabilité'}
            </h1>
            <p className={cn('text-xs text-muted-foreground', isRTL && 'font-cairo')}>
              {isRTL ? `${filtered.length} مستند` : `${filtered.length} document${filtered.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-8 w-[120px] border-border bg-transparent text-muted-foreground text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'الكل' : 'Tout'}</SelectItem>
              <SelectItem value="month">{isRTL ? 'هذا الشهر' : 'Ce mois'}</SelectItem>
              <SelectItem value="quarter">{isRTL ? 'هذا الربع' : 'Ce trimestre'}</SelectItem>
              <SelectItem value="year">{isRTL ? 'هذه السنة' : 'Cette année'}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="border-accent/30 text-accent hover:bg-accent/10 font-bold gap-1.5" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </section>

      {/* Search */}
      <div className="relative mb-4 shrink-0">
        <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none', isRTL ? 'right-3' : 'left-3')} />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={isRTL ? 'ابحث بالعميل أو رقم المستند...' : 'Rechercher par client ou n° document...'}
          className={cn(
            'h-10 bg-card border-border text-sm placeholder:text-muted-foreground rounded-xl',
            isRTL ? 'pr-10 pl-10 text-right font-cairo' : 'pl-10 pr-10'
          )}
        />
        <Sparkles className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-accent/50', isRTL ? 'left-3' : 'right-3')} />
      </div>

      {/* Unpaid Invoices - Top priority */}
      <div className="mb-4 shrink-0">
        <UnpaidInvoicesBlock documents={documents} isRTL={isRTL} />
      </div>

      {/* Financial Summary */}
      <div className="mb-4 shrink-0">
        <FinancialSummary
          caHT={caHT}
          depensesHT={depensesHT}
          tvaCollectee={tvaCollectee}
          tvaDeductible={tvaDeductible}
          urssafRate={urssafRate}
          isRate={isRate}
          isRTL={isRTL}
          debugFacturesCount={facturesValidees.length}
          debugDepensesCount={expenses.length}
          debugTotalFactures={totalFactures}
          debugIgnoredFactures={ignoredFactures}
          debugPaidCount={facturesValidees.filter(d => d.paymentStatus === 'paid').length}
          debugUnpaidCount={facturesValidees.filter(d => d.paymentStatus !== 'paid').length}
          tresorerieEncaissee={tresorerieEncaissee}
        />
      </div>

      {/* ShbikLbik */}
      <div className="mb-4 shrink-0">
        <ShbikLbikCard
          totalIncome={caHT + tvaCollectee}
          totalExpenses={depensesHT + tvaDeductible}
          tvaCollectee={tvaCollectee}
          tvaDeductible={tvaDeductible}
          urssafRate={urssafRate}
          isRate={isRate}
          totalIncomeHT={caHT}
          totalExpensesHT={depensesHT}
          isTvaExempt={isTvaExempt}
          isRTL={isRTL}
          tresorerieEncaissee={tresorerieEncaissee}
        />
      </div>

      {/* Tabs & Content */}
      <div className="flex-1 overflow-y-auto pb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-card border border-border p-1 rounded-xl mb-4">
            {tabItems.map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:font-bold text-muted-foreground rounded-lg transition-all text-xs gap-1"
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="text-[10px] opacity-70">({tab.count})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-pulse text-muted-foreground">{isRTL ? 'جاري التحميل...' : 'Chargement...'}</div>
              </div>
            ) : filtered.length === 0 ? renderEmpty() : (
              filtered.map((doc) => {
                const docWithConversionState = isConvertedQuote(doc)
                  ? {
                      ...doc,
                      rawData: {
                        ...(doc.rawData || {}),
                        converted_to_invoice: true,
                      },
                    }
                  : doc;

                return (
                  <DocumentCard
                    key={doc.id}
                    doc={docWithConversionState}
                    isRTL={isRTL}
                    onDelete={handleDelete}
                    onConvert={doc.type === 'devis' ? handleConvert : undefined}
                    onOpen={handleOpenDocument}
                    onMarkPaid={handleMarkPaid}
                    onCancel={doc.type === 'facture' ? handleCancelInvoice : undefined}
                  />
                );
              })
            )}
          </div>
        </Tabs>
      </div>

      {/* Floating Actions */}
      <div className={cn('fixed bottom-24 flex flex-col gap-2 z-30', isRTL ? 'left-4' : 'right-4')}>
        <Button
          size="sm"
          className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold gap-1.5 rounded-full shadow-lg shadow-accent/20 px-4"
          onClick={() => setShowSendAccountant(true)}
        >
          <Send className="h-4 w-4" />
          <span className={cn('text-xs', isRTL && 'font-cairo')}>{isRTL ? 'إرسال المستندات للمحاسب' : 'Envoyer au comptable'}</span>
        </Button>
        <Button
          size="sm"
          className="bg-accent/80 text-accent-foreground hover:bg-accent/70 font-bold gap-1.5 rounded-full shadow-lg shadow-accent/20 px-4"
          onClick={handleExportComptable}
        >
          <Download className="h-4 w-4" />
          <span className={cn('text-xs', isRTL && 'font-cairo')}>{isRTL ? 'ملف المحاسب' : 'Export comptable'}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-accent/30 text-accent hover:bg-accent/10 font-bold gap-1.5 rounded-full shadow-lg px-4"
          onClick={() => setShowAddExpense(true)}
        >
          <ScanLine className="h-4 w-4" />
          <span className={cn('text-xs', isRTL && 'font-cairo')}>{isRTL ? 'إضافة مصروف' : 'Ajouter dépense'}</span>
        </Button>
      </div>

      <AddExpenseModal
        open={showAddExpense}
        onOpenChange={setShowAddExpense}
        isRTL={isRTL}
        userId={user.id}
        onExpenseAdded={() => {
          (supabase.from('expenses') as any)
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then((res: any) => {
              if (res.data) {
                setExpenses(res.data.map((e: any) => ({
                  id: e.id,
                  type: 'expense' as const,
                  number: `EXP-${e.id.slice(0, 6).toUpperCase()}`,
                  clientName: e.title,
                  date: new Date(e.expense_date || e.created_at).toLocaleDateString('fr-FR'),
                  amountHT: e.amount,
                  amountTTC: e.amount + (e.tva_amount || 0),
                  status: 'paid' as const,
                })));
              }
            });
        }}
      />
      <SendToAccountantModal
        open={showSendAccountant}
        onOpenChange={setShowSendAccountant}
        isRTL={isRTL}
        userId={user.id}
        accountantEmail={(profile as any)?.accountant_email}
        onSent={() => {}}
      />
    </div>
  );
};

export default ArchiveAccountingPage;
