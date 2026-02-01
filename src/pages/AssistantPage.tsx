import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from '@/components/assistant/ChatMessage';
import ChatInput from '@/components/assistant/ChatInput';
import MissingInfoForm from '@/components/assistant/MissingInfoForm';
import DispatchGuide from '@/components/assistant/DispatchGuide';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, HelpCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MissingField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

interface DispatchInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subjectLine?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  showMissingInfoForm?: boolean;
  missingFields?: MissingField[];
  letterContext?: string;
  showDispatchGuide?: boolean;
  dispatchInfo?: DispatchInfo;
  letterContent?: string;
}

const CHAT_STORAGE_KEY = 'assistant_chat_messages';

const AssistantPage = () => {
  const { t, isRTL } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [pendingLetterMessage, setPendingLetterMessage] = useState<{
    messageId: string;
    missingFields: MissingField[];
    letterContext: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed)) {
          // Filter out any pending form states when loading
          const cleanedMessages = parsed.map((m: Message) => ({
            ...m,
            showMissingInfoForm: false,
          }));
          setMessages(cleanedMessages);
        }
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      // Don't save the form state
      const messagesToSave = messages.map(m => ({
        ...m,
        showMissingInfoForm: false,
      }));
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messagesToSave));
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingLetterMessage]);

  const clearChat = () => {
    setMessages([]);
    setPendingLetterMessage(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    toast({
      title: isRTL ? "تم مسح المحادثة" : "Conversation effacée",
      description: isRTL ? "يمكنك بدء محادثة جديدة" : "Vous pouvez commencer une nouvelle conversation",
    });
  };

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

      // Check if we need to show missing info form
      if (data.requiresMoreInfo && data.missingFields?.length > 0) {
        // Build assistant response first
        let assistantContent = '';
        
        if (data.explanation) {
          assistantContent += `📋 **الشرح:**\n${data.explanation}\n\n`;
        }
        if (data.actionPlan) {
          assistantContent += `✅ **خطة العمل:**\n${data.actionPlan}\n\n`;
        }
        if (data.legalNote) {
          assistantContent += `⚖️ **ملاحظات قانونية:**\n${data.legalNote}\n\n`;
        }
        
        assistantContent += `📝 **عشان أكتبلك جواب رسمي متكامل، محتاج منك بعض البيانات...**`;

        const assistantMsgId = `assistant-${Date.now()}`;
        const assistantMsg: Message = {
          id: assistantMsgId,
          role: 'assistant',
          content: assistantContent.trim(),
          showMissingInfoForm: true,
          missingFields: data.missingFields,
          letterContext: data.letterContext,
        };

        setMessages(prev => [...prev, assistantMsg]);
        setPendingLetterMessage({
          messageId: assistantMsgId,
          missingFields: data.missingFields,
          letterContext: data.letterContext || userMessage,
        });
      } else {
        // Build regular assistant response
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
      }

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

  const handleFormSubmit = async (formData: Record<string, string>) => {
    if (!pendingLetterMessage) return;

    setIsAnalyzing(true);

    try {
      // Build conversation history
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('analyze-request', {
        body: { 
          userMessage: pendingLetterMessage.letterContext,
          conversationHistory,
          generateLetterWithData: formData,
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

      // Remove the form from the message
      setMessages(prev => prev.map(m => 
        m.id === pendingLetterMessage.messageId 
          ? { ...m, showMissingInfoForm: false }
          : m
      ));
      setPendingLetterMessage(null);

      // Add the generated letter as a new message with dispatch guide
      const letterMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `📝 **الرسالة الرسمية:**\n\n${data.formalLetter}\n\n✅ **تم!** دي الرسالة الجاهزة للطباعة والإرسال. لو محتاج أي تعديل، قولي!`,
        showDispatchGuide: true,
        dispatchInfo: data.dispatchInfo,
        letterContent: data.formalLetter,
      };

      setMessages(prev => [...prev, letterMsg]);

    } catch (error) {
      console.error('Error generating letter:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "حدث خطأ أثناء كتابة الرسالة" : "Une erreur est survenue lors de la rédaction.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFormCancel = () => {
    if (pendingLetterMessage) {
      // Remove the form from the message
      setMessages(prev => prev.map(m => 
        m.id === pendingLetterMessage.messageId 
          ? { ...m, showMissingInfoForm: false }
          : m
      ));
      setPendingLetterMessage(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] pb-20">
      {/* Title with Clear Button */}
      <section className={cn("text-center py-4 flex-shrink-0 relative", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {isRTL ? 'أريد حلاً' : 'Je veux une solution'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'مساعدك الإداري المصري' : 'Votre assistant administratif'}
        </p>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className={cn(
              "absolute top-4 text-muted-foreground hover:text-destructive",
              isRTL ? "left-2" : "right-2"
            )}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {isRTL ? "مسح" : "Effacer"}
          </Button>
        )}
      </section>

      {/* How It Works Guide */}
      <div className="px-2 mb-3 flex-shrink-0">
        <Collapsible open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className={cn(
                "w-full justify-between",
                isRTL && "flex-row-reverse font-cairo"
              )}
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                {isRTL ? 'ازاي تستخدم المساعد؟' : 'Comment utiliser l\'assistant?'}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isGuideOpen && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2 bg-muted/50">
              <CardContent className={cn("p-4 space-y-3", isRTL && "text-right font-cairo")}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📸</span>
                  <div>
                    <p className="font-medium text-foreground">
                      {isRTL ? 'صوّر الجواب' : 'Photographiez la lettre'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? 'ارفع صورة الخطاب اللي جالك أو اكتب مشكلتك.' : 'Téléchargez une photo de la lettre ou décrivez votre problème.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔍</span>
                  <div>
                    <p className="font-medium text-foreground">
                      {isRTL ? 'التحليل' : 'L\'analyse'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? 'البرنامج هيشرحلك المكتوب ببساطة.' : 'L\'application vous expliquera le contenu simplement.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✉️</span>
                  <div>
                    <p className="font-medium text-foreground">
                      {isRTL ? 'الحل' : 'La solution'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? 'لو محتاج، هنكتبلك الرد الرسمي بالفرنساوي عشان تبعته.' : 'Si nécessaire, nous rédigerons la réponse officielle en français.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🧠</span>
                  <div>
                    <p className="font-medium text-foreground">
                      {isRTL ? 'استشارة وشرح دقيق' : 'Consultation détaillée'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? 'ولو محتاج تفهم أي موضوع أو أي مشكلة، هشرحلك الوضع بصورة دقيقة وهتفهم إيه المطلوب منك وتعمل إيه.' : 'Si vous avez besoin de comprendre un sujet, je vous l\'expliquerai en détail.'}
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
            <React.Fragment key={message.id}>
              <ChatMessage
                role={message.role}
                content={message.content}
                isRTL={isRTL}
              />
              {/* Show missing info form if needed */}
              {message.showMissingInfoForm && message.missingFields && pendingLetterMessage?.messageId === message.id && (
                <div className="mt-3">
                  <MissingInfoForm
                    fields={message.missingFields}
                    onSubmit={handleFormSubmit}
                    onCancel={handleFormCancel}
                    isLoading={isAnalyzing}
                    isRTL={isRTL}
                  />
                </div>
              )}
              {/* Show dispatch guide after letter generation */}
              {message.showDispatchGuide && message.dispatchInfo && (
                <DispatchGuide
                  dispatchInfo={message.dispatchInfo}
                  letterContent={message.letterContent || ''}
                  isRTL={isRTL}
                  onClose={() => {
                    setMessages(prev => prev.map(m => 
                      m.id === message.id 
                        ? { ...m, showDispatchGuide: false }
                        : m
                    ));
                  }}
                />
              )}
            </React.Fragment>
          ))
        )}
        
        {/* Loading indicator */}
        {isAnalyzing && !pendingLetterMessage && (
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
