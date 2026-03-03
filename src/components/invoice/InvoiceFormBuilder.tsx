import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, Trash2, FileText, Building2, User, MapPin, HardHat, Edit3, Truck, Wand2, Loader2, Calendar, HelpCircle, RotateCcw } from 'lucide-react';
import InvoiceDisplay, { InvoiceData } from './InvoiceDisplay';
import InvoiceActions from './InvoiceActions';
import LineItemEditor, { LineItem } from './LineItemEditor';
import QuoteWizardModal from './QuoteWizardModal';
import InvoiceGuideModal from './InvoiceGuideModal';
import FactureGuideModal from './FactureGuideModal';
import PreFlightChecklistModal from './PreFlightChecklistModal';
import UnitGuideModal, { UnitGuideButton } from './UnitGuideModal';
import { supabase } from '@/integrations/supabase/client';
import { saveDraft, loadDraft, clearDraft, loadCloudDraft } from '@/lib/invoiceDraftStorage';
import { detectMultipleTasks } from '@/lib/smartItemSplit';
import { useAuth } from '@/hooks/useAuth';
import { resolveAssetUrls } from '@/lib/storageUtils';
import ProtectedDocumentWrapper from '@/components/shared/ProtectedDocumentWrapper';

interface PrefillData {
  clientName?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientSiren?: string;
  clientTvaIntra?: string;
  clientIsB2B?: boolean;
  workSiteAddress?: string;
  natureOperation?: string;
  items: Array<{
    designation_fr: string;
    designation_ar?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  notes?: string;
  source?: string;
}

interface InvoiceFormBuilderProps {
  documentType: 'devis' | 'facture';
  onBack: () => void;
  prefillData?: PrefillData | null;
  onDocumentTypeChange?: (type: 'devis' | 'facture') => void;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Generate document number prefix (locked part) - always uses current calendar year
const getDocPrefix = (type: 'devis' | 'facture') => {
  const prefix = type === 'devis' ? 'D' : 'F';
  const year = new Date().getFullYear();
  return `${prefix}-${year}-`;
};

// Generate document number with empty suffix (user fills in their own number)
const generateDocNumber = (type: 'devis' | 'facture') => {
  return `${getDocPrefix(type)}`;
};

const InvoiceFormBuilder = ({ documentType, onBack, prefillData, onDocumentTypeChange }: InvoiceFormBuilderProps) => {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientSiren, setClientSiren] = useState('');
  const [clientTvaIntra, setClientTvaIntra] = useState('');
  const [clientIsB2B, setClientIsB2B] = useState(false);
  const [workSiteSameAsClient, setWorkSiteSameAsClient] = useState(true);
  const [workSiteAddress, setWorkSiteAddress] = useState('');
  
  // Nature of operation
  const [natureOperation, setNatureOperation] = useState<'service' | 'goods' | 'mixed'>('service');
  
  // Assurance décennale
  const [assureurName, setAssureurName] = useState('');
  const [assureurAddress, setAssureurAddress] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [geographicCoverage, setGeographicCoverage] = useState('France métropolitaine');
  // Travel costs state
  const [includeTravelCosts, setIncludeTravelCosts] = useState(false);
  const [travelDescription, setTravelDescription] = useState('');
  const [travelPrice, setTravelPrice] = useState(30);
  
  // TVA state - Auto-entrepreneur franchise de TVA
  const [isAutoEntrepreneur, setIsAutoEntrepreneur] = useState(false);
  const [selectedTvaRate, setSelectedTvaRate] = useState<5.5 | 10 | 20>(10);
  
  // Quote validity duration (in days) - default 30 days
  const [validityDuration, setValidityDuration] = useState<15 | 30 | 60 | 90>(30);
  
  // Invoice due date duration (in days) - default 30 days
  const [dueDateDays, setDueDateDays] = useState<15 | 30 | 45 | 60>(30);
  
  // Payment terms state
  const [acomptePercent, setAcomptePercent] = useState<number>(30);
  const [delaiPaiement, setDelaiPaiement] = useState<string>('reception');
  const [moyenPaiement, setMoyenPaiement] = useState<string>('virement');
  
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
  
  // Unit Guide state
  const [showUnitGuide, setShowUnitGuide] = useState(false);
  
  // Guide modal state
  const [showGuide, setShowGuide] = useState(false);

  // Translation state
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [typingArabicIds, setTypingArabicIds] = useState<Set<string>>(new Set());
  const [translationAttemptIds, setTranslationAttemptIds] = useState<Set<string>>(new Set());
  const arabicDebounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const lastTranslatedSourceRef = useRef<Record<string, string | undefined>>({});
  const itemsRef = useRef(items);

