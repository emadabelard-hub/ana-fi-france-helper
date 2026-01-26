import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AuthModal = ({ open, onOpenChange }: AuthModalProps) => {
  const { signIn, signUp } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: error.message,
        });
      } else {
        toast({
          title: isRTL ? "نجاح" : "Succès",
          description: isLogin 
            ? (isRTL ? "تم تسجيل الدخول بنجاح" : "Connexion réussie")
            : (isRTL ? "تم إنشاء الحساب بنجاح" : "Compte créé avec succès"),
        });
        onOpenChange(false);
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", isRTL && "font-cairo")}>
        <DialogHeader>
          <DialogTitle className={cn(isRTL && "text-right")}>
            {isLogin 
              ? (isRTL ? "تسجيل الدخول" : "Connexion")
              : (isRTL ? "إنشاء حساب" : "Créer un compte")}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className={cn(isRTL && "text-right block")}>
              {isRTL ? "البريد الإلكتروني" : "Email"}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              required
              className={cn(isRTL && "text-right")}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className={cn(isRTL && "text-right block")}>
              {isRTL ? "كلمة المرور" : "Mot de passe"}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className={cn(isRTL && "text-right")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLogin 
              ? (isRTL ? "تسجيل الدخول" : "Se connecter")
              : (isRTL ? "إنشاء حساب" : "Créer un compte")}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {isLogin ? (
            <p>
              {isRTL ? "ليس لديك حساب؟" : "Pas encore de compte ?"}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="text-primary underline hover:no-underline"
              >
                {isRTL ? "إنشاء حساب" : "Créer un compte"}
              </button>
            </p>
          ) : (
            <p>
              {isRTL ? "لديك حساب بالفعل؟" : "Déjà un compte ?"}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className="text-primary underline hover:no-underline"
              >
                {isRTL ? "تسجيل الدخول" : "Se connecter"}
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
