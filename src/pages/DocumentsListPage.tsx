import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, FileText, Receipt, Trash2, Eye, ArrowRightLeft, Calendar, Euro, Copy, Download, Filter, Search, SendHorizontal, Loader2, CheckCircle, Ban, Wallet, Pencil, Save, X, Tag, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { resolveAssetUrls } from '@/lib/storageUtils';
import { extractAdvancedPrefillData } from '@/lib/prefillAdvancedData';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateProfessionalCSV, downloadCSV, type CsvDocumentRow } from '@/lib/csvExport';
import InvoiceDisplay from '@/components/invoice/InvoiceDisplay';
import MilestoneInvoiceActions from '@/components/invoice/MilestoneInvoiceActions';
import { ScrollArea } from '@/components/ui/scroll-area';
interface DocumentRow {
  id: string;
  document_type: string;
  document_number: string;
  client_name: string;
  client_address: string | null;
  subtotal_ht: number;
  tva_amount: number;
  total_ttc: number;
  status: string;
  created_at: string;
  nature_operation: string;
  document_data: any;
  work_site_address: string | null;
  sent_to_accountant_at: string | null;
  payment_status: string;
  converted_to_invoice?: boolean;
  linked_invoice_id?: string | null;
}

interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  tva_amount: number;
  category: string;
  expense_date: string;
  notes: string | null;
  receipt_url: string | null;
  chantier_id: string | null;
  document_id: string | null;
  created_at: string;
}

const EXPENSE_CATEGORIES: { value: string; labelFr: string; labelAr: string }[] = [
  { value: 'materials', labelFr: 'Matériaux', labelAr: 'مواد' },
  { value: 'tools', labelFr: 'Outils', labelAr: 'أدوات' },
  { value: 'transport', labelFr: 'Transport', labelAr: 'نقل' },
  { value: 'food', labelFr: 'Repas', labelAr: 'وجبات' },
  { value: 'office', labelFr: 'Fournitures', labelAr: 'لوازم مكتبية' },
  { value: 'insurance', labelFr: 'Assurance', labelAr: 'تأمين' },
  { value: 'telecom', labelFr: 'Télécom', labelAr: 'اتصالات' },
  { value: 'other', labelFr: 'Autre', labelAr: 'أخرى' },
];

