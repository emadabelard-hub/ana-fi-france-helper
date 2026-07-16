import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Users, Loader2, Calendar, Mail, Clock, LogIn } from 'lucide-react';

interface UserRow {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
  email: string | null;
  last_login_at: string | null;
  login_count: number;
}

interface UsersManagerProps {
  isRTL: boolean;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const fmtDateTime = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const UsersManager = ({ isRTL }: UsersManagerProps) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setLoadError(null);

      const { data: baseUsers, error: baseErr } = await supabase
        .from('admin_user_list')
        .select('id, user_id, full_name, created_at')
        .order('created_at', { ascending: false });

      if (baseErr) {
        console.error('admin_user_list error:', baseErr);
        setLoadError(baseErr.message);
        setIsLoading(false);
        return;
      }

      const userIds = (baseUsers || []).map((u) => u.user_id).filter(Boolean) as string[];

      // Emails from profiles (user-supplied; fallback source).
      const emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesRows } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);
        for (const row of profilesRows || []) {
          if (row.user_id && row.email) emailMap[row.user_id] = row.email;
        }
      }

      // Connection stats from admin_connection_logs (admin-only table).
      const lastLoginMap: Record<string, string> = {};
      const loginCountMap: Record<string, number> = {};
      const authEmailMap: Record<string, string> = {};

      const { data: logRows, error: logsErr } = await supabase
        .from('admin_connection_logs')
        .select('user_id, email, event, created_at')
        .eq('event', 'login_success')
        .order('created_at', { ascending: false });

      if (logsErr) {
        console.warn('admin_connection_logs error (non-fatal):', logsErr);
      } else {
        for (const row of logRows || []) {
          if (!row.user_id) continue;
          loginCountMap[row.user_id] = (loginCountMap[row.user_id] || 0) + 1;
          if (!lastLoginMap[row.user_id]) lastLoginMap[row.user_id] = row.created_at;
          if (row.email && !authEmailMap[row.user_id]) authEmailMap[row.user_id] = row.email;
        }
      }

      const rows: UserRow[] = (baseUsers || []).map((u) => ({
        id: u.id,
        user_id: u.user_id,
        full_name: u.full_name,
        created_at: u.created_at,
        email: authEmailMap[u.user_id] || emailMap[u.user_id] || null,
        last_login_at: lastLoginMap[u.user_id] || null,
        login_count: loginCountMap[u.user_id] || 0,
      }));

      setUsers(rows);
      setIsLoading(false);
    };

    fetchUsers();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className={cn('text-sm text-destructive', isRTL && 'text-right font-cairo')}>
            {isRTL ? 'خطأ في تحميل المستخدمين' : 'Erreur de chargement des utilisateurs'} : {loadError}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardContent className="pt-6">
          <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className={cn(isRTL && 'text-right')}>
              <p className="text-3xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'إجمالي المستخدمين' : 'Total utilisateurs'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className={cn('text-lg', isRTL && 'text-right font-cairo')}>
            {isRTL ? 'قائمة المستخدمين' : 'Liste des utilisateurs'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className={cn('text-center text-muted-foreground py-8', isRTL && 'font-cairo')}>
              {isRTL ? 'لا يوجد مستخدمين بعد' : 'Aucun utilisateur'}
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-lg border bg-card p-3 hover:bg-muted/40 transition-colors"
                  dir="ltr"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-semibold text-sm truncate">
                        {user.full_name || <span className="text-muted-foreground italic">Sans nom</span>}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate font-mono">{user.email || '—'}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>
                            Inscrit : <span className="text-foreground font-medium">{fmtDate(user.created_at)}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>
                            Dern. connexion :{' '}
                            <span className="text-foreground font-medium">
                              {fmtDateTime(user.last_login_at)}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <LogIn className="h-3 w-3 shrink-0" />
                          <span>
                            Connexions :{' '}
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              {user.login_count}
                            </Badge>
                          </span>
                        </div>
                      </div>

                      {/* Phase 2 placeholders — infrastructure not yet in place */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Statut : —
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Abonnement : —
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Paiement : —
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersManager;