  // Auto-increment document number from existing documents
  useEffect(() => {
    if (!user) return;
    const prefix = getDocPrefix(documentType);
    const year = new Date().getFullYear();
    const typeFilter = documentType;
    
    (supabase.from('documents_comptables') as any)
      .select('document_number')
      .eq('user_id', user.id)
      .eq('document_type', typeFilter)
      .like('document_number', `${prefix}%`)
      .then(({ data }: { data: any[] | null }) => {
        let maxCounter = 0;
        if (data) {
          data.forEach((doc: any) => {
            const num = doc.document_number?.replace(prefix, '');
            const parsed = parseInt(num, 10);
            if (!isNaN(parsed) && parsed > maxCounter) {
              maxCounter = parsed;
            }
          });
        }
        const nextCounter = String(maxCounter + 1);
        const nextNumber = `${prefix}${nextCounter}`;
        setDocNumber(nextNumber);
      });
  }, [user, documentType]);

  // Signed URLs for company assets (logo, signature, stamp)
  const [signedUrls, setSignedUrls] = useState<{
    logoUrl: string | null;
    artisanSignatureUrl: string | null;
    stampUrl: string | null;
    headerImageUrl: string | null;
  }>({ logoUrl: null, artisanSignatureUrl: null, stampUrl: null, headerImageUrl: null });

  useEffect(() => {
    if (!profile) return;
    resolveAssetUrls({
      logoUrl: profile.logo_url,
      artisanSignatureUrl: profile.artisan_signature_url,
      stampUrl: profile.stamp_url,
      headerImageUrl: profile.header_image_url,
    }).then(setSignedUrls);
    
    // Auto-populate assurance décennale from profile
    const p = profile as any;
    if (p.assureur_name && !assureurName) setAssureurName(p.assureur_name);
    if (p.assureur_address && !assureurAddress) setAssureurAddress(p.assureur_address);
    if (p.assurance_policy_number && !policyNumber) setPolicyNumber(p.assurance_policy_number);
    if (p.assurance_geographic_coverage && !geographicCoverage) setGeographicCoverage(p.assurance_geographic_coverage);
    // Auto-set TVA exemption from profile
    if (p.tva_exempt) setIsAutoEntrepreneur(true);
  }, [profile?.logo_url, profile?.artisan_signature_url, profile?.stamp_url, profile?.header_image_url]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // --- DRAFT RESTORE on mount (only if no prefillData) ---
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    if (prefillData || draftRestored) return;
    
    const restoreDraft = async () => {
      // Try cloud first if logged in, fallback to localStorage
      let draft = user ? await loadCloudDraft(documentType) : null;
      if (!draft) draft = loadDraft();
      
      if (draft) {
        setClientName(draft.clientName || '');
        setClientAddress(draft.clientAddress || '');
        setWorkSiteSameAsClient(draft.workSiteSameAsClient);
        setWorkSiteAddress(draft.workSiteAddress || '');
        setIncludeTravelCosts(draft.includeTravelCosts);
        setTravelDescription(draft.travelDescription || '');
        setTravelPrice(draft.travelPrice || 30);
        setIsAutoEntrepreneur(draft.isAutoEntrepreneur);
        setSelectedTvaRate(draft.selectedTvaRate || 10);
        setValidityDuration(draft.validityDuration || 30);
        setAcomptePercent(draft.acomptePercent ?? 30);
        setDelaiPaiement(draft.delaiPaiement || 'reception');
        setMoyenPaiement(draft.moyenPaiement || 'virement');
        if (draft.docNumber) setDocNumber(draft.docNumber);
        if (draft.items?.length) setItems(draft.items);
        // Restore new fields
        if (draft.clientSiren) setClientSiren(draft.clientSiren);
        if ((draft as any).clientPhone) setClientPhone((draft as any).clientPhone);
        if ((draft as any).clientEmail) setClientEmail((draft as any).clientEmail);
        if ((draft as any).clientTvaIntra) setClientTvaIntra((draft as any).clientTvaIntra);
        if ((draft as any).clientIsB2B) setClientIsB2B((draft as any).clientIsB2B);
        if (draft.natureOperation) setNatureOperation(draft.natureOperation);
        if (draft.assureurName) setAssureurName(draft.assureurName);
        if (draft.assureurAddress) setAssureurAddress(draft.assureurAddress);
        if (draft.policyNumber) setPolicyNumber(draft.policyNumber);
        if (draft.geographicCoverage) setGeographicCoverage(draft.geographicCoverage);
        toast({
          title: isRTL ? '📝 تم استعادة المسودة' : '📝 Brouillon restauré',
          description: isRTL ? 'رجعنالك الشغل اللي كنت بتعمله' : 'Votre travail précédent a été restauré',
        });
      }
      setDraftRestored(true);
    };
    
    restoreDraft();
  }, [prefillData, draftRestored, user, documentType]);

