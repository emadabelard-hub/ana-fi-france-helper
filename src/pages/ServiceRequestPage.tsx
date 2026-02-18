import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Send, Upload, Loader2, Clock, CheckCircle2, FileText, ImagePlus, ShieldCheck, ArrowLeft, ArrowRight, MessageCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import AuthModal from '@/components/auth/AuthModal';
import { toast } from 'sonner';

interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  price_eur: number;
  ai_requirements: string | null;
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

const STATUS_MAP: Record<string, { label_ar: string; label_fr: string; color: string }> = {
  pending_payment: { label_ar: 'في انتظار الدفع', label_fr: 'En attente de paiement', color: 'bg-yellow-500' },
  paid: { label_ar: 'مدفوع - جاري التنفيذ', label_fr: 'Payé - En cours', color: 'bg-blue-500' },
  in_progress: { label_ar: 'جاري التنفيذ', label_fr: 'En cours', color: 'bg-blue-500' },
  needs_info: { label_ar: 'محتاجين معلومات إضافية', label_fr: 'Infos supplémentaires requises', color: 'bg-orange-500' },
  completed: { label_ar: 'تم بنجاح ✅', label_fr: 'Terminé ✅', color: 'bg-green-500' },
};

const ServiceRequestPage = () => {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  
  // New request state
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [requirements, setRequirements] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // History state
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // Fetch user requests
  useEffect(() => {
    if (user) fetchRequests();
  }, [user]);

  // Realtime messages
  useEffect(() => {
    if (!selectedRequest) return;
    fetchMessages(selectedRequest.id);

    const channel = supabase
      .channel(`request-messages-${selectedRequest.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'request_messages',
        filter: `request_id=eq.${selectedRequest.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedRequest?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRequests = async () => {
    setIsLoadingRequests(true);
    const { data } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRequests((data as ServiceRequest[]) || []);
    setIsLoadingRequests(false);
  };

  const fetchMessages = async (requestId: string) => {
    const { data } = await supabase
      .from('request_messages')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    setMessages((data as ChatMessage[]) || []);
  };

  const handleAnalyze = async () => {
    if (!user) { setShowAuth(true); return; }
    if (!description.trim()) return;
    setIsAnalyzing(true);
    try {
      const session = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-service-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ description, language }),
      });
      if (!resp.ok) throw new Error('Analysis failed');
      const data = await resp.json();
      setRequirements(data.requirements);
    } catch {
      toast.error(isRTL ? 'حصل مشكلة في التحليل' : 'Erreur d\'analyse');
    }
    setIsAnalyzing(false);
  };

  const handleSubmitRequest = async () => {
    if (!user) { setShowAuth(true); return; }
    setIsSubmitting(true);
    try {
      const title = description.slice(0, 100);
      const { data, error } = await supabase.from('service_requests').insert({
        user_id: user.id,
        title,
        description,
        ai_requirements: requirements,
        price_eur: 4.00,
        status: 'pending_payment',
      }).select().single();

      if (error) throw error;

      // Simulate payment (will be replaced with Stripe later)
      const { error: updateError } = await supabase
        .from('service_requests')
        .update({ status: 'paid' })
        .eq('id', (data as ServiceRequest).id);

      if (updateError) throw updateError;

      // Log transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        service_name: isRTL ? 'خدمة إدارية متخصصة' : 'Service administratif spécialisé',
        service_key: 'admin_service',
        price_eur: 4.00,
      });

      toast.success(isRTL ? 'تم إرسال طلبك بنجاح! هنرد عليك خلال 48 ساعة يا فندم' : 'Demande envoyée ! Réponse sous 48h');
      setDescription('');
      setRequirements('');
      fetchRequests();
      setActiveTab('history');
    } catch {
      toast.error(isRTL ? 'حصل مشكلة' : 'Erreur');
    }
    setIsSubmitting(false);
  };

  const handleSendChat = async () => {
    if (!user || !selectedRequest || !chatInput.trim()) return;
    setIsSendingChat(true);
    try {
      await supabase.from('request_messages').insert({
        request_id: selectedRequest.id,
        sender_id: user.id,
        sender_role: 'user',
        content: chatInput.trim(),
      });
      setChatInput('');
    } catch {
      toast.error(isRTL ? 'مشكلة في الإرسال' : 'Erreur d\'envoi');
    }
    setIsSendingChat(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRequest || !user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? 'الملف كبير أوي (الحد 10 ميجا)' : 'Fichier trop grand (max 10 Mo)');
      return;
    }

    const path = `${user.id}/${selectedRequest.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('request-files').upload(path, file);
    if (error) {
      toast.error(isRTL ? 'مشكلة في الرفع' : 'Erreur d\'upload');
      return;
    }

    await supabase.from('request_files').insert({
      request_id: selectedRequest.id,
      uploaded_by: user.id,
      file_name: file.name,
      file_url: path,
      file_type: file.type.startsWith('image') ? 'image' : 'pdf',
    });

    // Send a chat message about the file
    await supabase.from('request_messages').insert({
      request_id: selectedRequest.id,
      sender_id: user.id,
      sender_role: 'user',
      content: `📎 ${isRTL ? 'تم رفع ملف' : 'Fichier uploadé'}: ${file.name}`,
    });

    toast.success(isRTL ? 'تم رفع الملف' : 'Fichier uploadé');
    e.target.value = '';
  };

  const getStatusInfo = (status: string) => STATUS_MAP[status] || STATUS_MAP.pending_payment;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] pb-20">
      {showAuth && <AuthModal open={showAuth} onOpenChange={setShowAuth} />}

      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
          <BackArrow className="h-5 w-5" />
        </Button>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn("text-lg font-black text-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'خدمة متخصصة' : 'Service Spécialisé'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px]">
              {isRTL ? '4€ للخدمة' : '4€ par service'}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/30">
              {isRTL ? 'خلال 48 ساعة' : 'Sous 48h'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-2 max-w-[calc(100%-2rem)]">
          <TabsTrigger value="new" className={cn("gap-1 text-xs", isRTL && "font-cairo")}>
            <Plus size={14} />
            {isRTL ? 'طلب جديد' : 'Nouvelle demande'}
          </TabsTrigger>
          <TabsTrigger value="history" className={cn("gap-1 text-xs", isRTL && "font-cairo")}>
            <Clock size={14} />
            {isRTL ? 'طلباتي' : 'Mes demandes'}
            {requests.length > 0 && <span className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] px-1.5">{requests.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* NEW REQUEST TAB */}
        <TabsContent value="new" className="flex-1 overflow-y-auto px-4 py-4 space-y-4 mt-0">
          {/* Security badge */}
          <div className="flex items-center gap-2 bg-accent/10 rounded-xl p-3 border border-accent/20">
            <ShieldCheck size={16} className="text-accent shrink-0" />
            <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-cairo")}>
              {isRTL
                ? 'بياناتك في أمان تام وبتتحذف بعد تنفيذ الخدمة مباشرة'
                : 'Vos données sont sécurisées et supprimées après exécution du service'}
            </p>
          </div>

          {/* 48h badge */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Clock size={20} className="text-primary" />
              </div>
              <div className={cn("flex-1", isRTL && "text-right")}>
                <p className={cn("text-sm font-bold text-foreground", isRTL && "font-cairo")}>
                  {isRTL ? 'خدمة احترافية خلال 48 ساعة' : 'Service professionnel sous 48h'}
                </p>
                <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
                  {isRTL ? 'لضمان الجودة، الدقة، والسرية التامة' : 'Pour garantir qualité, précision et confidentialité'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Description input */}
          <div className="space-y-2">
            <label className={cn("text-sm font-semibold text-foreground", isRTL && "font-cairo block text-right")}>
              {isRTL ? 'اوصف الخدمة اللي محتاجها يا فندم' : 'Décrivez le service dont vous avez besoin'}
            </label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={isRTL ? 'مثال: عايز أقدم على APL في الكاف...' : 'Ex: Je veux faire une demande d\'APL à la CAF...'}
              className={cn("min-h-[100px] resize-none", isRTL && "font-cairo text-right")}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <Button onClick={handleAnalyze} disabled={isAnalyzing || !description.trim()} className="w-full">
              {isAnalyzing ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              {isRTL ? 'حلل طلبي واعرض المطلوب' : 'Analyser ma demande'}
            </Button>
          </div>

          {/* AI Requirements */}
          {requirements && (
            <Card className="border-accent/30 bg-accent/5">
              <CardContent className="p-4 space-y-3">
                <h3 className={cn("text-sm font-bold text-foreground flex items-center gap-2", isRTL && "font-cairo flex-row-reverse")}>
                  <FileText size={16} className="text-accent" />
                  {isRTL ? 'المستندات والمعلومات المطلوبة' : 'Documents et informations requis'}
                </h3>
                <div className={cn(isRTL && "text-right font-cairo")}>
                  <MarkdownRenderer content={requirements} isRTL={isRTL} />
                </div>
                
                {/* Submit & Pay */}
                <div className="pt-3 border-t border-border">
                  <Button onClick={handleSubmitRequest} disabled={isSubmitting} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    {isRTL ? `ابعت الطلب وادفع 4€` : `Envoyer la demande et payer 4€`}
                  </Button>
                  <p className={cn("text-[10px] text-muted-foreground mt-2 text-center", isRTL && "font-cairo")}>
                    {isRTL ? 'وضع تجريبي - لا يتم خصم مبلغ حقيقي' : 'Mode démo - Aucun montant réel débité'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="flex-1 overflow-hidden flex flex-col mt-0">
          {selectedRequest ? (
            // Request detail + chat
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Request header */}
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                  <BackArrow size={16} />
                </Button>
                <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                  <p className={cn("text-sm font-bold truncate", isRTL && "font-cairo")}>{selectedRequest.title}</p>
                  <Badge className={cn("text-[10px]", getStatusInfo(selectedRequest.status).color)}>
                    {isRTL ? getStatusInfo(selectedRequest.status).label_ar : getStatusInfo(selectedRequest.status).label_fr}
                  </Badge>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Show AI requirements as first message */}
                {selectedRequest.ai_requirements && (
                  <div className={cn("flex", isRTL ? "justify-end" : "justify-start")}>
                    <div className="max-w-[85%] bg-muted rounded-2xl p-3">
                      <p className={cn("text-[10px] text-muted-foreground mb-1", isRTL && "font-cairo")}>
                        🤖 {isRTL ? 'تحليل الذكاء الاصطناعي' : 'Analyse IA'}
                      </p>
                      <MarkdownRenderer content={selectedRequest.ai_requirements} isRTL={isRTL} />
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <div key={msg.id} className={cn("flex", msg.sender_role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start'))}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl p-3",
                      msg.sender_role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}>
                      {msg.sender_role === 'specialist' && (
                        <p className="text-[10px] opacity-70 mb-1">👨‍💼 {isRTL ? 'المتخصص' : 'Spécialiste'}</p>
                      )}
                      <p className={cn("text-sm", isRTL && "font-cairo")}>{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat input */}
              <div className="border-t border-border bg-background px-4 py-3">
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
                <div className="flex items-end gap-2">
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={18} />
                  </Button>
                  <Textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder={isRTL ? 'اكتب رسالتك...' : 'Votre message...'}
                    className={cn("min-h-[40px] max-h-[80px] resize-none text-sm", isRTL && "font-cairo text-right")}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  />
                  <Button size="icon" onClick={handleSendChat} disabled={isSendingChat || !chatInput.trim()} className="shrink-0">
                    {isSendingChat ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Requests list
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {isLoadingRequests ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
              ) : requests.length === 0 ? (
                <div className={cn("text-center py-12 space-y-3", isRTL && "font-cairo")}>
                  <FileText size={40} className="mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">
                    {isRTL ? 'مفيش طلبات لسه' : 'Aucune demande pour le moment'}
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab('new')}>
                    {isRTL ? 'ابدأ طلب جديد' : 'Nouvelle demande'}
                  </Button>
                </div>
              ) : (
                requests.map(req => (
                  <Card key={req.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSelectedRequest(req)}>
                    <CardContent className="p-4">
                      <div className={cn("flex items-start justify-between gap-2", isRTL && "flex-row-reverse")}>
                        <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                          <p className={cn("text-sm font-bold truncate", isRTL && "font-cairo")}>{req.title}</p>
                          <p className={cn("text-xs text-muted-foreground mt-1", isRTL && "font-cairo")}>
                            {new Date(req.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR')}
                          </p>
                        </div>
                        <Badge className={cn("text-[10px] shrink-0", getStatusInfo(req.status).color)}>
                          {isRTL ? getStatusInfo(req.status).label_ar : getStatusInfo(req.status).label_fr}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServiceRequestPage;
