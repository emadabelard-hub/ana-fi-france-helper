import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const validatePassword = (password: string): string | null => {
  if (password.length < 6) return 'min6';
  if (!/\d/.test(password)) return 'needNumber';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return 'needSpecial';
  return null;
};

const ResetPasswordPage = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Check if we're in a recovery flow from hash
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const pwError = validatePassword(password);
    if (pwError) {
      toast({
        variant: "destructive",
        title: isRTL ? "كلمة المرور ضعيفة" : "Mot de passe faible",
        description: isRTL
          ? "يجب أن تحتوي على 6 أحرف على الأقل، رقم وعلامة خاصة"
          : "Doit contenir au moins 6 caractères, un chiffre et un caractère spécial",
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

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: error.message,
        });
      } else {
        setIsSuccess(true);
        toast({
          title: isRTL ? "تمام!" : "Succès !",
          description: isRTL ? "تم تغيير كلمة المرور بنجاح" : "Mot de passe modifié avec succès",
        });
        setTimeout(() => navigate('/'), 2000);
      }
    } catch (err) {
      console.error('Password reset error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">
              {isRTL ? "تم تغيير كلمة المرور" : "Mot de passe modifié"}
            </h2>
            <p className="text-muted-foreground">
              {isRTL ? "جاري إعادة التوجيه..." : "Redirection en cours..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">
              {isRTL ? "جاري التحقق من الرابط..." : "Vérification du lien..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className={cn("w-full max-w-md", isRTL && "font-cairo")}>
        <CardHeader>
          <CardTitle className={cn(isRTL && "text-right")}>
            {isRTL ? "كلمة مرور جديدة" : "Nouveau mot de passe"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className={cn("font-bold text-foreground", isRTL && "text-right block")}>
                {isRTL ? "كلمة المرور الجديدة" : "Nouveau mot de passe"}
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={cn("pr-10", isRTL && "text-right pr-3 pl-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors",
                    isRTL ? "left-3" : "right-3"
                  )}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className={cn("text-xs font-bold text-foreground", isRTL && "text-right")}>
                {isRTL
                  ? "يجب أن تحتوي على رقم وعلامة خاصة (مثل: * ! .)"
                  : "Doit contenir un chiffre et un caractère spécial (ex: * ! .)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password" className={cn("font-bold text-foreground", isRTL && "text-right block")}>
                {isRTL ? "تأكيد كلمة المرور" : "Confirmer le mot de passe"}
              </Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className={cn(isRTL && "text-right")}
              />
            </div>

            <Button type="submit" className="w-full font-bold" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                isRTL ? "تغيير كلمة المرور" : "Changer le mot de passe"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
