// SmartDevisPage - v3.2
import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
// Catalog removed — pricing via شبيك لبيك only
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
  SunMedium, Maximize, ZoomIn, Ruler, ShieldCheck, RotateCcw, Package, Mic, MicOff
} from 'lucide-react';
import SecurityBadge from '@/components/shared/SecurityBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EquipmentSuggestions from '@/components/smart-devis/EquipmentSuggestions';

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
  catalogCode?: string;
  withMaterial?: boolean; // For 'partiel' mode: user toggles material per line
  isAiEstimate?: boolean; // True when price was estimated by AI, not from catalog
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

type InputType = 'photo' | 'blueprint' | 'document' | null;
type Step = 'ai_intro' | 'select_input' | 'photo_guide' | 'upload' | 'chat' | 'material_choice' | 'review';
type QualityTier = 'standard' | 'pro' | 'luxury';

interface SmartDevisWizardSnapshot {
  step: Step;
  inputType: InputType;
  uploadedFiles: UploadedFile[];
  pastedText: string;
  analysisData: any;
  chatMessages: ChatMsg[];
  lineItems: LineItem[];
  materialQuality: string;
  discountPercent: number;
  profitMarginPercent: number;
  preferencesCollected: boolean;
  surfaceEstimates: SurfaceEstimate[];
  materialScope: 'fourniture_et_pose' | 'main_oeuvre_seule' | 'partiel' | null;
}

interface SmartDevisRouteState {
  restoreWizard?: boolean;
  wizardSnapshot?: SmartDevisWizardSnapshot;
  forceFreshSession?: boolean;
}

const MAX_FILES = 10;
const SMART_DEVIS_WIZARD_STATE_KEY = 'smartDevisWizardState';
const SMART_DEVIS_SKIP_RESTORE_ONCE_KEY = 'smartDevisSkipRestoreOnce';

// MaterialScopeSelector removed — Shubbaik Lubbaik is the sole pricing authority

