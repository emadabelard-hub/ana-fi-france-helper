import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ResetDataSection = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const expectedText = isRTL ? 'حذف' : 'RESET';

  if (!user) return null;

  const handleReset = async () => {
    if (confirmText !== expectedText) return;
    setIsResetting(true);
    try {
      // Delete in FK order
      await supabase.from('expenses').delete().eq('user_id', user.id);
      await supabase.from('invoice_drafts').delete().eq('user_id', user.id);
      await supabase.from('documents_comptables').delete().eq('user_id', user.id);
      await supabase.from('document_counters').delete().eq('user_id', user.id);
      await supabase.from('transactions').delete().eq('user_id', user.id);
      // chantiers before clients (FK)
      await supabase.from('chantiers').delete().eq('user_id', user.id);
      await supabase.from('clients').delete().eq('user_id', user.id);

      toast({
        title: isRTL ? '✅ تم مسح البيانات' : '✅ Données réinitialisées',
        description: isRTL ? 'جميع الوثائق والعملاء تم حذفها' : 'Tous les documents, clients et transactions ont été supprimés.',
      });
    } catch (e) {
      console.error('Reset error:', e);
      toast({ title: isRTL ? 'خطأ' : 'Erreur', variant: 'destructive' });
    } finally {
      setIsResetting(false);
      setIsOpen(false);
      setConfirmText('');
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-3">
      <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
        <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <p className={cn("text-sm font-semibold text-amber-800 dark:text-amber-300", isRTL && "font-cairo")}>
          {isRTL ? 'إعادة تعيين البيانات' : 'Réinitialiser les données'}
        </p>
      </div>
      <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-cairo")}>
        {isRTL
          ? 'حذف جميع الفواتير والديفي والعملاء والمعاملات. لا يمكن التراجع.'
          : 'Supprime tous les devis, factures, clients et transactions. Action irréversible.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20"
      >
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
        {isRTL ? 'مسح الكل' : 'Tout effacer'}
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(isRTL && "text-right font-cairo")}>
              {isRTL ? '⚠️ تأكيد الحذف' : '⚠️ Confirmer la réinitialisation'}
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && "text-right font-cairo")}>
              {isRTL
                ? `اكتب "${expectedText}" للتأكيد. هذا الإجراء لا يمكن التراجع عنه.`
                : `Tapez "${expectedText}" pour confirmer. Cette action est irréversible.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className={cn("text-xs", isRTL && "text-right block font-cairo")}>
              {isRTL ? 'اكتب للتأكيد' : 'Confirmation'}
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expectedText}
              className="mt-1"
              dir="ltr"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Annuler'}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmText !== expectedText || isResetting}
              onClick={handleReset}
            >
              {isResetting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {isRTL ? 'حذف نهائي' : 'Supprimer définitivement'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ResetDataSection;
