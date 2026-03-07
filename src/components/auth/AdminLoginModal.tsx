import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, Mail, KeyRound, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdminLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const AdminLoginModal = ({ open, onOpenChange, onSuccess }: AdminLoginModalProps) => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Erreur',
          description: error.message,
        });
      } else {
        setMagicLinkSent(true);
        toast({
          title: isRTL ? 'تم الإرسال ✉️' : 'Lien envoyé ✉️',
          description: isRTL
            ? 'تحقق من بريدك الإلكتروني وانقر على الرابط للدخول'
            : 'Vérifiez votre boîte mail et cliquez sur le lien pour vous connecter',
        });
      }
    } catch (err) {
      console.error('Magic link error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinLogin = async () => {
    if (pin.length !== 4) return;
    setIsLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-pin-login', {
        body: { pin },
      });

      if (fnError || data?.error) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'رمز خاطئ' : 'PIN incorrect',
          description: data?.error || fnError?.message || 'Erreur',
        });
        setPin('');
        setIsLoading(false);
        return;
      }

      // Use the token_hash to verify and create a session
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });

      if (otpError) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Erreur',
          description: otpError.message,
        });
      } else {
        toast({
          title: isRTL ? 'مرحبا بالمدير 🔐' : 'Bienvenue Admin 🔐',
          description: isRTL ? 'تم الدخول بنجاح' : 'Connexion réussie',
        });
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err) {
      console.error('PIN login error:', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: String(err),
      });
    } finally {
      setIsLoading(false);
      setPin('');
    }
  };

  const handleClose = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setMagicLinkSent(false);
      setPin('');
      setEmail('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn('sm:max-w-md', isRTL && 'font-cairo')}>
        <DialogHeader>
          <DialogTitle className={cn('text-center', isRTL && 'font-cairo')}>
            🔐 {isRTL ? 'دخول المدير' : 'Connexion Admin'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="pin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pin" className="gap-1.5 text-xs">
              <KeyRound className="h-3.5 w-3.5" />
              {isRTL ? 'رمز PIN' : 'Code PIN'}
            </TabsTrigger>
            <TabsTrigger value="magic" className="gap-1.5 text-xs">
              <Mail className="h-3.5 w-3.5" />
              Magic Link
            </TabsTrigger>
          </TabsList>

          {/* PIN Tab */}
          <TabsContent value="pin" className="space-y-4 mt-4">
            <p className={cn('text-sm text-muted-foreground text-center', isRTL && 'font-cairo')}>
              {isRTL ? 'أدخل رمز PIN المكون من 4 أرقام' : 'Entrez votre code PIN à 4 chiffres'}
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={4}
                value={pin}
                onChange={setPin}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="w-full font-bold"
              onClick={handlePinLogin}
              disabled={pin.length !== 4 || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                isRTL ? 'دخول' : 'Se connecter'
              )}
            </Button>
          </TabsContent>

          {/* Magic Link Tab */}
          <TabsContent value="magic" className="space-y-4 mt-4">
            {magicLinkSent ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
                <p className={cn('font-bold text-foreground', isRTL && 'font-cairo')}>
                  {isRTL ? '✉️ تحقق من بريدك' : '✉️ Vérifiez votre boîte mail'}
                </p>
                <p className={cn('text-sm text-muted-foreground', isRTL && 'font-cairo')}>
                  {isRTL
                    ? 'انقر على الرابط المرسل إلى بريدك للدخول تلقائيا'
                    : 'Cliquez sur le lien envoyé à votre email pour vous connecter automatiquement'}
                </p>
                <Button variant="outline" className="w-full" onClick={() => setMagicLinkSent(false)}>
                  {isRTL ? 'إعادة الإرسال' : 'Renvoyer'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className={cn('font-bold', isRTL && 'text-right block font-cairo')}>
                    {isRTL ? 'الإيميل' : 'Email'}
                  </Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@email.com"
                    required
                    className={cn(isRTL && 'text-right')}
                  />
                </div>
                <Button type="submit" className="w-full font-bold" disabled={isLoading || !email}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-1.5" />
                      {isRTL ? 'إرسال رابط الدخول' : 'Envoyer le lien'}
                    </>
                  )}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AdminLoginModal;