const SmartDevisPage = () => {
  const { isRTL, t } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didRestoreWizardRef = useRef(false);
  // scopeSelectorRef removed — MaterialScopeSelector no longer exists

  const [step, setStep] = useState<Step>('ai_intro');
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
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [fetchingRowIds, setFetchingRowIds] = useState<Set<string>>(new Set());
  const [editingDesignation, setEditingDesignation] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [preferencesCollected, setPreferencesCollected] = useState(false);
  const [helpGuide, setHelpGuide] = useState<'photo' | 'blueprint' | 'document' | null>(null);
  const [surfaceEstimates, setSurfaceEstimates] = useState<SurfaceEstimate[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [materialScope, setMaterialScope] = useState<'fourniture_et_pose' | 'main_oeuvre_seule' | 'partiel'>('fourniture_et_pose');
  // catalogByCode removed — pricing via شبيك لبيك only
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const voiceRecognitionRef = useRef<any>(null);

  const startVoiceInput = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = isRTL ? 'ar-EG' : 'fr-FR';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsVoiceListening(true);
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' ';
        }
      }
      if (transcript.trim()) {
        setPastedText(prev => (prev ? prev + ' ' : '') + transcript.trim());
      }
    };
    recognition.onerror = () => { setIsVoiceListening(false); voiceRecognitionRef.current = null; };
    recognition.onend = () => { setIsVoiceListening(false); voiceRecognitionRef.current = null; };
    voiceRecognitionRef.current = recognition;
    recognition.start();
  }, [isRTL]);

  const stopVoiceInput = useCallback(() => {
    voiceRecognitionRef.current?.stop();
    setIsVoiceListening(false);
    voiceRecognitionRef.current = null;
  }, []);

  const clearSmartDevisStorage = useCallback(() => {
    try {
      localStorage.removeItem(SMART_DEVIS_WIZARD_STATE_KEY);
      sessionStorage.removeItem(SMART_DEVIS_WIZARD_STATE_KEY);
      localStorage.removeItem('smartDevisData');
      sessionStorage.removeItem('smartDevisData');
      localStorage.removeItem(SMART_DEVIS_SKIP_RESTORE_ONCE_KEY);
      sessionStorage.removeItem(SMART_DEVIS_SKIP_RESTORE_ONCE_KEY);
    } catch {
      // ignore storage access errors
    }
  }, []);

  const resetWizardState = useCallback(() => {
    setStep('ai_intro');
    setInputType(null);
    setUploadedFiles([]);
    setPastedText('');
    setAnalysisData(null);
    setChatMessages([]);
    setChatInput('');
    setLineItems([]);
    setMaterialQuality('standard');
    setDiscountPercent(0);
    setProfitMarginPercent(15);
    setPreferencesCollected(false);
    setSurfaceEstimates([]);
    // materialScope is now fixed to 'fourniture_et_pose'
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // CATALOG & BTP REFERENCE REMOVED — All pricing via شبيك لبيك (✨) only

  const normalizeCatalogUnit = (unit: string): string => {
    if (unit === 'unit') return 'u';
    if (unit === 'm2') return 'm²';
    return unit || 'u';
  };

  // RULE: Display AI text verbatim — no prefixing, no stripping, no modification

  const buildWizardSnapshot = useCallback((): SmartDevisWizardSnapshot => ({
    step,
    inputType,
    uploadedFiles,
    pastedText,
    analysisData,
    chatMessages,
    lineItems,
    materialQuality,
    discountPercent,
    profitMarginPercent,
    preferencesCollected,
    surfaceEstimates,
    materialScope,
  }), [
    step,
    inputType,
    uploadedFiles,
    pastedText,
    analysisData,
    chatMessages,
    lineItems,
    materialQuality,
    discountPercent,
    profitMarginPercent,
    preferencesCollected,
    surfaceEstimates,
    materialScope,
  ]);

  useEffect(() => {
    if (didRestoreWizardRef.current) return;

    const routeState = (location.state as SmartDevisRouteState | null) ?? null;
    const explicitRestore = routeState?.restoreWizard === true;
    const forceFreshSession = routeState?.forceFreshSession === true;

    try {
      const shouldSkipRestore =
        sessionStorage.getItem(SMART_DEVIS_SKIP_RESTORE_ONCE_KEY) === '1' ||
        localStorage.getItem(SMART_DEVIS_SKIP_RESTORE_ONCE_KEY) === '1';

      if (shouldSkipRestore || forceFreshSession || !explicitRestore) {
        clearSmartDevisStorage();
        didRestoreWizardRef.current = true;
        if (location.state) {
          navigate(location.pathname, { replace: true, state: null });
        }
        return;
      }
    } catch {
      clearSmartDevisStorage();
      didRestoreWizardRef.current = true;
      if (location.state) {
        navigate(location.pathname, { replace: true, state: null });
      }
      return;
    }

    let snapshot = routeState?.wizardSnapshot || null;

    if (!snapshot) {
      try {
        const localRaw = localStorage.getItem(SMART_DEVIS_WIZARD_STATE_KEY);
        const sessionRaw = sessionStorage.getItem(SMART_DEVIS_WIZARD_STATE_KEY);
        const raw = localRaw || sessionRaw;
        snapshot = raw ? JSON.parse(raw) : null;
      } catch {
        snapshot = null;
      }
    }

    if (!snapshot) {
      clearSmartDevisStorage();
      didRestoreWizardRef.current = true;
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    const hasProgress =
      (snapshot.uploadedFiles?.length ?? 0) > 0 ||
      !!snapshot.pastedText ||
      !!snapshot.analysisData ||
      (snapshot.chatMessages?.length ?? 0) > 0 ||
      (snapshot.lineItems?.length ?? 0) > 0 ||
      (snapshot.step !== 'select_input' && snapshot.step !== 'ai_intro');

    if (!hasProgress) {
      clearSmartDevisStorage();
      didRestoreWizardRef.current = true;
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    didRestoreWizardRef.current = true;
    setStep(snapshot.step || 'select_input');
    setInputType(snapshot.inputType ?? null);
    setUploadedFiles(Array.isArray(snapshot.uploadedFiles) ? snapshot.uploadedFiles : []);
    setPastedText(snapshot.pastedText || '');
    setAnalysisData(snapshot.analysisData || null);
    setChatMessages(Array.isArray(snapshot.chatMessages) ? snapshot.chatMessages : []);
    setLineItems(Array.isArray(snapshot.lineItems) ? snapshot.lineItems : []);
    setMaterialQuality(snapshot.materialQuality || 'standard');
    setDiscountPercent(typeof snapshot.discountPercent === 'number' ? snapshot.discountPercent : 0);
    setProfitMarginPercent(typeof snapshot.profitMarginPercent === 'number' ? snapshot.profitMarginPercent : 15);
    setPreferencesCollected(!!snapshot.preferencesCollected);
    setSurfaceEstimates(Array.isArray(snapshot.surfaceEstimates) ? snapshot.surfaceEstimates : []);
    // materialScope is fixed to 'fourniture_et_pose' — no restore needed

    toast({
      title: isRTL ? '📝 تم استعادة بياناتك' : '📝 Données restaurées',
      description: isRTL ? 'الشغل اللي كنت شغال عليه رجعلك' : 'Votre travail en cours a été restauré',
      className: 'mt-24 sm:mt-0',
    });

    navigate(location.pathname, { replace: true, state: null });
  }, [clearSmartDevisStorage, location.pathname, location.state, navigate, isRTL, toast]);

  useEffect(() => {
    const snapshot = buildWizardSnapshot();
    const hasProgress =
      (snapshot.step !== 'select_input' && snapshot.step !== 'ai_intro') ||
      snapshot.uploadedFiles.length > 0 ||
      !!snapshot.pastedText.trim() ||
      !!snapshot.analysisData ||
      snapshot.chatMessages.length > 0 ||
      snapshot.lineItems.length > 0;

    try {
      if (hasProgress) {
        const snapshotJson = JSON.stringify(snapshot);
        localStorage.setItem(SMART_DEVIS_WIZARD_STATE_KEY, snapshotJson);
        sessionStorage.setItem(SMART_DEVIS_WIZARD_STATE_KEY, snapshotJson);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [buildWizardSnapshot]);

  // Force-save on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const snapshot = buildWizardSnapshot();
        const hasProgress =
          (snapshot.step !== 'select_input' && snapshot.step !== 'ai_intro') ||
          snapshot.uploadedFiles.length > 0 ||
          !!snapshot.pastedText.trim() ||
          !!snapshot.analysisData ||
          snapshot.chatMessages.length > 0 ||
          snapshot.lineItems.length > 0;
        if (hasProgress) {
          const json = JSON.stringify(snapshot);
          localStorage.setItem(SMART_DEVIS_WIZARD_STATE_KEY, json);
          sessionStorage.setItem(SMART_DEVIS_WIZARD_STATE_KEY, json);
        }
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [buildWizardSnapshot]);

  const handleInputTypeSelect = (type: InputType) => {
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

  const getSmartDevisFunctionUrls = () => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    const urls = [
      baseUrl ? `${baseUrl}/functions/v1/smart-devis-analyzer` : null,
      projectId ? `https://${projectId}.supabase.co/functions/v1/smart-devis-analyzer` : null,
    ].filter(Boolean) as string[];

    return Array.from(new Set(urls));
  };

  const getFunctionAuthHeaders = async () => {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

    return {
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken || publishableKey}`,
      'x-client-info': 'smart-devis-page',
    };
  };

  const invokeAnalyzer = async (payload: any) => {
    console.log('[SmartDevis] invokeAnalyzer: trying supabase.functions.invoke...');
    const { data, error } = await supabase.functions.invoke('smart-devis-analyzer', { body: payload });
    if (!error) {
      console.log('[SmartDevis] invokeAnalyzer: SDK invoke succeeded');
      return data;
    }
    console.warn('[SmartDevis] invokeAnalyzer: SDK invoke failed:', error?.message, '- trying fallback URLs');

    const urls = getSmartDevisFunctionUrls();
    const headers = await getFunctionAuthHeaders();
    let lastError: Error = error instanceof Error ? error : new Error(String(error?.message || 'Invoke error'));

    for (const url of urls) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        const rawBody = await resp.text();
        let parsedBody: any = {};
        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          parsedBody = { error: rawBody };
        }

        if (!resp.ok) {
          lastError = new Error(parsedBody?.error || rawBody || `HTTP ${resp.status}`);
          continue;
        }

        return parsedBody;
      } catch (fetchErr: any) {
        lastError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      }
    }

    throw lastError;
  };

  const handleAnalyze = async () => {
    console.log('[SmartDevis] handleAnalyze called, files:', uploadedFiles.length, 'text:', pastedText.trim().length);
    if (uploadedFiles.length === 0 && !pastedText.trim()) return;
    setIsAnalyzing(true);
    try {
      const scopeInstruction = materialScope === 'main_oeuvre_seule'
        ? "\n\nIMPORTANT: Mode main d'œuvre uniquement. N'inclus jamais le coût des matériaux."
        : materialScope === 'partiel'
          ? "\n\nIMPORTANT: Mode partiel. Prépare des lignes claires avec prix de référence stables; la fourniture sera ajustée ligne par ligne dans l'éditeur."
          : "\n\nIMPORTANT: Mode matériaux inclus + pose.";

      const baseMessage = inputType === 'blueprint'
        ? "Analyse ce plan/croquis et lis les dimensions exactes indiquées." + scopeInstruction
        : inputType === 'document'
        ? "Extrais les informations de ce document pour générer un devis." + scopeInstruction
        : "Analyse cette photo de chantier et estime les travaux nécessaires avec +10% de marge de sécurité." + scopeInstruction;

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

      console.log('[SmartDevis] Invoking analyzer with action:', body.action);
      const data = await invokeAnalyzer(body);
      console.log('[SmartDevis] Analysis response keys:', data ? Object.keys(data) : 'null');
      console.log('[SmartDevis] suggestedItems count:', Array.isArray(data?.suggestedItems) ? data.suggestedItems.length : 0);
      setAnalysisData(data);

      // Store surface estimates for editable display
      if (data.surfaceEstimates && Array.isArray(data.surfaceEstimates)) {
        setSurfaceEstimates(data.surfaceEstimates);
      }

      // ── Build structured 16-step BTP report from JSON fields ──
      const d = data.diagnostic || {};
      const area = data.estimatedArea ? `📐 المساحة المقدرة: **${data.estimatedArea} م²**` : '';
      const chantierType = data.chantierType || '';
      const confidence = data.confidence || '';
      const crew = data.estimatedCrew || {};
      const suggestedItems = Array.isArray(data.suggestedItems) ? data.suggestedItems : [];
      const normalizedSuggestedItems = suggestedItems
        .map((item: any) => ({
          designation_fr: typeof item?.designation_fr === 'string' ? item.designation_fr.trim() : '',
          designation_ar: typeof item?.designation_ar === 'string' ? item.designation_ar.trim() : '',
          quantity: typeof item?.quantity === 'number' && Number.isFinite(item.quantity)
            ? item.quantity
            : (typeof item?.quantity === 'string' && item.quantity.trim() !== '' ? item.quantity.trim() : ''),
          unit: typeof item?.unit === 'string' ? item.unit.trim() : '',
        }))
        .filter((item: any) => item.designation_fr || item.designation_ar);

      let content = `✅ **تقرير خبير الشانتي**\n\n`;

      // 1. Identification
      if (chantierType) content += `### 1️⃣ نوع الشانتي (Identification)\n${chantierType}\n\n`;

      // 2. Observations
      if (d.observations_ar) content += `### 2️⃣ الملاحظات (Observations)\n${d.observations_ar}\n\n`;

      // 3. Zone Analysis (from analysis_ar which contains zone details)
      const analysisAr = data.analysis_ar || data.analysis || '';
      if (analysisAr) content += `### 3️⃣ التحليل بالتفصيل\n${analysisAr}\n\n`;

      // 4. Diagnostic
      if (d.observations_fr) content += `### 4️⃣ التشخيص التقني (Diagnostic)\n${d.observations_fr}\n\n`;

      // 5. Causes
      if (d.causes_ar) content += `### 5️⃣ الأسباب المحتملة\n${d.causes_ar}\n\n`;

      // 6. Degradation Level
      if (d.degradationLevel) {
        const levelEmoji = d.degradationLevel === 'critique' ? '🔴' : d.degradationLevel === 'élevé' ? '🟠' : d.degradationLevel === 'moyen' ? '🟡' : '🟢';
        content += `### 6️⃣ مستوى التدهور\n${levelEmoji} **${d.degradationLevel}**\n\n`;
      }

      // 7. Work Plan
      if (data.workPlan_ar) content += `### 7️⃣ خطة الشغل (Plan de travaux)\n${data.workPlan_ar}\n\n`;

      // 8. Quantities / Area
      if (area) content += `### 8️⃣ تقدير الكميات\n${area}\n\n`;

      // 9. Duration & Crew
      if (data.estimatedDuration_ar || (crew.workers && crew.days)) {
        content += `### 9️⃣ المدة والفريق\n`;
        if (data.estimatedDuration_ar) content += `${data.estimatedDuration_ar}\n`;
        if (crew.workers && crew.days) content += `👷 ${crew.workers} عمال — 📅 ${crew.days} أيام\n`;
        content += `\n`;
      }

      // 10. Materials
      if (data.materials_ar && Array.isArray(data.materials_ar) && data.materials_ar.length > 0) {
        content += `### 🔟 المواد المطلوبة\n`;
        data.materials_ar.forEach((m: string) => { content += `• ${m}\n`; });
        content += `\n`;
      }

      // 11. Verification needed
      if (d.verificationNeeded_ar) content += `### 1️⃣1️⃣ محتاج معاينة في الموقع\n⚠️ ${d.verificationNeeded_ar}\n\n`;

      // 12. Missing info
      if (data.missingInfo_ar) content += `### 1️⃣2️⃣ معلومات ناقصة\n📋 ${data.missingInfo_ar}\n\n`;

      // 13. Client Summary
      if (data.clientSummary_ar) content += `### 1️⃣3️⃣ ملخص للعميل\n💬 ${data.clientSummary_ar}\n\n`;

      // 14. Confidence
      if (confidence) {
        const confEmoji = confidence === 'élevée' ? '🟢' : confidence === 'moyenne' ? '🟡' : '🔴';
        content += `### 1️⃣4️⃣ مستوى الثقة\n${confEmoji} **${confidence}**\n\n`;
      }

      if (normalizedSuggestedItems.length > 0) {
        content += `### 1️⃣5️⃣ قائمة الأعمال المحددة / Liste des travaux\n`;
        normalizedSuggestedItems.forEach((item: any, index: number) => {
          const fr = item.designation_fr ? `**${item.designation_fr}**` : '**Travail à confirmer**';
          const ar = item.designation_ar ? `_${item.designation_ar}_` : '_لازم يتأكد في المعاينة_';
          const quantity = item.quantity !== '' ? item.quantity : 1;
          const unit = item.unit || 'Ens';
          content += `${index + 1}. ${fr}\n   ${ar} → ${quantity} ${unit}\n`;
        });
        content += `\n✅ التحليل خلص! الخطوط دي هتدخل سطر بسطر في جدول الدوفي لما تدوس على زر إنشاء الدوفي. الأسعار هتفضل 0.00 لحد ما تدوس على ✨.\n\n`;
      }

      // ── French section ──
      content += `---\n\n## 🇫🇷 Analyse professionnelle\n\n`;
      const analysisFr = data.analysis_fr || '';
      if (analysisFr) content += `${analysisFr}\n\n`;
      if (d.causes_fr) content += `**Causes probables:** ${d.causes_fr}\n\n`;
      if (data.workPlan_fr) content += `**Plan de travaux:** ${data.workPlan_fr}\n\n`;
      if (data.estimatedDuration_fr) content += `**Durée estimée:** ${data.estimatedDuration_fr}\n\n`;
      if (data.materials_fr && Array.isArray(data.materials_fr) && data.materials_fr.length > 0) {
        content += `**Matériaux:** ${data.materials_fr.join(', ')}\n\n`;
      }
      if (normalizedSuggestedItems.length > 0) {
        content += `**Liste des travaux à intégrer au devis :**\n`;
        normalizedSuggestedItems.forEach((item: any, index: number) => {
          const fr = item.designation_fr || 'Travail à confirmer';
          const ar = item.designation_ar || 'À confirmer sur site';
          const quantity = item.quantity !== '' ? item.quantity : 1;
          const unit = item.unit || 'Ens';
          content += `${index + 1}. ${fr}\n   ${ar} → ${quantity} ${unit}\n`;
        });
        content += `\n`;
      }
      if (data.clientSummary_fr) content += `**Résumé client:** ${data.clientSummary_fr}\n\n`;
      if (d.verificationNeeded_fr) content += `**⚠️ Vérification requise:** ${d.verificationNeeded_fr}\n\n`;
      if (data.devisVerification_fr) content += `**Vérification du devis:** ${data.devisVerification_fr}\n\n`;

      const notesAr = data.notes_ar || data.notes || '';
      const notesFr = data.notes_fr || '';
      if (notesAr) content += `📝 ${notesAr}\n\n`;
      if (notesFr) content += `📝 ${notesFr}\n\n`;

      content += `---\nدلوقتي عايز أسألك كام سؤال عشان نعمل الدوفي صح:\n\n1️⃣ **جودة المواد؟** (اقتصادي / عادي / فخم)\n2️⃣ **هل في خصم؟** (نسبة %)\n3️⃣ **نسبة الربح المطلوبة؟** (%)`;

      setChatMessages([{ role: 'assistant', content }]);
      setStep('chat');
    } catch (err: any) {
      const technicalMessage = err?.context?.body || err?.message || 'Unknown analysis error';
      toast({ variant: 'destructive', title: 'خطأ في التحليل', description: technicalMessage });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Parse chat messages for prices and auto-fill devis table ──
  const parseChatPricesAndApply = useCallback((text: string) => {
    if (!text || lineItems.length === 0) return;

    // Detect patterns like: "CODE = XX€", "CODE: XX€/m²", "prix de CODE est XX€"
    const pricePatterns = [
      /\b([A-Z]{2,4}\d{2,3})\s*[=:→]\s*(\d+(?:[.,]\d+)?)\s*€/gi,
      /\b([A-Z]{2,4}\d{2,3})\s+(?:à|a|=)\s+(\d+(?:[.,]\d+)?)\s*€/gi,
      /prix\s+(?:de\s+)?([A-Z]{2,4}\d{2,3})\s*[=:]\s*(\d+(?:[.,]\d+)?)/gi,
    ];

    const detectedPrices: Record<string, number> = {};

    for (const pattern of pricePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const code = match[1].toUpperCase();
        const price = parseFloat(match[2].replace(',', '.'));
        if (code && price > 0) {
          detectedPrices[code] = price;
        }
      }
    }

    if (Object.keys(detectedPrices).length === 0) return;

    setLineItems(prev => prev.map(item => {
      const code = item.catalogCode?.toUpperCase();
      if (!code || !detectedPrices[code]) return item;
      // Don't overwrite manually set prices
      if (item.unitPrice > 0) return item;

      const newPrice = detectedPrices[code];
      return {
        ...item,
        unitPrice: newPrice,
        total: item.quantity * newPrice,
      };
    }));
  }, [lineItems.length]);

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg: ChatMsg = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const urls = getSmartDevisFunctionUrls();
      const headers = await getFunctionAuthHeaders();

      let resp: Response | null = null;
      let lastError: Error | null = null;

      for (const url of urls) {
        try {
          const candidate = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              action: 'chat',
              conversationHistory: [...chatMessages, userMsg],
              userMessage: chatInput.trim(),
            }),
          });

          if (candidate.ok && candidate.body) {
            resp = candidate;
            break;
          }

          const errTxt = await candidate.text();
          lastError = new Error(errTxt || `HTTP ${candidate.status}`);
        } catch (e: any) {
          lastError = e instanceof Error ? e : new Error(String(e));
        }
      }

      if (!resp || !resp.body) {
        throw lastError || new Error('Stream failed');
      }

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

      // ── AUTO-POPULATE: Parse assistant message for price mentions and apply to devis table ──
      parseChatPricesAndApply(assistantSoFar);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateItems = async () => {

    // Set materialScope based on user's per-item choices from material_choice step
    const allWith = lineItems.every(i => i.withMaterial);
    const noneWith = lineItems.every(i => !i.withMaterial);
    if (allWith) setMaterialScope('fourniture_et_pose');
    else if (noneWith) setMaterialScope('main_oeuvre_seule');
    else setMaterialScope('partiel');

    // Preserve material choices made by user — by index for exact transmission
    const materialChoicesByIndex: Record<number, boolean> = {};
    const materialChoicesByKey: Record<string, boolean> = {};
    lineItems.forEach((i, idx) => {
      materialChoicesByIndex[idx] = i.withMaterial ?? true;
      const key = `${(i.designation_fr || '').trim().toLowerCase()}|${(i.designation_ar || '').trim()}`;
      materialChoicesByKey[key] = i.withMaterial ?? true;
    });

    setIsGenerating(true);
    try {
      // Include conversation history so generate_items knows about user-requested additions
      const chatContext = chatMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10) // last 10 messages for context
        .map(m => ({ role: m.role, content: m.content }));

      const effectiveScope = allWith ? 'fourniture_et_pose' : noneWith ? 'main_oeuvre_seule' : 'partiel';

      const payload = {
        action: 'generate_items',
        analysisData: {
          chantierType: analysisData?.chantierType,
          renovationType: analysisData?.renovationType,
          finishColor: analysisData?.finishColor,
          workPlan_fr: analysisData?.workPlan_fr,
          workPlan_ar: analysisData?.workPlan_ar,
          estimatedArea: analysisData?.estimatedArea,
          surfaceEstimates: surfaceEstimates.length > 0 ? surfaceEstimates : analysisData?.surfaceEstimates,
          materials_fr: analysisData?.materials_fr,
          materials_ar: analysisData?.materials_ar,
          diagnostic: analysisData?.diagnostic,
          suggestedItems: analysisData?.suggestedItems,
        },
        conversationHistory: chatContext.length > 0 ? chatContext : undefined,
        materialQuality,
        discountPercent,
        profitMarginPercent,
        materialScope: effectiveScope,
      };

      const data = await invokeAnalyzer(payload);

      // ===== STRICT LOCK: transmit items literally, in order, with no deduplication =====
      const rawItems = Array.isArray(data.items) && data.items.length > 0
        ? data.items
        : (Array.isArray(data.suggestedItems) ? data.suggestedItems : []);

      const items: LineItem[] = rawItems.map((item: any, idx: number) => {
        const parsedQuantity = Number(item.quantity);
        const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;
        const aiUnit = typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'Ens';
        
        // Look up user's material choice — prefer index match, fallback to text key
        const key = `${(item.designation_fr || '').trim().toLowerCase()}|${(item.designation_ar || '').trim()}`;
        const withMaterial = idx in materialChoicesByIndex
          ? materialChoicesByIndex[idx]
          : (key in materialChoicesByKey ? materialChoicesByKey[key] : (effectiveScope !== 'main_oeuvre_seule'));

        // Pass AI text verbatim — no prefix modification
        const finalFr = item.designation_fr || '';
        const finalAr = item.designation_ar || '';

        return {
          id: generateId(),
          designation_fr: finalFr,
          designation_ar: finalAr,
          quantity,
          unit: aiUnit,
          unitPrice: 0,
          total: 0,
          category: item.category,
          catalogCode: typeof item.code === 'string' ? item.code.trim().toUpperCase() : undefined,
          withMaterial,
          isAiEstimate: false,
        };
      });

      setLineItems(items);
      setStep('review');

      // STRICT PRICING CONTROL: No auto-fill. Prices stay at 0 until user clicks ✨ button.
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
        const price = updated.unitPrice < 0 ? 0 : updated.unitPrice;
        updated.total = updated.quantity * price;
      }
      return updated;
    }));
  };

  // Code lookup removed — pricing via شبيك لبيك only
  const onCodeChange = useCallback(async (id: string, rawValue: string) => {
    updateItem(id, 'designation_fr', rawValue);
  }, []);

  const removeItem = (id: string) => setLineItems(prev => prev.filter(i => i.id !== id));

  // AI price estimation fallback — calls edge function for items without catalog match
  const estimatePricesWithAI = useCallback(async (items: LineItem[]): Promise<Record<string, { unitPrice: number; unit?: string }>> => {
    if (items.length === 0) return {};
    try {
      const payload = items.map(item => ({
        id: item.id,
        designation_fr: item.designation_fr,
        designation_ar: item.designation_ar,
        unit: item.unit,
        quantity: item.quantity,
        laborOnly: item.withMaterial === false || materialScope === 'main_oeuvre_seule',
      }));

      const token = user
        ? (await supabase.auth.getSession()).data.session?.access_token
        : null;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/estimate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ items: payload }),
      });

      if (!resp.ok) {
        console.error('AI price estimation failed:', resp.status);
        return {};
      }

      const data = await resp.json();
      const result: Record<string, { unitPrice: number; unit?: string }> = {};
      (data.prices || []).forEach((p: any) => {
        if (p.id && typeof p.unitPrice === 'number' && p.unitPrice > 0) {
          result[p.id] = { unitPrice: Math.round(p.unitPrice), unit: p.unit };
        }
      });
      return result;
    } catch (err) {
      console.error('AI estimation error:', err);
      return {};
    }
  }, [materialScope, user]);

  // resolveFromCatalog removed — pricing via شبيك لبيك only

  // "Shubbaik Lubbaik" — tarification via شبيك لبيك uniquement
  const handleFetchAIPrices = useCallback(async () => {
    setIsFetchingPrices(true);
    try {
      const itemsNeedingPrice = lineItems.filter(item => item.unitPrice === 0 || !item.unitPrice);
      if (itemsNeedingPrice.length === 0) {
        toast({ title: isRTL ? '✅ الأسعار موجودة' : '✅ Prix déjà remplis' });
        setIsFetchingPrices(false);
        return;
      }

      const aiPrices = await estimatePricesWithAI(itemsNeedingPrice);

      const updatedItems = lineItems.map(item => {
        if (item.unitPrice > 0) return item;
        const aiPrice = aiPrices[item.id];
        if (aiPrice && aiPrice.unitPrice > 0) {
          return {
            ...item,
            unitPrice: aiPrice.unitPrice,
            total: aiPrice.unitPrice * item.quantity,
            isAiEstimate: true,
          };
        }
        return item;
      });

      setLineItems(updatedItems);

      const aiCount = Object.keys(aiPrices).length;
      toast({
        title: isRTL ? '✅ تم ملء الأسعار' : '✅ Prix remplis',
        description: isRTL
          ? `✨ ${aiCount} أسعار من شبيك لبيك`
          : `✨ ${aiCount} prix depuis Shubbaik Lubbaik`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: err.message || 'Failed to fetch prices',
      });
    } finally {
      setIsFetchingPrices(false);
    }
  }, [lineItems, isRTL, toast, estimatePricesWithAI]);

  // Per-row price fetch: شبيك لبيك uniquement
  const handleFetchSingleRowPrice = useCallback(async (itemId: string) => {
    setFetchingRowIds(prev => new Set(prev).add(itemId));
    try {
      const item = lineItems.find(i => i.id === itemId);
      if (!item) return;

      const aiPrices = await estimatePricesWithAI([item]);
      const aiPrice = aiPrices[item.id];

      if (aiPrice && aiPrice.unitPrice > 0) {
        setLineItems(prev => prev.map(i => i.id !== itemId ? i : {
          ...i,
          unitPrice: aiPrice.unitPrice,
          total: aiPrice.unitPrice * i.quantity,
          isAiEstimate: true,
        }));
        toast({
          title: isRTL ? '✨ سعر من شبيك لبيك' : '✨ Prix Shubbaik Lubbaik',
          description: `${item.designation_fr}: ~${aiPrice.unitPrice}€/${item.unit}`,
        });
      } else {
        toast({
          title: isRTL ? '⚠️ عدّل السعر يدوياً' : '⚠️ Saisissez le prix manuellement',
          description: isRTL ? 'لم نتمكن من تقدير السعر' : 'Estimation non disponible',
        });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: err.message });
    } finally {
      setFetchingRowIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [lineItems, isRTL, toast, estimatePricesWithAI]);

  // Toggle withMaterial for a line item — designation stays verbatim from AI
  const toggleItemMaterial = (id: string) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const newWithMaterial = !item.withMaterial;
      return {
        ...item,
        withMaterial: newWithMaterial,
        // Reset price to 0 so user re-fetches via ✨
        unitPrice: 0,
        total: 0,
      };
    }));
  };

  const addItem = () => {
    const withMaterial = materialScope !== 'main_oeuvre_seule';
    setLineItems(prev => [...prev, {
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: 1,
      unit: 'u',
      unitPrice: 0,
      total: 0,
      withMaterial,
    }]);
  };

  const grandTotal = lineItems.reduce((sum, i) => sum + (i.total > 0 ? i.total : 0), 0);
  const hasUnverifiedPrices = lineItems.some(i => i.unitPrice <= 0);

  const handleSendToInvoice = () => {
    try {
      // Collect image photos for annexe
      const sitePhotos = uploadedFiles
        .filter(f => f.type === 'image')
        .map(f => ({ data: f.data, name: f.name }));

      // Auto-generate subject line from line items and analysis
      const generateSubject = (): string => {
        // Try to use AI-generated subject from analysis
        if (analysisData?.devis_subject_fr) return analysisData.devis_subject_fr;

        // Fallback: build from work types detected in line items
        const workTypes = new Set<string>();
        lineItems.forEach(item => {
          const fr = (item.designation_fr || '').toLowerCase();
          if (fr.includes('peinture') || fr.includes('enduit') || fr.includes('sous-couche')) workTypes.add('peinture');
          else if (fr.includes('carrelage') || fr.includes('faïence') || fr.includes('faience')) workTypes.add('carrelage');
          else if (fr.includes('parquet') || fr.includes('plinthes')) workTypes.add('parquet');
          else if (fr.includes('plomberie') || fr.includes('sanitaire') || fr.includes('robinet')) workTypes.add('plomberie');
          else if (fr.includes('electri') || fr.includes('prise') || fr.includes('interrupteur')) workTypes.add('électricité');
          else if (fr.includes('placo') || fr.includes('cloison') || fr.includes('faux plafond')) workTypes.add('placo');
          else if (fr.includes('démontage') || fr.includes('demontage')) workTypes.add('démontage');
        });

        if (workTypes.size === 0) return 'Travaux de rénovation';
        const typeLabels: Record<string, string> = {
          peinture: 'peinture',
          carrelage: 'carrelage',
          parquet: 'parquet',
          plomberie: 'plomberie',
          électricité: 'électricité',
          placo: 'placo / cloisons',
          démontage: 'démontage',
        };
        const labels = Array.from(workTypes).map(t => typeLabels[t] || t);
        return `Travaux de ${labels.join(', ')}`;
      };

      const autoSubject = generateSubject();

      const prefillData = {
        items: lineItems.map(item => {
          const isMaterial = materialScope === 'partiel'
            ? (item.withMaterial ?? false)
            : materialScope !== 'main_oeuvre_seule';
          const prefixFr = isMaterial ? 'Fourniture et pose : ' : "Main d'œuvre uniquement : ";
          const prefixAr = isMaterial ? 'توريد وتركيب : ' : 'مصنعية فقط : ';
          return {
            ...item,
            id: generateId(),
            designation_fr: `${prefixFr}${item.designation_fr || ''}`,
            designation_ar: `${prefixAr}${item.designation_ar || ''}`,
            referenceUnitPrice: item.unitPrice,
            materialsIncluded: isMaterial,
          };
        }),
        source: 'smart_devis',
        materialScope,
        priceMode: 'reference_fixed',
        sitePhotos,
        descriptionChantier: autoSubject,
      };

      const wizardSnapshot = buildWizardSnapshot();

      // CRITICAL: Clear any existing invoice draft BEFORE navigating
      // This prevents stale ghost data from overwriting the fresh Smart Devis results
      try {
        localStorage.removeItem('invoice_draft_v1');
        sessionStorage.removeItem('invoice_draft_v1');
      } catch { /* ignore */ }

      // Persist data + wizard snapshot as fallback for navigation state loss
      try {
        const prefillJson = JSON.stringify(prefillData);
        const snapshotJson = JSON.stringify(wizardSnapshot);
        sessionStorage.setItem('smartDevisData', prefillJson);
        localStorage.setItem('smartDevisData', prefillJson);
        sessionStorage.setItem(SMART_DEVIS_WIZARD_STATE_KEY, snapshotJson);
        localStorage.setItem(SMART_DEVIS_WIZARD_STATE_KEY, snapshotJson);
      } catch (e) {
        console.warn('Failed to persist smart devis data to storage:', e);
      }

      // AUTO-ERASE: Clear the entire chat history once devis is finalized
      setChatMessages([]);
      setChatInput('');

      navigate('/pro/invoice-creator?type=devis&prefill=smart', {
        state: {
          smartDevisData: prefillData,
          smartDevisReturnState: {
            restoreWizard: true,
            wizardSnapshot: { ...wizardSnapshot, chatMessages: [] },
          },
        },
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

  const handleHeaderBack = () => {
    if (step === 'review') {
      setStep('material_choice');
      return;
    }

    if (step === 'material_choice') {
      setStep('chat');
      return;
    }

    if (step === 'chat') {
      setStep('upload');
      return;
    }

    if (step === 'upload') {
      setStep(inputType === 'photo' ? 'photo_guide' : 'select_input');
      return;
    }

    if (step === 'photo_guide') {
      setStep('select_input');
      setInputType(null);
      return;
    }

    if (step === 'select_input') {
      setStep('ai_intro');
      return;
    }

    if (step === 'ai_intro') {
      navigate('/pro');
      return;
    }
    navigate('/pro');
  };

  const handleResetAnalysis = () => {
    setAnalysisData(null);
    setChatMessages([]);
    setSurfaceEstimates([]);
    setLineItems([]);
    setPreferencesCollected(false);
    setChatInput('');
    setStep('upload');
    toast({
      title: isRTL ? 'تمت إعادة الضبط' : 'Analyse réinitialisée',
      description: isRTL
        ? 'الصور والنص مازالوا محفوظين، تقدر تعيد التحليل.'
        : 'Vos photos et votre texte sont conservés, vous pouvez relancer l\'analyse.',
    });
  };

  const handleFullReset = () => {
    didRestoreWizardRef.current = true;
    resetWizardState();
    clearSmartDevisStorage();

    try {
      localStorage.setItem(SMART_DEVIS_SKIP_RESTORE_ONCE_KEY, '1');
      sessionStorage.setItem(SMART_DEVIS_SKIP_RESTORE_ONCE_KEY, '1');
    } catch {
      // ignore storage access errors
    }

    toast({
      title: isRTL ? '🆕 مشروع جديد' : '🆕 Nouveau projet',
      description: isRTL ? 'تم مسح كل البيانات، ابدأ من الأول' : 'Toutes les données ont été effacées',
    });
    navigate('/pro/documents', { replace: true });
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  const HELP_GUIDES: Record<string, { title: string; steps: string[] }> = {
    photo: {
      title: '📸 ازاي تستخدم خاصية الصور؟',
      steps: [
        'صور الشانتي بوضوح — يعني الحيطان، السقف، الأرض.',
        'السيستم هيعرف لو الحيطة محتاجة بنتيرة أو أندوي من الصورة.',
        'لو في كارلاج أو فايونس، صور الأرضية كمان.',
        'اكتب تفاصيل إضافية في الخانة (مثلاً: "الحيطة محتاجة أندوي طبقتين وبنتيرة ساتيني").',
        'السيستم هيقدر المساحة بشكل تقريبي من الصورة، وانت تقدر تعدل المقاسات بسهولة أثناء عمل الدوفي أو الفاتورة.',
      ],
    },
    blueprint: {
      title: '🗺️ ازاي تستخدم خاصية المخططات؟',
      steps: [
        'ارفع المخطط أو الكروكي بتاع الشانتي.',
        'السيستم هيقرأ المقاسات من الرسم.',
        'لو الرسم فيه أبعاد (مثلاً 3m × 4m)، هيحسب المساحة.',
        'اكتب في الخانة نوع الشغل اللي عايزه (بنتيرة، كارلاج، جبس...).',
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
    <div className={cn(
      "max-w-2xl mx-auto",
      (step === 'chat' || step === 'review' || step === 'material_choice')
        ? "fixed inset-0 z-40 flex flex-col bg-background"
        : "py-4 space-y-4"
    )}>
      {/* Header — hidden during full-screen chat */}
      {step !== 'chat' && step !== 'review' && step !== 'material_choice' && (
      <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={handleHeaderBack}>
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleFullReset}
          className="text-xs font-bold gap-1.5 border-primary/40 bg-primary/10 hover:bg-primary/20"
        >
          <Plus className="h-3.5 w-3.5" />
          {isRTL ? 'جديد' : 'Nouveau devis'}
        </Button>
      </div>
      )}

      {/* AI Intro Screen */}
      {step === 'ai_intro' && (
        <div className="flex flex-col items-center justify-center space-y-6 py-6 animate-in fade-in duration-500">
          {/* AI Icon */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles size={40} className="text-primary" />
          </div>

          {/* Arabic Text */}
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-sm" dir="rtl">
            <h2 className="text-lg font-bold font-cairo text-foreground mb-3 text-center">
              هل تعلم؟ 🤖
            </h2>
            <p className="text-base font-cairo text-foreground/90 leading-relaxed text-right" style={{ fontSize: '16px' }}>
              نوافذ الدردشة لدينا ليست مجرد أداة كتابة، بل هي خبير تقني معك في الشانتي. يمكنك طرح أي سؤال حول الأسعار، النصائح الفنية، أو إدارة المواقع... إنها ذكاء اصطناعي حقيقي يعمل من أجلك.
            </p>
          </div>

          {/* French Text */}
          <div className="bg-muted/50 border border-border/50 rounded-xl p-4 max-w-md w-full">
            <p className="text-sm text-muted-foreground leading-relaxed text-center" style={{ fontSize: '14px' }}>
              Nos fenêtres de discussion sont là pour répondre à toutes vos questions concernant vos chantiers (conseils, prix, technique...). C'est une véritable intelligence artificielle à votre service.
            </p>
          </div>

          {/* Start Button */}
          <Button
            size="lg"
            className="w-full max-w-md text-lg font-bold font-cairo py-6 rounded-xl"
            onClick={() => setStep('select_input')}
          >
            <Sparkles className="h-5 w-5 ml-2" />
            ابدأ
          </Button>
        </div>
      )}

      {/* Step 1: Select Input Type */}
      {step === 'select_input' && (
        <div className="space-y-3">
          <p className={cn("text-sm font-medium text-center text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'اختار نوع المدخل:' : 'Choisissez le type d\'entrée:'}
          </p>
          {INPUT_TYPES.map(({ type, emoji, title, titleFr, desc, gradient }) => (
            <div key={type} className="space-y-1">
              <Card
                className={cn("cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-none overflow-hidden relative", `bg-gradient-to-r ${gradient}`)}
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
                <span>تحب أشرحلك ازاي تستخدم الخاصية دي؟</span>
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

            {/* MaterialScopeSelector removed — Shubbaik Lubbaik is the sole pricing authority */}

            {/* Pasted text area */}
            <div className="space-y-2">
              <label className={cn("text-sm font-medium text-muted-foreground", isRTL && "font-cairo block text-right")}>
                {isRTL ? 'أو الصق هنا طلب الزبون (إيميل، واتساب، SMS...)' : 'Ou collez ici la demande du client (E-mail, WhatsApp, SMS...)'}
              </label>
              <div className="relative">
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={isRTL ? 'انسخ طلب الزبون أو اكتب تفاصيل الشغلانة هنا (مثلاً: أندوي، بنتيرة، هامش الربح...)' : 'Collez la demande du client ou décrivez les travaux ici (ex: enduit, peinture, marge...)'}
                  className={cn("min-h-[100px] resize-none pr-14", isRTL && "text-right font-cairo pl-14 pr-3")}
                />
                {/* Voice input button */}
                {('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && (
                  <Button
                    type="button"
                    variant={isVoiceListening ? 'destructive' : 'outline'}
                    size="icon"
                    className={cn(
                      "absolute top-2 h-12 w-12 rounded-full shadow-md border-2",
                      isRTL ? "left-2" : "right-2",
                      isVoiceListening ? "animate-pulse border-destructive" : "border-blue-500 text-blue-500 hover:bg-blue-500/10"
                    )}
                    onClick={isVoiceListening ? stopVoiceInput : startVoiceInput}
                  >
                    {isVoiceListening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                )}
              </div>
              {isVoiceListening && (
                <p className={cn("text-xs text-destructive font-medium animate-pulse", isRTL && "text-right font-cairo")}>
                  {isRTL ? '🎙️ بسمعك... اتكلم دلوقتي' : '🎙️ Écoute en cours... Parlez maintenant'}
                </p>
              )}
            </div>

            <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
              <Button variant="outline" onClick={() => { setStep(inputType === 'photo' ? 'photo_guide' : 'select_input'); }} className="flex-1">
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

      {/* Step 3: AI Chat — Full-screen layout */}
      {step === 'chat' && (
        <>
          {/* Chat Header */}
          <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur-sm px-3 py-2 safe-area-pt">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={handleHeaderBack}>
                {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
              </Button>
              <div className={cn("flex items-center gap-2 flex-1 min-w-0", isRTL && "flex-row-reverse")}>
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className={cn("min-w-0", isRTL && "text-right")}>
                  <p className={cn("text-sm font-bold text-foreground truncate", isRTL && "font-cairo")}>
                    {isRTL ? 'شبيك لبيك ✨' : 'Shubbaik Lubbaik ✨'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isRTL ? `${chatMessages.length} رسالة` : `${chatMessages.length} messages`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={handleResetAnalysis}>
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            {uploadedFiles.length > 0 && (
              <ScrollArea className="w-full whitespace-nowrap mt-2">
                <div className="flex gap-1.5 py-0.5">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="shrink-0">
                      {file.type === 'image' ? (
                        <img src={file.data} alt={file.name} className="h-10 w-10 rounded-lg border object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg border bg-muted/30 flex flex-col items-center justify-center">
                          <FileText className="h-3.5 w-3.5 text-destructive" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </div>

          {/* Messages area — scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="max-w-2xl mx-auto space-y-3">
              {/* Surface Estimates */}
              {surfaceEstimates.length > 0 && (
                <Card className="border border-amber-500/20 bg-amber-500/5">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className={cn("text-sm flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
                      📐 {isRTL ? 'المساحات المقدرة (عدّل لو محتاج)' : 'Surfaces estimées (modifiables)'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    <div className={cn("rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 p-2.5", isRTL && "text-right")}>
                      <p className={cn("text-[11px] font-semibold text-amber-700 dark:text-amber-300 leading-relaxed", isRTL && "font-cairo")}>
                        ⚠️ {isRTL
                          ? 'تقدير بصري تقريبي. يرجى التحقق من المساحة أو تعديلها قبل إنشاء الدوفي.'
                          : 'Estimation visuelle approximative. Veuillez vérifier ou corriger la surface avant de créer le devis.'}
                      </p>
                    </div>
                    {surfaceEstimates.map((se, idx) => (
                      <div key={se.id || idx} className="rounded-lg border bg-card p-2.5 space-y-1.5">
                        <div className={cn("flex items-center justify-between gap-2", isRTL && "flex-row-reverse")}>
                          <p className={cn("text-xs font-semibold text-foreground", isRTL && "font-cairo")}>{isRTL ? se.label_ar : se.label_fr}</p>
                          <Badge variant="outline" className="text-[9px] shrink-0">{se.workType}</Badge>
                        </div>
                        <p className={cn("text-[10px] text-muted-foreground", isRTL && "text-right font-cairo")}>
                          🔍 {isRTL ? se.referenceObject_ar : se.referenceObject_fr}
                        </p>
                        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                          <div className="flex-1">
                            <label className="text-[9px] text-muted-foreground">{isRTL ? 'عرض (م)' : 'Larg. (m)'}</label>
                            <Input type="number" step="0.1" min="0" value={se.width_m}
                              onChange={(e) => { const w = parseFloat(e.target.value) || 0; setSurfaceEstimates(prev => prev.map((s, i) => i === idx ? { ...s, width_m: w, area_m2: Math.round(w * s.height_m * 10) / 10 } : s)); }}
                              className="h-7 text-xs" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[9px] text-muted-foreground">{isRTL ? 'ارتفاع (م)' : 'Haut. (m)'}</label>
                            <Input type="number" step="0.1" min="0" value={se.height_m}
                              onChange={(e) => { const h = parseFloat(e.target.value) || 0; setSurfaceEstimates(prev => prev.map((s, i) => i === idx ? { ...s, height_m: h, area_m2: Math.round(s.width_m * h * 10) / 10 } : s)); }}
                              className="h-7 text-xs" />
                          </div>
                          <div className="flex-1">
                            <label className="text-[9px] text-muted-foreground text-muted-foreground/60">{isRTL ? 'تقدير IA' : 'Estimation IA'}</label>
                            <div className="h-7 flex items-center px-2 bg-muted rounded-md text-[10px] text-muted-foreground line-through">
                              {Math.round(se.width_m * se.height_m * 10) / 10} m²
                            </div>
                          </div>
                        </div>
                        <div className={cn("pt-1", isRTL && "text-right")}>
                          <label className={cn("text-[10px] font-bold text-primary", isRTL && "font-cairo")}>
                            ✏️ {isRTL ? 'المساحة الفعلية (قابلة للتعديل)' : 'Surface réelle (modifiable)'}
                          </label>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Input type="number" step="0.1" min="0" value={se.area_m2}
                              onChange={(e) => { const area = parseFloat(e.target.value) || 0; setSurfaceEstimates(prev => prev.map((s, i) => i === idx ? { ...s, area_m2: area } : s)); }}
                              className="h-8 text-sm font-bold flex-1 border-primary/40" />
                            <span className="text-xs font-bold text-foreground shrink-0">m²</span>
                          </div>
                        </div>
                        {se.confidence && (
                          <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full",
                              se.confidence === 'high' ? 'bg-green-500' : se.confidence === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                            )} />
                            <span className="text-[9px] text-muted-foreground">
                              {se.confidence === 'high' ? (isRTL ? 'دقة عالية' : 'Précision élevée') : se.confidence === 'medium' ? (isRTL ? 'دقة متوسطة' : 'Précision moyenne') : (isRTL ? 'دقة منخفضة' : 'Précision faible')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    <p className={cn("text-[10px] text-muted-foreground text-center font-bold", isRTL && "font-cairo")}>
                      📏 {isRTL ? `المساحة الإجمالية الفعلية: ${surfaceEstimates.reduce((s, e) => s + e.area_m2, 0).toFixed(1)} م²` : `Surface réelle totale: ${surfaceEstimates.reduce((s, e) => s + e.area_m2, 0).toFixed(1)} m²`}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Preferences */}
              <Card className="p-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>{isRTL ? 'جودة المواد' : 'Qualité'}</label>
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
                    <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>{isRTL ? 'خصم %' : 'Remise %'}</label>
                    <Input type="number" min={0} max={50} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>{isRTL ? 'ربح %' : 'Marge %'}</label>
                    <Input type="number" min={0} max={100} value={profitMarginPercent} onChange={e => setProfitMarginPercent(Number(e.target.value))} className="h-8 text-xs" />
                  </div>
                </div>
              </Card>

              {/* Chat messages */}
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start'))}>
                  {msg.role === 'assistant' && !isRTL && (
                    <div className="shrink-0 mr-2 mt-1">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </div>
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card text-card-foreground border border-border/60 rounded-bl-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} isRTL={isRTL} />
                    ) : (
                      <p className={cn("leading-relaxed", isRTL && "font-cairo text-right")} dir={isRTL ? 'rtl' : 'ltr'}>{msg.content}</p>
                    )}
                    <p className={cn("text-[9px] mt-1.5 opacity-50", msg.role === 'user' ? 'text-right' : 'text-left')}>
                      {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === 'assistant' && isRTL && (
                    <div className="shrink-0 ml-2 mt-1">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isChatLoading && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                <div className={cn("flex items-center gap-2", isRTL ? 'justify-end flex-row-reverse' : 'justify-start')}>
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    </div>
                  </div>
                </div>
              )}
              {/* Green كمل button — appears after analysis data is available */}
              {analysisData && !isGenerating && (
                <div className="py-4">
                  <button
                    onClick={() => {
                      // Extract items from analysisData for material choice screen
                      const suggested = Array.isArray(analysisData?.suggestedItems) ? analysisData.suggestedItems : [];
                      const preItems: LineItem[] = suggested.map((item: any) => {
                        const parsedQuantity = Number(item.quantity);
                        const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;
                        const aiUnit = typeof item.unit === 'string' && item.unit.trim() ? item.unit.trim() : 'Ens';
                        return {
                          id: generateId(),
                          designation_fr: item.designation_fr || '',
                          designation_ar: item.designation_ar || '',
                          quantity,
                          unit: aiUnit,
                          unitPrice: 0,
                          total: 0,
                          category: item.category,
                          withMaterial: true, // default: material on artisan
                          isAiEstimate: false,
                        };
                      });
                      setLineItems(preItems);
                      setStep('material_choice');
                    }}
                    disabled={isGenerating}
                    className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-black font-bold text-2xl font-cairo shadow-lg flex items-center justify-center gap-3"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-7 w-7" />
                    )}
                    كمل
                  </button>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Bottom bar — input + generate */}
          <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-3 pt-2 pb-3 safe-area-pb">
            <div className="max-w-2xl mx-auto space-y-2">
              <div className={cn("flex gap-2 items-end", isRTL && "flex-row-reverse")}>
                <Textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={isRTL ? '💬 اكتب سؤالك أو تعديلك هنا...' : '💬 Posez votre question ou ajustement...'}
                  className={cn("min-h-[44px] max-h-[100px] resize-none text-sm bg-muted/50 border-border/60 rounded-2xl", isRTL && "text-right font-cairo")}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                />
                <Button size="icon" onClick={handleChatSend} disabled={!chatInput.trim() || isChatLoading} className="shrink-0 h-11 w-11 rounded-full">
                  {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {/* Generate button removed — replaced by green كمل button in messages area */}
            </div>
          </div>
        </>
      )}

      {/* Step: Material Choice — WhatsApp style */}
      {step === 'material_choice' && (
        <>
          {/* Header */}
          <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur-sm px-3 py-2 safe-area-pt">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => setStep('chat')}>
                {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
              </Button>
              <div className={cn("flex items-center gap-2 flex-1 min-w-0", isRTL && "flex-row-reverse")}>
                <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-emerald-500" />
                </div>
                <div className={cn("min-w-0", isRTL && "text-right")}>
                  <p className={cn("text-sm font-bold text-foreground truncate", isRTL && "font-cairo")}>
                    تحليل
                  </p>
                  <p className="text-[10px] text-muted-foreground font-cairo">
                    {`${lineItems.length} بند`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable items list */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="max-w-2xl mx-auto space-y-6">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm">
                  {/* Item number + quantity/unit */}
                  <div className="flex items-center justify-between" dir="rtl">
                    <Badge variant="secondary" className="text-sm font-bold font-cairo px-3 py-1">
                      {idx + 1}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-cairo">
                      <span className="font-bold text-foreground">{item.quantity}</span>
                      <span>-</span>
                      <span className="font-bold text-foreground">{item.unit}</span>
                    </div>
                  </div>

                  {/* === Option A: Main d'œuvre uniquement (Green) === */}
                  <div className={cn(
                    "rounded-xl border-2 p-3 space-y-2 transition-all",
                    item.withMaterial === false
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border bg-muted/30"
                  )}>
                    <p className="text-sm font-bold text-foreground leading-relaxed" dir="ltr" lang="fr">
                      Main d'œuvre uniquement : {item.designation_fr || 'Désignation'}
                    </p>
                    <p className="text-sm text-muted-foreground font-cairo leading-relaxed" dir="rtl">
                      مصنعية فقط : {item.designation_ar || 'الوصف بالعامية'}
                    </p>
                    <button
                      onClick={() => updateItem(item.id, 'withMaterial', false)}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold font-cairo text-base transition-all",
                        item.withMaterial === false
                          ? "bg-emerald-500 text-white shadow-md"
                          : "bg-emerald-500/80 text-white hover:bg-emerald-500"
                      )}
                    >
                      {item.withMaterial === false ? '✅ اختار' : 'اختار'}
                    </button>
                  </div>

                  {/* === Option B: Fourniture et pose (Blue) === */}
                  <div className={cn(
                    "rounded-xl border-2 p-3 space-y-2 transition-all",
                    item.withMaterial === true
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border bg-muted/30"
                  )}>
                    <p className="text-sm font-bold text-foreground leading-relaxed" dir="ltr" lang="fr">
                      Fourniture et pose : {item.designation_fr || 'Désignation'}
                    </p>
                    <p className="text-sm text-muted-foreground font-cairo leading-relaxed" dir="rtl">
                      توريد وتركيب : {item.designation_ar || 'الوصف بالعامية'}
                    </p>
                    <button
                      onClick={() => updateItem(item.id, 'withMaterial', true)}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold font-cairo text-base transition-all",
                        item.withMaterial === true
                          ? "bg-blue-500 text-white shadow-md"
                          : "bg-blue-500/80 text-white hover:bg-blue-500"
                      )}
                    >
                      {item.withMaterial === true ? '✅ اختار' : 'اختار'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur-sm px-3 pt-3 pb-4 safe-area-pb">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={handleGenerateItems}
                disabled={isGenerating}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] transition-all text-white font-bold text-xl font-cairo shadow-lg flex items-center justify-center gap-3"
              >
                {isGenerating ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Sparkles className="h-6 w-6" />
                )}
                تعالى نعمل الدوفي
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 4: Review & Edit */}
      {step === 'review' && (
        <>
          {/* Review Header — WhatsApp style */}
          <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur-sm px-3 py-2 safe-area-pt">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => setStep('material_choice')}>
                {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
              </Button>
              <div className={cn("flex items-center gap-2 flex-1 min-w-0", isRTL && "flex-row-reverse")}>
                <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className={cn("min-w-0", isRTL && "text-right")}>
                  <p className={cn("text-sm font-bold text-foreground truncate", isRTL && "font-cairo")}>
                    {isRTL ? '📋 مراجعة وتعديل البنود' : '📋 Revue & Modification'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isRTL ? `${lineItems.length} بند` : `${lineItems.length} lignes`}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addItem} className="shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                {isRTL ? 'أضف' : 'Ajouter'}
              </Button>
            </div>
          </div>

          {/* Review content — scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="max-w-2xl mx-auto space-y-4">

          {/* Shubbaik Lubbaik — AI Price Fetch Button */}
          <Button
            onClick={handleFetchAIPrices}
            disabled={isFetchingPrices}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-base py-5 rounded-xl shadow-lg"
          >
            {isFetchingPrices ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-5 w-5 mr-2" />
            )}
             <span className={cn(isRTL && "font-cairo")}>
              {isFetchingPrices
                ? (isRTL ? '⏳ جاري جلب الأسعار...' : '⏳ Chargement des prix...')
                : (isRTL ? '🪄 شبيك لبيك — جيب كل الأسعار' : '🪄 Shubbaik Lubbaik — Tous les prix')
              }
            </span>
          </Button>
          <p className={cn("text-[10px] text-muted-foreground text-center", isRTL && "font-cairo")}>
            {isRTL
              ? '🏗️ شبيك لبيك هيجيب الأسعار من السوق الفرنسي'
              : '🏗️ Shubbaik Lubbaik récupère les prix du marché français'}
          </p>

          <div className="space-y-3">
            {lineItems.map((item, idx) => {
              const rawArabic = typeof item.designation_ar === 'string' ? item.designation_ar.trim() : '';
              const normalizedFrench = (item.designation_fr || '').trim().toLowerCase();
              const hasArabicPlaceholder = !rawArabic || ['الوصف بالعامية', 'وصف بالعامية', 'ترجمة بالعامية المصرية'].includes(rawArabic);
              const shouldResolveArabic = hasArabicPlaceholder && !!normalizedFrench;
              const suggestedArabic = shouldResolveArabic && Array.isArray(analysisData?.suggestedItems)
                ? (() => {
                    const match = analysisData.suggestedItems.find((candidate: any) => {
                      const candidateFrench = typeof candidate?.designation_fr === 'string'
                        ? candidate.designation_fr.trim().toLowerCase()
                        : '';
                      return candidateFrench && (
                        candidateFrench === normalizedFrench ||
                        candidateFrench.includes(normalizedFrench) ||
                        normalizedFrench.includes(candidateFrench)
                      );
                    });
                    return typeof match?.designation_ar === 'string' ? match.designation_ar.trim() : '';
                  })()
                : '';
              const workPlanArabicSteps = shouldResolveArabic && typeof analysisData?.workPlan_ar === 'string'
                ? analysisData.workPlan_ar
                    .replace(/\r/g, '\n')
                    .replace(/[•●▪◦]/g, '\n')
                    .replace(/\s*(?:→|->|=>)\s*/g, '\n')
                    .replace(/(?:^|\n)\s*\d+\s*[\).:-]\s*/g, '\n')
                    .replace(/(?:^|\n)\s*[-–—]\s*/g, '\n')
                    .split(/\n+/)
                    .map((step: string) => step.trim())
                    .filter(Boolean)
                : [];
              const resolvedArabic = rawArabic || suggestedArabic || workPlanArabicSteps[idx] || '';

              return (
              <Card key={item.id} className="p-3">
                <div className="space-y-2">
                  <div className={cn("flex items-start gap-2", isRTL && "flex-row-reverse")}>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{idx + 1}</Badge>
                    <div className="flex-1 space-y-1">
                      {/* Bilingual display: Bold French + Italic Arabic */}
                      {editingDesignation !== item.id ? (
                        <button
                          type="button"
                          onClick={() => setEditingDesignation(item.id)}
                          className="w-full text-left p-2 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-colors min-h-[48px]"
                        >
                          <p className="text-xs font-bold text-foreground leading-tight" dir="ltr" lang="fr">
                            {item.withMaterial === true
                              ? `Fourniture et pose : ${item.designation_fr || ''}`
                              : item.withMaterial === false
                                ? `Main d'œuvre uniquement : ${item.designation_fr || ''}`
                                : (item.designation_fr || <span className="text-muted-foreground italic">Désignation FR</span>)
                            }
                          </p>
                          <p className="text-[11px] text-muted-foreground italic mt-0.5 font-cairo leading-tight" dir="rtl">
                            {item.withMaterial === true
                              ? `توريد وتركيب : ${resolvedArabic || ''}`
                              : item.withMaterial === false
                                ? `مصنعية فقط : ${resolvedArabic || ''}`
                                : (resolvedArabic || <span className="text-muted-foreground/50">الوصف بالعامية</span>)
                            }
                          </p>
                        </button>
                      ) : (
                        <div className="space-y-1 p-1 rounded-lg border border-primary/30 bg-muted/20">
                          <Input
                            value={item.designation_fr}
                            onChange={e => onCodeChange(item.id, e.target.value)}
                            placeholder="Désignation FR"
                            className="text-xs h-auto min-h-[32px] py-1.5 font-bold"
                            dir="ltr"
                            lang="fr"
                            autoFocus
                            onBlur={() => setTimeout(() => setEditingDesignation(null), 200)}
                          />
                          <Input
                            value={resolvedArabic}
                            onChange={e => updateItem(item.id, 'designation_ar', e.target.value)}
                            placeholder="الوصف بالعامية"
                            className={cn("text-xs h-auto min-h-[32px] py-1.5 italic", isRTL && "text-right font-cairo")}
                            dir="rtl"
                          />
                        </div>
                      )}
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
                          <SelectItem value="U">U</SelectItem>
                          <SelectItem value="u">u</SelectItem>
                          <SelectItem value="h">h</SelectItem>
                          <SelectItem value="Ens">Ens</SelectItem>
                          <SelectItem value="j">j</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground flex items-center gap-1">
                        {isRTL ? 'سعر' : 'P.U.'}
                        <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                      </label>
                      {fetchingRowIds.has(item.id) ? (
                        <div className="h-7 flex items-center justify-center bg-muted rounded-md">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        </div>
                      ) : (
                        <Input type="number" min={0} step={0.01} value={item.unitPrice > 0 ? item.unitPrice : ''} placeholder={isRTL ? 'سعر؟' : 'prix?'} onChange={e => {
                          updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0);
                          // Clear AI estimate flag when manually edited
                          if (item.isAiEstimate) {
                            setLineItems(prev => prev.map(i => i.id === item.id ? { ...i, isAiEstimate: false } : i));
                          }
                        }} className={cn("text-xs h-7", item.isAiEstimate && "border-amber-400/50 bg-amber-50/30")} />
                      )}
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground flex items-center gap-1">
                        Total
                        <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                      </label>
                      <div className="h-7 flex items-center text-xs font-bold text-primary">
                        {fetchingRowIds.has(item.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : item.unitPrice > 0 ? (
                          <span className="flex items-center gap-0.5">
                            {item.isAiEstimate && <span className="text-amber-500 text-[9px]">~</span>}
                            {formatCurrency(item.total)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Per-row Shubbaik Lubbaik button */}
                  <button
                    onClick={() => {
                      if (item.unitPrice > 0 || fetchingRowIds.has(item.id)) return;
                      handleFetchSingleRowPrice(item.id);
                    }}
                    disabled={fetchingRowIds.has(item.id)}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2 mt-1.5 rounded-lg text-xs font-bold font-cairo transition-all border",
                      item.unitPrice > 0
                        ? "bg-muted/50 text-muted-foreground border-border"
                        : "bg-primary/10 hover:bg-primary/20 text-primary border-primary/20",
                      "disabled:opacity-50"
                    )}
                  >
                    {fetchingRowIds.has(item.id) ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {isRTL
                      ? item.unitPrice > 0
                        ? '✨ شبيك لبيك — ظاهر تحت البند'
                        : '✨ شبيك لبيك — جيب السعر'
                      : item.unitPrice > 0
                        ? '✨ Shubbaik Lubbaik — visible sous la ligne'
                        : '✨ Shubbaik Lubbaik — Prix'}
                  </button>
                  {/* Material choice indicator + Edit button */}
                  <div className={cn("flex items-center gap-2 pt-1 border-t border-border/30 mt-2", isRTL && "flex-row-reverse")}>
                    <button
                      onClick={() => {
                        // Go back to material_choice step to edit
                        setStep('material_choice');
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white border-0 transition-colors font-cairo"
                    >
                      <Edit3 className="h-4 w-4" />
                      تعديل
                    </button>
                  </div>
                </div>
              </Card>
              );
            })}
          </div>

          {/* Equipment Suggestions */}
          <EquipmentSuggestions
            lineItems={lineItems}
            isRTL={isRTL}
            onAccept={(suggestion) => {
              setLineItems(prev => [...prev, {
                id: generateId(),
                ...suggestion,
              }]);
            }}
          />

          {/* Pricing Hierarchy Note */}
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30", isRTL && "flex-row-reverse")}>
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <p className={cn("text-xs text-primary font-bold", isRTL && "font-cairo text-right")}>
              {isRTL
                ? '✨ الأسعار مقدرة من شبيك لبيك (السوق الفرنسي)'
                : '✨ Prix estimés par Shubbaik Lubbaik (marché français)'}
            </p>
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
                {isRTL ? 'رجوع للتحليل' : 'Retour à l\'analyse'}
              </span>
            </Button>
            <Button variant="outline" className="w-full" onClick={handleResetAnalysis}>
              <RotateCcw className="h-4 w-4 mr-2" />
              <span className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'إعادة التحليل من الأول' : 'Reset Analysis'}
              </span>
            </Button>
          </div>
            </div>
          </div>
        </>
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
      <SecurityBadge />
    </div>
  );
};

export default SmartDevisPage;
