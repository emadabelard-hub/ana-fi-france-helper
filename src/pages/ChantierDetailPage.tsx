import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, HardHat, FileText, Receipt, TrendingUp, TrendingDown, Wallet, MapPin, AlertTriangle, Plus, ClipboardList, Download, Truck, Coins, CircleDollarSign } from 'lucide-react';
import AddExpenseModal from '@/components/archive/AddExpenseModal';
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
import ChantierTeamSection from '@/components/chantier/ChantierTeamSection';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const ChantierDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [chantier, setChantier] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [errSection, setErrSection] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);


  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setLoading(true);
      // SECURITY: Always scope by user_id
      const { data: ch } = await supabase.from('chantiers').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
      if (ch) {
        setChantier(ch);
        const results = await Promise.allSettled([
          supabase.from('clients').select('*').eq('id', ch.client_id).eq('user_id', user.id).maybeSingle(),
          supabase.from('documents_comptables').select('*').eq('chantier_id', id).eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('expenses').select('*').eq('chantier_id', id).eq('user_id', user.id).order('expense_date', { ascending: false }),
          (supabase.from('chantier_reports' as any) as any).select('*').eq('chantier_id', id).eq('user_id', user.id).order('created_at', { ascending: false }),
          (supabase.from('supplier_invoices' as any) as any).select('*, supplier:suppliers(name)').eq('chantier_id', id).eq('user_id', user.id).order('invoice_date', { ascending: false }),
          (supabase.from('milestone_invoices' as any) as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        ]);
        const val = (i: number) => results[i].status === 'fulfilled' ? (results[i] as any).value?.data : null;
        const err = (i: number) => results[i].status === 'rejected' ? String((results[i] as any).reason?.message || 'Erreur') : ((results[i] as any).value?.error?.message || null);
        setClient(val(0));
        setDocuments(val(1) || []);
        setExpenses(val(2) || []);
        setReports(val(3) || []);
        setSupplierInvoices(val(4) || []);
        // Filter milestones to those whose facture is in this chantier's documents
        const docIds = new Set((val(1) || []).map((d: any) => d.id));
        setMilestones((val(5) || []).filter((m: any) => m.facture_id && docIds.has(m.facture_id)));
        setErrSection({
          documents: err(1), expenses: err(2), reports: err(3), suppliers: err(4), milestones: err(5),
        });
      }

      setLoading(false);
    })();
  }, [user, id]);

  const factures = useMemo(() => documents.filter(d => d.document_type === 'facture' && d.status !== 'cancelled'), [documents]);
  const devisList = useMemo(() => documents.filter(d => d.document_type === 'devis'), [documents]);

  const totalDevis = useMemo(() => devisList.reduce((s, d) => s + Number(d.total_ttc || 0), 0), [devisList]);
  const totalFactured = useMemo(() => factures.reduce((s, d) => s + Number(d.total_ttc || 0), 0), [factures]);
  const totalEncaisse = useMemo(() => factures.filter(f => f.payment_status === 'paid').reduce((s, d) => s + Number(d.total_ttc || 0), 0), [factures]);
  const resteAEncaisser = Math.max(0, totalFactured - totalEncaisse);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);
  const totalSupplier = useMemo(() => supplierInvoices.reduce((s, i) => s + Number(i.amount_ttc || 0), 0), [supplierInvoices]);
  const margin = totalFactured - totalExpenses;

  const budget = chantier?.budget ? Number(chantier.budget) : null;
  const budgetPct = budget && budget > 0 ? (totalExpenses / budget) * 100 : null;
  const budgetAlert: 'red' | 'yellow' | null = budgetPct !== null ? (budgetPct >= 100 ? 'red' : budgetPct >= 80 ? 'yellow' : null) : null;

  const handleSaveBudget = async () => {
    if (!id || !user) return;
    const val = budgetInput.trim() ? parseFloat(budgetInput) : null;
    const { error } = await supabase.from('chantiers').update({ budget: val } as any).eq('id', id).eq('user_id', user.id);
    if (error) {
      toast({ title: isRTL ? 'خطأ' : 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    setChantier((prev: any) => ({ ...prev, budget: val }));
    setEditingBudget(false);
    toast({ title: isRTL ? 'تم حفظ الميزانية' : 'Budget enregistré ✓' });
  };

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

      {/* Budget Alert Banners */}
      {budgetAlert === 'red' && (
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium mb-2", isRTL && "flex-row-reverse font-cairo")}>
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
          <span>{isRTL ? 'خطر: المصاريف تجاوزت الميزانية! الربح في خطر' : 'Danger : Les dépenses dépassent le budget ! Profit en danger'}</span>
          <Badge variant="destructive" className="text-[10px] shrink-0">{Math.round(budgetPct!)}%</Badge>
        </div>
      )}
      {budgetAlert === 'yellow' && (
        <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-sm font-medium mb-2", isRTL && "flex-row-reverse font-cairo")}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{isRTL ? 'تنبيه: المصاريف اقتربت من الميزانية المحددة' : 'Attention : Les dépenses approchent du budget défini'}</span>
          <Badge className="text-[10px] shrink-0 bg-amber-500/20 text-amber-600 border-amber-500/30">{Math.round(budgetPct!)}%</Badge>
        </div>
      )}

      {/* Budget Section */}
      {budget !== null && !editingBudget && (
        <Card className="border-border/50 mb-2">
          <CardContent className="p-3">
            <div className={cn("flex items-center justify-between mb-1.5", isRTL && "flex-row-reverse")}>
              <span className={cn("text-xs font-medium text-muted-foreground", isRTL && "font-cairo")}>{isRTL ? 'ميزانية المشروع' : 'Budget du projet'}</span>
              <button onClick={() => { setBudgetInput(String(budget)); setEditingBudget(true); }} className="text-[10px] text-accent hover:underline">
                {isRTL ? 'تعديل' : 'Modifier'}
              </button>
            </div>
            <div className={cn("flex items-center justify-between text-sm mb-1", isRTL && "flex-row-reverse")}>
              <span className="font-bold text-foreground">{fmt(totalExpenses)} / {fmt(budget)}</span>
              <span className={cn("text-xs font-bold", budgetPct! >= 100 ? 'text-destructive' : budgetPct! >= 80 ? 'text-amber-500' : 'text-emerald-500')}>{Math.round(budgetPct!)}%</span>
            </div>
            <Progress value={Math.min(budgetPct!, 100)} className={cn("h-2", budgetPct! >= 100 ? '[&>div]:bg-destructive' : budgetPct! >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500')} />
          </CardContent>
        </Card>
      )}
      {editingBudget && (
        <Card className="border-accent/30 mb-2">
          <CardContent className="p-3 space-y-2">
            <label className={cn("text-xs font-medium text-muted-foreground", isRTL && "font-cairo")}>{isRTL ? 'ميزانية المشروع (€)' : 'Budget du projet (€)'}</label>
            <div className="flex gap-2">
              <Input type="number" min="0" step="0.01" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} className="flex-1" />
              <Button size="sm" onClick={handleSaveBudget}>{isRTL ? 'حفظ' : 'OK'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingBudget(false)}>{isRTL ? 'إلغاء' : '✕'}</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {budget === null && !editingBudget && (
        <button
          onClick={() => { setBudgetInput(''); setEditingBudget(true); }}
          className={cn("text-xs text-accent hover:underline mb-2 block", isRTL && "text-right w-full font-cairo")}
        >
          {isRTL ? '+ إضافة ميزانية المشروع' : '+ Ajouter un budget'}
        </button>
      )}


      {/* Quick Actions */}
      <div className={cn("flex items-center gap-2 mb-3", isRTL && "flex-row-reverse")}>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 flex-1"
          onClick={() => navigate('/pro/invoice', { state: { prefill: { clientName: client?.name, chantierId: id, chantierName: chantier.name } } })}
        >
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className={cn("text-xs font-bold", isRTL && "font-cairo")}>{isRTL ? 'إنشاء فاتورة' : 'Créer Facture'}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 flex-1"
          onClick={() => setShowAddExpense(true)}
        >
          <Receipt className="h-3.5 w-3.5 text-red-500" />
          <span className={cn("text-xs font-bold", isRTL && "font-cairo")}>{isRTL ? 'إضافة مصروف' : 'Ajouter Dépense'}</span>
        </Button>
      </div>

      {/* Synthèse financière — grille responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Devis', value: totalDevis, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-500/10', hint: 'Indicatif' },
          { label: 'Facturé', value: totalFactured, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Encaissé', value: totalEncaisse, icon: CircleDollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Reste à encaisser', value: resteAEncaisser, icon: Coins, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Dépenses', value: totalExpenses, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'Fact. fournisseurs', value: totalSupplier, icon: Truck, color: 'text-slate-600', bg: 'bg-slate-500/10' },
        ].map(c => (
          <Card key={c.label} className="border-border/50">
            <CardContent className="p-2.5 text-center">
              <div className={cn("w-7 h-7 rounded-lg mx-auto mb-1 flex items-center justify-center", c.bg)}>
                <c.icon className={cn("h-3.5 w-3.5", c.color)} />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium leading-tight">{c.label}</p>
              <p className={cn("text-xs font-bold truncate", c.color)}>{fmt(c.value)}</p>
              {(c as any).hint && <p className="text-[9px] text-muted-foreground/70">{(c as any).hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground italic mb-3 px-1">
        Marge disponible après consolidation des dépenses. Estimation fondée sur les documents actuellement rattachés à ce chantier.
      </p>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full shrink-0 overflow-x-auto">
          <TabsTrigger value="documents" className="flex-1 gap-1 text-xs"><FileText className="h-3.5 w-3.5" />Documents</TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1 gap-1 text-xs"><Receipt className="h-3.5 w-3.5" />Dépenses</TabsTrigger>
          <TabsTrigger value="suppliers" className="flex-1 gap-1 text-xs"><Truck className="h-3.5 w-3.5" />Fournisseurs</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1 gap-1 text-xs"><ClipboardList className="h-3.5 w-3.5" />Rapports</TabsTrigger>
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
        <TabsContent value="reports" className="flex-1 overflow-y-auto space-y-2 pb-4 mt-3">
          {reports.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{isRTL ? 'لا توجد تقارير' : 'Aucun rapport'}</p>
          ) : reports.map((r: any) => (
            <Card key={r.id} className="border-border/50">
              <CardContent className="p-3">
                <div className={cn("flex items-center justify-between gap-2", isRTL && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-2 min-w-0", isRTL && "flex-row-reverse")}>
                    <ClipboardList className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.report_number || '—'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.report_date ? new Date(r.report_date).toLocaleDateString('fr-FR') : ''}
                        {r.submitted_by_name ? ` · ${r.submitted_by_name}` : ''}
                      </p>
                    </div>
                  </div>
                  {r.pdf_url && (
                    <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={async () => {
                      try {
                        let url = r.pdf_url as string;
                        if (!/^https?:\/\//i.test(url)) {
                          const { data } = await supabase.storage.from('documents').createSignedUrl(url, 600);
                          if (data?.signedUrl) url = data.signedUrl;
                        }
                        window.open(url, '_blank');
                      } catch (e) {
                        console.warn('open pdf failed', e);
                      }
                    }}>
                      <Download className="h-3.5 w-3.5" />
                      <span className="text-xs">PDF</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Team Section - always visible after reports */}
      {user && id && (
        <div className="mt-4 mb-3">
          <ChantierTeamSection chantierId={id} userId={user.id} isRTL={isRTL} chantierName={chantier?.name || ''} />
        </div>
      )}




      {user && (
        <AddExpenseModal
          open={showAddExpense}
          onOpenChange={setShowAddExpense}
          isRTL={isRTL}
          userId={user.id}
          onExpenseAdded={async () => {
            const { data: exp } = await supabase.from('expenses').select('*').eq('chantier_id', id!).eq('user_id', user.id).order('expense_date', { ascending: false });
            setExpenses(exp || []);
          }}
        />
      )}
    </div>
  );
};

export default ChantierDetailPage;
