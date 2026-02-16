import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Receipt, Loader2, Euro } from 'lucide-react';

interface AdminTransaction {
  id: string;
  user_id: string;
  service_name: string;
  service_key: string;
  price_eur: number;
  is_bundle: boolean;
  status: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

interface TransactionsManagerProps {
  isRTL: boolean;
}

const TransactionsManager = ({ isRTL }: TransactionsManagerProps) => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('admin_transactions_view')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching transactions:', error);
      } else {
        setTransactions((data as AdminTransaction[]) || []);
      }
      setIsLoading(false);
    };

    fetchTransactions();
  }, []);

  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.price_eur), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Receipt className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className={cn(isRTL && "text-right")}>
                <p className="text-3xl font-bold">{transactions.length}</p>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'المعاملات' : 'Transactions'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Euro className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className={cn(isRTL && "text-right")}>
                <p className="text-3xl font-bold">{totalRevenue.toFixed(0)} €</p>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'إجمالي الإيرادات' : 'Revenu total'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={cn("text-lg", isRTL && "text-right font-cairo")}>
            {isRTL ? 'سجل المعاملات' : 'Historique des transactions'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className={cn("text-center text-muted-foreground py-8", isRTL && "font-cairo")}>
              {isRTL ? 'لا توجد معاملات بعد' : 'Aucune transaction'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{isRTL ? 'المستخدم' : 'Utilisateur'}</TableHead>
                    <TableHead>{isRTL ? 'الخدمة' : 'Service'}</TableHead>
                    <TableHead className="text-right">{isRTL ? 'المبلغ' : 'Montant'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Statut'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{tx.full_name || '—'}</p>
                          <p className="text-xs text-muted-foreground">{tx.email || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{tx.service_name}</span>
                          {tx.is_bundle && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">Pack</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{Number(tx.price_eur).toFixed(0)} €</TableCell>
                      <TableCell>
                        <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                          {tx.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsManager;
