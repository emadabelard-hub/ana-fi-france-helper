import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Send, Loader2, FileText, MessageCircle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import { toast } from 'sonner';

interface ServiceRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  price_eur: number;
  ai_requirements: string | null;
  specialist_notes: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'paid', label: 'مدفوع', labelFr: 'Payé' },
  { value: 'in_progress', label: 'جاري التنفيذ', labelFr: 'En cours' },
  { value: 'needs_info', label: 'محتاج معلومات', labelFr: 'Infos requises' },
  { value: 'completed', label: 'تم', labelFr: 'Terminé' },
];

const ServiceRequestsManager = ({ isRTL }: { isRTL: boolean }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchRequests(); }, []);

  useEffect(() => {
    if (!selected) return;
    fetchMessages(selected.id);
    const channel = supabase
      .channel(`admin-messages-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'request_messages',
        filter: `request_id=eq.${selected.id}`,
      }, (payload) => setMessages(prev => [...prev, payload.new as ChatMessage]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('service_requests').select('*').order('created_at', { ascending: false });
    setRequests((data as ServiceRequest[]) || []);
    setIsLoading(false);
  };

  const fetchMessages = async (id: string) => {
    const { data } = await supabase.from('request_messages').select('*').eq('request_id', id).order('created_at', { ascending: true });
    setMessages((data as ChatMessage[]) || []);
  };

  const handleStatusChange = async (status: string) => {
    if (!selected) return;
    await supabase.from('service_requests').update({ status }).eq('id', selected.id);
    setSelected({ ...selected, status });
    setRequests(prev => prev.map(r => r.id === selected.id ? { ...r, status } : r));
    toast.success('Status updated');
  };

  const handleSendChat = async () => {
    if (!user || !selected || !chatInput.trim()) return;
    setIsSending(true);
    await supabase.from('request_messages').insert({
      request_id: selected.id,
      sender_id: user.id,
      sender_role: 'specialist',
      content: chatInput.trim(),
    });
    setChatInput('');
    setIsSending(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <Clock size={14} className="text-blue-500" />;
      case 'in_progress': return <Loader2 size={14} className="text-blue-500 animate-spin" />;
      case 'needs_info': return <AlertCircle size={14} className="text-orange-500" />;
      case 'completed': return <CheckCircle2 size={14} className="text-green-500" />;
      default: return <Clock size={14} className="text-yellow-500" />;
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← {isRTL ? 'رجوع' : 'Retour'}</Button>
          <Select value={selected.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{isRTL ? s.label : s.labelFr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Request details */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-bold text-sm">{selected.title}</h3>
            <p className="text-xs text-muted-foreground">{selected.description}</p>
            {selected.ai_requirements && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-semibold mb-1">🤖 AI Requirements:</p>
                <MarkdownRenderer content={selected.ai_requirements} isRTL={false} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat */}
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
              <MessageCircle size={14} /> {isRTL ? 'المحادثة' : 'Chat'}
            </h4>
            <div className="max-h-[300px] overflow-y-auto space-y-2 mb-3">
              {messages.map(msg => (
                <div key={msg.id} className={cn("flex", msg.sender_role === 'specialist' ? 'justify-end' : 'justify-start')}>
                  <div className={cn("max-w-[80%] rounded-xl p-2 text-xs", msg.sender_role === 'specialist' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                    <span className="font-bold block text-[10px] opacity-70 mb-0.5">
                      {msg.sender_role === 'specialist' ? '👨‍💼' : '👤'}
                    </span>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2">
              <Textarea value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Reply..." className="min-h-[36px] max-h-[60px] resize-none text-xs"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              />
              <Button size="icon" onClick={handleSendChat} disabled={isSending || !chatInput.trim()}>
                {isSending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className={cn("text-sm font-bold", isRTL && "font-cairo text-right")}>
        {isRTL ? `الطلبات (${requests.length})` : `Demandes (${requests.length})`}
      </h3>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? 'لا توجد طلبات' : 'Aucune demande'}</p>
      ) : (
        requests.map(req => (
          <Card key={req.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelected(req)}>
            <CardContent className="p-3 flex items-center gap-3">
              {getStatusIcon(req.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{req.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(req.created_at).toLocaleDateString('fr-FR')} — {req.price_eur}€
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">{req.status}</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default ServiceRequestsManager;
