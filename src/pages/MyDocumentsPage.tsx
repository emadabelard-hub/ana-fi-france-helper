import { useEffect, useMemo, useState } from 'react';
import { Loader2, FileText, Download, Share2, Trash2, FileSpreadsheet, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
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
import { getFreshSignedUrl } from '@/lib/documentArchive';

type DocType = 'all' | 'devis' | 'facture' | 'note_frais';
type Period = 'month' | 'quarter' | 'year';

interface ArchivedDoc {
  id: string;
  type: 'devis' | 'facture' | 'note_frais';
  numero: string | null;
  nom_fichier: string;
  pdf_url: string;
  storage_path: string;
  taille_kb: number;
  amount: number | null;
  status: string | null;
  created_at: string;
}

const STORAGE_LIMIT_MB = 1024; // 1 GB

const MyDocumentsPage = () => {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  const [docs, setDocs] = useState<ArchivedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<DocType>('all');
  const [period, setPeriod] = useState<Period>('month');
  const [toDelete, setToDelete] = useState<ArchivedDoc | null>(null);

  const t = (ar: string, fr: string) => (isRTL ? ar : fr);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (!alive) return;
      if (error) {
        console.error(error);
        toast({ variant: 'destructive', title: t('خطأ', 'Erreur'), description: error.message });
      } else {
        setDocs((data || []) as ArchivedDoc[]);
      }
      setLoading(false);
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

  const totalKb = docs.reduce((sum, d) => sum + (d.taille_kb || 0), 0);
  const totalMb = totalKb / 1024;
  const usagePct = Math.min(100, (totalMb / STORAGE_LIMIT_MB) * 100);

  const handleDownload = async (doc: ArchivedDoc) => {
    const url = (await getFreshSignedUrl(doc.storage_path)) || doc.pdf_url;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nom_fichier;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async (doc: ArchivedDoc) => {
    const url = (await getFreshSignedUrl(doc.storage_path)) || doc.pdf_url;
    const text = encodeURIComponent(`${doc.nom_fichier}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    const doc = toDelete;
    setToDelete(null);
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.storage_path]);
    if (storageError) console.warn('storage delete:', storageError.message);
    const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id);
    if (dbError) {
      toast({ variant: 'destructive', title: t('خطأ', 'Erreur'), description: dbError.message });
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast({ title: t('تم الحذف', 'Supprimé') });
  };

  const typeLabel = (type: ArchivedDoc['type']) => {
    if (type === 'devis') return t('عرض سعر', 'Devis');
    if (type === 'facture') return t('فاتورة', 'Facture');
    return t('فاتورة شراء', 'Note de frais');
  };

  const typeIcon = (type: ArchivedDoc['type']) => {
    if (type === 'devis') return <FileText className="h-5 w-5 text-blue-500" />;
    if (type === 'facture') return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
    return <Receipt className="h-5 w-5 text-orange-500" />;
  };

  if (!user || user.is_anonymous) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">{t('سجل الدخول لرؤية مستنداتك', 'Connectez-vous pour voir vos documents')}</p>
      </div>
    );
  }

  return (
    <div className={`container mx-auto px-4 py-6 max-w-4xl pb-32 ${isRTL ? 'rtl text-right' : ''}`}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{t('مستنداتي', 'Mes documents')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('كل مستنداتك المحفوظة تلقائياً', 'Tous vos PDFs sauvegardés automatiquement')}
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
        <div className="space-y-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="p-4">
              <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="shrink-0 mt-1">{typeIcon(doc.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="font-semibold truncate flex items-center gap-2">
                      {doc.numero || doc.nom_fichier}
                      {(doc.status === 'ocr' || doc.nom_fichier?.startsWith('OCR_')) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          OCR
                        </span>
                      )}
                    </p>
                    {doc.amount != null && (
                      <span dir="ltr" className="text-sm font-medium tabular-nums">
                        {doc.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <span>{typeLabel(doc.type)}</span>
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                    <span>·</span>
                    <span>{(doc.taille_kb / 1024).toFixed(2)} MB</span>
                    {doc.status && (
                      <>
                        <span>·</span>
                        <span className="uppercase">{doc.status}</span>
                      </>
                    )}
                  </div>
                  <div className={`mt-3 flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4 mr-1" />
                      {t('تحميل', 'Télécharger')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleShare(doc)}>
                      <Share2 className="h-4 w-4 mr-1" />
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setToDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t('حذف', 'Supprimer')}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-8 p-4">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-medium">{t('مساحة التخزين', 'Espace utilisé')}</span>
          <span dir="ltr" className="tabular-nums text-muted-foreground">
            {totalMb.toFixed(1)} MB / {STORAGE_LIMIT_MB} MB
          </span>
        </div>
        <Progress value={usagePct} />
      </Card>

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
