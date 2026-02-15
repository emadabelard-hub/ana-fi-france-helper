import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { ArrowLeft, Camera, FileText, Loader2, Copy, Check, Upload, X, Sparkles, Mail, Scale, Shield, ClipboardList, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { extractTextFromPDF } from '@/lib/pdfExtractor';
import AuthModal from '@/components/auth/AuthModal';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/premium-consultation`;

interface AnalysisResult {
  translation: string;
  analysis: string;
  draft: string;
  dispatch: string;
}

interface UploadedFile {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  dataUrl: string;
  pdfText?: string;
}

const PremiumConsultationPage = () => {
  const { isRTL } = useLanguage();
  const { profile } = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [textInput, setTextInput] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const id = `${Date.now()}-${i}`;

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFiles(prev => [...prev, {
            id, name: file.name, type: 'image',
            dataUrl: ev.target?.result as string,
          }]);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target?.result as string;
          let pdfText = '';
          try {
            pdfText = await extractTextFromPDF(dataUrl);
          } catch {
            toast({ variant: 'destructive', title: `خطأ في قراءة ${file.name}` });
          }
          setFiles(prev => [...prev, {
            id, name: file.name, type: 'pdf',
            dataUrl, pdfText,
          }]);
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleAnalyze = async () => {
    if (!user) { setShowAuth(true); return; }

    if (!textInput.trim() && files.length === 0) {
      toast({ variant: 'destructive', title: isRTL ? 'أدخل نصاً أو ارفع مستنداً' : 'Ajoutez un texte ou un document' });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setProgress(10);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 8, 90));
    }, 1500);

    try {
      // Collect all image data URLs
      const imageDataArray = files.filter(f => f.type === 'image').map(f => f.dataUrl);
      // Collect all PDF texts
      const pdfTexts = files.filter(f => f.type === 'pdf' && f.pdfText).map(f => f.pdfText!);
      const combinedPdfText = pdfTexts.length > 0 ? pdfTexts.join('\n\n--- مستند جديد ---\n\n') : undefined;

      // Get user's session token for authenticated request
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setShowAuth(true); setIsAnalyzing(false); clearInterval(progressInterval); return; }

      const resp = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userMessage: textInput.trim(),
          imageData: imageDataArray.length === 1 ? imageDataArray[0] : undefined,
          imageDataArray: imageDataArray.length > 1 ? imageDataArray : undefined,
          pdfText: combinedPdfText,
          profile: profile ? {
            full_name: profile.full_name, address: profile.address,
            phone: profile.phone, email: profile.email,
            caf_number: profile.caf_number, foreigner_number: profile.foreigner_number,
            social_security: profile.social_security,
          } : undefined,
          language: 'ar',
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'خطأ في الخدمة');
      }

      const data: AnalysisResult = await resp.json();
      setResult(data);
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'حدث خطأ' });
    } finally {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      setProgress(0);
    }
  };

  const copyBlock = async (text: string, blockId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(blockId);
      setTimeout(() => setCopiedBlock(null), 2000);
      toast({ title: isRTL ? 'تم النسخ ✓' : 'Copié ✓' });
    } catch { /* ignore */ }
  };

  const ResultBlock = ({ id, icon: Icon, title, content, copyable, ltr }: {
    id: string; icon: any; title: string; content: string; copyable?: boolean; ltr?: boolean;
  }) => {
    if (!content) return null;
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className={cn("flex items-center justify-between p-4 border-b border-border bg-muted/50", isRTL && "flex-row-reverse")}>
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <Icon size={20} className="text-primary" />
            <h3 className={cn("font-black text-base text-foreground", isRTL && "font-cairo")}>{title}</h3>
          </div>
          {copyable && (
            <Button variant="ghost" size="sm" onClick={() => copyBlock(content, id)} className="gap-1.5">
              {copiedBlock === id ? <Check size={14} /> : <Copy size={14} />}
              <span className="text-xs font-bold">{copiedBlock === id ? (isRTL ? 'تم' : 'Copié') : (isRTL ? 'نسخ' : 'Copier')}</span>
            </Button>
          )}
        </div>
        <div className={cn("p-4 text-[14px] leading-[1.9] whitespace-pre-wrap", ltr ? "text-left font-serif" : (isRTL ? "text-right font-cairo" : "text-left"))}>
          <p className="text-foreground">{content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
        <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft size={20} className={cn("text-foreground", isRTL && "rotate-180")} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <Scale size={18} className="text-white" />
          </div>
          <div>
            <h1 className={cn("font-black text-foreground text-base leading-tight", isRTL && "font-cairo")}>
              {isRTL ? 'المستشار الاحترافي' : 'Consultation Pro'}
            </h1>
            <p className={cn("text-[10px] font-bold text-amber-600 uppercase tracking-wider", isRTL && "font-cairo")}>
              {isRTL ? 'محامي • محاسب • مساعد اجتماعي' : 'Avocat • Comptable • Aide sociale'}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
        {/* Upload Zone */}
        {!result && (
          <div className="space-y-4">
            {/* Upload buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30 active:scale-95 transition-all"
              >
                <Camera size={32} className="text-amber-600" />
                <span className={cn("text-sm font-black text-amber-800 dark:text-amber-300", isRTL && "font-cairo")}>
                  {isRTL ? '📸 صوّر المستند' : '📸 Photographier'}
                </span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30 active:scale-95 transition-all"
              >
                <Upload size={32} className="text-amber-600" />
                <span className={cn("text-sm font-black text-amber-800 dark:text-amber-300", isRTL && "font-cairo")}>
                  {isRTL ? '📁 ارفع ملفات / PDF' : '📁 Fichiers / PDF'}
                </span>
              </button>
            </div>

            {/* File thumbnails */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className={cn("text-xs font-black text-muted-foreground", isRTL && "font-cairo text-right")}>
                  {isRTL ? `📂 الملفات المرفقة (${files.length})` : `📂 Fichiers joints (${files.length})`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {files.map(f => (
                    <div key={f.id} className="relative group">
                      {f.type === 'image' ? (
                        <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-amber-400/50 shadow-sm">
                          <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl border-2 border-amber-400/50 bg-muted flex flex-col items-center justify-center shadow-sm">
                          <FileText size={24} className="text-amber-600" />
                          <span className="text-[8px] font-bold text-muted-foreground mt-1 truncate max-w-[64px] px-1">{f.name}</span>
                        </div>
                      )}
                      <button
                        onClick={() => removeFile(f.id)}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground w-5 h-5 rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden inputs - multiple allowed */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilesSelect} />
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFilesSelect} />

            {/* Text area */}
            <div className="space-y-2">
              <label className={cn("text-sm font-black text-muted-foreground", isRTL && "font-cairo text-right block")}>
                {isRTL ? '✉️ أو الصق نص الإيميل / الرسالة هنا:' : '✉️ Ou collez le texte du mail / courrier :'}
              </label>
              <Textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder={isRTL ? 'الصق هنا محتوى الإيميل أو الرسالة الفرنسية...' : 'Collez ici le contenu du mail ou courrier...'}
                className={cn("min-h-[120px] text-[14px] leading-relaxed rounded-xl border-2 border-border focus:border-amber-400 resize-none", isRTL && "font-cairo text-right")}
                dir="auto"
              />
            </div>

            {/* Analyze button */}
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || (!textInput.trim() && files.length === 0)}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-lg shadow-xl active:scale-95 transition-all gap-3"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  <span className={cn(isRTL && "font-cairo")}>
                    {isRTL ? `جاري تحليل ${files.length > 1 ? files.length + ' ملفات' : 'الملف'}...` : 'Analyse en cours...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={22} />
                  <span className={cn(isRTL && "font-cairo")}>
                    {isRTL
                      ? (files.length > 1 ? `🔍 حلّل ${files.length} مستندات معاً` : '🔍 حلّل المستند')
                      : (files.length > 1 ? `🔍 Analyser ${files.length} documents` : '🔍 Analyser')}
                  </span>
                </>
              )}
            </Button>

            {/* Progress bar during analysis */}
            {isAnalyzing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2 rounded-full" />
                <p className={cn("text-xs font-bold text-center text-amber-600", isRTL && "font-cairo")}>
                  {isRTL ? 'جاري تحليل الملفات... يرجى الانتظار' : 'Analyse en cours... veuillez patienter'}
                </p>
              </div>
            )}

            {/* Info note */}
            <div className={cn("p-3 rounded-xl bg-muted border border-border", isRTL && "text-right")}>
              <p className={cn("text-xs font-bold text-muted-foreground leading-relaxed", isRTL && "font-cairo")}>
                {isRTL
                  ? '💡 يمكنك رفع عدة صور أو ملفات PDF في آن واحد. سيقوم المستشار بتحليل جميع المستندات كملف واحد متكامل.'
                  : '💡 Vous pouvez uploader plusieurs photos ou PDFs simultanément. Le consultant analysera tous les documents comme un seul dossier.'}
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => { setResult(null); setFiles([]); setTextInput(''); }}
              className={cn("w-full gap-2 rounded-xl font-black", isRTL && "font-cairo flex-row-reverse")}
            >
              <FileText size={16} />
              {isRTL ? '📋 تحليل مستند جديد' : '📋 Nouveau document'}
            </Button>

            <ResultBlock id="translation" icon={ClipboardList} title={isRTL ? '📖 الترجمة والشرح' : '📖 Traduction & Explication'} content={result.translation} />
            <ResultBlock id="analysis" icon={Scale} title={isRTL ? '⚖️ التحليل المهني' : '⚖️ Analyse Professionnelle'} content={result.analysis} />
            <ResultBlock id="draft" icon={Mail} title={isRTL ? '✉️ المسودة الرسمية (بالفرنسية)' : '✉️ Lettre Officielle (FR)'} content={result.draft} copyable ltr />
            <ResultBlock id="dispatch" icon={Shield} title={isRTL ? '📬 تعليمات الإرسال والظرف' : "📬 Instructions d'envoi"} content={result.dispatch} copyable />
          </div>
        )}
      </div>

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  );
};

export default PremiumConsultationPage;
