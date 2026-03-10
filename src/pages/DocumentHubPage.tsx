import { useNavigate } from 'react-router-dom';
import { FileText, ScanLine } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import SecurityBadge from '@/components/shared/SecurityBadge';

const DocumentHubPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

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
        {/* Card A — AI Generation */}
        <button
          onClick={() => navigate('/pro/smart-devis')}
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
              {isRTL ? 'دوفي ذكي بالذكاء الاصطناعي' : 'Devis IA intelligent'}
            </h2>
            <p className="text-white/85 text-sm font-cairo leading-relaxed">
              {isRTL
                ? 'ارفع طلباتك، الصور، الخرائط، الـ PDF، وطلبات الزبون... وأنا أعملك الدوفي'
                : 'Uploadez photos, plans, PDF ou demandes client… et je génère le devis'}
            </p>
          </div>
          <div className={cn('text-white/60 text-2xl', isRTL ? 'rotate-180' : '')}>→</div>
        </button>

        {/* Card B — Manual / Management */}
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
              {isRTL ? 'فواتير ودوفيهات' : 'Factures & Devis'}
            </h2>
            <p className="text-white/85 text-sm font-cairo leading-relaxed">
              {isRTL
                ? 'اكتب الفاتورة أو الدوفي يدوي، أو افتح مستنداتك'
                : 'Créez manuellement vos factures, devis, ou consultez vos documents'}
            </p>
          </div>
          <div className={cn('text-white/60 text-2xl', isRTL ? 'rotate-180' : '')}>→</div>
        </button>
      </section>

      {/* Security Badge */}
      <div className="max-w-md mx-auto w-full mt-10 px-2">
        <SecurityBadge />
      </div>
    </div>
  );
};

export default DocumentHubPage;
