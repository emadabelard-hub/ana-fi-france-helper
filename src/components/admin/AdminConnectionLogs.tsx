import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Search, ShieldCheck, LogIn, LogOut, XCircle, Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  user_id: string | null;
  email: string | null;
  event: 'login_success' | 'login_failure' | 'logout' | 'blocked';
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  country: string | null;
  last_activity_at: string | null;
  created_at: string;
}

const maskIp = (ip: string | null): string => {
  if (!ip) return '—';
  // IPv4
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return `${v4[1]}.${v4[2]}.xxx.xxx`;
  // IPv6: keep first 2 groups
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 2).join(':')}:xxxx:xxxx`;
  }
  return ip.slice(0, 6) + '…';
};

const eventBadge = (event: Row['event'], isRTL: boolean) => {
  const map: Record<Row['event'], { label: string; labelAr: string; className: string; Icon: typeof LogIn }> = {
    login_success: { label: 'Succès', labelAr: 'نجاح', className: 'bg-emerald-100 text-emerald-800 border-emerald-300', Icon: LogIn },
    login_failure: { label: 'Échec', labelAr: 'فشل', className: 'bg-red-100 text-red-800 border-red-300', Icon: XCircle },
    logout: { label: 'Déconnexion', labelAr: 'خروج', className: 'bg-slate-100 text-slate-800 border-slate-300', Icon: LogOut },
    blocked: { label: 'Bloqué', labelAr: 'محجوب', className: 'bg-amber-100 text-amber-900 border-amber-300', Icon: ShieldCheck },
  };
  const { label, labelAr, className, Icon } = map[event];
  return (
    <Badge variant="outline" className={cn('gap-1 border', className)}>
      <Icon className="h-3 w-3" />
      {isRTL ? labelAr : label}
    </Badge>
  );
};

const deviceIcon = (device: string | null) => {
  if (device === 'mobile') return <Smartphone className="h-4 w-4" />;
  if (device === 'tablet') return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
};

interface Props {
  isRTL: boolean;
}

const AdminConnectionLogs = ({ isRTL }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | Row['event']>('all');
  const [periodFilter, setPeriodFilter] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from('admin_connection_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (periodFilter !== 'all') {
        const now = new Date();
        const delta = periodFilter === '24h' ? 1 : periodFilter === '7d' ? 7 : 30;
        const since = new Date(now.getTime() - delta * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte('created_at', since);
      }
      if (eventFilter !== 'all') q = q.eq('event', eventFilter);
      if (emailFilter.trim()) q = q.ilike('email', `%${emailFilter.trim().toLowerCase()}%`);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data as Row[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter, eventFilter]);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();
    const distinctUsersToday = new Set(
      rows.filter((r) => r.created_at >= todayIso && r.event === 'login_success' && r.user_id).map((r) => r.user_id!),
    );
    const successes24h = rows.filter((r) => {
      const dt = Date.parse(r.created_at);
      return r.event === 'login_success' && dt > Date.now() - 24 * 3600 * 1000;
    }).length;
    const failures24h = rows.filter((r) => {
      const dt = Date.parse(r.created_at);
      return r.event === 'login_failure' && dt > Date.now() - 24 * 3600 * 1000;
    }).length;
    return { usersToday: distinctUsersToday.size, successes24h, failures24h };
  }, [rows]);

  return (
    <div className={cn('space-y-4', isRTL && 'font-cairo')} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{isRTL ? 'مستخدمون اليوم' : 'Utilisateurs uniques (aujourd’hui)'}</div><div className="text-2xl font-bold">{stats.usersToday}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{isRTL ? 'اتصالات ناجحة (24س)' : 'Connexions réussies (24 h)'}</div><div className="text-2xl font-bold text-emerald-700">{stats.successes24h}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{isRTL ? 'محاولات فاشلة (24س)' : 'Échecs (24 h)'}</div><div className="text-2xl font-bold text-red-700">{stats.failures24h}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isRTL ? 'سجل الاتصالات' : 'Journal des connexions'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">{isRTL ? 'بحث بالبريد' : 'Rechercher par e-mail'}</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
                  placeholder="exemple@domaine.com"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{isRTL ? 'الفترة' : 'Période'}</label>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as typeof periodFilter)}>
                <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 h</SelectItem>
                  <SelectItem value="7d">7 j</SelectItem>
                  <SelectItem value="30d">30 j</SelectItem>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'Tout'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{isRTL ? 'الحالة' : 'Statut'}</label>
              <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as typeof eventFilter)}>
                <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'Tous'}</SelectItem>
                  <SelectItem value="login_success">{isRTL ? 'نجاح' : 'Succès'}</SelectItem>
                  <SelectItem value="login_failure">{isRTL ? 'فشل' : 'Échec'}</SelectItem>
                  <SelectItem value="logout">{isRTL ? 'خروج' : 'Déconnexion'}</SelectItem>
                  <SelectItem value="blocked">{isRTL ? 'محجوب' : 'Bloqué'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {isRTL ? 'تحديث' : 'Actualiser'}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">{isRTL ? 'لا توجد سجلات' : 'Aucune entrée'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">{isRTL ? 'التاريخ' : 'Date'}</th>
                    <th className="text-left py-2 px-2">{isRTL ? 'البريد' : 'E-mail'}</th>
                    <th className="text-left py-2 px-2">{isRTL ? 'الحالة' : 'Statut'}</th>
                    <th className="text-left py-2 px-2">{isRTL ? 'الجهاز' : 'Appareil'}</th>
                    <th className="text-left py-2 px-2">{isRTL ? 'المتصفح' : 'Navigateur'}</th>
                    <th className="text-left py-2 px-2">IP</th>
                    <th className="text-left py-2 px-2">{isRTL ? 'البلد' : 'Pays'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 px-2 whitespace-nowrap tabular-nums">{new Date(r.created_at).toLocaleString('fr-FR')}</td>
                      <td className="py-2 px-2">{r.email ?? '—'}</td>
                      <td className="py-2 px-2">{eventBadge(r.event, isRTL)}</td>
                      <td className="py-2 px-2"><span className="inline-flex items-center gap-1">{deviceIcon(r.device_type)}<span className="capitalize">{r.device_type ?? '—'}</span></span></td>
                      <td className="py-2 px-2 max-w-[220px] truncate" title={r.user_agent ?? ''}>{r.user_agent ?? '—'}</td>
                      <td className="py-2 px-2 tabular-nums">{maskIp(r.ip_address)}</td>
                      <td className="py-2 px-2">{r.country ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminConnectionLogs;
