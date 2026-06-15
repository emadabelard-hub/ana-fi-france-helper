import { useEffect, useState } from 'react';
import { Loader2, Mail, User, Send, Trash2, Power, ShieldCheck, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface AccountantAccess {
  id: string;
  accountant_name: string;
  accountant_email: string;
  access_token: string;
  is_active: boolean;
  created_at: string;
}

const AccountantAccessSection = ({ companyName }: { companyName?: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isRTL } = useLanguage();
  const tr = (ar: string, fr: string) => isRTL ? ar : fr;
  const [list, setList] = useState<AccountantAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState<'permanent' | '30' | '60' | '90'>('permanent');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('accountant_access')
      .select('id, accountant_name, accountant_email, access_token, is_active, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setList(data as AccountantAccess[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleInvite = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmedName.length < 2) {
      toast({ variant: 'destructive', title: 'الاسم قصير جدا' });
      return;
    }
    if (!emailRegex.test(trimmedEmail)) {
      toast({ variant: 'destructive', title: 'الإيميل غير صالح' });
      return;
    }
    setSending(true);
    try {
      const expiresAt = duration === 'permanent'
        ? null
        : new Date(Date.now() + Number(duration) * 86400000).toISOString();
      const { data: inserted, error: insertErr } = await supabase
        .from('accountant_access')
        .insert({ user_id: user.id, accountant_name: trimmedName, accountant_email: trimmedEmail, expires_at: expiresAt } as any)
        .select('id, access_token')
        .single();
      if (insertErr || !inserted) {
        toast({ variant: 'destructive', title: 'فشل الإنشاء' });
        return;
      }
      const { error: emailErr } = await supabase.functions.invoke('invite-accountant', {
        body: {
          accountantName: trimmedName,
          accountantEmail: trimmedEmail,
          accessToken: inserted.access_token,
          companyName: companyName || '',
        },
      });
      if (emailErr) {
        console.error('Email send error:', emailErr);
        toast({ title: 'تم الإنشاء، الإيميل قد يتأخر' });
      } else {
        toast({ title: '✅ تم إرسال الدعوة' });
      }
      setName(''); setEmail('');
      load();
    } finally {
      setSending(false);
    }
  };

  const handleToggle = async (item: AccountantAccess) => {
    const { error } = await supabase
      .from('accountant_access')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'فشل التحديث' });
      return;
    }
    load();
  };

  const handleDelete = async (item: AccountantAccess) => {
    if (!confirm('هل تريد حذف هذا الوصول نهائياً؟')) return;
    const { error } = await supabase.from('accountant_access').delete().eq('id', item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'فشل الحذف' });
      return;
    }
    load();
  };

  const copyLink = async (item: AccountantAccess) => {
    const url = `https://anafypro.com/comptable?token=${item.access_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-2xl bg-[#BFA071]/10 border border-[#BFA071]/20 p-4">
        <div className="flex items-start gap-3 flex-row-reverse">
          <ShieldCheck className="h-5 w-5 text-[#BFA071] shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80 leading-relaxed flex-1 text-right font-cairo">
            {tr('ادعُ محاسبك للوصول إلى بياناتك المالية في وضع القراءة فقط. يتلقى رابطاً آمناً عبر الإيميل ويرى الفواتير والمصاريف ويُحمّل FEC.', 'Invitez votre comptable à accéder à vos données financières en lecture seule. Il recevra un lien sécurisé par email et pourra voir les factures, dépenses et télécharger le FEC.')}
          </p>
        </div>
      </div>

      {/* Invite form */}
      <div className="bg-white dark:bg-card rounded-2xl p-5 shadow-sm border border-border/20 space-y-4">
        <p className="text-sm font-semibold text-foreground font-cairo text-right">{tr('دعوة محاسب جديد', 'Inviter un nouveau comptable')}</p>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-[13px] font-medium text-foreground/70 flex-row-reverse font-cairo">
            <User className="h-3.5 w-3.5 text-primary/50" />
            {tr('اسم المحاسب', 'Nom du comptable')}
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: محمد بن علي"
            className="h-12 rounded-xl text-right font-cairo"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-[13px] font-medium text-foreground/70 flex-row-reverse font-cairo">
            <Mail className="h-3.5 w-3.5 text-primary/50" />
            {tr('إيميل المحاسب', 'Email du comptable')}
          </Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="comptable@example.com"
            dir="ltr"
            lang="fr"
            className="h-12 rounded-xl text-left font-[Inter]"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-[13px] font-medium text-foreground/70 flex-row-reverse font-cairo">
            {tr('مدة الوصول', 'Durée d\'accès')}
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {([
              { v: 'permanent', lAr: 'دائم', lFr: 'Permanent' },
              { v: '30', lAr: '30 يوم', lFr: '30 jours' },
              { v: '60', lAr: '60 يوم', lFr: '60 jours' },
              { v: '90', lAr: '90 يوم', lFr: '90 jours' },
            ] as const).map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setDuration(opt.v)}
                className={cn(
                  "h-11 rounded-xl text-xs font-cairo border transition",
                  duration === opt.v
                    ? "bg-[#BFA071] text-white border-[#BFA071]"
                    : "bg-white dark:bg-card text-foreground border-border/40"
                )}
              >
                {tr(opt.lAr, opt.lFr)}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleInvite}
          disabled={sending}
          className="w-full h-12 rounded-xl bg-gradient-to-l from-[#BFA071] to-[#D4B896] hover:from-[#A8894F] hover:to-[#C4A880] text-white font-semibold font-cairo gap-2"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {tr('إرسال الدعوة', 'Envoyer l\'invitation')}
        </Button>
      </div>

      {/* Active accesses */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground font-cairo text-right">{tr('الوصول النشط', 'Accès actifs')}</p>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl p-6 text-center border border-border/20">
            <p className="text-sm text-muted-foreground font-cairo">لا يوجد وصول حالياً</p>
          </div>
        ) : (
          list.map(item => (
            <div key={item.id} className={cn(
              "bg-white dark:bg-card rounded-2xl p-4 shadow-sm border space-y-3",
              item.is_active ? "border-green-500/30" : "border-border/20 opacity-60"
            )}>
              <div className="flex items-start gap-3 flex-row-reverse">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  item.is_active ? "bg-green-500/10" : "bg-secondary"
                )}>
                  <User className={cn("h-5 w-5", item.is_active ? "text-green-600" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-semibold text-sm font-cairo">{item.accountant_name}</p>
                  <p className="text-xs text-muted-foreground font-[Inter]" dir="ltr" style={{ textAlign: 'right' }}>{item.accountant_email}</p>
                  <p className="text-[10px] text-muted-foreground font-cairo mt-1">
                    {item.is_active ? `🟢 ${tr('نشط', 'Actif')}` : '⚪ معطّل'} · {new Date(item.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 flex-row-reverse">
                <Button variant="outline" size="sm" onClick={() => copyLink(item)} className="flex-1 gap-1.5 font-cairo">
                  {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {tr('نسخ الرابط', 'Copier le lien')}
                </Button>
                <Button
                  variant="outline" size="sm" onClick={() => handleToggle(item)}
                  className={cn("gap-1.5 font-cairo", item.is_active ? "text-amber-600 border-amber-300" : "text-green-600 border-green-300")}
                >
                  <Power className="h-3.5 w-3.5" />
                  {item.is_active ? tr('تعطيل', 'Désactiver') : 'تفعيل'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(item)} className="gap-1.5 text-destructive border-destructive/30 font-cairo">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AccountantAccessSection;
