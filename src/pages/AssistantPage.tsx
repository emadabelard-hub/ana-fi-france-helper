import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ChatInput from '@/components/assistant/ChatInput';
import AttachedDocuments, { AttachedDocument } from '@/components/assistant/AttachedDocuments';
import LoadingOverlay from '@/components/shared/LoadingOverlay';
import { ArrowLeft, User, FileText, Mail, Sparkles, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { compressImage, isImageData, getFileSizeKB } from '@/lib/imageCompression';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  isError?: boolean;
  retryData?: { message: string; image?: string };
  referencedDocumentIds?: string[];
}

const CHAT_STORAGE_KEY = 'assistant_chat_messages';
const DOCUMENTS_STORAGE_KEY = 'assistant_session_documents';

const AssistantPage = () => {
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { user } = useAuth();
  const { dailyLimitReached, incrementDailyMessages } = useCredits();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionDocuments, setSessionDocuments] = useState<AttachedDocument[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [showNewTopicConfirm, setShowNewTopicConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Welcome message - bilingual and conversational
  const welcomeMessage = "مرحباً بك في مساعدك الشخصي. أنا هنا لمناقشة أي موضوع يهمك بالتفصيل.\n\nيمكنك سؤالي عن القوانين، كيفية التعامل مع الزبائن، أو صياغة رسائل معقدة. أنا أستمع إليك وسأجيبك بشرح كامل وواضح.\n\nBonjour ! Je suis votre assistant personnel. Posez-moi n'importe quelle question, je suis là pour vous expliquer les choses en détail et discuter avec vous comme un partenaire.";

  // Helper to detect Arabic text
  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  // Load messages and documents from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
    const savedDocuments = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    
    if (savedDocuments) {
      try {
        const parsedDocs = JSON.parse(savedDocuments);
        if (Array.isArray(parsedDocs)) {
          setSessionDocuments(parsedDocs);
        }
      } catch (e) {
        console.error('Failed to parse saved documents:', e);
      }
    }
    
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setShowSessionDialog(true);
        }
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
  }, []);

  const handleContinueSession = () => {
    const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    setShowSessionDialog(false);
  };

  const handleNewSession = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    setMessages([]);
    setSessionDocuments([]);
    setShowSessionDialog(false);
  };

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Save session documents to localStorage
  useEffect(() => {
    if (sessionDocuments.length > 0) {
      localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(sessionDocuments));
    } else {
      localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    }
  }, [sessionDocuments]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDocumentAdd = (doc: AttachedDocument) => {
    setSessionDocuments(prev => [...prev, doc]);
  };

  const handleDocumentRemove = (docId: string) => {
    setSessionDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleRetry = (retryData: { message: string; image?: string }) => {
    setMessages(prev => prev.filter(m => !m.isError));
    handleSend(retryData.message, retryData.image, true);
  };

  const handleSend = async (userMessage: string, image?: string, isRetry: boolean = false) => {
    try {
      const hasSessionDocs = sessionDocuments.length > 0;
      if (!userMessage.trim() && !image && !hasSessionDocs) return;

      // Check daily message limit for logged-in users
      if (user && dailyLimitReached) {
        toast({
          variant: "destructive",
          title: isRTL ? "🌙 الحد اليومي" : "🌙 Limite quotidienne",
          description: isRTL 
            ? "وصلت للحد اليومي (30 رسالة). ارجع بكره!" 
            : "Limite quotidienne atteinte (30 messages). À demain !",
        });
        return;
      }

      if (user && !isRetry) {
        const canContinue = await incrementDailyMessages();
        if (!canContinue) return;
      }

      // Check document limit
      const MAX_DOCS = 10;
      if (sessionDocuments.length > MAX_DOCS) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: isRTL 
            ? `الحد الأقصى ${MAX_DOCS} ملفات في الجلسة الواحدة`
            : `Maximum ${MAX_DOCS} fichiers par session`,
        });
        return;
      }

      const hasImage = !!image;
      let processedImage = image;

      // Compress image if present
      if (hasImage && image && isImageData(image)) {
        try {
          const originalSize = getFileSizeKB(image);
          processedImage = await compressImage(image);
          const compressedSize = getFileSizeKB(processedImage);
          console.log(`Compressed: ${originalSize}KB → ${compressedSize}KB`);
        } catch (compressionError) {
          console.error('Image compression failed, using original:', compressionError);
        }
      }

      // Create user message
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        image: processedImage,
        referencedDocumentIds: sessionDocuments.map(d => d.id),
      };

      if (!isRetry) {
        setMessages(prev => [...prev, userMsg]);
      }
      setIsAnalyzing(true);

      // Build conversation history
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Prepare documents for API
      const allDocumentImages: string[] = [];
      for (const doc of sessionDocuments) {
        if (doc.type === 'image' && isImageData(doc.data)) {
          try {
            const compressed = await compressImage(doc.data);
            allDocumentImages.push(compressed);
          } catch {
            allDocumentImages.push(doc.data);
          }
        } else {
          allDocumentImages.push(doc.data);
        }
      }
      if (processedImage) {
        allDocumentImages.push(processedImage);
      }

      const documentContextDescription = sessionDocuments.length > 0
        ? `The user has ${sessionDocuments.length} document(s) in their session dossier.`
        : undefined;

      const { data, error } = await supabase.functions.invoke('analyze-request', {
        body: { 
          userMessage: userMessage || (isRTL ? 'حلل المستندات دي' : 'Analysez ces documents'),
          conversationHistory,
          imageData: allDocumentImages.length === 1 ? allDocumentImages[0] : undefined,
          multipleImages: allDocumentImages.length > 1 ? allDocumentImages : undefined,
          documentContext: documentContextDescription,
          language: language,
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

      if (error) {
        throw error;
      }

      const assistantResponse = data?.response || (isRTL ? 'عذراً، حدث خطأ' : 'Désolé, une erreur est survenue');
      
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantResponse,
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (error) {
      console.error('Error in handleSend:', error);
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: isRTL 
          ? 'حصل خطأ. جرب تاني!' 
          : 'Une erreur est survenue. Réessayez !',
        isError: true,
        retryData: { message: userMessage, image },
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleActionClick = (action: string) => {
    switch (action) {
      case 'cv':
        navigate('/pro/cv-generator');
        break;
      case 'invoice-edit':
        navigate('/pro/invoice-creator');
        break;
      case 'mail-reply':
        const prompt = isRTL ? 'عايز ارد على خطاب أو إيميل' : "Je veux répondre à un courrier ou email";
        handleSend(prompt);
        break;
    }
  };

  const confirmNewTopic = () => {
    setMessages([]);
    setSessionDocuments([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    setShowNewTopicConfirm(false);
    toast({
      title: isRTL ? "تم بدء موضوع جديد" : "Nouvelle discussion commencée",
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] text-foreground">
      
      {/* HEADER */}
      <header className="bg-white p-4 pt-12 shadow-sm border-b border-border flex items-center gap-3 z-10">
        <button 
          onClick={() => navigate('/')} 
          className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="w-10 h-10 bg-gradient-to-r from-primary to-[hsl(240,70%,55%)] rounded-full flex items-center justify-center text-primary-foreground shadow-md">
          <Bot size={22} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground">Discussion IA</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-[10px] text-muted-foreground font-medium">En ligne • Toujours disponible</p>
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[hsl(35,30%,88%)]/30">
        
        {/* Session Documents */}
        {sessionDocuments.length > 0 && (
          <AttachedDocuments
            documents={sessionDocuments}
            onRemove={handleDocumentRemove}
            isRTL={isRTL}
          />
        )}

        {/* Welcome Message */}
        <div className="flex w-full justify-start">
          <div className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center mr-2 mt-1 shrink-0">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div className="max-w-[85%] p-3.5 px-4 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap bg-white text-foreground rounded-tl-none border border-border font-cairo text-right">
            {welcomeMessage}
          </div>
        </div>

        {/* Message History */}
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            
            {/* AI Avatar */}
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center mr-2 mt-1 shrink-0">
                <Sparkles size={14} className="text-primary" />
              </div>
            )}

            {/* Message Bubble */}
            <div className={cn(
              "max-w-[85%] p-3.5 px-4 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap",
              msg.role === 'user' 
                ? 'bg-[#005c4b] text-white rounded-tr-none' 
                : 'bg-white text-foreground rounded-tl-none border border-border',
              isArabic(msg.content) ? 'font-cairo text-right' : 'text-left',
              msg.isError && 'border-destructive'
            )}>
              {msg.image && (
                <img src={msg.image} alt="Attached" className="max-w-full rounded-lg mb-2" />
              )}
              {msg.content}
              
              {/* Retry button for error messages */}
              {msg.isError && msg.retryData && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => handleRetry(msg.retryData!)}
                >
                  {isRTL ? 'حاول تاني' : 'Réessayer'}
                </Button>
              )}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isAnalyzing && (
          <div className="flex items-center gap-1 p-3 bg-white rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* QUICK ACTION BAR */}
      <div className="bg-[#f0f2f5] p-2 pb-0 border-t border-border">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-2">
          
          {/* 1. Mail Reply Button */}
          <button 
            onClick={() => handleActionClick('mail-reply')} 
            className="flex items-center gap-2 bg-white text-foreground px-4 py-3 rounded-full border border-border shadow-sm active:scale-95 transition-transform shrink-0"
          >
            <Mail size={18} className="text-emerald-600" />
            <span className="font-bold text-xs font-cairo">الرد على خطاب أو إيميل</span>
          </button>

          {/* 2. CV Button */}
          <button 
            onClick={() => handleActionClick('cv')}
            className="flex items-center gap-2 bg-white text-foreground px-4 py-3 rounded-full border border-border shadow-sm active:scale-95 transition-transform shrink-0"
          >
            <User size={18} className="text-violet-600" />
            <span className="font-bold text-xs font-cairo">عايز تعمل سي في</span>
          </button>

          {/* 3. Invoice Button */}
          <button 
            onClick={() => handleActionClick('invoice-edit')}
            className="flex items-center gap-2 bg-white text-foreground px-4 py-3 rounded-full border border-border shadow-sm active:scale-95 transition-transform shrink-0"
          >
            <FileText size={18} className="text-orange-500" />
            <span className="font-bold text-xs font-cairo">عايز تكتب فاتورة أو دوفي</span>
          </button>
        </div>
      </div>

      {/* INPUT AREA */}
      <div className="p-3 bg-[#f0f2f5] safe-area-pb">
        <ChatInput
          onSend={handleSend}
          onDocumentAdd={handleDocumentAdd}
          isLoading={isAnalyzing}
          isRTL={isRTL}
          t={t}
          externalDocumentsMode={true}
        />
      </div>

      {/* Session Resume Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn(isRTL && "text-right font-cairo")}>
              {isRTL ? "استكمال المحادثة؟" : "Reprendre la conversation ?"}
            </DialogTitle>
            <DialogDescription className={cn(isRTL && "text-right font-cairo")}>
              {isRTL 
                ? "عندك محادثة سابقة. تكمل؟" 
                : "Vous avez une conversation précédente. Continuer ?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={handleNewSession}>
              {isRTL ? "موضوع جديد" : "Nouveau sujet"}
            </Button>
            <Button onClick={handleContinueSession}>
              {isRTL ? "نكمل" : "Continuer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Topic Confirm Dialog */}
      <Dialog open={showNewTopicConfirm} onOpenChange={setShowNewTopicConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn(isRTL && "text-right font-cairo")}>
              {isRTL ? "موضوع جديد؟" : "Nouveau sujet ?"}
            </DialogTitle>
            <DialogDescription className={cn(isRTL && "text-right font-cairo")}>
              {isRTL 
                ? "هيتم مسح المحادثة الحالية" 
                : "La conversation actuelle sera effacée"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={() => setShowNewTopicConfirm(false)}>
              {isRTL ? "إلغاء" : "Annuler"}
            </Button>
            <Button variant="destructive" onClick={confirmNewTopic}>
              {isRTL ? "مسح وبدء جديد" : "Effacer et recommencer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default AssistantPage;
