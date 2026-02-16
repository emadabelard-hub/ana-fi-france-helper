import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Brain, Camera, Paperclip, Send, Loader2 } from 'lucide-react';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import { streamProAdminAssistant } from '@/hooks/useStreamingChat';
import { useToast } from '@/hooks/use-toast';
import QuickActionsBar from '@/components/assistant/QuickActionsBar';
import DocumentActionButtons from '@/components/assistant/DocumentActionButtons';
import { extractTextFromPDF } from '@/lib/pdfExtractor';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Detected document type after AI analysis */
  detectedDocType?: 'invoice' | 'letter' | null;
}

/**
 * Detect document type from AI response content.
 * Returns 'invoice' for quotes/invoices, 'letter' for official letters/mail, or null.
 */
function detectDocumentType(aiResponse: string): 'invoice' | 'letter' | null {
  const lower = aiResponse.toLowerCase();

  // Invoice / Quote keywords (French + Arabic)
  const invoiceKeywords = [
    'facture', 'devis', 'montant total', 'total ttc', 'total ht', 'tva',
    'فاتورة', 'دوفي', 'المبلغ الإجمالي', 'ضريبة', 'سعر',
    'ligne de facturation', 'bon de commande', 'numéro de facture',
    'prix unitaire', 'quantité', 'sous-total',
  ];

  // Letter / Mail keywords (French + Arabic)
  const letterKeywords = [
    'courrier', 'lettre recommandée', 'madame, monsieur', 'objet :',
    'nous vous informons', 'veuillez agréer', 'accusé de réception',
    'préfecture', 'caf', 'cpam', 'pôle emploi', 'urssaf',
    'mise en demeure', 'notification', 'convocation', 'délai',
    'جواب', 'خطاب رسمي', 'إشعار', 'مهلة', 'بريفكتير',
    'كاف', 'موعد', 'استدعاء', 'إنذار',
  ];

  const invoiceScore = invoiceKeywords.filter(k => lower.includes(k)).length;
  const letterScore = letterKeywords.filter(k => lower.includes(k)).length;

  if (invoiceScore >= 2) return 'invoice';
  if (letterScore >= 2) return 'letter';
  return null;
}

