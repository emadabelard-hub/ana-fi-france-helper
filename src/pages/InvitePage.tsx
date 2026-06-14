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

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn, signUp, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

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
          setError('رابط الدعوة غير صالح');
        } else if (inv.status !== 'pending') {
          setError('هذه الدعوة استُعملت أو أُلغيت');
        } else if (new Date(inv.expires_at).getTime() < Date.now()) {
          setError('انتهت صلاحية رابط الدعوة (48 ساعة)');
        } else {
          setInvitation(inv as Invitation);
        }
      } catch (e: any) {
        console.warn('[invite] load failed', e);
        setError(e?.message || 'رابط الدعوة غير صالح');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // If already authenticated, accept immediately
  const acceptInvitation = async () => {
    if (!token) return;
    const { data, error } = await (supabase.rpc as any)('accept_chantier_invitation', { _token: token });
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return;
    }
    const chId = (data as any)?.chantier_id;
    toast({ title: 'تم قبول الدعوة' });
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
      toast({ title: 'بيانات ناقصة', description: 'إيميل + كلمة سر (6 أحرف على الأقل)', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const fn = mode === 'signup' ? signUp : signIn;
      const { error, needsEmailConfirmation } = await fn(email, password);
      if (error) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        return;
      }
      if (mode === 'signup' && needsEmailConfirmation) {
        toast({ title: 'تم إنشاء الحساب', description: 'تأكد إيميلك وارجع للضغط على الرابط' });
        return;
      }
      // acceptInvitation will fire from effect above
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

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="font-cairo text-center">رابط غير صالح</CardTitle></CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground font-cairo">{error || 'الدعوة غير موجودة'}</p>
            <Button className="w-full mt-4" onClick={() => navigate('/login')}>تسجيل الدخول</Button>
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
          <p className="font-cairo text-sm text-muted-foreground">جاري قبول الدعوة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background" dir="rtl">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-cairo text-center">
            دعوة للانضمام كمسئول شانتي
          </CardTitle>
          {invitation.chantier_name && (
            <p className="text-center text-sm text-muted-foreground font-cairo mt-2">
              الشانتي: <strong>{invitation.chantier_name}</strong>
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button type="button" variant={mode === 'signup' ? 'default' : 'outline'} className="flex-1 font-cairo" onClick={() => setMode('signup')}>حساب جديد</Button>
            <Button type="button" variant={mode === 'signin' ? 'default' : 'outline'} className="flex-1 font-cairo" onClick={() => setMode('signin')}>عندي حساب</Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <Label className="font-cairo">الاسم</Label>
                <Input ref={nameRef} placeholder="اسمك" dir="rtl" />
              </div>
            )}
            <div>
              <Label className="font-cairo">الإيميل</Label>
              <Input ref={emailRef} type="email" placeholder="email@example.com" dir="ltr" required />
            </div>
            <div>
              <Label className="font-cairo">كلمة السر</Label>
              <Input ref={passwordRef} type="password" placeholder="••••••" dir="ltr" required minLength={6} />
            </div>
            <Button type="submit" className="w-full font-cairo" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === 'signup' ? 'إنشاء حساب وقبول الدعوة' : 'دخول وقبول الدعوة')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitePage;
