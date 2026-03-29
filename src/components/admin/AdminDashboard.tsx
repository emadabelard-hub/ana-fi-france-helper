import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Users, FileText, Camera, Download, TrendingUp, Clock,
  Activity, Zap, RefreshCw, Loader2, BarChart3, Target,
  UserCheck, AlertTriangle, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DashboardData {
  totalUsers: number;
  activeToday: number;
  activeWeek: number;
  totalDevis: number;
  totalFactures: number;
  totalAnalyses: number;
  totalPdfExports: number;
  aiUsagePercent: number;
  aiToDevisConversion: number;
  timeSavedMinutes: number;
  topFeature: string;
  abandonRate: number;
  recentActivity: ActivityItem[];
  topUsers: TopUser[];
}

interface ActivityItem {
  id: string;
  user_email: string | null;
  action: string;
  page: string;
  created_at: string;
}

interface TopUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_activity: string;
  devis_count: number;
  analyses_count: number;
}

const ACTION_LABELS: Record<string, string> = {
  page_view: '👁️ Visite page',
  feature_click: '🖱️ Click feature',
  session_end: '🔚 Fin session',
  page_exit: '↩️ Sortie page',
};

const PAGE_LABELS: Record<string, string> = {
  '/': 'Accueil',
  '/smart-devis': 'Smart Devis',
  '/document-hub': 'Documents',
  '/assistant': 'Assistant IA',
  '/pro/cv-generator': 'CV',
  '/expenses': 'Comptabilité',
  '/clients': 'Clients',
  '/chantiers': 'Chantiers',
  '/profile': 'Profil',
};

