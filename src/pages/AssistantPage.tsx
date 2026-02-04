import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import ChatMessage from '@/components/assistant/ChatMessage';
import ChatInput from '@/components/assistant/ChatInput';
import AttachedDocuments, { AttachedDocument } from '@/components/assistant/AttachedDocuments';
import MissingInfoForm from '@/components/assistant/MissingInfoForm';
import DispatchGuide from '@/components/assistant/DispatchGuide';
import PostAnalysisActions from '@/components/assistant/PostAnalysisActions';
import DocumentTypeSelector, { DocumentFormData } from '@/components/assistant/DocumentTypeSelector';
import LoadingOverlay from '@/components/shared/LoadingOverlay';
import { RefreshCw, RotateCcw } from 'lucide-react';
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

interface ExtractedInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subject?: string;
  documentDate?: string;
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
  // Document analysis workflow
  isDocumentAnalysis?: boolean;
  extractedInfo?: ExtractedInfo;
  // Letter suggestion workflow - AI suggests, user clicks Yes
  showLetterSuggestion?: boolean;
  // Envelope helper - show after letter generation
  showEnvelopeHelper?: boolean;
  // Track which documents were referenced in this message
  referencedDocumentIds?: string[];
}

const CHAT_STORAGE_KEY = 'assistant_chat_messages';
const DOCUMENTS_STORAGE_KEY = 'assistant_session_documents';

const extractLetterFromContent = (raw: string): { cleaned: string; letterContent?: string } => {
  const marker = '===الرسالة_الرسمية===';
  if (!raw.includes(marker)) return { cleaned: raw };
  const parts = raw.split(marker);
  const cleaned = (parts[0] || '').trim();
  const letter = (parts[1] || '').trim();
  return { cleaned: cleaned || '✅ Document Ready', letterContent: letter || undefined };
};

const toConversationHistory = (msgs: Message[]) => {
  return msgs.map(m => {
    if (m.letterContent) {
      const subject = m.dispatchInfo?.subjectLine;
      return {
        role: m.role,
        content: `✅ Document Ready${subject ? `: ${subject}` : ''}`,
      };
    }
    // Backward-compat: strip legacy inline marker if present
    const extracted = extractLetterFromContent(m.content);
    return {
      role: m.role,
      content: extracted.cleaned,
    };
  });
};

