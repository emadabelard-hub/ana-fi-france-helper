import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Camera, Send, Loader2, ImagePlus, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import AuthModal from '@/components/auth/AuthModal';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

const UniversalAdminAssistantPage = () => {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? 'الصورة كبيرة أوي، الحد الأقصى 10 ميجا' : 'Image trop grande, max 10 Mo');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!user) { setShowAuth(true); return; }
    if (!input.trim() && !image) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim() || (isRTL ? 'اشرح لي الصورة دي يا فندم' : 'Expliquez-moi cette capture'),
      image: image || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setImage(null);
    setIsLoading(true);

    try {
      const apiMessages = messages.concat(userMessage).map(m => {
        if (m.image) {
          return {
            role: m.role,
            content: [
              { type: 'text' as const, text: m.content },
              { type: 'image_url' as const, image_url: { url: m.image } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${supabaseUrl}/functions/v1/universal-admin-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await (await import('@/integrations/supabase/client')).supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages, language }),
      });

      if (!resp.ok) {
        if (resp.status === 429) { toast.error(isRTL ? 'طلبات كتير، استنى شوية يا فندم' : 'Trop de requêtes'); }
        else if (resp.status === 402) { toast.error(isRTL ? 'الرصيد خلص' : 'Crédits insuffisants'); }
        else { toast.error(isRTL ? 'حصل مشكلة، جرب تاني' : 'Erreur, réessayez'); }
        setIsLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setIsLoading(false); return; }
      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch { /* partial json */ }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'حصل مشكلة في الاتصال' : 'Erreur de connexion');
    }
    setIsLoading(false);
  };

  const securityNotice = isRTL
    ? 'حرصاً على أمانك، إحنا بنشرح لك الخطوات بس، لكن حضرتك اللي بتدخل بياناتك بنفسك.'
    : 'Pour votre sécurité, nous vous expliquons les étapes, mais c\'est vous qui saisissez vos données.';

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] pb-20">
      {showAuth && <AuthModal open={showAuth} onOpenChange={setShowAuth} />}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className={cn("text-center py-12 space-y-4", isRTL && "font-cairo")}>
            <div className="w-16 h-16 mx-auto bg-accent/20 rounded-2xl flex items-center justify-center">
              <ImagePlus size={32} className="text-accent" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {isRTL ? 'المساعد الإداري الشامل' : 'Assistant Administratif Universel'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {isRTL
                ? 'صوّر أي صفحة من مواقع الضرايب أو الكاف أو أميلي أو فرانس ترافاي وأنا هاشرح لك كل حاجة فيها يا فندم'
                : 'Prenez une capture d\'écran de n\'importe quelle plateforme française et je vous l\'explique'}
            </p>
            <div className="flex items-center justify-center gap-2 bg-accent/10 rounded-xl p-3 mx-4 border border-accent/20">
              <ShieldCheck size={16} className="text-accent shrink-0" />
              <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-cairo")}>
                {securityNotice}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start'))}>
            <div className={cn(
              "max-w-[85%] rounded-2xl p-4",
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}>
              {msg.image && (
                <img src={msg.image} alt="" className="rounded-xl mb-2 max-h-48 object-contain" />
              )}
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} isRTL={isRTL} />
              ) : (
                <p className={cn("text-sm", isRTL && "font-cairo text-right")}>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className={cn("flex", isRTL ? 'justify-right' : 'justify-left')}>
            <div className="bg-muted rounded-2xl p-4">
              <Loader2 className="animate-spin text-muted-foreground" size={20} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background px-4 py-3 space-y-2">
        {image && (
          <div className="relative inline-block">
            <img src={image} alt="" className="h-16 rounded-lg border border-border" />
            <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => cameraInputRef.current?.click()}>
            <Camera size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={20} />
          </Button>
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isRTL ? 'اكتب سؤالك أو ابعت سكرينشوت...' : 'Posez votre question ou envoyez une capture...'}
            className={cn("min-h-[44px] max-h-[120px] resize-none text-sm", isRTL && "font-cairo text-right")}
            dir={isRTL ? 'rtl' : 'ltr'}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button size="icon" onClick={handleSend} disabled={isLoading || (!input.trim() && !image)} className="shrink-0">
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UniversalAdminAssistantPage;
