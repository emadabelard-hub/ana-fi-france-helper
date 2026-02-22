import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Receipt, Loader2 } from 'lucide-react';

interface Transaction {
  id: string;
  service_name: string;
  price_eur: number;
  is_bundle: boolean;
  created_at: string;
}

const TransactionHistory = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id, service_name, price_eur, is_bundle, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setTransactions((data as Transaction[]) || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return (
      <Card className="bg-white dark:bg-[#1A1A1C] border border-border/30 rounded-[1.25rem]">
        <CardContent className="p-4 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) return null;

  return (
    <Card className="bg-white dark:bg-[#1A1A1C] border border-border/30 rounded-[1.25rem]">
      <CardContent className="p-4 space-y-3">
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <Receipt className="h-5 w-5 text-primary/60" />
          <h3 className={cn("font-bold text-sm text-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'سجل المشتريات' : 'Historique des achats'}
          </h3>
        </div>
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className={cn(
                "py-2.5 px-3 rounded-xl bg-muted/30 text-center",
              )}
            >
              <p className={cn("text-sm font-semibold text-foreground", isRTL && "font-cairo")}>
                {tx.service_name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(tx.created_at).toLocaleDateString(isRTL ? 'ar' : 'fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
