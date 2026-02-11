import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile, Profile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Plus, Trash2, FileText, Building2, User, MapPin, HardHat, Edit3, Truck, Wand2, Loader2, Calendar } from 'lucide-react';
import InvoiceDisplay, { InvoiceData } from './InvoiceDisplay';
import InvoiceActions from './InvoiceActions';
import LineItemEditor, { LineItem } from './LineItemEditor';
import QuoteWizardModal from './QuoteWizardModal';
import InvoiceGuideModal from './InvoiceGuideModal';
import PreFlightChecklistModal from './PreFlightChecklistModal';
import { supabase } from '@/integrations/supabase/client';

interface PrefillData {
  clientName?: string;
  clientAddress?: string;
  workSiteAddress?: string;
  items: Array<{
    designation_fr: string;
    designation_ar?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  notes?: string;
}

interface InvoiceFormBuilderProps {
  documentType: 'devis' | 'facture';
  onBack: () => void;
  prefillData?: PrefillData | null;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Generate document number prefix (locked part)
const getDocPrefix = (type: 'devis' | 'facture') => {
  const prefix = type === 'devis' ? 'DEV' : 'FAC';
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${prefix} ${year}${month} - `;
};

// Generate document number (prefix only, user fills the rest)
const generateDocNumber = (type: 'devis' | 'facture') => {
  return getDocPrefix(type);
};

const InvoiceFormBuilder = ({ documentType, onBack, prefillData }: InvoiceFormBuilderProps) => {
  const { isRTL } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [workSiteSameAsClient, setWorkSiteSameAsClient] = useState(true);
  const [workSiteAddress, setWorkSiteAddress] = useState('');
  
  // Travel costs state
  const [includeTravelCosts, setIncludeTravelCosts] = useState(false);
  const [travelDescription, setTravelDescription] = useState('');
  const [travelPrice, setTravelPrice] = useState(30);
  
  // TVA state - Auto-entrepreneur franchise de TVA
  const [isAutoEntrepreneur, setIsAutoEntrepreneur] = useState(false);
  const [selectedTvaRate, setSelectedTvaRate] = useState<5.5 | 10 | 20>(10);
  
  // Quote validity duration (in days) - default 30 days
  const [validityDuration, setValidityDuration] = useState<15 | 30 | 60 | 90>(30);
  
  // Line items - use empty strings for quantity/price to allow clean input
  const [items, setItems] = useState<LineItem[]>([
    {
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: '' as unknown as number, // Allow empty for clean input
      unit: 'm²',
      unitPrice: '' as unknown as number, // Allow empty for clean input
      total: 0,
    }
  ]);
  
  // Track temporary string values for quantity and price inputs
  const [tempValues, setTempValues] = useState<Record<string, { quantity?: string; unitPrice?: string }>>({});
  
  // Invoice preview state
  const [showPreview, setShowPreview] = useState(false);
  const [showArabic, setShowArabic] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  
  // Editable document number
  const [docNumber, setDocNumber] = useState(() => generateDocNumber(documentType));
  
  // Quote Wizard state
  const [showWizard, setShowWizard] = useState(false);
  
  // Pre-flight checklist state
  const [showChecklist, setShowChecklist] = useState(false);

  // Translation state
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [typingArabicIds, setTypingArabicIds] = useState<Set<string>>(new Set());
  const [translationAttemptIds, setTranslationAttemptIds] = useState<Set<string>>(new Set());
  const arabicDebounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const lastTranslatedSourceRef = useRef<Record<string, string | undefined>>({});
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Handle prefill data from quote-to-invoice conversion
  useEffect(() => {
    if (prefillData) {
      console.log('Prefilling invoice with extracted data:', prefillData);
      
      // Set client info
      if (prefillData.clientName) {
        setClientName(prefillData.clientName);
      }
      if (prefillData.clientAddress) {
        setClientAddress(prefillData.clientAddress);
      }
      if (prefillData.workSiteAddress) {
        setWorkSiteAddress(prefillData.workSiteAddress);
        setWorkSiteSameAsClient(false);
      }
      
      // Set items
      if (prefillData.items && prefillData.items.length > 0) {
        const newItems: LineItem[] = prefillData.items.map((item) => ({
          id: generateId(),
          designation_fr: item.designation_fr || '',
          designation_ar: item.designation_ar || '',
          quantity: item.quantity || 1,
          unit: item.unit || 'U',
          unitPrice: item.unitPrice || 0,
          total: (item.quantity || 1) * (item.unitPrice || 0),
        }));
        setItems(newItems);
        
        // Mark these items as having already been translated (from AI extraction)
        const attemptedIds = new Set(newItems.map(item => item.id));
        setTranslationAttemptIds(attemptedIds);
      }
      
      toast({
        title: isRTL ? '✅ تم ملء البيانات!' : '✅ Données pré-remplies!',
        description: isRTL 
          ? 'راجع البيانات واضغط على معاينة' 
          : 'Vérifiez les données et cliquez sur Aperçu',
      });
    }
  }, [prefillData, isRTL, toast]);

  const startTranslating = (id: string) => {
    setTranslatingIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const stopTranslating = (id: string) => {
    setTranslatingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  
  // Handle wizard-generated items
  const handleWizardGenerate = (generatedItems: LineItem[]) => {
    // Replace existing items with generated ones (or merge if there are already valid items)
    const existingValidItems = items.filter(item => item.designation_fr.trim() && item.unitPrice > 0);
    if (existingValidItems.length > 0) {
      // Merge: append generated items to existing valid items
      setItems([...existingValidItems, ...generatedItems]);
    } else {
      // Replace: no valid items exist, just use generated ones
      setItems(generatedItems);
    }
  };
  
  // Build invoice data from form
  const buildInvoiceData = (): InvoiceData => {
    // Combine regular items with travel costs if enabled
    const allItems = [...items.filter(item => item.designation_fr.trim() && item.unitPrice > 0)];
    
    // Add travel costs as a line item if enabled
    if (includeTravelCosts && travelPrice > 0) {
      allItems.push({
        id: generateId(),
        designation_fr: travelDescription || 'Frais de déplacement',
        designation_ar: 'مصاريف النقل',
        quantity: 1,
        unit: 'forfait',
        unitPrice: travelPrice,
        total: travelPrice,
      });
    }
    
    const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);
    
    // Smart TVA calculation: Auto-entrepreneur = franchise de TVA
    const tvaExempt = isAutoEntrepreneur;
    const tvaRate = tvaExempt ? 0 : selectedTvaRate;
    const tvaAmount = tvaExempt ? 0 : Math.round(subtotal * (tvaRate / 100) * 100) / 100;
    const total = subtotal + tvaAmount;
    
    return {
      type: documentType === 'devis' ? 'DEVIS' : 'FACTURE',
      number: docNumber,
      date: new Date().toLocaleDateString('fr-FR'),
      validUntil: documentType === 'devis' 
        ? new Date(Date.now() + validityDuration * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')
        : undefined,
      emitter: {
        name: profile?.company_name || 'Votre Entreprise',
        siret: profile?.siret || '',
        address: profile?.company_address || '',
        phone: profile?.phone || '',
        email: profile?.email || '',
      },
      client: {
        name: clientName || 'Client',
        address: clientAddress || '',
      },
      workSite: {
        sameAsClient: workSiteSameAsClient,
        address: workSiteSameAsClient ? undefined : workSiteAddress,
      },
      items: allItems.map(item => ({
        designation_fr: item.designation_fr,
        designation_ar: item.designation_ar || item.designation_fr,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      subtotal: Math.round(subtotal * 100) / 100,
      tvaRate,
      tvaAmount,
      tvaExempt,
      total: Math.round(total * 100) / 100,
      paymentTerms: 'Paiement à réception de facture',
      legalMentions: tvaExempt 
        ? 'TVA non applicable, article 293 B du CGI'
        : undefined,
      // Inject artisan's permanent signature and stamp from profile
      artisanSignatureUrl: (profile as any)?.artisan_signature_url || undefined,
      stampUrl: (profile as any)?.stamp_url || undefined,
    };
  };
  
  const invoiceData = buildInvoiceData();
  
  // Check if form is valid
  const isFormValid = clientName.trim() && items.some(item => item.designation_fr.trim() && item.unitPrice > 0);
  
  // Handle item quantity/price change
  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Recalculate total if quantity or unitPrice changed
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = Math.round(updated.quantity * updated.unitPrice * 100) / 100;
      }
      
      return updated;
    }));
  };

  // Strict translation mechanism: bottom (AR/Darija/Franco) drives top (French)
  const invokeTranslation = async (input: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('invoice-mentor', {
      body: {
        action: 'translate_to_french',
        text: input,
      },
    });

    if (error) throw error;

    const translation = (data?.translation as string | undefined)?.trim();
    if (!translation) throw new Error('Missing translation');
    return translation;
  };

  const handleTranslation = async (id: string, textOverride?: string) => {
    const current = itemsRef.current.find(i => i.id === id);
    const input = (textOverride ?? current?.designation_ar ?? '').trim();
    if (!input) return;

    // Mark that we attempted translation for this row (used for UX validation only)
    setTranslationAttemptIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // If we already translated the exact same source text, skip re-calling the model.
    if (lastTranslatedSourceRef.current[id] === input) return;

    // Arabic input drives French output: overwrite FR with translated text.
    startTranslating(id);
    try {
      const translation = await invokeTranslation(input);
      lastTranslatedSourceRef.current[id] = input;
      setItems(prev => prev.map(it => (it.id === id ? { ...it, designation_fr: translation } : it)));
    } catch (e) {
      console.error('Translation failed:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL
          ? 'تعذر ترجمة النص. جرّب تاني.'
          : 'Impossible de traduire. Réessayez.',
      });
    } finally {
      stopTranslating(id);
    }
  };

  // Auto-translate (debounced): when user stops typing in Arabic for 1s, translate and inject into FR.
  const handleArabicChange = (id: string, value: string) => {
    handleItemChange(id, 'designation_ar', value);

    // While user is typing, never show blocking validation on the French field.
    setTypingArabicIds(prev => {
      const next = new Set(prev);
      if (value.trim()) next.add(id);
      else next.delete(id);
      return next;
    });

    // Reset attempt state if Arabic is cleared
    if (!value.trim()) {
      setTranslationAttemptIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      lastTranslatedSourceRef.current[id] = undefined;
    }

    // Debounce translation per-item
    const existing = arabicDebounceTimersRef.current[id];
    if (existing) clearTimeout(existing);

    const snapshot = value;
    arabicDebounceTimersRef.current[id] = setTimeout(() => {
      // If user kept typing, ignore this run
      const latest = (itemsRef.current.find(i => i.id === id)?.designation_ar ?? '').trim();
      if (latest !== snapshot.trim()) return;
      if (!latest) return;

      setTypingArabicIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      void handleTranslation(id, latest);
    }, 1000);
  };

  // Security: on "Ajouter" (new row) or before preview, forbid proceeding if FR is empty but AR is filled.
  const ensureTranslations = async () => {
    const pending = itemsRef.current.filter(i => i.designation_ar?.trim() && !i.designation_fr?.trim());
    if (pending.length === 0) return true;

    const updates: Record<string, string> = {};

    try {
      for (const item of pending) {
        startTranslating(item.id);
        updates[item.id] = await invokeTranslation(item.designation_ar.trim());
      }
    } catch (e) {
      console.error('Bulk translation failed:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL
          ? 'تعذر ترجمة النص. جرّب تاني.'
          : 'Impossible de traduire. Réessayez.',
      });
      for (const item of pending) stopTranslating(item.id);
      return false;
    }

    setItems(prev => prev.map(it => (updates[it.id] ? { ...it, designation_fr: updates[it.id] } : it)));
    for (const item of pending) stopTranslating(item.id);

    const stillPending = pending.some(it => !updates[it.id]?.trim());
    if (stillPending) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'لازم الترجمة' : 'Traduction requise',
        description: isRTL
          ? 'مينفعش تكمل قبل ما الوصف بالفرنسي يتملي.'
          : 'Impossible de continuer: la description française doit être remplie.',
      });
      return false;
    }

    return true;
  };
  
  // Add new line item
  const addLineItem = () => {
    setItems(prev => [...prev, {
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: '' as unknown as number, // Allow empty for clean input
      unit: 'u',
      unitPrice: '' as unknown as number, // Allow empty for clean input
      total: 0,
    }]);
  };
  
  // Handle focus - select all text
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  // Handle change for numeric fields - allow empty string while typing
  const handleNumericChange = (id: string, field: 'quantity' | 'unitPrice', value: string) => {
    setTempValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  // Handle blur - validate and set final value
  const handleNumericBlur = (id: string, field: 'quantity' | 'unitPrice', defaultValue: number) => {
    const tempValue = tempValues[id]?.[field];
    const numValue = tempValue === undefined || tempValue === '' ? defaultValue : parseFloat(tempValue) || defaultValue;
    
    // Clear temp value
    setTempValues(prev => {
      const newTempValues = { ...prev };
      if (newTempValues[id]) {
        delete newTempValues[id][field];
        if (Object.keys(newTempValues[id]).length === 0) {
          delete newTempValues[id];
        }
      }
      return newTempValues;
    });
    
    handleItemChange(id, field, numValue);
  };

  // Get display value for numeric fields
  const getNumericDisplayValue = (id: string, field: 'quantity' | 'unitPrice', actualValue: number | string): string => {
    const tempValue = tempValues[id]?.[field];
    if (tempValue !== undefined) return tempValue;
    // Show empty string if value is empty or 0
    if (actualValue === '' || actualValue === 0) return '';
    return String(actualValue);
  };
  
  // Remove line item
  const removeLineItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };
  
  // Update invoice data from SmartReviewModal
  const handleUpdateInvoice = (updatedData: InvoiceData) => {
    // Update items from the invoice data
    const newItems: LineItem[] = updatedData.items.map(item => ({
      id: generateId(),
      designation_fr: item.designation_fr,
      designation_ar: item.designation_ar,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.total,
    }));
    setItems(newItems);
  };

  return (
    <div className="space-y-6">
      {/* Header with Guide Button */}
      <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
        <div />
        <InvoiceGuideModal />
      </div>

      {/* Quote Validity Duration Selector - Only for Devis */}
      {documentType === 'devis' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className={cn(
              "flex items-center justify-between gap-4",
              isRTL && "flex-row-reverse"
            )}>
              <div className={cn(
                "flex items-center gap-2",
                isRTL && "flex-row-reverse"
              )}>
                <Calendar className="h-5 w-5 text-primary" />
                <span className={cn(
                  "font-bold text-primary text-sm uppercase tracking-wide",
                  isRTL && "font-cairo"
                )}>
                  {isRTL ? 'مدة صلاحية الدوفي' : 'Validité du devis'}
                </span>
              </div>
              <select 
                value={validityDuration} 
                onChange={(e) => setValidityDuration(parseInt(e.target.value) as 15 | 30 | 60 | 90)}
                className={cn(
                  "bg-background border border-border text-foreground text-xs font-bold rounded-lg focus:ring-primary focus:border-primary p-2 uppercase",
                  isRTL && "font-cairo"
                )}
              >
                <option value="15">{isRTL ? '15 يوم' : '15 Jours'}</option>
                <option value="30">{isRTL ? '1 شهر (موصى به)' : '1 Mois (Recommandé)'}</option>
                <option value="60">{isRTL ? '2 شهور' : '2 Mois'}</option>
                <option value="90">{isRTL ? '3 شهور' : '3 Mois'}</option>
              </select>
            </div>
            
            {/* Educational Tip */}
            <p className={cn(
              "text-[10px] text-primary/80 leading-tight",
              isRTL && "text-right font-cairo"
            )}>
              {isRTL 
                ? '💡 نصيحة: اختار شهر واحد أحسن. ده بيحميك لو أسعار المواد (دهان، نحاس...) زادت الشهر الجاي.'
                : '💡 Conseil : Choisir 1 mois est idéal. Cela vous protège si le prix des matériaux (peinture, cuivre...) augmente le mois prochain.'
              }
            </p>
            
            {/* Date Display */}
            <div className={cn(
              "pt-2 border-t border-primary/10 flex justify-between text-[10px] font-bold text-muted-foreground",
              isRTL && "flex-row-reverse font-cairo"
            )}>
              <span>{isRTL ? `صادر في : ${new Date().toLocaleDateString('fr-FR')}` : `Émis le : ${new Date().toLocaleDateString('fr-FR')}`}</span>
              <span className="text-destructive">
                {isRTL 
                  ? `ينتهي في : ${new Date(Date.now() + validityDuration * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}`
                  : `Expire le : ${new Date(Date.now() + validityDuration * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}`
                }
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Document Number - Editable */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <FileText className="h-5 w-5 text-primary" />
            <h3 className={cn("font-bold", isRTL && "font-cairo")}>
              {isRTL 
                ? (documentType === 'facture' ? 'رقم الفاتورة' : 'رقم الدوفي')
                : (documentType === 'facture' ? 'Numéro de facture' : 'Numéro de devis')}
            </h3>
          </div>
          <p className={cn("text-[11px] text-muted-foreground", isRTL && "text-right font-cairo")}>
            {isRTL
              ? 'حطيت لك السنة والشهر وانت حط الرقم التسلسلي'
              : "L'année et le mois sont déjà renseignés, vous devez saisir uniquement le numéro après le trait d'union."}
          </p>
          <Input
            value={docNumber}
            onChange={(e) => {
              const prefix = getDocPrefix(documentType);
              const val = e.target.value;
              // Prevent modifying the locked prefix
              if (val.length < prefix.length) {
                setDocNumber(prefix);
              } else if (val.startsWith(prefix)) {
                setDocNumber(val);
              } else {
                setDocNumber(prefix);
              }
            }}
            onFocus={() => {
              const prefix = getDocPrefix(documentType);
              if (!docNumber || !docNumber.startsWith(prefix)) {
                setDocNumber(prefix);
              }
            }}
            placeholder={isRTL ? `مثال: ${getDocPrefix(documentType)}001` : `Ex: ${getDocPrefix(documentType)}001`}
            className="font-mono"
          />
          <p className={cn("text-[10px] text-muted-foreground", isRTL && "text-right font-cairo")}>
            {isRTL
              ? '💡 تقدر تغيّر الرقم حسب نظام الترقيم بتاعك'
              : '💡 Vous pouvez personnaliser ce numéro selon votre système de numérotation'}
          </p>
        </CardContent>
      </Card>

      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="p-4">
          <div className={cn(
            "flex items-center gap-2 mb-3",
            isRTL && "flex-row-reverse"
          )}>
            <Building2 className="h-5 w-5 text-green-600" />
            <h3 className={cn(
              "font-bold text-green-700 dark:text-green-400",
              isRTL && "font-cairo"
            )}>
              {isRTL ? '✅ بياناتك (متحفوظة)' : '✅ Vos informations (pré-remplies)'}
            </h3>
          </div>
          
          <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm",
            isRTL && "text-right"
          )}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{isRTL ? 'الشركة:' : 'Entreprise:'}</span>
              <span className="font-medium">{profile?.company_name || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">SIRET:</span>
              <span className="font-medium font-mono">{profile?.siret || '—'}</span>
            </div>
            <div className="flex items-center gap-2 col-span-full">
              <span className="text-muted-foreground">{isRTL ? 'العنوان:' : 'Adresse:'}</span>
              <span className="font-medium">{profile?.company_address || '—'}</span>
            </div>
            {profile?.legal_status && (
              <div className="flex items-center gap-2 col-span-full">
                <span className="text-muted-foreground">{isRTL ? 'نوع النشاط:' : 'Statut:'}</span>
                <span className={cn(
                  "font-medium px-2 py-0.5 rounded text-xs",
                  profile.legal_status === 'auto-entrepreneur' 
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-primary/10 text-primary'
                )}>
                  {profile.legal_status === 'auto-entrepreneur' 
                    ? 'Auto-entrepreneur (معفى من الـ TVA)'
                    : 'Société (يدفع TVA)'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Client Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse"
          )}>
            <User className="h-5 w-5 text-primary" />
            <h3 className={cn(
              "font-bold",
              isRTL && "font-cairo"
            )}>
              {isRTL ? '👤 بيانات الزبون' : '👤 Informations client'}
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'اسم الزبون' : 'Nom du client'} *
              </Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={isRTL ? 'مثلاً: M. Jean Dupont' : 'Ex: M. Jean Dupont'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
            
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'عنوان الفاكتير' : 'Adresse de facturation'} *
              </Label>
              <Input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder={isRTL ? '12 rue de Paris, 75001 Paris' : '12 rue de Paris, 75001 Paris'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Work Site Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse"
          )}>
            <HardHat className="h-5 w-5 text-orange-500" />
            <h3 className={cn(
              "font-bold",
              isRTL && "font-cairo"
            )}>
              {isRTL ? '📍 عنوان الشانتييه' : '📍 Adresse du Chantier'}
            </h3>
          </div>
          
          <div className={cn(
            "flex items-center gap-3",
            isRTL && "flex-row-reverse"
          )}>
            <Checkbox
              id="same-address"
              checked={workSiteSameAsClient}
              onCheckedChange={(checked) => setWorkSiteSameAsClient(checked === true)}
            />
            <Label 
              htmlFor="same-address" 
              className={cn(
                "cursor-pointer text-sm",
                isRTL && "font-cairo"
              )}
            >
              {isRTL 
                ? 'نفس عنوان الزبون'
                : "L'adresse du chantier est identique à l'adresse du client"}
            </Label>
          </div>
          
          {!workSiteSameAsClient && (
            <div className="space-y-2 pt-2">
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'عنوان الشانتييه' : 'Adresse du Chantier / Stationnement'}
              </Label>
              <Input
                value={workSiteAddress}
                onChange={(e) => setWorkSiteAddress(e.target.value)}
                placeholder={isRTL ? '45 avenue de Lyon, 69001 Lyon' : '45 avenue de Lyon, 69001 Lyon'}
                className={cn(isRTL && "text-right font-cairo")}
              />
              <p className={cn(
                "text-xs text-muted-foreground",
                isRTL && "font-cairo text-right"
              )}>
                {isRTL 
                  ? '⚠️ العنوان اللي هتركن فيه - مهم عشان مصاريف الباركينج!'
                  : '⚠️ C\'est l\'adresse où le véhicule sera garé - important pour les frais de stationnement!'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* AI Quote Wizard Button - Dynamic based on document type */}
      <Button
        variant="outline"
        size="lg"
        onClick={() => setShowWizard(true)}
        className={cn(
          "w-full border-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary",
          "flex items-center justify-center gap-3 py-6",
          isRTL && "flex-row-reverse font-cairo"
        )}
      >
        <Wand2 className="h-6 w-6 text-primary" />
        <div className={cn("text-center", isRTL && "font-cairo")}>
          <div className="font-bold text-primary">
            {documentType === 'devis' 
              ? (isRTL ? '🧙‍♂️ ساعدني أحسب الدوفي' : '🧙‍♂️ Assistant Devis - Chiffrage')
              : (isRTL ? '📝 ساعدني أعمل الفاكتير' : '📝 Assistant Facture')}
          </div>
          <div className="text-xs text-muted-foreground">
            {documentType === 'devis'
              ? (isRTL ? 'قولي الشغل وأنا أحسبلك!' : 'Aidez-moi à chiffrer!')
              : (isRTL ? 'أملّيلك البنود بسرعة!' : 'Aidez-moi à rédiger rapidement!')}
          </div>
        </div>
      </Button>
      
      {/* Line Items Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center justify-between",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn(
              "flex items-center gap-2",
              isRTL && "flex-row-reverse"
            )}>
              <FileText className="h-5 w-5 text-primary" />
              <h3 className={cn(
                "font-bold",
                isRTL && "font-cairo"
              )}>
                {isRTL ? '📋 الشغل والأسعار' : '📋 Lignes de prestation'}
              </h3>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const ok = await ensureTranslations();
                if (!ok) return;
                addLineItem();
              }}
              className={cn(isRTL && "font-cairo")}
               disabled={translatingIds.size > 0}
            >
              {translatingIds.size > 0 ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {isRTL ? 'زود بند' : 'Ajouter'}
            </Button>
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div 
                key={item.id}
                className="p-3 border rounded-lg bg-muted/30 space-y-3"
              >
                <div className={cn(
                  "flex items-center justify-between",
                  isRTL && "flex-row-reverse"
                )}>
                  <span className="text-xs text-muted-foreground font-mono">
                    #{index + 1}
                  </span>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs", isRTL && "font-cairo")}>
                      {isRTL ? 'الوصف بالفرنساوي (يظهر للزبون)' : 'Désignation (Français)'}
                    </Label>
                    <Input
                      value={item.designation_fr}
                      onChange={(e) => handleItemChange(item.id, 'designation_fr', e.target.value)}
                      placeholder={isRTL ? 'مثال: Peinture salon' : 'Ex: Peinture mur salon'}
                      className={cn(
                        "text-sm",
                        // Do NOT show blocking validation while user is typing in Arabic.
                        item.designation_ar?.trim() &&
                          !item.designation_fr?.trim() &&
                          !typingArabicIds.has(item.id) &&
                          !translatingIds.has(item.id) &&
                          translationAttemptIds.has(item.id) &&
                          "border-destructive/50 bg-destructive/5"
                      )}
                    />
                    <p className={cn("text-[10px] text-muted-foreground", isRTL && "font-cairo text-right")}>
                      {isRTL ? '👁️ ده اللي الزبون يشوفه' : '👁️ Visible par le client'}
                    </p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs", isRTL && "font-cairo")}>
                      {'اكتب بالعربي وأنا أترجم ✨'}
                    </Label>
                    <Textarea
                      value={item.designation_ar}
                      onChange={(e) => handleArabicChange(item.id, e.target.value)}
                      onBlur={(e) => {
                        const existing = arabicDebounceTimersRef.current[item.id];
                        if (existing) clearTimeout(existing);
                        void handleTranslation(item.id, e.currentTarget.value);
                      }}
                      placeholder={isRTL ? 'مثال: زليج / بانتير / كليما' : 'Ex: zelij / bantoura / clima'}
                      className={cn(
                        "text-sm min-h-[44px]",
                        isRTL && "text-right font-cairo"
                      )}
                    />
                    {translatingIds.has(item.id) && (
                      <p className={cn("text-[10px] text-primary flex items-center gap-1", isRTL && "font-cairo")}> 
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {isRTL ? 'بترجم...' : '🔄 Traduction en cours...'}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs", isRTL && "font-cairo")}>
                      {isRTL ? 'الكمية' : 'Qté'}
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={getNumericDisplayValue(item.id, 'quantity', item.quantity)}
                      onFocus={handleInputFocus}
                      onChange={(e) => handleNumericChange(item.id, 'quantity', e.target.value)}
                      onBlur={() => handleNumericBlur(item.id, 'quantity', 1)}
                      placeholder="1"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs", isRTL && "font-cairo")}>
                      {isRTL ? 'الوحدة' : 'Unité'}
                    </Label>
                    <Input
                      value={item.unit}
                      onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                      placeholder="m², h, u"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRTL ? 'السعر €' : 'P.U. (€)'}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={getNumericDisplayValue(item.id, 'unitPrice', item.unitPrice)}
                      onFocus={handleInputFocus}
                      onChange={(e) => handleNumericChange(item.id, 'unitPrice', e.target.value)}
                      onBlur={() => handleNumericBlur(item.id, 'unitPrice', 0)}
                      placeholder="0"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5 hidden sm:block">
                    <Label className="text-xs">{isRTL ? 'المجموع' : 'Total'}</Label>
                    <div className="h-10 flex items-center px-3 bg-primary/5 border rounded-md font-mono text-sm font-medium">
                      {item.total.toFixed(2)} €
                    </div>
                  </div>
                </div>
                
                {/* Mobile total */}
                <div className="sm:hidden flex justify-end">
                  <span className="text-sm font-medium font-mono bg-primary/10 px-3 py-1 rounded">
                    = {item.total.toFixed(2)} €
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Travel Costs Section */}
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="p-4 space-y-4">
              <div className={cn(
                "flex items-center justify-between",
                isRTL && "flex-row-reverse"
              )}>
                <div className={cn(
                  "flex items-center gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <Truck className="h-5 w-5 text-orange-600" />
                  <h4 className={cn(
                    "font-bold text-orange-700 dark:text-orange-400",
                    isRTL && "font-cairo"
                  )}>
                    {isRTL ? '🚚 مصاريف المشوار' : '🚚 Frais de déplacement'}
                  </h4>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <Label 
                    htmlFor="travel-toggle" 
                    className={cn("text-sm", isRTL && "font-cairo")}
                  >
                    {isRTL ? 'أضيف؟' : 'Ajouter?'}
                  </Label>
                  <Switch
                    id="travel-toggle"
                    checked={includeTravelCosts}
                    onCheckedChange={setIncludeTravelCosts}
                  />
                </div>
              </div>
              
              {includeTravelCosts && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs", isRTL && "font-cairo")}>
                      {isRTL ? 'الوصف' : 'Description'}
                    </Label>
                    <Input
                      value={travelDescription}
                      onChange={(e) => setTravelDescription(e.target.value)}
                      placeholder={isRTL ? 'مثال: Paris A/R' : 'Ex: Paris A/R'}
                      className={cn("text-sm", isRTL && "text-right font-cairo")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {isRTL ? 'المبلغ (€)' : 'Montant (€)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={travelPrice}
                      onChange={(e) => setTravelPrice(parseFloat(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* TVA Settings - French Law Compliance */}
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-4 space-y-4">
              <div className={cn(
                "flex items-center justify-between",
                isRTL && "flex-row-reverse"
              )}>
                <div className={cn(
                  "flex items-center gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <span className="text-xl">💶</span>
                  <h4 className={cn(
                    "font-bold text-blue-700 dark:text-blue-400",
                    isRTL && "font-cairo"
                  )}>
                    {isRTL ? 'الـ TVA (الضريبة)' : 'TVA'}
                  </h4>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <Label 
                    htmlFor="auto-entrepreneur-toggle" 
                    className={cn("text-xs", isRTL && "font-cairo")}
                  >
                    {isRTL ? 'أوطو أنتروبرونور؟' : 'Auto-entrepreneur?'}
                  </Label>
                  <Switch
                    id="auto-entrepreneur-toggle"
                    checked={isAutoEntrepreneur}
                    onCheckedChange={setIsAutoEntrepreneur}
                  />
                </div>
              </div>
              
              {isAutoEntrepreneur ? (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className={cn(
                    "text-sm text-green-700 dark:text-green-400",
                    isRTL && "font-cairo text-right"
                  )}>
                    ✅ {isRTL 
                      ? 'TVA = 0% - هيتكتب تلقائي: "TVA non applicable, art. 293 B du CGI"' 
                      : 'TVA = 0% - Mention légale ajoutée automatiquement'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className={cn(
                    "text-xs text-muted-foreground",
                    isRTL && "font-cairo text-right"
                  )}>
                    {isRTL 
                      ? 'اختار نسبة الـ TVA حسب نوع الشغل:' 
                      : 'Choisissez le taux selon les travaux:'}
                  </p>
                  <div className={cn(
                    "flex gap-2 flex-wrap",
                    isRTL && "flex-row-reverse"
                  )}>
                    <Button
                      type="button"
                      variant={selectedTvaRate === 5.5 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTvaRate(5.5)}
                      className="flex-1 min-w-[80px]"
                    >
                      <span className="font-bold">5,5%</span>
                      <span className="text-xs ml-1 opacity-70">
                        {isRTL ? '(عزل حراري)' : '(énergétique)'}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant={selectedTvaRate === 10 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTvaRate(10)}
                      className="flex-1 min-w-[80px]"
                    >
                      <span className="font-bold">10%</span>
                      <span className="text-xs ml-1 opacity-70">
                        {isRTL ? '(تجديد)' : '(rénovation)'}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant={selectedTvaRate === 20 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTvaRate(20)}
                      className="flex-1 min-w-[80px]"
                    >
                      <span className="font-bold">20%</span>
                      <span className="text-xs ml-1 opacity-70">
                        {isRTL ? '(بناء جديد)' : '(neuf)'}
                      </span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Totals Summary */}
          <div className="pt-4 border-t space-y-2">
            <div className={cn(
              "flex justify-between text-sm",
              isRTL && "flex-row-reverse"
            )}>
              <span className="text-muted-foreground">{isRTL ? 'المجموع قبل الضريبة:' : 'Sous-total HT:'}</span>
              <span className="font-mono font-medium">{invoiceData.subtotal.toFixed(2)} €</span>
            </div>
            
            {invoiceData.tvaExempt ? (
              <div className={cn(
                "text-xs text-muted-foreground italic",
                isRTL && "text-right font-cairo"
              )}>
                TVA non applicable, art. 293 B du CGI
              </div>
            ) : (
              <div className={cn(
                "flex justify-between text-sm",
                isRTL && "flex-row-reverse"
              )}>
                <span className="text-muted-foreground">TVA ({invoiceData.tvaRate}%):</span>
                <span className="font-mono font-medium">{invoiceData.tvaAmount.toFixed(2)} €</span>
              </div>
            )}
            
            <div className={cn(
              "flex justify-between text-lg font-bold pt-2 border-t",
              isRTL && "flex-row-reverse"
            )}>
              <span>{isRTL ? 'الإجمالي:' : 'Total TTC:'}</span>
              <span className="font-mono text-primary">{invoiceData.total.toFixed(2)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Preview & Actions */}
      {showPreview ? (
        <div className="space-y-4 relative">
          {/* Floating Edit Button */}
          <Button
            onClick={() => setShowPreview(false)}
            className={cn(
              "fixed bottom-24 right-4 z-50 rounded-full shadow-lg gap-2 px-5 py-3 text-sm font-bold",
              isRTL && "font-cairo left-4 right-auto"
            )}
          >
            <Edit3 className="h-4 w-4" />
            {isRTL ? 'تعديل' : 'Modifier'}
          </Button>

          <div className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse"
          )}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(false)}
              className={cn(isRTL && "font-cairo")}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              {isRTL ? 'عدّل البيانات' : 'Modifier le formulaire'}
            </Button>
          </div>
          
          <InvoiceActions
            invoiceData={invoiceData}
            invoiceRef={invoiceRef}
            showArabic={showArabic}
            onToggleArabic={setShowArabic}
            onUpdateInvoice={handleUpdateInvoice}
          />
          
          <div ref={invoiceRef}>
            <InvoiceDisplay 
              data={invoiceData} 
              showArabic={showArabic} 
            />
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex gap-3",
          isRTL && "flex-row-reverse"
        )}>
          <Button
            variant="outline"
            onClick={onBack}
            className={cn(isRTL && "font-cairo")}
          >
            {isRTL ? 'رجوع' : 'Retour'}
          </Button>
          
          <Button
            onClick={async () => {
              const ok = await ensureTranslations();
              if (!ok) return;

              // Comprehensive validation with detailed feedback
              const missingFields: string[] = [];
              
              // Check client name
              if (!clientName.trim()) {
                missingFields.push(isRTL ? '👤 اسم الزبون' : '👤 Nom du client');
              }
              
              // Check client address
              if (!clientAddress.trim()) {
                missingFields.push(isRTL ? '📍 عنوان الفاكتير' : '📍 Adresse de facturation');
              }
              
              // Check work site address if different from client
              if (!workSiteSameAsClient && !workSiteAddress.trim()) {
                missingFields.push(isRTL ? '🏗️ عنوان الشانتييه' : '🏗️ Adresse du chantier');
              }
              
              // Check line items
              const hasValidItem = items.some(item => item.designation_fr.trim() && Number(item.unitPrice) > 0);
              if (!hasValidItem && !(includeTravelCosts && travelPrice > 0)) {
                missingFields.push(isRTL ? '📋 بند واحد على الأقل بسعره' : '📋 Au moins une prestation avec un prix');
              }
              
              // Show validation errors if any
              if (missingFields.length > 0) {
                toast({
                  variant: "destructive",
                  title: isRTL ? "⚠️ في حاجات ناقصة" : "⚠️ Données manquantes",
                  description: (
                    <div className="mt-2 space-y-1">
                      <p className={cn("font-medium", isRTL && "font-cairo text-right")}>
                        {isRTL ? 'كمّل الخانات دي:' : 'Veuillez compléter:'}
                      </p>
                      <ul className={cn("list-none space-y-1 text-sm", isRTL && "text-right")}>
                        {missingFields.map((field, idx) => (
                          <li key={idx} className="text-destructive-foreground">{field}</li>
                        ))}
                      </ul>
                    </div>
                  ),
                });
                return;
              }
              
              setShowChecklist(true);
            }}
            className={cn("flex-1", isRTL && "font-cairo")}
          >
            <FileText className="h-4 w-4 mr-2" />
            {isRTL ? 'معاينة وتحميل' : 'Aperçu et Télécharger PDF'}
          </Button>
        </div>
      )}
      
      {/* Quote Wizard Modal */}
      <QuoteWizardModal
        open={showWizard}
        onOpenChange={setShowWizard}
        onGenerate={handleWizardGenerate}
        documentType={documentType}
      />
      
      {/* Pre-Flight Checklist Modal */}
      <PreFlightChecklistModal
        open={showChecklist}
        onOpenChange={setShowChecklist}
        onConfirm={() => {
          setShowChecklist(false);
          setShowPreview(true);
        }}
        items={items}
      />
    </div>
  );
};

export default InvoiceFormBuilder;
