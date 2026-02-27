import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Clock, RefreshCw, Search, Smartphone, Monitor, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ActivityLog {
  id: string;
  user_email: string | null;
  is_guest: boolean;
  page: string;
  action: string;
  duration_seconds: number | null;
  session_id: string | null;
  created_at: string;
  device_info: string | null;
}

interface Props {
  isRTL: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  page_view: 'فتح',
  page_exit: 'خرج من',
  session_end: 'أنهى الجلسة',
  feature_click: 'ضغط على',
};

const AnalyticsManager = ({ isRTL }: Props) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d'>('today');
  const [emailFilter, setEmailFilter] = useState('');

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

      let query = supabase
        .from('user_activity_logs')
        .select('*')
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000) as any;

      const { data } = await query;
      setLogs((data as ActivityLog[]) || []);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  // Derived stats
  const filteredLogs = useMemo(() => {
    if (!emailFilter.trim()) return logs;
    const q = emailFilter.toLowerCase();
    return logs.filter(l =>
      l.is_guest ? 'guest'.includes(q) || 'ضيف'.includes(q) : l.user_email?.toLowerCase().includes(q)
    );
  }, [logs, emailFilter]);

  const activeUsers = useMemo(() => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    return new Set(
      logs.filter(l => l.created_at >= fiveMinAgo && l.action === 'page_view').map(l => l.session_id)
    ).size;
  }, [logs]);

  const uniqueUsers = useMemo(() => {
    return new Set(filteredLogs.map(l => l.user_email || l.session_id)).size;
  }, [filteredLogs]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDuration = (sec: number | null) => {
    if (!sec || sec < 1) return '—';
    if (sec < 60) return `${sec}ث`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}د ${s}ث` : `${m}د`;
  };

  const getActionText = (log: ActivityLog) => {
    const label = ACTION_LABELS[log.action] || log.action;
    return `${label} ${log.page}`;
  };

  const getUserLabel = (log: ActivityLog) => {
    if (log.is_guest) return 'ضيف';
    if (!log.user_email) return '—';
    return log.user_email.split('@')[0];
  };

  const getDeviceIcon = (device: string | null) => {
    if (!device) return null;
    if (device === 'Mobile') return <Smartphone className="h-3.5 w-3.5 text-blue-500" />;
    return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap flex-row-reverse">
        {(['today', '7d', '30d'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={dateFilter === f ? 'default' : 'outline'}
            onClick={() => setDateFilter(f)}
            className="text-xs font-cairo"
          >
            {f === 'today' ? 'اليوم' : f === '7d' ? '٧ أيام' : '٣٠ يوم'}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <div className="h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-cairo">متصلون الآن</span>
            </div>
            <p className="text-2xl font-bold font-cairo">{activeUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <Users className="h-4 w-4 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold font-cairo">{uniqueUsers}</p>
            <p className="text-[10px] text-muted-foreground font-cairo">مستخدم</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <Clock className="h-4 w-4 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold font-cairo">{filteredLogs.length}</p>
            <p className="text-[10px] text-muted-foreground font-cairo">حركة</p>
          </CardContent>
        </Card>
      </div>

      {/* Email Filter */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث بالإيميل لتتبع رحلة مستخدم..."
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          className="pr-9 text-right font-cairo text-sm"
        />
        {emailFilter && (
          <button onClick={() => setEmailFilter('')} className="absolute left-3 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Live Activity Feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-right font-cairo flex items-center gap-2 justify-end">
            <span>📡 بث مباشر للنشاط</span>
            {!emailFilter && <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted z-10">
                <tr className="text-right">
                  <th className="px-2 py-2 font-semibold font-cairo">الوقت</th>
                  <th className="px-2 py-2 font-semibold font-cairo">المستخدم</th>
                  <th className="px-2 py-2 font-semibold font-cairo">عمل إيه بالظبط؟</th>
                  <th className="px-2 py-2 font-semibold font-cairo">المدة</th>
                  <th className="px-2 py-2 font-semibold font-cairo w-8">📱</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className={cn(
                      "border-t border-border hover:bg-muted/50 transition-colors",
                      log.action === 'session_end' && "bg-red-50/50 dark:bg-red-900/10",
                      log.action === 'feature_click' && "bg-blue-50/50 dark:bg-blue-900/10"
                    )}
                  >
                    <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                      {formatTime(log.created_at)}
                    </td>
                    <td className="px-2 py-1.5 font-cairo">
                      <button
                        className="text-primary hover:underline truncate max-w-[80px] inline-block"
                        onClick={() => setEmailFilter(log.user_email || '')}
                        title={log.user_email || 'ضيف'}
                      >
                        {getUserLabel(log)}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 font-cairo font-medium">
                      {getActionText(log)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={cn(
                        "inline-flex items-center gap-0.5 font-cairo",
                        log.duration_seconds && log.duration_seconds > 60 && "text-green-600 font-bold"
                      )}>
                        {formatDuration(log.duration_seconds)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {getDeviceIcon(log.device_info)}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground font-cairo">
                      {emailFilter ? 'لا توجد نتائج لهذا البحث' : 'لا توجد بيانات بعد'}
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
