import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Users, Loader2, Calendar, Globe, ArrowLeft, Mail, Phone, Building2,
  MapPin, FileText, Receipt, Activity, AlertTriangle, Hash, Briefcase,
} from 'lucide-react';

interface UserListItem {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  credits_balance: number;
  daily_message_count: number;
  last_ip?: string | null;
}

interface FullProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  siret: string | null;
  code_naf: string | null;
  company_address: string | null;
  address: string | null;
  legal_status: string | null;
  numero_tva: string | null;
  created_at: string;
}

interface DocRow {
  id: string;
  document_number: string;
  document_type: string;
  status: string;
  payment_status: string;
  total_ttc: number;
  client_name: string;
  created_at: string;
}

interface ActivityRow {
  id: string;
  action: string;
  page: string;
  created_at: string;
  metadata: any;
  ip_address: string | null;
}

const UsersManager = ({ isRTL }: { isRTL: boolean }) => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<UserListItem | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('admin_user_list')
        .select('id, user_id, full_name, created_at, updated_at, credits_balance, daily_message_count')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        setIsLoading(false);
        return;
      }

      const userIds = (data || []).map(u => u.user_id).filter(Boolean) as string[];
      const ipMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: ipData } = await supabase
          .from('user_activity_logs')
          .select('user_id, ip_address')
          .in('user_id', userIds)
          .not('ip_address', 'is', null)
          .order('created_at', { ascending: false });
        if (ipData) {
          for (const row of ipData) {
            if (row.user_id && row.ip_address && !ipMap[row.user_id]) {
              ipMap[row.user_id] = row.ip_address;
            }
          }
        }
      }

      setUsers((data || []).map(u => ({ ...u, last_ip: u.user_id ? ipMap[u.user_id] || null : null } as UserListItem)));
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

  if (selected) {
    return <UserDetailView user={selected} isRTL={isRTL} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className={cn(isRTL && "text-right")}>
              <p className="text-3xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'إجمالي المستخدمين' : 'Total Users'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={cn("text-lg", isRTL && "text-right font-cairo")}>
            {isRTL ? 'قائمة المستخدمين' : 'User List'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className={cn("text-center text-muted-foreground py-8", isRTL && "font-cairo")}>
              {isRTL ? 'لا يوجد مستخدمين بعد' : 'No users yet'}
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelected(user)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left",
                    isRTL && "flex-row-reverse text-right"
                  )}
                >
                  <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">
                        {(user.full_name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className={cn(isRTL && "text-right")}>
                      <p className="font-medium text-sm">
                        {user.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.daily_message_count} {isRTL ? 'رسالة اليوم' : 'msgs today'}
                      </p>
                    </div>
                  </div>
                  <div className={cn("text-right space-y-1", isRTL && "text-left")}>
                    {user.last_ip && (
                      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
                        <Globe className="h-3 w-3" />
                        <span className="font-mono">{user.last_ip}</span>
                      </div>
                    )}
                    <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-medium text-primary">
                      {user.credits_balance} {isRTL ? 'رصيد' : 'credits'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ---------------- User Detail View ----------------
const UserDetailView = ({ user, isRTL, onBack }: { user: UserListItem; isRTL: boolean; onBack: () => void }) => {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [devis, setDevis] = useState<DocRow[]>([]);
  const [factures, setFactures] = useState<DocRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [errors, setErrors] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: docs }, { data: act }] = await Promise.all([
        supabase.from('profiles').select(
          'user_id, full_name, email, phone, company_name, siret, code_naf, company_address, address, legal_status, numero_tva, created_at'
        ).eq('user_id', user.user_id).maybeSingle(),
        supabase.from('documents_comptables').select(
          'id, document_number, document_type, status, payment_status, total_ttc, client_name, created_at'
        ).eq('user_id', user.user_id).order('created_at', { ascending: false }).limit(200),
        supabase.from('user_activity_logs').select(
          'id, action, page, created_at, metadata, ip_address'
        ).eq('user_id', user.user_id).order('created_at', { ascending: false }).limit(100),
      ]);

      setProfile((prof as FullProfile) || null);
      const allDocs = (docs as DocRow[]) || [];
      setDevis(allDocs.filter(d => d.document_type === 'devis'));
      setFactures(allDocs.filter(d => d.document_type === 'facture'));
      const allAct = (act as ActivityRow[]) || [];
      setActivity(allAct);
      setErrors(allAct.filter(a =>
        a.action?.toLowerCase().includes('error') ||
        (a.metadata && (a.metadata.error || a.metadata.errorMessage))
      ));
      setLoading(false);
    })();
  }, [user.user_id]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;
  }

  const displayName = profile?.full_name || user.full_name || (isRTL ? 'بدون اسم' : 'Sans nom');
  const email = profile?.email;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> {isRTL ? 'رجوع' : 'Retour'}
        </Button>
        {email ? (
          <a href={`mailto:${email}`}>
            <Button size="sm" className="gap-2">
              <Mail className="h-4 w-4" />
              {isRTL ? 'تواصل بالإيميل' : 'Contacter par email'}
            </Button>
          </a>
        ) : (
          <Button size="sm" disabled variant="outline" className="gap-2">
            <Mail className="h-4 w-4" />
            {isRTL ? 'لا يوجد إيميل' : 'Email indisponible'}
          </Button>
        )}
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> {displayName}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <InfoRow icon={<Mail className="h-3 w-3" />} label="Email" value={email} />
          <InfoRow icon={<Phone className="h-3 w-3" />} label="Phone" value={profile?.phone} />
          <InfoRow icon={<Building2 className="h-3 w-3" />} label="Société" value={profile?.company_name} />
          <InfoRow icon={<Briefcase className="h-3 w-3" />} label="Statut" value={profile?.legal_status} />
          <InfoRow icon={<Hash className="h-3 w-3" />} label="SIRET" value={profile?.siret} />
          <InfoRow icon={<Hash className="h-3 w-3" />} label="NAF" value={profile?.code_naf} />
          <InfoRow icon={<Hash className="h-3 w-3" />} label="N° TVA" value={profile?.numero_tva} />
          <InfoRow icon={<MapPin className="h-3 w-3" />} label="Adresse société" value={profile?.company_address} />
          <InfoRow icon={<MapPin className="h-3 w-3" />} label="Adresse perso" value={profile?.address} />
          <InfoRow icon={<Calendar className="h-3 w-3" />} label="Inscrit le" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR') : null} />
        </CardContent>
      </Card>

      {/* Devis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> {isRTL ? 'الدوافيه' : 'Devis'} ({devis.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devis.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{isRTL ? 'لا يوجد' : 'Aucun'}</p>
          ) : (
            <DocsList docs={devis} />
          )}
        </CardContent>
      </Card>

      {/* Factures */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4" /> {isRTL ? 'الفواتير' : 'Factures'} ({factures.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {factures.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{isRTL ? 'لا يوجد' : 'Aucune'}</p>
          ) : (
            <DocsList docs={factures} />
          )}
        </CardContent>
      </Card>

      {/* Errors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> {isRTL ? 'الأخطاء' : 'Erreurs rencontrées'} ({errors.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{isRTL ? 'لا توجد أخطاء' : 'Aucune erreur'}</p>
          ) : (
            <div className="space-y-1.5">
              {errors.slice(0, 30).map(e => (
                <div key={e.id} className="text-xs p-2 rounded bg-destructive/5 border border-destructive/20">
                  <div className="flex justify-between gap-2">
                    <span className="font-mono text-destructive truncate">{e.action}</span>
                    <span className="text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString('fr-FR')}</span>
                  </div>
                  {e.page && <p className="text-muted-foreground truncate">{e.page}</p>}
                  {e.metadata?.error && <p className="text-[10px] text-muted-foreground truncate">{String(e.metadata.error)}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> {isRTL ? 'سجل النشاط' : 'Historique d\'activité'} ({activity.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{isRTL ? 'لا يوجد نشاط' : 'Aucune activité'}</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {activity.map(a => (
                <div key={a.id} className="text-xs p-2 rounded bg-muted/40 flex justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{a.action}</span>
                    {a.page && <span className="text-muted-foreground"> · {a.page}</span>}
                  </div>
                  <span className="text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString('fr-FR')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) => (
  <div className="flex items-start gap-1.5 p-1.5 rounded bg-muted/30">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="font-medium truncate">{value || '—'}</p>
    </div>
  </div>
);

const DocsList = ({ docs }: { docs: DocRow[] }) => (
  <div className="space-y-1.5">
    {docs.map(d => (
      <div key={d.id} className="text-xs p-2 rounded bg-muted/40 flex justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono font-medium truncate">{d.document_number}</p>
          <p className="text-muted-foreground truncate">{d.client_name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold">{Number(d.total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
          <div className="flex gap-1 justify-end">
            <Badge variant="outline" className="text-[9px] h-4 px-1">{d.status}</Badge>
            <Badge variant="outline" className="text-[9px] h-4 px-1">{d.payment_status}</Badge>
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default UsersManager;
