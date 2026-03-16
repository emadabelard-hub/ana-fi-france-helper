// SmartDevisPage - v3.2
import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { type PriceCatalogItem, DEFAULT_CATALOG } from '@/hooks/useArtisanPricing';
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
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

type InputType = 'photo' | 'blueprint' | 'document' | null;
type Step = 'ai_intro' | 'select_input' | 'photo_guide' | 'upload' | 'chat' | 'review';

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

interface MaterialScopeSelectorProps {
  compact?: boolean;
  isRTL: boolean;
  materialScope: 'fourniture_et_pose' | 'main_oeuvre_seule' | 'partiel' | null;
  setMaterialScope: (v: 'fourniture_et_pose' | 'main_oeuvre_seule' | 'partiel') => void;
}

const MaterialScopeSelector = forwardRef<HTMLDivElement, MaterialScopeSelectorProps>(
  ({ compact = false, isRTL, materialScope, setMaterialScope }, ref) => (
    <div ref={ref} className={cn("space-y-2 rounded-xl border border-border/50", compact ? "bg-card p-3" : "bg-muted/30 p-3")}>
      <label className={cn("text-sm font-bold flex items-center gap-1.5", isRTL && "flex-row-reverse font-cairo")}>
        🔧 {isRTL ? 'اختار طريقة التسعير: مواد + مصنعية، مصنعية بس، ولا جزئي؟' : 'Matériaux inclus, Main d\'œuvre uniquement, ou Partiel ?'}
      </label>
      <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-2", isRTL && "sm:[direction:rtl]")}>
        <button
          onClick={() => setMaterialScope('fourniture_et_pose')}
          className={cn(
            "text-xs font-bold py-3 px-3 rounded-lg border transition-colors",
            materialScope === 'fourniture_et_pose'
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border hover:bg-muted"
          )}
        >
          {isRTL ? '🏗️ فورنيتير + مصنعية' : '🏗️ Matériaux inclus'}
        </button>
        <button
          onClick={() => setMaterialScope('main_oeuvre_seule')}
          className={cn(
            "text-xs font-bold py-3 px-3 rounded-lg border transition-colors",
            materialScope === 'main_oeuvre_seule'
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border hover:bg-muted"
          )}
        >
          {isRTL ? '🔧 مصنعية بس' : '🔧 Main d\'œuvre'}
        </button>
        <button
          onClick={() => setMaterialScope('partiel')}
          className={cn(
            "text-xs font-bold py-3 px-3 rounded-lg border transition-colors",
            materialScope === 'partiel'
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border hover:bg-muted"
          )}
        >
          {isRTL ? '⚖️ جزئي (لكل بند)' : '⚖️ Partiel (ligne par ligne)'}
        </button>
      </div>
    </div>
  )
);

