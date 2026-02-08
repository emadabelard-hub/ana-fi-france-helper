import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, User, FileText, Mail, Brain, Camera, Paperclip, Send, ChevronRight } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const AssistantPage = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to detect Arabic text
  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simple auto-response (NO server call)
  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Hide welcome card once user starts chatting
    setShowWelcome(false);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Simulated AI response after 1 second
    setTimeout(() => {
      const isUserArabic = isArabic(userMsg.content);
      const autoResponse: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: isUserArabic
          ? "فهمت سؤالك. يمكنني مساعدتك في صياغة هذا أو شرح الإجراءات. هل تريد أن أبدأ؟"
          : "J'ai bien reçu votre demande. Je peux vous aider à rédiger cela ou vous expliquer les démarches. Voulez-vous que je commence ?",
      };
      setMessages(prev => [...prev, autoResponse]);
      setIsTyping(false);
    }, 1000);
  };

  const handleActionClick = (action: string) => {
    switch (action) {
      case 'cv':
        navigate('/pro/cv-generator');
        break;
      case 'invoice':
        navigate('/pro/invoice-creator');
        break;
      case 'mail':
        setShowWelcome(false);
        const prompt = 'عايز ارد على خطاب أو إيميل';
        setInputValue(prompt);
        break;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground font-sans">
      
      {/* HEADER */}
      <header className="bg-card p-4 pt-12 shadow-sm border-b border-border flex items-center gap-3 sticky top-0 z-10">
        <button 
          onClick={() => navigate('/')} 
          className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="w-10 h-10 bg-gradient-to-r from-primary to-[hsl(280,70%,50%)] rounded-full flex items-center justify-center text-primary-foreground shadow-md">
          <Brain size={20} />
        </div>
        <div>
          <h1 className="text-base font-bold text-foreground">Discussion IA</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-xs text-muted-foreground">En ligne</p>
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* WELCOME CARD - Only shown initially */}
        {showWelcome && (
          <div className="w-full animate-in slide-in-from-bottom-10 fade-in duration-700">
            <div className="bg-gradient-to-br from-primary to-[hsl(280,70%,50%)] p-8 rounded-[2.5rem] shadow-2xl text-center text-primary-foreground relative overflow-hidden border border-white/20">
              {/* Background decorations */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-5 -mb-5" />
              
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-2 font-cairo drop-shadow-md">شبيك لبيك 🧞‍♂️</h2>
                <p className="text-lg font-bold opacity-90 mb-8 font-cairo text-primary-foreground/80">اسأل وانا اجاوب</p>

                {/* Action Buttons inside the card */}
                <div className="space-y-3">
                  {/* Mail Reply Button */}
                  <button
                    onClick={() => handleActionClick('mail')}
                    className="w-full flex items-center justify-between p-4 rounded-2xl shadow-lg active:scale-95 transition-all bg-white text-primary border-2 border-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Mail size={20} />
                      </div>
                      <span className="font-bold text-sm font-cairo">الرد على خطاب أو إيميل</span>
                    </div>
                    <ChevronRight size={18} className="text-primary" />
                  </button>

                  {/* CV Button */}
                  <button
                    onClick={() => handleActionClick('cv')}
                    className="w-full flex items-center justify-between p-4 rounded-2xl shadow-lg active:scale-95 transition-all bg-white/10 text-primary-foreground border border-white/20 hover:bg-white/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/20 text-primary-foreground">
                        <User size={20} />
                      </div>
                      <span className="font-bold text-sm font-cairo">عايز تعمل سي في</span>
                    </div>
                    <ChevronRight size={18} className="text-primary-foreground/70" />
                  </button>

                  {/* Invoice Button */}
                  <button
                    onClick={() => handleActionClick('invoice')}
                    className="w-full flex items-center justify-between p-4 rounded-2xl shadow-lg active:scale-95 transition-all bg-white/10 text-primary-foreground border border-white/20 hover:bg-white/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/20 text-primary-foreground">
                        <FileText size={20} />
                      </div>
                      <span className="font-bold text-sm font-cairo">عايز تكتب فاتورة أو دوفي</span>
                    </div>
                    <ChevronRight size={18} className="text-primary-foreground/70" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message History */}
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            
            {/* AI Avatar */}
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                <Brain size={14} className="text-primary" />
              </div>
            )}

            {/* Message Bubble */}
            <div className={cn(
              "max-w-[85%] p-3 px-4 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap",
              msg.role === 'user' 
                ? 'bg-primary text-primary-foreground rounded-tr-none' 
                : 'bg-card text-card-foreground rounded-tl-none border border-border',
              isArabic(msg.content) ? 'font-cairo text-right' : 'text-left'
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-1 p-3 bg-card rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT BAR */}
      <div className="bg-background border-t border-border p-3 safe-area-pb">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
          className="flex items-center gap-2 bg-muted p-1.5 rounded-full border border-border"
        >
          <button type="button" className="p-2 text-muted-foreground hover:text-primary transition-colors">
            <Camera size={22} />
          </button>
          
          <input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-transparent text-sm font-medium px-2 outline-none text-foreground placeholder:text-muted-foreground"
            dir="auto"
            disabled={isTyping}
          />
          
          <button type="button" className="p-2 text-muted-foreground hover:text-primary transition-colors -ml-2">
            <Paperclip size={20} />
          </button>
          
          <button 
            type="submit" 
            disabled={!inputValue.trim() || isTyping} 
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all",
              inputValue.trim() && !isTyping ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
            )}
          >
            <Send size={18} className={inputValue.trim() ? 'ml-0.5' : ''} />
          </button>
        </form>
      </div>

      <style>{`
        .safe-area-pb { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default AssistantPage;
