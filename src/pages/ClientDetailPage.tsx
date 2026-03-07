import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, HardHat, MapPin, Phone, Mail, Building2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AdminLoginModal from '@/components/auth/AdminLoginModal';

interface Chantier {
  id: string;
  name: string;
  site_address: string | null;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  etude: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  devis_envoye: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  en_cours_travaux: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  facture_envoyee: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  paiement_attente: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  facture_payee: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const statusLabels: Record<string, { fr: string; ar: string }> = {
  etude: { fr: 'Étude', ar: 'قيد الدراسة' },
  devis_envoye: { fr: 'Devis envoyé', ar: 'تم ارسال الدوفي' },
  en_cours_travaux: { fr: 'En cours de travaux', ar: 'قيد التنفيذ' },
  facture_envoyee: { fr: 'Facture envoyée', ar: 'تم ارسال الفاتورة' },
  paiement_attente: { fr: 'Paiement en attente', ar: 'فاتورة قيد التحصيل' },
  facture_payee: { fr: 'Facture payée', ar: 'تم تحصيل الفاتورة' },
};

const ClientDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<any>(null);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChantier, setEditingChantier] = useState<Chantier | null>(null);
  const [form, setForm] = useState({ name: '', site_address: '', status: 'etude' });
  const [isRealAdmin, setIsRealAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    if (!user || user.is_anonymous) { setIsRealAdmin(false); return; }
    (async () => {
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      setIsRealAdmin(data === true);
    })();
  }, [user]);

  const fetchData = async () => {
    if (!user || !id) return;
    setLoading(true);
    const [{ data: clientData }, { data: chantiersData }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('chantiers').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ]);
    setClient(clientData);
    setChantiers(chantiersData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, id]);

  const handleSave = async () => {
    if (!user || !id || !form.name.trim()) return;
    if (editingChantier) {
      await supabase.from('chantiers').update({ name: form.name, site_address: form.site_address || null, status: form.status }).eq('id', editingChantier.id);
      toast({ title: isRTL ? 'تم التعديل' : 'Chantier modifié' });
    } else {
      await supabase.from('chantiers').insert({ user_id: user.id, client_id: id, name: form.name, site_address: form.site_address || null, status: form.status });
      toast({ title: isRTL ? 'تم الإضافة' : 'Chantier ajouté' });
    }
    setShowForm(false);
    setEditingChantier(null);
    setForm({ name: '', site_address: '', status: 'active' });
    fetchData();
  };

  const handleDelete = async (chantierId: string) => {
    await supabase.from('chantiers').delete().eq('id', chantierId);
    toast({ title: isRTL ? 'تم الحذف' : 'Chantier supprimé' });
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground animate-pulse">{isRTL ? 'جاري التحميل...' : 'Chargement...'}</div>;
  }

  if (!client) {
    return <div className="text-center py-12 text-muted-foreground">{isRTL ? 'العميل غير موجود' : 'Client introuvable'}</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <section className={cn("flex items-center gap-3 py-4 shrink-0", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')} className="shrink-0">
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xl font-bold text-primary">{client.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
          <h1 className={cn("text-lg font-bold text-foreground truncate", isRTL && "font-cairo")}>{client.name}</h1>
          {client.siret && <p className="text-xs text-muted-foreground">SIRET: {client.siret}</p>}
        </div>
      </section>

      {/* Client Info Card */}
      <Card className="mb-4 border-border/50">
        <CardContent className="p-4 space-y-2 text-sm">
          {client.address && (
            <div className={cn("flex items-center gap-2 text-muted-foreground", isRTL && "flex-row-reverse")}>
              <MapPin className="h-4 w-4 shrink-0" /> <span>{client.address}</span>
            </div>
          )}
          {client.contact_phone && (
            <div className={cn("flex items-center gap-2 text-muted-foreground", isRTL && "flex-row-reverse")}>
              <Phone className="h-4 w-4 shrink-0" /> <span>{client.contact_phone}</span>
            </div>
          )}
          {client.contact_email && (
            <div className={cn("flex items-center gap-2 text-muted-foreground", isRTL && "flex-row-reverse")}>
              <Mail className="h-4 w-4 shrink-0" /> <span>{client.contact_email}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chantiers Header */}
      <div className={cn("flex items-center justify-between mb-3", isRTL && "flex-row-reverse")}>
        <h2 className={cn("text-base font-semibold text-foreground", isRTL && "font-cairo")}>
          <HardHat className="h-4 w-4 inline mr-1.5" />
          {isRTL ? 'مشاريعي (الشانتيات)' : 'Chantiers'} ({chantiers.length})
        </h2>
        <Button size="sm" variant="outline" onClick={() => { setEditingChantier(null); setForm({ name: '', site_address: '', status: 'active' }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> {isRTL ? 'مشروع جديد' : 'Nouveau'}
        </Button>
      </div>

      {/* Chantiers List */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {chantiers.length === 0 ? (
          <div className="text-center py-8">
            <HardHat className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد مشاريع' : 'Aucun chantier'}</p>
          </div>
        ) : (
          chantiers.map(ch => (
            <Card key={ch.id} className="cursor-pointer hover:shadow-md transition-all border-border/50" onClick={() => navigate(`/chantiers/${ch.id}`)}>
              <CardContent className="p-4">
                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <HardHat className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                    <h3 className="font-semibold text-foreground text-sm truncate">{ch.name}</h3>
                    {(ch as any).reference_number && <p className="text-[10px] text-muted-foreground font-mono">{(ch as any).reference_number}</p>}
                    {ch.site_address && <p className="text-xs text-muted-foreground truncate mt-0.5">{ch.site_address}</p>}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[ch.status] || '')}>
                    {ch.status === 'active' ? (isRTL ? 'جاري' : 'En cours') : ch.status === 'completed' ? (isRTL ? 'مكتمل' : 'Terminé') : ch.status === 'devis_envoye' ? (isRTL ? 'تقدير مُرسل' : 'Devis envoyé') : (isRTL ? 'أرشيف' : 'Archivé')}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditingChantier(ch); setForm({ name: ch.name, site_address: ch.site_address || '', status: ch.status }); setShowForm(true); }}>
                        <Pencil className="h-4 w-4 mr-2" /> {isRTL ? 'تعديل' : 'Modifier'}
                      </DropdownMenuItem>
                      {isRealAdmin && (
                        <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); handleDelete(ch.id); }}>
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

      {/* Chantier Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className={cn("max-w-md", isRTL && "font-cairo")}>
          <DialogHeader>
            <DialogTitle className={cn(isRTL && "text-right")}>
              {editingChantier ? (isRTL ? 'تعديل المشروع' : 'Modifier le chantier') : (isRTL ? 'مشروع جديد' : 'Nouveau chantier')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder={isRTL ? 'اسم المشروع *' : 'Nom du chantier *'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder={isRTL ? 'عنوان الموقع' : 'Adresse du site'} value={form.site_address} onChange={e => setForm(f => ({ ...f, site_address: e.target.value }))} />
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{isRTL ? 'جاري' : 'En cours'}</SelectItem>
                <SelectItem value="completed">{isRTL ? 'مكتمل' : 'Terminé'}</SelectItem>
                <SelectItem value="devis_envoye">{isRTL ? 'تقدير مُرسل' : 'Devis envoyé'}</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleSave} disabled={!form.name.trim()}>
              {isRTL ? 'حفظ المشروع' : 'Enregistrer le chantier'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AdminLoginModal open={showAdminLogin} onOpenChange={setShowAdminLogin} onSuccess={() => { setIsRealAdmin(true); setShowAdminLogin(false); }} />
    </div>
  );
};

export default ClientDetailPage;
