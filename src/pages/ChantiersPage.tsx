import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Search, ArrowLeft, ArrowRight, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

const ChantiersPage = () => {
  const { isRTL } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('etude');
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ name: '', client_id: '', site_address: '', status: 'etude' });
  const [saving, setSaving] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user || user.is_anonymous) {
      setIsAdmin(true);
      return;
    }

    (async () => {
      const { data } = await supabase.rpc('is_admin', { _user_id: user.id });
      setIsAdmin(data === true);
    })();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const chantiersQuery = supabase.from('chantiers').select('*').order('created_at', { ascending: false });
    const clientsQuery = supabase.from('clients').select('id, name');
    if (!isAdmin) {
      chantiersQuery.eq('user_id', user!.id);
      clientsQuery.eq('user_id', user!.id);
    }
    const [{ data: ch }, { data: cl }] = await Promise.all([chantiersQuery, clientsQuery]);
    const clientMap: Record<string, string> = {};
    (cl || []).forEach(c => { clientMap[c.id] = c.name; });
    setClients(cl || []);
    setChantiers((ch || []).map(c => ({ ...c, client_name: clientMap[c.client_id] || '' })));
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
  }, [user, isAdmin, authLoading]);

  const handleSave = async () => {
    if (!user || !form.name.trim() || !form.client_id) return;
    setSaving(true);
    const { error } = await supabase.from('chantiers').insert({
      user_id: user.id,
      name: form.name.trim(),
      client_id: form.client_id,
      site_address: form.site_address.trim() || null,
      status: form.status,
    });
    setSaving(false);
    if (error) {
      toast({ title: isRTL ? 'خطأ' : 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: isRTL ? 'تم الحفظ بنجاح' : 'Chantier enregistré avec succès ✓' });
    setShowForm(false);
    setForm({ name: '', client_id: '', site_address: '', status: 'etude' });
    fetchData();
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">Session invitée indisponible.</p>
      </div>
    );
  }

  const tabStatuses: Record<string, string[]> = {
    etude: ['etude', 'devis_envoye'],
    en_cours_travaux: ['en_cours_travaux'],
    facture_envoyee: ['facture_envoyee', 'paiement_attente', 'facture_payee'],
  };
  const filtered = chantiers.filter(c =>
    (tabStatuses[tab] || []).includes(c.status) &&
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
          <h1 className={cn("text-lg font-bold text-foreground", isRTL && "font-cairo")}>{isRTL ? 'مشاريعي (الشانتيات)' : 'Chantiers'}</h1>
          <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL ? `${chantiers.length} مشروع` : `${chantiers.length} chantier${chantiers.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" />
          {isRTL ? 'مشروع جديد' : 'Nouveau Projet'}
        </Button>
      </section>

      <Tabs value={tab} onValueChange={setTab} className="mb-3">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="etude" className="text-xs">{isRTL ? 'قيد الدراسة' : 'Étude'}</TabsTrigger>
          <TabsTrigger value="en_cours_travaux" className="text-xs">{isRTL ? 'قيد التنفيذ' : 'En cours'}</TabsTrigger>
          <TabsTrigger value="facture_envoyee" className="text-xs">{isRTL ? 'فواتير' : 'Factures'}</TabsTrigger>
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
            <p className="text-sm text-muted-foreground">{isRTL ? 'لا توجد مشاريع' : 'Aucun chantier'}</p>
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
                    <p className="text-xs text-muted-foreground truncate">
                      {(ch as any).reference_number && <span className="font-mono text-[10px] mr-1.5">{(ch as any).reference_number}</span>}
                      {ch.client_name}
                    </p>
                    {ch.site_address && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" /> {ch.site_address}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[ch.status] || '')}>
                    {isRTL ? (statusLabels[ch.status]?.ar || ch.status) : (statusLabels[ch.status]?.fr || ch.status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'مشروع جديد' : 'Nouveau Projet'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{isRTL ? 'اسم المشروع' : 'Nom du projet'}</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Rénovation Cuisine - Client X" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{isRTL ? 'العميل' : 'Client lié'}</label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر العميل' : 'Sélectionner un client'} /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{isRTL ? 'عنوان الموقع' : 'Adresse du chantier'}</label>
              <Input value={form.site_address} onChange={e => setForm(f => ({ ...f, site_address: e.target.value }))} placeholder="Ex: 12 Rue de Paris, 75015" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{isRTL ? 'الحالة' : 'Statut'}</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{isRTL ? 'جاري' : 'En cours'}</SelectItem>
                  <SelectItem value="completed">{isRTL ? 'مكتمل' : 'Terminé'}</SelectItem>
                  <SelectItem value="devis_envoye">{isRTL ? 'تقدير مُرسل' : 'Devis envoyé'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.client_id} className="w-full">
              {saving ? (isRTL ? 'جاري الحفظ...' : 'Enregistrement...') : (isRTL ? 'حفظ المشروع' : 'Enregistrer le chantier')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChantiersPage;
