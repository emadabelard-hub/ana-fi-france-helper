import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, Eye, EyeOff, UserRound } from 'lucide-react';
import GDPRTrustBox from '@/components/shared/GDPRTrustBox';
import { supabase } from '@/integrations/supabase/client';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const validatePassword = (password: string): string | null => {
  if (password.length < 6) return 'min6';
  if (!/\d/.test(password)) return 'needNumber';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return 'needSpecial';
  return null;
};

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  isRTL: boolean;
}

const PasswordInput = ({
  id,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  isRTL,
}: PasswordInputProps) => (
  <div className="relative">
    <Input
      id={id}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required
      minLength={6}
      className={cn("pr-10", isRTL && "text-right pr-3 pl-10")}
    />
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors",
        isRTL ? "left-3" : "right-3"
      )}
      tabIndex={-1}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
);

const AuthModal = ({ open, onOpenChange }: AuthModalProps) => {
  const { signIn, signUp, signInAnonymously } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  if (open) return null;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "أدخل الإيميل ديالك" : "Veuillez entrer votre email",
      });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: error.message,
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: isRTL ? "تم الإرسال" : "Email envoyé",
          description: isRTL
            ? "تحقق من بريدك الإلكتروني لإعادة تعيين كلمة المرور"
            : "Vérifiez votre boîte mail pour réinitialiser votre mot de passe",
        });
      }
    } catch (err) {
      console.error('Forgot password error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    try {
      const { error } = await signInAnonymously();
      if (error) {
        toast({
          variant: "destructive",
          title: isRTL ? "حصلت مشكلة" : "Erreur",
          description: error.message,
        });
      } else {
        toast({
          title: isRTL ? "أهلاً بيك!" : "Bienvenue !",
          description: isRTL ? "دخلت كضيف" : "Connecté en tant qu'invité",
        });
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Guest auth error:', error);
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Password validation for sign-up
    if (!isLogin) {
      const pwError = validatePassword(password);
      if (pwError) {
        toast({
          variant: "destructive",
          title: isRTL ? "كلمة المرور ضعيفة" : "Mot de passe faible",
          description: isRTL
            ? "يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل، رقم وعلامة خاصة"
            : "Le mot de passe doit contenir au moins 6 caractères, un chiffre et un caractère spécial",
        });
        return;
      }
      if (password !== confirmPassword) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: isRTL ? "كلمات المرور غير متطابقة" : "Les mots de passe ne correspondent pas",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const { error } = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        toast({
          variant: "destructive",
          title: isRTL ? "حصلت مشكلة" : "Erreur",
          description: error.message,
        });
      } else {
        toast({
          title: isRTL ? "تمام" : "Succès",
          description: isLogin 
            ? (isRTL ? "دخلت بنجاح" : "Connexion réussie")
            : (isRTL ? "الحساب اتفتح بنجاح" : "Compte créé avec succès"),
        });
        onOpenChange(false);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setIsForgotPassword(false); setResetEmailSent(false); } }}>
      <DialogContent className={cn("sm:max-w-md", isRTL && "font-cairo")}>
        <DialogHeader>
          <DialogTitle className={cn(isRTL && "text-right")}>
            {isForgotPassword
              ? (isRTL ? "نسيت كلمة المرور" : "Mot de passe oublié")
              : isLogin 
                ? (isRTL ? "دخول" : "Connexion")
                : (isRTL ? "افتح حساب" : "Créer un compte")}
          </DialogTitle>
        </DialogHeader>

        {isForgotPassword ? (
          resetEmailSent ? (
            <div className="text-center space-y-4 py-4">
              <p className="text-foreground font-bold">
                {isRTL ? "✉️ تحقق من بريدك الإلكتروني" : "✉️ Vérifiez votre boîte mail"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني"
                  : "Nous avons envoyé un lien de réinitialisation à votre adresse email"}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full font-bold"
                onClick={() => { setIsForgotPassword(false); setResetEmailSent(false); }}
              >
                {isRTL ? "رجوع للدخول" : "Retour à la connexion"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "أدخل الإيميل ديالك وغادي نرسلو ليك رابط لإعادة تعيين كلمة المرور"
                  : "Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe"}
              </p>
              <div className="space-y-2">
                <Label htmlFor="reset-email" className={cn("font-bold text-foreground", isRTL && "text-right block")}>
                  {isRTL ? "الإيميل" : "Email"}
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  required
                  className={cn(isRTL && "text-right")}
                />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  isRTL ? "إرسال رابط التعيين" : "Envoyer le lien"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="w-full text-center text-sm text-primary underline hover:no-underline font-bold"
              >
                {isRTL ? "رجوع للدخول" : "Retour à la connexion"}
              </button>
            </form>
          )
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className={cn("font-bold text-foreground", isRTL && "text-right block")}>
                  {isRTL ? "الإيميل" : "Email"}
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
                <Label htmlFor="password" className={cn("font-bold text-foreground", isRTL && "text-right block")}>
                  {isRTL ? "كلمة المرور" : "Mot de passe"}
                </Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                  placeholder="••••••••"
                  isRTL={isRTL}
                />
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className={cn("text-xs text-primary underline hover:no-underline font-bold", isRTL && "block text-right")}
                  >
                    {isRTL ? "نسيت كلمة المرور؟" : "Mot de passe oublié ?"}
                  </button>
                )}
                {!isLogin && (
                  <p className={cn("text-xs font-bold text-foreground", isRTL && "text-right")}>
                    {isRTL
                      ? "يجب أن تحتوي كلمة المرور على رقم وعلامة خاصة (مثل: * ! .)"
                      : "Doit contenir un chiffre et un caractère spécial (ex: * ! .)"}
                  </p>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className={cn("font-bold text-foreground", isRTL && "text-right block")}>
                    {isRTL ? "تأكيد كلمة المرور" : "Confirmer le mot de passe"}
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                    placeholder="••••••••"
                    isRTL={isRTL}
                  />
                </div>
              )}

              <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isLogin 
                  ? (isRTL ? "ادخل" : "Se connecter")
                  : (isRTL ? "افتح حساب" : "Créer un compte")}
              </Button>
            </form>

            {/* Guest Mode Button */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {isRTL ? "أو" : "ou"}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full font-bold gap-2"
              onClick={handleGuestLogin}
              disabled={isGuestLoading}
            >
              {isGuestLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserRound className="h-4 w-4" />
                  {isRTL ? "تجربة سريعة (بدون حساب)" : "Essai rapide (sans compte)"}
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              {isLogin ? (
                <p>
                  {isRTL ? "معندكش حساب؟" : "Pas encore de compte ?"}{' '}
                  <button
                    type="button"
                    onClick={() => { setIsLogin(false); setConfirmPassword(''); }}
                    className="text-primary underline hover:no-underline font-bold"
                  >
                    {isRTL ? "افتح حساب" : "Créer un compte"}
                  </button>
                </p>
              ) : (
                <p>
                  {isRTL ? "عندك حساب خلاص؟" : "Déjà un compte ?"}{' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="text-primary underline hover:no-underline font-bold"
                  >
                    {isRTL ? "ادخل" : "Se connecter"}
                  </button>
                </p>
              )}
            </div>

            {/* GDPR Trust Box */}
            <GDPRTrustBox />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
