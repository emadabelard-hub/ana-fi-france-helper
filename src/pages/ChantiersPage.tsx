import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Search, ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/auth/AuthModal';

interface ChantierRow {
  id: string;
  name: string;
  site_address: string | null;
  status: string;
  created_at: string;
  client_id: string;
  client_name?: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  archived: 'bg-muted text-muted-foreground border-border',
};

const ChantiersPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('active');
  const [showAuth, setShowAuth] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    supabase
      .rpc('is_admin', { _user_id: user.id })
      .then(({ data }) => setIsAdmin(data === true))
      .catch(() => setIsAdmin(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const chantiersQuery = supabase
        .from('chantiers')
        .select('*')
        .order('created_at', { ascending: false });

      const clientsQuery = supabase
        .from('clients')
        .select('id, name');

      if (!isAdmin) {
        chantiersQuery.eq('user_id', user.id);
        clientsQuery.eq('user_id', user.id);
      }

      const [{ data: ch }, { data: cl }] = await Promise.all([chantiersQuery, clientsQuery]);
      const clientMap: Record<string, string> = {};
      cl?.forEach(c => { clientMap[c.id] = c.name; });
      setChantiers((ch || []).map(c => ({ ...c, client_name: clientMap[c.client_id] || '' })));
      setLoading(false);
    })();
  }, [user, isAdmin]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <HardHat className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">{isRTL ? 'سجل الدخول لإدارة الورشات' : 'Connectez-vous pour gérer vos chantiers'}</p>
        <Button onClick={() => setShowAuth(true)}>{isRTL ? 'تسجيل الدخول' : 'Se connecter'}</Button>
        <AuthModal open={showAuth} onOpenChange={setShowAuth} />
      </div>
    );
  }

  const filtered = chantiers.filter(c =>
    c.status === tab &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || (c.client_name || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      <section className={cn("flex items-center gap-3 py-4 shrink-0", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <HardHat className="h-5 w-5 text-amber-600" />
        </div>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn("text-lg font-bold text-foreground", isRTL && "font-cairo")}>{isRTL ? 'الورشات' : 'Chantiers'}</h1>
          <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL ? `${chantiers.length} ورشة` : `${chantiers.length} chantier${chantiers.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="mb-3">
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">{isRTL ? 'نشط' : 'Actifs'}</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">{isRTL ? 'مكتمل' : 'Terminés'}</TabsTrigger>
          <TabsTrigger value="archived" className="flex-1">{isRTL ? 'أرشيف' : 'Archivés'}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={isRTL ? 'بحث...' : 'Rechercher...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">{isRTL ? 'جاري التحميل...' : 'Chargement...'}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <HardHat className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد ورشات' : 'Aucun chantier'}</p>
          </div>
        ) : (
          filtered.map(ch => (
            <Card key={ch.id} className="cursor-pointer hover:shadow-md transition-all border-border/50" onClick={() => navigate(`/chantiers/${ch.id}`)}>
              <CardContent className="p-4">
                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <HardHat className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                    <h3 className="font-semibold text-foreground text-sm truncate">{ch.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{ch.client_name}</p>
                    {ch.site_address && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" /> {ch.site_address}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[ch.status] || '')}>
                    {ch.status === 'active' ? (isRTL ? 'نشط' : 'Actif') : ch.status === 'completed' ? (isRTL ? 'مكتمل' : 'Terminé') : (isRTL ? 'أرشيف' : 'Archivé')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ChantiersPage;
