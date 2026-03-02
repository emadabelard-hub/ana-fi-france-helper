import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Sparkles, Send, CheckCircle2, MessageCircle, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import SimpleChatInput from '@/components/assistant/SimpleChatInput';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import SimpleTypingIndicator from '@/components/assistant/SimpleTypingIndicator';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MSG = 'أهلاً يا معلم! أؤمرني، محتاج مساعدة في الدوفي، ولا عندك فكرة تخلي التطبيق أحسن؟ 🛠️';

const SupportPage = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isRTL = language === 'ar';

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: INITIAL_MSG },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Suggestion state
  const [suggestion, setSuggestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = async (text: string) => {
    const userMsg: ChatMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > 1 && prev[prev.length - 2]?.role === 'user') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: 'assistant', content: assistantText }];
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch (e) {
      console.error('Support chat error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'عذراً يا معلم، حصل مشكلة. جرب تاني بعد شوية 🙏' }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestion.trim() || !user) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'لازم تسجل دخول وتكتب مقترحك' : 'Connectez-vous et écrivez votre suggestion' });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: ticketData, error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        message: suggestion.trim(),
        user_email: profile?.email || user.email || null,
        user_siret: profile?.siret || null,
      }).select('id').single();
      if (error) throw error;

      // Notify admin(s) about the new ticket
      supabase.functions.invoke('notify-admin-ticket', {
        body: {
          ticketId: ticketData.id,
          userEmail: profile?.email || user.email || null,
          userSiret: profile?.siret || null,
          message: suggestion.trim(),
        },
      }).catch(e => console.error('Admin notification failed:', e));

      setSubmitted(true);
      setSuggestion('');
      setTimeout(() => setSubmitted(false), 4000);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: isRTL ? 'مقدرتش أبعت المقترح' : 'Erreur d\'envoi' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowRight className={cn("h-5 w-5", !isRTL && "rotate-180")} />
          </button>
          <div>
            <h1 className="font-cairo font-bold text-lg text-foreground">
              {isRTL ? 'صوتك مسموع 🎤' : 'Support & Suggestions'}
            </h1>
            <p className="text-xs text-muted-foreground font-cairo">
              {isRTL ? 'نصوح - مساعدك الشخصي' : 'Nossouh - Votre assistant'}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Section */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-emerald-400" />
          <span className="font-cairo font-bold text-sm text-emerald-400">
            {isRTL ? 'اسأل نصوح' : 'Demandez à Nossouh'}
          </span>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="h-[300px] overflow-y-auto p-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mr-2 shrink-0 mt-1">
                    <Sparkles size={14} className="text-emerald-400" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-[13px] leading-relaxed",
                  msg.role === 'user'
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-secondary text-foreground rounded-bl-none"
                )}>
                  {msg.role === 'user' ? (
                    <span className="font-cairo whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <MarkdownRenderer content={msg.content} isRTL={true} />
                  )}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mr-2 shrink-0">
                  <Sparkles size={14} className="text-emerald-400" />
                </div>
                <SimpleTypingIndicator />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <SimpleChatInput
            onSend={handleSend}
            isLoading={isStreaming}
            isRTL={true}
            placeholder={isRTL ? 'اسأل نصوح...' : 'Posez votre question...'}
          />
        </div>
      </div>

      {/* Suggestion Section */}
      <div className="px-4 pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-blue-400" />
          <span className="font-cairo font-bold text-sm text-blue-400">
            {isRTL ? 'مقترحاتك وتطوير التطبيق' : 'Vos suggestions'}
          </span>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          {submitted ? (
            <div className="flex flex-col items-center gap-2 py-6 animate-in fade-in">
              <CheckCircle2 className="h-12 w-12 text-emerald-400 animate-bounce" />
              <p className="font-cairo font-bold text-emerald-400 text-center">
                {isRTL ? 'وصلت يا ريس، جاري المراجعة! 🚀' : 'Reçu ! En cours de révision 🚀'}
              </p>
            </div>
          ) : (
            <>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder={isRTL ? 'اكتب فكرتك أو مقترحك هنا... 💡' : 'Écrivez votre idée ici... 💡'}
                className={cn(
                  "w-full min-h-[100px] bg-secondary rounded-xl p-3 text-sm font-cairo resize-none",
                  "text-foreground placeholder:text-muted-foreground",
                  "border border-border focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                )}
                dir="auto"
              />
              <button
                onClick={handleSubmitSuggestion}
                disabled={!suggestion.trim() || isSubmitting || !user}
                className={cn(
                  "w-full py-3 rounded-xl font-cairo font-bold text-sm flex items-center justify-center gap-2",
                  "transition-all active:scale-[0.97]",
                  suggestion.trim() && !isSubmitting && user
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Send size={16} />
                {isRTL ? 'إرسال المقترح' : 'Envoyer'}
              </button>
              {!user && (
                <p className="text-xs text-muted-foreground text-center font-cairo">
                  {isRTL ? 'لازم تسجل دخول الأول عشان تبعت مقترح' : 'Connectez-vous pour envoyer'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
