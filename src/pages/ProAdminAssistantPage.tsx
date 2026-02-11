import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { streamProAdminAssistant } from '@/hooks/useStreamingChat';
import ChatMessage from '@/components/assistant/ChatMessage';
import ChatInput from '@/components/assistant/ChatInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, HelpCircle, Trash2, ArrowRight, ArrowLeft, Briefcase, RotateCcw } from 'lucide-react';
import { compressImage, isImageData, getFileSizeKB } from '@/lib/imageCompression';
import { extractTextFromPDF } from '@/lib/pdfExtractor';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  errorType?: 'auth' | 'timeout' | 'generic';
  retryData?: { message: string; image?: string };
}

const CHAT_STORAGE_KEY = 'pro_admin_assistant_messages';

const ProAdminAssistantPage = () => {
  const navigate = useNavigate();
  const { t, isRTL, language } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isExtractingPDF, setIsExtractingPDF] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // Initial greeting for Pro Mode - dynamic based on language
  const getInitialGreeting = (): Message => {
    if (language === 'fr') {
      return {
        id: 'initial-greeting',
        role: 'assistant',
        content: `Bonjour ! 💼

Je suis votre conseiller comptable et juridique pour votre activité en France.

📬 Vous avez reçu un courrier de l'URSSAF ou du RSI ?
💰 Un client refuse de payer votre facture ?
📊 Vous voulez comprendre vos impôts et déclarations ?
🏗️ Un client prétend qu'il y a un défaut ("Malfaçon") ?
🛡️ Vous ne comprenez pas votre contrat d'assurance décennale ?

Envoyez-moi une photo de n'importe quel document, ou décrivez votre problème et je vous expliquerai et vous aiderai à répondre.`,
      };
    }
    return {
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
  };

  // Load messages from localStorage on mount OR when language changes
  useEffect(() => {
    const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Clean error state from saved messages
          const cleanedMessages = parsed.map((m: Message) => ({
            ...m,
            isError: false,
            retryData: undefined,
          }));
          setMessages(cleanedMessages);
        } else {
          setMessages([getInitialGreeting()]);
        }
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
        setMessages([getInitialGreeting()]);
      }
    } else {
      setMessages([getInitialGreeting()]);
    }
  }, [language]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0 && messages[0]?.id !== 'initial-greeting') {
      // Don't save error state
      const messagesToSave = messages.map(m => ({
        ...m,
        isError: false,
        retryData: undefined,
      }));
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messagesToSave));
    } else if (messages.length > 1) {
      const messagesToSave = messages.map(m => ({
        ...m,
        isError: false,
        retryData: undefined,
      }));
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messagesToSave));
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearChat = () => {
    setMessages([getInitialGreeting()]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    toast({
      title: isRTL ? "تم مسح المحادثة" : "Conversation effacée",
      description: isRTL ? "يمكنك بدء محادثة جديدة" : "Vous pouvez commencer une nouvelle conversation",
    });
  };

  const handleRetry = (retryData: { message: string; image?: string }) => {
    // Remove the error message first
    setMessages(prev => prev.filter(m => !m.isError));
    // Retry the request
    handleSend(retryData.message, retryData.image, true);
  };

  const handleSend = useCallback(async (userMessage: string, image?: string, isRetry: boolean = false) => {
    if (!userMessage.trim() && !image) return;

    const hasImage = !!image;
    let processedImage = image;
    let pdfExtractedText: string | null = null;

    // Check if the attached file is a PDF (data:application/pdf;base64,...)
    const isPDF = image && image.startsWith('data:application/pdf');

    if (isPDF && image) {
      // Extract text from PDF in the browser
      setIsExtractingPDF(true);
      try {
        pdfExtractedText = await extractTextFromPDF(image);
        console.log(`PDF text extracted: ${pdfExtractedText.length} chars`);
        if (!pdfExtractedText.trim()) {
          toast({
            variant: 'destructive',
            title: isRTL ? 'PDF فارغ' : 'PDF vide',
            description: isRTL ? 'لم يتم العثور على نص في هذا الملف' : 'Aucun texte trouvé dans ce fichier.',
          });
          setIsExtractingPDF(false);
          return;
        }
      } catch (err) {
        console.error('PDF extraction error:', err);
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ في قراءة PDF' : 'Erreur de lecture PDF',
          description: isRTL ? 'تعذر قراءة الملف. حاول مرة أخرى.' : 'Impossible de lire le fichier. Réessayez.',
        });
        setIsExtractingPDF(false);
        return;
      }
      setIsExtractingPDF(false);
      // Don't send the raw PDF binary to the AI
      processedImage = undefined;
    } else if (hasImage && image && isImageData(image)) {
      // Compress image if present
      try {
        const originalSize = getFileSizeKB(image);
        console.log(`Original image size: ${originalSize}KB`);
        processedImage = await compressImage(image);
        const compressedSize = getFileSizeKB(processedImage);
        console.log(`Compressed image size: ${compressedSize}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`);
      } catch (compressionError) {
        console.error('Image compression failed, using original:', compressionError);
      }
    }

    // Build the user message content
    let displayContent: string;
    let aiMessage: string;

    if (pdfExtractedText) {
      displayContent = `[📄 PDF مرفق]\n${userMessage || (isRTL ? 'حلل المستند ده' : 'Analysez ce document')}`;
      aiMessage = `${userMessage || (isRTL ? 'حلل المستند ده وقولي إيه المكتوب فيه' : 'Analysez ce document et expliquez son contenu')}\n\n--- Contenu du PDF ---\n${pdfExtractedText}`;
    } else if (hasImage && !isPDF) {
      displayContent = `[صورة مرفقة]\n${userMessage || 'حلل المستند ده'}`;
      aiMessage = userMessage || (language === 'fr' ? 'Analysez ce document et expliquez son contenu' : 'حلل المستند ده وقولي إيه المكتوب فيه');
    } else {
      displayContent = userMessage;
      aiMessage = userMessage;
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
    };

    if (!isRetry) {
      setMessages(prev => [...prev, userMsg]);
    }
    setIsAnalyzing(true);
    if (hasImage && !isPDF) {
      setIsAnalyzingImage(true);
    }

    // Create a placeholder assistant message for streaming
    const assistantMsgId = `assistant-${Date.now()}`;
    let streamedContent = '';

    // Add empty assistant message that will be updated with streaming content
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
    }]);

    const currentMessages = isRetry ? messages : [...messages, userMsg];
    const conversationHistory = currentMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    await streamProAdminAssistant(
      {
        userMessage: aiMessage,
        imageData: processedImage,
        conversationHistory,
        language,
        profile: profile ? {
          full_name: profile.full_name,
          address: profile.address,
          phone: profile.phone,
        } : null,
      },
      {
        onDelta: (deltaText) => {
          streamedContent += deltaText;
          // Update the assistant message with new content
          setMessages(prev => 
            prev.map(m => 
              m.id === assistantMsgId 
                ? { ...m, content: streamedContent }
                : m
            )
          );
        },
        onDone: () => {
          setIsAnalyzing(false);
          setIsAnalyzingImage(false);
          console.log('Streaming complete, total length:', streamedContent.length);
        },
        onError: (error) => {
          console.error('Streaming error:', error);
          
          // Remove the empty assistant message
          setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
          
          let errorType: 'auth' | 'timeout' | 'generic' = 'generic';
          let errorMessage = error.message || '❌ حدث خطأ أثناء التحليل. حاول مرة تانية.';

          if (error.status === 401 || error.status === 403) {
            errorType = 'auth';
            errorMessage = '⚠️ تأكد من إعدادات مفتاح الذكاء الاصطناعي (API Key).';
          } else if (error.status === 429 || error.status === 402) {
            errorType = 'generic';
            // Keep the error message from the server
          } else if (error.status === 500 || error.status === 504) {
            errorType = 'timeout';
            errorMessage = '⏱️ الصورة كبيرة جداً أو حصل مشكلة في السيرفر. حاول مرة تانية.';
          }

          const errorMsg: Message = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `❌ ${errorMessage}`,
            isError: true,
            errorType,
            retryData: { message: userMessage, image: processedImage },
          };
          setMessages(prev => [...prev, errorMsg]);
          
          setIsAnalyzing(false);
          setIsAnalyzingImage(false);
        },
      }
    );
  }, [messages, language, profile, isRTL, toast]);

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
          <React.Fragment key={message.id}>
            {/* Error message with retry button */}
            {message.isError ? (
              <Alert variant="destructive" className={cn("mr-8", isRTL && "ml-8 mr-0")}>
                <AlertDescription className={cn("flex items-center justify-between gap-2", isRTL && "flex-row-reverse font-cairo text-right")}>
                  <span>{message.content}</span>
                  {message.retryData && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(message.retryData!)}
                      className="shrink-0"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      {isRTL ? 'حاول تاني' : 'Réessayer'}
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <ChatMessage
                role={message.role}
                content={message.content}
                isRTL={isRTL}
              />
            )}
          </React.Fragment>
        ))}
        
        {/* Loading indicator - PDF Extraction */}
        {isExtractingPDF && (
          <div className={cn(
            "flex gap-3 p-4 rounded-xl bg-primary/10 mr-8",
            isRTL && "flex-row-reverse ml-8 mr-0"
          )}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <span className="animate-spin">📄</span>
            </div>
            <div className={cn("text-sm text-primary font-medium", isRTL && "text-right font-cairo")}>
              {isRTL ? '📄 جاري قراءة ملف PDF...' : '📄 Lecture du PDF en cours...'}
            </div>
          </div>
        )}

        {/* Loading indicator - Image Analysis */}
        {isAnalyzingImage && (
          <div className={cn(
            "flex gap-3 p-4 rounded-xl bg-primary/10 mr-8",
            isRTL && "flex-row-reverse ml-8 mr-0"
          )}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <span className="animate-spin">🔍</span>
            </div>
            <div className={cn("text-sm text-primary font-medium", isRTL && "text-right font-cairo")}>
              🖼️ جاري تحليل الصورة...
            </div>
          </div>
        )}
        
        {/* Loading indicator - Regular Analysis */}
        {isAnalyzing && !isAnalyzingImage && (
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

      {/* Chat Input with Loading Overlay */}
      <div className="flex-shrink-0 px-2 py-3 border-t bg-background relative">
        {/* Loading Overlay - Prevents double-clicks */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-primary font-medium">
                {isAnalyzingImage ? 'جاري تحليل الصورة...' : 'جاري التحليل...'}
              </span>
            </div>
          </div>
        )}
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
