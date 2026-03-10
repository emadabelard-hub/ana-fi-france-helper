import { useState } from 'react';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRTL: boolean;
  userId: string;
  accountantEmail?: string | null;
  onSent: () => void;
}

const SendToAccountantModal = ({ open, onOpenChange, isRTL, userId, accountantEmail, onSent }: Props) => {
  const { toast } = useToast();
  const [period, setPeriod] = useState<string>('month');
  const [email, setEmail] = useState(accountantEmail || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast({ title: isRTL ? '❌ أدخل بريد إلكتروني صحيح' : '❌ Entrez un email valide', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      // Save accountant email to profile for future use
      await (supabase.from('profiles') as any)
        .update({ accountant_email: email.trim() })
        .eq('user_id', userId);

      // Call edge function to send documents
      const { data, error } = await supabase.functions.invoke('send-to-accountant', {
        body: { period, accountantEmail: email.trim() },
      });

      if (error) throw error;

      setSent(true);
      toast({ title: isRTL ? '✅ تم الإرسال للمحاسب بنجاح' : '✅ Documents envoyés au comptable' });
      onSent();

      // Reset after delay
      setTimeout(() => {
        setSent(false);
        onOpenChange(false);
      }, 2000);
    } catch (err: any) {
      console.error('Send to accountant error:', err);
      toast({
        title: isRTL ? '❌ خطأ في الإرسال' : '❌ Erreur d\'envoi',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className={cn('flex items-center gap-2 text-accent', isRTL && 'flex-row-reverse font-cairo text-right')}>
            <Send className="h-5 w-5" />
            {isRTL ? 'إرسال المستندات للمحاسب' : 'Envoyer au comptable'}
          </DialogTitle>
          <DialogDescription className={cn('text-muted-foreground text-sm', isRTL && 'text-right font-cairo')}>
            {isRTL
              ? 'اختر الفترة وأدخل بريد المحاسب لإرسال جميع الفواتير والمصروفات'
              : 'Sélectionnez la période et entrez l\'email du comptable'}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className={cn('text-sm font-bold text-green-600', isRTL && 'font-cairo')}>
              {isRTL ? 'تم الإرسال بنجاح ✅' : 'Envoyé avec succès ✅'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Period selector */}
            <div className={cn('space-y-1.5', isRTL && 'text-right')}>
              <label className={cn('text-sm font-medium text-foreground', isRTL && 'font-cairo')}>
                {isRTL ? 'الفترة' : 'Période'}
              </label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{isRTL ? 'الشهر الحالي' : 'Ce mois'}</SelectItem>
                  <SelectItem value="quarter">{isRTL ? 'الربع السنوي' : 'Ce trimestre'}</SelectItem>
                  <SelectItem value="year">{isRTL ? 'السنة' : 'Cette année'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Accountant email */}
            <div className={cn('space-y-1.5', isRTL && 'text-right')}>
              <label className={cn('text-sm font-medium text-foreground', isRTL && 'font-cairo')}>
                {isRTL ? 'بريد المحاسب' : 'Email du comptable'}
              </label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={isRTL ? 'comptable@example.com' : 'comptable@example.com'}
                className={cn('bg-background border-border', isRTL && 'text-right')}
                dir="ltr"
              />
            </div>

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className={cn(isRTL && 'font-cairo')}>{isRTL ? 'جاري الإرسال...' : 'Envoi en cours...'}</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className={cn(isRTL && 'font-cairo')}>{isRTL ? 'إرسال للمحاسب' : 'Envoyer au comptable'}</span>
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SendToAccountantModal;
