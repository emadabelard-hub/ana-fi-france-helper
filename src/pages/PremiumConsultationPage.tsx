import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { ArrowLeft, Camera, FileText, Send, Loader2, Copy, Check, Upload, X, Sparkles, Mail, Scale, Shield, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

const PremiumConsultationPage = () => {
  const { isRTL } = useLanguage();
  const { profile } = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [textInput, setTextInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string);
        setPdfName(null);
        setPdfText(null);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      setPdfName(file.name);
      setImagePreview(null);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const text = await extractTextFromPDF(ev.target?.result as string);
          setPdfText(text);
        } catch {
          toast({ variant: 'destructive', title: 'خطأ في قراءة الـ PDF' });
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const clearFile = () => {
    setImagePreview(null);
    setPdfName(null);
    setPdfText(null);
  };

  const handleAnalyze = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    if (!textInput.trim() && !imagePreview && !pdfText) {
      toast({ variant: 'destructive', title: isRTL ? 'أدخل نصاً أو ارفع مستنداً' : 'Ajoutez un texte ou un document' });
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const resp = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          userMessage: textInput.trim(),
          imageData: imagePreview || undefined,
          pdfText: pdfText || undefined,
          profile: profile ? {
            full_name: profile.full_name,
            address: profile.address,
            phone: profile.phone,
            email: profile.email,
            caf_number: profile.caf_number,
            foreigner_number: profile.foreigner_number,
            social_security: profile.social_security,
          } : undefined,
          language: 'ar',
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'خطأ في الخدمة');
      }

      const data: AnalysisResult = await resp.json();
      setResult(data);
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'حدث خطأ' });
    } finally {
      setIsAnalyzing(false);
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
            {/* File preview or upload area */}
            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/50 bg-muted">
                <img src={imagePreview} alt="Document" className="w-full max-h-60 object-contain bg-black/5" />
                <button onClick={clearFile} className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1.5 rounded-full shadow-lg">
                  <X size={16} />
                </button>
              </div>
            ) : pdfName ? (
              <div className="relative flex items-center gap-3 p-4 rounded-2xl border-2 border-amber-400/50 bg-muted">
                <FileText size={28} className="text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{pdfName}</p>
                  <p className="text-xs text-muted-foreground">{pdfText ? (isRTL ? 'تم استخراج النص ✓' : 'Texte extrait ✓') : (isRTL ? 'جاري القراءة...' : 'Lecture...')}</p>
                </div>
                <button onClick={clearFile} className="bg-destructive text-destructive-foreground p-1.5 rounded-full shadow">
                  <X size={16} />
                </button>
              </div>
            ) : (
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
                    {isRTL ? '📁 ارفع ملف / PDF' : '📁 Fichier / PDF'}
                  </span>
                </button>
              </div>
            )}

            {/* Hidden inputs */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

            {/* Text area for pasting emails */}
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
              disabled={isAnalyzing || (!textInput.trim() && !imagePreview && !pdfText)}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-lg shadow-xl active:scale-95 transition-all gap-3"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  <span className={cn(isRTL && "font-cairo")}>{isRTL ? 'جاري التحليل...' : 'Analyse en cours...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={22} />
                  <span className={cn(isRTL && "font-cairo")}>{isRTL ? '🔍 حلّل المستند' : '🔍 Analyser le document'}</span>
                </>
              )}
            </Button>

            {/* Info note */}
            <div className={cn("p-3 rounded-xl bg-muted border border-border", isRTL && "text-right")}>
              <p className={cn("text-xs font-bold text-muted-foreground leading-relaxed", isRTL && "font-cairo")}>
                {isRTL
                  ? '💡 ارفع صورة أو PDF لمستند فرنسي (رسالة من CAF، Préfecture، ضرائب...) أو الصق نص إيميل. سيقوم المستشار بالترجمة والتحليل وكتابة الرد الرسمي.'
                  : '💡 Uploadez une photo ou un PDF de document français, ou collez un email. Le consultant traduira, analysera et rédigera la réponse officielle.'}
              </p>
            </div>
          </div>
        )}

        {/* Results - 4 Blocks */}
        {result && (
          <div className="space-y-4">
            {/* Reset button */}
            <Button
              variant="outline"
              onClick={() => { setResult(null); clearFile(); setTextInput(''); }}
              className={cn("w-full gap-2 rounded-xl font-black", isRTL && "font-cairo flex-row-reverse")}
            >
              <FileText size={16} />
              {isRTL ? '📋 تحليل مستند جديد' : '📋 Nouveau document'}
            </Button>

            {/* Block 1: Translation & Explanation */}
            <ResultBlock
              id="translation"
              icon={ClipboardList}
              title={isRTL ? '📖 الترجمة والشرح' : '📖 Traduction & Explication'}
              content={result.translation}
            />

            {/* Block 2: Professional Analysis */}
            <ResultBlock
              id="analysis"
              icon={Scale}
              title={isRTL ? '⚖️ التحليل المهني' : '⚖️ Analyse Professionnelle'}
              content={result.analysis}
            />

            {/* Block 3: Draft Letter in French */}
            <ResultBlock
              id="draft"
              icon={Mail}
              title={isRTL ? '✉️ المسودة الرسمية (بالفرنسية)' : '✉️ Lettre Officielle (FR)'}
              content={result.draft}
              copyable
              ltr
            />

            {/* Block 4: Sending Instructions */}
            <ResultBlock
              id="dispatch"
              icon={Shield}
              title={isRTL ? '📬 تعليمات الإرسال والظرف' : '📬 Instructions d\'envoi'}
              content={result.dispatch}
              copyable
            />
          </div>
        )}
      </div>

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  );
};

export default PremiumConsultationPage;
