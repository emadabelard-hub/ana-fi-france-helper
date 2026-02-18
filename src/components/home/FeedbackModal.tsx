import { useState } from 'react';
import { Lightbulb, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FeedbackModal = ({ open, onOpenChange }: FeedbackModalProps) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: isRTL ? 'حصلت مشكلة' : 'Erreur',
        description: isRTL ? 'اكتب رسالتك الأول' : 'Veuillez écrire votre message',
        variant: 'destructive',
      });
      return;
    }

    if (!user) {
      toast({
        title: isRTL ? 'لازم تسجّل دخولك' : 'Connexion requise',
        description: isRTL ? 'لازم تدخل حسابك الأول عشان تبعت رأيك' : 'Vous devez être connecté pour envoyer votre avis',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('user_feedback').insert({
        user_id: user.id,
        message: message.trim(),
      });

      if (error) throw error;

      toast({
        title: isRTL ? 'شكراً ليك! ✨' : 'Merci ! ✨',
        description: isRTL ? 'رسالتك وصلت تمام' : 'Message envoyé avec succès',
      });

      setMessage('');
      onOpenChange(false);
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast({
        title: isRTL ? 'حصلت مشكلة' : 'Erreur',
        description: isRTL ? 'حصلت مشكلة، جرب تاني' : 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-md",
        isRTL && "font-cairo"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "flex items-center gap-2 text-xl",
            isRTL && "flex-row-reverse text-right"
          )}>
            <Lightbulb className="h-5 w-5 text-amber-500" />
            {isRTL ? 'رأيك يهمنا 💡' : 'Votre avis compte 💡'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className={cn(
            "text-sm text-muted-foreground",
            isRTL && "text-right"
          )}>
            {isRTL 
              ? 'قولنا رأيك واقتراحاتك عشان نحسّن التطبيق'
              : 'Partagez vos idées et suggestions pour améliorer l\'application'
            }
          </p>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isRTL ? 'اكتب رسالتك هنا...' : 'Écrivez votre message ici...'}
            className={cn(
              "min-h-[150px] resize-none",
              isRTL && "text-right font-cairo"
            )}
            dir={isRTL ? 'rtl' : 'ltr'}
          />

          <div className={cn(
            "flex gap-2",
            isRTL ? "flex-row-reverse" : ""
          )}>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              {isSubmitting ? (
                <span className="animate-pulse">{isRTL ? 'بيتبعت...' : 'Envoi...'}</span>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {isRTL ? 'ابعت' : 'Envoyer'}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;