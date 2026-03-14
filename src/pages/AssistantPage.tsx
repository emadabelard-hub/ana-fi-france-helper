import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Brain, Camera, Paperclip, Send, Loader2, Mic } from 'lucide-react';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import { streamProAdminAssistant } from '@/hooks/useStreamingChat';
import { useToast } from '@/hooks/use-toast';
import DocumentActionButtons from '@/components/assistant/DocumentActionButtons';
import { extractTextFromPDF } from '@/lib/pdfExtractor';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import VoiceRecorderOverlay from '@/components/assistant/VoiceRecorderOverlay';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  detectedDocType?: 'invoice' | 'letter' | null;
}

/** Keywords that indicate the user wants a devis/quote */
const DEVIS_KEYWORDS = [
  // French
  'devis', 'chiffrer', 'combien coûte', 'prix de', 'estimation', 'pose de',
  'pose carrelage', 'peinture mur', 'travaux', 'rénovation', 'chantier',
  'installation', 'remplacement', 'démolition', 'création', 'réparation',
  // Arabic / Egyptian
  'سعر', 'تمن', 'كم سعر', 'تكلفة', 'دوفي', 'ديفي', 'شانتي',
  'تركيب', 'دهان', 'بوز', 'كاريلاج', 'بلومبري', 'سباكة',
  'كهربا', 'الكتريسيتي', 'شابة', 'بلاط', 'حيطان', 'سقف',
  'متر مربع', 'متر', 'حساب', 'قدر لي', 'عايز اعرف سعر',
];

function isDevisRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return DEVIS_KEYWORDS.some(k => lower.includes(k));
}

