import { useEffect, useMemo, useState } from 'react';
import { Loader2, FileText, Receipt, FileSpreadsheet, Trash2, Eye, Calendar, Euro, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type DocType = 'all' | 'devis' | 'facture' | 'note_frais';
type Period = 'month' | 'quarter' | 'year';

interface UnifiedDoc {
  id: string;
  source: 'comptable' | 'expense';
  type: 'devis' | 'facture' | 'note_frais';
  document_number: string;
  client_name: string;
  subtotal_ht: number;
  total_ttc: number;
  status: string | null;
  payment_status?: string | null;
  created_at: string;
  document_data?: any;
}

const formatCurrency = (n: number) =>
  (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const MyDocumentsPage = () => {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [docs, setDocs] = useState<UnifiedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<DocType>('all');
  const [period, setPeriod] = useState<Period>('month');
  const [toDelete, setToDelete] = useState<UnifiedDoc | null>(null);

  const t = (ar: string, fr: string) => (isRTL ? ar : fr);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const [comptables, expenses] = await Promise.all([
        supabase
          .from('documents_comptables')
          .select('id, document_type, document_number, client_name, subtotal_ht, total_ttc, status, payment_status, created_at, document_data')
          .order('created_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('id, title, amount, tva_amount, expense_date, created_at, sent_to_accountant_at')
          .order('created_at', { ascending: false }),
      ]);
      if (!alive) return;

      const merged: UnifiedDoc[] = [];
      if (comptables.data) {
        for (const d of comptables.data as any[]) {
          merged.push({
            id: d.id,
            source: 'comptable',
            type: d.document_type === 'facture' ? 'facture' : 'devis',
            document_number: d.document_number || '—',
            client_name: d.client_name || '',
            subtotal_ht: Number(d.subtotal_ht) || 0,
            total_ttc: Number(d.total_ttc) || 0,
            status: d.status,
            payment_status: d.payment_status,
            created_at: d.created_at,
            document_data: d.document_data,
          });
        }
      }
      if (expenses.data) {
        for (const e of expenses.data as any[]) {
          const amt = Number(e.amount) || 0;
          const tva = Number(e.tva_amount) || 0;
          merged.push({
            id: e.id,
            source: 'expense',
            type: 'note_frais',
            document_number: e.title || '—',
            client_name: '',
            subtotal_ht: amt - tva,
            total_ttc: amt,
            status: null,
            created_at: e.created_at,
          });
        }
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setDocs(merged);
      setLoading(false);

      if (comptables.error) console.error('[MyDocs] comptables:', comptables.error);
      if (expenses.error) console.error('[MyDocs] expenses:', expenses.error);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    return new Date(now.getFullYear(), 0, 1);
  }, [period]);

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (new Date(d.created_at) < periodStart) return false;
      return true;
    });
  }, [docs, typeFilter, periodStart]);

  const handleOpen = async (doc: UnifiedDoc) => {
    if (doc.source !== 'comptable') return;
    try {
      const { data } = await supabase
        .from('documents')
        .select('pdf_url, storage_path')
        .eq('numero', doc.document_number)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let pdfUrl: string | null = (data as any)?.pdf_url ?? null;
      const storagePath: string | null = (data as any)?.storage_path ?? null;

      // Refresh signed URL if we have a storage path (signed URLs expire)
      if (storagePath) {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 60 * 60);
        if (signed?.signedUrl) pdfUrl = signed.signedUrl;
      }

      if (pdfUrl) {
        window.open(pdfUrl, '_blank');
        return;
      }
    } catch (err) {
      console.warn('[MyDocs] open pdf failed:', err);
    }
    // Fallback: navigate to documents list preview
    navigate(`/pro/documents`);
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    const doc = toDelete;
    setToDelete(null);
    const table = doc.source === 'comptable' ? 'documents_comptables' : 'expenses';
    const { error } = await supabase.from(table).delete().eq('id', doc.id);
    if (error) {
      console.error('[MyDocs] delete:', error);
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast({ title: t('تم الحذف', 'Supprimé') });
  };

  if (!user || user.is_anonymous) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">
          {t('سجل الدخول لرؤية مستنداتك', 'Connectez-vous pour voir vos documents')}
        </p>
      </div>
    );
  }

  const renderCard = (doc: UnifiedDoc) => {
    const isDevis = doc.type === 'devis';
    const isFacture = doc.type === 'facture';
    const date = new Date(doc.created_at).toLocaleDateString('fr-FR');
    const milestones: any[] = doc.document_data?.paymentMilestones || [];

    return (
      <div
        key={`${doc.source}-${doc.id}`}
        className="group relative rounded-xl border border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,12%)] p-4 hover:border-[hsl(45,80%,55%)/0.6] transition-all duration-300 cursor-pointer"
        onClick={() => handleOpen(doc)}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl bg-gradient-to-r from-transparent via-[hsl(45,80%,55%)] to-transparent opacity-60" />

        {/* 1. Status badge + icon */}
        <div className={cn('flex items-center gap-2 flex-wrap', isRTL && 'flex-row-reverse')}>
          {doc.status && (
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider',
                doc.status === 'finalized' ? 'bg-emerald-500/15 text-emerald-400' :
                doc.status === 'converted' ? 'bg-blue-500/15 text-blue-400' :
                doc.status === 'cancelled' ? 'bg-red-500/15 text-red-400' :
                'bg-amber-500/15 text-amber-400'
              )}
            >
              {doc.status === 'finalized' ? t('نهائي', 'Finalisé') :
               doc.status === 'converted' ? t('تم التحويل', 'Converti') :
               doc.status === 'cancelled' ? t('ملغاة', 'Annulée') :
               t('مسودة', 'Brouillon')}
            </span>
          )}
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
            isDevis ? 'bg-amber-500/15 text-amber-400' :
            isFacture ? 'bg-emerald-500/15 text-emerald-400' :
            'bg-orange-500/15 text-orange-400'
          )}>
            {isDevis ? <FileText className="h-4 w-4" /> :
             isFacture ? <FileSpreadsheet className="h-4 w-4" /> :
             <Receipt className="h-4 w-4" />}
          </div>
        </div>

        {/* 2. Document number */}
        <p className={cn('mt-2 text-lg font-bold text-[hsl(45,80%,70%)] truncate', isRTL && 'text-right')}>
          {doc.document_number}
        </p>

        {/* 3. Client name */}
        {doc.client_name && (
          <p className={cn('mt-0.5 text-sm text-[hsl(0,0%,75%)] truncate', isRTL && 'text-right')}>
            {doc.client_name}
          </p>
        )}

        {/* 4. TTC / HT / date */}
        <div className={cn('mt-3 flex items-center gap-x-4 gap-y-1 text-xs flex-wrap', isRTL && 'flex-row-reverse')}>
          <div className={cn('flex items-center gap-1', isRTL && 'flex-row-reverse')}>
            <Calendar className="h-3 w-3 text-[hsl(0,0%,45%)]" />
            <span className="text-[hsl(0,0%,55%)]">{date}</span>
          </div>
          <div className={cn('flex items-center gap-1', isRTL && 'flex-row-reverse')}>
            <Euro className="h-3 w-3 text-[hsl(0,0%,45%)]" />
            <span className="text-[hsl(0,0%,55%)]">HT {formatCurrency(doc.subtotal_ht)}</span>
          </div>
          <span className="font-bold text-[hsl(45,80%,65%)]">TTC {formatCurrency(doc.total_ttc)}</span>
        </div>

        {/* 5. Milestones */}
        {milestones.length > 0 && (
          <div className={cn('mt-3 flex flex-wrap gap-1.5', isRTL && 'flex-row-reverse')}>
            {milestones.map((m: any, i: number) => (
              <span
                key={i}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[hsl(45,60%,25%)/0.4] text-[hsl(45,80%,75%)] border border-[hsl(45,60%,35%)/0.4]"
              >
                {m.label || (isRTL ? `قسط ${i + 1}` : `Échéance ${i + 1}`)} · {m.percent || 0}%
              </span>
            ))}
          </div>
        )}

        {/* 6. Actions */}
        <div className={cn('mt-3 pt-3 border-t border-[hsl(45,60%,35%)/0.2] flex gap-2 flex-wrap', isRTL && 'flex-row-reverse')}>
          {doc.source === 'comptable' && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); handleOpen(doc); }}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              {t('عرض', 'Voir')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); setToDelete(doc); }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {t('حذف', 'Supprimer')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={`container mx-auto px-4 py-6 max-w-4xl pb-32 ${isRTL ? 'rtl text-right' : ''}`}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t('مستنداتي', 'Mes documents')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('كل المستندات: عروض الأسعار، الفواتير، فواتير الشراء', 'Tous vos documents : devis, factures, notes de frais')}
        </p>
      </header>

      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocType)} className="mb-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all">{t('الكل', 'Tous')}</TabsTrigger>
          <TabsTrigger value="devis">{t('عرض سعر', 'Devis')}</TabsTrigger>
          <TabsTrigger value="facture">{t('فواتير', 'Factures')}</TabsTrigger>
          <TabsTrigger value="note_frais">{t('فواتير شراء', 'N. frais')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="mb-6">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="month">{t('هذا الشهر', 'Ce mois')}</TabsTrigger>
          <TabsTrigger value="quarter">{t('هذا الفصل', 'Ce trimestre')}</TabsTrigger>
          <TabsTrigger value="year">{t('هذه السنة', 'Cette année')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {t('لا توجد مستندات في هذه الفترة', 'Aucun document sur cette période')}
        </Card>
      ) : (
        <div className="space-y-3">{filtered.map(renderCard)}</div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('تأكيد الحذف', 'Confirmer la suppression')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('سيتم حذف هذا المستند نهائياً.', 'Ce document sera supprimé définitivement.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('إلغاء', 'Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              {t('حذف', 'Supprimer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyDocumentsPage;
