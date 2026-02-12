import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Scale, Camera, Paperclip, Send, Loader2 } from 'lucide-react';
import { streamProAdminAssistant } from '@/hooks/useStreamingChat';
import { useToast } from '@/hooks/use-toast';
import DocumentActionButtons from '@/components/assistant/DocumentActionButtons';
import { extractTextFromPDF } from '@/lib/pdfExtractor';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  detectedDocType?: 'invoice' | 'letter' | null;
}

function detectDocumentType(aiResponse: string): 'invoice' | 'letter' | null {
  const lower = aiResponse.toLowerCase();
  const invoiceKeywords = ['facture', 'devis', 'montant total', 'total ttc', 'total ht', 'tva', 'فاتورة', 'دوفي', 'المبلغ الإجمالي', 'prix unitaire', 'quantité'];
  const letterKeywords = ['courrier', 'lettre recommandée', 'madame, monsieur', 'objet :', 'veuillez agréer', 'préfecture', 'caf', 'cpam', 'pôle emploi', 'urssaf', 'جواب', 'خطاب رسمي', 'بريفكتير'];
  const invoiceScore = invoiceKeywords.filter(k => lower.includes(k)).length;
  const letterScore = letterKeywords.filter(k => lower.includes(k)).length;
  if (invoiceScore >= 2) return 'invoice';
  if (letterScore >= 2) return 'letter';
  return null;
}

