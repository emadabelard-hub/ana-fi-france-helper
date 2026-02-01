import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from '@/components/assistant/ChatMessage';
import ChatInput from '@/components/assistant/ChatInput';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, HelpCircle, Trash2, ArrowRight, ArrowLeft, Briefcase } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_STORAGE_KEY = 'pro_admin_assistant_messages';

const ProAdminAssistantPage = () => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // Initial greeting for Pro Mode
  const initialGreeting: Message = {
    id: 'initial-greeting',
    role: 'assistant',
    content: `أهلاً يا هندسة 💼

أنا محاسبك ومستشارك القانوني للشغل في فرنسا.

📬 جالك جواب من الـ URSSAF أو RSI؟
💰 زبون مش عايز يدفع فاتورتك؟
📊 عايز تفهم ضرايبك وتصريحاتك؟
🏗️ زبون بيقول شغلك فيه "Malfaçon"؟
🛡️ مش فاهم عقد التأمين العشري (Décennale)؟

صور وابعتلي أي مستند، أو اكتبلي مشكلتك وأنا هشرحلك وهساعدك ترد.`,
  };

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        } else {
          setMessages([initialGreeting]);
        }
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
        setMessages([initialGreeting]);
      }
    } else {
      setMessages([initialGreeting]);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0 && messages[0]?.id !== 'initial-greeting') {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } else if (messages.length > 1) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearChat = () => {
    setMessages([initialGreeting]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    toast({
      title: isRTL ? "تم مسح المحادثة" : "Conversation effacée",
      description: isRTL ? "يمكنك بدء محادثة جديدة" : "Vous pouvez commencer une nouvelle conversation",
    });
  };

  const handleSend = async (userMessage: string, image?: string) => {
    if (!userMessage.trim() && !image) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: image ? `[صورة مرفقة]\n${userMessage}` : userMessage,
    };

    setMessages(prev => [...prev, userMsg]);
    setIsAnalyzing(true);

    try {
      const conversationHistory = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('pro-admin-assistant', {
        body: { 
          userMessage,
          conversationHistory,
          profile: profile ? {
            full_name: profile.full_name,
            address: profile.address,
            phone: profile.phone,
          } : null
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

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || isRTL 
          ? "تم استلام ردك. لو عندك أي سؤال تاني، اسألني!" 
          : "Réponse reçue. Si vous avez d'autres questions, demandez-moi!",
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (error) {
      console.error('Error analyzing:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "حدث خطأ أثناء التحليل" : "Une erreur est survenue lors de l'analyse.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] pb-20">
      {/* Header with Back Button */}
      <section className={cn(
        "flex items-center gap-3 py-4 px-2 flex-shrink-0",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/pro')}
          className="shrink-0"
        >
          <BackArrow className="h-5 w-5" />
        </Button>
        <div className={cn(
          "flex items-center gap-2 flex-1",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn(
              "text-lg font-bold text-foreground",
              isRTL && "font-cairo"
            )}>
              مساعد الارتيزان الذكي
            </h1>
            <p className={cn(
              "text-xs text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              URSSAF • ضرايب • منازعات
            </p>
          </div>
        </div>
        {messages.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </section>

      {/* How It Works Guide */}
      <div className="px-2 mb-3 flex-shrink-0">
        <Collapsible open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className={cn(
                "w-full justify-between",
                isRTL && "flex-row-reverse font-cairo"
              )}
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                {isRTL ? 'إيه اللي أقدر أساعدك فيه؟' : 'Comment puis-je vous aider?'}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isGuideOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 bg-muted/50">
              <CardContent className={cn("p-4 space-y-3 text-sm", isRTL && "text-right font-cairo")}>
                <div className="flex items-start gap-3">
                  <span className="text-xl">📬</span>
                  <div>
                    <p className="font-medium text-foreground">URSSAF & RSI</p>
                    <p className="text-muted-foreground">
                      شرح جوابات الاشتراكات والتصريحات
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">💰</span>
                  <div>
                    <p className="font-medium text-foreground">فواتير مش مدفوعة</p>
                    <p className="text-muted-foreground">
                      أكتبلك "Lettre de Relance" لمطالبة الزبون
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <p className="font-medium text-foreground">التأمين العشري (Décennale)</p>
                    <p className="text-muted-foreground">
                      شرح عقود التأمين والتغطية
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚖️</span>
                  <div>
                    <p className="font-medium text-foreground">منازعات الشغل</p>
                    <p className="text-muted-foreground">
                      الرد على ادعاءات "Malfaçon" أو عيوب
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-3">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={message.content}
            isRTL={isRTL}
          />
        ))}
        
        {/* Loading indicator */}
        {isAnalyzing && (
          <div className={cn(
            "flex gap-3 p-4 rounded-xl bg-muted/50 mr-8",
            isRTL && "flex-row-reverse ml-8 mr-0"
          )}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-accent-foreground" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className={cn(
                "text-sm text-muted-foreground",
                isRTL && "font-cairo"
              )}>
                {isRTL ? 'بحلل...' : 'Analyse en cours...'}
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 px-2 py-3 border-t bg-background">
        <ChatInput
          onSend={handleSend}
          isLoading={isAnalyzing}
          isRTL={isRTL}
          t={t}
        />
      </div>
    </div>
  );
};

export default ProAdminAssistantPage;
