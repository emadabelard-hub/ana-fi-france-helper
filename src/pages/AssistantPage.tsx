import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Brain, Camera, Paperclip, Send, Loader2 } from 'lucide-react';
import { streamProAdminAssistant } from '@/hooks/useStreamingChat';
import { useToast } from '@/hooks/use-toast';
import QuickActionsBar from '@/components/assistant/QuickActionsBar';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const AssistantPage = () => {
  const navigate = useNavigate();
  const { isRTL, language, t } = useLanguage();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to detect Arabic text
  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real AI streaming response
  const handleSend = async (messageText?: string, imageData?: string) => {
    const text = messageText || inputValue;
    if (!text.trim() && !imageData) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text || (imageData ? '📷 صورة مرفقة' : ''),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Prepare conversation history for context
    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    // Use app's global language setting (from toggle), not text detection
    const chatLanguage: 'fr' | 'ar' = language;

    let assistantContent = '';
    const assistantId = `assistant-${Date.now()}`;

    // Add empty assistant message that will be updated
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      await streamProAdminAssistant(
        {
          userMessage: text,
          imageData,
          conversationHistory,
          language: chatLanguage,
        },
        {
          onDelta: (deltaText) => {
            assistantContent += deltaText;
            setMessages(prev => 
              prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
            );
          },
          onDone: () => {
            setIsTyping(false);
          },
          onError: (error) => {
            console.error('Stream error:', error);
            setIsTyping(false);

            const errorMessage = chatLanguage === 'fr'
              ? (error.status === 429
                  ? "Service surchargé — réessayez dans une minute."
                  : error.status === 402
                  ? "Crédits IA indisponibles — vérifiez votre abonnement."
                  : "Problème serveur — réessayez dans un instant.")
              : (error.status === 429
                  ? 'الخدمة مشغولة حاليا، جرب تاني بعد شوية 🙏'
                  : error.status === 402
                  ? 'الرصيد خلص، محتاج تشحن الحساب 💳'
                  : 'حصل مشكلة في السيرفر، جرب تاني 🔄');

            setMessages(prev =>
              prev.map(m => m.id === assistantId ? { ...m, content: errorMessage } : m)
            );

            toast({
              variant: 'destructive',
              title: isRTL ? 'خطأ' : 'Erreur',
              description: errorMessage,
            });
          }
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      setIsTyping(false);
      setMessages(prev => 
        prev.map(m => m.id === assistantId ? { ...m, content: 'حصل مشكلة، جرب تاني 🔄' } : m)
      );
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'الملف كبير' : 'Fichier trop volumineux',
        description: isRTL ? 'الحد الأقصى 5 ميجا' : 'Maximum 5 Mo',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const imagePrompt = language === 'fr' 
        ? 'Analysez ce document et expliquez-moi son contenu' 
        : 'حلل المستند ده وقولي إيه المكتوب فيه';
      handleSend(imagePrompt, base64);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleActionClick = (action: string) => {
    try {
      switch (action) {
        case 'cv':
          navigate('/pro/cv-generator');
          break;
        case 'invoice':
          navigate('/pro/invoice-creator');
          break;
        case 'mail':
          // Start a mail reply conversation directly in chat
          const mailPrompt = language === 'fr' 
            ? 'Je souhaite répondre à un courrier officiel que j\'ai reçu. Pouvez-vous m\'aider ?' 
            : 'عايز ارد على خطاب رسمي وصلني، ممكن تساعدني؟';
          setInputValue(mailPrompt);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col bg-background text-foreground font-sans -mx-2 -mt-20 -mb-14" style={{ height: 'calc(100vh)' }} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* HEADER - Compact */}
      <header className="bg-card p-3 pt-10 shadow-sm border-b border-border flex items-center gap-3 sticky top-0 z-10">
        <button 
          onClick={() => navigate('/')} 
          className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="w-9 h-9 bg-gradient-to-r from-primary to-[hsl(280,70%,50%)] rounded-full flex items-center justify-center text-primary-foreground shadow">
          <Brain size={18} />
        </div>
        <div>
          <h1 className={cn("text-sm font-bold text-foreground", isRTL && "font-cairo")}>
            {t('chat.title')}
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <p className={cn("text-[10px] text-muted-foreground", isRTL && "font-cairo")}>
              {t('chat.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* CHAT AREA - Simple WhatsApp Style */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: '250px' }}>
        
        {/* Welcome Message - Only when empty */}
        {!hasMessages && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                <Brain size={14} className="text-primary" />
              </div>
              <div className="max-w-[85%] p-3 px-4 rounded-2xl rounded-tl-none bg-card text-card-foreground border border-border shadow-sm">
                <p className={cn("text-[15px] leading-relaxed", isRTL ? "font-cairo text-right" : "text-left")} dir={isRTL ? "rtl" : "ltr"}>
                  {t('chat.welcomeTitle')}
                  <br />
                  {t('chat.welcomeMessage')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Message History - Simple Bubbles */}
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            
            {/* AI Avatar */}
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                <Brain size={14} className="text-primary" />
              </div>
            )}

            {/* Message Bubble - Simple */}
            <div className={cn(
              "max-w-[85%] p-3 px-4 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap",
              msg.role === 'user' 
                ? 'bg-primary text-primary-foreground rounded-br-none' 
                : 'bg-card text-card-foreground rounded-tl-none border border-border',
              isArabic(msg.content) ? 'font-cairo text-right' : 'text-left'
            )}>
              {msg.content || (msg.role === 'assistant' && isTyping ? '...' : '')}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-2 p-3 bg-card rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
              {t('chat.thinking')}
            </span>
          </div>
        )}
        
        {/* Spacer cushion to push last message above input */}
        <div className="h-64 w-full shrink-0" aria-hidden="true" />
        <div ref={messagesEndRef} />
      </div>

      {/* Hidden file input */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*,application/pdf" 
        className="hidden" 
        onChange={handleImageUpload}
      />

      {/* INPUT AREA - Fixed at bottom, mail-compose style */}
      <div className="fixed left-0 right-0 z-[60] bg-background border-t border-border safe-area-pb" style={{ bottom: '5rem' }}>
        {/* 3 Fixed Action Buttons - ALWAYS visible above textarea */}
        <div className="overflow-x-auto px-3 pt-2 pb-1">
          <QuickActionsBar
            onAction={(action) => handleActionClick(action)}
          />
        </div>

        {/* Large Compose Area */}
        <div className="mx-3 mb-3 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('chat.placeholder')}
            className={cn(
              "w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[15px] leading-relaxed outline-none text-foreground placeholder:text-muted-foreground",
              isRTL && "font-cairo text-right"
            )}
            dir="auto"
            disabled={isTyping}
            rows={5}
          />

          {/* Bottom toolbar inside the compose box */}
          <div className={cn(
            "flex items-center justify-between px-3 pb-2.5",
            isRTL && "flex-row-reverse"
          )}>
            {/* Left: attachment icons */}
            <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                title={isRTL ? '📷 صورة' : '📷 Photo'}
              >
                <Camera size={20} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                title={isRTL ? '📎 ملف' : '📎 Fichier'}
              >
                <Paperclip size={20} />
              </button>
            </div>

            {/* Right: send button */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all",
                inputValue.trim() && !isTyping ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
              )}
            >
              {isTyping ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} className={inputValue.trim() ? (isRTL ? '-mr-0.5' : 'ml-0.5') : ''} />
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .safe-area-pb { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default AssistantPage;