const LegalGuidePage = () => {
  const navigate = useNavigate();
  const { isRTL, language, t } = useLanguage();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; file: File; name: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const readAsDataURL = (f: File): Promise<string> =>
    new Promise((resolve, reject) => { const r = new FileReader(); r.onload = (e) => resolve(e.target?.result as string); r.onerror = () => reject(new Error('File read error')); r.readAsDataURL(f); });

  const handleSend = async (messageText?: string, imageData?: string) => {
    const text = messageText || inputValue;
    const filesToSend = [...pendingFiles];
    
    if (!text.trim() && !imageData && filesToSend.length === 0) return;

    // Build combined content from pending files
    let combinedText = text;
    let primaryImage = imageData;
    
    if (filesToSend.length > 0) {
      setIsExtractingPdf(true);
      toast({
        title: isRTL
          ? `📄 جاري تحليل ${filesToSend.length} مستند...`
          : `📄 Analyse de ${filesToSend.length} documents en cours...`,
      });

      const textParts: string[] = [];
      for (const pf of filesToSend) {
        const f = pf.file;
        const isPDF = f.type === 'application/pdf';
        const isImage = f.type.startsWith('image/');

        if (isPDF) {
          const dataUrl = await readAsDataURL(f);
          const extracted = await extractTextFromPDF(dataUrl);
          if (extracted.trim()) {
            textParts.push(`--- ${f.name} ---\n${extracted}`);
          } else if (!primaryImage) {
            primaryImage = dataUrl;
          }
        } else if (isImage) {
          if (!primaryImage) {
            primaryImage = await readAsDataURL(f);
          }
        }
      }

      setIsExtractingPdf(false);
      setPendingFiles([]);

      if (textParts.length > 0) {
        const prefix = isRTL
          ? `محتوى ${textParts.length} مستند مرفق:\n\n`
          : `Contenu de ${textParts.length} document(s) :\n\n`;
        combinedText = prefix + textParts.join('\n\n') + (combinedText.trim() ? `\n\n${combinedText}` : '');
      }
      if (!combinedText.trim() && primaryImage) {
        combinedText = isRTL
          ? 'حلل المستندات دي وقولي إيه حقوقي وواجباتي'
          : 'Analysez ces documents et conseillez-moi sur mes droits';
      }
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: combinedText || (primaryImage ? '📷 صورة مرفقة' : ''),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    const chatLanguage: 'fr' | 'ar' = language;
    let assistantContent = '';
    const assistantId = `assistant-${Date.now()}`;

    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      await streamProAdminAssistant(
        {
          userMessage: combinedText,
          imageData: primaryImage,
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
              ? 'Problème serveur — réessayez dans un instant.'
              : 'حصل مشكلة في السيرفر، جرب تاني 🔄';
            setMessages(prev =>
              prev.map(m => m.id === assistantId ? { ...m, content: errorMessage } : m)
            );
            toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: errorMessage });
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

  const handleFileUpload = async (file: File, fromCamera: boolean = false) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: isRTL ? 'الملف كبير' : 'Fichier trop volumineux', description: isRTL ? 'الحد الأقصى 10 ميجا' : 'Maximum 10 Mo' });
      return;
    }
    const isPDF = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPDF && !isImage) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'يرجى رفع صورة (JPG/PNG) أو ملف PDF فقط' : 'Veuillez télécharger une image (JPG/PNG) ou un fichier PDF uniquement.' });
      return;
    }
    // Add to pending files list instead of sending immediately
    setPendingFiles(prev => [...prev, { id: crypto.randomUUID(), file, name: file.name }]);
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected) {
      for (const file of Array.from(selected)) {
        await handleFileUpload(file, false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected) {
      for (const file of Array.from(selected)) {
        await handleFileUpload(file, true);
      }
    }
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleGenerateReply = () => {
    const replyPrompt = language === 'fr'
      ? 'Rédigez une réponse formelle à ce courrier administratif en citant les articles de loi pertinents.'
      : 'اكتبلي رد رسمي على الخطاب ده مع ذكر المواد القانونية.';
    handleSend(replyPrompt);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col bg-background text-foreground font-sans -mx-2 -mt-20 -mb-14" style={{ height: 'calc(100vh)' }} dir={isRTL ? 'rtl' : 'ltr'}>

      {/* HEADER - Emerald themed */}
      <header className="bg-card p-3 pt-10 shadow-sm border-b border-border flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow">
          <Scale size={18} />
        </div>
        <div>
          <h1 className={cn("text-sm font-bold text-foreground", isRTL && "font-cairo")}>
            {t('legal.title')}
          </h1>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <p className={cn("text-[10px] text-emerald-600 font-bold", isRTL && "font-cairo")}>
              {t('legal.subtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: '200px' }}>
        {!hasMessages && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 shadow-sm">
                <Scale size={14} className="text-emerald-600" />
              </div>
              <div className="max-w-[85%] p-3 px-4 rounded-2xl rounded-tl-none bg-card text-card-foreground border border-border shadow-sm">
                <p className={cn("text-[15px] leading-relaxed", isRTL ? "font-cairo text-right" : "text-left")} dir={isRTL ? "rtl" : "ltr"}>
                  {t('legal.welcome')}
                  <br />
                  {t('legal.welcomeSub')}
                </p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <React.Fragment key={msg.id}>
            <div className={cn("flex w-full", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mr-2 mt-1 shrink-0 shadow-sm">
                  <Scale size={14} className="text-emerald-600" />
                </div>
              )}
              <div className={cn(
                "max-w-[85%] p-3 px-4 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap",
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-none'
                  : 'bg-card text-card-foreground rounded-tl-none border border-border',
                isArabic(msg.content) ? 'font-cairo text-right' : 'text-left'
              )}>
                {msg.content || (msg.role === 'assistant' && isTyping ? '...' : '')}
              </div>
            </div>
            {msg.role === 'assistant' && msg.detectedDocType && (
              <DocumentActionButtons
                documentType={msg.detectedDocType}
                isRTL={isRTL}
                onGenerateReply={handleGenerateReply}
              />
            )}
          </React.Fragment>
        ))}

        {isExtractingPdf && (
          <div className="flex items-center gap-2 p-3 bg-card rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
              {isRTL ? '📄 جاري قراءة ملف الـ PDF...' : '📄 Lecture du PDF en cours...'}
            </span>
          </div>
        )}

        {isTyping && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-2 p-3 bg-card rounded-2xl rounded-tl-none w-fit border border-border shadow-sm ml-10">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
              {t('chat.thinking')}
            </span>
          </div>
        )}

        <div className="h-64 w-full shrink-0" aria-hidden="true" />
        <div ref={messagesEndRef} />
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFileInputChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleCameraChange} />

      {/* INPUT AREA */}
      <div className="fixed left-0 right-0 z-[60] bg-background border-t border-border safe-area-pb" style={{ bottom: '5rem' }}>
        {/* Pending files list */}
        {pendingFiles.length > 0 && (
          <div className="mx-3 mt-2 space-y-1">
            {pendingFiles.map((pf) => (
              <div key={pf.id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-card border border-border text-sm">
                <span className="truncate text-foreground text-xs">{pf.name}</span>
                <button onClick={() => removePendingFile(pf.id)} className="flex-shrink-0 p-1 rounded-full hover:bg-destructive/10 text-destructive">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mx-3 mt-2 mb-2 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('legal.placeholder')}
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
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isTyping || isExtractingPdf}
                className="p-2 rounded-full text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                title={isRTL ? '📷 صورة' : '📷 Photo'}
              >
                <Camera size={20} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping || isExtractingPdf}
                className="p-2 rounded-full text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                title={isRTL ? '📎 ملف (PDF/صورة)' : '📎 Fichier (PDF/Image)'}
              >
                <Paperclip size={20} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={(!inputValue.trim() && pendingFiles.length === 0) || isTyping || isExtractingPdf}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all",
                (inputValue.trim() || pendingFiles.length > 0) && !isTyping ? 'bg-emerald-600 text-white' : 'bg-muted-foreground/20 text-muted-foreground'
              )}
            >
              {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>

      <style>{`.safe-area-pb { padding-bottom: env(safe-area-inset-bottom); }`}</style>
    </div>
  );
};

export default LegalGuidePage;
