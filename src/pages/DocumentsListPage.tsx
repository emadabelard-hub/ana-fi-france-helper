import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, FileText, Receipt, Trash2, Eye, ArrowRightLeft, Calendar, Euro, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import AuthModal from '@/components/auth/AuthModal';

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
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const DocumentsListPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase
      .from('documents_comptables') as any)
      .select('id, document_type, document_number, client_name, client_address, subtotal_ht, tva_amount, total_ttc, status, created_at, nature_operation, document_data, work_site_address')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setDocuments(data);
    setLoading(false);
  };

  useEffect(() => { fetchDocuments(); }, [user]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await (supabase.from('documents_comptables') as any).delete().eq('id', id);
    if (!error) {
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast({ title: isRTL ? 'تم الحذف' : 'Supprimé', description: isRTL ? 'تم حذف المستند' : 'Document supprimé avec succès.' });
    }
    setDeletingId(null);
  };

  const handleConvertToInvoice = async (doc: DocumentRow) => {
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

  const devis = documents.filter(d => d.document_type === 'devis');
  const factures = documents.filter(d => d.document_type === 'facture');

  const handleExportCSV = () => {
    if (documents.length === 0) return;
    const headers = ['Type', 'Numéro', 'Client', 'Date', 'HT (€)', 'TVA (€)', 'TTC (€)', 'Statut'];
    const rows = documents.map(doc => [
      doc.document_type === 'devis' ? 'Devis' : 'Facture',
      doc.document_number,
      `"${(doc.client_name || '').replace(/"/g, '""')}"`,
      new Date(doc.created_at).toLocaleDateString('fr-FR'),
      doc.subtotal_ht.toFixed(2),
      doc.tva_amount.toFixed(2),
      doc.total_ttc.toFixed(2),
      doc.status === 'finalized' ? 'Finalisé' : 'Brouillon',
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `documents_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: isRTL ? '✅ تم التصدير' : '✅ Export réussi', description: isRTL ? 'تم تحميل ملف CSV' : 'Fichier CSV téléchargé' });
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className={cn("text-muted-foreground", isRTL && "font-cairo")}>
          {isRTL ? 'سجل الدخول لعرض مستنداتك' : 'Connectez-vous pour voir vos documents'}
        </p>
        <Button onClick={() => setShowAuth(true)}>{isRTL ? 'تسجيل الدخول' : 'Se connecter'}</Button>
        <AuthModal open={showAuth} onOpenChange={setShowAuth} />
      </div>
    );
  }

  const renderCard = (doc: DocumentRow) => {
    const isDevis = doc.document_type === 'devis';
    const date = new Date(doc.created_at).toLocaleDateString('fr-FR');
    return (
      <div
        key={doc.id}
        className="group relative rounded-xl border border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,12%)] p-4 hover:border-[hsl(45,80%,55%)/0.6] transition-all duration-300 hover:shadow-[0_0_20px_hsl(45,80%,55%,0.1)]"
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

          {/* Status badge */}
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider",
            doc.status === 'finalized' ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
          )}>
            {doc.status === 'finalized' ? (isRTL ? 'نهائي' : 'Finalisé') : (isRTL ? 'مسودة' : 'Brouillon')}
          </span>
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

        {/* Actions */}
        <div className={cn("mt-3 flex items-center gap-2 pt-3 border-t border-[hsl(0,0%,18%)]", isRTL && "flex-row-reverse")}>
          {isDevis && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                onClick={() => handleConvertToInvoice(doc)}
              >
                <ArrowRightLeft className="h-3 w-3" />
                {isRTL ? 'حوّل لفاتورة' : 'Convertir'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1"
                onClick={() => handleDuplicateDevis(doc)}
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
            onClick={() => handleDelete(doc.id)}
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
              {isRTL ? `${documents.length} مستند` : `${documents.length} document${documents.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-[hsl(45,80%,55%)] text-[hsl(0,0%,8%)] hover:bg-[hsl(45,80%,45%)] font-bold gap-1.5 shrink-0"
          onClick={() => navigate('/pro/invoice-creator')}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{isRTL ? 'جديد' : 'Nouveau'}</span>
        </Button>
      </section>

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
    </div>
  );
};

export default DocumentsListPage;
