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
import { ChevronDown, HelpCircle, Trash2, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { compressImage, isImageData, getFileSizeKB } from '@/lib/imageCompression';

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
  isError?: boolean;
  errorType?: 'auth' | 'timeout' | 'generic';
  retryData?: { message: string; image?: string };
}

const CHAT_STORAGE_KEY = 'assistant_chat_messages';

const AssistantPage = () => {
  const { t, isRTL } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [pendingLetterMessage, setPendingLetterMessage] = useState<{
    messageId: string;
    missingFields: MissingField[];
    letterContext: string;
  } | null>(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [showNewTopicConfirm, setShowNewTopicConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from localStorage on mount and show session dialog
  useEffect(() => {
    const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Show session dialog to ask user if they want to continue
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
    setShowSessionDialog(false);
  };

  const handleNewSession = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([]);
    setPendingLetterMessage(null);
    setShowSessionDialog(false);
  };

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

  const handleNewTopicClick = () => {
    if (messages.length > 0) {
      setShowNewTopicConfirm(true);
    }
  };

  const confirmNewTopic = () => {
    setMessages([]);
    setPendingLetterMessage(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setShowNewTopicConfirm(false);
    toast({
      title: isRTL ? "تم بدء موضوع جديد" : "Nouvelle discussion commencée",
      description: isRTL ? "يمكنك بدء محادثة جديدة" : "Vous pouvez commencer une nouvelle conversation",
    });
  };

  const handleRetry = (retryData: { message: string; image?: string }) => {
    // Remove the error message first
    setMessages(prev => prev.filter(m => !m.isError));
    // Retry the request (mark as retry to avoid duplicating user message)
    handleSend(retryData.message, retryData.image, true);
  };

  const handleSend = async (userMessage: string, image?: string, isRetry: boolean = false) => {
    if (!userMessage.trim() && !image) return;

    // Detect if this is an image analysis request
    const hasImage = !!image;
    let processedImage = image;

    // Compress image if present
    if (hasImage && image && isImageData(image)) {
      try {
        const originalSize = getFileSizeKB(image);
        console.log(`Original image size: ${originalSize}KB`);
        processedImage = await compressImage(image);
        const compressedSize = getFileSizeKB(processedImage);
        console.log(`Compressed image size: ${compressedSize}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`);
      } catch (compressionError) {
        console.error('Image compression failed, using original:', compressionError);
        // Continue with original image if compression fails
      }
    }

    // Create user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: hasImage ? `[صورة مرفقة]\n${userMessage || 'حلل الصورة دي'}` : userMessage,
    };

    // Add user message to chat (only if not a retry)
    if (!isRetry) {
      setMessages(prev => [...prev, userMsg]);
    }
    setIsAnalyzing(true);
    if (hasImage) {
      setIsAnalyzingImage(true);
    }

    // Helper function to make the API call with optional retry
    const makeRequest = async (attemptNumber: number = 1): Promise<void> => {
      try {
        // Build conversation history for context
        const currentMessages = isRetry ? messages : [...messages, userMsg];
        const conversationHistory = currentMessages.map(m => ({
          role: m.role,
          content: m.content,
        }));

        const { data, error } = await supabase.functions.invoke('analyze-request', {
          body: { 
            userMessage: userMessage || 'حلل الصورة دي وقولي إيه المكتوب فيها',
            conversationHistory,
            imageData: processedImage, // Pass the compressed base64 image data
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
          // Determine error type for better messaging
          const status = (error as any)?.status || 500;
          const isRetryableError = status === 500 || status === 504 || error.message?.includes('timeout');
          
          // Auto-retry once for timeout/server errors (only on first attempt)
          if (isRetryableError && attemptNumber === 1) {
            toast({
              title: isRTL ? 'الشبكة ضعيفة، بحاول تاني...' : 'Connexion faible, nouvelle tentative...',
              description: isRTL ? 'انتظر لحظة...' : 'Veuillez patienter...',
            });
            
            // Wait 2 seconds before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return makeRequest(2);
          }

          let errorType: 'auth' | 'timeout' | 'generic' = 'generic';
          let errorMessage = '';

          if (status === 401 || status === 403) {
            errorType = 'auth';
            errorMessage = isRTL 
              ? '⚠️ تأكد من إعدادات مفتاح الذكاء الاصطناعي (API Key).'
              : '⚠️ Vérifiez la configuration de la clé API.';
          } else if (isRetryableError) {
            errorType = 'timeout';
            errorMessage = isRTL 
              ? '⏱️ الصورة كبيرة جداً أو حصل مشكلة في السيرفر. حاول مرة تانية أو استخدم صورة أصغر.'
              : '⏱️ Image trop volumineuse ou problème serveur. Réessayez ou utilisez une image plus petite.';
          } else {
            errorMessage = isRTL 
              ? '❌ حدث خطأ أثناء التحليل. حاول مرة تانية.'
              : '❌ Une erreur est survenue. Veuillez réessayer.';
          }

          // Add error message with retry capability
          const errorMsg: Message = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: errorMessage,
            isError: true,
            errorType,
            retryData: { message: userMessage, image: processedImage },
          };
          setMessages(prev => [...prev, errorMsg]);
          return;
        }

        if (data.error) {
          // Check if it's a specific error type from the edge function
          const isRetryableDataError = data.error.includes('timeout') || data.error.includes('volumineuse') || data.error.includes('504') || data.error.includes('500');
          
          // Auto-retry once for timeout/server errors (only on first attempt)
          if (isRetryableDataError && attemptNumber === 1) {
            toast({
              title: isRTL ? 'الشبكة ضعيفة، بحاول تاني...' : 'Connexion faible, nouvelle tentative...',
              description: isRTL ? 'انتظر لحظة...' : 'Veuillez patienter...',
            });
            
            // Wait 2 seconds before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            return makeRequest(2);
          }

          let errorType: 'auth' | 'timeout' | 'generic' = 'generic';
          let errorMessage = data.error;

          if (data.error.includes('API') || data.error.includes('clé')) {
            errorType = 'auth';
            errorMessage = isRTL 
              ? '⚠️ تأكد من إعدادات مفتاح الذكاء الاصطناعي (API Key).'
              : '⚠️ Vérifiez la configuration de la clé API.';
          } else if (isRetryableDataError) {
            errorType = 'timeout';
            errorMessage = isRTL 
              ? '⏱️ الصورة كبيرة جداً. حاول مرة تانية بصورة أصغر أو جودة أقل.'
              : '⏱️ Image trop volumineuse. Réessayez avec une image plus petite.';
          }

          const errorMsg: Message = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: errorMessage,
            isError: true,
            errorType,
            retryData: { message: userMessage, image: processedImage },
          };
          setMessages(prev => [...prev, errorMsg]);
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
        
        const errorStr = String(error);
        const isRetryableError = errorStr.includes('timeout') || errorStr.includes('500') || errorStr.includes('504') || errorStr.includes('network');
        
        // Auto-retry once for timeout/server errors (only on first attempt)
        if (isRetryableError && attemptNumber === 1) {
          toast({
            title: isRTL ? 'الشبكة ضعيفة، بحاول تاني...' : 'Connexion faible, nouvelle tentative...',
            description: isRTL ? 'انتظر لحظة...' : 'Veuillez patienter...',
          });
          
          // Wait 2 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          return makeRequest(2);
        }
        
        // Determine error type
        let errorType: 'auth' | 'timeout' | 'generic' = 'generic';
        let errorMessage = '';

        if (errorStr.includes('401') || errorStr.includes('403') || errorStr.includes('API')) {
          errorType = 'auth';
          errorMessage = isRTL 
            ? '⚠️ تأكد من إعدادات مفتاح الذكاء الاصطناعي (API Key).'
            : '⚠️ Vérifiez la configuration de la clé API.';
        } else if (isRetryableError) {
          errorType = 'timeout';
          errorMessage = isRTL 
            ? '⏱️ الصورة كبيرة جداً أو حصل مشكلة في السيرفر. حاول مرة تانية أو استخدم صورة أصغر.'
            : '⏱️ Image trop volumineuse ou problème serveur. Réessayez ou utilisez une image plus petite.';
        } else {
          errorMessage = isRTL 
            ? '❌ حدث خطأ أثناء التحليل. حاول مرة تانية.'
            : '❌ Une erreur est survenue. Veuillez réessayer.';
        }

        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          isError: true,
          errorType,
          retryData: { message: userMessage, image: processedImage },
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    };

    // Start the request with retry mechanism
    await makeRequest(1);
    
    setIsAnalyzing(false);
    setIsAnalyzingImage(false);
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
    <>
      {/* Session Continue Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className={cn("sm:max-w-[400px]", isRTL && "font-cairo text-right")}>
          <DialogHeader>
            <DialogTitle className="text-lg">
              {isRTL ? '🔄 نكمل الكلام في الموضوع القديم؟' : 'Continuer la discussion précédente?'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {isRTL 
                ? 'لقيت محادثة قديمة محفوظة. عايز تكمل ولا تبدأ موضوع جديد؟'
                : 'Une conversation précédente a été trouvée. Voulez-vous continuer ou commencer une nouvelle?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={handleNewSession}>
              {isRTL ? '🆕 موضوع جديد' : 'Nouveau sujet'}
            </Button>
            <Button onClick={handleContinueSession}>
              {isRTL ? '✅ نكمل' : 'Continuer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Topic Confirmation Dialog */}
      <Dialog open={showNewTopicConfirm} onOpenChange={setShowNewTopicConfirm}>
        <DialogContent className={cn("sm:max-w-[400px]", isRTL && "font-cairo text-right")}>
          <DialogHeader>
            <DialogTitle className="text-lg">
              {isRTL ? '⚠️ بدء موضوع جديد؟' : 'Commencer un nouveau sujet?'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {isRTL 
                ? 'ده هيمسح المحادثة الحالية. متأكد؟'
                : 'Cela effacera la conversation actuelle. Êtes-vous sûr?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={() => setShowNewTopicConfirm(false)}>
              {isRTL ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button variant="destructive" onClick={confirmNewTopic}>
              {isRTL ? '🗑️ امسح وابدأ جديد' : 'Effacer et commencer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col h-[calc(100vh-140px)] pb-20">
        {/* Title with New Topic and Clear Buttons */}
        <section className={cn("text-center py-4 flex-shrink-0 relative", isRTL && "font-cairo")}>
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? 'أريد حلاً' : 'Je veux une solution'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'مساعدك الإداري المصري' : 'Votre assistant administratif'}
          </p>
          
          {/* New Topic Button - Always visible when there are messages */}
          {messages.length > 0 && (
            <div className={cn(
              "absolute top-4 flex items-center gap-1",
              isRTL ? "left-2" : "right-2"
            )}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewTopicClick}
                className="text-muted-foreground hover:text-primary"
                title={isRTL ? "موضوع جديد" : "Nouveau sujet"}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                {isRTL ? "جديد" : "Nouveau"}
              </Button>
            </div>
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
        
          {/* Loading indicator - Image Analysis */}
          {isAnalyzingImage && (
            <div className={cn(
              "flex gap-3 p-4 rounded-xl bg-primary/10 mr-8",
              isRTL && "flex-row-reverse"
            )}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <span className="animate-spin">🔍</span>
              </div>
              <div className={cn("text-sm text-primary font-medium", isRTL && "text-right font-cairo")}>
                {isRTL ? '🖼️ جاري تحليل الصورة...' : 'Analyse de l\'image en cours...'}
              </div>
            </div>
          )}
          
          {/* Loading indicator - Regular Analysis */}
          {isAnalyzing && !pendingLetterMessage && !isAnalyzingImage && (
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

        {/* Input Area - Fixed at bottom with loading overlay */}
        <div className="flex-shrink-0 p-3 border-t bg-background relative">
          {/* Loading Overlay - Prevents double-clicks */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-primary font-medium">
                  {isAnalyzingImage 
                    ? (isRTL ? 'جاري تحليل الصورة...' : 'Analyse de l\'image...') 
                    : (isRTL ? 'جاري التحليل...' : 'Analyse en cours...')}
                </span>
              </div>
            </div>
          )}
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
    </>
  );
};

export default AssistantPage;
