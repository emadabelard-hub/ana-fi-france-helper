import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Clock, Eye, RefreshCw, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ActivityLog {
  id: string;
  user_email: string | null;
  is_guest: boolean;
  page: string;
  action: string;
  duration_seconds: number | null;
  session_id: string | null;
  created_at: string;
}

interface Props {
  isRTL: boolean;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(45, 93%, 47%)',
  'hsl(0, 84%, 60%)',
  'hsl(200, 80%, 50%)',
  'hsl(140, 60%, 45%)',
  'hsl(280, 60%, 55%)',
  'hsl(20, 90%, 55%)',
  'hsl(170, 60%, 45%)',
];

const AnalyticsManager = ({ isRTL }: Props) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState(0);
  const [popularPages, setPopularPages] = useState<{ name: string; count: number }[]>([]);
  const [totalToday, setTotalToday] = useState(0);
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d'>('today');

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let fromDate: Date;
      if (dateFilter === 'today') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateFilter === '7d') {
        fromDate = new Date(now.getTime() - 7 * 86400000);
      } else {
        fromDate = new Date(now.getTime() - 30 * 86400000);
      }

      // Fetch logs
      const { data: logsData } = await supabase
        .from('user_activity_logs')
        .select('*')
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500) as any;

      const typedLogs: ActivityLog[] = logsData || [];
      setLogs(typedLogs);

      // Calculate active users (unique sessions in last 5 minutes)
      const fiveMinAgo = new Date(now.getTime() - 5 * 60000).toISOString();
      const recentSessions = new Set(
        typedLogs
          .filter((l) => l.created_at >= fiveMinAgo && l.action === 'page_view')
          .map((l) => l.session_id)
      );
      setActiveUsers(recentSessions.size);

      // Popular pages
      const pageCount: Record<string, number> = {};
      typedLogs
        .filter((l) => l.action === 'page_view')
        .forEach((l) => {
          pageCount[l.page] = (pageCount[l.page] || 0) + 1;
        });
      const sorted = Object.entries(pageCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setPopularPages(sorted);

      // Total today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      setTotalToday(
        typedLogs.filter((l) => l.created_at >= todayStart && l.action === 'page_view').length
      );
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (sec: number | null) => {
    if (!sec || sec < 1) return '-';
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      page_view: '👁️ زيارة',
      page_exit: '🚪 خروج',
      session_end: '🔴 إنهاء جلسة',
    };
    return map[action] || action;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date filter + Refresh */}
      <div className={cn("flex items-center gap-2 flex-wrap", isRTL && "flex-row-reverse")}>
        {(['today', '7d', '30d'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={dateFilter === f ? 'default' : 'outline'}
            onClick={() => setDateFilter(f)}
            className={cn("text-xs", isRTL && "font-cairo")}
          >
            {f === 'today' ? (isRTL ? 'اليوم' : "Aujourd'hui") : f === '7d' ? (isRTL ? '٧ أيام' : '7 jours') : isRTL ? '٣٠ يوم' : '30 jours'}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="py-3 text-center">
            <Users className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className={cn("text-2xl font-bold", isRTL && "font-cairo")}>{activeUsers}</p>
            <p className={cn("text-[10px] text-muted-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'متصلون الآن' : 'En ligne'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <Eye className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className={cn("text-2xl font-bold", isRTL && "font-cairo")}>{totalToday}</p>
            <p className={cn("text-[10px] text-muted-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'زيارات اليوم' : "Vues aujourd'hui"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className={cn("text-2xl font-bold", isRTL && "font-cairo")}>{popularPages[0]?.count || 0}</p>
            <p className={cn("text-[10px] text-muted-foreground truncate", isRTL && "font-cairo")}>
              {popularPages[0]?.name || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Popular Features Chart */}
      {popularPages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-sm", isRTL && "text-right font-cairo")}>
              {isRTL ? '📊 الأدوات الأكثر استخداماً' : '📊 Outils les plus utilisés'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={popularPages} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 10, fontFamily: 'Cairo' }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}`, isRTL ? 'زيارات' : 'Visites']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {popularPages.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Activity Log Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className={cn("text-sm", isRTL && "text-right font-cairo")}>
            {isRTL ? '📋 سجل النشاط التفصيلي' : '📋 Journal d\'activité'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr className={cn(isRTL && "text-right")}>
                  <th className="px-2 py-1.5 font-semibold">{isRTL ? 'الوقت' : 'Heure'}</th>
                  <th className="px-2 py-1.5 font-semibold">{isRTL ? 'المستخدم' : 'Utilisateur'}</th>
                  <th className="px-2 py-1.5 font-semibold">{isRTL ? 'الإجراء' : 'Action'}</th>
                  <th className="px-2 py-1.5 font-semibold">{isRTL ? 'المدة' : 'Durée'}</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 100).map((log) => (
                  <tr key={log.id} className="border-t border-border hover:bg-muted/50">
                    <td className="px-2 py-1 whitespace-nowrap">{formatTime(log.created_at)}</td>
                    <td className="px-2 py-1 truncate max-w-[100px]">
                      {log.is_guest ? (
                        <span className="text-muted-foreground">{isRTL ? 'ضيف' : 'Invité'}</span>
                      ) : (
                        log.user_email?.split('@')[0] || '—'
                      )}
                    </td>
                    <td className={cn("px-2 py-1", isRTL && "font-cairo")}>
                      <span className="font-medium">{actionLabel(log.action)}</span>
                      <span className="text-muted-foreground mr-1 ml-1">→</span>
                      <span>{log.page}</span>
                    </td>
                    <td className="px-2 py-1">
                      <span className={cn(
                        "inline-flex items-center gap-0.5",
                        log.duration_seconds && log.duration_seconds > 60 && "text-green-600"
                      )}>
                        <Clock className="h-3 w-3" />
                        {formatDuration(log.duration_seconds)}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      {isRTL ? 'لا توجد بيانات بعد' : 'Aucune donnée'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsManager;
