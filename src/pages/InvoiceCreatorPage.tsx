import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send, Loader2, PenLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import AuthModal from '@/components/auth/AuthModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const InvoiceCreatorPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: isRTL 
        ? `أهلاً بيك! 👋 أنا مساعدك لإنشاء الفواتير والدوفيهات.

عشان نبدأ، محتاج منك شوية معلومات:
1. 📛 اسم العميل أو الشركة
2. 📝 نوع الخدمة اللي قدمتها (ممكن بالعربي وأنا هحولها للفرنسي)
3. 💰 المبلغ المطلوب

قولي، إيه اللي محتاج تعمله النهاردة؟`
        : `Bonjour ! 👋 Je suis votre assistant pour créer des factures et devis.

Pour commencer, j'ai besoin de quelques informations :
1. 📛 Nom du client ou de l'entreprise
2. 📝 Type de service rendu
3. 💰 Montant à facturer

Dites-moi, qu'avez-vous besoin de faire aujourd'hui ?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('invoice-mentor', {
        body: { 
          message: userMessage,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: data.error,
        });
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "حدث خطأ أثناء المعالجة" : "Une erreur est survenue.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <section className={cn(
        "flex items-center gap-4 py-4",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/pro')}
          className="shrink-0"
        >
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn(
          "flex items-center gap-3 flex-1",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <PenLine className="h-5 w-5 text-green-600" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn(
              "text-lg font-bold text-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'فواتيرك ودوفيهاتك معانا' : 'Vos Factures & Devis'}
            </h1>
            <p className={cn(
              "text-xs text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'المساعد الذكي للمستندات المهنية' : 'Assistant intelligent pour documents pro'}
            </p>
          </div>
        </div>
      </section>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex",
              message.role === 'user' 
                ? (isRTL ? 'justify-start' : 'justify-end')
                : (isRTL ? 'justify-end' : 'justify-start')
            )}
          >
            <Card className={cn(
              "max-w-[85%]",
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            )}>
              <CardContent className={cn(
                "p-3 text-sm whitespace-pre-wrap",
                isRTL && "font-cairo text-right"
              )}>
                {message.content}
              </CardContent>
            </Card>
          </div>
        ))}
        
        {isLoading && (
          <div className={cn(
            "flex",
            isRTL ? 'justify-end' : 'justify-start'
          )}>
            <Card className="bg-muted">
              <CardContent className="p-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t pt-4 pb-2">
        <div className={cn(
          "flex items-end gap-2",
          isRTL && "flex-row-reverse"
        )}>
          <Textarea
            placeholder={isRTL ? 'اكتب رسالتك هنا...' : 'Écrivez votre message...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className={cn(
              "flex-1 min-h-[48px] max-h-[120px] resize-none",
              isRTL && "text-right font-cairo"
            )}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className={cn("h-5 w-5", isRTL && "rotate-180")} />
            )}
          </Button>
        </div>
      </div>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
};

export default InvoiceCreatorPage;