function detectDocumentType(aiResponse: string): 'invoice' | 'letter' | null {
  const lower = aiResponse.toLowerCase();
  const invoiceKeywords = [
    'facture', 'devis', 'montant total', 'total ttc', 'total ht', 'tva',
    'فاتورة', 'دوفي', 'المبلغ الإجمالي',
    'prix unitaire', 'quantité', 'sous-total',
  ];
  const letterKeywords = [
    'courrier', 'lettre recommandée', 'madame, monsieur', 'objet :',
    'veuillez agréer', 'accusé de réception',
    'préfecture', 'caf', 'cpam', 'pôle emploi',
    'جواب', 'خطاب رسمي', 'إشعار', 'بريفكتير',
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
  const voiceRecorder = useVoiceRecorder(isRTL ? 'ar-EG' : 'fr-FR');

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Voice: handled by useVoiceRecorder hook ──
  const handleVoiceSend = useCallback(() => {
    const text = voiceRecorder.stop();
    if (text.trim()) {
      setInputValue(prev => (prev ? prev + ' ' + text : text));
    }
  }, [voiceRecorder]);

  const handleVoiceMicPress = useCallback(() => {
    if (voiceRecorder.isRecording) return;
    if (!voiceRecorder.isSupported) {
      toast({ variant: 'destructive', title: isRTL ? 'غير مدعوم' : 'Non supporté', description: isRTL ? 'المتصفح لا يدعم التعرف على الصوت' : 'Navigateur non compatible' });
      return;
    }
    voiceRecorder.start();
  }, [voiceRecorder, isRTL, toast]);

  // ── Send Message ──
  const handleSend = async (messageText?: string, imageData?: string) => {
    const text = messageText || inputValue;
    if (!text.trim() && !imageData) return;

    // Stop voice if active
    if (isListening) stopListening();

    // Check if this is a devis request → route to Smart Devis
    if (text.trim() && isDevisRequest(text)) {
      navigate('/pro/smart-devis', { state: { prefillDescription: text.trim() } });
      toast({
        title: isRTL ? '📋 جاري تحويلك للديفي الذكي...' : '📋 Redirection vers le Devis Intelligent...',
      });
      return;
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text || (imageData ? '📷 صورة مرفقة' : ''),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    const conversationHistory = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const chatLanguage: 'fr' | 'ar' = language;
    let assistantContent = '';
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      await streamProAdminAssistant(
        { userMessage: text, imageData, conversationHistory, language: chatLanguage },
        {
          onDelta: (deltaText) => {
            assistantContent += deltaText;
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m));
          },
          onDone: () => {
            setIsTyping(false);
            const docType = detectDocumentType(assistantContent);
            if (docType) {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, detectedDocType: docType } : m));
            }
          },
          onError: (error) => {
            setIsTyping(false);
            const errorMessage = chatLanguage === 'fr'
              ? (error.status === 429 ? "Service surchargé — réessayez dans une minute." : error.status === 402 ? "Crédits IA indisponibles." : "Problème serveur — réessayez.")
              : (error.status === 429 ? 'الخدمة مشغولة، جرب تاني بعد شوية 🙏' : error.status === 402 ? 'الرصيد خلص 💳' : 'مشكلة في السيرفر، جرب تاني 🔄');
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: errorMessage } : m));
            toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: errorMessage });
          }
        }
      );
    } catch {
      setIsTyping(false);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'حصل مشكلة، جرب تاني 🔄' } : m));
    }
  };

  const handleFileUpload = async (file: File, fromCamera: boolean = false) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: isRTL ? 'الملف كبير' : 'Fichier trop volumineux', description: isRTL ? 'الحد الأقصى 10 ميجا' : 'Maximum 10 Mo' });
      return;
    }
    const isPDF = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPDF && !isImage) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'يرجى رفع صورة أو PDF فقط' : 'Image (JPG/PNG) ou PDF uniquement.' });
      return;
    }
    const readAsDataURL = (f: File): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target?.result as string); reader.onerror = () => reject(new Error('File read error')); reader.readAsDataURL(f); });
    try {
      if (isPDF) {
        setIsExtractingPdf(true);
        const dataUrl = await readAsDataURL(file);
        const extractedText = await extractTextFromPDF(dataUrl);
        setIsExtractingPdf(false);
        if (!extractedText.trim()) {
          handleSend(language === 'fr' ? 'Analysez ce document PDF' : 'حلل المستند ده', dataUrl);
          return;
        }
        const prompt = language === 'fr' ? `Voici le contenu d'un PDF :\n\n${extractedText}\n\nAnalysez ce document.` : `ده محتوى ملف PDF:\n\n${extractedText}\n\nحلل المستند ده.`;
        handleSend(prompt);
      } else {
        const base64 = await readAsDataURL(file);
        handleSend(language === 'fr' ? 'Analysez ce document' : 'حلل المستند ده', base64);
      }
    } catch {
      setIsExtractingPdf(false);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'خطأ في معالجة الملف' : 'Erreur lors du traitement.' });
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
    handleSend(language === 'fr' ? 'Rédigez une réponse formelle à ce courrier.' : 'اكتبلي رد رسمي على الخطاب ده.');
  };

  const hasMessages = messages.length > 0;

  // Subtitle tags
  const tags = ['chantier', 'رخصة', 'برفكتير', 'ماتريال', 'devis', 'travaux'];

  return (
    <div className="flex flex-col bg-background text-foreground font-sans -mx-2 -mt-20 -mb-14" style={{ height: 'calc(100vh)' }} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* HEADER */}
      <header className="bg-card p-3 pt-10 shadow-sm border-b border-border flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground">
          <ArrowLeft size={22} />
        </button>
        <div className="w-9 h-9 bg-gradient-to-r from-primary to-[hsl(280,70%,50%)] rounded-full flex items-center justify-center text-primary-foreground shadow">
          <Brain size={18} />
        </div>
        <div>
          <h1 className={cn("text-sm font-bold text-foreground", isRTL && "font-cairo")}>{t('chat.title')}</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <p className={cn("text-[10px] text-muted-foreground", isRTL && "font-cairo")}>{t('chat.subtitle')}</p>
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: '250px' }}>

        {/* Welcome */}
        {!hasMessages && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                <Brain size={14} className="text-primary" />
              </div>
              <div className="max-w-[85%] p-3 px-4 rounded-2xl rounded-tl-none bg-card text-card-foreground border border-border shadow-sm">
                <p className={cn("text-[15px] leading-relaxed", isRTL ? "font-cairo text-right" : "text-left")} dir={isRTL ? "rtl" : "ltr"}>
                  {t('chat.welcomeTitle')}<br />{t('chat.welcomeMessage')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <React.Fragment key={msg.id}>
            <div className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                  <Brain size={14} className="text-primary" />
                </div>
              )}
              <div className={cn(
                "max-w-[85%] p-3 px-4 rounded-2xl shadow-sm",
                msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card text-card-foreground rounded-tl-none border border-border',
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
            {msg.role === 'assistant' && msg.detectedDocType && (
              <DocumentActionButtons documentType={msg.detectedDocType} isRTL={isRTL} onGenerateReply={handleGenerateReply} />
            )}
          </React.Fragment>
        ))}

        {isExtractingPdf && (
          <div className="flex items-center gap-2 p-3 bg-card rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>{isRTL ? '📄 جاري قراءة الـ PDF...' : '📄 Lecture du PDF...'}</span>
          </div>
        )}

        {isTyping && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-2 p-3 bg-card rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>{t('chat.thinking')}</span>
          </div>
        )}

        <div className="h-64 w-full shrink-0" aria-hidden="true" />
        <div ref={messagesEndRef} />
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileInputChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraChange} />

      {/* INPUT AREA */}
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
            rows={3}
          />

          <div className={cn("flex items-center justify-between px-3 pb-2.5", isRTL && "flex-row-reverse")}>
            <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
              {/* Camera */}
              <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={isTyping || isExtractingPdf} className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors" title={isRTL ? '📷 صورة' : '📷 Photo'}>
                <Camera size={20} />
              </button>
              {/* File */}
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isTyping || isExtractingPdf} className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors" title={isRTL ? '📎 ملف' : '📎 Fichier'}>
                <Paperclip size={20} />
              </button>
              {/* Voice - Blue Mic Button */}
              <button
                type="button"
                onClick={toggleVoice}
                disabled={isTyping || isExtractingPdf}
                className={cn(
                  "p-2 rounded-full transition-all",
                  isListening
                    ? "bg-blue-500 text-white animate-pulse shadow-lg shadow-blue-500/40"
                    : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
                )}
                title={isRTL ? '🎤 تكلم' : '🎤 Parler'}
              >
                {isListening ? <MicOff size={22} /> : <Mic size={22} />}
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
              {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className={inputValue.trim() ? (isRTL ? '-mr-0.5' : 'ml-0.5') : ''} />}
            </button>
          </div>
        </div>

        {/* Subtitle: اسألني أي حاجة + Tags */}
        <div className="px-3 pt-2 pb-2 text-center">
          <p className="text-xs font-bold text-foreground font-cairo mb-1.5" dir="rtl">
            اسألني أي حاجة
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Listening animation overlay */}
      {isListening && (
        <div className="fixed inset-x-0 bottom-48 z-[70] flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg animate-bounce">
            <Mic size={18} />
            <span className="text-xs font-bold font-cairo">{isRTL ? 'جاري الاستماع...' : 'Écoute en cours...'}</span>
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        </div>
      )}

      <style>{`
        .safe-area-pb { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
};

export default AssistantPage;
