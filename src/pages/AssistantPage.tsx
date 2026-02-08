import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, User, FileText, Mail, Sparkles, Brain, Camera, Paperclip, Send } from 'lucide-react';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Welcome message
  const welcomeMessage = "مرحباً! أنا المساعد الذكي. كيف يمكنني مساعدتك اليوم؟\n\nBonjour ! Je suis votre assistant IA. Posez-moi n'importe quelle question.";

  // Helper to detect Arabic text
  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simple auto-response (NO server call)
  const handleSend = () => {
    if (!inputValue.trim()) return;

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
        const prompt = isRTL ? 'عايز ارد على خطاب أو إيميل' : "Je veux répondre à un courrier ou email";
        setInputValue(prompt);
        break;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 text-foreground font-sans">
      
      {/* HEADER */}
      <header className="bg-white p-4 pt-12 shadow-sm border-b border-slate-200 flex items-center gap-3 sticky top-0 z-10">
        <button 
          onClick={() => navigate('/')} 
          className="p-2 -ml-2 rounded-full hover:bg-slate-50 text-slate-500"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-md">
          <Brain size={20} />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800">Discussion IA</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-xs text-slate-500">En ligne</p>
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 pb-48 space-y-3">
        
        {/* Welcome Message */}
        <div className="flex w-full justify-start">
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
            <Sparkles size={14} className="text-indigo-600" />
          </div>
          <div className="max-w-[85%] p-3 px-4 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap bg-white text-slate-800 rounded-tl-none border border-slate-100 font-cairo text-right">
            {welcomeMessage}
          </div>
        </div>

        {/* Message History */}
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            
            {/* AI Avatar */}
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                <Sparkles size={14} className="text-indigo-600" />
              </div>
            )}

            {/* Message Bubble */}
            <div className={cn(
              "max-w-[85%] p-3 px-4 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap",
              msg.role === 'user' 
                ? 'bg-[#005c4b] text-white rounded-tr-none' 
                : 'bg-white text-slate-800 rounded-tl-none border border-slate-100',
              isArabic(msg.content) ? 'font-cairo text-right' : 'text-left'
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-1 p-3 bg-white rounded-2xl rounded-tl-none w-fit border border-slate-100 shadow-sm ml-10">
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* FIXED BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-200 p-3 safe-area-pb z-20">
        
        {/* 3 Action Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          
          {/* CV Button */}
          <button 
            onClick={() => handleActionClick('cv')}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm active:scale-95 transition-transform shrink-0"
          >
            <User size={18} className="text-purple-600" />
            <span className="font-bold text-xs font-cairo">عايز تعمل سي في</span>
          </button>

          {/* Invoice Button */}
          <button 
            onClick={() => handleActionClick('invoice')}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm active:scale-95 transition-transform shrink-0"
          >
            <FileText size={18} className="text-orange-500" />
            <span className="font-bold text-xs font-cairo">عايز تكتب فاتورة</span>
          </button>

          {/* Mail Button */}
          <button 
            onClick={() => handleActionClick('mail')}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm active:scale-95 transition-transform shrink-0"
          >
            <Mail size={18} className="text-green-600" />
            <span className="font-bold text-xs font-cairo">الرد على خطاب</span>
          </button>
        </div>

        {/* Input Area */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
          className="flex items-center gap-2 bg-white p-1.5 rounded-full border border-slate-200 shadow-sm"
        >
          <button type="button" className="p-2 text-slate-500 hover:text-blue-600 transition-colors">
            <Camera size={22} />
          </button>
          
          <input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-transparent text-sm font-medium px-2 outline-none text-slate-800 placeholder:text-slate-400"
            dir="auto"
            disabled={isTyping}
          />
          
          <button type="button" className="p-2 text-slate-500 hover:text-blue-600 transition-colors -ml-2">
            <Paperclip size={20} />
          </button>
          
          <button 
            type="submit" 
            disabled={!inputValue.trim() || isTyping} 
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all",
              inputValue.trim() && !isTyping ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
            )}
          >
            <Send size={18} className={inputValue.trim() ? 'ml-0.5' : ''} />
          </button>
        </form>
      </div>

      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default AssistantPage;
