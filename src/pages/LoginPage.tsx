import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Loader2, Eye, EyeOff, ArrowRight, UserRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getResetPasswordRedirectUrl, normalizeEmail, PRIMARY_ADMIN_EMAIL, withAuthTimeout } from '@/lib/auth';

const LoginPage = () => {
  const { signIn, signUp, signInAnonymously, isAuthenticated, isLoading: authLoading, user } = useAuth();

  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showResendConfirm, setShowResendConfirm] = useState(false);
  const [resendingConfirm, setResendingConfirm] = useState(false);

  // Use refs for form values to avoid Chrome mobile autofill issues
  // Chrome autofill does NOT fire onChange on controlled inputs,
  // so React state stays empty while user sees filled values.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const resetEmailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const isPrimaryAdmin = !!user?.email && normalizeEmail(user.email) === PRIMARY_ADMIN_EMAIL;
      navigate(isPrimaryAdmin ? '/admin' : '/', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, user?.email]);

  if (authLoading) return null;

  const getErrorMessage = (errorMsg: string): string => {
    const msg = errorMsg.toLowerCase();
    if (msg.includes('invalid login credentials')) {
      return 'Email ou mot de passe incorrect';
    }
    if (msg.includes('email not confirmed')) {
      return 'Compte non confirmé. Vérifiez votre email ou renvoyez le lien.';
    }
    if (msg.includes('user already registered')) {
      return 'Cet email est déjà enregistré. Essayez de vous connecter.';
    }
    if (msg.includes('password')) {
      return 'Erreur de mot de passe';
    }
    return errorMsg;
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const submittedEmail = normalizeEmail(resetEmailRef.current?.value ?? '');

    if (!submittedEmail) return;

    setIsLoading(true);
    try {
      const { error } = await withAuthTimeout(
        supabase.auth.resetPasswordForEmail(submittedEmail, {
          redirectTo: getResetPasswordRedirectUrl(),
        }),
        'L’envoi du lien prend trop de temps. Réessayez.'
      );
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        setResetEmailSent(true);
        toast({
          title: 'Email envoyé',
          description: 'Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé.',
        });
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Read directly from DOM refs — immune to Chrome autofill issues
    const submittedEmail = normalizeEmail(emailRef.current?.value ?? '');
    const submittedPassword = passwordRef.current?.value ?? '';
    const submittedConfirmPassword = confirmPasswordRef.current?.value ?? '';

    if (!submittedEmail || !submittedPassword) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs',
      });
      return;
    }

    if (!isLogin && submittedPassword !== submittedConfirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = isLogin
        ? await signIn(submittedEmail, submittedPassword)
        : await signUp(submittedEmail, submittedPassword);

      if (result.error) {
        const errMsg = result.error.message.toLowerCase();

        if (errMsg.includes('email not confirmed') && isLogin) {
          setShowResendConfirm(true);
        }

        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: getErrorMessage(result.error.message),
        });
        return;
      }

      if (!isLogin && result.needsEmailConfirmation) {
        toast({
          title: 'Vérifiez votre email',
          description: 'Compte créé. Confirmez votre email avant la connexion.',
        });
        setIsLogin(true);
        return;
      }

      toast({ title: 'Connexion réussie ✓' });
      const isPrimaryAdmin = submittedEmail === PRIMARY_ADMIN_EMAIL;
      navigate(isPrimaryAdmin ? '/admin' : '/', { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="ltr">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-black text-xl mx-auto shadow-lg">
            AF
          </div>
          <CardTitle className="text-xl font-bold">
            {isForgotPassword
              ? 'Mot de passe oublié'
              : isLogin
                ? 'Connexion'
                : 'Créer un compte'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isForgotPassword ? (
            resetEmailSent ? (
              <div className="text-center space-y-4">
                <p className="text-foreground font-bold">✉️ Vérifiez votre boîte mail</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetEmailSent(false);
                  }}
                >
                  Retour
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">Email</Label>
                  <Input
                    ref={resetEmailRef}
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    required
                    autoComplete="email"
                    className="text-[16px]"
                    dir="ltr"
                  />
                </div>
                <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer le lien'}
                </Button>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="w-full text-center text-sm text-primary underline font-bold"
                >
                  Retour
                </button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold">Email</Label>
                  <Input
                    ref={emailRef}
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    required
                    autoComplete="email"
                    className="text-[16px]"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      ref={passwordRef}
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      className="text-[16px]"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 -translate-y-1/2 text-muted-foreground right-3"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-primary underline font-bold"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label className="font-bold">Confirmer</Label>
                    <Input
                      ref={confirmPasswordRef}
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="text-[16px]"
                      dir="ltr"
                    />
                  </div>
                )}
                <Button type="submit" className="w-full font-bold h-12 text-[16px]" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isLogin ? 'Se connecter' : 'Créer un compte'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              {showResendConfirm && (
                <Button
                  variant="secondary"
                  className="w-full font-bold h-11 text-[16px]"
                  disabled={resendingConfirm}
                  onClick={async () => {
                    const currentEmail = emailRef.current?.value;
                    if (!currentEmail) return;
                    setResendingConfirm(true);
                    try {
                      const { error } = await supabase.auth.resend({ type: 'signup', email: normalizeEmail(currentEmail) });
                      toast({
                        title: error ? 'Erreur' : 'Lien envoyé ✓',
                        description: error ? error.message : 'Vérifiez votre boîte mail',
                        variant: error ? 'destructive' : 'default',
                      });
                    } finally {
                      setResendingConfirm(false);
                    }
                  }}
                >
                  {resendingConfirm ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Renvoyer le lien de confirmation'}
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full font-bold gap-2 h-11 text-[16px]"
                onClick={handleGuestLogin}
                disabled={isGuestLoading}
              >
                {isGuestLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserRound className="h-4 w-4" />
                    Essai rapide (sans compte)
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                {isLogin ? 'Pas de compte ? ' : 'Déjà un compte ? '}
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary underline font-bold">
                  {isLogin ? 'Créer un compte' : 'Se connecter'}
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
