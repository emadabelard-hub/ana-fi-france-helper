import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ScanLine } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import SecurityBadge from '@/components/shared/SecurityBadge';
import ShbikLbikCard from '@/components/archive/ShbikLbikCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

const DocumentHubPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [tvaCollectee, setTvaCollectee] = useState(0);
  const [tvaDeductible, setTvaDeductible] = useState(0);
  const [totalIncomeHT, setTotalIncomeHT] = useState(0);
  const [totalExpensesHT, setTotalExpensesHT] = useState(0);
  const [tresorerieEncaissee, setTresorerieEncaissee] = useState(0);

  const urssafRate = (profile as any)?.urssaf_rate ?? 21.2;
  const isRate = (profile as any)?.is_rate ?? 15;
  const isTvaExempt = (profile as any)?.tva_exempt ?? false;

  useEffect(() => {
    if (!user) return;
    const fetchFinancials = async () => {
      const [{ data: docs }, { data: exps }] = await Promise.all([
        supabase.from('documents_comptables').select('total_ttc, subtotal_ht, tva_amount, document_type, status, payment_status').eq('user_id', user.id),
        supabase.from('expenses').select('amount, tva_amount').eq('user_id', user.id),
      ]);
      const invoices = (docs || []).filter(d => d.document_type === 'facture' && d.status === 'finalized');
      setTotalIncome(invoices.reduce((s, d) => s + (d.total_ttc || 0), 0));
      setTotalIncomeHT(invoices.reduce((s, d) => s + (d.subtotal_ht || 0), 0));
      setTvaCollectee(invoices.reduce((s, d) => s + (d.tva_amount || 0), 0));
      setTotalExpenses((exps || []).reduce((s, e) => s + (e.amount || 0), 0));
      setTotalExpensesHT((exps || []).reduce((s, e) => s + ((e.amount || 0) - (e.tva_amount || 0)), 0));
      setTvaDeductible((exps || []).reduce((s, e) => s + (e.tva_amount || 0), 0));
      // Trésorerie = only paid finalized invoices
      const paidInvoices = invoices.filter((d: any) => d.payment_status === 'paid');
      setTresorerieEncaissee(paidInvoices.reduce((s: number, d: any) => s + (d.total_ttc || 0), 0));
    };
    fetchFinancials();
  }, [user]);

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-8 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <section className="text-center mb-10 font-cairo">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isRTL ? 'فواتير ودوفيهات' : 'Factures & Devis'}
        </h1>
        <p className="text-base text-muted-foreground">
          {isRTL ? 'اختار الطريقة اللي تناسبك' : 'Choisissez votre méthode'}
        </p>
      </section>

      <section className="space-y-5 max-w-md mx-auto w-full">
        {/* Card A — Manual / Management (now first) */}
        <button
          onClick={() => navigate('/pro')}
          className={cn(
            'w-full rounded-2xl p-6 text-white',
            'flex items-center gap-5 active:scale-[0.98] hover:scale-[1.02] transition-all duration-300',
            'shadow-[0_12px_40px_-12px_hsl(145_60%_30%/0.4)]',
            'hover:shadow-[0_20px_50px_-12px_hsl(145_60%_30%/0.55)] hover:-translate-y-1',
            isRTL && 'flex-row-reverse'
          )}
          style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-4xl">📄</span>
          </div>
          <div className={cn('flex-1', isRTL ? 'text-right' : 'text-left')}>
            <h2 className="text-lg font-bold font-cairo mb-1">
              {isRTL ? 'اعمل بنفسك وبكل سهولة الدوفي والفاتورة وممكن تحول الدوفي لفاتورة في ثواني' : 'Créez facilement vos devis & factures — convertissez en un clic'}
            </h2>
            <p className="text-white/85 text-sm font-cairo leading-relaxed">
              {isRTL
                ? 'اكتب الفاتورة أو الدوفي يدوي، أو افتح مستنداتك'
                : 'Créez manuellement vos factures, devis, ou consultez vos documents'}
            </p>
          </div>
          <div className={cn('text-white/60 text-2xl', isRTL ? 'rotate-180' : '')}>→</div>
        </button>

        {/* Card B — AI Generation (now second) */}
        <button
          onClick={() => navigate('/pro/smart-devis', { state: { forceFreshSession: true } })}
          className={cn(
            'w-full rounded-2xl p-6 text-white',
            'flex items-center gap-5 active:scale-[0.98] hover:scale-[1.02] transition-all duration-300',
            'shadow-[0_12px_40px_-12px_hsl(180_60%_30%/0.4)]',
            'hover:shadow-[0_20px_50px_-12px_hsl(180_60%_30%/0.55)] hover:-translate-y-1',
            isRTL && 'flex-row-reverse'
          )}
          style={{ background: 'linear-gradient(135deg, #0D9488, #0EA5E9)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-4xl">🏗️</span>
          </div>
          <div className={cn('flex-1', isRTL ? 'text-right' : 'text-left')}>
            <h2 className="text-lg font-bold font-cairo mb-1">
              {isRTL ? 'حلل الشانتي والاحتياجات بالذكاء الاصطناعي' : 'Analysez le chantier et les besoins avec l\'IA'}
            </h2>
            <p className="text-white/85 text-sm font-cairo leading-relaxed">
              {isRTL
                ? 'ارفع طلباتك، الصور، الخرائط، الـ PDF، وطلبات الزبون... وتعالى نحلل الشانتي سوا'
                : 'Uploadez photos, plans, PDF ou demandes client… et analysons le chantier ensemble'}
            </p>
          </div>
          <div className={cn('text-white/60 text-2xl', isRTL ? 'rotate-180' : '')}>→</div>
        </button>
      </section>

      {/* ShbikLbik Card */}
      <div className="max-w-md mx-auto w-full mt-8 px-2">
        <ShbikLbikCard
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          tvaCollectee={tvaCollectee}
          tvaDeductible={tvaDeductible}
          urssafRate={urssafRate}
          isRate={isRate}
          totalIncomeHT={totalIncomeHT}
          totalExpensesHT={totalExpensesHT}
          isTvaExempt={isTvaExempt}
          isRTL={isRTL}
          tresorerieEncaissee={tresorerieEncaissee}
        />
      </div>

      {/* Security Badge */}
      <div className="max-w-md mx-auto w-full mt-6 px-2">
        <SecurityBadge />
      </div>
    </div>
  );
};

export default DocumentHubPage;
