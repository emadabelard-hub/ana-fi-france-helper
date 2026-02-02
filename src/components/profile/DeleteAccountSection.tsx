import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const DeleteAccountSection = () => {
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const expectedConfirmText = isRTL ? 'حذف حسابي' : 'SUPPRIMER';

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirmText !== expectedConfirmText) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL 
          ? `اكتب "${expectedConfirmText}" للتأكيد`
          : `Tapez "${expectedConfirmText}" pour confirmer`,
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الحذف' : 'Compte supprimé',
        description: isRTL 
          ? 'تم حذف حسابك وجميع بياناتك بنجاح'
          : 'Votre compte et toutes vos données ont été supprimés',
      });

      // Sign out and redirect
      await signOut();
      window.location.href = '/';
      
    } catch (error) {
      console.error('Delete account error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL 
          ? 'فشل في حذف الحساب. حاول مرة أخرى.'
          : 'Échec de la suppression du compte. Veuillez réessayer.',
      });
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
    }
  };

  if (!user) return null;

  return (
    <div className="border-t pt-6 mt-6">
      <div className={cn(
        "flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5",
        isRTL && "flex-row-reverse"
      )}>
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className={cn("flex-1 space-y-3", isRTL && "text-right")}>
          <div>
            <h3 className={cn(
              "font-semibold text-destructive",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'حذف الحساب نهائياً' : 'Supprimer le compte'}
            </h3>
            <p className={cn(
              "text-sm text-muted-foreground mt-1",
              isRTL && "font-cairo"
            )}>
              {isRTL 
                ? 'سيتم حذف جميع بياناتك (الملف الشخصي، المستندات، الصور) نهائياً ولا يمكن استعادتها.'
                : 'Toutes vos données (profil, documents, images) seront définitivement supprimées et ne pourront pas être récupérées.'}
            </p>
          </div>

          <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                className={cn("gap-2", isRTL && "font-cairo")}
              >
                <Trash2 className="h-4 w-4" />
                {isRTL ? 'حذف حسابي' : 'Supprimer mon compte'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className={cn(isRTL && "font-cairo")}>
              <AlertDialogHeader>
                <AlertDialogTitle className={cn(
                  "flex items-center gap-2 text-destructive",
                  isRTL && "flex-row-reverse"
                )}>
                  <AlertTriangle className="h-5 w-5" />
                  {isRTL ? 'تأكيد حذف الحساب' : 'Confirmer la suppression'}
                </AlertDialogTitle>
                <AlertDialogDescription className={cn(isRTL && "text-right")}>
                  {isRTL 
                    ? 'هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بياناتك نهائياً بما في ذلك:'
                    : 'Cette action est irréversible. Toutes vos données seront définitivement supprimées, notamment:'}
                  <ul className={cn(
                    "list-disc mt-2 space-y-1",
                    isRTL ? "mr-4" : "ml-4"
                  )}>
                    <li>{isRTL ? 'الملف الشخصي ومعلومات الشركة' : 'Votre profil et informations entreprise'}</li>
                    <li>{isRTL ? 'جميع المستندات والفواتير' : 'Tous vos documents et factures'}</li>
                    <li>{isRTL ? 'الصور والشعارات المرفوعة' : 'Vos images et logos téléchargés'}</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2 py-2">
                <Label className={cn(isRTL && "text-right block")}>
                  {isRTL 
                    ? `اكتب "${expectedConfirmText}" للتأكيد:`
                    : `Tapez "${expectedConfirmText}" pour confirmer:`}
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={expectedConfirmText}
                  className={cn(isRTL && "text-right")}
                />
              </div>

              <AlertDialogFooter className={cn(isRTL && "flex-row-reverse")}>
                <AlertDialogCancel 
                  onClick={() => setConfirmText('')}
                  className={cn(isRTL && "font-cairo")}
                >
                  {isRTL ? 'إلغاء' : 'Annuler'}
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || confirmText !== expectedConfirmText}
                  className={cn("gap-2", isRTL && "font-cairo")}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isRTL ? 'حذف نهائياً' : 'Supprimer définitivement'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountSection;