const AssistantPage = () => {
  const navigate = useNavigate();
  const { isRTL, language, t } = useLanguage();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
            // Detect document type from completed response
            const docType = detectDocumentType(assistantContent);
            if (docType) {
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, detectedDocType: docType } : m)
              );
            }
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

  /** Process uploaded file: PDF → extract text, Image → send as vision */
  const handleFileUpload = async (file: File, fromCamera: boolean = false) => {
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'الملف كبير' : 'Fichier trop volumineux',
        description: isRTL ? 'الحد الأقصى 10 ميجا' : 'Maximum 10 Mo',
      });
      return;
    }

    const isPDF = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPDF && !isImage) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL
          ? 'يرجى رفع صورة (JPG/PNG) أو ملف PDF فقط'
          : 'Veuillez télécharger une image (JPG/PNG) ou un fichier PDF uniquement.',
      });
      return;
    }

    // Read file as data URL
    const readAsDataURL = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('File read error'));
        reader.readAsDataURL(f);
      });

    try {
      if (isPDF) {
        // PDF → extract text client-side (no vision cost)
        setIsExtractingPdf(true);
        toast({
          title: isRTL ? '📄 جاري قراءة الـ PDF...' : '📄 Lecture du PDF en cours...',
        });

        const dataUrl = await readAsDataURL(file);
        const extractedText = await extractTextFromPDF(dataUrl);
        setIsExtractingPdf(false);

        if (!extractedText.trim()) {
          // PDF has no extractable text → fallback to vision (scanned PDF)
          toast({
            title: isRTL ? '📷 PDF ممسوح، جاري التحليل بالصورة...' : '📷 PDF scanné, analyse par image...',
          });
          handleSend(
            language === 'fr'
              ? 'Analysez ce document PDF et expliquez-moi son contenu'
              : 'حلل المستند ده وقولي إيه المكتوب فيه',
            dataUrl
          );
          return;
        }

        // Send extracted text to AI (much cheaper than vision)
        const prompt = language === 'fr'
          ? `Voici le contenu extrait d'un document PDF :\n\n${extractedText}\n\nAnalysez ce document et expliquez-moi son contenu.`
          : `ده محتوى ملف PDF:\n\n${extractedText}\n\nحلل المستند ده وقولي إيه المكتوب فيه وإيه المطلوب مني.`;
        handleSend(prompt);
      } else {
        // Image → use vision/OCR
        const base64 = await readAsDataURL(file);
        const imagePrompt = language === 'fr'
          ? 'Analysez ce document et expliquez-moi son contenu'
          : 'حلل المستند ده وقولي إيه المكتوب فيه';
        handleSend(imagePrompt, base64);
      }
    } catch (error) {
      console.error('File processing error:', error);
      setIsExtractingPdf(false);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL
          ? 'حدث خطأ أثناء معالجة الملف. حاول مرة تانية.'
          : 'Erreur lors du traitement du fichier. Réessayez.',
      });
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileUpload(file, false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileUpload(file, true);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleGenerateReply = () => {
    const replyPrompt = language === 'fr'
      ? 'Rédigez une réponse formelle à ce courrier.'
      : 'اكتبلي رد رسمي على الخطاب ده.';
    handleSend(replyPrompt);
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
          navigate('/courrier');
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
          <React.Fragment key={msg.id}>
            <div className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              
              {/* AI Avatar */}
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                  <Brain size={14} className="text-primary" />
                </div>
              )}

              {/* Message Bubble - Simple */}
              <div className={cn(
                "max-w-[85%] p-3 px-4 rounded-2xl shadow-sm",
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-br-none' 
                  : 'bg-card text-card-foreground rounded-tl-none border border-border',
              )}>
                {msg.role === 'user' ? (
                  <span className={cn("text-[15px] leading-relaxed whitespace-pre-wrap", isArabic(msg.content) ? 'font-cairo text-right' : 'text-left')}>
                    {msg.content || ''}
                  </span>
                ) : (
                  <MarkdownRenderer content={msg.content || (isTyping ? '...' : '')} isRTL={isArabic(msg.content)} className="text-[15px]" onSmartLinkClick={(type) => {
                    if (type === 'cv') navigate('/pro/cv-generator');
                    else if (type === 'pro') navigate('/pro/invoice-creator');
                    else if (type === 'solutions') navigate('/premium-consultation');
                  }} />
                )}
              </div>
            </div>

            {/* Document Action Buttons - After assistant messages with detected type */}
            {msg.role === 'assistant' && msg.detectedDocType && (
              <DocumentActionButtons
                documentType={msg.detectedDocType}
                isRTL={isRTL}
                onGenerateReply={handleGenerateReply}
              />
            )}
          </React.Fragment>
        ))}
        
        {/* PDF Extraction Indicator */}
        {isExtractingPdf && (
          <div className="flex items-center gap-2 p-3 bg-card rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
              {isRTL ? '📄 جاري قراءة ملف الـ PDF...' : '📄 Lecture du PDF en cours...'}
            </span>
          </div>
        )}

        {/* Typing Indicator */}
        {isTyping && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-2 p-3 bg-card rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
              {t('chat.thinking')}
            </span>
          </div>
        )}
        
        {/* Spacer */}
        <div className="h-64 w-full shrink-0" aria-hidden="true" />
        <div ref={messagesEndRef} />
      </div>

      {/* Hidden file inputs */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*,application/pdf" 
        className="hidden" 
        onChange={handleFileInputChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />

      {/* INPUT AREA - Fixed at bottom */}
      <div className="fixed left-0 right-0 z-[60] bg-background border-t border-border safe-area-pb" style={{ bottom: '5rem' }}>
        <div className="mx-3 mt-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('chat.placeholder')}
            className={cn(
              "w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[15px] leading-relaxed outline-none text-foreground placeholder:text-muted-foreground",
              isRTL && "font-cairo text-right"
            )}
            dir="auto"
            disabled={isTyping || isExtractingPdf}
            rows={5}
          />

          <div className={cn(
            "flex items-center justify-between px-3 pb-2.5",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
              {/* Camera Button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isTyping || isExtractingPdf}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                title={isRTL ? '📷 صورة' : '📷 Photo'}
              >
                <Camera size={20} />
              </button>
              {/* Attach File Button (PDF + Images) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping || isExtractingPdf}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                title={isRTL ? '📎 ملف (PDF/صورة)' : '📎 Fichier (PDF/Image)'}
              >
                <Paperclip size={20} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isTyping || isExtractingPdf}
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

        <div className="overflow-x-auto px-3 pt-1 pb-2">
          <QuickActionsBar onAction={(action) => handleActionClick(action)} />
        </div>
      </div>

      <style>{`
        .safe-area-pb { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default AssistantPage;
