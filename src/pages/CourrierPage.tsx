import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Mail, Loader2, X } from 'lucide-react';
import { Camera, Paperclip } from 'lucide-react';
import { extractTextFromPDF } from '@/lib/pdfExtractor';
import { streamProAdminAssistant } from '@/hooks/useStreamingChat';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import InsufficientCreditsModal from '@/components/shared/InsufficientCreditsModal';

interface UploadedFile {
  id: string;
  file: File;
  name: string;
}

const CourrierPage = () => {
  const navigate = useNavigate();
  const { isRTL, t } = useLanguage();
  const [content, setContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const { balance, canAfford, deductCredits, getCost } = useCredits();
  const creditCost = getCost('letter_pdf');
  const [result, setResult] = useState('');

  const hasContent = content.trim().length > 0 || files.length > 0;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const newFiles: UploadedFile[] = Array.from(selected).map(f => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const readAsDataURL = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = (e) => resolve(e.target?.result as string);
      r.onerror = () => reject(new Error('File read error'));
      r.readAsDataURL(f);
    });

  const handleGenerate = async () => {
    if (!hasContent) return;

    if (!user) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'يجب تسجيل الدخول' : 'Connexion requise',
        description: isRTL ? 'سجل دخولك الأول' : 'Veuillez vous connecter.',
      });
      return;
    }

    if (!canAfford('letter_pdf')) {
      setShowInsufficientCredits(true);
      return;
    }

    const success = await deductCredits('letter_pdf');
    if (!success) return;

    setIsProcessing(true);

    const totalFiles = files.length;
    if (totalFiles > 0) {
      toast({
        title: isRTL
          ? `📄 جاري تحليل ${totalFiles} مستند...`
          : `📄 Analyse de ${totalFiles} documents en cours...`,
      });
    }

    try {
      // Process all files into text/image data
      const fileContents: string[] = [];
      const imageDataArr: string[] = [];

      for (const uploadedFile of files) {
        const f = uploadedFile.file;
        const isPDF = f.type === 'application/pdf';
        const isImage = f.type.startsWith('image/');

        if (isPDF) {
          const dataUrl = await readAsDataURL(f);
          const extractedText = await extractTextFromPDF(dataUrl);
          if (extractedText.trim()) {
            fileContents.push(`--- ${f.name} ---\n${extractedText}`);
          } else {
            // Scanned PDF → send as image
            imageDataArr.push(dataUrl);
          }
        } else if (isImage) {
          const base64 = await readAsDataURL(f);
          imageDataArr.push(base64);
        }
      }

      // Build combined prompt
      let combinedPrompt = content.trim();
      if (fileContents.length > 0) {
        const prefix = isRTL
          ? `محتوى ${fileContents.length} مستند مرفق:\n\n`
          : `Contenu de ${fileContents.length} document(s) joint(s) :\n\n`;
        combinedPrompt = prefix + fileContents.join('\n\n') + (combinedPrompt ? `\n\n${combinedPrompt}` : '');
      }
      if (!combinedPrompt && imageDataArr.length > 0) {
        combinedPrompt = isRTL
          ? 'حلل المستندات دي واكتبلي رد رسمي مناسب'
          : 'Analysez ces documents et rédigez une réponse formelle appropriée';
      }

      // Stream response
      let assistantContent = '';
      await streamProAdminAssistant(
        {
          userMessage: combinedPrompt,
          imageData: imageDataArr[0], // primary image if any
          conversationHistory: [],
          language: isRTL ? 'ar' : 'fr',
        },
        {
          onDelta: (delta) => {
            assistantContent += delta;
            setResult(assistantContent);
          },
          onDone: () => {
            setIsProcessing(false);
            toast({ title: isRTL ? '✅ الرد جاهز' : '✅ Réponse générée' });
          },
          onError: (error) => {
            console.error('Stream error:', error);
            setIsProcessing(false);
            toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: String(error) });
          },
        }
      );
    } catch (error) {
      console.error('Generate error:', error);
      setIsProcessing(false);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur' });
    }
  };

  return (
    <div className="flex flex-col bg-background text-foreground font-sans -mx-2 -mt-20 -mb-14" style={{ height: 'calc(100vh)' }} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* HEADER */}
      <header className="bg-card p-3 pt-10 shadow-sm border-b border-border flex items-center gap-3 sticky top-0 z-10">
        <button 
          onClick={() => navigate('/assistant')} 
          className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="w-9 h-9 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow">
          <Mail size={18} />
        </div>
        <div>
          <h1 className={cn("text-sm font-bold text-foreground", isRTL && "font-cairo")}>
            {t('courrier.title')}
          </h1>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Explanatory text */}
        <div className={cn(
          "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4",
        )}>
          <p className={cn(
            "text-sm leading-relaxed text-emerald-800 dark:text-emerald-200",
            isRTL ? "font-cairo text-right" : "text-left"
          )} dir="rtl">
            الاستشارة والإستعلام مجانا في اسأل وانا اجاوب. هنا ممكن تحمل صورة جواب او ايميل او رسالة نصية واطلب مني اترجمه واحضر لك الرد المناسب. لو كان ايميل انسخه والصقه هنا، لو خطاب صوره وحمله هنا.
          </p>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />

        {/* Upload buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-full",
              "bg-card border border-border text-muted-foreground",
              "text-xs font-bold shadow-sm active:scale-95 transition-transform"
            )}
          >
            <Camera size={16} />
            <span className={cn(isRTL && "font-cairo")}>{isRTL ? 'صوّر الخطاب' : 'Photographier'}</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-full",
              "bg-card border border-border text-muted-foreground",
              "text-xs font-bold shadow-sm active:scale-95 transition-transform"
            )}
          >
            <Paperclip size={16} />
            <span className={cn(isRTL && "font-cairo")}>{isRTL ? 'حمّل ملف' : 'Joindre fichier'}</span>
          </button>
        </div>

        {/* Attached files list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2 rounded-xl",
                  "bg-card border border-border text-sm"
                )}
              >
                <span className="truncate text-foreground">{f.name}</span>
                <button
                  onClick={() => removeFile(f.id)}
                  className="flex-shrink-0 p-1 rounded-full hover:bg-destructive/10 text-destructive"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Large textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isRTL ? 'الصق نص الإيميل أو الخطاب هنا...' : 'Collez le texte du courrier ou email ici...'}
          className={cn(
            "w-full min-h-[250px] resize-none bg-card border border-border rounded-2xl p-4",
            "text-[15px] leading-relaxed outline-none text-foreground placeholder:text-muted-foreground",
            "focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500",
            isRTL && "font-cairo text-right"
          )}
          dir="auto"
        />

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!hasContent || isProcessing}
          className={cn(
            "w-full py-4 rounded-2xl font-bold text-base shadow-lg",
            "active:scale-[0.98] transition-all",
            hasContent && !isProcessing
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-muted text-muted-foreground cursor-not-allowed",
            isRTL && "font-cairo"
          )}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              {isRTL ? 'جاري التحضير...' : 'Préparation...'}
            </span>
          ) : (
            isRTL ? `استخدم ${creditCost} كريديت واعمل الرد` : `Utiliser ${creditCost} crédits et Générer`
          )}
        </button>

        <div className="h-20" />
      </div>

      <InsufficientCreditsModal
        open={showInsufficientCredits}
        onOpenChange={setShowInsufficientCredits}
        currentBalance={balance}
        requiredCredits={creditCost}
      />
    </div>
  );
};

export default CourrierPage;
