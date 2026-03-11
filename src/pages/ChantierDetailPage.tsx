import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, HardHat, FileText, Receipt, TrendingUp, TrendingDown, Wallet, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const ChantierDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chantier, setChantier] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setLoading(true);
      const { data: ch } = await supabase.from('chantiers').select('*').eq('id', id).single();
      if (ch) {
        setChantier(ch);
        const [{ data: cl }, { data: docs }, { data: exp }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', ch.client_id).single(),
          supabase.from('documents_comptables').select('*').eq('chantier_id', id).order('created_at', { ascending: false }),
          supabase.from('expenses').select('*').eq('chantier_id', id).order('expense_date', { ascending: false }),
        ]);
        setClient(cl);
        setDocuments(docs || []);
        setExpenses(exp || []);
      }
      setLoading(false);
    })();
  }, [user, id]);

  const totalFactured = useMemo(() =>
    documents.filter(d => d.document_type === 'facture' && (d.status === 'finalized' || d.status === 'converted')).reduce((s, d) => s + Number(d.total_ttc || 0), 0),
    [documents]
  );
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);
  const margin = totalFactured - totalExpenses;

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground animate-pulse">{isRTL ? 'جاري التحميل...' : 'Chargement...'}</div>;
  }

  if (!chantier) {
    return <div className="text-center py-12 text-muted-foreground">{isRTL ? 'المشروع غير موجود' : 'Chantier introuvable'}</div>;
  }

  const statusLabelMap: Record<string, { fr: string; ar: string }> = {
    etude: { fr: 'Étude', ar: 'قيد الدراسة' },
    devis_envoye: { fr: 'Devis envoyé', ar: 'تم ارسال الدوفي' },
    en_cours_travaux: { fr: 'En cours de travaux', ar: 'قيد التنفيذ' },
    facture_envoyee: { fr: 'Facture envoyée', ar: 'تم ارسال الفاتورة' },
    paiement_attente: { fr: 'Paiement en attente', ar: 'فاتورة قيد التحصيل' },
    facture_payee: { fr: 'Facture payée', ar: 'تم تحصيل الفاتورة' },
  };
  const statusColorMap: Record<string, string> = {
    facture_envoyee: 'bg-blue-500/10 text-blue-600',
    paiement_attente: 'bg-orange-500/10 text-orange-600',
    facture_payee: 'bg-green-500/10 text-green-600',
  };
  const statusLabel = isRTL ? (statusLabelMap[chantier.status]?.ar || chantier.status) : (statusLabelMap[chantier.status]?.fr || chantier.status);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <section className={cn("flex items-center gap-3 py-4 shrink-0", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <HardHat className="h-5 w-5 text-amber-600" />
        </div>
        <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
          <h1 className={cn("text-lg font-bold text-foreground truncate", isRTL && "font-cairo")}>{chantier.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {client && <span>{client.name}</span>}
            {chantier.reference_number && <Badge variant="secondary" className="text-[10px] font-mono">{chantier.reference_number}</Badge>}
            <Badge variant="outline" className={cn("text-[10px]", statusColorMap[chantier.status] || '')}>{statusLabel}</Badge>
          </div>
        </div>
      </section>

      {chantier.site_address && (
        <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground mb-3 px-1", isRTL && "flex-row-reverse")}>
          <MapPin className="h-3.5 w-3.5" /> {chantier.site_address}
        </div>
      )}

      {/* Profitability Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: isRTL ? 'فوترة' : 'Facturé', value: totalFactured, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: isRTL ? 'حسابات' : 'Dépenses', value: totalExpenses, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: isRTL ? 'الهامش' : 'Marge', value: margin, icon: Wallet, color: margin >= 0 ? 'text-primary' : 'text-red-500', bg: margin >= 0 ? 'bg-primary/10' : 'bg-red-500/10' },
        ].map(c => (
          <Card key={c.label} className="border-border/50">
            <CardContent className="p-3 text-center">
              <div className={cn("w-8 h-8 rounded-lg mx-auto mb-1 flex items-center justify-center", c.bg)}>
                <c.icon className={cn("h-4 w-4", c.color)} />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">{c.label}</p>
              <p className={cn("text-sm font-bold", c.color)}>{fmt(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="documents" className="flex-1 gap-1"><FileText className="h-3.5 w-3.5" />{isRTL ? 'مستندات' : 'Documents'}</TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1 gap-1"><Receipt className="h-3.5 w-3.5" />{isRTL ? 'حسابات' : 'Dépenses'}</TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="flex-1 overflow-y-auto space-y-2 pb-4 mt-3">
          {documents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{isRTL ? 'لا توجد مستندات مرتبطة' : 'Aucun document lié'}</p>
          ) : documents.map(doc => (
            <Card key={doc.id} className="border-border/50">
              <CardContent className="p-3">
                <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                    <FileText className={cn("h-4 w-4", doc.document_type === 'facture' ? 'text-primary' : 'text-amber-500')} />
                    <div>
                      <p className="text-sm font-medium">{doc.document_number}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.client_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{fmt(doc.total_ttc)}</p>
                    <Badge variant="outline" className={cn("text-[10px]", doc.document_type === 'facture' ? 'text-primary' : 'text-amber-500')}>
                      {doc.document_type === 'facture' ? 'Facture' : 'Devis'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="expenses" className="flex-1 overflow-y-auto space-y-2 pb-4 mt-3">
          {expenses.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{isRTL ? 'لا توجد حسابات مرتبطة' : 'Aucune dépense liée'}</p>
          ) : expenses.map(exp => (
            <Card key={exp.id} className="border-border/50">
              <CardContent className="p-3">
                <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                  <div>
                    <p className="text-sm font-medium">{exp.title}</p>
                    <p className="text-[10px] text-muted-foreground">{exp.category} · {new Date(exp.expense_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <p className="text-sm font-bold text-red-500">-{fmt(exp.amount)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChantierDetailPage;