const AdminDashboard = ({ isRTL }: { isRTL: boolean }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllUsers, setShowAllUsers] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

      // Parallel queries
      const [
        usersRes,
        activityTodayRes,
        activityWeekRes,
        devisRes,
        facturesRes,
        analysesRes,
        pdfRes,
        recentRes,
        allActivityRes,
      ] = await Promise.all([
        supabase.from('admin_user_list').select('*'),
        supabase.from('user_activity_logs').select('user_id').gte('created_at', todayStart),
        supabase.from('user_activity_logs').select('user_id').gte('created_at', weekStart),
        supabase.from('documents_comptables').select('id, user_id, created_at').eq('document_type', 'devis'),
        supabase.from('documents_comptables').select('id, user_id, created_at').eq('document_type', 'facture'),
        supabase.from('user_activity_logs').select('id, user_id, user_email, created_at').eq('page', '/smart-devis').eq('action', 'feature_click'),
        supabase.from('user_activity_logs').select('id').ilike('action', '%pdf%'),
        supabase.from('user_activity_logs').select('id, user_email, action, page, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('user_activity_logs').select('action, page, user_id, user_email, created_at').gte('created_at', weekStart),
      ]);

      const users = usersRes.data || [];
      const activityToday = activityTodayRes.data || [];
      const activityWeek = activityWeekRes.data || [];
      const devis = devisRes.data || [];
      const factures = facturesRes.data || [];
      const analyses = analysesRes.data || [];
      const pdfs = pdfRes.data || [];
      const recent = recentRes.data || [];
      const allActivity = allActivityRes.data || [];

      // Unique active users
      const activeTodayUnique = new Set(activityToday.map(a => a.user_id).filter(Boolean)).size;
      const activeWeekUnique = new Set(activityWeek.map(a => a.user_id).filter(Boolean)).size;

      // AI usage
      const totalActions = allActivity.length || 1;
      const analysisCount = analyses.length;
      const aiUsagePercent = Math.round((analysisCount / totalActions) * 100);

      // AI → Devis conversion
      const analysisUserIds = new Set(analyses.map(a => a.user_id).filter(Boolean));
      const devisAfterAnalysis = devis.filter(d => analysisUserIds.has(d.user_id)).length;
      const aiToDevisConversion = analysisCount > 0 ? Math.round((devisAfterAnalysis / analysisCount) * 100) : 0;

      // Time saved (10 min per analysis)
      const timeSavedMinutes = analysisCount * 10;

      // Top feature
      const pageCounts: Record<string, number> = {};
      allActivity.forEach(a => {
        if (a.action === 'feature_click' || a.action === 'page_view') {
          pageCounts[a.page] = (pageCounts[a.page] || 0) + 1;
        }
      });
      const topFeature = Object.entries(pageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      // Abandon rate (sessions with only 1 page view)
      const sessionPages: Record<string, Set<string>> = {};
      allActivity.forEach(a => {
        const uid = a.user_id || a.user_email || 'anon';
        if (!sessionPages[uid]) sessionPages[uid] = new Set();
        if (a.action === 'page_view') sessionPages[uid].add(a.page);
      });
      const totalSessions = Object.keys(sessionPages).length || 1;
      const singlePageSessions = Object.values(sessionPages).filter(s => s.size <= 1).length;
      const abandonRate = Math.round((singlePageSessions / totalSessions) * 100);

      // Top users: build from activity + docs
      const userMap: Record<string, TopUser> = {};
      allActivity.forEach(a => {
        const uid = a.user_id || 'unknown';
        if (!userMap[uid]) {
          userMap[uid] = {
            user_id: uid,
            email: a.user_email,
            full_name: null,
            created_at: '',
            last_activity: a.created_at || '',
            devis_count: 0,
            analyses_count: 0,
          };
        }
        if (a.created_at && a.created_at > userMap[uid].last_activity) {
          userMap[uid].last_activity = a.created_at;
        }
        if (a.page === '/smart-devis' && a.action === 'feature_click') {
          userMap[uid].analyses_count++;
        }
      });
      devis.forEach(d => {
        if (userMap[d.user_id]) userMap[d.user_id].devis_count++;
      });
      // Enrich with profile data
      users.forEach(u => {
        if (u.user_id && userMap[u.user_id]) {
          userMap[u.user_id].full_name = u.full_name;
          userMap[u.user_id].created_at = u.created_at || '';
        }
      });

      const topUsers = Object.values(userMap)
        .filter(u => u.user_id !== 'unknown')
        .sort((a, b) => (b.devis_count + b.analyses_count) - (a.devis_count + a.analyses_count))
        .slice(0, 20);

      setData({
        totalUsers: users.length,
        activeToday: activeTodayUnique,
        activeWeek: activeWeekUnique,
        totalDevis: devis.length,
        totalFactures: factures.length,
        totalAnalyses: analysisCount,
        totalPdfExports: pdfs.length,
        aiUsagePercent,
        aiToDevisConversion,
        timeSavedMinutes,
        topFeature,
        abandonRate,
        recentActivity: recent as ActivityItem[],
        topUsers,
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}min`;
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getActivityLabel = (item: ActivityItem) => {
    const page = PAGE_LABELS[item.page] || item.page;
    if (item.action === 'feature_click') return `🖱️ ${item.user_email?.split('@')[0] || 'User'} → ${page}`;
    if (item.action === 'page_view') return `👁️ ${item.user_email?.split('@')[0] || 'User'} a visité ${page}`;
    if (item.action === 'session_end') return `🔚 ${item.user_email?.split('@')[0] || 'User'} fin de session`;
    return `${ACTION_LABELS[item.action] || item.action} — ${page}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">📊 Dashboard</h2>
        <Button variant="outline" size="sm" onClick={fetchDashboard} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* KPI Row 1: Users & Docs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<Users className="h-5 w-5" />} label="Utilisateurs" value={data.totalUsers} color="blue" />
        <KPICard icon={<UserCheck className="h-5 w-5" />} label="Actifs aujourd'hui" value={data.activeToday} color="green" />
        <KPICard icon={<FileText className="h-5 w-5" />} label="Devis créés" value={data.totalDevis} color="amber" />
        <KPICard icon={<Camera className="h-5 w-5" />} label="Analyses IA" value={data.totalAnalyses} color="violet" />
      </div>

      {/* KPI Row 2: Intelligence */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<Zap className="h-5 w-5" />} label="% Utilisation IA" value={`${data.aiUsagePercent}%`} color="cyan" />
        <KPICard icon={<Target className="h-5 w-5" />} label="Conversion IA→Devis" value={`${data.aiToDevisConversion}%`} color="emerald" />
        <KPICard icon={<Clock className="h-5 w-5" />} label="Temps économisé" value={formatTime(data.timeSavedMinutes)} color="orange" />
        <KPICard icon={<Download className="h-5 w-5" />} label="PDF exportés" value={data.totalPdfExports} color="indigo" />
      </div>

      {/* Behavior Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Feature #1</p>
                <p className="font-bold text-sm">{PAGE_LABELS[data.topFeature] || data.topFeature}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taux d'abandon</p>
                <p className="font-bold text-sm">{data.abandonRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actifs cette semaine</p>
                <p className="font-bold text-sm">{data.activeWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activité récente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune activité</p>
            ) : (
              data.recentActivity.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                  <span className="truncate flex-1">{getActivityLabel(item)}</span>
                  <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">{formatDate(item.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Users */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Utilisateurs ({data.topUsers.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAllUsers(!showAllUsers)}>
              {showAllUsers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(showAllUsers ? data.topUsers : data.topUsers.slice(0, 5)).map(user => (
              <div key={user.user_id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.full_name || user.email?.split('@')[0] || user.user_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{user.email || '-'}</p>
                </div>
                <div className="flex items-center gap-3 ml-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {user.devis_count} devis
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {user.analyses_count} analyses
                  </Badge>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDate(user.last_activity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reset Section */}
      <Card className="border-destructive/30">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">🗑️ Reset statistiques</p>
              <p className="text-xs text-muted-foreground">Supprimer les logs d'activité</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1">
                  <Trash2 className="h-3 w-3" />
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va supprimer tous les logs d'activité. Les documents et utilisateurs ne seront pas affectés.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={async () => {
                      await supabase.from('user_activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                      await supabase.from('visit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                      fetchDashboard();
                    }}
                  >
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// KPI Card sub-component
const KPICard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-1.5 rounded-lg', colorMap[color])}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground truncate">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminDashboard;
