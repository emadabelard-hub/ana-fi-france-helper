import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Receipt, Plus, TrendingUp, TrendingDown, Wallet,
  Loader2, Download, Eye, FileText,
  ChevronDown, ChevronUp, Users, HardHat, Calculator, Info, Landmark
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddExpenseModal from '@/components/archive/AddExpenseModal';
import SecurityBadge from '@/components/shared/SecurityBadge';
import { generateProfessionalCSV, downloadCSV, type CsvDocumentRow } from '@/lib/csvExport';
import { useProfile } from '@/hooks/useProfile';

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

  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      setIsAdmin(data === true);
    })();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch documents
      const docsQ = supabase
        .from('documents_comptables')
        .select('id, document_type, document_number, client_name, total_ttc, tva_amount, status, created_at, chantier_id, pdf_url')
        .order('created_at', { ascending: false });
      if (!isAdmin) docsQ.eq('user_id', user.id);

      // Fetch expenses
      const expQ = supabase
        .from('expenses')
        .select('id, title, amount, tva_amount, expense_date, chantier_id, document_id, created_at')
        .order('expense_date', { ascending: false });
      if (!isAdmin) expQ.eq('user_id', user.id);

      // Fetch chantiers for name lookup
      const chQ = supabase.from('chantiers').select('id, name, client_id');
      if (!isAdmin) chQ.eq('user_id', user.id);

      // Fetch clients for ID lookup
      const clQ = supabase.from('clients').select('id, name');
      if (!isAdmin) clQ.eq('user_id', user.id);

      const [docsRes, expRes, chRes, clRes] = await Promise.all([docsQ, expQ, chQ, clQ]);

      const chantierMap: Record<string, { name: string; clientId: string }> = {};
      (chRes.data || []).forEach((c: any) => { chantierMap[c.id] = { name: c.name, clientId: c.client_id }; });

      const clientMap: Record<string, string> = {};
      (clRes.data || []).forEach((c: any) => { clientMap[c.name] = c.id; });
      // Also map by id
      const clientIdMap: Record<string, string> = {};
      (clRes.data || []).forEach((c: any) => { clientIdMap[c.id] = c.name; });

      let incomeSum = 0;
      let expenseSum = 0;

      const unified: UnifiedRow[] = [];

      // Documents
      (docsRes.data || []).forEach((d: any) => {
        const ch = d.chantier_id ? chantierMap[d.chantier_id] : null;
        if (d.document_type === 'facture' && (d.status === 'finalized' || d.status === 'converted')) incomeSum += d.total_ttc || 0;
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
          tvaAmount: d.tva_amount || 0,
          status: d.status || null,
          pdfUrl: d.pdf_url || null,
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
          tvaAmount: e.tva_amount || 0,
          status: null,
          pdfUrl: null,
        });
      });

      // Sort by date descending
      unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRows(unified);
      setTotalIncome(incomeSum);
      setTotalExpenses(expenseSum);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [user, isAdmin]);

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

  // TVA calculations based on period filter
  const tvaCollectee = useMemo(() =>
    filtered.filter(r => r.type === 'facture' && (r.status === 'finalized' || r.status === 'converted')).reduce((s, r) => s + r.tvaAmount, 0),
    [filtered]);
  const tvaDeductible = useMemo(() =>
    filtered.filter(r => r.type === 'expense').reduce((s, r) => s + r.tvaAmount, 0),
    [filtered]);
  const tvaNet = tvaCollectee - tvaDeductible;

  const netProfit = totalIncome - totalExpenses;

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

      {/* 3 Large Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <p className={cn("text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1", isRTL && "font-cairo")}>
              {isRTL ? 'إجمالي الإيرادات' : 'Total Revenus'}
            </p>
            <p className="text-lg font-black text-emerald-400">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-2">
              <TrendingDown className="h-5 w-5 text-red-400" />
            </div>
            <p className={cn("text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1", isRTL && "font-cairo")}>
              {isRTL ? 'إجمالي الحسابات' : 'Total Dépenses'}
            </p>
            <p className="text-lg font-black text-red-400">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className={cn('border-blue-500/20', netProfit >= 0 ? 'bg-blue-500/5' : 'bg-red-500/5')}>
          <CardContent className="p-4 text-center">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2", netProfit >= 0 ? "bg-blue-500/10" : "bg-red-500/10")}>
              <Wallet className={cn("h-5 w-5", netProfit >= 0 ? "text-blue-400" : "text-red-400")} />
            </div>
            <p className={cn("text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1", isRTL && "font-cairo")}>
              {isRTL ? 'صافي الربح' : 'Bénéfice Net'}
            </p>
            <p className={cn("text-lg font-black", netProfit >= 0 ? "text-blue-400" : "text-red-400")}>
              {formatCurrency(netProfit)}
            </p>
          </CardContent>
        </Card>
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

      {/* CSV Export at bottom */}
      {filtered.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {isRTL ? 'تصدير CSV' : 'Exporter CSV'}
          </Button>
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