MaterialScopeSelector.displayName = 'MaterialScopeSelector';

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
  const scopeSelectorRef = useRef<HTMLDivElement>(null);

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
  const [showAuth, setShowAuth] = useState(false);
  const [preferencesCollected, setPreferencesCollected] = useState(false);
  const [helpGuide, setHelpGuide] = useState<'photo' | 'blueprint' | 'document' | null>(null);
  const [surfaceEstimates, setSurfaceEstimates] = useState<SurfaceEstimate[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [materialScope, setMaterialScope] = useState<'fourniture_et_pose' | 'main_oeuvre_seule' | 'partiel' | null>(null);
  const [catalogByCode, setCatalogByCode] = useState<Record<string, PriceCatalogItem>>({});
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
    setMaterialScope(null);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // REMOVED LABOR_ONLY_FACTOR - prices now come strictly from catalog labor_price

  // Build keyword→catalog mapping from the complete price catalog
  const CATALOG_KEYWORDS: Record<string, { keywords: string[]; catalogCode: string }> = {
    // Maçonnerie
    MAC01: { keywords: ['dalle beton', 'dalle béton', 'dalle armee', 'dalle armée'], catalogCode: 'MAC01' },
    MAC02: { keywords: ['chape beton', 'chape béton', 'chape ciment'], catalogCode: 'MAC02' },
    MAC03: { keywords: ['mur parpaing', 'parpaing'], catalogCode: 'MAC03' },
    MAC04: { keywords: ['fondation', 'fondation beton', 'fondation béton'], catalogCode: 'MAC04' },
    MAC05: { keywords: ['terrasse beton', 'terrasse béton'], catalogCode: 'MAC05' },
    MAC06: { keywords: ['escalier beton', 'escalier béton'], catalogCode: 'MAC06' },
    MC004: { keywords: ['mur porteur', 'ouverture mur porteur', 'ouverture mur'], catalogCode: 'MC004' },
    MAC08: { keywords: ['demolition mur', 'démolition mur', 'demolition', 'démolition', 'ديمونتاج'], catalogCode: 'MAC08' },
    MAC09: { keywords: ['chape liquide'], catalogCode: 'MAC09' },
    MAC10: { keywords: ['enduit facade', 'enduit façade', 'crepi', 'crépi'], catalogCode: 'MAC10' },
    // Peinture
    PEI01: { keywords: ['preparation murs', 'préparation murs', 'enduit', 'أندوي', 'preparation', 'préparation', 'sous-couche', 'سوكوش'], catalogCode: 'PEI01' },
    PEI02: { keywords: ['peinture murs', 'peinture mur', 'peinture blanche', 'peinture mate', 'بنتيرة', 'بانتيرة', 'peinture'], catalogCode: 'PEI02' },
    PEI03: { keywords: ['preparation plafond', 'préparation plafond'], catalogCode: 'PEI03' },
    PEI04: { keywords: ['peinture plafond', 'بلافون'], catalogCode: 'PEI04' },
    PEI05: { keywords: ['peinture facade', 'peinture façade', 'peinture exterieure'], catalogCode: 'PEI05' },
    PEI06: { keywords: ['peinture boiserie', 'peinture bois', 'peinture porte'], catalogCode: 'PEI06' },
    PEI07: { keywords: ['enduit rebouchage', 'rebouchage'], catalogCode: 'PEI07' },
    PEI08: { keywords: ['enduit lissage', 'lissage'], catalogCode: 'PEI08' },
    PEI09: { keywords: ['poncage murs', 'ponçage murs'], catalogCode: 'PEI09' },
    // Placo
    PLA01: { keywords: ['placo', 'ba13', 'بلاكو'], catalogCode: 'PLA01' },
    PLA02: { keywords: ['bande placo', 'bandes placo', 'bande a joint', 'bande joint'], catalogCode: 'PLA02' },
    PLA03: { keywords: ['faux plafond', 'faux-plafond', 'فو بلافون', 'سقف معلق'], catalogCode: 'PLA03' },
    // Placo / Isolation (PLA04-PLA07 replace ISO codes)
    PLA04: { keywords: ['isolation combles'], catalogCode: 'PLA04' },
    PLA05: { keywords: ['isolation murs', 'isolation interieur'], catalogCode: 'PLA05' },
    PLA06: { keywords: ['isolation toiture'], catalogCode: 'PLA06' },
    PLA07: { keywords: ['isolation plancher'], catalogCode: 'PLA07' },
    // Carrelage
    CAR01: { keywords: ['ragreage', 'ragréage', 'راغرياج'], catalogCode: 'CAR01' },
    CR001: { keywords: ['carrelage sol', 'pose carrelage sol', 'carrelage', 'كارلاج'], catalogCode: 'CR001' },
    CAR03: { keywords: ['faience', 'faïence', 'فايونس', 'faience murale'], catalogCode: 'CAR03' },
    CAR04: { keywords: ['depose carrelage', 'dépose carrelage'], catalogCode: 'CAR04' },
    CAR05: { keywords: ['carrelage terrasse', 'pose carrelage terrasse'], catalogCode: 'CAR05' },
    // Parquet
    PAR01: { keywords: ['parquet flottant'], catalogCode: 'PAR01' },
    PAR02: { keywords: ['parquet colle', 'parquet collé', 'parquet', 'باركيه'], catalogCode: 'PAR02' },
    PAR03: { keywords: ['plinthe', 'plinthes', 'pose plinthe', 'بلانت'], catalogCode: 'PAR03' },
    PAR04: { keywords: ['poncage parquet', 'ponçage parquet', 'poncage', 'ponçage', 'بونساج'], catalogCode: 'PAR04' },
    PAR05: { keywords: ['sol vinyle', 'sol pvc', 'lino', 'vinyle'], catalogCode: 'PAR05' },
    // Électricité
    ELE01: { keywords: ['prise', 'prise electrique', 'prise murale', 'بريز'], catalogCode: 'ELE01' },
    ELE02: { keywords: ['interrupteur', 'انتيريبتور'], catalogCode: 'ELE02' },
    ELE03: { keywords: ['tableau electrique', 'tableau électrique', 'كهرباء'], catalogCode: 'ELE03' },
    ELE04: { keywords: ['luminaire', 'eclairage', 'éclairage', 'plafonnier', 'point lumineux'], catalogCode: 'ELE04' },
    ELE05: { keywords: ['spot led', 'spot encastre', 'spot encastré'], catalogCode: 'ELE05' },
    ELE06: { keywords: ['tirage cable', 'tirage câble', 'cable electrique', 'câble électrique'], catalogCode: 'ELE06' },
    // Plomberie
    PB001: { keywords: ['wc', 'toilette', 'toilettes', 'installation wc'], catalogCode: 'PB001' },
    PLM02: { keywords: ['lavabo', 'évier', 'evier'], catalogCode: 'PLM02' },
    PLM03: { keywords: ['meuble vasque', 'vasque'], catalogCode: 'PLM03' },
    PLM04: { keywords: ['douche', 'baignoire', 'سباكة'], catalogCode: 'PLM04' },
    PLM05: { keywords: ['fuite', 'reparation fuite', 'réparation fuite'], catalogCode: 'PLM05' },
    PLM06: { keywords: ['chauffe-eau', 'chauffe eau', 'installation chauffe-eau'], catalogCode: 'PLM06' },
    // Menuiserie
    MEN01: { keywords: ['porte interieure', 'porte intérieure', 'pose porte', 'باب'], catalogCode: 'MEN01' },
    MEN02: { keywords: ['fenetre pvc', 'fenêtre pvc', 'fenetre', 'fenêtre', 'شباك'], catalogCode: 'MEN02' },
    MEN03: { keywords: ['placard', 'placard sur mesure', 'dressing'], catalogCode: 'MEN03' },
    MEN04: { keywords: ['escalier bois'], catalogCode: 'MEN04' },
    MEN05: { keywords: ["porte d'entree", "porte d'entrée", 'porte entree'], catalogCode: 'MEN05' },
    MEN06: { keywords: ['baie vitree', 'baie vitrée'], catalogCode: 'MEN06' },
    MEN07: { keywords: ['volet roulant', 'volet'], catalogCode: 'MEN07' },
    MEN08: { keywords: ['portail', 'portail aluminium'], catalogCode: 'MEN08' },
    // Toiture
    TOI01: { keywords: ['pose tuiles', 'tuiles'], catalogCode: 'TOI01' },
    TOI02: { keywords: ['reparation toiture', 'réparation toiture'], catalogCode: 'TOI02' },
    TOI03: { keywords: ['nettoyage toiture'], catalogCode: 'TOI03' },
    TOI04: { keywords: ['demoussage', 'démoussage'], catalogCode: 'TOI04' },
    TOI05: { keywords: ['gouttiere', 'gouttière', 'pose gouttiere'], catalogCode: 'TOI05' },
    // Étanchéité
    ETA01: { keywords: ['etancheite toiture', 'étanchéité toiture', 'etancheite terrasse', 'étanchéité terrasse'], catalogCode: 'ETA01' },
    ETA02: { keywords: ['etancheite balcon', 'étanchéité balcon'], catalogCode: 'ETA02' },
    ETA03: { keywords: ['etancheite salle de bain', 'étanchéité salle de bain', 'etancheite sdb'], catalogCode: 'ETA03' },
    // Extérieur
    EXT01: { keywords: ['cloture grillage', 'clôture grillage'], catalogCode: 'EXT01' },
    EXT02: { keywords: ['cloture panneau', 'clôture panneau'], catalogCode: 'EXT02' },
    EXT03: { keywords: ['terrasse bois'], catalogCode: 'EXT03' },
    EXT04: { keywords: ['dalle terrasse'], catalogCode: 'EXT04' },
    // Chauffage / Clim
    CH01: { keywords: ['radiateur'], catalogCode: 'CH01' },
    CH02: { keywords: ['chauffe eau', 'chauffe-eau', 'ballon eau chaude', 'سخان'], catalogCode: 'CH02' },
    CH03: { keywords: ['pompe a chaleur', 'pompe à chaleur', 'pac'], catalogCode: 'CH03' },
    CH04: { keywords: ['climatisation', 'clim', 'split', 'تكييف'], catalogCode: 'CH04' },
    // Ventilation
    VEN01: { keywords: ['vmc simple', 'vmc simple flux'], catalogCode: 'VEN01' },
    VEN02: { keywords: ['vmc double', 'vmc double flux'], catalogCode: 'VEN02' },
    // Piscine
    PIS01: { keywords: ['vidange piscine'], catalogCode: 'PIS01' },
    PIS02: { keywords: ['nettoyage bassin', 'nettoyage piscine'], catalogCode: 'PIS02' },
    PIS03: { keywords: ['sablage piscine'], catalogCode: 'PIS03' },
    PIS04: { keywords: ['resine polyester', 'résine polyester', 'resine piscine'], catalogCode: 'PIS04' },
    PIS05: { keywords: ['gelcoat'], catalogCode: 'PIS05' },
    PIS06: { keywords: ['liner piscine', 'pose liner'], catalogCode: 'PIS06' },
    PIS07: { keywords: ['membrane armee', 'membrane armée'], catalogCode: 'PIS07' },
    PIS08: { keywords: ['fissure piscine', 'reparation fissure piscine'], catalogCode: 'PIS08' },
    PIS09: { keywords: ['pompe piscine'], catalogCode: 'PIS09' },
    PIS10: { keywords: ['filtration piscine'], catalogCode: 'PIS10' },
    PIS11: { keywords: ['margelle', 'margelles'], catalogCode: 'PIS11' },
    PIS12: { keywords: ['carrelage piscine'], catalogCode: 'PIS12' },
    PIS13: { keywords: ['skimmer'], catalogCode: 'PIS13' },
    PIS14: { keywords: ['bonde fond', 'bonde de fond'], catalogCode: 'PIS14' },
    PIS15: { keywords: ['projecteur piscine'], catalogCode: 'PIS15' },
    // Location
    LOC01: { keywords: ['echafaudage', 'échafaudage', 'location echafaudage'], catalogCode: 'LOC01' },
    LOC02: { keywords: ['sableuse', 'location sableuse'], catalogCode: 'LOC02' },
    LOC03: { keywords: ['betonniere', 'bétonnière'], catalogCode: 'LOC03' },
    LOC04: { keywords: ['mini pelle', 'minipelle'], catalogCode: 'LOC04' },
    LOC05: { keywords: ['benne gravats', 'benne'], catalogCode: 'LOC05' },
    // Frais chantier
    CHA01: { keywords: ['protection chantier'], catalogCode: 'CHA01' },
    CHA02: { keywords: ['nettoyage chantier', 'نيتواياج', 'nettoyage fin', 'nettoyage fin de chantier'], catalogCode: 'CHA02' },
    CHA03: { keywords: ['transport materiaux', 'transport matériaux'], catalogCode: 'CHA03' },
    CHA04: { keywords: ['evacuation gravats', 'évacuation gravats', 'frais de chantier', 'مصاريف الشانتي'], catalogCode: 'CHA04' },
    // Generic fallbacks (must be AFTER specific codes)
    GENERIC_NETTOYAGE: { keywords: ['nettoyage'], catalogCode: 'CHA02' },
    GENERIC_ISOLATION: { keywords: ['isolation', 'عزل'], catalogCode: 'PLA05' },
  };

  const parseCatalogItem = (row: any): PriceCatalogItem => ({
    code: row.code,
    category: row.category,
    subcategory: row.subcategory || '',
    description: row.description,
    unit: row.unit,
    material_price: Number(row.material_price),
    labor_price: Number(row.labor_price),
    equipment_price: Number(row.equipment_price || 0),
    total_price: Number(row.total_price),
  });

  // Build default catalog lookup once
  const defaultCatalogByCode: Record<string, PriceCatalogItem> = (() => {
    const map: Record<string, PriceCatalogItem> = {};
    DEFAULT_CATALOG.forEach(item => { map[item.code] = item; });
    return map;
  })();

  useEffect(() => {
    const loadCatalogFromDatabase = async () => {
      if (!user) {
        // No user → use default catalog as fallback
        setCatalogByCode(defaultCatalogByCode);
        return;
      }

      const { data, error } = await (supabase as any)
        .from('artisan_price_catalog')
        .select('code, category, subcategory, description, unit, material_price, labor_price, equipment_price, total_price')
        .eq('user_id', user.id)
        .order('code');

      if (error || !data || data.length === 0) {
        // No user catalog in DB → fallback to DEFAULT_CATALOG
        setCatalogByCode(defaultCatalogByCode);
        return;
      }

      const nextCatalog: Record<string, PriceCatalogItem> = {};
      data.forEach((row: any) => {
        const parsed = parseCatalogItem(row);
        nextCatalog[parsed.code] = parsed;
      });
      setCatalogByCode(nextCatalog);
    };

    loadCatalogFromDatabase();
  }, [user]);

  const normalizeText = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizeCatalogUnit = (unit: string): string => {
    if (unit === 'unit') return 'u';
    if (unit === 'm2') return 'm²';
    return unit || 'u';
  };

  const detectCatalogCodeFromDesignation = (designation: string): string | null => {
    const normalizedDesignation = normalizeText(designation || '');
    if (!normalizedDesignation) return null;

    const directCodeMatch = normalizedDesignation.match(/\b[a-z]{2,4}\d{2,3}\b/i);
    if (directCodeMatch?.[0]) {
      return directCodeMatch[0].toUpperCase();
    }

    const foundEntry = Object.values(CATALOG_KEYWORDS).find((entry) =>
      entry.keywords.some((keyword) => normalizedDesignation.includes(normalizeText(keyword)))
    );

    return foundEntry?.catalogCode ?? null;
  };

  const getCatalogPriceFromItem = (catalogItem: PriceCatalogItem, includeMaterials: boolean): number => {
    const rawPrice = includeMaterials ? catalogItem.total_price : catalogItem.labor_price;
    return Number(rawPrice);
  };

  const getCatalogUnitPriceByCode = useCallback((catalogCode: string | undefined, includeMaterials: boolean): number => {
    if (!catalogCode) return 0;
    const catalogItem = catalogByCode[catalogCode];
    if (!catalogItem) return 0;
    return getCatalogPriceFromItem(catalogItem, includeMaterials);
  }, [catalogByCode]);

  // Strip "Fourniture et pose" → "Pose" when material is excluded
  const stripFourniture = (fr: string, ar: string): { fr: string; ar: string } => {
    let cleanFr = fr
      .replace(/Fourniture\s+et\s+pose\s+d[e']/gi, "Pose d'")
      .replace(/Fourniture\s+et\s+pose\s+de\s+/gi, 'Pose de ')
      .replace(/Fourniture\s+et\s+pose/gi, 'Pose')
      .replace(/fourniture\s*,?\s*/gi, '')
      .replace(/Fourniture\s+de\s+/gi, '');
    let cleanAr = ar
      .replace(/فورنيتير\s*و\s*بوز/g, 'بوز')
      .replace(/فورنيتير\s*و\s*/g, '')
      .replace(/فورنيتير/g, '');
    return { fr: cleanFr.trim(), ar: cleanAr.trim() };
  };

  // Restore "Fourniture et pose" when toggling material back on
  const restoreFourniture = (fr: string, ar: string): { fr: string; ar: string } => {
    let cleanFr = fr;
    if (/^Pose\s+d[e']/i.test(fr) && !/Fourniture/i.test(fr)) {
      cleanFr = fr.replace(/^Pose\s+d[e']\s*/i, "Fourniture et pose de ");
    } else if (/^Pose\s+de\s+/i.test(fr) && !/Fourniture/i.test(fr)) {
      cleanFr = fr.replace(/^Pose\s+de\s+/i, 'Fourniture et pose de ');
    }
    let cleanAr = ar;
    if (/^بوز\s/.test(ar) && !/فورنيتير/.test(ar)) {
      cleanAr = 'فورنيتير و ' + ar;
    }
    return { fr: cleanFr, ar: cleanAr };
  };

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
    setMaterialScope(snapshot.materialScope ?? null);

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
    const { data, error } = await supabase.functions.invoke('smart-devis-analyzer', { body: payload });
    if (!error) return data;

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
    if (!materialScope) {
      toast({
        variant: 'destructive',
        title: isRTL ? '⚠️ اختيار إجباري' : '⚠️ Choix obligatoire',
        description: isRTL
          ? '👆 لازم تختار طريقة التسعير أولاً (فورنيتير + مصنعية، مصنعية بس، أو جزئي) قبل ما تبدأ التحليل!'
          : 'Veuillez d\'abord choisir le mode de tarification (Fourniture + Pose, Main d\'œuvre seule ou Partiel) avant de lancer l\'analyse !',
      });
      scopeSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scopeSelectorRef.current?.classList.add('ring-2', 'ring-[#d4af37]', 'ring-offset-2');
      setTimeout(() => {
        scopeSelectorRef.current?.classList.remove('ring-2', 'ring-[#d4af37]', 'ring-offset-2');
      }, 3000);
      return;
    }

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

      const data = await invokeAnalyzer(body);
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
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateItems = async () => {
    if (!materialScope) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'اختيار إجباري' : 'Choix obligatoire',
        description: isRTL
          ? 'لازم تختار: مواد + مصنعية، مصنعية فقط، أو جزئي قبل توليد الدوفي.'
          : 'Veuillez choisir "Matériaux inclus", "Main d\'œuvre uniquement" ou "Partiel" avant de générer le devis.',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        action: 'generate_items',
        analysisData: {
          ...analysisData,
          surfaceEstimates: surfaceEstimates.length > 0 ? surfaceEstimates : analysisData?.surfaceEstimates,
        },
        materialQuality,
        discountPercent,
        profitMarginPercent,
        materialScope,
      };

      const data = await invokeAnalyzer(payload);

      const rawItems = data.items || data.suggestedItems || [];

      // ===== STRICT LOCK: if explicit codes are present, we build strictly from codes =====
      const analysisBlob = JSON.stringify(payload.analysisData || {});
      const explicitCodesFromAnalysis = Array.from(
        new Set((analysisBlob.match(/\b[A-Z]{2,4}\d{2,3}\b/g) || []).map((c) => c.toUpperCase()))
      );

      // ===== DEDUPLICATION: Remove duplicate lines by normalized designation =====
      const seenDesignations = new Set<string>();
      const deduplicatedItems = rawItems.filter((item: any) => {
        const normalizedKey = normalizeText(item.designation_fr || '').replace(/\s+/g, ' ').trim();
        if (!normalizedKey) return true;
        if (seenDesignations.has(normalizedKey)) return false;
        seenDesignations.add(normalizedKey);
        return true;
      });

      const detectedCodes: string[] = Array.from(
        new Set(
          deduplicatedItems
            .map((item: any): string => {
              const explicitCode = typeof item.code === 'string' ? item.code.trim().toUpperCase() : '';
              return explicitCode || detectCatalogCodeFromDesignation(item.designation_fr || '') || '';
            })
            .filter((code: string) => code.length > 0)
        )
      );

      const codesToFetch = explicitCodesFromAnalysis.length > 0 ? explicitCodesFromAnalysis : detectedCodes;
      const catalogRows = await fetchCatalogByCodes(codesToFetch);

      const sourceItems = explicitCodesFromAnalysis.length > 0
        ? explicitCodesFromAnalysis.map((code) => ({ code, quantity: 1, unit: 'u', designation_fr: code, designation_ar: '' }))
        : deduplicatedItems;

      const items: LineItem[] = sourceItems.map((item: any) => {
        const quantity = Number(item.quantity || 1);
        const aiUnit = item.unit || 'u';
        const isPartiel = materialScope === 'partiel';
        const withMaterial = isPartiel ? false : materialScope !== 'main_oeuvre_seule';

        const explicitCode = typeof item.code === 'string' ? item.code.trim().toUpperCase() : '';
        const detectedCode = explicitCode || detectCatalogCodeFromDesignation(item.designation_fr || '') || '';
        const catalogItem = detectedCode ? (catalogRows[detectedCode] || catalogByCode[detectedCode]) : undefined;

        const unit = catalogItem ? normalizeCatalogUnit(catalogItem.unit) : aiUnit;
        const effectiveQuantity = unit === 'forfait' ? 1 : quantity;
        const fixedUnitPrice = catalogItem ? getCatalogPriceFromItem(catalogItem, withMaterial) : 0;

        const baseFr = catalogItem?.description || item.designation_fr || '';
        const baseAr = item.designation_ar || '';
        const { fr: finalFr, ar: finalAr } = !withMaterial
          ? stripFourniture(baseFr, baseAr)
          : { fr: baseFr, ar: baseAr };

        return {
          id: generateId(),
          designation_fr: finalFr,
          designation_ar: finalAr,
          quantity: effectiveQuantity,
          unit,
          unitPrice: fixedUnitPrice,
          total: effectiveQuantity * fixedUnitPrice,
          category: catalogItem?.category || item.category,
          catalogCode: catalogItem?.code || (detectedCode || undefined),
          withMaterial,
        };
      });

      // ===== STRICT LOCK: one code = one line. Drop uncoded lines when coded lines exist =====
      const hasCodedItems = items.some(item => !!item.catalogCode);
      const codeScopedItems = hasCodedItems ? items.filter(item => !!item.catalogCode) : items;

      const seenCatalogCodes = new Set<string>();
      const finalItems = codeScopedItems.filter(item => {
        if (!item.catalogCode) return true;
        if (seenCatalogCodes.has(item.catalogCode)) return false;
        seenCatalogCodes.add(item.catalogCode);
        return true;
      });

      setLineItems(finalItems);
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

  const fetchCatalogByCodes = useCallback(async (codes: string[]): Promise<Record<string, PriceCatalogItem>> => {
    if (codes.length === 0) return {};

    const uniqueCodes = Array.from(new Set(codes.map(code => code.trim().toUpperCase()).filter(Boolean)));
    if (uniqueCodes.length === 0) return {};

    // Try DB first if user is logged in
    if (user) {
      const { data, error } = await (supabase as any)
        .from('artisan_price_catalog')
        .select('code, category, subcategory, description, unit, material_price, labor_price, equipment_price, total_price')
        .eq('user_id', user.id)
        .in('code', uniqueCodes);

      if (!error && data && data.length > 0) {
        const mapped: Record<string, PriceCatalogItem> = {};
        data.forEach((row: any) => {
          const parsed = parseCatalogItem(row);
          mapped[parsed.code] = parsed;
        });
        setCatalogByCode(prev => ({ ...prev, ...mapped }));
        return mapped;
      }
    }

    // Fallback: resolve from DEFAULT_CATALOG
    const fallback: Record<string, PriceCatalogItem> = {};
    uniqueCodes.forEach(code => {
      if (defaultCatalogByCode[code]) {
        fallback[code] = defaultCatalogByCode[code];
      }
    });
    if (Object.keys(fallback).length > 0) {
      setCatalogByCode(prev => ({ ...prev, ...fallback }));
    }
    return fallback;
  }, [user, defaultCatalogByCode]);

  const fetchCatalogByCode = useCallback(async (code: string): Promise<PriceCatalogItem | null> => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return null;

    const rows = await fetchCatalogByCodes([normalizedCode]);
    return rows[normalizedCode] ?? null;
  }, [fetchCatalogByCodes]);

  const onCodeChange = useCallback(async (id: string, rawValue: string) => {
    updateItem(id, 'designation_fr', rawValue);

    const normalizedCode = rawValue.trim().toUpperCase();
    const isCode = /^[A-Z]{2,4}\d{2,3}$/.test(normalizedCode);
    if (!isCode) return;

    const catalogItem = await fetchCatalogByCode(normalizedCode);

    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      if (!catalogItem) {
        return {
          ...item,
          catalogCode: undefined,
          unitPrice: 0,
          total: 0,
        };
      }

      const normalizedUnit = normalizeCatalogUnit(catalogItem.unit);
      const includeMaterials = item.withMaterial ?? materialScope !== 'main_oeuvre_seule';
      const exactUnitPrice = getCatalogPriceFromItem(catalogItem, includeMaterials);
      const quantity = normalizedUnit === 'forfait' ? 1 : item.quantity;

      return {
        ...item,
        designation_fr: catalogItem.description,
        unit: normalizedUnit,
        quantity,
        unitPrice: exactUnitPrice,
        category: catalogItem.category,
        catalogCode: catalogItem.code,
        total: quantity * exactUnitPrice,
      };
    }));
  }, [fetchCatalogByCode, materialScope]);

  const removeItem = (id: string) => setLineItems(prev => prev.filter(i => i.id !== id));

  // Toggle withMaterial for a line item in partiel mode — recalculates price from DB catalog only
  const toggleItemMaterial = (id: string) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const newWithMaterial = !item.withMaterial;
      const detectedCode = item.catalogCode || detectCatalogCodeFromDesignation(item.designation_fr) || undefined;
      const catalogItem = detectedCode ? catalogByCode[detectedCode] : undefined;
      const newPrice = getCatalogUnitPriceByCode(detectedCode, newWithMaterial);
      const normalizedUnit = catalogItem ? normalizeCatalogUnit(catalogItem.unit) : item.unit;
      const quantity = normalizedUnit === 'forfait' ? 1 : item.quantity;

      const sourceFr = catalogItem?.description || item.designation_fr;
      const { fr, ar } = newWithMaterial
        ? restoreFourniture(sourceFr, item.designation_ar)
        : stripFourniture(sourceFr, item.designation_ar);

      return {
        ...item,
        designation_fr: fr,
        designation_ar: ar,
        unit: normalizedUnit,
        quantity,
        withMaterial: newWithMaterial,
        catalogCode: detectedCode,
        unitPrice: newPrice,
        total: quantity * newPrice,
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

  const grandTotal = lineItems.reduce((sum, i) => sum + i.total, 0);

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
        items: lineItems.map(item => ({
          ...item,
          id: generateId(),
          referenceUnitPrice: item.unitPrice,
          materialsIncluded: materialScope === 'partiel'
            ? (item.withMaterial ?? false)
            : materialScope !== 'main_oeuvre_seule',
        })),
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
    <div className="py-4 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
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

            {/* Material Scope Selector */}
            <MaterialScopeSelector ref={scopeSelectorRef} isRTL={isRTL} materialScope={materialScope} setMaterialScope={setMaterialScope} />

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
            <Card className="border-2 border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className={cn("text-sm flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
                  📐 {isRTL ? 'المساحات المقدرة (عدّل لو محتاج)' : 'Surfaces estimées (modifiables)'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {/* Warning: approximate estimation */}
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
                        <label className="text-[9px] text-muted-foreground text-muted-foreground/60">{isRTL ? 'تقدير IA' : 'Estimation IA'}</label>
                        <div className="h-7 flex items-center px-2 bg-muted rounded-md text-[10px] text-muted-foreground line-through">
                          {Math.round(se.width_m * se.height_m * 10) / 10} m²
                        </div>
                      </div>
                    </div>
                    {/* Editable "Surface réelle" field */}
                    <div className={cn("pt-1", isRTL && "text-right")}>
                      <label className={cn("text-[10px] font-bold text-primary", isRTL && "font-cairo")}>
                        ✏️ {isRTL ? 'المساحة الفعلية (قابلة للتعديل)' : 'Surface réelle (modifiable)'}
                      </label>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={se.area_m2}
                          onChange={(e) => {
                            const area = parseFloat(e.target.value) || 0;
                            setSurfaceEstimates(prev => prev.map((s, i) => i === idx ? { ...s, area_m2: area } : s));
                          }}
                          className="h-8 text-sm font-bold flex-1 border-primary/40"
                        />
                        <span className="text-xs font-bold text-foreground shrink-0">m²</span>
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
                <p className={cn("text-[10px] text-muted-foreground text-center font-bold", isRTL && "font-cairo")}>
                  📏 {isRTL ? `المساحة الإجمالية الفعلية: ${surfaceEstimates.reduce((s, e) => s + e.area_m2, 0).toFixed(1)} م²` : `Surface réelle totale: ${surfaceEstimates.reduce((s, e) => s + e.area_m2, 0).toFixed(1)} m²`}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Material Scope Selector */}
          <MaterialScopeSelector compact isRTL={isRTL} materialScope={materialScope} setMaterialScope={setMaterialScope} />

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

          {/* Dedicated Chat Thread — chronological (oldest top, newest bottom) */}
          <Card className="border border-border/60 overflow-hidden">
            <div className={cn("px-3 py-2 bg-muted/40 border-b border-border/40 flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className={cn("text-xs font-semibold text-muted-foreground", isRTL && "font-cairo")}>
                {isRTL ? `💬 سجل المحادثة (${chatMessages.length} رسالة)` : `💬 Historique (${chatMessages.length} messages)`}
              </span>
            </div>
            <ScrollArea className="h-[40vh] p-3">
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
          </Card>

          {/* Chat input — sticky at bottom, always visible */}
          <div className="sticky bottom-0 z-10 bg-background pt-2 pb-1">
            <Card className="p-3 border-2 border-primary/20 bg-primary/5 shadow-lg">
              <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
                <Textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={isRTL ? '💬 اكتب سؤالك أو تعديلك هنا...' : '💬 Posez votre question ou ajustement...'}
                  className={cn("min-h-[44px] max-h-[100px] resize-none text-sm bg-background", isRTL && "text-right font-cairo")}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                />
                <Button size="icon" onClick={handleChatSend} disabled={!chatInput.trim() || isChatLoading} className="shrink-0 h-11 w-11">
                  {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </Card>
          </div>

          {/* Analysis actions */}
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={handleResetAnalysis}>
              <RotateCcw className="h-4 w-4 mr-2" />
              <span className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'إعادة التحليل من الأول' : 'Reset Analysis'}
              </span>
            </Button>

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
                        onChange={e => onCodeChange(item.id, e.target.value)}
                        placeholder="Désignation FR"
                        className="text-xs h-auto min-h-[32px] py-1.5"
                        dir="ltr"
                        lang="fr"
                      />
                      <Input
                        value={item.designation_ar}
                        onChange={e => updateItem(item.id, 'designation_ar', e.target.value)}
                        placeholder="الوصف بالعربي"
                        className={cn("text-xs h-auto min-h-[32px] py-1.5", isRTL && "text-right font-cairo")}
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
                  {/* Fourniture toggle with price breakdown tooltip */}
                  <div className={cn("flex items-center gap-2 pt-1 border-t border-border/30 mt-2", isRTL && "flex-row-reverse")}>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleItemMaterial(item.id)}
                            className={cn(
                              "flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-md border transition-colors",
                              item.withMaterial
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            <Package className="h-4 w-4" />
                            {item.withMaterial
                              ? (isRTL ? '✅ فورنيتير (مواد) داخلة' : '✅ Fourniture incluse')
                              : (isRTL ? '❌ مصنعية بس' : '❌ Main d\'œuvre seule')
                            }
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs p-3 max-w-[220px]">
                          {(() => {
                            const detectedCode = item.catalogCode || detectCatalogCodeFromDesignation(item.designation_fr) || undefined;
                            const fullPrice = getCatalogUnitPriceByCode(detectedCode, true);
                            const laborPrice = getCatalogUnitPriceByCode(detectedCode, false);
                            const materialPrice = Math.round((fullPrice - laborPrice) * 100) / 100;
                            return (
                              <div className="space-y-1.5">
                                <p className="font-bold text-foreground">
                                  {isRTL ? 'تفصيل السعر' : 'Détail du prix'}
                                </p>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">{isRTL ? '🔧 مصنعية' : '🔧 Main d\'œuvre'}</span>
                                  <span className="font-semibold">{formatCurrency(laborPrice)}/{item.unit}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">{isRTL ? '📦 مواد' : '📦 Matériaux'}</span>
                                  <span className="font-semibold">{formatCurrency(materialPrice)}/{item.unit}</span>
                                </div>
                                <div className="flex justify-between gap-3 pt-1 border-t border-border/40">
                                  <span className="text-muted-foreground">{isRTL ? '💰 الكل' : '💰 Total'}</span>
                                  <span className="font-bold text-primary">{formatCurrency(fullPrice)}/{item.unit}</span>
                                </div>
                                <p className="text-[9px] text-muted-foreground pt-1">
                                  {item.withMaterial
                                    ? (isRTL ? 'اضغط لإزالة المواد' : 'Cliquer pour retirer les matériaux')
                                    : (isRTL ? 'اضغط لإضافة المواد' : 'Cliquer pour inclure les matériaux')
                                  }
                                </p>
                              </div>
                            );
                          })()}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </Card>
            ))}
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
            <Button variant="outline" className="w-full" onClick={handleResetAnalysis}>
              <RotateCcw className="h-4 w-4 mr-2" />
              <span className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'إعادة التحليل من الأول' : 'Reset Analysis'}
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
      <SecurityBadge />
    </div>
  );
};

export default SmartDevisPage;
