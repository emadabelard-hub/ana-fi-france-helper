import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, Clock, AlertCircle, Mail, Building2, MessageSquare, Send, Reply } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface SupportTicket {
  id: string;
  user_id: string;
  message: string;
  user_email: string | null;
  user_siret: string | null;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'جديد', labelFr: 'Nouveau' },
  { value: 'in_review', label: 'قيد المراجعة', labelFr: 'En révision' },
  { value: 'resolved', label: 'تم الحل', labelFr: 'Résolu' },
  { value: 'dismissed', label: 'مرفوض', labelFr: 'Rejeté' },
];

const SupportTicketsManager = ({ isRTL }: { isRTL: boolean }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => { fetchTickets(); }, []);

  const fetchTickets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching tickets:', error);
      toast.error(isRTL ? 'خطأ في تحميل التذاكر' : 'Erreur de chargement');
    }
    setTickets((data as SupportTicket[]) || []);
    setIsLoading(false);
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus })
      .eq('id', ticketId);
    if (error) {
      toast.error(isRTL ? 'خطأ في التحديث' : 'Erreur de mise à jour');
      return;
    }
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    if (selected?.id === ticketId) setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    toast.success(isRTL ? 'تم تحديث الحالة' : 'Statut mis à jour');
  };

  const handleSendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setIsSending(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          admin_reply: replyText.trim(), 
          replied_at: now,
          status: 'resolved'
        })
        .eq('id', selected.id);
      if (error) throw error;

      // Update local state
      const updated = { ...selected, admin_reply: replyText.trim(), replied_at: now, status: 'resolved' };
      setSelected(updated);
      setTickets(prev => prev.map(t => t.id === selected.id ? updated : t));
      setReplyText('');
      toast.success(isRTL ? 'تم إرسال الرد وحفظه ✅' : 'Réponse envoyée et sauvegardée ✅');

      // Send email notification via edge function
      if (selected.user_email) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-ticket-reply`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              ticket_id: selected.id,
              user_email: selected.user_email,
              admin_reply: replyText.trim(),
              original_message: selected.message,
            }),
          });
        } catch (emailErr) {
          console.warn('Email notification failed (non-blocking):', emailErr);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? 'خطأ في إرسال الرد' : 'Erreur d\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <AlertCircle size={14} className="text-blue-500" />;
      case 'in_review': return <Clock size={14} className="text-orange-500" />;
      case 'resolved': return <CheckCircle2 size={14} className="text-emerald-500" />;
      case 'dismissed': return <AlertCircle size={14} className="text-red-500" />;
      default: return <Clock size={14} className="text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'resolved': return 'secondary';
      default: return 'outline';
    }
  };

  const filteredTickets = filterStatus === 'all' 
    ? tickets 
    : tickets.filter(t => t.status === filterStatus);

  const statusCounts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  if (selected) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          ← {isRTL ? 'رجوع' : 'Retour'}
        </Button>

        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Header with status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" />
                <span className="font-bold text-sm">{isRTL ? 'تفاصيل التذكرة' : 'Détails du ticket'}</span>
              </div>
              <Select value={selected.status} onValueChange={(v) => handleStatusChange(selected.id, v)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {isRTL ? s.label : s.labelFr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {selected.user_email && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail size={12} />
                  <span className="truncate">{selected.user_email}</span>
                </div>
              )}
              {selected.user_siret && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 size={12} />
                  <span>{selected.user_siret}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <Clock size={12} />
                <span>{new Date(selected.created_at).toLocaleString('fr-FR')}</span>
              </div>
            </div>

            {/* User message */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                {isRTL ? '💬 رسالة المستخدم' : '💬 Message utilisateur'}
              </p>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-sm whitespace-pre-wrap leading-relaxed font-cairo" dir="auto">
                  {selected.message}
                </p>
              </div>
            </div>

            {/* Existing admin reply */}
            {selected.admin_reply && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Reply size={10} />
                  {isRTL ? 'رد الأدمين' : 'Réponse admin'}
                  {selected.replied_at && (
                    <span className="font-normal">— {new Date(selected.replied_at).toLocaleString('fr-FR')}</span>
                  )}
                </p>
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" dir="auto">
                    {selected.admin_reply}
                  </p>
                </div>
              </div>
            )}

            {/* Reply form */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Reply size={12} className="text-primary" />
                {isRTL ? (selected.admin_reply ? 'تعديل الرد' : 'اكتب الرد') : (selected.admin_reply ? 'Modifier la réponse' : 'Rédiger une réponse')}
              </label>
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={isRTL ? 'اكتب ردك هنا يا ريس...' : 'Écrivez votre réponse...'}
                className="min-h-[80px] text-sm resize-none"
                dir="auto"
              />
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleSendReply} 
                  disabled={!replyText.trim() || isSending}
                  className="gap-2"
                  size="sm"
                >
                  {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {isRTL ? 'إرسال الرد' : 'Envoyer'}
                </Button>
                {selected.user_email && (
                  <span className="text-[10px] text-muted-foreground">
                    📧 {isRTL ? `سيتم إشعار ${selected.user_email}` : `Notification à ${selected.user_email}`}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className={cn("text-sm font-bold flex-1", isRTL && "font-cairo text-right")}>
          {isRTL ? `تذاكر الدعم (${tickets.length})` : `Tickets support (${tickets.length})`}
        </h3>
        <div className="flex gap-1 flex-wrap">
          <Badge 
            variant={filterStatus === 'all' ? 'default' : 'outline'} 
            className="cursor-pointer text-[10px]"
            onClick={() => setFilterStatus('all')}
          >
            {isRTL ? 'الكل' : 'Tous'} ({tickets.length})
          </Badge>
          {STATUS_OPTIONS.map(s => (
            <Badge 
              key={s.value}
              variant={filterStatus === s.value ? 'default' : 'outline'}
              className="cursor-pointer text-[10px]"
              onClick={() => setFilterStatus(s.value)}
            >
              {isRTL ? s.label : s.labelFr} ({statusCounts[s.value] || 0})
            </Badge>
          ))}
        </div>
      </div>

      {/* Tickets list */}
      {filteredTickets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {isRTL ? 'لا توجد تذاكر' : 'Aucun ticket'}
        </p>
      ) : (
        filteredTickets.map(ticket => (
          <Card 
            key={ticket.id} 
            className="cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => { setSelected(ticket); setReplyText(ticket.admin_reply || ''); }}
          >
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                {getStatusIcon(ticket.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2 font-cairo" dir="auto">{ticket.message}</p>
                  {ticket.admin_reply && (
                    <p className="text-[10px] text-primary mt-0.5 flex items-center gap-1">
                      <Reply size={10} /> {isRTL ? 'تم الرد' : 'Répondu'}
                    </p>
                  )}
                </div>
                <Badge variant={getStatusBadgeVariant(ticket.status) as any} className="text-[10px] shrink-0">
                  {isRTL 
                    ? STATUS_OPTIONS.find(s => s.value === ticket.status)?.label || ticket.status
                    : STATUS_OPTIONS.find(s => s.value === ticket.status)?.labelFr || ticket.status
                  }
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{new Date(ticket.created_at).toLocaleDateString('fr-FR')}</span>
                {ticket.user_email && <span className="truncate max-w-[150px]">{ticket.user_email}</span>}
                {ticket.user_siret && <span>SIRET: {ticket.user_siret}</span>}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default SupportTicketsManager;
