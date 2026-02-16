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
        price_eur: price,
        is_bundle: isBundle,
        status: 'completed',
      });
    } catch (e) {
      // Non-blocking in demo mode
    }
    setLoading(false);
    onOpenChange(false);
    navigate(`/payment-success?return=${encodeURIComponent(returnPath)}&price=${price}`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
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
            {/* Service summary */}
            <div className="bg-muted/50 rounded-2xl p-4 text-center space-y-2">
              <p className={cn("font-bold text-foreground text-base", isRTL && "font-cairo")}>
                {serviceName}
              </p>
              <Badge className="text-lg font-black px-4 py-1">
                {price} €
              </Badge>
              {isBundle && (
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
                  isRTL ? `ادفع ${price} €` : `Payer ${price} €`
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full rounded-2xl font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Annuler'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </>
  );
};

export default PurchaseConfirmModal;
