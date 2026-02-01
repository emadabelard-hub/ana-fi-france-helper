import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from '@/components/assistant/ChatMessage';
import ChatInput from '@/components/assistant/ChatInput';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const AssistantPage = () => {
  const { t, isRTL } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (userMessage: string, image?: string) => {
    if (!userMessage.trim() && !image) return;

    // Create user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: image ? `[صورة مرفقة]\n${userMessage}` : userMessage,
    };

    // Add user message to chat
    setMessages(prev => [...prev, userMsg]);
    setIsAnalyzing(true);

    try {
      // Build conversation history for context
      const conversationHistory = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('analyze-request', {
        body: { 
          userMessage,
          conversationHistory,
          profile: profile ? {
            full_name: profile.full_name,
            address: profile.address,
            phone: profile.phone,
            caf_number: profile.caf_number,
            foreigner_number: profile.foreigner_number,
            social_security: profile.social_security,
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

      // Build assistant response from the parsed sections
      let assistantContent = '';
      
      if (data.explanation) {
        assistantContent += `📋 **الشرح:**\n${data.explanation}\n\n`;
      }
      if (data.actionPlan) {
        assistantContent += `✅ **خطة العمل:**\n${data.actionPlan}\n\n`;
      }
      if (data.formalLetter && data.formalLetter !== "لو عايز أكتبلك رد رسمي، قولي 'اكتبلي رد'") {
        assistantContent += `📝 **الرسالة الرسمية:**\n${data.formalLetter}\n\n`;
      } else if (data.formalLetter) {
        assistantContent += `💡 ${data.formalLetter}\n\n`;
      }
      if (data.legalNote) {
        assistantContent += `⚖️ **ملاحظات قانونية:**\n${data.legalNote}`;
      }

      // Fallback if nothing parsed
      if (!assistantContent.trim()) {
        assistantContent = data.rawContent || isRTL 
          ? "تم استلام ردك. لو عندك أي سؤال تاني، اسألني!" 
          : "Réponse reçue. Si vous avez d'autres questions, demandez-moi!";
      }

      // Add assistant message
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent.trim(),
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
      {/* Title */}
      <section className={cn("text-center py-4 flex-shrink-0", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {isRTL ? 'أريد حلاً' : 'Je veux une solution'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'مساعدك الإداري المصري' : 'Votre assistant administratif'}
        </p>
      </section>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-3">
        {messages.length === 0 ? (
          <div className={cn(
            "flex flex-col items-center justify-center h-full text-center text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            <div className="text-5xl mb-4">🇪🇬</div>
            <p className="text-lg font-medium">
              {isRTL ? 'أهلاً بيك يا صاحبي!' : 'Bienvenue!'}
            </p>
            <p className="text-sm max-w-xs mt-2">
              {isRTL 
                ? 'ابعتلي أي مستند أو سؤال عن الإدارة الفرنسية وأنا هشرحلك بالمصري 😊'
                : 'Envoyez-moi un document ou une question sur l\'administration française'}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              isRTL={isRTL}
            />
          ))
        )}
        
        {/* Loading indicator */}
        {isAnalyzing && (
          <div className={cn(
            "flex gap-3 p-4 rounded-xl bg-muted/50 mr-8",
            isRTL && "flex-row-reverse"
          )}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
              <span className="animate-pulse">🤔</span>
            </div>
            <div className={cn("text-sm text-muted-foreground", isRTL && "text-right font-cairo")}>
              {isRTL ? 'جار التحليل...' : 'Analyse en cours...'}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 p-3 border-t bg-background">
        <Card>
          <CardContent className="p-3">
            <ChatInput
              onSend={handleSend}
              isLoading={isAnalyzing}
              isRTL={isRTL}
              t={t}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AssistantPage;
