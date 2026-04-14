import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface NumberingOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const NumberingOnboardingModal = ({ open, onOpenChange, onComplete }: NumberingOnboardingModalProps) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [lastDevis, setLastDevis] = useState('');
  const [lastFacture, setLastFacture] = useState('');
  const [saving, setSaving] = useState(false);
  const year = new Date().getFullYear();

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const devisNum = lastDevis.trim() ? parseInt(lastDevis.trim(), 10) : 0;
      const factureNum = lastFacture.trim() ? parseInt(lastFacture.trim(), 10) : 0;

      if (lastDevis.trim() && (isNaN(devisNum) || devisNum < 0 || devisNum > 9999)) {
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'رقم الدوفي غير صالح' : 'Numéro de devis invalide (0-9999)' });
        setSaving(false);
        return;
      }
      if (lastFacture.trim() && (isNaN(factureNum) || factureNum < 0 || factureNum > 9999)) {
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'رقم الفاتورة غير صالح' : 'Numéro de facture invalide (0-9999)' });
        setSaving(false);
        return;
      }

      // Upsert both counters
      const upserts = [];
      if (devisNum > 0) {
        upserts.push(
          supabase.from('document_counters').upsert({
            user_id: user.id,
            document_type: 'devis',
            year,
            last_number: devisNum,
          }, { onConflict: 'user_id,document_type,year' })
        );
      }
      if (factureNum > 0) {
        upserts.push(
          supabase.from('document_counters').upsert({
            user_id: user.id,
            document_type: 'facture',
            year,
            last_number: factureNum,
          }, { onConflict: 'user_id,document_type,year' })
        );
      }

      await Promise.all(upserts);

      // Mark onboarding as done
      localStorage.setItem(`numbering_onboarded_${user.id}`, 'true');

      toast({
        title: isRTL ? 'تم الحفظ ✓' : 'Enregistré ✓',
        description: isRTL
          ? `الدوفي التالي: D-${year}-${String((devisNum || 0) + 1).padStart(3, '0')} | الفاتورة التالية: F-${year}-${String((factureNum || 0) + 1).padStart(3, '0')}`
          : `Prochain devis : D-${year}-${String((devisNum || 0) + 1).padStart(3, '0')} | Prochaine facture : F-${year}-${String((factureNum || 0) + 1).padStart(3, '0')}`,
      });

      onComplete();
      onOpenChange(false);
    } catch (err) {
      console.error('[numbering-onboarding]', err);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'فشل الحفظ' : 'Échec de l\'enregistrement' });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    if (user) {
      localStorage.setItem(`numbering_onboarded_${user.id}`, 'true');
    }
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleSkip();
      else onOpenChange(true);
    }}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle className={cn("text-lg font-black text-center", isRTL && "font-cairo")}>
            <Hash className="inline h-5 w-5 mr-1" />
            {isRTL ? 'إعداد الترقيم' : 'Configuration de la numérotation'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className={cn("text-sm text-muted-foreground text-center", isRTL && "font-cairo")}>
            {isRTL
              ? 'إذا كنت تستخدم نظام ترقيم سابق، أدخل آخر رقم مستخدم. وإلا اتركه فارغًا للبدء من 1.'
              : 'Si vous avez déjà une numérotation, entrez vos derniers numéros. Sinon, laissez vide pour commencer à 1.'}
          </p>

          {/* Devis */}
          <div className="space-y-1.5">
            <Label className={cn("text-sm font-bold", isRTL && "font-cairo")}>
              {isRTL ? 'آخر رقم دوفي (اختياري)' : 'Dernier n° de devis (optionnel)'}
            </Label>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">D-{year}-</span>
              <Input
                value={lastDevis}
                onChange={(e) => setLastDevis(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="000"
                className="font-mono text-left w-24"
                dir="ltr"
                type="text"
                enableVoice={false}
              />
            </div>
            {lastDevis && (
              <p className={cn("text-xs text-primary font-medium", isRTL && "font-cairo")}>
                {isRTL
                  ? `→ الدوفي القادم: D-${year}-${String(parseInt(lastDevis || '0', 10) + 1).padStart(3, '0')}`
                  : `→ Prochain devis : D-${year}-${String(parseInt(lastDevis || '0', 10) + 1).padStart(3, '0')}`}
              </p>
            )}
          </div>

          {/* Facture */}
          <div className="space-y-1.5">
            <Label className={cn("text-sm font-bold", isRTL && "font-cairo")}>
              {isRTL ? 'آخر رقم فاتورة (اختياري)' : 'Dernier n° de facture (optionnel)'}
            </Label>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">F-{year}-</span>
              <Input
                value={lastFacture}
                onChange={(e) => setLastFacture(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="000"
                className="font-mono text-left w-24"
                dir="ltr"
                type="text"
                enableVoice={false}
              />
            </div>
            {lastFacture && (
              <p className={cn("text-xs text-primary font-medium", isRTL && "font-cairo")}>
                {isRTL
                  ? `→ الفاتورة القادمة: F-${year}-${String(parseInt(lastFacture || '0', 10) + 1).padStart(3, '0')}`
                  : `→ Prochaine facture : F-${year}-${String(parseInt(lastFacture || '0', 10) + 1).padStart(3, '0')}`}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleSkip}
              className={cn("flex-1 font-bold", isRTL && "font-cairo")}
            >
              {isRTL ? 'تخطي' : 'Passer'}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={saving}
              className={cn("flex-1 font-bold", isRTL && "font-cairo")}
            >
              {saving
                ? (isRTL ? 'جاري الحفظ...' : 'Enregistrement...')
                : (isRTL ? 'تأكيد ✓' : 'Confirmer ✓')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NumberingOnboardingModal;
