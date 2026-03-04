import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompression';
import { extractTextFromPDF } from '@/lib/pdfExtractor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import AuthModal from '@/components/auth/AuthModal';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import {
  ArrowLeft, ArrowRight, Camera, Image as ImageIcon, FileText, Map,
  Send, Loader2, Trash2, Plus, Sparkles, CheckCircle2, Edit3, Download, HelpCircle, X, Upload,
  SunMedium, Maximize, ZoomIn, Ruler, ShieldCheck
} from 'lucide-react';

interface UploadedFile {
  id: string;
  data: string;
  name: string;
  type: 'image' | 'pdf';
  mimeType: string;
}

interface SurfaceEstimate {
  id: string;
  label_fr: string;
  label_ar: string;
  width_m: number;
  height_m: number;
  area_m2: number;
  referenceObject_fr: string;
  referenceObject_ar: string;
  confidence: string;
  workType: string;
}

interface LineItem {
  id: string;
  designation_fr: string;
  designation_ar: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

type InputType = 'photo' | 'blueprint' | 'document' | null;
type Step = 'select_input' | 'photo_guide' | 'upload' | 'chat' | 'review';

const MAX_FILES = 10;

const SmartDevisPage = () => {
  const { isRTL, t } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('select_input');
  const [inputType, setInputType] = useState<InputType>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [pastedText, setPastedText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [materialQuality, setMaterialQuality] = useState<string>('standard');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(15);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [preferencesCollected, setPreferencesCollected] = useState(false);
  const [helpGuide, setHelpGuide] = useState<'photo' | 'blueprint' | 'document' | null>(null);
  const [surfaceEstimates, setSurfaceEstimates] = useState<SurfaceEstimate[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleInputTypeSelect = (type: InputType) => {
    if (!user) { setShowAuth(true); return; }
    setInputType(type);
    if (type === 'photo') {
      setStep('photo_guide');
    } else {
      setStep('upload');
    }
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = MAX_FILES - uploadedFiles.length;
    if (remaining <= 0) {
      toast({ variant: 'destructive', title: isRTL ? 'وصلت الحد الأقصى' : 'Limite atteinte', description: isRTL ? `الحد الأقصى ${MAX_FILES} ملفات` : `Maximum ${MAX_FILES} fichiers` });
      return;
    }
    const toProcess = fileArray.slice(0, remaining);
    if (fileArray.length > remaining) {
      toast({ title: isRTL ? 'تم تجاهل بعض الملفات' : 'Fichiers ignorés', description: isRTL ? `تم قبول ${remaining} ملف فقط` : `Seulement ${remaining} fichier(s) accepté(s)` });
    }

    toProcess.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast({ variant: 'destructive', title: isRTL ? 'ملف كبير أوي' : 'Fichier trop volumineux', description: `${file.name} > 10MB` });
        return;
      }
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) {
        toast({ variant: 'destructive', title: isRTL ? 'نوع غير مدعوم' : 'Type non supporté', description: file.name });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedFiles(prev => {
          if (prev.length >= MAX_FILES) return prev;
          return [...prev, {
            id: generateId(),
            data: reader.result as string,
            name: file.name,
            type: isPdf ? 'pdf' : 'image',
            mimeType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          }];
        });
      };
      reader.readAsDataURL(file);
    });
  }, [uploadedFiles.length, toast, isRTL]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(files);
    // Reset input so same files can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleAnalyze = async () => {
    if (uploadedFiles.length === 0 && !pastedText.trim()) return;
    setIsAnalyzing(true);
    try {
      const baseMessage = inputType === 'blueprint'
        ? "Analyse ce plan/croquis et lis les dimensions exactes indiquées."
        : inputType === 'document'
        ? "Extrais les informations de ce document pour générer un devis."
        : "Analyse cette photo de chantier et estime les travaux nécessaires avec +10% de marge de sécurité.";

      const userMessage = pastedText.trim()
        ? `${baseMessage}\n\nTexte/demande du client:\n${pastedText.trim()}`
        : baseMessage;

      const body: any = {
        action: 'analyze_image',
        userMessage,
      };

      // Pre-process files: extract PDF text client-side, compress images
      if (uploadedFiles.length > 0) {
        const processedFiles: any[] = [];
        
        for (const f of uploadedFiles) {
          if (f.type === 'pdf') {
            // Extract text from PDF client-side instead of sending raw base64
            try {
              const extractedText = await extractTextFromPDF(f.data);
              processedFiles.push({
                name: f.name,
                type: 'pdf',
                extractedText: extractedText || `[PDF: ${f.name} - impossible d'extraire le texte]`,
              });
            } catch (pdfErr) {
              console.warn(`PDF text extraction failed for ${f.name}, sending as text fallback`);
              processedFiles.push({
                name: f.name,
                type: 'pdf',
                extractedText: `[PDF: ${f.name} - extraction échouée, fichier scanné probable]`,
              });
            }
          } else {
            // Compress images before sending
            try {
              const compressed = await compressImage(f.data);
              processedFiles.push({
                data: compressed,
                mimeType: 'image/jpeg',
                name: f.name,
                type: 'image',
              });
            } catch {
              // Fallback: send original if compression fails
              processedFiles.push({
                data: f.data,
                mimeType: f.mimeType,
                name: f.name,
                type: 'image',
              });
            }
          }
        }

        body.files = processedFiles;
        
        // Backward compat: first image as imageData
        const firstImage = processedFiles.find(f => f.type === 'image' && f.data);
        if (firstImage) {
          body.imageData = firstImage.data;
          body.mimeType = firstImage.mimeType;
        }
      }

      if (pastedText.trim()) {
        body.pastedText = pastedText.trim();
      }

      const { data, error } = await supabase.functions.invoke('smart-devis-analyzer', { body });
      if (error) throw error;
      setAnalysisData(data);

      // Store surface estimates for editable display
      if (data.surfaceEstimates && Array.isArray(data.surfaceEstimates)) {
        setSurfaceEstimates(data.surfaceEstimates);
      }

      const analysisAr = data.analysis_ar || data.analysis || 'تم التحليل';
      const analysisFr = data.analysis_fr || '';
      const notesAr = data.notes_ar || data.notes || '';
      const notesFr = data.notes_fr || '';
      const area = data.estimatedArea ? `📐 المساحة المقدرة: **${data.estimatedArea}**` : '';

      let content = `✅ **تحليل الشانتي:**\n\n${analysisAr}\n\n`;
      if (area) content += `${area}\n\n`;
      if (notesAr) content += `📝 ${notesAr}\n\n`;
      content += `---\n\n🇫🇷 **Analyse professionnelle :**\n\n${analysisFr}\n\n`;
      if (notesFr) content += `📝 ${notesFr}\n\n`;
      content += `---\nدلوقتي عايز أسألك كام سؤال عشان نعمل الدوفي صح:\n\n1️⃣ **جودة المواد؟** (اقتصادي / عادي / فخم)\n2️⃣ **هل في خصم؟** (نسبة %)\n3️⃣ **نسبة الربح المطلوبة؟** (%)`;

      setChatMessages([{ role: 'assistant', content }]);
      setStep('chat');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ في التحليل', description: err.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg: ChatMsg = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const streamUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-devis-analyzer`;
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      const resp = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'chat',
          conversationHistory: [...chatMessages, userMsg],
          userMessage: chatInput.trim(),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      let assistantSoFar = '';
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > 1 && prev[prev.length - 2]?.role === 'user') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { /* partial JSON */ }
        }
      }

      if (assistantSoFar.includes('✅') && assistantSoFar.includes('جاهز')) {
        setPreferencesCollected(true);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateItems = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-devis-analyzer', {
        body: {
          action: 'generate_items',
          analysisData: {
            ...analysisData,
            surfaceEstimates: surfaceEstimates.length > 0 ? surfaceEstimates : analysisData?.surfaceEstimates,
          },
          materialQuality,
          discountPercent,
          profitMarginPercent,
        },
      });
      if (error) throw error;

      const items: LineItem[] = (data.items || data.suggestedItems || []).map((item: any) => ({
        id: generateId(),
        designation_fr: item.designation_fr || '',
        designation_ar: item.designation_ar || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'u',
        unitPrice: item.unitPrice || 0,
        total: (item.quantity || 1) * (item.unitPrice || 0),
        category: item.category,
      }));

      setLineItems(items);
      setStep('review');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ في التوليد', description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = updated.quantity * updated.unitPrice;
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => setLineItems(prev => prev.filter(i => i.id !== id));

  const addItem = () => {
    setLineItems(prev => [...prev, {
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: 1,
      unit: 'u',
      unitPrice: 0,
      total: 0,
    }]);
  };

  const grandTotal = lineItems.reduce((sum, i) => sum + i.total, 0);

  const handleSendToInvoice = () => {
    try {
      // Collect image photos for annexe
      const sitePhotos = uploadedFiles
        .filter(f => f.type === 'image')
        .map(f => ({ data: f.data, name: f.name }));

      const prefillData = {
        items: lineItems.map(item => ({
          ...item,
          id: generateId(),
        })),
        source: 'smart_devis',
        sitePhotos,
      };

      navigate('/pro/invoice-creator?type=devis&prefill=smart', {
        state: { smartDevisData: prefillData },
      });
    } catch (err: any) {
      const technicalMessage = err?.message || err?.context?.body || String(err);
      console.error('[SmartDevis->InvoiceTransfer] Failed to transfer data:', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ تقني أثناء التحويل' : 'Erreur technique de transfert',
        description: technicalMessage,
      });
    }
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  const HELP_GUIDES: Record<string, { title: string; steps: string[] }> = {
    photo: {
      title: '📸 ازاي تستخدم خاصية الصور؟',
      steps: [
        'صور الشانتي بوضوح — يعني الحيطان، السقف، الأرض.',
        'السيستم هيعرف لو الحيطة محتاجة وشين بانتيرة أو أندوي من الصورة.',
        'لو في كارلاج أو فايونس، صور الأرضية كمان.',
        'اكتب تفاصيل إضافية في الخانة (مثلاً: "الحيطة محتاجة أندوي طبقتين وبانتيرة ساتيني").',
        'السيستم هيحسب المساحة ويعمل الدوفي تلقائي!',
      ],
    },
    blueprint: {
      title: '🗺️ ازاي تستخدم خاصية المخططات؟',
      steps: [
        'ارفع المخطط أو الكروكي بتاع الشانتي.',
        'السيستم هيقرأ المقاسات من الرسم.',
        'لو الرسم فيه أبعاد (مثلاً 3m × 4m)، هيحسب المساحة.',
        'اكتب في الخانة نوع الشغل اللي عايزه (بانتيرة، كارلاج، جبس...).',
        'السيستم هيطلعلك دوفي بالأسعار والكميات!',
      ],
    },
    document: {
      title: '📄 ازاي تستخدم خاصية المستندات؟',
      steps: [
        'انسخ كلام الزبون من واتساب أو إيميل وحطه هنا.',
        'والسيستم هيعمل الدوفي الرسمي بالفرنسي.',
        'ممكن كمان ترفع PDF لو الزبون بعتلك كراس الشروط.',
        'السيستم هيحلل الطلب ويطلعلك كل البنود.',
        'بعدها تقدر تعدل الأسعار وتضيف هامش الربح بتاعك!',
      ],
    },
  };

  const INPUT_TYPES = [
    { type: 'photo' as const, icon: Camera, emoji: '📸', title: 'صورة الشانتي', titleFr: 'Photo du chantier', desc: 'صوّر الشغل وأنا أقدّر', gradient: 'from-blue-500 to-blue-600' },
    { type: 'blueprint' as const, icon: Map, emoji: '🗺️', title: 'خريطة أو كروكي', titleFr: 'Plan ou croquis', desc: 'ارفع المخطط وأنا أقرأ المقاسات', gradient: 'from-emerald-500 to-emerald-600' },
    { type: 'document' as const, icon: FileText, emoji: '📄', title: 'مستند أو نص', titleFr: 'Document ou texte', desc: 'ارفع PDF أو الصق نص من إيميل', gradient: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div className="py-4 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/pro')}>
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn("text-xl font-bold text-foreground", isRTL && "font-cairo")}>
            🏗️ {isRTL ? 'الدوفي الذكي' : 'Smart Devis IA'}
          </h1>
          <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'حوّل الصور لدوفي احترافي بالذكاء الاصطناعي' : 'Transformez vos photos en devis professionnel'}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs font-bold">14,99€</Badge>
      </div>

      {/* Step 1: Select Input Type */}
      {step === 'select_input' && (
        <div className="space-y-3">
          <p className={cn("text-sm font-medium text-center text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'اختار نوع المدخل:' : 'Choisissez le type d\'entrée:'}
          </p>
          {INPUT_TYPES.map(({ type, emoji, title, titleFr, desc, gradient }) => (
            <div key={type} className="space-y-1">
              <Card
                className={cn("cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-none overflow-hidden", `bg-gradient-to-r ${gradient}`)}
                onClick={() => handleInputTypeSelect(type)}
              >
                <CardContent className="p-0">
                  <div className={cn("flex items-center gap-4 p-5", isRTL && "flex-row-reverse")}>
                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <span className="text-2xl">{emoji}</span>
                    </div>
                    <div className={cn("flex-1", isRTL && "text-right")}>
                      <h3 className={cn("text-lg font-bold text-white", isRTL && "font-cairo")}>{title}</h3>
                      <p className="text-white/70 text-xs">{titleFr}</p>
                      <p className={cn("text-white/80 text-xs mt-1", isRTL && "font-cairo")}>{desc}</p>
                    </div>
                    <Arrow className="h-5 w-5 text-white/60" />
                  </div>
                </CardContent>
              </Card>
              <button
                onClick={(e) => { e.stopPropagation(); setHelpGuide(type); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full",
                  "bg-destructive/15 hover:bg-destructive/25 transition-colors",
                  "text-xs font-cairo text-destructive font-semibold",
                  isRTL && "flex-row-reverse mr-auto"
                )}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>تحب اشرح تستخدم الخاصية دي ازاي؟</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Photo Guide Onboarding */}
      {step === 'photo_guide' && (
        <div className="space-y-4">
          <Card className="border-2 border-[#c5a028]/30 bg-gradient-to-br from-background to-[#c5a028]/5 overflow-hidden">
            <CardHeader className="bg-[#1a1a1a] text-white pb-4">
              <CardTitle className={cn("text-center text-lg", isRTL && "font-cairo")}>
                📸 {isRTL ? 'نصائح لصور أفضل' : 'Conseils pour de meilleures photos'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {[
                { icon: Maximize, emoji: '🏠', titleFr: 'Vue Large', titleAr: 'صورة شاملة', descFr: 'Prenez une photo de toute la pièce.', descAr: 'صوّر الأوضة كلها من بعيد.' },
                { icon: SunMedium, emoji: '☀️', titleFr: 'Lumière', titleAr: 'إضاءة كويسة', descFr: 'Assurez-vous que l\'endroit est bien éclairé.', descAr: 'تأكد إن المكان منور كويس.' },
                { icon: ZoomIn, emoji: '🔍', titleFr: 'Focus Défauts', titleAr: 'صوّر العيوب', descFr: 'Photographiez de près les fissures ou l\'humidité.', descAr: 'صوّر الشروخ والرطوبة عن قرب.' },
                { icon: Ruler, emoji: '📏', titleFr: 'Échelle', titleAr: 'مقياس', descFr: 'Si possible, montrez un outil de mesure dans le champ.', descAr: 'لو تقدر، حط مسطرة أو مقياس جنب الحاجة.' },
              ].map((tip, i) => (
                <div key={i} className={cn("flex items-start gap-4 p-3 rounded-xl bg-card border border-border/50", isRTL && "flex-row-reverse")}>
                  <div className="w-11 h-11 rounded-lg bg-[#c5a028]/15 flex items-center justify-center shrink-0">
                    <tip.icon className="h-5 w-5 text-[#c5a028]" />
                  </div>
                  <div className={cn("flex-1", isRTL && "text-right")}>
                    <p className={cn("font-bold text-sm text-foreground", isRTL && "font-cairo")}>
                      {tip.emoji} {isRTL ? tip.titleAr : tip.titleFr}
                    </p>
                    <p className={cn("text-xs text-muted-foreground mt-0.5", isRTL && "font-cairo")}>
                      {isRTL ? tip.descAr : tip.descFr}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Control Banner */}
          <div className={cn("flex items-start gap-3 p-4 rounded-xl border-2 border-[#c5a028]/30 bg-[#c5a028]/5", isRTL && "flex-row-reverse")}>
            <ShieldCheck className="h-6 w-6 text-[#c5a028] shrink-0 mt-0.5" />
            <p className={cn("text-xs text-foreground leading-relaxed", isRTL && "text-right font-cairo")}>
              {isRTL
                ? "الذكاء الاصطناعي هيحلل صورك ويقترح أشغال، لكن إنت اللي عندك الكلمة الأخيرة. تقدر تعدل أو تحذف أي بند قبل التأكيد النهائي."
                : "L'IA analyse vos photos pour suggérer des travaux, mais VOUS gardez le contrôle total. Vous pourrez modifier ou supprimer chaque ligne avant la validation finale."}
            </p>
          </div>

          {/* Navigation */}
          <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={() => { setStep('select_input'); setInputType(null); }} className="flex-1">
              {isRTL ? 'رجوع' : 'Retour'}
            </Button>
            <Button
              onClick={() => setStep('upload')}
              className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white font-bold"
            >
              <Camera className="h-4 w-4 mr-2" />
              <span className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'فهمت، يلا نبدأ ✅' : 'Compris, commencer ✅'}
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Upload (Multi-file) */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
              <CardTitle className={cn("text-base", isRTL && "text-right font-cairo")}>
                {isRTL ? 'ارفع الملفات' : 'Téléchargez les fichiers'}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {uploadedFiles.length}/{MAX_FILES}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Dropzone */}
            <div
              onClick={() => uploadedFiles.length < MAX_FILES && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                isDragOver
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-muted-foreground/30 hover:border-primary/50",
                uploadedFiles.length >= MAX_FILES && "opacity-50 cursor-not-allowed"
              )}
            >
              <Upload className={cn("h-8 w-8 mx-auto mb-2", isDragOver ? "text-primary" : "text-muted-foreground/50")} />
              <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
                {isRTL
                  ? uploadedFiles.length >= MAX_FILES
                    ? `وصلت الحد الأقصى (${MAX_FILES} ملفات)`
                    : 'اسحب الملفات هنا أو اضغط لاختيار صور و PDF'
                  : uploadedFiles.length >= MAX_FILES
                    ? `Limite atteinte (${MAX_FILES} fichiers)`
                    : 'Glissez-déposez ou cliquez pour sélectionner images & PDF'}
              </p>
              <p className={cn("text-xs text-muted-foreground/60 mt-1", isRTL && "font-cairo")}>
                {isRTL ? `حتى ${MAX_FILES} ملفات • الحد الأقصى 10 ميجا لكل ملف` : `Jusqu'à ${MAX_FILES} fichiers • 10 Mo max par fichier`}
              </p>
            </div>

            {/* File Gallery */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className={cn("text-xs font-medium text-muted-foreground", isRTL && "font-cairo text-right")}>
                  {isRTL ? `📂 الملفات المرفوعة (${uploadedFiles.length})` : `📂 Fichiers uploadés (${uploadedFiles.length})`}
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {uploadedFiles.map((file, idx) => (
                    <div key={file.id} className="relative group">
                      {file.type === 'image' ? (
                        <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-background shadow-sm">
                          <img
                            src={file.data}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-square rounded-lg border-2 border-background shadow-sm bg-muted/30 flex flex-col items-center justify-center gap-1 p-1">
                          <FileText className="h-6 w-6 text-destructive" />
                          <span className="text-[8px] text-muted-foreground text-center truncate w-full px-1">
                            {file.name.length > 12 ? file.name.slice(0, 10) + '...' : file.name}
                          </span>
                        </div>
                      )}
                      
                      {/* Remove button */}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      
                      {/* Number badge */}
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {idx + 1}
                      </div>
                    </div>
                  ))}
                  
                  {/* Add more button */}
                  {uploadedFiles.length < MAX_FILES && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Plus className="h-5 w-5 text-muted-foreground/50" />
                      <span className="text-[9px] text-muted-foreground/50 mt-0.5">
                        {isRTL ? 'أضف' : 'Ajouter'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pasted text area */}
            <div className="space-y-2">
              <label className={cn("text-sm font-medium text-muted-foreground", isRTL && "font-cairo block text-right")}>
                {isRTL ? 'أو الصق هنا طلب الزبون (إيميل، واتساب، SMS...)' : 'Ou collez ici la demande du client (E-mail, WhatsApp, SMS...)'}
              </label>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={isRTL ? 'انسخ طلب الزبون أو اكتب تفاصيل الشغلانة هنا (مثلاً: أندوي، بانتيرة، هامش الربح...)' : 'Collez la demande du client ou décrivez les travaux ici (ex: enduit, peinture, marge...)'}
                className={cn("min-h-[100px] resize-none", isRTL && "text-right font-cairo")}
              />
            </div>

            <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
              <Button variant="outline" onClick={() => { setStep(inputType === 'photo' ? 'photo_guide' : 'select_input'); setUploadedFiles([]); setPastedText(''); }} className="flex-1">
                {isRTL ? 'رجوع' : 'Retour'}
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={(uploadedFiles.length === 0 && !pastedText.trim()) || isAnalyzing}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white font-bold"
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className={cn("mr-2", isRTL && "font-cairo")}>
                  {isAnalyzing ? (isRTL ? 'بحلل...' : 'Analyse...') : (isRTL ? 'حلل بالذكاء الاصطناعي' : 'Analyser avec l\'IA')}
                </span>
              </Button>
            </div>

            {/* AI Control Banner in upload step */}
            {inputType === 'photo' && (
              <div className={cn("flex items-start gap-3 p-3 rounded-xl border border-[#c5a028]/30 bg-[#c5a028]/5", isRTL && "flex-row-reverse")}>
                <ShieldCheck className="h-5 w-5 text-[#c5a028] shrink-0 mt-0.5" />
                <p className={cn("text-[11px] text-muted-foreground leading-relaxed", isRTL && "text-right font-cairo")}>
                  {isRTL
                    ? "تقدر تعدل أو تحذف أي بند بعد التحليل. إنت اللي عندك الكلمة الأخيرة."
                    : "Vous pourrez modifier ou supprimer chaque ligne après l'analyse. Vous gardez le contrôle total."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: AI Chat */}
      {step === 'chat' && (
        <div className="space-y-3">
          {/* Uploaded files thumbnails */}
          {uploadedFiles.length > 0 && (
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 justify-center py-1">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="shrink-0">
                    {file.type === 'image' ? (
                      <img src={file.data} alt={file.name} className="h-16 w-16 rounded-lg border object-cover" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg border bg-muted/30 flex flex-col items-center justify-center">
                        <FileText className="h-5 w-5 text-destructive" />
                        <span className="text-[7px] text-muted-foreground mt-0.5">PDF</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}

          {/* Surface Estimates (editable) */}
          {surfaceEstimates.length > 0 && (
            <Card className="border-2 border-blue-500/20 bg-blue-500/5">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className={cn("text-sm flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
                  📐 {isRTL ? 'المساحات المقدرة (عدّل لو محتاج)' : 'Surfaces estimées (modifiables)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {surfaceEstimates.map((se, idx) => (
                  <div key={se.id || idx} className="rounded-lg border bg-card p-2.5 space-y-1.5">
                    <div className={cn("flex items-center justify-between gap-2", isRTL && "flex-row-reverse")}>
                      <p className={cn("text-xs font-semibold text-foreground", isRTL && "font-cairo")}>
                        {isRTL ? se.label_ar : se.label_fr}
                      </p>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {se.workType}
                      </Badge>
                    </div>
                    <p className={cn("text-[10px] text-muted-foreground", isRTL && "text-right font-cairo")}>
                      🔍 {isRTL ? se.referenceObject_ar : se.referenceObject_fr}
                    </p>
                    <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                      <div className="flex-1">
                        <label className="text-[9px] text-muted-foreground">{isRTL ? 'عرض (م)' : 'Larg. (m)'}</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={se.width_m}
                          onChange={(e) => {
                            const w = parseFloat(e.target.value) || 0;
                            setSurfaceEstimates(prev => prev.map((s, i) => i === idx ? { ...s, width_m: w, area_m2: Math.round(w * s.height_m * 10) / 10 } : s));
                          }}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-muted-foreground">{isRTL ? 'ارتفاع (م)' : 'Haut. (m)'}</label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={se.height_m}
                          onChange={(e) => {
                            const h = parseFloat(e.target.value) || 0;
                            setSurfaceEstimates(prev => prev.map((s, i) => i === idx ? { ...s, height_m: h, area_m2: Math.round(s.width_m * h * 10) / 10 } : s));
                          }}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-muted-foreground font-semibold">{isRTL ? 'المساحة' : 'Surface'}</label>
                        <div className="h-7 flex items-center px-2 bg-muted rounded-md text-xs font-bold text-foreground">
                          {se.area_m2} m²
                        </div>
                      </div>
                    </div>
                    {se.confidence && (
                      <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
                        <span className={cn(
                          "inline-block w-1.5 h-1.5 rounded-full",
                          se.confidence === 'high' ? 'bg-green-500' : se.confidence === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                        )} />
                        <span className="text-[9px] text-muted-foreground">
                          {se.confidence === 'high' ? (isRTL ? 'دقة عالية' : 'Précision élevée') : se.confidence === 'medium' ? (isRTL ? 'دقة متوسطة' : 'Précision moyenne') : (isRTL ? 'دقة منخفضة' : 'Précision faible')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <p className={cn("text-[10px] text-muted-foreground text-center", isRTL && "font-cairo")}>
                  📏 {isRTL ? `المساحة الإجمالية: ${surfaceEstimates.reduce((s, e) => s + e.area_m2, 0).toFixed(1)} م²` : `Surface totale: ${surfaceEstimates.reduce((s, e) => s + e.area_m2, 0).toFixed(1)} m²`}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Chat messages */}
          <ScrollArea className="h-[45vh] rounded-xl border bg-muted/20 p-3">
            <div className="space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start'))}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border shadow-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} isRTL={isRTL} />
                    ) : (
                      <p className={cn(isRTL && "font-cairo text-right")} dir={isRTL ? 'rtl' : 'ltr'}>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                <div className={cn("flex", isRTL ? 'justify-end' : 'justify-start')}>
                  <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Preferences quick select */}
          <Card className="p-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>
                  {isRTL ? 'جودة المواد' : 'Qualité'}
                </label>
                <Select value={materialQuality} onValueChange={setMaterialQuality}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eco">🏷️ إقتصادي (Éco)</SelectItem>
                    <SelectItem value="standard">⭐ متوسط (Standard)</SelectItem>
                    <SelectItem value="luxe">💎 لوكس (Luxe)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>
                  {isRTL ? 'خصم %' : 'Remise %'}
                </label>
                <Input type="number" min={0} max={50} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div>
                <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>
                  {isRTL ? 'ربح %' : 'Marge %'}
                </label>
                <Input type="number" min={0} max={100} value={profitMarginPercent} onChange={e => setProfitMarginPercent(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
          </Card>

          {/* Chat input */}
          <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
            <Textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={isRTL ? 'اكتب رسالتك...' : 'Votre message...'}
              className={cn("min-h-[44px] max-h-[100px] resize-none text-sm", isRTL && "text-right font-cairo")}
              dir={isRTL ? 'rtl' : 'ltr'}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); } }}
            />
            <Button size="icon" onClick={handleChatSend} disabled={!chatInput.trim() || isChatLoading} className="shrink-0">
              {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {/* Generate button */}
          <Button
            className="w-full bg-[#1a1a1a] hover:bg-[#333] text-[#c5a028] font-bold border border-[#c5a028]/30"
            onClick={handleGenerateItems}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            <span className={cn(isRTL && "font-cairo")}>
              {isRTL ? '🏗️ ولّد الدوفي الذكي' : '🏗️ Générer le Smart Devis'}
            </span>
          </Button>
        </div>
      )}

      {/* Step 4: Review & Edit */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
            <h2 className={cn("text-lg font-bold", isRTL && "font-cairo")}>
              {isRTL ? '📋 مراجعة وتعديل البنود' : '📋 Revue & Modification'}
            </h2>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              {isRTL ? 'أضف' : 'Ajouter'}
            </Button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <Card key={item.id} className="p-3">
                <div className="space-y-2">
                  <div className={cn("flex items-start gap-2", isRTL && "flex-row-reverse")}>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{idx + 1}</Badge>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={item.designation_fr}
                        onChange={e => updateItem(item.id, 'designation_fr', e.target.value)}
                        placeholder="Désignation FR"
                        className="text-xs h-8"
                      />
                      <Input
                        value={item.designation_ar}
                        onChange={e => updateItem(item.id, 'designation_ar', e.target.value)}
                        placeholder="الوصف بالعربي"
                        className={cn("text-xs h-8", isRTL && "text-right font-cairo")}
                        dir="rtl"
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <label className="text-[9px] text-muted-foreground">{isRTL ? 'كمية' : 'Qté'}</label>
                      <Input type="number" min={0} step={0.1} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="text-xs h-7" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">{isRTL ? 'وحدة' : 'Unité'}</label>
                      <Select value={item.unit} onValueChange={v => updateItem(item.id, 'unit', v)}>
                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="m²">m²</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="u">u</SelectItem>
                          <SelectItem value="h">h</SelectItem>
                          <SelectItem value="forfait">forfait</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">{isRTL ? 'سعر' : 'P.U.'}</label>
                      <Input type="number" min={0} step={0.01} value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="text-xs h-7" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Total</label>
                      <div className="h-7 flex items-center text-xs font-bold text-[#c5a028]">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Grand Total */}
          <Card className="bg-[#1a1a1a] text-white border border-[#c5a028]/40">
            <CardContent className={cn("flex items-center justify-between p-4", isRTL && "flex-row-reverse")}>
              <span className={cn("font-bold text-lg", isRTL && "font-cairo")}>
                {isRTL ? 'المجموع الكلي HT' : 'Total HT'}
              </span>
              <span className="font-bold text-2xl">{formatCurrency(grandTotal)}</span>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full bg-[#c5a028] hover:bg-[#a88720] text-white font-bold"
              onClick={handleSendToInvoice}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              <span className={cn(isRTL && "font-cairo")}>
                {isRTL ? '✅ أرسل للدوفي النهائي' : '✅ Envoyer vers le Devis final'}
              </span>
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setStep('chat')}>
              <Edit3 className="h-4 w-4 mr-2" />
              <span className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'رجوع للدردشة' : 'Retour au chat'}
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* Help Guide Modal */}
      <Dialog open={!!helpGuide} onOpenChange={(open) => !open && setHelpGuide(null)}>
        <DialogContent className="max-w-md mx-4 rounded-2xl p-0 overflow-hidden">
          <div className="bg-destructive/10 p-6 pb-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-cairo text-center text-foreground">
                {helpGuide && HELP_GUIDES[helpGuide]?.title}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-3" dir="rtl">
            {helpGuide && HELP_GUIDES[helpGuide]?.steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-destructive/15 text-destructive flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 font-cairo">
                  {i + 1}
                </div>
                <p className="text-sm font-cairo text-foreground leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
          <div className="p-6 pt-2">
            <Button
              onClick={() => setHelpGuide(null)}
              className="w-full font-cairo text-base py-6 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              فهمت خلاص، يلا نبدأ ✅
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  );
};

export default SmartDevisPage;
