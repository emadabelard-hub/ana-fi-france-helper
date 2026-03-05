import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Receipt, Plus, Search, TrendingUp, TrendingDown, Wallet,
  Trash2, Image as ImageIcon, Loader2, ArrowLeft, Download,
  Link as LinkIcon, Users, HardHat
} from 'lucide-react';
import AddExpenseModal from '@/components/archive/AddExpenseModal';
import AuthModal from '@/components/auth/AuthModal';

interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  tva_amount: number;
  category: string;
  expense_date: string;
  notes: string | null;
  receipt_url: string | null;
  document_id: string | null;
  created_at: string;
}

interface LinkedDoc {
  id: string;
  document_number: string;
  client_name: string;
  total_ttc: number;
}

const categoryLabels: Record<string, { fr: string; ar: string; color: string }> = {
  materials: { fr: 'Matériaux', ar: 'مواد', color: 'bg-blue-500/15 text-blue-400' },
  fuel: { fr: 'Carburant', ar: 'وقود', color: 'bg-orange-500/15 text-orange-400' },
  tools: { fr: 'Outils', ar: 'أدوات', color: 'bg-purple-500/15 text-purple-400' },
  transport: { fr: 'Transport', ar: 'نقل', color: 'bg-cyan-500/15 text-cyan-400' },
  food: { fr: 'Repas', ar: 'وجبات', color: 'bg-yellow-500/15 text-yellow-400' },
  office: { fr: 'Fournitures', ar: 'لوازم', color: 'bg-pink-500/15 text-pink-400' },
  insurance: { fr: 'Assurance', ar: 'تأمين', color: 'bg-emerald-500/15 text-emerald-400' },
  telecom: { fr: 'Télécom', ar: 'اتصالات', color: 'bg-indigo-500/15 text-indigo-400' },
  other: { fr: 'Autre', ar: 'أخرى', color: 'bg-muted text-muted-foreground' },
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const ExpensesPage = () => {
  const { isRTL, t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<Record<string, LinkedDoc>>({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');

  const fetchExpenses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase.from('expenses') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);

      // Fetch linked documents
      const docIds = (data || [])
        .map((e: ExpenseRow) => e.document_id)
        .filter(Boolean) as string[];

      if (docIds.length > 0) {
        const { data: docs } = await supabase
          .from('documents_comptables')
          .select('id, document_number, client_name, total_ttc')
          .in('id', docIds);

        const docMap: Record<string, LinkedDoc> = {};
        (docs || []).forEach((d: any) => { docMap[d.id] = d; });
        setLinkedDocs(docMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpenses(); }, [user]);

  const filtered = useMemo(() => {
    let items = expenses;

    if (categoryFilter !== 'all') {
      items = items.filter(e => e.category === categoryFilter);
    }

    if (periodFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (periodFilter === 'month') cutoff.setMonth(now.getMonth() - 1);
      else if (periodFilter === 'quarter') cutoff.setMonth(now.getMonth() - 3);
      else if (periodFilter === 'year') cutoff.setFullYear(now.getFullYear() - 1);
      items = items.filter(e => new Date(e.expense_date) >= cutoff);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }

    return items;
  }, [expenses, categoryFilter, periodFilter, searchQuery]);

  // Profit calculation: fetch invoices total and compare
  const [invoicesTotal, setInvoicesTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('documents_comptables')
      .select('total_ttc')
      .eq('user_id', user.id)
      .eq('document_type', 'facture')
      .then(({ data }) => {
        const total = (data || []).reduce((s: number, d: any) => s + (d.total_ttc || 0), 0);
        setInvoicesTotal(total);
      });
  }, [user, expenses]);

  const totalExpenses = useMemo(() =>
    filtered.reduce((s, e) => s + e.amount, 0), [filtered]);
  const totalTVA = useMemo(() =>
    filtered.reduce((s, e) => s + e.tva_amount, 0), [filtered]);
  const netProfit = invoicesTotal - totalExpenses;

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('expenses') as any).delete().eq('id', id);
    if (!error) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast({ title: isRTL ? '✅ تم الحذف' : '✅ Supprimée' });
    }
  };

  const handleExportCSV = () => {
    const header = 'Date;Titre;Montant;TVA;Catégorie;Notes;Projet lié\n';
    const rows = filtered.map(e => {
      const doc = e.document_id ? linkedDocs[e.document_id] : null;
      return `${e.expense_date};${e.title};${e.amount};${e.tva_amount};${e.category};${e.notes || ''};${doc?.document_number || ''}`;
    }).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!user) {
    return (
      <div className="py-8 text-center">
        <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">
          {isRTL ? 'سجل الدخول لإدارة المصاريف' : 'Connectez-vous pour gérer vos dépenses'}
        </p>
        <Button onClick={() => setShowAuth(true)}>
          {isRTL ? 'تسجيل الدخول' : 'Se connecter'}
        </Button>
        <AuthModal open={showAuth} onOpenChange={setShowAuth} />
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <h1 className={cn('text-xl font-bold text-foreground', isRTL && 'font-cairo')}>
          {isRTL ? '💰 إدارة المصاريف' : '💰 Notes de Frais'}
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1">
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            size="sm"
            className="gap-1 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4" />
            {isRTL ? 'إضافة' : 'Ajouter'}
          </Button>
        </div>
      </div>

      {/* Quick Access: Clients & Chantiers */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-12 gap-2 border-teal-500/20 hover:bg-teal-500/10 hover:border-teal-500/40"
          onClick={() => navigate('/clients')}
        >
          <Users className="h-4 w-4 text-teal-500" />
          <span className={cn("text-sm font-bold", isRTL && "font-cairo")}>
            {isRTL ? 'العملاء' : 'Clients'}
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-12 gap-2 border-orange-500/20 hover:bg-orange-500/10 hover:border-orange-500/40"
          onClick={() => navigate('/chantiers')}
        >
          <HardHat className="h-4 w-4 text-orange-500" />
          <span className={cn("text-sm font-bold", isRTL && "font-cairo")}>
            {isRTL ? 'الورشات' : 'Chantiers'}
          </span>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">
              {isRTL ? 'الفواتير' : 'Factures'}
            </p>
            <p className="text-sm font-black text-emerald-400">{formatCurrency(invoicesTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-4 w-4 text-red-400 mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">
              {isRTL ? 'المصاريف' : 'Dépenses'}
            </p>
            <p className="text-sm font-black text-red-400">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          'border-accent/20',
          netProfit >= 0 ? 'bg-accent/5' : 'bg-red-500/5'
        )}>
          <CardContent className="p-3 text-center">
            <Wallet className="h-4 w-4 mx-auto mb-1" style={{ color: netProfit >= 0 ? 'hsl(var(--accent))' : undefined }} />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">
              {isRTL ? 'صافي الربح' : 'Marge Nette'}
            </p>
            <p className={cn('text-sm font-black', netProfit >= 0 ? 'text-accent' : 'text-red-400')}>
              {formatCurrency(netProfit)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className={cn('flex gap-2', isRTL && 'flex-row-reverse')}>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث...' : 'Rechercher...'}
            className="pl-8 bg-background border-border h-9 text-sm"
          />
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-28 h-9 text-xs bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? 'الكل' : 'Tout'}</SelectItem>
            <SelectItem value="month">{isRTL ? 'شهر' : '1 mois'}</SelectItem>
            <SelectItem value="quarter">{isRTL ? '3 أشهر' : '3 mois'}</SelectItem>
            <SelectItem value="year">{isRTL ? 'سنة' : '1 an'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-28 h-9 text-xs bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? 'كل الفئات' : 'Toutes'}</SelectItem>
            {Object.entries(categoryLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{isRTL ? v.ar : v.fr}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expense List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-12 text-center">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className={cn('text-sm text-muted-foreground', isRTL && 'font-cairo')}>
              {isRTL ? 'لا توجد مصاريف بعد' : 'Aucune dépense enregistrée'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {isRTL ? 'أضف أول مصروف' : 'Ajouter votre première dépense'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(expense => {
            const cat = categoryLabels[expense.category] || categoryLabels.other;
            const linkedDoc = expense.document_id ? linkedDocs[expense.document_id] : null;

            return (
              <Card key={expense.id} className="border-border hover:border-accent/30 transition-colors">
                <CardContent className={cn('p-3', isRTL && 'text-right')}>
                  <div className={cn('flex items-start justify-between gap-2', isRTL && 'flex-row-reverse')}>
                    <div className="flex-1 min-w-0">
                      <div className={cn('flex items-center gap-2 mb-1', isRTL && 'flex-row-reverse')}>
                        <h3 className={cn('font-bold text-sm text-foreground truncate', isRTL && 'font-cairo')}>
                          {expense.title}
                        </h3>
                        <Badge variant="secondary" className={cn('text-[10px] shrink-0', cat.color)}>
                          {isRTL ? cat.ar : cat.fr}
                        </Badge>
                      </div>

                      <div className={cn('flex items-center gap-3 text-xs text-muted-foreground', isRTL && 'flex-row-reverse')}>
                        <span>{expense.expense_date}</span>
                        {expense.tva_amount > 0 && (
                          <span>TVA: {formatCurrency(expense.tva_amount)}</span>
                        )}
                        {expense.receipt_url && (
                          <ImageIcon className="h-3 w-3 text-accent" />
                        )}
                      </div>

                      {linkedDoc && (
                        <div className={cn('flex items-center gap-1 mt-1 text-xs text-accent', isRTL && 'flex-row-reverse')}>
                          <LinkIcon className="h-3 w-3" />
                          <span>{linkedDoc.document_number} — {linkedDoc.client_name}</span>
                        </div>
                      )}

                      {expense.notes && (
                        <p className={cn('text-xs text-muted-foreground mt-1 truncate', isRTL && 'font-cairo')}>
                          {expense.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="text-base font-black text-red-400">
                        -{formatCurrency(expense.amount)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDelete(expense.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* TVA summary */}
      {totalTVA > 0 && (
        <Card className="border-border bg-muted/30">
          <CardContent className={cn('p-3 flex items-center justify-between', isRTL && 'flex-row-reverse')}>
            <span className="text-xs text-muted-foreground font-semibold">
              {isRTL ? 'إجمالي TVA المسترجعة' : 'TVA récupérable'}
            </span>
            <span className="text-sm font-bold text-accent">{formatCurrency(totalTVA)}</span>
          </CardContent>
        </Card>
      )}

      <AddExpenseModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        isRTL={isRTL}
        userId={user.id}
        onExpenseAdded={fetchExpenses}
      />
    </div>
  );
};

export default ExpensesPage;
