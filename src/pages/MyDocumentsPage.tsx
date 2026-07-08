import { useEffect, useMemo, useState } from 'react';
import { Loader2, FileText, Receipt, FileSpreadsheet, Trash2, Eye, Calendar, Euro, CheckCircle, Download, FileImage, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { downloadFacturXXml, uploadFacturXXml, CHORUS_PRO_URL, buildFacturXDataFromInvoice } from '@/lib/facturxExport';
import { generateFacturXXml } from '@/lib/facturxXml';
import { refreshExpenseReceiptUrl } from '@/lib/storageUtils';
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
  signature_status?: 'pending' | 'signed' | null;
  signed_at?: string | null;
  receipt_url?: string | null;
  receipt_mime?: 'pdf' | 'image' | null;
  facturx_url?: string | null;
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
  const [signedReceipts, setSignedReceipts] = useState<Record<string, string>>({});


  const t = (ar: string, fr: string) => (isRTL ? ar : fr);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const [comptables, expenses, signatures] = await Promise.all([
        supabase
          .from('documents_comptables')
          .select('id, document_type, document_number, client_name, subtotal_ht, total_ttc, status, payment_status, created_at, document_data, facturx_url')
          .order('created_at', { ascending: false }),
        supabase
          .from('expenses')
          .select('id, title, amount, tva_amount, expense_date, created_at, sent_to_accountant_at, receipt_url')
          .order('created_at', { ascending: false }),
        supabase
          .from('signature_requests')
          .select('document_id, status, signed_at, created_at')
          .order('created_at', { ascending: false }),
      ]);
      if (!alive) return;

      // Map latest signature per document_id
      const sigByDoc = new Map<string, { status: string; signed_at: string | null }>();
      for (const s of (signatures.data || []) as any[]) {
        if (!sigByDoc.has(s.document_id)) {
          sigByDoc.set(s.document_id, { status: s.status, signed_at: s.signed_at });
        }
      }

      const merged: UnifiedDoc[] = [];
      if (comptables.data) {
        for (const d of comptables.data as any[]) {
          const sig = sigByDoc.get(d.id);
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
            signature_status: sig ? (sig.status as 'pending' | 'signed') : null,
            signed_at: sig?.signed_at || null,
            facturx_url: d.facturx_url || null,
          });
        }
      }
      if (expenses.data) {
        for (const e of expenses.data as any[]) {
          const amt = Number(e.amount) || 0;
          const tva = Number(e.tva_amount) || 0;
          const url: string | null = e.receipt_url || null;
          const mime: 'pdf' | 'image' | null = url
            ? (/\.pdf($|\?)/i.test(url) ? 'pdf' : 'image')
            : null;
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
            receipt_url: url,
            receipt_mime: mime,
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

  // Always regenerate fresh signed URLs for expense receipts on display,
  // including for older expenses whose stored URL may be an expired signed URL.
  useEffect(() => {
    const expenseDocs = docs.filter((d) => d.source === 'expense' && d.receipt_url);
    if (expenseDocs.length === 0) return;
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        expenseDocs.map(async (d) => {
          const fresh = await refreshExpenseReceiptUrl(d.receipt_url!, 3600);
          return [d.id, fresh] as const;
        })
      );
      if (!alive) return;
      setSignedReceipts((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) {
          if (url) next[id] = url;
        }
        return next;
      });
    })();
    return () => {
      alive = false;
    };
  }, [docs]);


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
    if (doc.source === 'expense') {
      if (doc.receipt_url) {
        const fresh = await refreshExpenseReceiptUrl(doc.receipt_url, 3600);
        if (fresh) {
          setSignedReceipts((prev) => ({ ...prev, [doc.id]: fresh }));
          window.open(fresh, '_blank');
        } else {
          toast({ title: t('تعذّر فتح الملف', 'Impossible d’ouvrir le fichier'), variant: 'destructive' });
        }
      } else {
        toast({ title: t('لا يوجد ملف مرفق', 'Aucun fichier joint') });
      }
      return;
    }

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

  const handleDownloadReceipt = async (doc: UnifiedDoc) => {
    if (!doc.receipt_url) {
      toast({ title: t('لا يوجد ملف مرفق', 'Aucun fichier joint') });
      return;
    }
    // Always generate a fresh signed Storage URL — never fall back to the raw
    // stored value (which can be a relative path resolved against the app origin).
    let fresh = await refreshExpenseReceiptUrl(doc.receipt_url, 3600);
    if (!fresh) {
      toast({ title: t('تعذّر تحميل الملف', 'Téléchargement impossible'), variant: 'destructive' });
      return;
    }
    setSignedReceipts((prev) => ({ ...prev, [doc.id]: fresh! }));
    try {
      let res = await fetch(fresh);
      if (!res.ok) {
        const retry = await refreshExpenseReceiptUrl(doc.receipt_url, 3600);
        if (retry) {
          fresh = retry;
          setSignedReceipts((prev) => ({ ...prev, [doc.id]: retry }));
          res = await fetch(retry);
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = doc.receipt_mime === 'pdf' ? 'pdf' : (doc.receipt_url.split('.').pop()?.split('?')[0] || 'jpg');
      a.download = `${(doc.document_number || 'facture').replace(/[^\w.-]+/g, '_')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.warn('[MyDocs] download failed:', err);
      // Last-resort: open the signed URL in a new tab (still a real Storage URL).
      window.open(fresh, '_blank');
    }
  };


  const handleSendFacturX = async (doc: UnifiedDoc) => {
    try {
      const [{ data: full }, { data: profile }] = await Promise.all([
        supabase
          .from('documents_comptables')
          .select('document_number, client_name, client_address, subtotal_ht, tva_rate, tva_amount, total_ttc, tva_exempt, work_site_address, nature_operation, created_at, document_data')
          .eq('id', doc.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('company_name, full_name, siret, company_address, address, numero_tva, iban, bic, tva_exempt')
          .eq('user_id', user!.id)
          .maybeSingle(),
      ]);
      if (!full) {
        toast({ title: t('فاتورة غير موجودة', 'Facture introuvable') });
        return;
      }
      downloadFacturXXml(full as any, profile as any);
      window.open(CHORUS_PRO_URL, '_blank', 'noopener,noreferrer');
      toast({
        title: t('تم إنشاء Factur-X', 'Factur-X généré'),
        description: t('تم تحميل XML — افتح Chorus Pro للإرسال', 'XML téléchargé — Chorus Pro ouvert pour envoi'),
      });
    } catch (err) {
      console.error('[MyDocs] FacturX export failed:', err);
      toast({ title: t('خطأ Factur-X', 'Erreur Factur-X'), variant: 'destructive' });
    }
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
          {doc.signature_status === 'pending' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/15 text-amber-400">
              🟡 {t('بانتظار التوقيع', 'En attente de signature')}
            </span>
          )}
          {doc.signature_status === 'signed' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/15 text-emerald-400">
              ✅ {t('موقّع', 'Signé')}{doc.signed_at ? ` ${new Date(doc.signed_at).toLocaleDateString('fr-FR')}` : ''}
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

        {/* Receipt preview for expenses */}
        {doc.source === 'expense' && doc.receipt_url && (
          <div className="mt-3 rounded-lg overflow-hidden border border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,8%)]">
            {doc.receipt_mime === 'image' ? (
              <img
                src={signedReceipts[doc.id] || doc.receipt_url}
                alt={doc.document_number}
                loading="lazy"
                className="w-full h-32 object-cover"
                data-retry="0"
                onError={async (e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  if (el.dataset.retry === '1') return;
                  el.dataset.retry = '1';
                  const fresh = await refreshExpenseReceiptUrl(doc.receipt_url!, 3600);
                  if (fresh) {
                    setSignedReceipts((prev) => ({ ...prev, [doc.id]: fresh }));
                    el.src = fresh;
                  }
                }}
              />

            ) : (
              <div className="w-full h-32 flex flex-col items-center justify-center gap-1 text-[hsl(0,0%,55%)]">
                <FileText className="h-10 w-10 text-red-400" />
                <span className="text-[10px] uppercase tracking-wider">PDF</span>
              </div>
            )}
          </div>
        )}
        {doc.source === 'expense' && !doc.receipt_url && (
          <div className="mt-3 rounded-lg border border-dashed border-[hsl(45,60%,35%)/0.3] bg-[hsl(0,0%,8%)] h-20 flex items-center justify-center text-[11px] text-[hsl(0,0%,45%)]">
            {t('لا يوجد ملف مرفق', 'Aucun fichier joint')}
          </div>
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
          {doc.source === 'expense' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={!doc.receipt_url}
                onClick={(e) => { e.stopPropagation(); handleOpen(doc); }}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                {t('عرض', 'Voir')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={!doc.receipt_url}
                onClick={(e) => { e.stopPropagation(); handleDownloadReceipt(doc); }}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                {t('تحميل', 'Télécharger')}
              </Button>
            </>
          )}
          {doc.source === 'comptable' && doc.type === 'facture' && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-emerald-500/40 text-emerald-400 hover:text-emerald-300"
              onClick={(e) => { e.stopPropagation(); handleSendFacturX(doc); }}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Chorus
            </Button>
          )}
          {doc.source === 'comptable' && doc.type === 'facture' && doc.status === 'finalized' && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs bg-[hsl(0,0%,20%)] border-[hsl(0,0%,30%)] text-[hsl(0,0%,85%)] hover:bg-[hsl(0,0%,25%)] hover:text-white"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  if (!user?.id) throw new Error('not authenticated');

                  const { data, error } = await supabase.functions.invoke(
                    'generate-factur-x',
                    {
                      body: { document_id: doc.id, user_id: user.id },
                    }
                  );

                  toast({
                    title: `DEBUG: data = ${JSON.stringify(data).substring(0, 100)}`,
                  });

                  if (error) throw error;

                  const xmlString = data?.xml;

                  if (!xmlString) {
                    toast({
                      title: `ERREUR: data.xml undefined. data = ${JSON.stringify(data)}`,
                      variant: 'destructive',
                    });
                    throw new Error('No XML generated');
                  }

                  const blob = new Blob([xmlString], { type: 'application/octet-stream' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `facturx-Facture-${doc.document_number}.xml`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                } catch (err: any) {
                  toast({
                    title: `ERREUR: ${err?.message ?? String(err)}`,
                    variant: 'destructive',
                  });
                }
              }}


            >
              <Download className="h-3.5 w-3.5 mr-1" />
              📄 XML Factur-X
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
