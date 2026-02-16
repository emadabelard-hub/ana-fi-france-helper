import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { useState } from 'react';
import AuthModal from '@/components/auth/AuthModal';

interface PurchaseConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceName: string;
  serviceKey: string;
  price: number;
  isBundle?: boolean;
  returnPath?: string;
}

const PurchaseConfirmModal = ({
  open, onOpenChange, serviceName, serviceKey, price, isBundle = false, returnPath = '/'
}: PurchaseConfirmModalProps) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [discountAnswer, setDiscountAnswer] = useState<'yes' | 'no' | null>(null);

  const DISCOUNT_PRICE = 4;
  const finalPrice = discountAnswer === 'yes' ? DISCOUNT_PRICE : price;

  const handlePurchase = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    setLoading(true);
    try {
      await supabase.from('transactions').insert({
        user_id: user.id,
        service_name: serviceName,
        service_key: serviceKey,
        price_eur: finalPrice,
        is_bundle: isBundle,
        status: 'completed',
      });
    } catch (e) {
      // Non-blocking in demo mode
    }
    setLoading(false);
    onOpenChange(false);
    setDiscountAnswer(null);
    navigate(`/payment-success?return=${encodeURIComponent(returnPath)}&price=${finalPrice}`);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) setDiscountAnswer(null);
    onOpenChange(v);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="rounded-[2rem] max-w-sm mx-auto">
          <DialogHeader className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <ShoppingCart className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className={cn("text-xl font-black", isRTL && "font-cairo")}>
              {isRTL ? 'تأكيد الشراء' : 'Confirmer l\'achat'}
            </DialogTitle>
            <DialogDescription className={cn("text-sm", isRTL && "font-cairo")}>
              {isRTL ? 'أنت على وشك شراء:' : 'Vous êtes sur le point d\'acheter :'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Discount question */}
            {discountAnswer === null && (
              <div className="bg-muted/50 rounded-2xl p-4 text-center space-y-3">
                <p className={cn("text-sm font-semibold text-foreground leading-relaxed", isRTL && "font-cairo")}>
                  {isRTL
                    ? 'تبحث طالب أو تبحث عن اول وظيفة أو تريد تقديم السي في لفرانس ترافاي'
                    : 'Êtes-vous étudiant, à la recherche de votre premier emploi ou souhaitez-vous soumettre votre CV à France Travail ?'}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" className="rounded-xl px-6 font-bold" onClick={() => setDiscountAnswer('yes')}>
                    {isRTL ? 'نعم' : 'Oui'}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl px-6 font-bold" onClick={() => setDiscountAnswer('no')}>
                    {isRTL ? 'لا' : 'Non'}
                  </Button>
                </div>
              </div>
            )}

            {/* Service summary - shown after answering */}
            {discountAnswer !== null && (
              <>
                {discountAnswer === 'yes' && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl p-4 text-center space-y-2 border border-emerald-200 dark:border-emerald-800">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <span className="text-xl">🤝</span>
                    </div>
                    <p className={cn("text-sm font-black text-foreground leading-relaxed", isRTL && "font-cairo")}>
                      {isRTL
                        ? 'نحن لا نطلب إثبات فنحن نثق في كلمتك'
                        : 'Nous ne demandons pas de justificatif, nous vous faisons confiance.'}
                    </p>
                    <p className={cn("text-xs font-semibold text-emerald-700 dark:text-emerald-400", isRTL && "font-cairo")}>
                      {isRTL
                        ? '💚 تم تطبيق سعر الدعم (4 يورو) تقديراً لظروفك.'
                        : '💚 Le tarif solidaire (4 €) a été appliqué en reconnaissance de votre situation.'}
                    </p>
                  </div>
                )}

                <div className="bg-muted/50 rounded-2xl p-4 text-center space-y-2">
                  <p className={cn("font-bold text-foreground text-base", isRTL && "font-cairo")}>
                    {serviceName}
                  </p>
                  <Badge className="text-lg font-black px-4 py-1">
                    {finalPrice} €
                  </Badge>
                  {discountAnswer === 'yes' && price !== DISCOUNT_PRICE && (
                    <p className="text-xs text-muted-foreground line-through">{price} €</p>
                  )}
                  {isBundle && discountAnswer !== 'yes' && (
                    <p className={cn("text-xs text-emerald-600 font-bold", isRTL && "font-cairo")}>
                      {isRTL ? '🎁 عرض اقتصادي - وفّرت 4 €' : '🎁 Pack Éco - Vous économisez 4 €'}
                    </p>
                  )}
                </div>

                {/* Demo notice */}
                <p className={cn("text-[11px] text-muted-foreground text-center", isRTL && "font-cairo")}>
                  {isRTL
                    ? '⚠️ وضع تجريبي - لن يتم خصم أي مبلغ حقيقي'
                    : '⚠️ Mode démo - Aucun montant réel ne sera débité'}
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handlePurchase}
                    disabled={loading}
                    className="w-full rounded-2xl h-12 text-base font-bold"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                      isRTL ? `ادفع ${finalPrice} €` : `Payer ${finalPrice} €`
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    className="w-full rounded-2xl font-semibold"
                  >
                    {isRTL ? 'إلغاء' : 'Annuler'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </>
  );
};

export default PurchaseConfirmModal;