const getCategoryLabel = (value: string, isRTL: boolean) => {
  const c = EXPENSE_CATEGORIES.find(x => x.value === value);
  if (!c) return value;
  return isRTL ? c.labelAr : c.labelFr;
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const isStoredNatureType = (value: unknown): value is 'service' | 'goods' | 'mixed' =>
  value === 'service' || value === 'goods' || value === 'mixed';

const getStoredWorkDescription = (docData: any, storedNatureOperation?: string | null) =>
  docData?.descriptionChantier
  || docData?.objet
  || (isStoredNatureType(storedNatureOperation) ? '' : (storedNatureOperation || ''));

const DocumentsListPage = () => {
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentRow | null>(null);
  const [selectedDocumentData, setSelectedDocumentData] = useState<any | null>(null);
  const [showFullView, setShowFullView] = useState(false);
  const [converting, setConverting] = useState(false);

  // Expenses state
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [chantiers, setChantiers] = useState<{ id: string; name: string }[]>([]);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [expenseChantierFilter, setExpenseChantierFilter] = useState<string>('all');
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRow | null>(null);
  const [editingExpense, setEditingExpense] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<Partial<ExpenseRow>>({});
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const convertedSourceNumbers = useMemo(() => {
    const values = documents
      .filter((d) => d.document_type === 'facture')
      .map((d) => d.document_data?.convertedFromDevis)
      .filter(Boolean);
    return new Set(values);
  }, [documents]);

  const isConvertedQuote = (doc: any) =>
    doc?.status === 'converted' ||
    Boolean(doc?.converted_to_invoice) ||
    Boolean(doc?.linked_invoice_id) ||
    convertedSourceNumbers.has(doc?.document_number);

  const hasOfficialDocumentData = (doc: DocumentRow | null | undefined) =>
    Boolean(
      doc?.document_data &&
      typeof doc.document_data === 'object' &&
      !Array.isArray(doc.document_data) &&
      Object.keys(doc.document_data).length > 0,
    );

  const openDocumentView = (doc: DocumentRow) => {
    setSelectedDocument(doc);
    setShowFullView(hasOfficialDocumentData(doc));
  };

  const filteredDocuments = useMemo(() => {
    let result = documents;
    // Period filter
    if (periodFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (periodFilter) {
        case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'quarter': startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
        case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
        default: startDate = new Date(0);
      }
      result = result.filter(d => new Date(d.created_at) >= startDate);
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(d =>
        (d.client_name || '').toLowerCase().includes(q) ||
        (d.document_number || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [documents, periodFilter, searchQuery]);

  const fetchDocuments = async () => {
    if (authLoading || !user) { setLoading(false); return; }
    setLoading(true);

    const documentsQuery = (supabase
      .from('documents_comptables') as any)
      .select('id, document_type, document_number, client_name, client_address, subtotal_ht, tva_amount, total_ttc, status, created_at, nature_operation, document_data, work_site_address, sent_to_accountant_at, payment_status, converted_to_invoice, linked_invoice_id')
      .eq('user_id', user.id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false });

    const expensesQuery = (supabase
      .from('expenses') as any)
      .select('id, title, amount, tva_amount, category, expense_date, notes, receipt_url, chantier_id, document_id, created_at')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: false });

    const chantiersQuery = (supabase
      .from('chantiers') as any)
      .select('id, name')
      .eq('user_id', user.id);

    const [docsRes, expensesRes, chantiersRes] = await Promise.all([documentsQuery, expensesQuery, chantiersQuery]);

    if (!docsRes.error && docsRes.data) setDocuments(docsRes.data);
    if (!expensesRes.error && expensesRes.data) setExpenses(expensesRes.data as ExpenseRow[]);
    if (!chantiersRes.error && chantiersRes.data) setChantiers(chantiersRes.data as { id: string; name: string }[]);
    setLoading(false);
  };

  useEffect(() => { fetchDocuments(); }, [user, authLoading]);

  useEffect(() => {
    let cancelled = false;

    const hydrateSelectedDocumentAssets = async () => {
      if (!selectedDocument?.document_data) {
        setSelectedDocumentData(null);
        return;
      }

      const docData = selectedDocument.document_data;

      try {
        const resolvedAssets = await resolveAssetUrls({
          logoUrl: docData.logoUrl,
          artisanSignatureUrl: docData.artisanSignatureUrl,
          stampUrl: docData.stampUrl,
          headerImageUrl: docData.headerImageUrl,
        });

        if (!cancelled) {
          setSelectedDocumentData({ ...docData, ...resolvedAssets, documentId: selectedDocument.id });
        }
      } catch {
        if (!cancelled) {
          setSelectedDocumentData({ ...docData, documentId: selectedDocument.id });
        }
      }
    };

    hydrateSelectedDocumentAssets();

    return () => {
      cancelled = true;
    };
  }, [selectedDocument]);

  useEffect(() => {
    const targetId = (location.state as { openDocumentId?: string } | null)?.openDocumentId;
    if (!targetId || documents.length === 0) return;

    const target = documents.find((doc) => doc.id === targetId);
    if (target) {
      openDocumentView(target);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, documents, navigate]);

  const handleDelete = async (id: string) => {
    const doc = documents.find(d => d.id === id);
    // Block deletion of finalized/paid/cancelled invoices
    if (doc && doc.document_type === 'facture' && (doc.status === 'finalized' || doc.status === 'cancelled' || doc.payment_status === 'paid')) {
      toast({
        variant: 'destructive',
        title: isRTL ? '⛔ حذف ممنوع' : '⛔ Suppression interdite',
        description: isRTL
          ? 'لا يمكن حذف فاتورة نهائية أو مدفوعة. يمكنك إلغاؤها بدلاً من ذلك.'
          : 'Impossible de supprimer une facture finalisée ou payée. Utilisez "Annuler la facture".',
      });
      return;
    }
    setDeletingId(id);
    const { error } = await (supabase.from('documents_comptables') as any).delete().eq('id', id);
    if (!error) {
      setDocuments(prev => prev.filter(d => d.id !== id));
      if (selectedDocument?.id === id) {
        setSelectedDocument(null);
      }
      toast({ title: isRTL ? 'تم الحذف' : 'Supprimé', description: isRTL ? 'تم حذف المستند' : 'Document supprimé avec succès.' });
    }
    setDeletingId(null);
  };

  const handleCancelInvoice = async (doc: DocumentRow) => {
    const { error } = await (supabase.from('documents_comptables') as any)
      .update({ status: 'cancelled' })
      .eq('id', doc.id);
    if (!error) {
      setDocuments(prev => prev.map(d =>
        d.id === doc.id ? { ...d, status: 'cancelled' } : d
      ));
      toast({
        title: isRTL ? '✅ تم إلغاء الفاتورة' : '✅ Facture annulée',
        description: isRTL ? 'تم إلغاء الفاتورة. لن يتم احتسابها في الإيرادات.' : 'La facture a été annulée. Elle ne sera plus comptabilisée dans le chiffre d\'affaires.',
      });
    } else {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: error.message });
    }
  };

  const handleConvertToInvoice = async (doc: DocumentRow) => {
    if (!user) return;

    // Prevent double conversion
    if (isConvertedQuote(doc)) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
        description: isRTL ? 'تم إنشاء فاتورة بالفعل من هذا الدوفي' : 'Une facture a déjà été créée depuis ce devis',
      });
      return;
    }

    const { data: sourceDevis, error: sourceCheckError } = await (supabase
      .from('documents_comptables') as any)
      .select('id, converted_to_invoice, linked_invoice_id')
      .eq('id', doc.id)
      .eq('user_id', user.id)
      .eq('document_type', 'devis')
      .maybeSingle();

    if (sourceCheckError) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: sourceCheckError.message,
      });
      return;
    }

    if (!sourceDevis || sourceDevis.converted_to_invoice || sourceDevis.linked_invoice_id) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
        description: isRTL ? 'تم إنشاء فاتورة بالفعل من هذا الدوفي' : 'Une facture a déjà été créée depuis ce devis',
      });
      await fetchDocuments();
      return;
    }
    
    // Extract full data from document_data JSON
    const docData = doc.document_data || {};
    const items = docData.items || [];
    const advancedData = extractAdvancedPrefillData(docData);
    
    const prefill = {
      clientName: doc.client_name || docData.client?.name || '',
      clientAddress: doc.client_address || docData.client?.address || '',
      clientPhone: docData.client?.phone || '',
      clientEmail: docData.client?.email || '',
      clientSiren: docData.client?.siren || '',
      clientTvaIntra: docData.client?.tvaIntra || '',
      clientIsB2B: docData.client?.isB2B || false,
      workSiteAddress: doc.work_site_address || docData.workSite?.address || '',
      natureOperation: isStoredNatureType(docData.natureOperation) ? docData.natureOperation : undefined,
      items: items.map((item: any) => ({
        designation_fr: item.designation_fr || '',
        designation_ar: item.designation_ar || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'm²',
        unitPrice: item.unitPrice || 0,
      })),
      notes: docData.legalMentions || '',
      descriptionChantier: getStoredWorkDescription(docData, doc.nature_operation),
      source: 'devis_conversion',
      sourceDocumentId: doc.id,
      sourceDocumentNumber: doc.document_number,
      ...advancedData,
    };
    
    console.log('[DocumentsListPage] FULL PREFILL OK — devis_conversion:', prefill);
    sessionStorage.setItem('quoteToInvoiceData', JSON.stringify(prefill));
    navigate('/pro/invoice-creator?type=facture&prefill=quote');
  };

  const handleDuplicateDevis = (doc: DocumentRow) => {
    const docData = doc.document_data || {};
    const items = docData.items || [];
    const advancedData = extractAdvancedPrefillData(docData);
    
    const prefill = {
      clientName: doc.client_name || docData.client?.name || '',
      clientAddress: doc.client_address || docData.client?.address || '',
      clientPhone: docData.client?.phone || '',
      clientEmail: docData.client?.email || '',
      clientSiren: docData.client?.siren || '',
      clientTvaIntra: docData.client?.tvaIntra || '',
      clientIsB2B: docData.client?.isB2B || false,
      workSiteAddress: doc.work_site_address || docData.workSite?.address || '',
      natureOperation: isStoredNatureType(docData.natureOperation) ? docData.natureOperation : undefined,
      items: items.map((item: any) => ({
        designation_fr: item.designation_fr || '',
        designation_ar: item.designation_ar || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'm²',
        unitPrice: item.unitPrice || 0,
      })),
      notes: docData.legalMentions || '',
      descriptionChantier: getStoredWorkDescription(docData, doc.nature_operation),
      source: 'devis_duplication',
      ...advancedData,
    };
    
    sessionStorage.setItem('quoteToInvoiceData', JSON.stringify(prefill));
    navigate('/pro/invoice-creator?type=devis&prefill=quote');
  };

  const handleOpenDocument = (doc: DocumentRow) => {
    openDocumentView(doc);
  };

  const handleDirectConvert = async (doc: DocumentRow) => {
    if (!user || converting) return;
    
    // Prevent double conversion
    if (isConvertedQuote(doc)) {
      toast({
        title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
        description: isRTL ? 'تم إنشاء فاتورة بالفعل من هذا الدوفي' : 'Une facture a déjà été créée depuis ce devis',
        variant: 'destructive',
      });
      return;
    }
    
    setConverting(true);
    try {
      const { data: sourceDevis, error: sourceCheckError } = await (supabase
        .from('documents_comptables') as any)
        .select('id, converted_to_invoice, linked_invoice_id')
        .eq('id', doc.id)
        .eq('user_id', user.id)
        .eq('document_type', 'devis')
        .maybeSingle();

      if (sourceCheckError) throw sourceCheckError;

      if (!sourceDevis || sourceDevis.converted_to_invoice || sourceDevis.linked_invoice_id) {
        toast({
          title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
          description: isRTL ? 'تم إنشاء فاتورة بالفعل من هذا الدوفي' : 'Une facture a déjà été créée depuis ce devis',
          variant: 'destructive',
        });
        await fetchDocuments();
        return;
      }

      // 1. Build new facture from devis data as draft
      const docData = doc.document_data || {};
      const draftPlaceholder = `F-${new Date().getFullYear()}-DRAFT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const { data: insertedRows, error: insertError } = await (supabase.from('documents_comptables') as any).insert({
        user_id: user.id,
        document_type: 'facture',
        document_number: draftPlaceholder,
        client_name: doc.client_name,
        client_address: doc.client_address,
        work_site_address: doc.work_site_address,
        nature_operation: getStoredWorkDescription(docData, doc.nature_operation),
        subtotal_ht: doc.subtotal_ht,
        tva_amount: doc.tva_amount,
        total_ttc: doc.total_ttc,
        status: 'draft',
        document_data: { ...docData, convertedFromDevis: doc.document_number, convertedFromDevisId: doc.id },
        chantier_id: (doc as any).chantier_id || null,
      }).select('id').single();
      if (insertError) throw insertError;

      const newInvoiceId = insertedRows?.id || null;

      // 3. Mark original devis as converted with link to invoice
      const { data: updatedSource, error: updateError } = await (supabase.from('documents_comptables') as any)
        .update({ status: 'converted', converted_to_invoice: true, linked_invoice_id: newInvoiceId })
        .eq('id', doc.id)
        .eq('user_id', user.id)
        .eq('document_type', 'devis')
        .eq('converted_to_invoice', false)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;

      if (!updatedSource && newInvoiceId) {
        await (supabase.from('documents_comptables') as any)
          .delete()
          .eq('id', newInvoiceId)
          .eq('user_id', user.id);

        toast({
          title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
          description: isRTL ? 'تم منع إنشاء فاتورة مكررة لنفس الدوفي.' : 'La création d’une facture en doublon a été bloquée.',
          variant: 'destructive',
        });
        await fetchDocuments();
        return;
      }

      toast({
        title: isRTL ? '✅ تم التحويل' : '✅ Converti',
        description: isRTL
          ? `تم إنشاء فاتورة (مسودة) من الدوفي ${doc.document_number}`
          : `Facture (brouillon) créée depuis le devis ${doc.document_number}`,
      });

      setSelectedDocument(null);
      fetchDocuments();
    } catch (err: any) {
      toast({ title: isRTL ? 'خطأ' : 'Erreur', description: err?.message || 'Conversion failed', variant: 'destructive' });
    } finally {
      setConverting(false);
    }
  };

  const devis = filteredDocuments.filter(d => d.document_type === 'devis');
  const factures = filteredDocuments.filter(d => d.document_type === 'facture');
  const cvs = filteredDocuments.filter(d => d.document_type === 'cv');

  // ============== EXPENSES helpers ==============
  const chantierMap = useMemo(() => {
    const m: Record<string, string> = {};
    chantiers.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [chantiers]);

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    if (periodFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      switch (periodFilter) {
        case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'quarter': startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
        case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
        default: startDate = new Date(0);
      }
      result = result.filter(e => new Date(e.expense_date) >= startDate);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }
    if (expenseCategoryFilter !== 'all') {
      result = result.filter(e => e.category === expenseCategoryFilter);
    }
    if (expenseChantierFilter !== 'all') {
      result = result.filter(e => e.chantier_id === expenseChantierFilter);
    }
    return result;
  }, [expenses, periodFilter, searchQuery, expenseCategoryFilter, expenseChantierFilter]);

  const openExpenseView = (exp: ExpenseRow) => {
    setSelectedExpense(exp);
    setEditingExpense(false);
    setExpenseDraft({});
  };

  const startEditExpense = () => {
    if (!selectedExpense) return;
    setExpenseDraft({
      title: selectedExpense.title,
      amount: selectedExpense.amount,
      tva_amount: selectedExpense.tva_amount,
      category: selectedExpense.category,
      expense_date: selectedExpense.expense_date,
      notes: selectedExpense.notes,
      chantier_id: selectedExpense.chantier_id,
    });
    setEditingExpense(true);
  };

  const handleSaveExpenseEdit = async () => {
    if (!selectedExpense) return;
    setSavingExpense(true);
    const payload: any = {
      title: (expenseDraft.title || '').toString().trim(),
      amount: Number(expenseDraft.amount) || 0,
      tva_amount: Number(expenseDraft.tva_amount) || 0,
      category: expenseDraft.category || 'other',
      expense_date: expenseDraft.expense_date || selectedExpense.expense_date,
      notes: expenseDraft.notes ? expenseDraft.notes.toString() : null,
      chantier_id: expenseDraft.chantier_id || null,
    };
    const { error } = await (supabase.from('expenses') as any)
      .update(payload)
      .eq('id', selectedExpense.id);
    if (error) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: error.message });
    } else {
      const updated: ExpenseRow = { ...selectedExpense, ...payload };
      setExpenses(prev => prev.map(e => e.id === selectedExpense.id ? updated : e));
      setSelectedExpense(updated);
      setEditingExpense(false);
      toast({ title: isRTL ? '✅ تم الحفظ' : '✅ Modifié' });
    }
    setSavingExpense(false);
  };

  const handleDeleteExpense = async (id: string) => {
    setDeletingExpenseId(id);
    const { error } = await (supabase.from('expenses') as any).delete().eq('id', id);
    if (!error) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      if (selectedExpense?.id === id) setSelectedExpense(null);
      toast({ title: isRTL ? 'تم الحذف' : 'Supprimé' });
    } else {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: error.message });
    }
    setDeletingExpenseId(null);
  };


  const handleExportCSV = () => {
    if (documents.length === 0) return;
    const csvRows: CsvDocumentRow[] = documents.map(doc => ({
      date: doc.created_at,
      type: doc.document_type as 'devis' | 'facture',
      reference: doc.document_number,
      clientName: doc.client_name || '',
      projectName: null,
      totalHT: doc.subtotal_ht,
      tvaRate: doc.subtotal_ht > 0 ? ((doc.tva_amount / doc.subtotal_ht) * 100) : 0,
      tvaAmount: doc.tva_amount,
      totalTTC: doc.total_ttc,
    }));
    const csv = generateProfessionalCSV(csvRows);
    downloadCSV(csv, `documents_${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: isRTL ? '✅ تم التصدير' : '✅ Export réussi', description: isRTL ? 'تم تحميل ملف CSV' : 'Fichier CSV téléchargé' });
  };

  const handleMarkPaid = async (doc: DocumentRow) => {
    await (supabase.from('documents_comptables') as any)
      .update({ payment_status: 'paid' })
      .eq('id', doc.id);
    setDocuments(prev => prev.map(d =>
      d.id === doc.id ? { ...d, payment_status: 'paid' } : d
    ));
    toast({ title: isRTL ? '✅ تم الدفع' : '✅ Marqué comme payé' });
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

  const renderCard = (doc: DocumentRow) => {
    const isDevis = doc.document_type === 'devis';
    const date = new Date(doc.created_at).toLocaleDateString('fr-FR');
    return (
      <div
        key={doc.id}
        className="group relative rounded-xl border border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,12%)] p-4 hover:border-[hsl(45,80%,55%)/0.6] transition-all duration-300 hover:shadow-[0_0_20px_hsl(45,80%,55%,0.1)] cursor-pointer"
        onClick={() => handleOpenDocument(doc)}
      >
        {/* Gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl bg-gradient-to-r from-transparent via-[hsl(45,80%,55%)] to-transparent opacity-60" />

        <div className={cn("flex items-start justify-between gap-3", isRTL && "flex-row-reverse")}>
          <div className={cn("flex items-center gap-3 flex-1 min-w-0", isRTL && "flex-row-reverse")}>
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
              isDevis ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
            )}>
              {isDevis ? <FileText className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
            </div>
            <div className={cn("min-w-0 flex-1", isRTL && "text-right")}>
              <p className="text-sm font-bold text-[hsl(45,80%,70%)] truncate">{doc.document_number}</p>
              <p className="text-xs text-[hsl(0,0%,60%)] truncate">{doc.client_name || (isRTL ? 'بدون عميل' : 'Sans client')}</p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
              doc.status === 'finalized' ? "bg-emerald-500/15 text-emerald-400" :
              doc.status === 'converted' ? "bg-blue-500/15 text-blue-400" :
              doc.status === 'cancelled' ? "bg-red-500/15 text-red-400" :
              "bg-amber-500/15 text-amber-400"
            )}>
              {doc.status === 'finalized' ? (isRTL ? 'نهائي' : 'Finalisé') :
               doc.status === 'converted' ? (isRTL ? 'تم التحويل' : 'Converti') :
               doc.status === 'cancelled' ? (isRTL ? 'ملغاة' : 'Annulée') :
               (isRTL ? 'مسودة' : 'Brouillon')}
            </span>
            {doc.sent_to_accountant_at && (
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 flex items-center gap-1">
                <SendHorizontal className="h-2.5 w-2.5" />
                {isRTL ? 'أُرسل للمحاسب' : 'Envoyé'}
              </span>
            )}
          </div>
        </div>

        {/* Financial row */}
        <div className={cn("mt-3 flex items-center gap-4 text-xs", isRTL && "flex-row-reverse")}>
          <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
            <Calendar className="h-3 w-3 text-[hsl(0,0%,45%)]" />
            <span className="text-[hsl(0,0%,55%)]">{date}</span>
          </div>
          <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
            <Euro className="h-3 w-3 text-[hsl(0,0%,45%)]" />
            <span className="text-[hsl(0,0%,55%)]">HT {formatCurrency(doc.subtotal_ht)}</span>
          </div>
          <span className="font-bold text-[hsl(45,80%,65%)]">TTC {formatCurrency(doc.total_ttc)}</span>
        </div>

        {/* Payment status row for finalized invoices */}
        {!isDevis && doc.status === 'finalized' && (
          <div className={cn("mt-3 flex items-center gap-2", isRTL && "flex-row-reverse")}>
            {doc.payment_status === 'paid' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle className="h-3.5 w-3.5" />
                {isRTL ? 'تم الدفع' : 'Payé'}
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground border border-border">
                  {isRTL ? 'غير مدفوع' : 'Non payé'}
                </span>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5"
                  onClick={(e) => { e.stopPropagation(); handleMarkPaid(doc); }}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {isRTL ? 'تم الدفع' : 'Marquer payé'}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Milestone schedule badge for devis */}
        {isDevis && doc.document_data?.paymentMilestones?.length > 0 && (
          <div className={cn("mt-3 flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
              📋 {isRTL ? `${doc.document_data.paymentMilestones.length} أقساط` : `${doc.document_data.paymentMilestones.length} échéances`}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {isRTL ? 'اضغط لإنشاء الفواتير' : 'Cliquez pour facturer'}
            </span>
          </div>
        )}

        {/* Cancelled banner */}
        {doc.status === 'cancelled' && (
          <div className={cn("mt-3 flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30">
              {isRTL ? 'فاتورة ملغاة – غير محتسبة' : 'Facture annulée – non comptabilisée'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className={cn("mt-3 flex items-center gap-2 pt-3 border-t border-[hsl(0,0%,18%)]", isRTL && "flex-row-reverse")}>
          {isDevis && (
            <>
              {isConvertedQuote(doc) ? (
                <>
                  <span className="text-xs text-amber-400 font-medium">
                    {isRTL ? '✅ تم إنشاء فاتورة بالفعل' : '✅ Facture déjà créée'}
                  </span>
                  {(doc as any).linked_invoice_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        const linked = documents.find((d: any) => d.id === (doc as any).linked_invoice_id);
                          if (linked) openDocumentView(linked as any);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                      {isRTL ? 'عرض الفاتورة' : 'Voir facture'}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                  onClick={(e) => { e.stopPropagation(); void handleConvertToInvoice(doc); }}
                >
                  <ArrowRightLeft className="h-3 w-3" />
                  {isRTL ? 'حوّل لفاتورة' : 'Convertir'}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1"
                onClick={(e) => { e.stopPropagation(); handleDuplicateDevis(doc); }}
              >
                <Copy className="h-3 w-3" />
                {isRTL ? 'نسخ' : 'Dupliquer'}
              </Button>
            </>
          )}
          <div className="flex-1" />
          {/* Cancel action for finalized/paid invoices */}
          {!isDevis && (doc.status === 'finalized' || doc.payment_status === 'paid') && doc.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
              onClick={(e) => { e.stopPropagation(); handleCancelInvoice(doc); }}
            >
              <Ban className="h-3 w-3" />
              {isRTL ? 'إلغاء' : 'Annuler'}
            </Button>
          )}
          {/* Delete only for drafts and non-finalized */}
          {(isDevis || (doc.status !== 'finalized' && doc.status !== 'cancelled' && doc.payment_status !== 'paid')) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-[hsl(0,0%,45%)] hover:text-red-400 hover:bg-red-500/10"
              onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
              disabled={deletingId === doc.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderEmpty = (type: string) => (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-[hsl(45,80%,55%)/0.1] flex items-center justify-center">
        {type === 'devis' ? <FileText className="h-8 w-8 text-[hsl(45,80%,55%)/0.4]" /> : <Receipt className="h-8 w-8 text-[hsl(45,80%,55%)/0.4]" />}
      </div>
      <p className={cn("text-sm text-[hsl(0,0%,45%)]", isRTL && "font-cairo")}>
        {type === 'devis'
          ? (isRTL ? 'ما عندك حتى دوفي بعد' : 'Aucun devis pour le moment')
          : (isRTL ? 'ما عندك حتى فاتورة بعد' : 'Aucune facture pour le moment')}
      </p>
      <Button
        size="sm"
        className="bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)] font-bold gap-1.5"
        onClick={() => navigate(`/pro/invoice-creator?type=${type}`)}
      >
        <Plus className="h-4 w-4" />
        {type === 'devis' ? (isRTL ? 'أنشئ دوفي' : 'Créer un devis') : (isRTL ? 'أنشئ فاتورة' : 'Créer une facture')}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Premium header */}
      <section className={cn("flex items-center gap-4 py-4 shrink-0", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/pro')} className="shrink-0 text-[hsl(0,0%,60%)] hover:text-[hsl(45,80%,55%)]">
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn("flex items-center gap-3 flex-1", isRTL && "flex-row-reverse")}>
          <div className="w-10 h-10 rounded-xl bg-[hsl(45,80%,55%)/0.15] flex items-center justify-center border border-[hsl(45,80%,55%)/0.3]">
            <Receipt className="h-5 w-5 text-[hsl(45,80%,55%)]" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn("text-lg font-bold text-[hsl(45,80%,70%)]", isRTL && "font-cairo")}>
              {isRTL ? 'مستنداتي المحاسبية' : 'Mes Documents'}
            </h1>
            <p className={cn("text-xs text-[hsl(0,0%,50%)]", isRTL && "font-cairo")}>
              {isRTL ? `${filteredDocuments.length} مستند` : `${filteredDocuments.length} document${filteredDocuments.length > 1 ? 's' : ''}`}
              {periodFilter !== 'all' && ` (${periodFilter === 'month' ? (isRTL ? 'هذا الشهر' : 'ce mois') : periodFilter === 'quarter' ? (isRTL ? 'هذا الربع' : 'ce trimestre') : (isRTL ? 'هذه السنة' : 'cette année')})`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-8 w-[130px] border-[hsl(45,60%,35%)/0.3] bg-transparent text-[hsl(0,0%,60%)] text-xs">
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
          {documents.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-[hsl(45,60%,35%)/0.3] text-[hsl(45,80%,55%)] hover:bg-[hsl(45,80%,55%)/0.1] font-bold gap-1.5"
              onClick={handleExportCSV}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          )}
          <Button
            size="sm"
            className="bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)] font-bold gap-1.5"
            onClick={() => navigate('/pro/invoice-creator')}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{isRTL ? 'جديد' : 'Nouveau'}</span>
          </Button>
        </div>
      </section>

      {/* Search bar */}
      <div className="relative mb-3 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={isRTL ? 'بحث بالعميل أو رقم المستند...' : 'Rechercher par client ou n° document...'}
          className={cn("pl-9 h-9 bg-[hsl(0,0%,10%)] border-[hsl(45,60%,35%)/0.2] text-sm placeholder:text-muted-foreground", isRTL && "pr-9 pl-3 text-right font-cairo")}
        />
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto pb-4">
        <Tabs defaultValue="devis" className="w-full">
          <TabsList className="w-full bg-[hsl(0,0%,10%)] border border-[hsl(45,60%,35%)/0.2] p-1 rounded-xl">
            <TabsTrigger
              value="devis"
              className="flex-1 data-[state=active]:bg-[hsl(45,80%,55%)] data-[state=active]:text-[hsl(0,0%,8%)] data-[state=active]:font-bold text-[hsl(0,0%,50%)] rounded-lg transition-all"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              {isRTL ? 'الدوفيهات' : 'Devis'} ({devis.length})
            </TabsTrigger>
            <TabsTrigger
              value="factures"
              className="flex-1 data-[state=active]:bg-[hsl(45,80%,55%)] data-[state=active]:text-[hsl(0,0%,8%)] data-[state=active]:font-bold text-[hsl(0,0%,50%)] rounded-lg transition-all"
            >
              <Receipt className="h-4 w-4 mr-1.5" />
              {isRTL ? 'الفواتير' : 'Factures'} ({factures.length})
            </TabsTrigger>
            <TabsTrigger
              value="expenses"
              className="flex-1 data-[state=active]:bg-[hsl(45,80%,55%)] data-[state=active]:text-[hsl(0,0%,8%)] data-[state=active]:font-bold text-[hsl(0,0%,50%)] rounded-lg transition-all"
            >
              <Wallet className="h-4 w-4 mr-1.5" />
              {isRTL ? 'المصاريف' : 'Dépenses'} ({filteredExpenses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="devis" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-pulse text-[hsl(0,0%,40%)]">{isRTL ? 'جاري التحميل...' : 'Chargement...'}</div>
              </div>
            ) : devis.length === 0 ? renderEmpty('devis') : (
              <div className="grid gap-3">{devis.map(renderCard)}</div>
            )}
          </TabsContent>

          <TabsContent value="factures" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-pulse text-[hsl(0,0%,40%)]">{isRTL ? 'جاري التحميل...' : 'Chargement...'}</div>
              </div>
            ) : factures.length === 0 ? renderEmpty('facture') : (
              <div className="grid gap-3">{factures.map(renderCard)}</div>
            )}
          </TabsContent>

          <TabsContent value="expenses" className="mt-4 space-y-3">
            {/* Expense filters */}
            <div className={cn("flex flex-wrap gap-2", isRTL && "flex-row-reverse")}>
              <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                <SelectTrigger className="h-8 w-[150px] border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,10%)] text-[hsl(0,0%,60%)] text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'كل الفئات' : 'Toutes catégories'}</SelectItem>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{isRTL ? c.labelAr : c.labelFr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={expenseChantierFilter} onValueChange={setExpenseChantierFilter}>
                <SelectTrigger className="h-8 w-[160px] border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,10%)] text-[hsl(0,0%,60%)] text-xs">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'كل المشاريع' : 'Tous les projets'}</SelectItem>
                  {chantiers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-pulse text-[hsl(0,0%,40%)]">{isRTL ? 'جاري التحميل...' : 'Chargement...'}</div>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[hsl(45,80%,55%)/0.1] flex items-center justify-center">
                  <Wallet className="h-8 w-8 text-[hsl(45,80%,55%)/0.4]" />
                </div>
                <p className={cn("text-sm text-[hsl(0,0%,45%)]", isRTL && "font-cairo")}>
                  {isRTL ? 'ما عندك حتى مصروف بعد' : 'Aucune dépense pour le moment'}
                </p>
                <Button
                  size="sm"
                  className="bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)] font-bold gap-1.5"
                  onClick={() => navigate('/expenses')}
                >
                  <Plus className="h-4 w-4" />
                  {isRTL ? 'إضافة مصروف' : 'Ajouter une dépense'}
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredExpenses.map(exp => {
                  const date = new Date(exp.expense_date).toLocaleDateString('fr-FR');
                  const projectName = exp.chantier_id ? chantierMap[exp.chantier_id] : null;
                  const tvaRecoverable = exp.tva_amount > 0;
                  return (
                    <div
                      key={exp.id}
                      className="group relative rounded-xl border border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,12%)] p-4 hover:border-[hsl(45,80%,55%)/0.6] transition-all duration-300 hover:shadow-[0_0_20px_hsl(45,80%,55%,0.1)] cursor-pointer"
                      onClick={() => openExpenseView(exp)}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl bg-gradient-to-r from-transparent via-[hsl(45,80%,55%)] to-transparent opacity-60" />

                      <div className={cn("flex items-start justify-between gap-3", isRTL && "flex-row-reverse")}>
                        <div className={cn("flex items-center gap-3 flex-1 min-w-0", isRTL && "flex-row-reverse")}>
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400">
                            <Wallet className="h-5 w-5" />
                          </div>
                          <div className={cn("min-w-0 flex-1", isRTL && "text-right")}>
                            <p className="text-sm font-bold text-[hsl(45,80%,70%)] truncate">{exp.title}</p>
                            <p className="text-xs text-[hsl(0,0%,60%)] truncate">
                              {projectName || (isRTL ? 'بدون مشروع' : 'Sans projet')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[hsl(45,80%,55%)/0.15] text-[hsl(45,80%,65%)]">
                            {getCategoryLabel(exp.category, isRTL)}
                          </span>
                          <span className={cn(
                            "text-[9px] font-semibold px-2 py-0.5 rounded-full",
                            tvaRecoverable ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/40 text-muted-foreground"
                          )}>
                            {tvaRecoverable
                              ? (isRTL ? 'TVA قابلة للاسترداد' : 'TVA récupérable')
                              : (isRTL ? 'بدون TVA' : 'TVA NON')}
                          </span>
                        </div>
                      </div>

                      <div className={cn("mt-3 flex items-center gap-4 text-xs", isRTL && "flex-row-reverse")}>
                        <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
                          <Calendar className="h-3 w-3 text-[hsl(0,0%,45%)]" />
                          <span className="text-[hsl(0,0%,55%)]">{date}</span>
                        </div>
                        {tvaRecoverable && (
                          <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
                            <Euro className="h-3 w-3 text-[hsl(0,0%,45%)]" />
                            <span className="text-[hsl(0,0%,55%)]">TVA {formatCurrency(exp.tva_amount)}</span>
                          </div>
                        )}
                        <span className="font-bold text-[hsl(45,80%,65%)] ml-auto">TTC {formatCurrency(exp.amount)}</span>
                      </div>

                      <div className={cn("mt-3 flex items-center gap-2 pt-3 border-t border-[hsl(0,0%,18%)]", isRTL && "flex-row-reverse")}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1"
                          onClick={(e) => { e.stopPropagation(); openExpenseView(exp); }}
                        >
                          <Eye className="h-3 w-3" />
                          {isRTL ? 'تفاصيل' : 'Détail'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                          onClick={(e) => { e.stopPropagation(); setSelectedExpense(exp); setExpenseDraft({
                            title: exp.title, amount: exp.amount, tva_amount: exp.tva_amount,
                            category: exp.category, expense_date: exp.expense_date, notes: exp.notes,
                            chantier_id: exp.chantier_id,
                          }); setEditingExpense(true); }}
                        >
                          <Pencil className="h-3 w-3" />
                          {isRTL ? 'تعديل' : 'Modifier'}
                        </Button>
                        <div className="flex-1" />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-[hsl(0,0%,45%)] hover:text-red-400 hover:bg-red-500/10"
                          onClick={(e) => { e.stopPropagation(); handleDeleteExpense(exp.id); }}
                          disabled={deletingExpenseId === exp.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Summary Dialog */}
      <Dialog open={Boolean(selectedDocument) && !showFullView} onOpenChange={(open) => { if (!open) { setSelectedDocument(null); setShowFullView(false); } }}>
        <DialogContent className={cn("max-w-2xl", isRTL && "font-cairo")}>
          {selectedDocument && (
            <>
              <DialogHeader>
                <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse text-right")}>
                  <Eye className="h-4 w-4" />
                  {selectedDocument.document_number}
                </DialogTitle>
              </DialogHeader>

              <div className={cn("space-y-3 text-sm", isRTL && "text-right")}>
                <p><span className="text-muted-foreground">{isRTL ? 'Client:' : 'Client:'}</span> {selectedDocument.client_name || '-'}</p>
                <p><span className="text-muted-foreground">{isRTL ? 'Date:' : 'Date:'}</span> {new Date(selectedDocument.created_at).toLocaleDateString('fr-FR')}</p>
                <p><span className="text-muted-foreground">HT:</span> {formatCurrency(selectedDocument.subtotal_ht)}</p>
                <p><span className="text-muted-foreground">TVA:</span> {formatCurrency(selectedDocument.tva_amount)}</p>
                <p className="font-bold"><span className="text-muted-foreground">TTC:</span> {formatCurrency(selectedDocument.total_ttc)}</p>
                <p><span className="text-muted-foreground">{isRTL ? 'Statut:' : 'Statut:'}</span> {
                  selectedDocument.status === 'finalized' ? (isRTL ? 'نهائي' : 'Finalisé') :
                  selectedDocument.status === 'converted' ? (isRTL ? 'تم التحويل' : 'Converti') :
                  selectedDocument.status === 'cancelled' ? (isRTL ? 'ملغاة' : 'Annulée') :
                  (isRTL ? 'مسودة' : 'Brouillon')
                }</p>
              </div>

              {/* View full document button */}
              {hasOfficialDocumentData(selectedDocument) && (
                <Button
                  className="w-full gap-2 bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)] font-bold"
                  onClick={() => setShowFullView(true)}
                >
                  <Eye className="h-4 w-4" />
                  {isRTL ? '📄 عرض المستند الكامل' : '📄 Voir le document complet'}
                </Button>
              )}

              {/* Convert Devis → Facture button */}
              {selectedDocument.document_type === 'devis' && (
                <div className={cn("pt-3 border-t border-border", isRTL && "text-right")}>
                  {isConvertedQuote(selectedDocument) ? (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-400 font-medium text-center">
                        {isRTL ? '✅ تم إنشاء فاتورة بالفعل' : '✅ Facture déjà créée'}
                      </p>
                      {(selectedDocument as any).linked_invoice_id && (
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => {
                            const linked = documents.find((d: any) => d.id === (selectedDocument as any).linked_invoice_id);
                            if (linked) openDocumentView(linked as any);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          {isRTL ? 'عرض الفاتورة المرتبطة' : 'Voir la facture liée'}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleDirectConvert(selectedDocument)}
                      disabled={converting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 w-full"
                    >
                      {converting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="h-4 w-4" />
                      )}
                      {isRTL ? 'تحويل إلى فاتورة' : 'Convertir en Facture'}
                    </Button>
                  )}
                </div>
              )}

              {/* Milestone invoice actions for devis with payment schedule */}
              {selectedDocument.document_type === 'devis' &&
                selectedDocument.document_data?.paymentMilestones?.length > 0 && (
                <div className={cn("pt-3 border-t border-border")}>
                  <MilestoneInvoiceActions
                    devisDoc={selectedDocument}
                    allDocuments={documents}
                    onViewInvoice={(invoiceId) => {
                      const linked = documents.find(d => d.id === invoiceId);
                      if (linked) openDocumentView(linked as any);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Document View Dialog */}
      <Dialog open={Boolean(selectedDocument) && showFullView} onOpenChange={(open) => { if (!open) { setShowFullView(false); setSelectedDocument(null); } }}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
          {selectedDocument && selectedDocumentData && (
            <div className="flex flex-col h-full">
              <div className={cn("flex items-center justify-between px-4 py-3 border-b border-border shrink-0", isRTL && "flex-row-reverse")}>
                <h2 className={cn("text-sm font-bold", isRTL && "font-cairo")}>
                  {selectedDocument.document_number} — {selectedDocument.document_type === 'devis' ? (isRTL ? 'دوفي' : 'Devis') : (isRTL ? 'فاتورة' : 'Facture')}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => { setShowFullView(false); setSelectedDocument(null); }}>
                  {isRTL ? 'إغلاق' : 'Fermer'}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <InvoiceDisplay
                    data={selectedDocumentData}
                    showArabic={true}
                  />

                  {/* Milestone invoice actions inside full view for devis with payment schedule */}
                  {selectedDocument.document_type === 'devis' &&
                    selectedDocument.document_data?.paymentMilestones?.length > 0 && (
                    <div className={cn("mt-6 pt-4 border-t border-border")}>
                      <MilestoneInvoiceActions
                        devisDoc={selectedDocument}
                        allDocuments={documents}
                        onViewInvoice={(invoiceId) => {
                          const linked = documents.find(d => d.id === invoiceId);
                          if (linked) {
                            setShowFullView(false);
                            setTimeout(() => openDocumentView(linked as any), 100);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expense Detail / Edit Dialog */}
      <Dialog open={Boolean(selectedExpense)} onOpenChange={(open) => { if (!open) { setSelectedExpense(null); setEditingExpense(false); } }}>
        <DialogContent className={cn("max-w-md", isRTL && "font-cairo")}>
          {selectedExpense && (
            <>
              <DialogHeader>
                <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse text-right")}>
                  <Wallet className="h-4 w-4 text-[hsl(45,80%,55%)]" />
                  {editingExpense
                    ? (isRTL ? 'تعديل المصروف' : 'Modifier la dépense')
                    : (isRTL ? 'تفاصيل المصروف' : 'Détail de la dépense')}
                </DialogTitle>
              </DialogHeader>

              {!editingExpense ? (
                <div className={cn("space-y-3 text-sm", isRTL && "text-right")}>
                  <p className="font-bold text-base text-[hsl(45,80%,70%)]">{selectedExpense.title}</p>
                  <p><span className="text-muted-foreground">{isRTL ? 'الفئة:' : 'Catégorie:'}</span> {getCategoryLabel(selectedExpense.category, isRTL)}</p>
                  <p><span className="text-muted-foreground">{isRTL ? 'المشروع:' : 'Projet:'}</span> {selectedExpense.chantier_id ? (chantierMap[selectedExpense.chantier_id] || '-') : '-'}</p>
                  <p><span className="text-muted-foreground">Date:</span> {new Date(selectedExpense.expense_date).toLocaleDateString('fr-FR')}</p>
                  <p><span className="text-muted-foreground">TVA:</span> {formatCurrency(selectedExpense.tva_amount)} {selectedExpense.tva_amount > 0 ? (isRTL ? '(قابلة للاسترداد)' : '(récupérable)') : (isRTL ? '(غير قابلة)' : '(non récupérable)')}</p>
                  <p className="font-bold"><span className="text-muted-foreground">TTC:</span> {formatCurrency(selectedExpense.amount)}</p>
                  {selectedExpense.notes && (
                    <p><span className="text-muted-foreground">Notes:</span> {selectedExpense.notes}</p>
                  )}

                  <div className={cn("flex gap-2 pt-3 border-t border-border", isRTL && "flex-row-reverse")}>
                    <Button
                      className="flex-1 bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)] font-bold gap-2"
                      onClick={startEditExpense}
                    >
                      <Pencil className="h-4 w-4" />
                      {isRTL ? 'تعديل' : 'Modifier'}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
                      onClick={() => handleDeleteExpense(selectedExpense.id)}
                      disabled={deletingExpenseId === selectedExpense.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      {isRTL ? 'حذف' : 'Supprimer'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs font-bold text-muted-foreground", isRTL && "text-right block font-cairo")}>
                      {isRTL ? 'العنوان' : 'Titre'}
                    </Label>
                    <Input
                      value={(expenseDraft.title as string) || ''}
                      onChange={e => setExpenseDraft(d => ({ ...d, title: e.target.value }))}
                      className={cn("bg-background border-border", isRTL && "text-right font-cairo")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">{isRTL ? 'المبلغ TTC (€)' : 'Montant TTC (€)'}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={expenseDraft.amount?.toString() || ''}
                        onChange={e => setExpenseDraft(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))}
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">TVA (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={expenseDraft.tva_amount?.toString() || ''}
                        onChange={e => setExpenseDraft(d => ({ ...d, tva_amount: parseFloat(e.target.value) || 0 }))}
                        className="bg-background border-border"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">{isRTL ? 'الفئة' : 'Catégorie'}</Label>
                      <Select value={(expenseDraft.category as string) || 'other'} onValueChange={v => setExpenseDraft(d => ({ ...d, category: v }))}>
                        <SelectTrigger className="bg-background border-border text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{isRTL ? c.labelAr : c.labelFr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Date</Label>
                      <Input
                        type="date"
                        value={(expenseDraft.expense_date as string) || ''}
                        onChange={e => setExpenseDraft(d => ({ ...d, expense_date: e.target.value }))}
                        className="bg-background border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">{isRTL ? 'المشروع' : 'Projet'}</Label>
                    <Select
                      value={(expenseDraft.chantier_id as string) || 'none'}
                      onValueChange={v => setExpenseDraft(d => ({ ...d, chantier_id: v === 'none' ? null : v }))}
                    >
                      <SelectTrigger className="bg-background border-border text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{isRTL ? 'بدون مشروع' : 'Aucun projet'}</SelectItem>
                        {chantiers.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Notes</Label>
                    <Textarea
                      value={(expenseDraft.notes as string) || ''}
                      onChange={e => setExpenseDraft(d => ({ ...d, notes: e.target.value }))}
                      className={cn("bg-background border-border min-h-[60px]", isRTL && "text-right font-cairo")}
                    />
                  </div>

                  <div className={cn("flex gap-2 pt-3 border-t border-border", isRTL && "flex-row-reverse")}>
                    <Button
                      className="flex-1 bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)] font-bold gap-2"
                      onClick={handleSaveExpenseEdit}
                      disabled={savingExpense}
                    >
                      {savingExpense ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isRTL ? 'حفظ' : 'Enregistrer'}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => { setEditingExpense(false); setExpenseDraft({}); }}
                      disabled={savingExpense}
                    >
                      <X className="h-4 w-4" />
                      {isRTL ? 'إلغاء' : 'Annuler'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsListPage;