const AssistantPage = () => {
  const { t, isRTL } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  // Multi-document session state
  const [sessionDocuments, setSessionDocuments] = useState<AttachedDocument[]>([]);
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
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  // Letter generation state
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [pendingLetterMessageId, setPendingLetterMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages AND documents from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
    const savedDocuments = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    
    // Load documents first
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
          const cleanedMessages = parsed.map((m: Message) => {
            const extracted = extractLetterFromContent(m.content);
            return {
              ...m,
              content: extracted.cleaned,
              letterContent: m.letterContent || extracted.letterContent,
              showMissingInfoForm: false,
            };
          });
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
    localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    setMessages([]);
    setSessionDocuments([]);
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
  }, [messages, pendingLetterMessage]);

  const clearChat = () => {
    setMessages([]);
    setSessionDocuments([]);
    setPendingLetterMessage(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
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
    setSessionDocuments([]);
    setPendingLetterMessage(null);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    setShowNewTopicConfirm(false);
    toast({
      title: isRTL ? "تم بدء موضوع جديد" : "Nouvelle discussion commencée",
      description: isRTL ? "يمكنك بدء محادثة جديدة" : "Vous pouvez commencer une nouvelle conversation",
    });
  };

  // Handler to add document to session
  const handleDocumentAdd = (doc: AttachedDocument) => {
    setSessionDocuments(prev => [...prev, doc]);
  };

  // Handler to remove document from session
  const handleDocumentRemove = (docId: string) => {
    setSessionDocuments(prev => prev.filter(d => d.id !== docId));
  };

  // Handle document form submission - generates structured request
  const handleDocumentFormSubmit = (formData: DocumentFormData) => {
    setShowDocumentSelector(false);
    
    let userMessage = '';
    
    if (formData.type === 'lettre' || formData.type === 'email') {
      userMessage = isRTL 
        ? `اكتبلي ${formData.type === 'lettre' ? 'خطاب رسمي' : 'إيميل رسمي'} لـ ${formData.recipientName}${formData.recipientAddress ? ` على العنوان: ${formData.recipientAddress}` : ''}.
الموضوع: ${formData.subject}
التفاصيل: ${formData.description}`
        : `Rédigez ${formData.type === 'lettre' ? 'une lettre officielle' : 'un email professionnel'} à ${formData.recipientName}${formData.recipientAddress ? ` à l'adresse: ${formData.recipientAddress}` : ''}.
Objet: ${formData.subject}
Détails: ${formData.description}`;
    } else {
      // Devis or Facture
      const docType = formData.type === 'devis' ? (isRTL ? 'تقدير (Devis)' : 'Devis') : (isRTL ? 'فاتورة (Facture)' : 'Facture');
      const header = formData.companyHeader;
      
      userMessage = isRTL
        ? `اعملي ${docType} من:
🏢 الشركة: ${header.companyName}
📍 SIRET: ${header.siret}
📍 العنوان: ${header.address}
📞 التليفون: ${header.phone}
📧 الإيميل: ${header.email}

👤 للعميل: ${formData.clientName}
📍 عنوان العميل: ${formData.clientAddress}

📋 الشغل:
${formData.items}`
        : `Créez ${docType === 'Devis' ? 'un Devis' : 'une Facture'} de:
🏢 Entreprise: ${header.companyName}
📍 SIRET: ${header.siret}
📍 Adresse: ${header.address}
📞 Téléphone: ${header.phone}
📧 Email: ${header.email}

👤 Pour le client: ${formData.clientName}
📍 Adresse client: ${formData.clientAddress}

📋 Travaux:
${formData.items}`;
    }

    // Send the message
    handleSend(userMessage);
  };

  const handleRetry = (retryData: { message: string; image?: string }) => {
    // Remove the error message first
    setMessages(prev => prev.filter(m => !m.isError));
    // Retry the request (mark as retry to avoid duplicating user message)
    handleSend(retryData.message, retryData.image, true);
  };

  const handleSend = async (userMessage: string, image?: string, isRetry: boolean = false) => {
    // Wrap entire function in try/catch to prevent app crashes
    try {
      // Allow sending if there's text OR if there are session documents (for cross-doc questions)
      const hasSessionDocs = sessionDocuments.length > 0;
      if (!userMessage.trim() && !image && !hasSessionDocs) return;

      // Check if too many documents (prevent memory overflow)
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

      // Detect if this is an image analysis request (direct image or session docs)
      const hasImage = !!image;
      const hasNewDocs = hasImage || hasSessionDocs;
      let processedImage = image;

      // Compress image if present (new direct upload)
      if (hasImage && image && isImageData(image)) {
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

    // Build document context description for the user message
    let docContextLabel = '';
    if (hasSessionDocs) {
      const docCount = sessionDocuments.length;
      docContextLabel = isRTL 
        ? `[${docCount} مستند في الدوسيه]` 
        : `[${docCount} document(s) dans le dossier]`;
    }
    if (hasImage) {
      docContextLabel = docContextLabel 
        ? `${docContextLabel} + [صورة جديدة]` 
        : '[صورة مرفقة]';
    }

    // Create user message with document context
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: docContextLabel 
        ? `${docContextLabel}\n${userMessage || (isRTL ? 'حلل المستندات دي' : 'Analysez ces documents')}`
        : userMessage,
      referencedDocumentIds: sessionDocuments.map(d => d.id),
    };

    // Add user message to chat (only if not a retry)
    if (!isRetry) {
      setMessages(prev => [...prev, userMsg]);
    }
    setIsAnalyzing(true);
    if (hasNewDocs) {
      setIsAnalyzingImage(true);
    }

    // Helper function to make the API call with optional retry
    const makeRequest = async (attemptNumber: number = 1): Promise<void> => {
      try {
        // Build conversation history for context
        const currentMessages = isRetry ? messages : [...messages, userMsg];
        const conversationHistory = toConversationHistory(currentMessages);

        // Prepare all session documents for the API (compress images)
        const allDocumentImages: string[] = [];
        
        // Add session documents (compressed)
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
        
        // Add the new direct image if present
        if (processedImage) {
          allDocumentImages.push(processedImage);
        }

        // Build document context for AI
        const documentContextDescription = sessionDocuments.length > 0
          ? `The user has ${sessionDocuments.length} document(s) in their session dossier. They may ask questions about any or all of them. Treat all documents as part of the same case file.`
          : undefined;

        const { data, error } = await supabase.functions.invoke('analyze-request', {
          body: { 
            userMessage: userMessage || (isRTL ? 'حلل المستندات دي وقولي إيه المكتوب فيها' : 'Analysez ces documents'),
            conversationHistory,
            imageData: allDocumentImages.length === 1 ? allDocumentImages[0] : undefined,
            multipleImages: allDocumentImages.length > 1 ? allDocumentImages : undefined,
            documentContext: documentContextDescription,
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
           // If a formal document was generated, DO NOT inline-render it in chat.
           // We'll store it separately and show a “Document Ready” card instead.
           const hasGeneratedDocument =
             !!data.formalLetter &&
             data.formalLetter !== "لو عايز أكتبلك رد رسمي، قولي 'اكتبلي رد'";

           if (hasGeneratedDocument) {
             assistantContent += isRTL
               ? `✅ تم تجهيز المستند. افتحه من زر \"Open Document\".`
               : `✅ Document prêt. Ouvrez-le via le bouton \"Open Document\".`;
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

          // Detect if this is a document analysis (has explanation and action plan, and was image analysis)
          const isDocAnalysis = hasImage && (data.explanation || data.actionPlan);
          
          // Extract info from the response for smart reply - use extracted sender as recipient
          const extractedInfo: ExtractedInfo | undefined = {
            recipientName: data.dispatchInfo?.recipientName,
            recipientAddress: data.dispatchInfo?.recipientAddress,
            referenceNumber: data.dispatchInfo?.referenceNumber,
            subject: data.dispatchInfo?.subjectLine,
          };

          // Check if we have valid extracted info (at least a name)
          const hasExtractedRecipient = !!extractedInfo.recipientName;

          // Detect if AI is suggesting to write a letter
          const hasSuggestion = assistantContent.includes('تحب أكتبلك خطاب رسمي') || 
                                assistantContent.includes("لو عايز أكتبلك رد رسمي، قولي") ||
                                assistantContent.includes("عشان تحل المشكلة؟");

          // Add assistant message with letter suggestion if applicable
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantContent.trim(),
            isDocumentAnalysis: isDocAnalysis,
            extractedInfo: hasExtractedRecipient ? extractedInfo : undefined,
            showLetterSuggestion: (isDocAnalysis || hasExtractedRecipient) && hasSuggestion && !data.formalLetter,
             letterContent: hasGeneratedDocument ? data.formalLetter : undefined,
             showEnvelopeHelper: hasGeneratedDocument,
             dispatchInfo: data.dispatchInfo,
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
    } catch (globalError) {
      // Global catch to prevent app crashes
      console.error('Critical error in handleSend:', globalError);
      setIsAnalyzing(false);
      setIsAnalyzingImage(false);
      
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL 
          ? "حدث خطأ غير متوقع. حاول مرة تانية."
          : "Erreur inattendue. Veuillez réessayer.",
      });
    }
  };


  const handleFormSubmit = async (formData: Record<string, string>) => {
    if (!pendingLetterMessage) return;

    setIsAnalyzing(true);

    try {
      // Build conversation history
      const conversationHistory = toConversationHistory(messages);

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
        content: isRTL
          ? `✅ Document Ready: ${data.dispatchInfo?.subjectLine || 'Lettre officielle'}`
          : `✅ Document Ready: ${data.dispatchInfo?.subjectLine || 'Lettre officielle'}`,
        showDispatchGuide: true,
        showEnvelopeHelper: true,
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

  // Handler for accepting letter suggestion with mode (email or courrier) - auto-generates with profile + extracted data
  const handleAcceptLetterSuggestion = async (messageId: string, extractedInfo?: ExtractedInfo, mode: 'email' | 'courrier' = 'courrier') => {
    if (!profile?.full_name || !profile?.address) {
      toast({
        variant: "destructive",
        title: isRTL ? "بيانات ناقصة" : "Données manquantes",
        description: isRTL 
          ? "من فضلك اكمل بياناتك في الملف الشخصي أولاً (الاسم والعنوان)" 
          : "Veuillez compléter votre profil (nom et adresse)",
      });
      return;
    }

    setIsGeneratingLetter(true);
    setPendingLetterMessageId(messageId);

    try {
      // Get the last analysis message for context
      const lastAnalysisMessage = messages.filter(m => m.role === 'assistant' && m.isDocumentAnalysis).slice(-1)[0];
      
      const documentType = mode === 'email' ? 'إيميل رسمي' : 'خطاب رسمي مسجل';
      
      // Build generation request using profile data + extracted info
      const letterRequest = `اكتب ${documentType} بالفرنسي على المستند اللي حللناه.

معلومات المرسل (من الملف الشخصي):
- الاسم: ${profile.full_name}
- العنوان: ${profile.address}
- التليفون: ${profile.phone || 'غير محدد'}

المرسل إليه (من المستند):
- الجهة: ${extractedInfo?.recipientName || 'الجهة المختصة'}
- العنوان: ${extractedInfo?.recipientAddress || 'غير محدد'}

المرجع: ${extractedInfo?.referenceNumber || 'حسب المستند'}
الموضوع: ${extractedInfo?.subject || 'رد على المستند'}

نوع الإرسال: ${mode === 'email' ? 'Email' : 'Lettre Recommandée avec AR'}

السياق: ${lastAnalysisMessage?.content || 'بناءً على المستند المرفق'}`;

      // Build conversation history
      const conversationHistory = toConversationHistory(messages);

      const { data, error } = await supabase.functions.invoke('analyze-request', {
        body: { 
          userMessage: letterRequest,
          conversationHistory: [...conversationHistory, { role: 'user', content: 'اكتبلي الخطاب الرسمي' }],
          generateLetterWithData: {
            full_name: profile.full_name,
            address: profile.address,
            phone: profile.phone,
            recipient_name: extractedInfo?.recipientName || 'الجهة المختصة',
            reference_number: extractedInfo?.referenceNumber,
          },
          profile: {
            full_name: profile.full_name,
            address: profile.address,
            phone: profile.phone,
            caf_number: profile.caf_number,
            foreigner_number: profile.foreigner_number,
            social_security: profile.social_security,
          }
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

      // Hide the suggestion button from the original message
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, showLetterSuggestion: false }
          : m
      ));

      // Add the generated letter as a new message with envelope helper
      const letterMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `✅ Document Ready: ${extractedInfo?.subject || data.dispatchInfo?.subjectLine || 'Lettre officielle'}`,
        showDispatchGuide: true,
        showEnvelopeHelper: true,
        dispatchInfo: {
          recipientName: extractedInfo?.recipientName || data.dispatchInfo?.recipientName,
          recipientAddress: extractedInfo?.recipientAddress || data.dispatchInfo?.recipientAddress,
          referenceNumber: extractedInfo?.referenceNumber || data.dispatchInfo?.referenceNumber,
          subjectLine: extractedInfo?.subject || data.dispatchInfo?.subjectLine,
        },
        letterContent: data.formalLetter,
      };

      setMessages(prev => [...prev, letterMsg]);

    } catch (error) {
      console.error('Error generating letter:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "حدث خطأ أثناء كتابة الخطاب" : "Une erreur est survenue lors de la rédaction.",
      });
    } finally {
      setIsGeneratingLetter(false);
      setPendingLetterMessageId(null);
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

      <div className="flex flex-col h-[calc(100vh-90px)] pb-12">
        {/* Compact Title with New Topic Button */}
        <section className={cn("text-center py-2 flex-shrink-0 relative", isRTL && "font-cairo")}>
          <h1 className="text-xl font-bold text-foreground">
            {isRTL ? '🇪🇬 أريد حلاً' : '🇪🇬 Je veux une solution'}
          </h1>
          
          {/* New Topic Button */}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewTopicClick}
              className={cn(
                "absolute top-2 text-muted-foreground hover:text-primary",
                isRTL ? "left-1" : "right-1"
              )}
              title={isRTL ? "موضوع جديد" : "Nouveau sujet"}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </section>

      {/* Chat Messages Area - generous padding for readability */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-5">
        {messages.length === 0 ? (
          <div className={cn(
            "flex flex-col items-center justify-center h-full text-center text-muted-foreground px-6",
            isRTL && "font-cairo"
          )}>
            <div className="text-6xl mb-3">🇪🇬</div>
            <p className="text-xl font-semibold text-foreground">
              {isRTL ? 'أهلاً بيك يا صاحبي!' : 'Bienvenue!'}
            </p>
            <p className="text-base mt-2 max-w-sm leading-relaxed">
              {isRTL 
                ? 'صوّر أي جواب وصلك 📷 أو اكتب سؤالك وأنا هشرحلك بالمصري 😊'
                : 'Photographiez une lettre 📷 ou posez votre question'}
            </p>
            <div className={cn(
              "flex items-center gap-3 mt-4 text-sm text-muted-foreground",
              isRTL && "flex-row-reverse"
            )}>
              <span>📷</span>
              <span>{isRTL ? 'صورة' : 'Photo'}</span>
              <span className="text-muted-foreground/40">|</span>
              <span>📎</span>
              <span>{isRTL ? 'ملف' : 'Fichier'}</span>
              <span className="text-muted-foreground/40">|</span>
              <span>✏️</span>
              <span>{isRTL ? 'نص' : 'Texte'}</span>
            </div>
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
                  isDocumentAnalysis={message.isDocumentAnalysis}
                  extractedInfo={message.extractedInfo}
                  showLetterSuggestion={false}
                  isGeneratingLetter={isGeneratingLetter && pendingLetterMessageId === message.id}
                  showEnvelopeHelper={message.showEnvelopeHelper}
                  dispatchInfo={message.dispatchInfo}
                  letterContent={message.letterContent}
                />
              )}
              
              {/* Smart Action Buttons - Show after document analysis (when no letter yet) */}
              {message.isDocumentAnalysis && !message.letterContent && message.role === 'assistant' && (
                <PostAnalysisActions
                  onContinueChat={() => {
                    // Focus on input - just allow user to type next question
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  onDraftReply={(mode) => handleAcceptLetterSuggestion(message.id, message.extractedInfo, mode)}
                  extractedInfo={message.extractedInfo}
                  isRTL={isRTL}
                  isGenerating={isGeneratingLetter && pendingLetterMessageId === message.id}
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
              "flex gap-4 p-4 sm:p-5 rounded-xl bg-primary/10 mx-4 sm:mx-6",
              isRTL ? "flex-row-reverse ml-8 sm:ml-12" : "mr-8 sm:mr-12"
            )}>
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <span className="animate-spin">🔍</span>
              </div>
              <div className={cn("flex-1 pr-2 text-base text-primary font-medium", isRTL && "text-right font-cairo leading-[1.8]")}>
                {isRTL ? '🖼️ جاري تحليل الصورة...' : 'Analyse de l\'image en cours...'}
              </div>
            </div>
          )}
          
          {/* Loading indicator - Regular Analysis */}
          {isAnalyzing && !pendingLetterMessage && !isAnalyzingImage && (
            <div className={cn(
              "flex gap-4 p-4 sm:p-5 rounded-xl bg-muted/50 mx-4 sm:mx-6",
              isRTL ? "flex-row-reverse ml-8 sm:ml-12" : "mr-8 sm:mr-12"
            )}>
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                <span className="animate-pulse">🤔</span>
              </div>
              <div className={cn("flex-1 pr-2 text-base text-muted-foreground", isRTL && "text-right font-cairo leading-[1.8]")}>
                {isRTL ? 'جار التحليل...' : 'Analyse en cours...'}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Session Documents Display - Above Input */}
        <AttachedDocuments
          documents={sessionDocuments}
          onRemove={handleDocumentRemove}
          isRTL={isRTL}
          disabled={isAnalyzing}
        />

        {/* Input Area - Compact fixed at bottom */}
        <div className="flex-shrink-0 p-2 border-t bg-background relative">
          {/* Loading Overlay - Prevents double-clicks */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-primary font-medium">
                  {isAnalyzingImage 
                    ? (isRTL ? '🖼️ جاري تحليل الصورة...' : '🖼️ Analyse...') 
                    : (isRTL ? '⏳ جاري التحليل...' : '⏳ Analyse...')}
                </span>
              </div>
            </div>
          )}
          <ChatInput
            onSend={handleSend}
            onDocumentAdd={handleDocumentAdd}
            isLoading={isAnalyzing}
            isRTL={isRTL}
            t={t}
            externalDocumentsMode={true}
          />
        </div>
      </div>

      {/* Full-screen Loading Overlay for document analysis */}
      <LoadingOverlay
        isVisible={isAnalyzingImage}
        text={isRTL ? '📄 تحليل المستندات...' : '📄 Analyse des documents...'}
        subText={isRTL ? 'يرجى الانتظار لحظات' : 'Veuillez patienter quelques instants'}
        isRTL={isRTL}
      />

      {/* Document Type Selector Modal */}
      <DocumentTypeSelector
        isOpen={showDocumentSelector}
        onClose={() => setShowDocumentSelector(false)}
        onSubmit={handleDocumentFormSubmit}
        isRTL={isRTL}
      />

      {/* Smart Reply Form removed - now using inline auto-generation */}
    </>
  );
};

export default AssistantPage;
