import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, FileText, Receipt, Trash2, Eye, ArrowRightLeft, Calendar, Euro, Copy, Download, Filter, Search, SendHorizontal, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateProfessionalCSV, downloadCSV, type CsvDocumentRow } from '@/lib/csvExport';

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
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRow | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!user || user.is_anonymous) {
      setIsAdmin(true);
      return;
    }

    (async () => {
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      setIsAdmin(data === true);
    })();
  }, [user]);

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
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      documentsQuery.eq('user_id', user.id);
    }

    const { data, error } = await documentsQuery;
    if (!error && data) setDocuments(data);
    setLoading(false);
  };

  useEffect(() => { fetchDocuments(); }, [user, isAdmin, authLoading]);

  useEffect(() => {
    const targetId = (location.state as { openDocumentId?: string } | null)?.openDocumentId;
    if (!targetId || documents.length === 0) return;

    const target = documents.find((doc) => doc.id === targetId);
    if (target) {
      setSelectedDocument(target);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, documents, navigate]);

  const handleDelete = async (id: string) => {
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

  const handleConvertToInvoice = async (doc: DocumentRow) => {
    // Prevent double conversion
    if ((doc as any).converted_to_invoice) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
        description: isRTL ? 'تم إنشاء فاتورة بالفعل من هذا الدوفي' : 'Une facture a déjà été créée depuis ce devis',
      });
      return;
    }
    
    // Extract full data from document_data JSON
    const docData = doc.document_data || {};
    const items = docData.items || [];
    
    const prefill = {
      clientName: doc.client_name || docData.client?.name || '',
      clientAddress: doc.client_address || docData.client?.address || '',
      clientPhone: docData.client?.phone || '',
      clientEmail: docData.client?.email || '',
      clientSiren: docData.client?.siren || '',
      clientTvaIntra: docData.client?.tvaIntra || '',
      clientIsB2B: docData.client?.isB2B || false,
      workSiteAddress: doc.work_site_address || docData.workSite?.address || '',
      natureOperation: doc.nature_operation || docData.natureOperation || '',
      items: items.map((item: any) => ({
        designation_fr: item.designation_fr || '',
        designation_ar: item.designation_ar || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'm²',
        unitPrice: item.unitPrice || 0,
      })),
      notes: docData.legalMentions || '',
      source: 'devis_conversion',
      sourceDocumentId: doc.id,
      sourceDocumentNumber: doc.document_number,
    };
    
    sessionStorage.setItem('quoteToInvoiceData', JSON.stringify(prefill));
    navigate('/pro/invoice-creator?type=facture&prefill=quote');
  };

  const handleDuplicateDevis = (doc: DocumentRow) => {
    const docData = doc.document_data || {};
    const items = docData.items || [];
    
    const prefill = {
      clientName: doc.client_name || docData.client?.name || '',
      clientAddress: doc.client_address || docData.client?.address || '',
      clientPhone: docData.client?.phone || '',
      clientEmail: docData.client?.email || '',
      clientSiren: docData.client?.siren || '',
      clientTvaIntra: docData.client?.tvaIntra || '',
      clientIsB2B: docData.client?.isB2B || false,
      workSiteAddress: doc.work_site_address || docData.workSite?.address || '',
      natureOperation: doc.nature_operation || docData.natureOperation || '',
      items: items.map((item: any) => ({
        designation_fr: item.designation_fr || '',
        designation_ar: item.designation_ar || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'm²',
        unitPrice: item.unitPrice || 0,
      })),
      notes: docData.legalMentions || '',
      source: 'devis_duplication',
    };
    
    sessionStorage.setItem('quoteToInvoiceData', JSON.stringify(prefill));
    navigate('/pro/invoice-creator?type=devis&prefill=quote');
  };

  const handleOpenDocument = (doc: DocumentRow) => {
    setSelectedDocument(doc);
  };

  const handleDirectConvert = async (doc: DocumentRow) => {
    if (!user || converting) return;
    
    // Prevent double conversion
    if ((doc as any).converted_to_invoice) {
      toast({
        title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
        description: isRTL ? 'تم إنشاء فاتورة بالفعل من هذا الدوفي' : 'Une facture a déjà été créée depuis ce devis',
        variant: 'destructive',
      });
      return;
    }
    
    setConverting(true);
    try {
      // 1. Get next facture number
      const year = new Date().getFullYear();
      const { data: nextNumber, error: rpcError } = await supabase.rpc('get_next_document_number', {
        p_user_id: user.id,
        p_document_type: 'facture',
        p_year: year,
      });
      if (rpcError || !nextNumber) throw rpcError || new Error('Failed to get next number');

      // 2. Build new facture from devis data
      const docData = doc.document_data || {};
      const { data: insertedRows, error: insertError } = await (supabase.from('documents_comptables') as any).insert({
        user_id: user.id,
        document_type: 'facture',
        document_number: nextNumber,
        client_name: doc.client_name,
        client_address: doc.client_address,
        work_site_address: doc.work_site_address,
        nature_operation: doc.nature_operation,
        subtotal_ht: doc.subtotal_ht,
        tva_amount: doc.tva_amount,
        total_ttc: doc.total_ttc,
        status: 'draft',
        document_data: { ...docData, convertedFromDevis: doc.document_number },
        chantier_id: (doc as any).chantier_id || null,
      }).select('id').single();
      if (insertError) throw insertError;

      const newInvoiceId = insertedRows?.id || null;

      // 3. Mark original devis as converted with link to invoice
      await (supabase.from('documents_comptables') as any)
        .update({ status: 'converted', converted_to_invoice: true, linked_invoice_id: newInvoiceId })
        .eq('id', doc.id);

      toast({
        title: isRTL ? '✅ تم التحويل' : '✅ Converti',
        description: isRTL
          ? `تم إنشاء فاتورة ${nextNumber} من الدوفي ${doc.document_number}`
          : `Facture ${nextNumber} créée depuis le devis ${doc.document_number}`,
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
              "bg-amber-500/15 text-amber-400"
            )}>
              {doc.status === 'finalized' ? (isRTL ? 'نهائي' : 'Finalisé') :
               doc.status === 'converted' ? (isRTL ? 'تم التحويل' : 'Converti') :
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

        {/* Actions */}
        <div className={cn("mt-3 flex items-center gap-2 pt-3 border-t border-[hsl(0,0%,18%)]", isRTL && "flex-row-reverse")}>
          {isDevis && (
            <>
              {(doc as any).converted_to_invoice ? (
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
                        if (linked) setSelectedDocument(linked as any);
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
                  onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(doc); }}
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-[hsl(0,0%,45%)] hover:text-red-400 hover:bg-red-500/10"
            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
            disabled={deletingId === doc.id}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
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
        </Tabs>
      </div>

      <Dialog open={Boolean(selectedDocument)} onOpenChange={(open) => !open && setSelectedDocument(null)}>
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
                  (isRTL ? 'مسودة' : 'Brouillon')
                }</p>
              </div>

              {/* Convert Devis → Facture button */}
              {selectedDocument.document_type === 'devis' && (
                <div className={cn("pt-3 border-t border-border", isRTL && "text-right")}>
                  {(selectedDocument as any).converted_to_invoice ? (
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
                            if (linked) setSelectedDocument(linked as any);
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsListPage;
