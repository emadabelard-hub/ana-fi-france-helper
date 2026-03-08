import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Building2, ArrowLeft, ArrowRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AdminLoginModal from '@/components/auth/AdminLoginModal';

interface Client {
  id: string;
  name: string;
  client_type: string;
  company_name: string | null;
  siret: string | null;
  tva_number: string | null;
  address: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_b2b: boolean;
  created_at: string;
  chantiers_count?: number;
}

const ClientsPage = () => {
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: '', client_type: 'particulier', company_name: '', siret: '', tva_number: '', street: '', postal_code: '', city: '', contact_name: '', contact_phone: '', contact_email: '' });

  const [isAdmin, setIsAdmin] = useState(false);
  const [isRealAdmin, setIsRealAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    if (!user || user.is_anonymous) {
      setIsAdmin(true);
      setIsRealAdmin(false);
      return;
    }

    (async () => {
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      setIsAdmin(data === true);
      setIsRealAdmin(data === true);
    })();
  }, [user]);

  const fetchClients = async () => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const clientsQuery = supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    const chantiersQuery = supabase
      .from('chantiers')
      .select('client_id');

    if (!isAdmin) {
      clientsQuery.eq('user_id', user.id);
      chantiersQuery.eq('user_id', user.id);
    }

    const [{ data }, { data: chantiers }] = await Promise.all([clientsQuery, chantiersQuery]);

    if (data) {
      const counts: Record<string, number> = {};
      chantiers?.forEach(c => { counts[c.client_id] = (counts[c.client_id] || 0) + 1; });
      setClients(data.map(c => ({ ...c, chantiers_count: counts[c.id] || 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, [user, isAdmin, authLoading]);

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    const composedAddress = [form.street, form.postal_code, form.city].filter(Boolean).join(', ');
    const payload: any = {
      name: form.name,
      client_type: form.client_type,
      company_name: form.company_name || null,
      siret: form.siret || null,
      tva_number: form.tva_number || null,
      is_b2b: form.client_type === 'professionnel',
      address: composedAddress || null,
      street: form.street || null,
      postal_code: form.postal_code || null,
      city: form.city || null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
    };
    if (editingClient) {
      await supabase.from('clients').update(payload).eq('id', editingClient.id);
      toast({ title: isRTL ? 'تم التعديل' : 'Client modifié' });
    } else {
      await supabase.from('clients').insert({ ...payload, user_id: user.id });
      toast({ title: isRTL ? 'تم الإضافة' : 'Client ajouté' });
    }
    setShowForm(false);
    setEditingClient(null);
    setForm({ name: '', client_type: 'particulier', company_name: '', siret: '', tva_number: '', street: '', postal_code: '', city: '', contact_name: '', contact_phone: '', contact_email: '' });
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('clients').delete().eq('id', id);
    toast({ title: isRTL ? 'تم الحذف' : 'Client supprimé' });
    fetchClients();
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setForm({ name: c.name, client_type: c.client_type || 'particulier', company_name: c.company_name || '', siret: c.siret || '', tva_number: c.tva_number || '', street: c.street || '', postal_code: c.postal_code || '', city: c.city || '', contact_name: c.contact_name || '', contact_phone: c.contact_phone || '', contact_email: c.contact_email || '' });
    setShowForm(true);
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">{isRTL ? 'Chargement...' : 'Chargement...'}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">{isRTL ? 'Session invitée indisponible.' : 'Session invitée indisponible.'}</p>
      </div>
    );
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.siret && c.siret.includes(search))
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <section className={cn("flex items-center gap-3 py-4 shrink-0", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn("text-lg font-bold text-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'العملاء' : 'Clients'}
          </h1>
          <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL ? `${clients.length} عميل` : `${clients.length} client${clients.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditingClient(null); setForm({ name: '', client_type: 'particulier', company_name: '', siret: '', tva_number: '', street: '', postal_code: '', city: '', contact_name: '', contact_phone: '', contact_email: '' }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          {isRTL ? 'إضافة' : 'Ajouter'}
        </Button>
      </section>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={isRTL ? 'بحث بالاسم أو SIRET...' : 'Rechercher par nom ou SIRET...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">
            {isRTL ? 'جاري التحميل...' : 'Chargement...'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">
              {isRTL ? 'لا يوجد عملاء بعد' : 'Aucun client pour le moment'}
            </p>
          </div>
        ) : (
          filtered.map(client => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-md transition-all border-border/50"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              <CardContent className="p-4">
                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-lg font-bold text-primary">{client.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                    <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {client.siret && <span>SIRET: {client.siret}</span>}
                      {client.chantiers_count! > 0 && (
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                          {client.chantiers_count} {isRTL ? 'مشروع' : 'chantier(s)'}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(client); }}>
                        <Pencil className="h-4 w-4 mr-2" /> {isRTL ? 'تعديل' : 'Modifier'}
                      </DropdownMenuItem>
                      {isRealAdmin && (
                        <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); handleDelete(client.id); }}>
                          <Trash2 className="h-4 w-4 mr-2" /> {isRTL ? 'حذف' : 'Supprimer'}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className={cn("max-w-md", isRTL && "font-cairo")}>
          <DialogHeader>
            <DialogTitle className={cn(isRTL && "text-right")}>
              {editingClient
                ? (isRTL ? 'تعديل العميل' : 'Modifier le client')
                : (isRTL ? 'إضافة عميل جديد' : 'Nouveau client')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <Input placeholder={isRTL ? 'اسم العميل *' : 'Nom du client *'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            
            {/* Client Type */}
            <div className="space-y-1.5">
              <label className={cn("text-sm font-medium", isRTL && "font-cairo block text-right")}>
                {isRTL ? 'الصفة' : 'Statut'}
              </label>
              <select
                value={form.client_type}
                onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))}
                className="w-full bg-background border border-border text-foreground text-sm rounded-md p-2"
              >
                <option value="particulier">{isRTL ? 'شخص عادي (Particulier)' : 'Particulier'}</option>
                <option value="professionnel">{isRTL ? 'شركة (Professionnel)' : 'Professionnel'}</option>
              </select>
            </div>

            {form.client_type === 'professionnel' && (
              <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                <Input placeholder={isRTL ? 'اسم الشركة (Raison Sociale)' : 'Raison Sociale'} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                <Input placeholder={isRTL ? 'SIRET (14 رقم)' : 'SIRET (14 chiffres)'} value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value.replace(/\D/g, '').slice(0, 14) }))} maxLength={14} className="font-mono" />
                <Input placeholder={isRTL ? 'رقم TVA (مثال: FR 12 345678901)' : 'N° TVA Intracommunautaire'} value={form.tva_number} onChange={e => setForm(f => ({ ...f, tva_number: e.target.value }))} className="font-mono" />
                <p className={cn("text-[10px] text-muted-foreground", isRTL && "font-cairo text-right")}>
                  💡 {isRTL ? 'مطلوب للفاتورة الإلكترونية (Factur-X 2026)' : 'Requis pour la facturation électronique (Factur-X 2026)'}
                </p>
              </div>
            )}

            {/* Split address */}
            <div className="space-y-1.5">
              <label className={cn("text-sm font-medium", isRTL && "font-cairo block text-right")}>
                {isRTL ? 'العنوان الكامل' : 'Adresse complète'}
              </label>
              <Input placeholder={isRTL ? 'الشارع (Rue)' : 'Rue'} value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={isRTL ? 'الرمز البريدي' : 'Code Postal'} value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value.replace(/\D/g, '').slice(0, 5) }))} maxLength={5} className="font-mono" />
                <Input placeholder={isRTL ? 'المدينة (Ville)' : 'Ville'} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
            </div>

            <Input placeholder={isRTL ? 'جهة الاتصال' : 'Contact'} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            <Input placeholder={isRTL ? 'الهاتف' : 'Téléphone'} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
            <Input placeholder="Email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
            <Button className="w-full" onClick={handleSave} disabled={!form.name.trim()}>
              {editingClient ? (isRTL ? 'حفظ التعديلات' : 'Enregistrer') : (isRTL ? 'إضافة' : 'Ajouter')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AdminLoginModal open={showAdminLogin} onOpenChange={setShowAdminLogin} onSuccess={() => { setIsRealAdmin(true); setShowAdminLogin(false); }} />
    </div>
  );
};

export default ClientsPage;