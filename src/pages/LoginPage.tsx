import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, Eye, EyeOff, ArrowRight, UserRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';

const LoginPage = () => {
  const { signIn, signUp, signInAnonymously, isAuthenticated } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // If already authenticated, redirect home
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ variant: "destructive", title: isRTL ? "خطأ" : "Erreur", description: error.message });
      } else {
        setResetEmailSent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    try {
      const { error } = await signInAnonymously();
      if (!error) {
        navigate('/', { replace: true });
      }
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && password !== confirmPassword) {
      toast({ variant: "destructive", title: isRTL ? "خطأ" : "Erreur", description: isRTL ? "كلمات المرور غير متطابقة" : "Les mots de passe ne correspondent pas" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = isLogin ? await signIn(email, password) : await signUp(email, password);
      if (error) {
        toast({ variant: "destructive", title: isRTL ? "خطأ" : "Erreur", description: error.message });
      } else {
        toast({ title: isRTL ? "تمام ✓" : "Succès ✓" });
        navigate('/', { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center bg-background p-4", isRTL && "font-cairo")} dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-black text-xl mx-auto shadow-lg">
            AF
          </div>
          <CardTitle className="text-xl font-bold">
            {isForgotPassword
              ? (isRTL ? "نسيت كلمة المرور" : "Mot de passe oublié")
              : isLogin
                ? (isRTL ? "تسجيل الدخول" : "Connexion")
                : (isRTL ? "إنشاء حساب" : "Créer un compte")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isForgotPassword ? (
            resetEmailSent ? (
              <div className="text-center space-y-4">
                <p className="text-foreground font-bold">✉️ {isRTL ? "تحقق من بريدك الإلكتروني" : "Vérifiez votre boîte mail"}</p>
                <Button variant="outline" className="w-full" onClick={() => { setIsForgotPassword(false); setResetEmailSent(false); }}>
                  {isRTL ? "رجوع" : "Retour"}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">{isRTL ? "الإيميل" : "Email"}</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required />
                </div>
                <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRTL ? "إرسال رابط التعيين" : "Envoyer le lien")}
                </Button>
                <button type="button" onClick={() => setIsForgotPassword(false)} className="w-full text-center text-sm text-primary underline font-bold">
                  {isRTL ? "رجوع" : "Retour"}
                </button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">{isRTL ? "الإيميل" : "Email"}</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">{isRTL ? "كلمة المرور" : "Mot de passe"}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground", isRTL ? "left-3" : "right-3")} tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isLogin && (
                    <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-primary underline font-bold">
                      {isRTL ? "نسيت كلمة المرور؟" : "Mot de passe oublié ?"}
                    </button>
                  )}
                </div>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label className="font-bold">{isRTL ? "تأكيد كلمة المرور" : "Confirmer"}</Label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
                  </div>
                )}
                <Button type="submit" className="w-full font-bold h-12 text-[16px]" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      {isLogin ? (isRTL ? "تسجيل الدخول" : "Se connecter") : (isRTL ? "إنشاء حساب" : "Créer un compte")}
                      <ArrowRight className={cn("h-4 w-4 ml-2", isRTL && "rotate-180 mr-2 ml-0")} />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{isRTL ? "أو" : "ou"}</span>
                </div>
              </div>

              <Button variant="outline" className="w-full font-bold gap-2 h-11" onClick={handleGuestLogin} disabled={isGuestLoading}>
                {isGuestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    <UserRound className="h-4 w-4" />
                    {isRTL ? "تجربة سريعة بدون حساب" : "Essai rapide (sans compte)"}
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {isLogin ? (isRTL ? "معندكش حساب؟ " : "Pas de compte ? ") : (isRTL ? "عندك حساب؟ " : "Déjà un compte ? ")}
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary underline font-bold">
                  {isLogin ? (isRTL ? "إنشاء حساب" : "Créer un compte") : (isRTL ? "دخول" : "Se connecter")}
                </button>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
