import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Rocket, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MoneyTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MoneyTransferModal = ({ open, onOpenChange }: MoneyTransferModalProps) => {
  const { language, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: language === 'fr' ? 'Email invalide' : 'إيميل غلط',
        description: language === 'fr' ? 'Veuillez entrer un email valide.' : 'اكتب إيميل صحيح من فضلك.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('transfer_waitlist')
        .insert({ email: email.trim().toLowerCase() });

      if (error && error.code === '23505') {
        // duplicate
        toast({
          title: language === 'fr' ? 'Déjà inscrit !' : 'مسجّل من قبل!',
          description: language === 'fr' ? 'Cet email est déjà sur la liste.' : 'الإيميل ده موجود عندنا.',
        });
        setSubmitted(true);
      } else if (error) {
        throw error;
      } else {
        setSubmitted(true);
      }
    } catch {
      toast({
        title: language === 'fr' ? 'Erreur' : 'خطأ',
        description: language === 'fr' ? 'Réessayez plus tard.' : 'جرّب تاني بعدين.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setEmail('');
      setSubmitted(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "bg-[#1e293b] border-white/10 text-white max-w-md rounded-[2rem] p-6",
        isRTL && "font-cairo"
      )}>
        <DialogHeader>
          <div className="flex justify-center mb-3">
            <div className="p-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20">
              {submitted
                ? <CheckCircle2 size={36} className="text-emerald-400" />
                : <Rocket size={36} className="text-emerald-400" />
              }
            </div>
          </div>
          <DialogTitle className={cn(
            "text-xl font-black text-white text-center",
            isRTL && "font-cairo"
          )}>
            {submitted
              ? (language === 'fr' ? "C'est noté ! ✅" : 'تمام، اتسجّلت! ✅')
              : (language === 'fr' ? 'Bientôt Disponible 🚀' : 'قريباً 🚀')
            }
          </DialogTitle>
          <DialogDescription className={cn(
            "text-slate-400 text-sm text-center mt-2 leading-relaxed",
            isRTL && "font-cairo"
          )}>
            {submitted
              ? (language === 'fr'
                  ? 'Vous serez le premier informé dès le lancement.'
                  : 'هتكون أول واحد يعرف أول ما نفتح الخدمة.')
              : (language === 'fr'
                  ? 'Nous finalisons un partenariat exclusif pour vous offrir des transferts sans frais vers l\'Égypte et le Maroc.'
                  : 'بنجهّز شراكة حصرية عشان نوفّرلك تحويلات بدون رسوم لمصر والمغرب.')
            }
          </DialogDescription>
        </DialogHeader>

        {!submitted && (
          <div className="mt-5 space-y-3">
            <Input
              type="email"
              placeholder={language === 'fr' ? 'Votre adresse email' : 'الإيميل بتاعك'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-12 text-sm",
                isRTL && "text-right font-cairo"
              )}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm"
            >
              {loading
                ? '...'
                : (language === 'fr' ? 'Me prévenir du lancement' : 'بلّغني أول ما ينزل')
              }
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MoneyTransferModal;
