import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Invitation {
  id: string;
  chantier_id: string;
  patron_user_id: string;
  status: string;
  expires_at: string;
  chantier_name: string | null;
}

type Lang = 'fr' | 'ar' | null;

const TXT = {
  fr: {
    title: "Invitation à rejoindre un chantier",
    chantier: "Chantier",
    signup: "Nouveau compte",
    signin: "J'ai déjà un compte",
    name: "Nom",
    namePh: "Votre nom",
    email: "Email",
    password: "Mot de passe",
    submitSignup: "Créer un compte et accepter l'invitation",
    submitSignin: "Se connecter et accepter l'invitation",
    missing: "Informations manquantes",
    missingDesc: "Email + mot de passe (6 caractères minimum)",
    error: "Erreur",
    invalid: "Lien d'invitation invalide",
    used: "Cette invitation a déjà été utilisée ou annulée",
    expired: "Le lien d'invitation a expiré (48 heures)",
    notFound: "Invitation introuvable",
    login: "Se connecter",
    accepting: "Acceptation de l'invitation...",
    created: "Compte créé",
    createdDesc: "Vérifiez votre email puis cliquez à nouveau sur le lien",
    accepted: "Invitation acceptée",
  },
  ar: {
    title: "دعوة للانضمام كمسئول شانتي",
    chantier: "الشانتي",
    signup: "حساب جديد",
    signin: "عندي حساب",
    name: "الاسم",
    namePh: "اسمك",
    email: "الإيميل",
    password: "كلمة السر",
    submitSignup: "إنشاء حساب وقبول الدعوة",
    submitSignin: "دخول وقبول الدعوة",
    missing: "بيانات ناقصة",
    missingDesc: "إيميل + كلمة سر (6 أحرف على الأقل)",
    error: "خطأ",
    invalid: "رابط الدعوة غير صالح",
    used: "هذه الدعوة استُعملت أو أُلغيت",
    expired: "انتهت صلاحية رابط الدعوة (48 ساعة)",
    notFound: "الدعوة غير موجودة",
    login: "تسجيل الدخول",
    accepting: "جاري قبول الدعوة...",
    created: "تم إنشاء الحساب",
    createdDesc: "تأكد إيميلك وارجع للضغط على الرابط",
    accepted: "تم قبول الدعوة",
  },
};

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp, isLoading: authLoading } = useAuth();

  const [lang, setLang] = useState<Lang>(null);
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const t = TXT[lang || 'ar'];
  const isRTL = lang === 'ar';

  // Load invitation
  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase.rpc as any)('get_chantier_invitation', { _token: token });
        if (error) throw error;
        const inv = Array.isArray(data) ? data[0] : data;
        if (!inv) {
          setError('invalid');
        } else if (inv.status !== 'pending') {
          setError('used');
        } else if (new Date(inv.expires_at).getTime() < Date.now()) {
          setError('expired');
        } else {
          setInvitation(inv as Invitation);
        }
      } catch (e: any) {
        console.warn('[invite] load failed', e);
        setError('invalid');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const acceptInvitation = async () => {
    if (!token) return;
    const { data, error } = await (supabase.rpc as any)('accept_chantier_invitation', { _token: token });
    if (error) {
      toast({ title: t.error, description: error.message, variant: 'destructive' });
      return;
    }
    const chId = (data as any)?.chantier_id;
    toast({ title: t.accepted });
    navigate(`/chantier-report?chantierId=${chId || ''}`, { replace: true });
  };

  useEffect(() => {
    if (!invitation || authLoading) return;
    if (user && !user.is_anonymous) {
      acceptInvitation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitation, authLoading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    const email = (emailRef.current?.value || '').trim();
    const password = passwordRef.current?.value || '';
    if (!email || password.length < 6) {
      toast({ title: t.missing, description: t.missingDesc, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const fn = mode === 'signup' ? signUp : signIn;
      const { error, needsEmailConfirmation } = await fn(email, password);
      if (error) {
        toast({ title: t.error, description: error.message, variant: 'destructive' });
        return;
      }
      if (mode === 'signup' && needsEmailConfirmation) {
        toast({ title: t.created, description: t.createdDesc });
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Language selector first
  if (!lang && !error && invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">Anafy Pro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" variant="outline" onClick={() => setLang('fr')}>Français</Button>
            <Button className="w-full font-cairo" variant="outline" onClick={() => setLang('ar')}>العربية</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    const errMsg = error === 'used' ? t.used : error === 'expired' ? t.expired : error === 'invalid' ? t.invalid : t.notFound;
    return (
      <div className="min-h-screen flex items-center justify-center px-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className={isRTL ? 'font-cairo text-center' : 'text-center'}>{t.invalid}</CardTitle></CardHeader>
          <CardContent>
            <p className={isRTL ? 'text-center text-muted-foreground font-cairo' : 'text-center text-muted-foreground'}>{errMsg}</p>
            <Button className={isRTL ? 'w-full mt-4 font-cairo' : 'w-full mt-4'} onClick={() => navigate('/login')}>{t.login}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user && !user.is_anonymous) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className={isRTL ? 'font-cairo text-sm text-muted-foreground' : 'text-sm text-muted-foreground'}>{t.accepting}</p>
        </div>
      </div>
    );
  }

  const fc = isRTL ? 'font-cairo' : '';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className={`${fc} text-center`}>{t.title}</CardTitle>
          {invitation.chantier_name && (
            <p className={`text-center text-sm text-muted-foreground mt-2 ${fc}`}>
              {t.chantier}: <strong>{invitation.chantier_name}</strong>
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button type="button" variant={mode === 'signup' ? 'default' : 'outline'} className={`flex-1 ${fc}`} onClick={() => setMode('signup')}>{t.signup}</Button>
            <Button type="button" variant={mode === 'signin' ? 'default' : 'outline'} className={`flex-1 ${fc}`} onClick={() => setMode('signin')}>{t.signin}</Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <Label className={fc}>{t.name}</Label>
                <Input ref={nameRef} placeholder={t.namePh} dir={isRTL ? 'rtl' : 'ltr'} />
              </div>
            )}
            <div>
              <Label className={fc}>{t.email}</Label>
              <Input ref={emailRef} type="email" placeholder="email@example.com" dir="ltr" required />
            </div>
            <div>
              <Label className={fc}>{t.password}</Label>
              <Input ref={passwordRef} type="password" placeholder="••••••" dir="ltr" required minLength={6} />
            </div>
            <Button type="submit" className={`w-full ${fc}`} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === 'signup' ? t.submitSignup : t.submitSignin)}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitePage;