  // --- AUTO-SAVE draft on every change (debounced) ---
  useEffect(() => {
    if (!draftRestored) return;
    const timer = setTimeout(() => {
      saveDraft({
        documentType,
        clientName,
        clientAddress,
        clientPhone,
        clientEmail,
        clientSiren,
        clientTvaIntra,
        clientIsB2B,
        workSiteSameAsClient,
        workSiteAddress,
        includeTravelCosts,
        travelDescription,
        travelPrice,
        isAutoEntrepreneur,
        selectedTvaRate,
        validityDuration,
        acomptePercent,
        delaiPaiement,
        moyenPaiement,
        docNumber,
        items,
        natureOperation,
        assureurName,
        assureurAddress,
        policyNumber,
        geographicCoverage,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [draftRestored, documentType, clientName, clientAddress, clientPhone, clientEmail, clientSiren, clientTvaIntra, clientIsB2B, workSiteSameAsClient, workSiteAddress, includeTravelCosts, travelDescription, travelPrice, isAutoEntrepreneur, selectedTvaRate, validityDuration, acomptePercent, delaiPaiement, moyenPaiement, docNumber, items, natureOperation, assureurName, assureurAddress, policyNumber, geographicCoverage]);

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
      if (prefillData.clientPhone) {
        setClientPhone(prefillData.clientPhone);
      }
      if (prefillData.clientEmail) {
        setClientEmail(prefillData.clientEmail);
      }
      if (prefillData.clientSiren) {
        setClientSiren(prefillData.clientSiren);
      }
      if (prefillData.clientTvaIntra) {
        setClientTvaIntra(prefillData.clientTvaIntra);
      }
      if (prefillData.clientIsB2B) {
        setClientIsB2B(prefillData.clientIsB2B);
      }
      if (prefillData.workSiteAddress) {
        setWorkSiteAddress(prefillData.workSiteAddress);
        setWorkSiteSameAsClient(false);
      }
      if (prefillData.natureOperation) {
        setNatureOperation(prefillData.natureOperation as 'service' | 'goods' | 'mixed');
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
        title: isRTL 
          ? (prefillData.source === 'devis_conversion' ? '✅ تم نقل بيانات الدوفي!' : prefillData.source === 'devis_duplication' ? '✅ تم نسخ الدوفي!' : '✅ تم ملء البيانات!')
          : (prefillData.source === 'devis_conversion' ? '✅ Devis converti en facture!' : prefillData.source === 'devis_duplication' ? '✅ Devis dupliqué!' : '✅ Données pré-remplies!'),
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
      dueDate: documentType === 'facture'
        ? new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')
        : undefined,
      emitter: {
        name: profile?.company_name || 'Votre Entreprise',
        siret: profile?.siret || '',
        address: profile?.company_address || '',
        phone: profile?.phone || '',
        email: profile?.email || '',
        legalStatus: profile?.legal_status || undefined,
        iban: (profile as any)?.iban || undefined,
        bic: (profile as any)?.bic || undefined,
      },
      client: {
        name: clientName || 'Client',
        address: clientAddress || '',
        siren: clientSiren || undefined,
        phone: clientPhone || undefined,
        email: clientEmail || undefined,
        tvaIntra: clientTvaIntra || undefined,
        isB2B: clientIsB2B,
      },
      workSite: {
        sameAsClient: workSiteSameAsClient,
        address: workSiteSameAsClient ? undefined : workSiteAddress,
      },
      natureOperation,
      assuranceDecennale: assureurName ? {
        assureurName,
        assureurAddress,
        policyNumber,
        geographicCoverage,
      } : undefined,
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
      paymentTerms: (() => {
        const delaiLabel = delaiPaiement === 'reception' ? 'à réception de facture' : delaiPaiement === '30jours' ? 'à 30 jours' : 'fin de mois';
        const moyenLabel = moyenPaiement === 'virement' ? 'Virement' : moyenPaiement === 'cheque' ? 'Chèque' : 'Espèces';
        let text = '';
        if (acomptePercent > 0) {
          text += `Acompte de ${acomptePercent}% à la commande. Solde ${delaiLabel} par ${moyenLabel}.`;
        } else {
          text += `Paiement ${delaiLabel} par ${moyenLabel}.`;
        }
        text += ` En cas de retard : pénalités de 3 fois le taux légal + indemnité forfaitaire de 40€.`;
        return text;
      })(),
      legalMentions: tvaExempt 
        ? 'TVA non applicable, article 293 B du CGI'
        : undefined,
      // Inject signed URLs for artisan's permanent signature, stamp, and logo
      artisanSignatureUrl: signedUrls.artisanSignatureUrl || undefined,
      stampUrl: signedUrls.stampUrl || undefined,
      // Logo from profile (signed URL)
      logoUrl: signedUrls.logoUrl || undefined,
      // Auto-generate legal footer from profile fields
      legalFooter: (() => {
        if (!profile) return undefined;
        const p = profile;
        const parts: string[] = [];
        if (p.company_name) parts.push(p.company_name);
        const statusLabel = p.legal_status === 'auto-entrepreneur' ? 'Auto-entrepreneur' : (p.legal_status === 'societe' ? 'Société' : p.legal_status);
        if (statusLabel) parts.push(statusLabel);
        if (p.capital_social) parts.push(`au capital de ${p.capital_social}`);
        if (p.siret) parts.push(`SIRET : ${p.siret}`);
        if (p.code_naf) parts.push(`NAF : ${p.code_naf}`);
        if (p.ville_immatriculation) parts.push(`RCS ${p.ville_immatriculation}`);
        if (p.numero_tva) parts.push(`TVA : ${p.numero_tva}`);
        return parts.length > 1 ? parts.join(' - ') : (p.legal_footer || undefined);
      })(),
    };
  };
  
  const invoiceData = buildInvoiceData();
  
  // Check if form is valid
  const isFormValid = clientName.trim() && items.some(item => item.designation_fr.trim() && item.unitPrice > 0);
  
  // Handle item quantity/price change
  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    // Smart item split: if user pastes/types multi-task text in designation_fr
    if (field === 'designation_fr' && typeof value === 'string') {
      const parts = detectMultipleTasks(value);
      if (parts && parts.length >= 2) {
        setItems(prev => {
          const idx = prev.findIndex(i => i.id === id);
          if (idx === -1) return prev;
          const base = prev[idx];
          const newItems = parts.map((part, i) => ({
            ...base,
            id: i === 0 ? id : generateId(),
            designation_fr: part.charAt(0).toUpperCase() + part.slice(1),
            designation_ar: i === 0 ? base.designation_ar : '',
            quantity: i === 0 ? base.quantity : ('' as unknown as number),
            unitPrice: i === 0 ? base.unitPrice : ('' as unknown as number),
            total: i === 0 ? base.total : 0,
          }));
          const result = [...prev];
          result.splice(idx, 1, ...newItems);
          return result;
        });
        toast({
          title: isRTL ? '✂️ تم تقسيم البنود' : '✂️ Lignes séparées',
          description: isRTL 
            ? `تم تقسيم النص لـ ${parts.length} بنود منفصلة` 
            : `Le texte a été séparé en ${parts.length} lignes`,
        });
        return;
      }
    }

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

  // Save finalized document to documents_comptables
  const saveToDocumentsComptables = async () => {
    if (!user) return;
    const data = buildInvoiceData();
    try {
      const { error } = await (supabase.from('documents_comptables') as any).insert({
        user_id: user.id,
        document_type: documentType,
        document_number: data.number,
        client_name: data.client.name,
        client_address: data.client.address,
        work_site_address: data.workSite?.address || '',
        nature_operation: data.natureOperation || '',
        subtotal_ht: data.subtotal,
        tva_rate: data.tvaRate,
        tva_amount: data.tvaAmount,
        total_ttc: data.total,
        tva_exempt: data.tvaExempt,
        document_data: data,
        status: 'finalized',
      });
      if (error) throw error;
      toast({
        title: isRTL ? '✅ تم الحفظ' : '✅ Sauvegardé',
        description: isRTL ? 'المستند محفوظ في مستنداتك' : 'Document enregistré dans vos documents.',
      });
    } catch (e) {
      console.error('Save error:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'تعذر حفظ المستند' : 'Impossible de sauvegarder le document.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Help Banner */}
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl",
          "border-2 border-dashed transition-colors cursor-pointer",
          isRTL 
            ? "bg-red-600 border-red-700 hover:bg-red-700 flex-row-reverse font-cairo" 
            : "bg-green-600 border-green-700 hover:bg-green-700"
        )}
      >
        <HelpCircle className="h-5 w-5 text-white shrink-0" />
        <span className="text-sm font-black text-white">
          {documentType === 'facture'
            ? (isRTL ? 'عايز تعرف تعمل فاكتير ازاي؟ اضغط هنا 👈' : 'Besoin d\'aide pour créer votre facture ? Cliquez ici 👆')
            : (isRTL ? 'عايز تعرف تعمل ازاي الدوفي؟ اضغط هنا 👆' : 'Besoin d\'aide pour créer votre devis ? Cliquez ici 👆')}
        </span>
      </button>

      {/* Guide Modal */}
      {documentType === 'facture' ? (
        <FactureGuideModal open={showGuide} onOpenChange={setShowGuide} />
      ) : (
        <InvoiceGuideModal open={showGuide} onOpenChange={setShowGuide} />
      )}

      {/* Document Type Toggle */}
      <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
        {onDocumentTypeChange ? (
          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <span className={cn(
              "text-xs font-bold uppercase",
              documentType === 'devis' ? 'text-primary' : 'text-muted-foreground',
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'دوفي' : 'Devis'}
            </span>
            <Switch
              checked={documentType === 'facture'}
              onCheckedChange={(checked) => {
                const newType = checked ? 'facture' : 'devis';
                const currentPrefix = getDocPrefix(documentType);
                const newPrefix = getDocPrefix(newType);
                const userPart = docNumber.startsWith(currentPrefix) 
                  ? docNumber.slice(currentPrefix.length) 
                  : '';
                setDocNumber(newPrefix + userPart);
                onDocumentTypeChange(newType);
              }}
            />
            <span className={cn(
              "text-xs font-bold uppercase",
              documentType === 'facture' ? 'text-primary' : 'text-muted-foreground',
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'فاتورة' : 'Facture'}
            </span>
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* Invoice Due Date Selector - Only for Facture */}
      {documentType === 'facture' && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 space-y-3">
            <div className={cn(
              "flex items-center justify-between gap-4",
              isRTL && "flex-row-reverse"
            )}>
              <div className={cn(
                "flex items-center gap-2",
                isRTL && "flex-row-reverse"
              )}>
                <Calendar className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className={cn(
                  "font-bold text-red-700 dark:text-red-400 text-sm uppercase tracking-wide",
                  isRTL && "font-cairo"
                )}>
                  {isRTL ? 'أجل الدفع' : "Délai de paiement"}
                </span>
              </div>
              <select 
                value={dueDateDays} 
                onChange={(e) => setDueDateDays(parseInt(e.target.value) as 15 | 30 | 45 | 60)}
                className={cn(
                  "bg-background border border-border text-foreground text-xs font-bold rounded-lg focus:ring-primary focus:border-primary p-2 uppercase",
                  isRTL && "font-cairo"
                )}
              >
                <option value="15">{isRTL ? '15 يوم' : '15 Jours'}</option>
                <option value="30">{isRTL ? '30 يوم (موصى به)' : '30 Jours (Recommandé)'}</option>
                <option value="45">{isRTL ? '45 يوم' : '45 Jours'}</option>
                <option value="60">{isRTL ? '60 يوم' : '60 Jours'}</option>
              </select>
            </div>
            
            <p className={cn(
              "text-[10px] text-red-600/80 dark:text-red-400/80 leading-tight",
              isRTL && "text-right font-cairo"
            )}>
              {isRTL 
                ? '💡 نصيحة: 30 يوم هو الحد الأقصى القانوني الافتراضي. يمكن تمديده إلى 45 أو 60 يومًا بالاتفاق.'
                : '💡 Conseil : 30 jours est le délai légal par défaut. Peut être étendu à 45 ou 60 jours par accord contractuel.'
              }
            </p>
            
            <div className={cn(
              "pt-2 border-t border-red-500/10 flex justify-between text-[10px] font-bold text-muted-foreground",
              isRTL && "flex-row-reverse font-cairo"
            )}>
              <span>{isRTL ? `صادرة في : ${new Date().toLocaleDateString('fr-FR')}` : `Émise le : ${new Date().toLocaleDateString('fr-FR')}`}</span>
              <span className="text-destructive">
                {isRTL 
                  ? `أجل الدفع : ${new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}`
                  : `Échéance : ${new Date(Date.now() + dueDateDays * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}`
                }
              </span>
            </div>
          </CardContent>
        </Card>
      )}

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
              ? 'الرقم بيتحط تلقائي. تقدر تعدّله لو عايز.'
              : "Le numéro est généré automatiquement (compteur indépendant par type). Vous pouvez le modifier."}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className={cn("text-xs", isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'تليفون الزبون' : 'Téléphone'}
                </Label>
                <Input
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className={cn("text-sm", isRTL && "text-right font-cairo")}
                />
              </div>
              <div className="space-y-2">
                <Label className={cn("text-xs", isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'إيميل الزبون' : 'Email'}
                </Label>
                <Input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@email.com"
                  type="email"
                  className={cn("text-sm", isRTL && "text-right font-cairo")}
                />
              </div>
            </div>

            {/* B2B Toggle */}
            <div className={cn("flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30", isRTL && "flex-row-reverse")}>
              <Checkbox
                id="b2b-toggle"
                checked={clientIsB2B}
                onCheckedChange={(checked) => setClientIsB2B(checked === true)}
              />
              <Label htmlFor="b2b-toggle" className={cn("text-sm cursor-pointer", isRTL && "font-cairo")}>
                {isRTL ? '🏢 الزبون ده شركة (B2B)' : '🏢 Client professionnel (B2B)'}
              </Label>
            </div>
            
            {clientIsB2B && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label className={cn("text-xs", isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'رقم SIRET الزبون' : 'SIRET du client'} *
                  </Label>
                  <Input
                    value={clientSiren}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 14);
                      setClientSiren(val);
                    }}
                    placeholder={isRTL ? '14 رقم (إجباري B2B)' : '14 chiffres (obligatoire B2B)'}
                    className={cn("font-mono text-sm", isRTL && "text-right")}
                    maxLength={14}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={cn("text-xs", isRTL && "font-cairo text-right block")}>
                    {isRTL ? 'رقم TVA Intracommunautaire' : 'N° TVA Intracommunautaire'}
                  </Label>
                  <Input
                    value={clientTvaIntra}
                    onChange={(e) => setClientTvaIntra(e.target.value)}
                    placeholder="FR 12 345678901"
                    className={cn("font-mono text-sm", isRTL && "text-right")}
                  />
                </div>
              </div>
            )}

            {!clientIsB2B && (
              <div className="space-y-2">
                <Label className={cn("text-xs", isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'رقم السجل التجاري (SIREN) للزبون' : 'SIREN du client'}
                </Label>
                <Input
                  value={clientSiren}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setClientSiren(val);
                  }}
                  placeholder={isRTL ? '9 أرقام (اختياري)' : '9 chiffres (optionnel)'}
                  className={cn("font-mono text-sm", isRTL && "text-right")}
                  maxLength={9}
                />
                <p className={cn("text-[10px] text-muted-foreground", isRTL && "font-cairo text-right")}>
                  {isRTL ? '💡 مطلوب للفاتورة الإلكترونية (Factur-X) 2026' : '💡 Requis pour la facturation électronique 2026'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Nature of Operation */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <FileText className="h-5 w-5 text-primary" />
            <h3 className={cn("font-bold", isRTL && "font-cairo")}>
              {isRTL ? '📦 طبيعة العملية' : '📦 Nature de l\'opération'}
            </h3>
          </div>
          <select
            value={natureOperation}
            onChange={(e) => setNatureOperation(e.target.value as 'service' | 'goods' | 'mixed')}
            className="w-full bg-background border border-border text-foreground text-sm rounded-md focus:ring-primary focus:border-primary p-2"
          >
            <option value="service">{isRTL ? 'مصنعية فقط (Services)' : 'Prestation de services'}</option>
            <option value="goods">{isRTL ? 'بيع مواد فقط (Matériaux)' : 'Livraison de biens'}</option>
            <option value="mixed">{isRTL ? 'مختلط: مواد ومصنعية (Mixte)' : 'Mixte (services + biens)'}</option>
          </select>
        </CardContent>
      </Card>

      {/* Assurance Décennale (BTP) */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4 space-y-4">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <HardHat className="h-5 w-5 text-blue-600" />
            <h3 className={cn("font-bold text-blue-700 dark:text-blue-400", isRTL && "font-cairo")}>
              {isRTL ? '🛡️ التأمين العشري (Décennale)' : '🛡️ Assurance Décennale'}
            </h3>
          </div>
          <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-cairo")}>
            {isRTL 
              ? '⚖️ إجباري في قطاع البناء (BTP). لازم يظهر على كل دوفي وفاكتير.'
              : '⚖️ Obligatoire dans le BTP. Doit figurer sur chaque devis et facture.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={cn("text-xs", isRTL && "font-cairo")}>
                {isRTL ? 'اسم شركة التأمين' : 'Nom de l\'assureur'}
              </Label>
              <Input
                value={assureurName}
                onChange={(e) => setAssureurName(e.target.value)}
                placeholder={isRTL ? 'مثال: AXA France' : 'Ex: AXA France'}
                className={cn("text-sm", isRTL && "text-right font-cairo")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={cn("text-xs", isRTL && "font-cairo")}>
                {isRTL ? 'عنوان شركة التأمين' : 'Adresse de l\'assureur'}
              </Label>
              <Input
                value={assureurAddress}
                onChange={(e) => setAssureurAddress(e.target.value)}
                placeholder={isRTL ? 'عنوان المقر' : 'Ex: 25 av. Matignon, 75008 Paris'}
                className={cn("text-sm", isRTL && "text-right font-cairo")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={cn("text-xs", isRTL && "font-cairo")}>
                {isRTL ? 'رقم البوليصة' : 'N° de police'}
              </Label>
              <Input
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                placeholder={isRTL ? 'رقم العقد' : 'Ex: RC-2024-123456'}
                className={cn("text-sm font-mono", isRTL && "text-right")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={cn("text-xs", isRTL && "font-cairo")}>
                {isRTL ? 'التغطية الجغرافية' : 'Couverture géographique'}
              </Label>
              <Input
                value={geographicCoverage}
                onChange={(e) => setGeographicCoverage(e.target.value)}
                placeholder="France métropolitaine"
                className={cn("text-sm", isRTL && "text-right font-cairo")}
              />
            </div>
          </div>
        </CardContent>
      </Card>
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
                    <div className="flex items-center gap-1">
                      <Label className={cn("text-xs", isRTL && "font-cairo")}>
                        {isRTL ? 'الوحدة' : 'Unité'}
                      </Label>
                      {index === 0 && <UnitGuideButton onClick={() => setShowUnitGuide(true)} />}
                    </div>
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
          
          {/* Payment Terms - Conditions de Règlement */}
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 space-y-4">
              {/* Pedagogical Alert */}
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
                <p className={cn("font-bold text-amber-800 dark:text-amber-300 text-sm mb-1", isRTL && "text-right font-cairo")}>
                  {isRTL ? '⚖️ احمي حقك / Protégez vos droits' : '⚖️ Protégez vos droits / احمي حقك'}
                </p>
                <p className={cn("text-xs text-amber-700 dark:text-amber-400", isRTL && "text-right font-cairo")}>
                  {isRTL 
                    ? 'البيانات دي إجبارية. من غيرها مش هتقدر تطالب بحقك لو العميل اتأخر في الدفع.'
                    : 'Ces mentions sont obligatoires. Sans elles, vous ne pourrez pas réclamer de pénalités en cas de retard de paiement.'}
                </p>
              </div>

              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <span className="text-xl">💳</span>
                <h4 className={cn("font-bold text-amber-700 dark:text-amber-400", isRTL && "font-cairo")}>
                  {isRTL ? 'شروط الدفع' : 'Conditions de règlement'}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Acompte */}
                <div className="space-y-1.5">
                  <Label className={cn("text-xs", isRTL && "font-cairo")}>
                    {isRTL ? 'المقدم (%)' : 'Acompte (%)'}
                  </Label>
                  <select
                    value={acomptePercent}
                    onChange={(e) => setAcomptePercent(parseInt(e.target.value))}
                    className="w-full bg-background border border-border text-foreground text-sm rounded-md focus:ring-primary focus:border-primary p-2"
                  >
                    <option value="0">0% - {isRTL ? 'بدون مقدم' : 'Sans acompte'}</option>
                    <option value="30">30%</option>
                    <option value="40">40%</option>
                    <option value="50">50%</option>
                  </select>
                </div>

                {/* Délai */}
                <div className="space-y-1.5">
                  <Label className={cn("text-xs", isRTL && "font-cairo")}>
                    {isRTL ? 'مهلة الدفع' : 'Délai de paiement'}
                  </Label>
                  <select
                    value={delaiPaiement}
                    onChange={(e) => setDelaiPaiement(e.target.value)}
                    className="w-full bg-background border border-border text-foreground text-sm rounded-md focus:ring-primary focus:border-primary p-2"
                  >
                    <option value="reception">{isRTL ? 'عند الاستلام' : 'À réception'}</option>
                    <option value="30jours">{isRTL ? '30 يوم' : '30 jours'}</option>
                    <option value="finmois">{isRTL ? 'آخر الشهر' : 'Fin de mois'}</option>
                  </select>
                </div>

                {/* Moyen */}
                <div className="space-y-1.5">
                  <Label className={cn("text-xs", isRTL && "font-cairo")}>
                    {isRTL ? 'طريقة الدفع' : 'Moyen de paiement'}
                  </Label>
                  <select
                    value={moyenPaiement}
                    onChange={(e) => setMoyenPaiement(e.target.value)}
                    className="w-full bg-background border border-border text-foreground text-sm rounded-md focus:ring-primary focus:border-primary p-2"
                  >
                    <option value="virement">{isRTL ? 'تحويل بنكي' : 'Virement'}</option>
                    <option value="cheque">{isRTL ? 'شيك' : 'Chèque'}</option>
                    <option value="especes">{isRTL ? 'كاش' : 'Espèces'}</option>
                  </select>
                </div>
              </div>

              {/* Preview of generated text */}
              <div className="p-2 rounded bg-muted/50 border border-border">
                <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                  📄 {invoiceData.paymentTerms}
                </p>
              </div>
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
              
              {/* Helper text */}
              <p className={cn(
                "text-xs text-muted-foreground",
                isRTL && "font-cairo text-right"
              )}>
                {isRTL 
                  ? 'لـ أوتو-أونتربرينير (Auto-entrepreneur)، الضريبة 0% تلقائياً. لغير ذلك، اختر النسبة المناسبة للمشروع:' 
                  : 'Si vous êtes Auto-entrepreneur, la TVA est de 0% (Franchise en base). Sinon, choisissez le taux applicable :'}
              </p>

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
            isPaid={false}
          />

          <ProtectedDocumentWrapper
            documentType={prefillData?.source === 'smart_devis' ? 'smart_devis' : documentType}
            returnPath={`/pro/invoice-creator?type=${documentType}`}
          >
            <div ref={invoiceRef} className="print-area">
              <InvoiceDisplay 
                data={invoiceData} 
                showArabic={showArabic} 
              />
            </div>
          </ProtectedDocumentWrapper>
        </div>
      ) : (
        <div className={cn(
          "flex gap-3 flex-wrap",
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
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!confirm(isRTL ? 'هل أنت متأكد؟ سيتم حذف جميع البيانات المدخلة.' : 'Réinitialiser le formulaire ? Toutes les données saisies seront perdues.')) return;
              clearDraft();
              setClientName('');
              setClientAddress('');
              setClientPhone('');
              setClientEmail('');
              setClientSiren('');
              setClientTvaIntra('');
              setClientIsB2B(false);
              setWorkSiteSameAsClient(true);
              setWorkSiteAddress('');
              setIncludeTravelCosts(false);
              setTravelDescription('');
              setTravelPrice(30);
              setIsAutoEntrepreneur(false);
              setSelectedTvaRate(10);
              setValidityDuration(30);
              setAcomptePercent(30);
              setDelaiPaiement('reception');
              setMoyenPaiement('virement');
              setDocNumber(generateDocNumber(documentType));
              setNatureOperation('service');
              setAssureurName('');
              setAssureurAddress('');
              setPolicyNumber('');
              setGeographicCoverage('France métropolitaine');
              setItems([{
                id: generateId(),
                designation_fr: '',
                designation_ar: '',
                quantity: '' as unknown as number,
                unit: 'm²',
                unitPrice: '' as unknown as number,
                total: 0,
              }]);
              setShowPreview(false);
              toast({
                title: isRTL ? '🗑️ تم إعادة التعيين' : '🗑️ Formulaire réinitialisé',
              });
            }}
            className={cn("text-destructive hover:text-destructive", isRTL && "font-cairo")}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {isRTL ? 'مسح الكل' : 'Réinitialiser'}
          </Button>
          
          <Button
            onClick={async () => {
              const ok = await ensureTranslations();
              if (!ok) return;

              // Comprehensive validation with detailed feedback
              const missingFields: string[] = [];
              
              // Check emitter SIRET (mandatory for legal invoices)
              if (!profile?.siret || profile.siret.replace(/\s/g, '').length !== 14) {
                missingFields.push('__SIRET_ERROR__');
              }

              // Check client name
              if (!clientName.trim()) {
                missingFields.push(isRTL ? '👤 اسم الزبون' : '👤 Nom du client');
              }
              
              // Check client address
              if (!clientAddress.trim()) {
                missingFields.push(isRTL ? '📍 عنوان الفاكتير' : '📍 Adresse de facturation');
              }

              // Check B2B client SIRET
              if (clientIsB2B && (!clientSiren || clientSiren.replace(/\s/g, '').length < 9)) {
                missingFields.push(isRTL ? '🏢 SIRET الزبون (إجباري B2B)' : '🏢 SIRET du client (obligatoire en B2B)');
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
                          <li key={idx} className="text-destructive-foreground">
                            {field === '__SIRET_ERROR__' ? (
                              <button
                                onClick={() => navigate('/pro/settings')}
                                className="underline font-semibold hover:opacity-80 text-left"
                              >
                                {isRTL ? '🏢 رقم SIRET بتاعك (14 رقم) — اضغط هنا للتعديل' : '🏢 Votre SIRET (14 chiffres) — Modifier dans Mon Entreprise →'}
                              </button>
                            ) : field}
                          </li>
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
          clearDraft();
          saveToDocumentsComptables();
        }}
        items={items}
      />
      
      {/* Unit Guide Modal */}
      <UnitGuideModal
        open={showUnitGuide}
        onOpenChange={setShowUnitGuide}
      />
    </div>
  );
};

export default InvoiceFormBuilder;
