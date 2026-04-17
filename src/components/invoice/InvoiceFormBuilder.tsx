import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile, Profile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Plus, Trash2, FileText, Building2, User, MapPin, HardHat, Edit3, Truck, Wand2, Loader2, Calendar, HelpCircle, RotateCcw, Users, Save, Languages, SlidersHorizontal, ChevronDown, ChevronUp, Check, CreditCard, BarChart3, Shield, Receipt } from 'lucide-react';
import { buildMilestoneInvoicePrefill } from '@/lib/milestoneInvoicePrefill';
import { milestoneLabelToArabic, arabicToFrenchDisplay } from '@/lib/milestoneLabelTranslation';
import FormProgressBar, { type ProgressSection } from './FormProgressBar';
import StepNavigation, { StepButtons, type WizardStep } from './StepNavigation';
import InvoiceDisplay, { InvoiceData, PaymentMilestone } from './InvoiceDisplay';
import InvoiceActions from './InvoiceActions';
import LineItemEditor, { LineItem } from './LineItemEditor';
import QuoteWizardModal from './QuoteWizardModal';
import InvoiceGuideModal from './InvoiceGuideModal';
import FactureGuideModal from './FactureGuideModal';

import PreFlightChecklistModal from './PreFlightChecklistModal';
import PreGenerationChecklist, { runChecks, type PreGenCheckInput } from './PreGenerationChecklist';
import ValidationChecklist, { type ValidationInput } from './ValidationChecklist';
import UnitGuideModal, { UnitGuideButton } from './UnitGuideModal';
import { supabase } from '@/integrations/supabase/client';
import { saveDraft, loadDraft, clearDraft, loadCloudDraft, saveCurrentDocument, loadCurrentDocument, clearCurrentDocument, type CurrentDocumentState } from '@/lib/invoiceDraftStorage';
import { detectMultipleTasks } from '@/lib/smartItemSplit';
import { formatObjet, containsArabic } from '@/lib/objetFormatter';
import { validateDocument } from '@/lib/documentValidator';
import { calculateInvoiceTotals, validateInvoiceTotalsConsistency } from '@/lib/invoiceTotals';
import { isOfficialDocumentNumber, reserveOfficialDocumentNumber } from '@/lib/documentNumbers';
import { generateOfficialPdfBlob } from '@/lib/invoicePdf';
import { waitForLayout } from '@/lib/pdfEngine';
import { useAuth } from '@/hooks/useAuth';
import type { VoiceResult } from '@/hooks/useFieldVoice';
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
  selectedClientId?: string;
  selectedChantierId?: string;
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
  sourceDocumentId?: string;
  sourceDocumentNumber?: string;
  reservedDocumentNumber?: string;
  sitePhotos?: Array<{ data: string; name: string }>;
  descriptionChantier?: string;
  milestoneId?: string;
  milestoneIndex?: number;
  milestoneLabel?: string;
  // Advanced fields — TVA, payment, schedule, dates
  isAutoEntrepreneur?: boolean;
  selectedTvaRate?: 5.5 | 10 | 20;
  projectTvaType?: 'logement_ancien' | 'logement_neuf' | 'local_pro' | 'sous_traitance' | 'intracommunautaire';
  delaiPaiement?: string;
  moyenPaiement?: string;
  acompteEnabled?: boolean;
  acomptePercent?: number;
  acompteMode?: 'percent' | 'fixed';
  acompteFixedAmount?: number;
  milestonesEnabled?: boolean;
  paymentMilestones?: PaymentMilestone[];
  discountEnabled?: boolean;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  estimatedStartDate?: string;
  estimatedDuration?: string;
  validityDuration?: 15 | 30 | 60 | 90;
  acompteLabel?: string;
}

interface InvoiceFormBuilderProps {
  documentType: 'devis' | 'facture';
  onBack: () => void;
  prefillData?: PrefillData | null;
  onDocumentTypeChange?: (type: 'devis' | 'facture') => void;
  skipDraftRestore?: boolean;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Generate document number prefix - always uses current calendar year
const getDocPrefix = (type: 'devis' | 'facture'): string => {
  const prefix = type === 'devis' ? 'D' : 'F';
  const year = new Date().getFullYear();
  return `${prefix}-${year}-`;
};

const InvoiceFormBuilder = ({ documentType, onBack, prefillData, onDocumentTypeChange, skipDraftRestore }: InvoiceFormBuilderProps) => {
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const SAFETY_BLOCK_MESSAGE = 'Erreur de calcul – document bloqué pour sécurité';
  
  // Ref to track if prefill has been applied (prevents double-application)
  const prefillAppliedRef = useRef(false);

  // Form state — initialize directly from prefillData to avoid effect race conditions
  const isImageQuotePrefill = prefillData?.source === 'image_quote_to_invoice';
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedChantierId, setSelectedChantierId] = useState('');
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string; client_type: string; company_name: string | null; address: string | null; street: string | null; postal_code: string | null; city: string | null; contact_phone: string | null; contact_email: string | null; siret: string | null; is_b2b: boolean; tva_number: string | null }>>([]);
  const [chantiersList, setChantiersList] = useState<Array<{ id: string; name: string; site_address: string | null }>>([]);
  
  const [clientName, setClientName] = useState(isImageQuotePrefill ? (prefillData?.clientName || '') : '');
  const [clientAddress, setClientAddress] = useState(isImageQuotePrefill ? (prefillData?.clientAddress || '') : '');
  const [clientPhone, setClientPhone] = useState(isImageQuotePrefill ? (prefillData?.clientPhone || '') : '');
  const [clientEmail, setClientEmail] = useState(isImageQuotePrefill ? (prefillData?.clientEmail || '') : '');
  const [clientSiren, setClientSiren] = useState('');
  const [clientTvaIntra, setClientTvaIntra] = useState('');
  const [clientIsB2B, setClientIsB2B] = useState(false);
  const [workSiteSameAsClient, setWorkSiteSameAsClient] = useState(true);
  const [workSiteAddress, setWorkSiteAddress] = useState('');
  
  // Nature of operation
  const [natureOperation, setNatureOperation] = useState<'service' | 'goods' | 'mixed'>('service');
  
  // Description du chantier / objet du devis
  const [descriptionChantier, setDescriptionChantier] = useState(isImageQuotePrefill ? (prefillData?.descriptionChantier || '') : '');
  const [descriptionChantierAr, setDescriptionChantierAr] = useState('');
  const [descriptionChantierFr, setDescriptionChantierFr] = useState('');
  const [isTranslatingObjet, setIsTranslatingObjet] = useState(false);
  // Estimated start date and duration
  const [estimatedStartDate, setEstimatedStartDate] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  
  // Assurance décennale
  const [assureurName, setAssureurName] = useState('');
  const [assureurAddress, setAssureurAddress] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [geographicCoverage, setGeographicCoverage] = useState('France métropolitaine');
  // Travel costs state
  const [includeTravelCosts, setIncludeTravelCosts] = useState(false);
  const [travelDescription, setTravelDescription] = useState('');
  const [travelPrice, setTravelPrice] = useState(30);
  // REP / Waste management state
  const [includeWasteCosts, setIncludeWasteCosts] = useState(false);
  const [wasteDescription, setWasteDescription] = useState('');
  const [wastePrice, setWastePrice] = useState(0);
  
  // TVA state - Auto-entrepreneur franchise de TVA
  const [isAutoEntrepreneur, setIsAutoEntrepreneur] = useState(false);
  const [selectedTvaRate, setSelectedTvaRate] = useState<5.5 | 10 | 20>(10);
  // Project type for automatic TVA calculation (non auto-entrepreneur)
  const [projectTvaType, setProjectTvaType] = useState<'logement_ancien' | 'logement_neuf' | 'local_pro' | 'sous_traitance' | 'intracommunautaire'>('logement_ancien');
  
  // Quote validity duration (in days) - default 30 days
  const [validityDuration, setValidityDuration] = useState<15 | 30 | 60 | 90>(30);
  
  // Invoice due date duration (in days) - default 30 days
  const [dueDateDays, setDueDateDays] = useState<15 | 30 | 45 | 60>(30);
  
  // Payment terms state
  const [acompteEnabled, setAcompteEnabled] = useState(false);
  const [acomptePercent, setAcomptePercent] = useState<number>(30);
  const [acompteMode, setAcompteMode] = useState<'percent' | 'fixed'>('percent');
  const [acompteFixedAmount, setAcompteFixedAmount] = useState<number>(0);
  const [delaiPaiement, setDelaiPaiement] = useState<string>('30jours');
  const [moyenPaiement, setMoyenPaiement] = useState<string>('virement');
  
  // Payment milestones (échéancier)
  const [paymentMilestones, setPaymentMilestones] = useState<PaymentMilestone[]>([]);
  const [milestonesEnabled, setMilestonesEnabled] = useState(false);
  
  // Discount state
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  
  // Line items — initialize from prefillData if available (image-quote flow)
  const [items, setItems] = useState<LineItem[]>(() => {
    if (isImageQuotePrefill && prefillData?.items && prefillData.items.length > 0) {
      console.log('[InvoiceFormBuilder] ✅ Initializing items from prefillData:', prefillData.items.length, 'items');
      prefillAppliedRef.current = true;
      return prefillData.items.map((item) => ({
        id: generateId(),
        designation_fr: item.designation_fr || '',
        designation_ar: item.designation_ar || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'U',
        unitPrice: item.unitPrice || 0,
        total: (item.quantity || 1) * (item.unitPrice || 0),
      }));
    }
    return [{
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: '' as unknown as number,
      unit: 'm²',
      unitPrice: '' as unknown as number,
      total: 0,
    }];
  });
  
  // Track temporary string values for quantity and price inputs
  const [tempValues, setTempValues] = useState<Record<string, { quantity?: string; unitPrice?: string }>>({});
  
  // Invoice preview state
  const [showPreview, setShowPreview] = useState(false);
  const [showArabic, setShowArabic] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  
  // Editable document number:
  // - For devis: fetch immediately (devis numbers are less critical legally)
  // - For factures: use placeholder until finalization (French legal compliance)
  const [docNumber, setDocNumber] = useState(() => {
    if (documentType === 'facture' && isOfficialDocumentNumber(prefillData?.reservedDocumentNumber, 'facture')) {
      return prefillData.reservedDocumentNumber;
    }

    return `${getDocPrefix(documentType)}AUTO`;
  });
  const [docNumberLoading, setDocNumberLoading] = useState(false);
  
  // Quote Wizard state
  const [showWizard, setShowWizard] = useState(false);
  
  // Pre-flight checklist state
  const [showChecklist, setShowChecklist] = useState(false);
  
  // Unit Guide state
  const [showUnitGuide, setShowUnitGuide] = useState(false);
  const [unitGuideTargetItemId, setUnitGuideTargetItemId] = useState<string | null>(null);
  
  // Guide modal state
  const [showGuide, setShowGuide] = useState(false);

  // Site photos from Smart Devis
  const [sitePhotos, setSitePhotos] = useState<Array<{ data: string; name: string }>>([]);
  // Whether to include photos in the final PDF (user choice)
  const [includePhotosInPdf, setIncludePhotosInPdf] = useState(false);

  // Translation state
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [typingArabicIds, setTypingArabicIds] = useState<Set<string>>(new Set());
  const [translationAttemptIds, setTranslationAttemptIds] = useState<Set<string>>(new Set());
  const arabicDebounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const lastTranslatedSourceRef = useRef<Record<string, string | undefined>>({});
  const itemsRef = useRef(items);
  const [savingDraft, setSavingDraft] = useState(false);
  const [isSavingOfficialDocument, setIsSavingOfficialDocument] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentStep, setCurrentStep] = useState(() => {
    if (prefillData || skipDraftRestore) return 0;
    return loadCurrentDocument(documentType)?.currentStep ?? 0;
  });

  const saveCurrentDraftSnapshot = useCallback(() => {
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
      includeWasteCosts,
      wasteDescription,
      wastePrice,
      isAutoEntrepreneur,
      selectedTvaRate,
      validityDuration,
      acompteEnabled,
      acomptePercent,
      acompteMode,
      acompteFixedAmount,
      delaiPaiement,
      moyenPaiement,
      docNumber,
      items,
      natureOperation,
      assureurName,
      assureurAddress,
      policyNumber,
      geographicCoverage,
      paymentMilestones: milestonesEnabled ? paymentMilestones : undefined,
      descriptionChantier,
      descriptionChantierAr,
      descriptionChantierFr,
      estimatedStartDate,
      estimatedDuration,
      discountEnabled,
      discountType,
      discountValue,
      currentStep,
    });
  }, [documentType, clientName, clientAddress, clientPhone, clientEmail, clientSiren, clientTvaIntra, clientIsB2B, workSiteSameAsClient, workSiteAddress, includeTravelCosts, travelDescription, travelPrice, includeWasteCosts, wasteDescription, wastePrice, isAutoEntrepreneur, selectedTvaRate, validityDuration, acompteEnabled, acomptePercent, acompteMode, acompteFixedAmount, delaiPaiement, moyenPaiement, docNumber, items, natureOperation, assureurName, assureurAddress, policyNumber, geographicCoverage, paymentMilestones, milestonesEnabled, descriptionChantier, descriptionChantierAr, descriptionChantierFr, estimatedStartDate, estimatedDuration, discountEnabled, discountType, discountValue, currentStep]);

  // Fetch clients list
  useEffect(() => {
    if (!user) return;
    supabase.from('clients').select('id, name, client_type, company_name, address, street, postal_code, city, contact_phone, contact_email, siret, is_b2b, tva_number')
      .eq('user_id', user.id).order('name').then(({ data }) => {
        setClientsList((data as any) || []);
      });
  }, [user]);

  // Fetch chantiers based on selected client
  useEffect(() => {
    if (!user || !selectedClientId) { setChantiersList([]); return; }
    supabase.from('chantiers').select('id, name, site_address')
      .eq('user_id', user.id).eq('client_id', selectedClientId).order('name').then(({ data }) => {
        setChantiersList(data || []);
      });
  }, [user, selectedClientId]);

  // Auto-fill client info when selected
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedChantierId('');
    const client = clientsList.find(c => c.id === clientId);
    if (client) {
      // Use company_name for B2B, else regular name
      setClientName(client.client_type === 'professionnel' && client.company_name ? client.company_name : client.name);
      // Build full address from split fields or fallback to legacy address
      const fullAddress = client.street 
        ? [client.street, client.postal_code, client.city].filter(Boolean).join(', ')
        : (client.address || '');
      setClientAddress(fullAddress);
      setClientPhone(client.contact_phone || '');
      setClientEmail(client.contact_email || '');
      setClientSiren(client.siret || '');
      setClientIsB2B(client.is_b2b || client.client_type === 'professionnel');
      setClientTvaIntra(client.tva_number || '');
    }
  };

  // Save B2B info back to client record
  const saveB2BToClient = async () => {
    if (!selectedClientId || !user) return;
    const { error } = await supabase.from('clients').update({
      is_b2b: clientIsB2B,
      client_type: clientIsB2B ? 'professionnel' : 'particulier',
      siret: clientSiren || null,
      tva_number: clientTvaIntra || null,
    } as any).eq('id', selectedClientId);
    if (!error) {
      toast({ title: isRTL ? 'تم حفظ بيانات الزبون ✓' : 'Infos client mises à jour ✓' });
      supabase.from('clients').select('id, name, client_type, company_name, address, street, postal_code, city, contact_phone, contact_email, siret, is_b2b, tva_number')
        .eq('user_id', user.id).order('name').then(({ data }) => {
          setClientsList((data as any) || []);
        });
    }
  };

  // Auto-fill work site when chantier selected
  const handleChantierSelect = (chantierId: string) => {
    setSelectedChantierId(chantierId);
    const chantier = chantiersList.find(c => c.id === chantierId);
    if (chantier?.site_address) {
      setWorkSiteAddress(chantier.site_address);
      setWorkSiteSameAsClient(false);
    }
  };

  const [signedUrls, setSignedUrls] = useState<{
    logoUrl: string | null;
    artisanSignatureUrl: string | null;
    stampUrl: string | null;
    headerImageUrl: string | null;
  }>({ logoUrl: null, artisanSignatureUrl: null, stampUrl: null, headerImageUrl: null });

  const refreshSignedUrls = useCallback(async () => {
    if (!profile) return null;

    try {
      const resolved = await resolveAssetUrls({
        logoUrl: profile.logo_url,
        artisanSignatureUrl: profile.artisan_signature_url,
        stampUrl: profile.stamp_url,
        headerImageUrl: profile.header_image_url,
      });
      setSignedUrls(resolved);
      return resolved;
    } catch (err) {
      console.warn('Failed to resolve asset URLs:', err);
      return null;
    }
  }, [profile]);

  const getFreshSignedUrls = useCallback(async () => {
    const resolvedAssets = await refreshSignedUrls();
    if (resolvedAssets) {
      await waitForLayout(150);
    }
    persistCurrentDocumentState({ showPreview: true });
    return resolvedAssets;
  }, [refreshSignedUrls]);

  const prepareFreshAssetsForExport = useCallback(async () => {
    await getFreshSignedUrls();
  }, [getFreshSignedUrls]);

  useEffect(() => {
    if (!profile) return;
    refreshSignedUrls();
    
    // Auto-populate assurance décennale from profile
    const p = profile as any;
    if (p.assureur_name && !assureurName) setAssureurName(p.assureur_name);
    if (p.assureur_address && !assureurAddress) setAssureurAddress(p.assureur_address);
    if (p.assurance_policy_number && !policyNumber) setPolicyNumber(p.assurance_policy_number);
    if (p.assurance_geographic_coverage && !geographicCoverage) setGeographicCoverage(p.assurance_geographic_coverage);
    // Auto-set TVA exemption from profile (auto-entrepreneur or tva_exempt flag)
    // ALWAYS re-evaluate on legal_status change (e.g. user switched from AE to SARL)
    const isAE = p.tva_exempt || p.legal_status === 'auto-entrepreneur';
    setIsAutoEntrepreneur(isAE);
  }, [refreshSignedUrls, profile?.logo_url, profile?.artisan_signature_url, profile?.stamp_url, profile?.header_image_url, profile?.legal_status, profile?.tva_exempt]);

  useEffect(() => {
    if (!showPreview) return;
    refreshSignedUrls();
  }, [showPreview, refreshSignedUrls]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // --- DRAFT RESTORE on mount (only if no prefillData) ---
  // CRITICAL: When prefillData exists (e.g. Smart Devis), SKIP draft restore entirely.
  // This prevents stale ghost data (old drafts) from overwriting fresh analysis results.
  const [draftRestored, setDraftRestored] = useState(false);
  const restorePersistedDocument = useCallback((draft: Partial<CurrentDocumentState>) => {
    if (draft.selectedClientId !== undefined) setSelectedClientId(draft.selectedClientId);
    if (draft.selectedChantierId !== undefined) setSelectedChantierId(draft.selectedChantierId);
    if (draft.clientName !== undefined) setClientName(draft.clientName);
    if (draft.clientAddress !== undefined) setClientAddress(draft.clientAddress);
    if (draft.clientPhone !== undefined) setClientPhone(draft.clientPhone);
    if (draft.clientEmail !== undefined) setClientEmail(draft.clientEmail);
    if (draft.clientSiren !== undefined) setClientSiren(draft.clientSiren);
    if (draft.clientTvaIntra !== undefined) setClientTvaIntra(draft.clientTvaIntra);
    if (draft.clientIsB2B !== undefined) setClientIsB2B(draft.clientIsB2B);
    if (draft.workSiteSameAsClient !== undefined) setWorkSiteSameAsClient(draft.workSiteSameAsClient);
    if (draft.workSiteAddress !== undefined) setWorkSiteAddress(draft.workSiteAddress || '');
    if (draft.includeTravelCosts !== undefined) setIncludeTravelCosts(draft.includeTravelCosts);
    if (draft.travelDescription !== undefined) setTravelDescription(draft.travelDescription || '');
    if (draft.travelPrice !== undefined) setTravelPrice(draft.travelPrice || 30);
    if (draft.includeWasteCosts !== undefined) setIncludeWasteCosts(draft.includeWasteCosts);
    if (draft.wasteDescription !== undefined) setWasteDescription(draft.wasteDescription || '');
    if (draft.wastePrice !== undefined) setWastePrice(draft.wastePrice || 0);
    if (draft.selectedTvaRate !== undefined) setSelectedTvaRate(draft.selectedTvaRate || 10);
    if (draft.projectTvaType !== undefined) {
      // Migrate legacy 'logement' value to 'logement_ancien'
      const mappedType = draft.projectTvaType === 'logement' ? 'logement_ancien' : draft.projectTvaType;
      setProjectTvaType(mappedType as any);
    }
    if (draft.validityDuration !== undefined) setValidityDuration(draft.validityDuration || 30);
    if (draft.dueDateDays !== undefined) setDueDateDays(draft.dueDateDays);
    if (draft.acompteEnabled !== undefined) setAcompteEnabled(draft.acompteEnabled);
    if (draft.acomptePercent !== undefined) setAcomptePercent(draft.acomptePercent ?? 30);
    if (draft.acompteMode !== undefined) setAcompteMode(draft.acompteMode || 'percent');
    if (draft.acompteFixedAmount !== undefined) setAcompteFixedAmount(draft.acompteFixedAmount || 0);
    if (draft.delaiPaiement !== undefined) setDelaiPaiement(draft.delaiPaiement || '30jours');
    if (draft.moyenPaiement !== undefined) setMoyenPaiement(draft.moyenPaiement || 'virement');
    // For factures: only restore an already-reserved official number.
    if (
      draft.docNumber !== undefined &&
      draft.docNumber &&
      (documentType !== 'facture' || isOfficialDocumentNumber(draft.docNumber, 'facture'))
    ) {
      setDocNumber(draft.docNumber);
    }
    if (draft.items?.length) setItems(draft.items as LineItem[]);
    if (draft.natureOperation !== undefined) setNatureOperation(draft.natureOperation || 'service');
    if (draft.assureurName !== undefined) setAssureurName(draft.assureurName || '');
    if (draft.assureurAddress !== undefined) setAssureurAddress(draft.assureurAddress || '');
    if (draft.policyNumber !== undefined) setPolicyNumber(draft.policyNumber || '');
    if (draft.geographicCoverage !== undefined) setGeographicCoverage(draft.geographicCoverage || 'France métropolitaine');
    if (draft.paymentMilestones !== undefined) setPaymentMilestones(draft.paymentMilestones);
    if (draft.milestonesEnabled !== undefined) setMilestonesEnabled(draft.milestonesEnabled);
    else if (draft.paymentMilestones !== undefined) setMilestonesEnabled(draft.paymentMilestones.length > 0);
    if (draft.descriptionChantier !== undefined) setDescriptionChantier(draft.descriptionChantier || '');
    if (draft.descriptionChantierAr !== undefined) setDescriptionChantierAr(draft.descriptionChantierAr || '');
    if (draft.descriptionChantierFr !== undefined) setDescriptionChantierFr(draft.descriptionChantierFr || '');
    if (draft.estimatedStartDate !== undefined) setEstimatedStartDate(draft.estimatedStartDate || '');
    if (draft.estimatedDuration !== undefined) setEstimatedDuration(draft.estimatedDuration || '');
    if (draft.discountEnabled !== undefined) setDiscountEnabled(draft.discountEnabled);
    if (draft.discountType !== undefined) setDiscountType(draft.discountType || 'percent');
    if (draft.discountValue !== undefined) setDiscountValue(draft.discountValue || 0);
    // Restore showPreview so users don't lose preview state on mobile page reload (e.g. after download)
    if (draft.showPreview !== undefined) setShowPreview(draft.showPreview);
    if (draft.showArabic !== undefined) setShowArabic(draft.showArabic);
    if (draft.includePhotosInPdf !== undefined) setIncludePhotosInPdf(draft.includePhotosInPdf);
    if (draft.sitePhotos !== undefined) setSitePhotos(draft.sitePhotos);
    if (draft.tempValues !== undefined) setTempValues(draft.tempValues);
    if (draft.currentStep !== undefined) {
      const restoredStep = Math.max(0, Math.min(Number(draft.currentStep) || 0, 7));
      setCurrentStep(restoredStep);
    }
  }, []);

  useEffect(() => {
    if (draftRestored) return;
    if (prefillData) {
      setDraftRestored(true);
      return;
    }
    // New document creation: skip all draft restoration
    if (skipDraftRestore) {
      setDraftRestored(true);
      return;
    }
    
    const restoreDraft = async () => {
      const currentDocument = loadCurrentDocument(documentType);
      if (currentDocument) {
        restorePersistedDocument(currentDocument);
        setDraftRestored(true);
        return;
      }

      // Try cloud first if logged in, fallback to localStorage
      let draft = user ? await loadCloudDraft(documentType) : null;
      if (!draft) draft = loadDraft();
      
      if (draft) {
        restorePersistedDocument(draft);
      }
      setDraftRestored(true);
    };
    
    restoreDraft();
  }, [prefillData, skipDraftRestore, draftRestored, user, documentType, isRTL, toast, restorePersistedDocument]);

  const persistCurrentDocumentState = useCallback((overrides: Partial<Omit<CurrentDocumentState, 'savedAt'>> = {}) => {
    saveCurrentDocument({
      documentType,
      selectedClientId,
      selectedChantierId,
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
      includeWasteCosts,
      wasteDescription,
      wastePrice,
      isAutoEntrepreneur,
      selectedTvaRate,
      projectTvaType,
      validityDuration,
      dueDateDays,
      acompteEnabled,
      acomptePercent,
      acompteMode,
      acompteFixedAmount,
      delaiPaiement,
      moyenPaiement,
      docNumber,
      items,
      natureOperation,
      assureurName,
      assureurAddress,
      policyNumber,
      geographicCoverage,
      paymentMilestones,
      milestonesEnabled,
      descriptionChantier,
      descriptionChantierAr,
      descriptionChantierFr,
      estimatedStartDate,
      estimatedDuration,
      discountEnabled,
      discountType,
      discountValue,
      currentStep,
      showPreview,
      showArabic,
      includePhotosInPdf,
      sitePhotos,
      tempValues,
      ...overrides,
    });
  }, [documentType, selectedClientId, selectedChantierId, clientName, clientAddress, clientPhone, clientEmail, clientSiren, clientTvaIntra, clientIsB2B, workSiteSameAsClient, workSiteAddress, includeTravelCosts, travelDescription, travelPrice, includeWasteCosts, wasteDescription, wastePrice, isAutoEntrepreneur, selectedTvaRate, projectTvaType, validityDuration, dueDateDays, acompteEnabled, acomptePercent, acompteMode, acompteFixedAmount, delaiPaiement, moyenPaiement, docNumber, items, natureOperation, assureurName, assureurAddress, policyNumber, geographicCoverage, paymentMilestones, milestonesEnabled, descriptionChantier, descriptionChantierAr, descriptionChantierFr, estimatedStartDate, estimatedDuration, discountEnabled, discountType, discountValue, currentStep, showPreview, showArabic, includePhotosInPdf, sitePhotos, tempValues]);

  useEffect(() => {
    if (!draftRestored) return;
    persistCurrentDocumentState();
  }, [draftRestored, persistCurrentDocumentState]);

  // --- AUTO-SAVE draft on every change (debounced) ---
  useEffect(() => {
    if (!draftRestored) return;
    const timer = setTimeout(() => {
      saveCurrentDraftSnapshot();
    }, 600);
    return () => clearTimeout(timer);
  }, [draftRestored, saveCurrentDraftSnapshot]);

  useEffect(() => {
    if (!draftRestored) return;

    const flushDraftNow = () => {
      persistCurrentDocumentState();
      saveCurrentDraftSnapshot();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushDraftNow();
      }
    };

    window.addEventListener('pagehide', flushDraftNow);
    window.addEventListener('beforeunload', flushDraftNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushDraftNow);
      window.removeEventListener('beforeunload', flushDraftNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [draftRestored, persistCurrentDocumentState, saveCurrentDraftSnapshot]);

  // Handle prefill data from quote-to-invoice conversion or Smart Devis
  // CRITICAL: This effect MUST reliably inject items into the form.
  // For image-quote flow, state is already initialized via useState — this effect
  // handles non-image-quote flows and shows the toast.
  useEffect(() => {
    if (!prefillData) return;
    if (prefillAppliedRef.current) {
      // Already applied (either via useState init or previous effect run) — just show toast once
      console.log('[InvoiceFormBuilder] Prefill already applied, skipping re-application');
      return;
    }
    prefillAppliedRef.current = true;

    console.log('[InvoiceFormBuilder] Applying prefill data:', prefillData.source, '—', prefillData.items?.length, 'items');
    
    // Clear stale drafts and localStorage to prevent ghost data
    clearDraft();
    clearCurrentDocument();
    try { localStorage.removeItem('lineItemEditor_items_v1'); } catch {}
    
    // Reset docNumber to the reserved invoice number when provided, otherwise use placeholder
    setDocNumber(
      documentType === 'facture' && isOfficialDocumentNumber(prefillData.reservedDocumentNumber, 'facture')
        ? prefillData.reservedDocumentNumber
        : `${getDocPrefix(documentType)}AUTO`,
    );
    
    // For image-quote flow, client/items are already set via useState initializers.
    // For other flows, inject here.
    if (prefillData.source === 'image_quote_to_invoice') {
      // Already initialized in useState — just set translation markers
      if (prefillData.items && prefillData.items.length > 0) {
        const attemptedIds = new Set(items.map(item => item.id));
        setTranslationAttemptIds(attemptedIds);
      }
    } else {
      // Other flows (devis_conversion, smart_devis, milestone_invoice, etc.)
      setSelectedClientId(prefillData.selectedClientId || '');
      setSelectedChantierId(prefillData.selectedChantierId || '');
      setClientName(prefillData.clientName || '');
      setClientAddress(prefillData.clientAddress || '');
      setClientPhone(prefillData.clientPhone || '');
      setClientEmail(prefillData.clientEmail || '');
      setClientSiren(prefillData.clientSiren || '');
      setClientTvaIntra(prefillData.clientTvaIntra || '');
      setClientIsB2B(prefillData.clientIsB2B || false);
      
      console.log('[InvoiceFormBuilder] Prefill OK — client:', prefillData.clientName, '— items:', prefillData.items?.length);
      
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
        const attemptedIds = new Set(newItems.map(item => item.id));
        setTranslationAttemptIds(attemptedIds);
      }

      if (prefillData.source === 'quote_to_invoice' && prefillData.notes) {
        setDescriptionChantier(prev => prev || prefillData.notes || '');
      }
    }

    if (prefillData.workSiteAddress) {
      setWorkSiteAddress(prefillData.workSiteAddress);
      setWorkSiteSameAsClient(false);
    }
    if (prefillData.natureOperation) {
      setNatureOperation(prefillData.natureOperation as 'service' | 'goods' | 'mixed');
    }

    // Load site photos from Smart Devis
    if (prefillData.sitePhotos && prefillData.sitePhotos.length > 0) {
      setSitePhotos(prefillData.sitePhotos);
    }

    // Auto-fill subject/description
    if (prefillData.descriptionChantier && !descriptionChantier) {
      setDescriptionChantier(prefillData.descriptionChantier);
    }

    // === Advanced fields: TVA, payment, schedule, dates ===
    if (prefillData.isAutoEntrepreneur !== undefined) setIsAutoEntrepreneur(prefillData.isAutoEntrepreneur);
    if (prefillData.selectedTvaRate !== undefined) setSelectedTvaRate(prefillData.selectedTvaRate);
    if (prefillData.projectTvaType !== undefined) setProjectTvaType(prefillData.projectTvaType);
    if (prefillData.delaiPaiement !== undefined) setDelaiPaiement(prefillData.delaiPaiement);
    if (prefillData.moyenPaiement !== undefined) setMoyenPaiement(prefillData.moyenPaiement);
    if (prefillData.acompteEnabled !== undefined) setAcompteEnabled(prefillData.acompteEnabled);
    if (prefillData.acomptePercent !== undefined) setAcomptePercent(prefillData.acomptePercent);
    if (prefillData.acompteMode !== undefined) setAcompteMode(prefillData.acompteMode);
    if (prefillData.acompteFixedAmount !== undefined) setAcompteFixedAmount(prefillData.acompteFixedAmount);
    if (prefillData.milestonesEnabled !== undefined) setMilestonesEnabled(prefillData.milestonesEnabled);
    if (prefillData.paymentMilestones !== undefined) setPaymentMilestones(prefillData.paymentMilestones);
    if (prefillData.discountEnabled !== undefined) setDiscountEnabled(prefillData.discountEnabled);
    if (prefillData.discountType !== undefined) setDiscountType(prefillData.discountType);
    if (prefillData.discountValue !== undefined) setDiscountValue(prefillData.discountValue);
    if (prefillData.estimatedStartDate !== undefined) setEstimatedStartDate(prefillData.estimatedStartDate);
    if (prefillData.estimatedDuration !== undefined) setEstimatedDuration(prefillData.estimatedDuration);
    if (prefillData.validityDuration !== undefined) setValidityDuration(prefillData.validityDuration);

    console.log('[InvoiceFormBuilder] FULL PREFILL OK —', {
      source: prefillData.source,
      client: prefillData.clientName,
      items: prefillData.items?.length,
      tvaRate: prefillData.selectedTvaRate,
      projectTvaType: prefillData.projectTvaType,
      delaiPaiement: prefillData.delaiPaiement,
      moyenPaiement: prefillData.moyenPaiement,
      acompteEnabled: prefillData.acompteEnabled,
      milestonesEnabled: prefillData.milestonesEnabled,
      milestones: prefillData.paymentMilestones?.length,
      estimatedStartDate: prefillData.estimatedStartDate,
      estimatedDuration: prefillData.estimatedDuration,
    });
    
    toast({
      title: isRTL 
        ? (prefillData.source === 'devis_conversion' ? '✅ تم نقل بيانات الدوفي!' : prefillData.source === 'devis_duplication' ? '✅ تم نسخ الدوفي!' : '✅ تم ملء البيانات!')
        : (prefillData.source === 'devis_conversion' ? '✅ Devis converti en facture!' : prefillData.source === 'devis_duplication' ? '✅ Devis dupliqué!' : '✅ Données pré-remplies!'),
      description: isRTL 
        ? 'راجع البيانات واضغط على معاينة' 
        : 'Vérifiez les données et cliquez sur Aperçu',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const isMilestoneInvoiceFlow = prefillData?.source === 'milestone_invoice';
    const effectiveMilestonesEnabled = isMilestoneInvoiceFlow ? false : milestonesEnabled;
    const effectivePaymentMilestones = isMilestoneInvoiceFlow ? [] : paymentMilestones;
    const effectiveAcompteEnabled = isMilestoneInvoiceFlow ? false : acompteEnabled;

    // Combine regular items with travel costs if enabled
    // For milestone invoices, keep items even with empty designation (user-provided data is sacred)
    const allItems = [...items.filter(item => (isMilestoneInvoiceFlow || item.designation_fr.trim()) && Number(item.unitPrice) >= 0)];
    
    // Add travel costs as a line item if enabled
    if (includeTravelCosts && travelPrice > 0) {
      allItems.push({
        id: generateId(),
        designation_fr: travelDescription || 'Frais de déplacement',
        designation_ar: isRTL ? 'مصاريف النقل' : '',
        quantity: 1,
        unit: 'forfait',
        unitPrice: travelPrice,
        total: travelPrice,
      });
    }
    
    // Add waste/REP costs as a line item if enabled
    if (includeWasteCosts && wastePrice > 0) {
      allItems.push({
        id: generateId(),
        designation_fr: wasteDescription || 'Gestion des déchets / REP',
        designation_ar: isRTL ? 'إدارة النفايات' : '',
        quantity: 1,
        unit: 'forfait',
        unitPrice: wastePrice,
        total: wastePrice,
      });
    }
    
    const subtotal = Math.round(allItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
    
    // Smart TVA calculation: Auto-entrepreneur = franchise de TVA, Sous-traitance = autoliquidation, Intracommunautaire = exonération
    const tvaExempt = isAutoEntrepreneur;
    const isSousTraitanceTva = !isAutoEntrepreneur && projectTvaType === 'sous_traitance';
    const isIntracomTva = !isAutoEntrepreneur && projectTvaType === 'intracommunautaire';
    const tvaRate = tvaExempt || isSousTraitanceTva || isIntracomTva ? 0 : (projectTvaType === 'logement_ancien' ? 10 : 20);
    const totals = calculateInvoiceTotals({
      subtotal,
      tvaRate,
      tvaExempt,
      discountType: discountEnabled ? discountType : undefined,
      discountValue: discountEnabled ? discountValue : undefined,
    });
    const discountAmt = totals.discountAmount;
    const subtotalAfterDiscount = totals.subtotalAfterDiscount;
    const tvaAmount = totals.tvaAmount;
    const total = totals.total;
    const vatLegalMention = (() => {
      if (tvaExempt) return 'TVA non applicable, article 293B du Code général des impôts (CGI)';
      if (isSousTraitanceTva) return 'Autoliquidation de la TVA – article 283-2 du Code général des impôts (CGI)';
      if (isIntracomTva) return 'Exonération de TVA – livraison intracommunautaire – article 262 ter I du Code général des impôts (CGI)';
      if (projectTvaType === 'logement_ancien') return 'TVA au taux réduit de 10% conformément à l\'article 279-0 bis du Code général des impôts (CGI)';
      if (projectTvaType === 'local_pro') return 'TVA au taux normal de 20% conformément à la législation en vigueur';
      return 'TVA au taux normal de 20% conformément à l\'article 278 du Code général des impôts (CGI)';
    })();
    
    return {
      type: documentType === 'devis' ? 'DEVIS' : 'FACTURE',
      number: docNumber,
      date: new Date().toLocaleDateString('fr-FR'),
      validUntil: documentType === 'devis' 
        ? new Date(Date.now() + validityDuration * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')
        : undefined,
      dueDate: (() => {
        if (delaiPaiement === 'immediate' || delaiPaiement === 'echeancier') return undefined;
        const days = delaiPaiement === '15jours' ? 15 : delaiPaiement === '30jours' ? 30 : delaiPaiement === '45jours' ? 45 : delaiPaiement === '60jours' ? 60 : 30;
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
      })(),
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
      descriptionChantier: (descriptionChantierFr || descriptionChantier).trim() || undefined,
      descriptionChantierAr: descriptionChantierAr.trim() || undefined,
      estimatedStartDate: estimatedStartDate.trim() 
        ? new Date(estimatedStartDate).toLocaleDateString('fr-FR') 
        : undefined,
      estimatedDuration: estimatedDuration.trim() || undefined,
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
      subtotal,
      discountType: discountEnabled && discountAmt > 0 ? discountType : undefined,
      discountValue: discountEnabled && discountAmt > 0 ? discountValue : undefined,
      discountAmount: discountAmt > 0 ? discountAmt : undefined,
      subtotalAfterDiscount: discountAmt > 0 ? subtotalAfterDiscount : undefined,
      tvaRate,
      tvaAmount,
      tvaExempt,
      tvaRegime: tvaExempt ? 'franchise' as const
        : isSousTraitanceTva ? 'autoliquidation' as const
        : isIntracomTva ? 'intracommunautaire' as const
        : 'standard' as const,
      total,
      paymentDeadline: isMilestoneInvoiceFlow && delaiPaiement === 'echeancier'
        ? undefined
        : delaiPaiement === 'immediate'
          ? 'immediate'
          : delaiPaiement === 'echeancier'
            ? 'echeancier'
            : undefined,
      acomptePercent: effectiveAcompteEnabled && !effectiveMilestonesEnabled && acompteMode === 'percent' ? acomptePercent : undefined,
      acompteAmount: (() => {
        if (effectiveMilestonesEnabled || !effectiveAcompteEnabled) return undefined;
        if (acompteMode === 'percent') return Math.round(total * (acomptePercent / 100) * 100) / 100;
        return acompteFixedAmount;
      })(),
      acompteMode: effectiveAcompteEnabled && !effectiveMilestonesEnabled ? acompteMode : undefined,
      netAPayer: (() => {
        if (effectiveMilestonesEnabled || !effectiveAcompteEnabled) return undefined;
        const acompte = acompteMode === 'percent' 
          ? Math.round(total * (acomptePercent / 100) * 100) / 100 
          : acompteFixedAmount;
        return Math.round((total - acompte) * 100) / 100;
      })(),
      paymentMilestones: effectiveMilestonesEnabled && effectivePaymentMilestones.length > 0 ? effectivePaymentMilestones : undefined,
      paymentTerms: (() => {
        const delaiLabel = delaiPaiement === 'immediate' ? 'à réception' 
          : delaiPaiement === '15jours' ? 'à 15 jours'
          : delaiPaiement === '30jours' ? 'à 30 jours' 
          : delaiPaiement === '45jours' ? 'à 45 jours'
          : delaiPaiement === '60jours' ? 'à 60 jours'
          : delaiPaiement === 'echeancier' ? 'selon échéancier'
          : 'fin de mois';
        const moyenLabel = moyenPaiement === 'virement' ? 'Virement' : moyenPaiement === 'cheque' ? 'Chèque' : 'Espèces';
        let text = '';
        if (isMilestoneInvoiceFlow) {
          text += delaiPaiement === 'echeancier'
            ? `Paiement par ${moyenLabel}. `
            : `Paiement ${delaiLabel} par ${moyenLabel}. `;
        } else if (effectiveMilestonesEnabled && effectivePaymentMilestones.length > 0) {
          text += `Paiement selon échéancier (${effectivePaymentMilestones.length} étapes). `;
          text += `Le paiement sera effectué selon l'avancement des travaux décrit ci-dessus. `;
          // Smart labeling: if a specific deadline is set alongside the schedule
          if (delaiPaiement !== 'echeancier' && delaiPaiement !== 'immediate') {
            const daysLabel = delaiPaiement === '15jours' ? '15' : delaiPaiement === '30jours' ? '30' : delaiPaiement === '45jours' ? '45' : '60';
            text += `Chaque échéance est due à ${daysLabel} jours après sa date d'appel. `;
          }
        } else if (acompteEnabled && ((acompteMode === 'percent' && acomptePercent > 0) || (acompteMode === 'fixed' && acompteFixedAmount > 0))) {
          const acompteLabel = acompteMode === 'percent' 
            ? `${acomptePercent}%` 
            : `${acompteFixedAmount.toFixed(2)} €`;
          text += `Acompte de ${acompteLabel} à la commande. Solde ${delaiLabel} par ${moyenLabel}. `;
        } else {
          text += `Paiement ${delaiLabel} par ${moyenLabel}. `;
        }
        text += `En cas de retard : pénalités de 3 fois le taux légal + indemnité forfaitaire de 40€.`;
        return text;
      })(),
      legalMentions: vatLegalMention,
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
        const isEI = p.legal_status === 'auto-entrepreneur' || p.legal_status === 'ei';
        const statusLabel = isEI ? 'Auto-entrepreneur' : (p.legal_status === 'societe' ? 'Société' : p.legal_status);
        if (statusLabel) parts.push(statusLabel);
        // EI/Auto-entrepreneur has no social capital
        if (!isEI && p.capital_social) parts.push(`au capital de ${p.capital_social}`);
        if (p.siret) {
          let siretPart = `SIRET : ${p.siret}`;
          if (p.ville_immatriculation) siretPart += ` — RCS ${p.ville_immatriculation}`;
          parts.push(siretPart);
        } else if (p.ville_immatriculation) {
          parts.push(`RCS ${p.ville_immatriculation}`);
        }
        if (p.code_naf) parts.push(`NAF : ${p.code_naf}`);
        // Keep tax ID in footer, while VAT legal mention is rendered once in the dedicated footer line.
        if (!isAutoEntrepreneur && !tvaExempt && !isSousTraitanceTva && p.numero_tva) {
          parts.push(`TVA Intracommunautaire : ${p.numero_tva}`);
        }
        return parts.length > 1 ? parts.join(' — ') : (p.legal_footer || undefined);
      })(),
      sitePhotos: (sitePhotos.length > 0 && includePhotosInPdf) ? sitePhotos : undefined,
      sourceDevisNumber: prefillData?.sourceDocumentNumber || undefined,
      acompteLabel: prefillData?.acompteLabel || undefined,
    };
  };
  
  const rawInvoiceData = buildInvoiceData();
  
  // Auto-validate and fix document (expert-comptable level)
  const validationResult = validateDocument(
    rawInvoiceData.items.map((item, i) => ({ ...item, id: items[i]?.id || `v-${i}` })),
    rawInvoiceData.tvaRate,
    rawInvoiceData.tvaExempt
  );
  
  // CRITICAL: Recalculate ALL financial values from validated items to ensure consistency.
  // The validation layer may change item prices/quantities, so we must recompute everything.
  const validatedSubtotal = validationResult.items.reduce((s, i) => s + i.total, 0);
  const validatedTvaRate = validationResult.tvaRate;
  const validatedTotals = calculateInvoiceTotals({
    subtotal: validatedSubtotal,
    tvaRate: validatedTvaRate,
    tvaExempt: rawInvoiceData.tvaExempt,
    discountType: rawInvoiceData.discountType,
    discountValue: rawInvoiceData.discountValue,
  });
  const validatedDiscountAmt = validatedTotals.discountAmount;
  const validatedSubtotalAfterDiscount = validatedTotals.subtotalAfterDiscount;
  const validatedTvaAmount = validatedTotals.tvaAmount;
  const validatedTotal = validatedTotals.total;

  const invoiceData: InvoiceData = {
    ...rawInvoiceData,
    items: validationResult.items.map(vi => ({
      designation_fr: vi.designation_fr,
      designation_ar: vi.designation_ar || vi.designation_fr,
      quantity: vi.quantity,
      unit: vi.unit,
      unitPrice: vi.unitPrice,
      total: vi.total,
    })),
    subtotal: Math.round(validatedSubtotal * 100) / 100,
    discountAmount: validatedDiscountAmt > 0 ? validatedDiscountAmt : undefined,
    subtotalAfterDiscount: validatedDiscountAmt > 0 ? validatedSubtotalAfterDiscount : undefined,
    tvaRate: validatedTvaRate,
    tvaAmount: validatedTvaAmount,
    total: validatedTotal,
  };
  
  // Log corrections on first preview render (show toast once)
  const lastCorrectionsRef = useRef<string>('');
  useEffect(() => {
    if (validationResult.corrections.length > 0 && showPreview) {
      const key = validationResult.corrections.map(c => `${c.field}:${c.corrected}`).join('|');
      if (key !== lastCorrectionsRef.current) {
        lastCorrectionsRef.current = key;
        toast({
          title: `✅ ${validationResult.corrections.length} correction(s) automatique(s)`,
          description: validationResult.corrections.slice(0, 3).map(c => `${c.field}: ${c.reason}`).join(' • '),
          duration: 6000,
        });
      }
    }
  }, [showPreview, validationResult.corrections.length]);
  
  // Check if form is valid
  const isFormValid = items.some(item => item.designation_fr.trim() && item.unitPrice > 0) || (includeTravelCosts && travelPrice > 0);

  // Section completion for progress tracking
  const sectionCompletion: ProgressSection[] = [
    { id: 'client', label: isRTL ? 'الزبون' : 'Client', icon: '👤', isComplete: !!clientName.trim() && !!clientAddress.trim() },
    { id: 'objet', label: isRTL ? 'الموضوع' : 'Objet', icon: '📝', isComplete: !!(descriptionChantier.trim() || descriptionChantierFr.trim()) },
    { id: 'travaux', label: isRTL ? 'الشغل' : 'Travaux', icon: '💰', isComplete: isFormValid },
    { id: 'chantier', label: isRTL ? 'الشانتييه' : 'Chantier', icon: '📍', isComplete: workSiteSameAsClient || !!workSiteAddress.trim() },
    { id: 'paiement', label: isRTL ? 'الدفع' : 'Paiement', icon: '💳', isComplete: true },
    { id: 'resume', label: isRTL ? 'الملخص' : 'Résumé', icon: '📊', isComplete: invoiceData.total > 0 },
  ];
  const completedSections = sectionCompletion.filter(s => s.isComplete).length;
  const progressPercent = Math.round((completedSections / sectionCompletion.length) * 100);
  const allSectionsComplete = completedSections === sectionCompletion.length;

  // === WIZARD STATE ===
  const WIZARD_STEPS: WizardStep[] = [
    { id: 'client', label: isRTL ? 'الزبون' : 'Client', icon: '👤', isComplete: sectionCompletion[0].isComplete },
    { id: 'objet', label: isRTL ? 'الموضوع' : 'Objet', icon: '📝', isComplete: sectionCompletion[1].isComplete },
    { id: 'travaux', label: isRTL ? 'الشغل' : 'Travaux', icon: '💰', isComplete: sectionCompletion[2].isComplete },
    { id: 'options', label: isRTL ? 'خيارات' : 'Options', icon: '⚙️', isComplete: true },
    { id: 'chantier', label: isRTL ? 'الشانتييه' : 'Chantier', icon: '📍', isComplete: sectionCompletion[3].isComplete },
    { id: 'delais', label: isRTL ? 'المواعيد' : 'Délais', icon: '📅', isComplete: true },
    { id: 'paiement', label: isRTL ? 'الدفع' : 'Paiement', icon: '💳', isComplete: sectionCompletion[4].isComplete },
    { id: 'resume', label: isRTL ? 'الملخص' : 'Résumé', icon: '📊', isComplete: sectionCompletion[5].isComplete },
  ];

  useEffect(() => {
    if (!draftRestored) return;
    persistCurrentDocumentState({ currentStep });
  }, [draftRestored, currentStep, persistCurrentDocumentState]);

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 0: return !!clientName.trim() && !!clientAddress.trim();
      case 1: return true;
      case 2: return isFormValid;
      default: return true;
    }
  };

  const handleNextStep = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      if (!canProceedFromStep(currentStep)) {
        // Show what's missing in current step
        const missing: string[] = [];
        if (currentStep === 0) {
          if (!clientName.trim()) missing.push(isRTL ? '👤 اسم الزبون' : '👤 Nom du client');
          if (!clientAddress.trim()) missing.push(isRTL ? '📍 عنوان الزبون' : '📍 Adresse du client');
        }
        if (currentStep === 2) {
          missing.push(isRTL ? '💰 أضف بند واحد على الأقل' : '💰 Ajoutez au moins une prestation');
        }
        if (missing.length > 0) {
          toast({
            title: isRTL ? '⚠️ بيانات ناقصة' : '⚠️ Champs obligatoires manquants',
            description: missing.join('\n'),
            variant: 'destructive',
            duration: 5000,
          });
        }
        return;
      }
      const nextStep = currentStep + 1;
      persistCurrentDocumentState({ currentStep: nextStep });
      saveCurrentDraftSnapshot();
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      const nextStep = currentStep - 1;
      persistCurrentDocumentState({ currentStep: nextStep });
      saveCurrentDraftSnapshot();
      setCurrentStep(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };


  const getTechnicalErrorMessage = (error: unknown) => {
    const err = error as any;
    const raw = err?.context?.body || err?.message || err?.error_description || err?.details || err?.hint || String(error);

    if (typeof raw === 'string') {
      return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
    }

    try {
      const asText = JSON.stringify(raw);
      return asText.length > 240 ? `${asText.slice(0, 240)}…` : asText;
    } catch {
      return 'Unknown technical error';
    }
  };
  
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

  const handleArabicVoiceDual = (id: string, result: VoiceResult) => {
    const raw = result.raw.trim();
    const text = result.text.trim();
    if (!raw && !text) return;

    const current = itemsRef.current.find(item => item.id === id);
    if (!current) return;

    const nextArabic = [current.designation_ar?.trim(), raw].filter(Boolean).join(' ').trim();
    const nextFrench = [current.designation_fr?.trim(), text].filter(Boolean).join(' ').trim();

    const existingTimer = arabicDebounceTimersRef.current[id];
    if (existingTimer) {
      clearTimeout(existingTimer);
      arabicDebounceTimersRef.current[id] = undefined;
    }

    setTypingArabicIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    setTranslationAttemptIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    if (nextArabic && text) {
      lastTranslatedSourceRef.current[id] = nextArabic;
    }

    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      return {
        ...item,
        designation_ar: nextArabic || item.designation_ar,
        designation_fr: nextFrench || item.designation_fr,
      };
    }));
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

  const validateDocumentFinancialSafety = (data: InvoiceData): boolean => {
    const subtotalFromItems = Math.round(
      data.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0) * 100,
    ) / 100;

    if (Math.abs(subtotalFromItems - data.subtotal) > 0.01) {
      toast({
        variant: 'destructive',
        title: isRTL ? '⚠️ خطأ في الحسابات' : '⚠️ Erreur de calcul',
        description: SAFETY_BLOCK_MESSAGE,
      });
      return false;
    }

    const computedSubtotalAfterDiscount = data.subtotalAfterDiscount
      ?? Math.round((data.subtotal - (data.discountAmount ?? 0)) * 100) / 100;

    const consistency = validateInvoiceTotalsConsistency({
      subtotal: subtotalFromItems,
      tvaRate: data.tvaRate,
      tvaExempt: data.tvaExempt,
      discountType: data.discountType,
      discountValue: data.discountValue,
      discountAmount: data.discountAmount,
      computedSubtotalAfterDiscount,
      computedTvaAmount: data.tvaAmount,
      computedTotal: data.total,
    });

    if (!consistency.isValid) {
      console.error('[SAVE INTEGRITY] Mismatch detected:', {
        reason: consistency.reason,
        current: {
          subtotal: data.subtotal,
          subtotalAfterDiscount: computedSubtotalAfterDiscount,
          tvaAmount: data.tvaAmount,
          total: data.total,
        },
        expected: consistency.expectedTotals,
      });
      toast({
        variant: 'destructive',
        title: isRTL ? '⚠️ خطأ في الحسابات' : '⚠️ Erreur de calcul',
        description: SAFETY_BLOCK_MESSAGE,
      });
      return false;
    }

    return true;
  };

  const uploadOfficialPdf = async (blob: Blob, documentNumber: string) => {
    if (!user) throw new Error('Utilisateur non authentifié');

    const safeDocNum = documentNumber.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const timestamp = Date.now();
    const fileName = `${user.id}/${documentType.toLowerCase()}-${safeDocNum}-${timestamp}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('signed-documents')
      .upload(fileName, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Bucket is private — store file path, generate signed URL on demand
    return fileName;
  };

  // Save finalized document to documents_comptables
  const saveToDocumentsComptables = async () => {
    if (!user || isSavingOfficialDocument) return;

    setIsSavingOfficialDocument(true);

    try {

      // CRITICAL: Use the VALIDATED invoiceData (post-validation recalculation)
      // instead of raw buildInvoiceData() to ensure UI = stored = PDF values.
      // The validated invoiceData has already been through the expert-comptable
      // validation layer which may correct prices, quantities, TVA rates, and units.

      if (!validateDocumentFinancialSafety(invoiceData)) {
        return;
      }

      // Block if Arabic description has no French translation
      if (descriptionChantier.trim() && containsArabic(descriptionChantier) && !descriptionChantierFr) {
        toast({
          variant: 'destructive',
          title: isRTL ? '⚠️ لازم الترجمة' : '⚠️ Traduction requise',
          description: isRTL
            ? 'لازم تدوس على "ترجم" عشان الموضوع يطلع فرنساوي في الوثيقة'
            : 'Veuillez traduire l\'objet en français avant de sauvegarder.',
        });
        return;
      }

      // Client name is required (either from selection or manual entry)
      if (!clientName.trim()) {
        toast({
          variant: 'destructive',
          title: isRTL ? '⚠️ بيانات ناقصة' : '⚠️ Données manquantes',
          description: isRTL
            ? 'يجب إدخال اسم العميل قبل الحفظ'
            : 'Vous devez renseigner le nom du client avant de sauvegarder.',
        });
        return;
      }

      const resolvedAssets = await getFreshSignedUrls();

      let data = {
        ...invoiceData,
        artisanSignatureUrl: resolvedAssets?.artisanSignatureUrl || signedUrls.artisanSignatureUrl || invoiceData.artisanSignatureUrl,
        stampUrl: resolvedAssets?.stampUrl || signedUrls.stampUrl || invoiceData.stampUrl,
        logoUrl: resolvedAssets?.logoUrl || signedUrls.logoUrl || invoiceData.logoUrl,
      };
      const { sitePhotos: _sitePhotos, ...documentDataForStorage } = data as any;
      let sourceDevisNumber = prefillData?.sourceDocumentNumber;
      const isMilestoneInvoiceFlow =
        documentType === 'facture' && prefillData?.source === 'milestone_invoice';
      const isQuoteConversionFlow =
        documentType === 'facture' &&
        prefillData?.source === 'devis_conversion' &&
        Boolean(prefillData?.sourceDocumentId);

      if (isQuoteConversionFlow) {
        const { data: sourceDevis, error: sourceCheckError } = await (supabase
          .from('documents_comptables') as any)
          .select('id, document_number, converted_to_invoice')
          .eq('id', prefillData?.sourceDocumentId)
          .eq('user_id', user.id)
          .eq('document_type', 'devis')
          .maybeSingle();

        if (sourceCheckError) throw sourceCheckError;

        if (!sourceDevis) {
          toast({
            variant: 'destructive',
            title: isRTL ? 'خطأ في الربط' : 'Erreur de liaison',
            description: isRTL
              ? 'الدوفي الأصلي غير موجود. أعد فتح التحويل من صفحة المستندات.'
              : 'Le devis source est introuvable. Relancez la conversion depuis vos documents.',
          });
          return;
        }

        sourceDevisNumber = sourceDevis.document_number;

        if (sourceDevis.converted_to_invoice) {
          toast({
            variant: 'destructive',
            title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
            description: isRTL
              ? 'تم إنشاء فاتورة بالفعل لهذا الدوفي.'
              : 'Une facture existe déjà pour ce devis.',
          });
          return;
        }
      }

      if (isMilestoneInvoiceFlow && !isOfficialDocumentNumber(sourceDevisNumber, 'devis')) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ في الربط' : 'Erreur de liaison',
          description: isRTL
            ? 'رقم الدوفي المصدر غير صالح. أعد فتح إنشاء الفاتورة من الدوفي المرتبط.'
            : 'Le numéro du devis source est invalide. Relancez la facture depuis le devis lié.',
        });
        return;
      }

      let nextNumber = docNumber;
      if (!isOfficialDocumentNumber(nextNumber, documentType)) {
        try {
          setDocNumberLoading(true);
          nextNumber = await reserveOfficialDocumentNumber(user.id, documentType);
        } catch (numberError) {
          toast({
            variant: 'destructive',
            title: isRTL ? '⚠️ خطأ في الترقيم' : '⚠️ Erreur de numérotation',
            description: isRTL ? 'تعذر إنشاء رقم المستند' : 'Impossible de générer le numéro du document.',
          });
          console.error('Numbering error:', numberError);
          return;
        } finally {
          setDocNumberLoading(false);
        }
      }

      // Assign the generated number to the document
      data.number = nextNumber;
      setDocNumber(nextNumber);

      const linkedDocumentData = {
        ...documentDataForStorage,
        logoUrl: profile?.logo_url || documentDataForStorage.logoUrl || null,
        artisanSignatureUrl: profile?.artisan_signature_url || documentDataForStorage.artisanSignatureUrl || null,
        stampUrl: profile?.stamp_url || documentDataForStorage.stampUrl || null,
        ...(selectedClientId && { linkedClientId: selectedClientId }),
        ...(selectedChantierId && { linkedChantierId: selectedChantierId }),
        ...(documentType === 'facture' && isOfficialDocumentNumber(sourceDevisNumber, 'devis') && {
          sourceDevisNumber,
          ...(prefillData?.sourceDocumentId && { sourceDevisId: prefillData.sourceDocumentId }),
        }),
        // Milestone invoice metadata (for installment tracking)
        ...(prefillData?.source === 'milestone_invoice' && prefillData?.milestoneId && {
          milestoneId: prefillData.milestoneId,
          milestoneLabel: prefillData.milestoneLabel,
        }),
      };

      if (!invoiceRef.current) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ في المعاينة' : 'Erreur aperçu',
          description: isRTL
            ? 'افتح المعاينة الرسمية أولاً قبل الحفظ.'
            : 'Ouvrez d’abord l’aperçu officiel avant l’enregistrement.',
        });
        return;
      }

      const pdfBlob = await generateOfficialPdfBlob({
        invoiceElement: invoiceRef.current,
        footerLabel: `${data.type} n° ${data.number}`,
        onBeforeExport: prepareFreshAssetsForExport,
        onToggleArabic: setShowArabic,
        showArabic,
      });

      if (!pdfBlob) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ PDF' : 'Erreur PDF',
          description: isRTL
            ? 'تعذر إنشاء الـ PDF الرسمي.'
            : 'Impossible de générer le PDF officiel.',
        });
        return;
      }

      const pdfUrl = await uploadOfficialPdf(pdfBlob, data.number);

      // Uniqueness already verified above (pre-upload check)

      const insertData: any = {
        user_id: user.id,
        document_type: documentType,
        document_number: data.number,
        client_name: data.client.name,
        client_address: data.client.address,
        work_site_address: data.workSite?.address || '',
        nature_operation: data.descriptionChantier || '',
        subtotal_ht: data.subtotal,
        tva_rate: data.tvaRate,
        tva_amount: data.tvaAmount,
        total_ttc: data.total,
        pdf_url: pdfUrl,
        tva_exempt: data.tvaExempt,
        document_data: linkedDocumentData,
        status: 'finalized',
      };
      if (selectedChantierId) insertData.chantier_id = selectedChantierId;

      const { data: insertedDocument, error } = await (supabase
        .from('documents_comptables') as any)
        .insert(insertData)
        .select('id, document_number')
        .single();
      if (error) throw error;

      if (isQuoteConversionFlow && insertedDocument?.id) {
        const { data: updatedSource, error: updateSourceError } = await (supabase
          .from('documents_comptables') as any)
          .update({
            status: 'converted',
            converted_to_invoice: true,
            linked_invoice_id: insertedDocument.id,
          })
          .eq('id', prefillData?.sourceDocumentId)
          .eq('user_id', user.id)
          .eq('document_type', 'devis')
          .eq('converted_to_invoice', false)
          .select('id')
          .maybeSingle();

        if (updateSourceError) throw updateSourceError;

        if (!updatedSource) {
          await (supabase.from('documents_comptables') as any)
            .delete()
            .eq('id', insertedDocument.id)
            .eq('user_id', user.id);

          toast({
            variant: 'destructive',
            title: isRTL ? 'تم التحويل سابقاً' : 'Déjà converti',
            description: isRTL
              ? 'تم منع إنشاء فاتورة مكررة لنفس الدوفي.'
              : 'La création d’une facture en doublon a été bloquée.',
          });
          return;
        }
      }

      // Clear drafts after successful save to prevent ghost state on next new document
      clearDraft();
      clearCurrentDocument();

      toast({
        title: isRTL ? '✅ تم الحفظ' : '✅ Sauvegardé',
        description: isRTL ? 'المستند محفوظ في مستنداتك' : 'Document enregistré dans vos documents.',
      });
    } catch (e) {
      const technicalMessage = getTechnicalErrorMessage(e);
      console.error('Save error (documents_comptables insert):', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ قاعدة البيانات' : 'Erreur base de données',
        description: technicalMessage,
      });
      throw e;
    } finally {
      setIsSavingOfficialDocument(false);
    }
  };

  // Save as Draft (مسودة) to documents_comptables with status 'draft'
  const saveAsDraft = async () => {
    if (!user) return;
    setSavingDraft(true);
    try {
      if (!validateDocumentFinancialSafety(invoiceData)) {
        return;
      }

      // Use validated invoiceData for consistency (UI = stored values)
      const data = { ...invoiceData };
      const { sitePhotos: _sitePhotos, ...documentDataForStorage } = data as any;
      const linkedDocumentData = {
        ...documentDataForStorage,
        logoUrl: profile?.logo_url || documentDataForStorage.logoUrl || null,
        artisanSignatureUrl: profile?.artisan_signature_url || documentDataForStorage.artisanSignatureUrl || null,
        stampUrl: profile?.stamp_url || documentDataForStorage.stampUrl || null,
        ...(selectedClientId && { linkedClientId: selectedClientId }),
        ...(selectedChantierId && { linkedChantierId: selectedChantierId }),
      };

      const insertData: any = {
        user_id: user.id,
        document_type: documentType,
        document_number: docNumber,
        client_name: data.client.name || '(مسودة)',
        client_address: data.client.address || '',
        work_site_address: data.workSite?.address || '',
        nature_operation: data.descriptionChantier || '',
        subtotal_ht: data.subtotal || 0,
        tva_rate: data.tvaRate || 0,
        tva_amount: data.tvaAmount || 0,
        total_ttc: data.total || 0,
        tva_exempt: data.tvaExempt || false,
        document_data: linkedDocumentData,
        status: 'draft',
      };
      if (selectedChantierId) insertData.chantier_id = selectedChantierId;
      // Note: drafts allow no chantier for early-stage work

      const { error } = await (supabase.from('documents_comptables') as any).insert(insertData);
      if (error) throw error;
      toast({
        title: isRTL ? '📝 تم حفظ المسودة' : '📝 Brouillon sauvegardé',
        description: isRTL ? 'تقدر ترجع تكمله من صفحة المستندات' : 'Vous pouvez le reprendre depuis vos documents.',
      });
    } catch (e) {
      const technicalMessage = getTechnicalErrorMessage(e);
      console.error('Draft save error:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في الحفظ' : 'Erreur de sauvegarde',
        description: technicalMessage,
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFinishDocument = async () => {
    if (!confirm(isRTL ? 'هل تريد فعلاً إنهاء هذا المستند ومسحه من الشاشة؟' : 'Confirmer la fin du document et vider l’écran ?')) return;

    clearDraft();
    clearCurrentDocument();
    setClientName('');
    setClientAddress('');
    setClientPhone('');
    setClientEmail('');
    setClientSiren('');
    setClientTvaIntra('');
    setClientIsB2B(false);
    setSelectedClientId('');
    setSelectedChantierId('');
    setWorkSiteSameAsClient(true);
    setWorkSiteAddress('');
    setIncludeTravelCosts(false);
    setTravelDescription('');
    setTravelPrice(30);
    setIncludeWasteCosts(false);
    setWasteDescription('');
    setWastePrice(0);
    const profileData = profile as any;
    setIsAutoEntrepreneur(Boolean(profileData?.tva_exempt || profileData?.legal_status === 'auto-entrepreneur'));
    setSelectedTvaRate(10);
    setProjectTvaType('logement_ancien');
    setValidityDuration(30);
    setDueDateDays(30);
    setAcompteEnabled(false);
    setAcomptePercent(30);
    setAcompteMode('percent');
    setAcompteFixedAmount(0);
    setDelaiPaiement('30jours');
    setMoyenPaiement('virement');
    setNatureOperation('service');
    setAssureurName(profileData?.assureur_name || '');
    setAssureurAddress(profileData?.assureur_address || '');
    setPolicyNumber(profileData?.assurance_policy_number || '');
    setGeographicCoverage(profileData?.assurance_geographic_coverage || 'France métropolitaine');
    setPaymentMilestones([]);
    setMilestonesEnabled(false);
    setDescriptionChantier('');
    setDescriptionChantierAr('');
    setDescriptionChantierFr('');
    setEstimatedStartDate('');
    setEstimatedDuration('');
    setDiscountEnabled(false);
    setDiscountType('percent');
    setDiscountValue(0);
    setItems([{
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: '' as unknown as number,
      unit: 'm²',
      unitPrice: '' as unknown as number,
      total: 0,
    }]);
    setTempValues({});
    setSitePhotos([]);
    setIncludePhotosInPdf(false);
    setShowPreview(false);
    setShowArabic(false);

    setDocNumber(getDocPrefix(documentType));

    toast({
      title: isRTL ? '✅ تم إنهاء المستند' : '✅ Document terminé',
      description: isRTL ? 'لن يتم مسحه إلا بعد الضغط على تأكيد وانهاء' : 'Le document actuel a été vidé uniquement après confirmation',
    });
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





      <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
        <div />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFinishDocument}
          className={cn("text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1 text-[10px] px-2 py-1 h-7", isRTL && "font-cairo flex-row-reverse")}
        >
          <Trash2 className="h-3 w-3" />
          {isRTL ? 'امسح بيانات المستند السابق' : 'Effacer le document précédent'}
        </Button>
      </div>

      {/* Step Navigation */}
      {!showPreview && (
        <StepNavigation
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          isRTL={isRTL}
          canProceed={canProceedFromStep(currentStep)}
          validationMessage={
            !canProceedFromStep(currentStep)
              ? (isRTL ? 'يرجى إكمال المعلومات المطلوبة' : 'Veuillez compléter les informations requises')
              : undefined
          }
        />
      )}
      {/* === STEP 3: OPTIONS — Due date/validity === */}
      {currentStep === 3 && documentType === 'facture' && (
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
      {currentStep === 3 && documentType === 'devis' && (
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
      {/* Document Number - Auto-assigned */}
      {currentStep === 3 && (<>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <FileText className="h-5 w-5 text-primary" />
            <h3 className={cn("font-bold", isRTL && "font-cairo")}>
              {isRTL 
                ? (documentType === 'facture' ? 'رقم الفاتورة' : 'رقم الدوفي')
                : (documentType === 'facture' ? 'Numéro de facture' : 'Numéro de devis')}
            </h3>
          </div>
          <div className={cn("p-3 rounded-lg bg-muted/50 border border-border", isRTL && "text-right")}>
            <p className={cn("text-sm font-medium text-foreground", isRTL && "font-cairo")}>
              {isRTL 
                ? '🔢 الترقيم تلقائي — الرقم يتحدد عند التسجيل النهائي'
                : '🔢 Numérotation automatique — le numéro sera attribué à l\'enregistrement'}
            </p>
            <p className={cn("text-xs text-muted-foreground mt-1", isRTL && "font-cairo")}>
              {isRTL
                ? `الصيغة: ${getDocPrefix(documentType)}001, ${getDocPrefix(documentType)}002...`
                : `Format : ${getDocPrefix(documentType)}001, ${getDocPrefix(documentType)}002...`}
            </p>
          </div>
          <p className={cn("text-[10px] text-muted-foreground", isRTL && "text-right font-cairo")}>
            {isRTL
              ? '✅ النظام يضمن ترقيم مستمر بدون ثغرات (التزام قانوني)'
              : '✅ Le système garantit une numérotation continue sans rupture (obligation légale)'}
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
                    ? (isRTL ? 'Auto-entrepreneur (معفى من الـ TVA)' : 'Auto-entrepreneur — TVA non applicable')
                    : (isRTL ? 'Société (يدفع TVA)' : 'Société — TVA applicable')}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </>)}

      {/* Client Section */}
      {currentStep === 0 && (
      <Card className="border-blue-200/60 bg-blue-50/30 dark:border-blue-800/30 dark:bg-blue-950/10">
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center justify-between",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className={cn("font-bold text-blue-900 dark:text-blue-200", isRTL && "font-cairo")}>
                {isRTL ? '👤 بيانات الزبون' : '👤 Informations client'}
              </h3>
            </div>
            {sectionCompletion.find(s => s.id === 'client')?.isComplete && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                <Check className="h-3 w-3" />
                <span>{isRTL ? 'مكتمل' : 'Complet'}</span>
              </div>
            )}
          </div>

          {/* Import from existing clients & projects - ALWAYS visible */}
          <div className={cn("p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-3")}>
            <p className={cn("text-xs font-semibold text-primary", isRTL && "font-cairo text-right")}>
              {isRTL ? '📋 استيراد من حساباتي' : '📋 Importer depuis mes contacts'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={cn("text-xs font-semibold text-muted-foreground", isRTL && "font-cairo text-right block")}>
                  {isRTL ? '👤 اختر عميل مسجل' : '👤 Choisir un client existant'}
                </Label>
                <Select value={selectedClientId} onValueChange={handleClientSelect}>
                  <SelectTrigger className={cn("text-sm bg-background", isRTL && "text-right font-cairo")}>
                    <SelectValue placeholder={
                      clientsList.length === 0
                        ? (isRTL ? '— لا يوجد عملاء بعد —' : '— Aucun client enregistré —')
                        : (isRTL ? '— اختياري —' : '— Optionnel —')
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsList.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={cn("text-xs font-semibold text-muted-foreground", isRTL && "font-cairo text-right block")}>
                  {isRTL ? '🏗️ الربط بمشروع مسجل' : '🏗️ Lier à un projet existant'}
                </Label>
                <Select 
                  value={selectedChantierId} 
                  onValueChange={handleChantierSelect}
                  disabled={!selectedClientId || chantiersList.length === 0}
                >
                  <SelectTrigger className={cn("text-sm bg-background", isRTL && "text-right font-cairo")}>
                    <SelectValue placeholder={
                      !selectedClientId 
                        ? (isRTL ? '— اختر عميل أولاً —' : '— Choisir un client d\'abord —')
                        : chantiersList.length === 0
                          ? (isRTL ? '— لا توجد مشاريع —' : '— Aucun projet —')
                          : (isRTL ? '— اختياري —' : '— Optionnel —')
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {chantiersList.map(ch => (
                      <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={cn("flex flex-wrap gap-2", isRTL && "flex-row-reverse")}> 
              <Button type="button" variant="outline" size="sm" onClick={() => navigate('/clients')} className={cn("text-xs", isRTL && "font-cairo")}> 
                {isRTL ? '➕ إضافة زبون جديد' : '➕ Ajouter un nouveau client'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => navigate('/chantiers')} className={cn("text-xs", isRTL && "font-cairo")}> 
                {isRTL ? '➕ إضافة مشروع جديد' : '➕ Ajouter un nouveau projet'}
              </Button>
            </div>
            <p className={cn("text-[11px] text-muted-foreground", isRTL && "font-cairo text-right")}>
              {isRTL ? '💡 الاختيار اختياري — يمكنك الكتابة يدوياً في الخانات تحت' : '💡 Optionnel — vous pouvez aussi saisir manuellement ci-dessous'}
            </p>
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
                dir="ltr"
                lang="fr"
                  className={cn("text-left", isRTL && "font-cairo")}
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

            {/* B2B Radio Buttons */}
            <div className={cn("p-3 rounded-lg border border-border bg-muted/30 space-y-2", isRTL && "text-right")}>
              <Label className={cn("text-sm font-bold", isRTL && "font-cairo")}>
                {isRTL ? '🏢 الزبون ده شركة (B2B)؟' : '🏢 Client professionnel (B2B) ?'}
              </Label>
              <RadioGroup
                value={clientIsB2B ? 'yes' : 'no'}
                onValueChange={(val) => setClientIsB2B(val === 'yes')}
                className={cn("flex gap-6", isRTL && "flex-row-reverse")}
              >
                <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <RadioGroupItem value="yes" id="b2b-yes" />
                    <Label htmlFor="b2b-yes" className={cn("cursor-pointer text-sm", isRTL && "font-cairo")}>
                      {isRTL ? 'نعم' : 'Oui'}
                    </Label>
                </div>
                <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <RadioGroupItem value="no" id="b2b-no" />
                    <Label htmlFor="b2b-no" className={cn("cursor-pointer text-sm", isRTL && "font-cairo")}>
                      {isRTL ? 'لا' : 'Non'}
                    </Label>
                </div>
              </RadioGroup>
            </div>
            
            {clientIsB2B && (
              <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className={cn("text-xs", isRTL && "font-cairo text-right block")}>
                      {isRTL ? 'رقم السجل التجاري (SIREN)' : 'SIREN du client'}
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
                  </div>
                  <div className="space-y-2">
                    <Label className={cn("text-xs", isRTL && "font-cairo text-right block")}>
                      {isRTL ? 'رقم الضريبة على القيمة المضافة (TVA)' : 'N° TVA Intracommunautaire'}
                    </Label>
                    <Input
                      value={clientTvaIntra}
                      onChange={(e) => setClientTvaIntra(e.target.value)}
                      placeholder={isRTL ? 'مثال: FR 12 345678901' : 'Ex: FR 12 345678901'}
                      className={cn("font-mono text-sm", isRTL && "text-right")}
                    />
                  </div>
                </div>
                <p className={cn("text-[10px] text-muted-foreground flex items-center gap-1", isRTL && "font-cairo text-right flex-row-reverse")}>
                  <span>💡</span>
                  <span>{isRTL ? 'مطلوب للفاتورة الإلكترونية (Factur-X 2026)' : 'Requis pour la facturation électronique (Factur-X 2026)'}</span>
                </p>
                {selectedClientId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={saveB2BToClient}
                    className={cn("text-xs gap-1.5", isRTL && "flex-row-reverse font-cairo")}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isRTL ? 'حفظ في ملف الزبون' : 'Sauvegarder dans la fiche client'}
                  </Button>
                )}
              </div>
            )}
            
            {!clientIsB2B && (
              <div className="space-y-2">
                <Label className={cn("text-xs", isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'رقم السجل التجاري (SIREN) للزبون (اختياري)' : 'SIREN du client (optionnel)'}
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
                <p className={cn("text-[10px] text-muted-foreground flex items-center gap-1", isRTL && "font-cairo text-right flex-row-reverse")}>
                  <span>💡</span>
                  <span>{isRTL ? 'مطلوب للفاتورة الإلكترونية (Factur-X 2026)' : 'Requis pour la facturation électronique (Factur-X 2026)'}</span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Step 0 navigation */}
      {currentStep === 0 && !showPreview && (
        <StepButtons currentStep={0} totalSteps={WIZARD_STEPS.length} onPrev={handlePrevStep} onNext={handleNextStep} canProceed={canProceedFromStep(0)} isRTL={isRTL} />
      )}

      {currentStep === 3 && (
      /* Nature of Operation */
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
      )}

      {/* Objet du devis / Description du chantier */}
      {currentStep === 1 && (
      <Card className="border-violet-200/60 bg-violet-50/30 dark:border-violet-800/30 dark:bg-violet-950/10">
        <CardContent className="p-4 space-y-3">
          <div className={cn(
            "flex items-center justify-between",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <Edit3 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className={cn("font-bold text-violet-900 dark:text-violet-200", isRTL && "font-cairo")}>
                {isRTL 
                  ? (documentType === 'devis' ? '📝 موضوع الدوفي' : '📝 موضوع الفاتورة')
                  : (documentType === 'devis' ? '📝 Objet du devis' : '📝 Objet de la facture')}
              </h3>
            </div>
            {sectionCompletion.find(s => s.id === 'objet')?.isComplete && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                <Check className="h-3 w-3" />
                <span>{isRTL ? 'مكتمل' : 'Complet'}</span>
              </div>
            )}
          </div>
          <div className="relative">
            <Textarea
              value={descriptionChantier}
              onChange={(e) => {
                setDescriptionChantier(e.target.value);
                // Clear French translation when user edits the source text
                if (descriptionChantierFr) {
                  setDescriptionChantierFr('');
                  setDescriptionChantierAr('');
                }
              }}
              placeholder={isRTL ? 'اتكلم بالعربي... مثال: دهان حيطان وسقف مكتب مسيو هاني' : 'Ex : Peinture des murs et du plafond d’un bureau'}
              rows={3}
              className={cn("text-sm resize-none", isRTL ? "text-right font-cairo" : "text-left")}
              dir="auto"
              enableVoice={true}
              onVoiceDual={(result: VoiceResult) => {
                // Always keep the raw Arabic text, never auto-translate
                const rawArabic = (result.raw || result.text || '').trim();
                if (!rawArabic) return;
                setDescriptionChantier(prev => {
                  const sep = prev && !prev.endsWith(' ') ? ' ' : '';
                  return prev + sep + rawArabic;
                });
                // Clear stale translation
                setDescriptionChantierFr('');
                setDescriptionChantierAr('');
              }}
            />
          </div>

          {/* Translate button */}
          {descriptionChantier.trim() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("text-sm gap-2", isRTL && "font-cairo")}
              disabled={isTranslatingObjet}
              onClick={async () => {
                setIsTranslatingObjet(true);
                try {
                  const raw = descriptionChantier.trim();
                  // Always try edge function for best quality professional translation
                  if (containsArabic(raw)) {
                    const { data } = await supabase.functions.invoke('voice-field-input', {
                      body: { rawText: raw, dualMode: true },
                    });
                    const frText = typeof data?.text === 'string' ? data.text.trim() : '';
                    if (frText) {
                      setDescriptionChantierAr(raw);
                      setDescriptionChantierFr(frText);
                    } else {
                      // Fallback to local formatter
                      const { french } = formatObjet(raw);
                      if (french && french !== raw) {
                        setDescriptionChantierAr(raw);
                        setDescriptionChantierFr(french);
                      }
                    }
                  } else {
                    // Already French text
                    setDescriptionChantierFr(raw);
                  }
                  toast({
                    title: isRTL ? '✅ تمت الترجمة' : '✅ Traduction terminée',
                    description: isRTL ? 'الموضوع اتترجم لفرنساوي' : 'La description a été traduite en français',
                  });
                } catch {
                  toast({ title: isRTL ? '❌ خطأ في الترجمة' : '❌ Erreur de traduction', variant: 'destructive' });
                } finally {
                  setIsTranslatingObjet(false);
                }
              }}
            >
              {isTranslatingObjet ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Languages className="h-4 w-4" />
              )}
              {isRTL ? 'ترجم' : 'Traduire'}
            </Button>
          )}

          {/* French translation preview */}
          {descriptionChantierFr && (
            <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 space-y-1">
              <p className="text-[10px] font-semibold text-green-700 dark:text-green-400">🇫🇷 Version française (utilisée dans le document) :</p>
              <p className="text-sm text-foreground font-medium">{descriptionChantierFr}</p>
            </div>
          )}

          {/* Original Arabic text reminder */}
          {descriptionChantierAr && descriptionChantierFr && (
            <div className="p-2 rounded bg-muted/40 border border-border">
              <p className={cn("text-[10px] text-muted-foreground", isRTL ? "text-right font-cairo" : "text-left")}>
                {isRTL ? '📝 النص الأصلي: ' : '📝 Texte source : '}
                {descriptionChantierAr}
              </p>
            </div>
          )}

          {/* Warning: Arabic detected but no translation yet */}
          {descriptionChantier.trim() && containsArabic(descriptionChantier) && !descriptionChantierFr && (
            <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className={cn("text-[11px] text-amber-700 dark:text-amber-400", isRTL ? "font-cairo text-right" : "text-left")}>
                {isRTL
                  ? '⚠️ لازم تدوس على "ترجم" عشان الموضوع يطلع فرنساوي في الدوفي/الفاتورة'
                  : '⚠️ Cliquez sur « Traduire » pour générer une version française dans le document'}
              </p>
            </div>
          )}

          {/* Document language notice */}
          <p className={cn("text-[10px] text-muted-foreground", isRTL && "text-right font-cairo")}>
            {isRTL 
              ? '📄 الوثيقة النهائية هتتعمل بالفرنساوي بس'
              : '📄 Le document final sera généré en français'}
          </p>
        </CardContent>
      </Card>
      )}

      {/* Step 1 navigation */}
      {currentStep === 1 && !showPreview && (
        <StepButtons currentStep={1} totalSteps={WIZARD_STEPS.length} onPrev={handlePrevStep} onNext={handleNextStep} canProceed={canProceedFromStep(1)} isRTL={isRTL} />
      )}

      {/* === STEP 5: DÉLAIS & ASSURANCE === */}
      {currentStep === 5 && (<>
      {/* Estimated Timeline (Optional) */}
      <Card className="border-sky-200/60 bg-sky-50/30 dark:border-sky-800/30 dark:bg-sky-950/10">
        <CardContent className="p-4 space-y-3">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className={cn("font-bold text-sky-800 dark:text-sky-200", isRTL && "font-cairo")}>
              {isRTL ? '🗓️ مواعيد الأشغال (اختياري)' : '🗓️ Calendrier des travaux (optionnel)'}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={cn("text-xs", isRTL && "font-cairo")}>
                {isRTL ? 'تاريخ بداية الأشغال المقدر' : 'Début estimé des travaux'}
              </Label>
              <Input
                type="date"
                value={estimatedStartDate}
                onChange={(e) => setEstimatedStartDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={cn("text-xs", isRTL && "font-cairo")}>
                {isRTL ? 'المدة المقدرة' : 'Durée estimée des travaux'}
              </Label>
              <Input
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder={isRTL ? 'مثال: 5 أيام' : 'Ex: 5 jours ouvrés'}
                className={cn("text-sm", isRTL && "text-right font-cairo")}
              />
            </div>
          </div>
          <p className={cn("text-[10px] text-muted-foreground", isRTL && "text-right font-cairo")}>
            {isRTL 
              ? '💡 اختياري - لو حطيته بيظهر على الدوفي ويبان أكثر احترافية'
              : '💡 Optionnel — Ces informations apparaîtront sur le document si renseignées'}
          </p>
        </CardContent>
      </Card>

      {/* Assurance Décennale (BTP) */}
      <Card className="border-slate-200/60 bg-slate-50/30 dark:border-slate-800/30 dark:bg-slate-950/10">
        <CardContent className="p-4 space-y-4">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900/40 flex items-center justify-center">
              <Shield className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className={cn("font-bold text-slate-800 dark:text-slate-200", isRTL && "font-cairo")}>
              {isRTL ? '🛡️ التأمين العشري و RC Pro' : '🛡️ Assurance Décennale & RC Pro'}
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
                dir="ltr"
                lang="fr"
                className="text-left text-sm"
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
      </>)}

      {/* Step 5 navigation */}
      {currentStep === 5 && !showPreview && (
        <StepButtons currentStep={5} totalSteps={WIZARD_STEPS.length} onPrev={handlePrevStep} onNext={handleNextStep} canProceed={true} isRTL={isRTL} />
      )}

      {/* === STEP 4: CHANTIER === */}
      {currentStep === 4 && (
      <Card className="border-teal-200/60 bg-teal-50/30 dark:border-teal-800/30 dark:bg-teal-950/10">
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center justify-between",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className={cn("font-bold text-teal-900 dark:text-teal-200", isRTL && "font-cairo")}>
                {isRTL ? '📍 عنوان الشانتييه' : '📍 Adresse du Chantier'}
              </h3>
            </div>
            {sectionCompletion.find(s => s.id === 'chantier')?.isComplete && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                <Check className="h-3 w-3" />
                <span>{isRTL ? 'مكتمل' : 'OK'}</span>
              </div>
            )}
          </div>
          
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg bg-teal-50/50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800/20",
            isRTL && "flex-row-reverse"
          )}>
            <Switch
              id="same-address-toggle"
              checked={workSiteSameAsClient}
              onCheckedChange={(checked) => setWorkSiteSameAsClient(checked)}
            />
            <Label 
              htmlFor="same-address-toggle" 
              className={cn(
                "cursor-pointer text-sm font-medium",
                isRTL && "font-cairo"
              )}
            >
              {isRTL 
                ? 'نفس عنوان الزبون'
                : "Même adresse que le client"}
            </Label>
          </div>
          
          {!workSiteSameAsClient && (
            <div className="space-y-3 pt-2">
              {/* Auto-fill from project suggestion */}
              {selectedChantierId && chantiersList.find(c => c.id === selectedChantierId)?.site_address && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const chantier = chantiersList.find(c => c.id === selectedChantierId);
                    if (chantier?.site_address) {
                      setWorkSiteAddress(chantier.site_address);
                      toast({
                        title: isRTL ? '✅ تم نسخ العنوان' : '✅ Adresse copiée',
                        description: isRTL ? 'تم نقل عنوان المشروع' : 'L\'adresse du projet a été importée',
                      });
                    }
                  }}
                  className={cn("w-full text-xs gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-400", isRTL && "flex-row-reverse font-cairo")}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {isRTL ? '📋 استخدم عنوان المشروع المسجل' : '📋 Utiliser l\'adresse du projet sélectionné'}
                </Button>
              )}
              <div className="space-y-2">
                <Label className={cn(isRTL && "font-cairo text-right block")}>
                  {isRTL ? 'عنوان الشانتييه' : 'Adresse du chantier'}
                </Label>
                <Input
                  value={workSiteAddress}
                  onChange={(e) => setWorkSiteAddress(e.target.value)}
                  placeholder={isRTL ? '45 avenue de Lyon, 69001 Lyon' : '45 avenue de Lyon, 69001 Lyon'}
                  dir="ltr"
                  lang="fr"
                  className="text-left"
                />
              </div>
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
      )}

      {/* Step 4 navigation */}
      {currentStep === 4 && !showPreview && (
        <StepButtons currentStep={4} totalSteps={WIZARD_STEPS.length} onPrev={handlePrevStep} onNext={handleNextStep} canProceed={canProceedFromStep(4)} isRTL={isRTL} />
      )}

      {/* === STEP 2: TRAVAUX & PRIX === */}
      {currentStep === 2 && (<>
      {/* AI Quote Wizard Button - Dynamic based on document type */}
      
      {/* Line Items Section */}
      <Card className="border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-800/30 dark:bg-emerald-950/10">
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center justify-between",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn(
              "flex items-center gap-2",
              isRTL && "flex-row-reverse"
            )}>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className={cn("font-bold text-emerald-900 dark:text-emerald-200", isRTL && "font-cairo")}>
                {isRTL ? '💰 الشغل والأسعار' : '💰 Lignes de prestation'}
              </h3>
              {sectionCompletion.find(s => s.id === 'travaux')?.isComplete && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  <Check className="h-3 w-3" />
                </div>
              )}
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
                      enableVoice={false}
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
                      {isRTL ? 'اكتب بالعربي وأنا أترجم ✨' : 'Texte à traduire ✨'}
                    </Label>
                    <Textarea
                      value={item.designation_ar}
                      onChange={(e) => handleArabicChange(item.id, e.target.value)}
                      enableVoice={true}
                      onVoiceDual={(result) => handleArabicVoiceDual(item.id, result)}
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
                      <UnitGuideButton onClick={() => { setUnitGuideTargetItemId(item.id); setShowUnitGuide(true); }} />
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
                    {item.total > 0 ? (
                      <div className="h-10 flex items-center px-3 bg-primary/5 border rounded-md font-mono text-sm font-medium">
                        {item.total.toFixed(2)} €
                      </div>
                    ) : (
                      <div className="h-10 flex items-center justify-center px-3 bg-sky-300 rounded-md text-black text-[10px] font-bold cursor-pointer">
                        <span className={cn(isRTL && "font-cairo")}>{isRTL ? 'اضغط واحسب من هنا' : 'Cliquez pour calculer'}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Mobile total */}
                <div className="sm:hidden flex justify-end">
                  {item.total > 0 ? (
                    <span className="text-sm font-medium font-mono bg-primary/10 px-3 py-1 rounded">
                      = {item.total.toFixed(2)} €
                    </span>
                  ) : (
                    <span className={cn("text-[11px] font-bold bg-sky-300 text-black px-3 py-1.5 rounded cursor-pointer", isRTL && "font-cairo")}>
                      {isRTL ? 'اضغط واحسب من هنا' : 'Cliquez pour calculer'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <StepButtons currentStep={2} totalSteps={WIZARD_STEPS.length} onPrev={handlePrevStep} onNext={handleNextStep} canProceed={canProceedFromStep(2)} isRTL={isRTL} />
      </>)}

      {/* === STEP 3: OPTIONS === */}
      {currentStep === 3 && (<>

          {/* REP / Waste Management (Optional) */}
          <Card className="border-gray-500/20 bg-gray-500/5">
            <CardContent className="p-4 space-y-3">
              <div className={cn(
                "flex items-center justify-between",
                isRTL && "flex-row-reverse"
              )}>
                <div className={cn(
                  "flex items-center gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <span className="text-lg">♻️</span>
                  <h4 className={cn(
                    "font-bold text-gray-700 dark:text-gray-300",
                    isRTL && "font-cairo"
                  )}>
                    {isRTL ? '♻️ إدارة النفايات / REP' : '♻️ Gestion des déchets / REP'}
                  </h4>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <Label 
                    htmlFor="waste-toggle" 
                    className={cn("text-sm", isRTL && "font-cairo")}
                  >
                    {isRTL ? 'أضيف؟' : 'Ajouter?'}
                  </Label>
                  <Switch
                    id="waste-toggle"
                    checked={includeWasteCosts}
                    onCheckedChange={setIncludeWasteCosts}
                  />
                </div>
              </div>
              <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-cairo")}>
                {isRTL 
                  ? 'اختياري — تكاليف إزالة النفايات وإعادة التدوير حسب نظام REP'
                  : 'Optionnel — Frais d\'évacuation et recyclage des déchets (REP Bâtiment)'}
              </p>
              
              {includeWasteCosts && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs", isRTL && "font-cairo")}>
                      {isRTL ? 'الوصف' : 'Description'}
                    </Label>
                    <Input
                      value={wasteDescription}
                      onChange={(e) => setWasteDescription(e.target.value)}
                      placeholder={isRTL ? 'مثال: إزالة الأنقاض' : 'Ex: Évacuation gravats et déchets'}
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
                      value={wastePrice}
                      onChange={(e) => setWastePrice(parseFloat(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

      <StepButtons currentStep={3} totalSteps={WIZARD_STEPS.length} onPrev={handlePrevStep} onNext={handleNextStep} canProceed={true} isRTL={isRTL} />
      </>)}

      {/* === STEP 6: PAIEMENT === */}
      {currentStep === 6 && (<>
          {/* Payment Terms - Conditions de Règlement */}
          <Card className="border-pink-200/60 bg-pink-50/30 dark:border-pink-800/30 dark:bg-pink-950/10">
            <CardContent className="p-4 space-y-4">
              {/* Pedagogical Alert */}
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
                <p className={cn("font-bold text-amber-800 dark:text-amber-300 text-sm mb-1", isRTL && "text-right font-cairo")}>
                  {isRTL ? '⚖️ احمي حقك / Protégez vos droits' : '⚖️ Protégez vos droits'}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Délai de paiement */}
                <div className="space-y-1.5">
                  <Label className={cn("text-xs", isRTL && "font-cairo")}>
                    {isRTL ? 'أجل الدفع' : 'Délai de paiement'}
                  </Label>
                  <select
                    value={delaiPaiement}
                    onChange={(e) => setDelaiPaiement(e.target.value)}
                    className="w-full bg-background border border-border text-foreground text-sm rounded-md focus:ring-primary focus:border-primary p-2"
                  >
                    <option value="immediate">{isRTL ? 'الدفع الفوري (عند الاستلام)' : 'Paiement immédiat (à réception)'}</option>
                    <option value="15jours">{isRTL ? '15 يوم' : '15 jours'}</option>
                    <option value="30jours">{isRTL ? '30 يوم (موصى به)' : '30 jours (recommandé)'}</option>
                    <option value="45jours">{isRTL ? '45 يوم' : '45 jours'}</option>
                    <option value="60jours">{isRTL ? '60 يوم' : '60 jours'}</option>
                    <option value="echeancier">{isRTL ? 'حسب جدول الدفعات' : 'Selon échéancier'}</option>
                  </select>
                </div>

                {/* Moyen de paiement */}
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

              {/* Payment Milestones (Échéancier) */}
              <div className="border-2 border-border/80 bg-muted/40 rounded-lg p-3 space-y-3">
                <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                    <span className="text-lg">📅</span>
                    <Label htmlFor="milestones-toggle" className={cn("text-sm font-bold cursor-pointer text-foreground", isRTL && "font-cairo")}>
                      {isRTL ? 'جدول دفعات متعدد (Échéancier)' : 'Échéancier de paiement'}
                    </Label>
                  </div>
                  <Switch
                    id="milestones-toggle"
                    className="data-[state=unchecked]:bg-muted-foreground/50 data-[state=checked]:bg-primary [&>span]:bg-white [&>span]:shadow-md"
                    checked={milestonesEnabled}
                    onCheckedChange={(checked) => {
                      setMilestonesEnabled(checked);
                      if (checked && paymentMilestones.length === 0) {
                        setPaymentMilestones([
                          { id: generateId(), label: 'Acompte à la commande', mode: 'percent', percent: 30 },
                          { id: generateId(), label: 'Fin de gros œuvre', mode: 'percent', percent: 40 },
                          { id: generateId(), label: 'Remise des clés', mode: 'percent', percent: 30 },
                        ]);
                      }
                      if (checked) {
                        setAcompteEnabled(false);
                        setDelaiPaiement('echeancier');
                      }
                    }}
                  />
                </div>

                {milestonesEnabled && (
                  <div className="space-y-3 pt-2">
                    {paymentMilestones.map((milestone, idx) => (
                      <div key={milestone.id} className="border border-border rounded-md p-2.5 space-y-2 bg-muted/30">
                        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                          <div className="flex-1 space-y-1">
                            {/* Arabic field — editable, syncs FR via dictionary */}
                            <Input
                              value={milestone.labelAr ?? milestoneLabelToArabic(milestone.label)}
                              onChange={(e) => {
                                const arValue = e.target.value;
                                const frFromDict = arabicToFrenchDisplay(arValue);
                                // If AR matches dictionary, update FR. Otherwise keep previous FR
                                // (so user's manual FR edits are not wiped by unknown AR text).
                                const nextLabel = frFromDict || milestone.label || arValue;
                                const updated = [...paymentMilestones];
                                updated[idx] = {
                                  ...updated[idx],
                                  label: nextLabel,
                                  labelAr: arValue,
                                };
                                setPaymentMilestones(updated);
                              }}
                              placeholder={'اسم المرحلة (AR)'}
                              dir="rtl"
                              lang="ar"
                              className="text-sm font-cairo text-right"
                            />
                            {/* French field — editable, syncs AR via dictionary */}
                            <Input
                              value={milestone.label}
                              onChange={(e) => {
                                const frValue = e.target.value;
                                const arFromDict = milestoneLabelToArabic(frValue);
                                // If FR matches dictionary, update AR. Otherwise keep previous AR.
                                const nextAr = arFromDict || milestone.labelAr || '';
                                const updated = [...paymentMilestones];
                                updated[idx] = {
                                  ...updated[idx],
                                  label: frValue,
                                  labelAr: nextAr,
                                };
                                setPaymentMilestones(updated);
                              }}
                              placeholder={"Nom de l'étape (FR)"}
                              dir="ltr"
                              lang="fr"
                              className="text-xs"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive"
                            onClick={() => setPaymentMilestones(prev => prev.filter(m => m.id !== milestone.id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
                          <select
                            value={milestone.mode}
                            onChange={(e) => {
                              const updated = [...paymentMilestones];
                              updated[idx] = { ...updated[idx], mode: e.target.value as 'percent' | 'fixed' };
                              setPaymentMilestones(updated);
                            }}
                            className="bg-background border border-border text-foreground text-xs rounded-md p-1.5 w-24"
                          >
                            <option value="percent">%</option>
                            <option value="fixed">€ fixe</option>
                          </select>
                          {milestone.mode === 'percent' ? (
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={milestone.percent || ''}
                              onChange={(e) => {
                                const updated = [...paymentMilestones];
                                updated[idx] = { ...updated[idx], percent: parseFloat(e.target.value) || 0 };
                                setPaymentMilestones(updated);
                              }}
                              placeholder="30"
                              className="text-xs font-mono w-20"
                            />
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={milestone.amount || ''}
                              onChange={(e) => {
                                const updated = [...paymentMilestones];
                                updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                                setPaymentMilestones(updated);
                              }}
                              placeholder="500.00"
                              className="text-xs font-mono w-24"
                            />
                          )}
                          <Input
                            type="text"
                            value={milestone.targetDate || ''}
                            onChange={(e) => {
                              const updated = [...paymentMilestones];
                              updated[idx] = { ...updated[idx], targetDate: e.target.value };
                              setPaymentMilestones(updated);
                            }}
                            placeholder={isRTL ? 'تاريخ (اختياري)' : 'Date (optionnel)'}
                            className="text-xs flex-1"
                          />
                        </div>
                        {/* Créer facture button — available when milestones are active */}
                        {(milestone.mode === 'percent' ? (milestone.percent || 0) > 0 : (milestone.amount || 0) > 0) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-[10px] gap-1 mt-1 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={async () => {
                              if (!user) {
                                toast({
                                  variant: 'destructive',
                                  title: isRTL ? 'خطأ' : 'Erreur',
                                  description: isRTL ? 'سجّل الدخول أولاً.' : 'Connectez-vous d’abord.',
                                });
                                return;
                              }
                              try {
                                const currentData = invoiceData;
                                const sourceDocumentNumber = isOfficialDocumentNumber(docNumber, 'devis')
                                  ? docNumber
                                  : await reserveOfficialDocumentNumber(user.id, 'devis');
                                const reservedDocumentNumber = await reserveOfficialDocumentNumber(user.id, 'facture');

                                setDocNumber(sourceDocumentNumber);

                                const prefill = {
                                  ...buildMilestoneInvoicePrefill({
                                    quote: {
                                      documentNumber: sourceDocumentNumber,
                                      clientName: currentData.client?.name || clientName,
                                      clientAddress: currentData.client?.address || clientAddress,
                                      clientPhone: currentData.client?.phone || clientPhone,
                                      clientEmail: currentData.client?.email || clientEmail,
                                      clientSiren: currentData.client?.siren || clientSiren,
                                      clientTvaIntra: currentData.client?.tvaIntra || clientTvaIntra,
                                      clientIsB2B: currentData.client?.isB2B || clientIsB2B,
                                      workSiteAddress: currentData.workSite?.address || workSiteAddress,
                                      natureOperation: currentData.natureOperation || natureOperation,
                                      totalTTC: currentData.total,
                                      documentData: currentData,
                                    },
                                    milestone,
                                    milestoneIndex: idx,
                                    totalMilestones: paymentMilestones.length,
                                  }),
                                  reservedDocumentNumber,
                                };

                                console.log('[InvoiceFormBuilder] Milestone → Créer facture PREFILL OK:', prefill);
                                sessionStorage.removeItem('quoteToInvoiceData');
                                sessionStorage.setItem('milestoneInvoiceData', JSON.stringify(prefill));
                                navigate('/pro/invoice-creator?type=facture&prefill=milestone');
                              } catch (error) {
                                console.error('[InvoiceFormBuilder] Milestone numbering error:', error);
                                toast({
                                  variant: 'destructive',
                                  title: isRTL ? 'خطأ في الترقيم' : 'Erreur de numérotation',
                                  description: isRTL
                                    ? 'تعذر إنشاء رقم رسمي للدوفي أو الفاتورة.'
                                    : 'Impossible de générer un numéro officiel pour le devis ou la facture.',
                                });
                              }
                            }}
                          >
                            <Receipt className="h-3 w-3" />
                            {isRTL ? 'أنشئ فاتورة' : 'Créer facture'}
                          </Button>
                        )}
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentMilestones(prev => [...prev, { id: generateId(), label: '', mode: 'percent', percent: 0 }])}
                      className="w-full text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {isRTL ? 'إضافة مرحلة' : 'Ajouter une étape'}
                    </Button>

                    {/* Summary */}
                    <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[10px] space-y-1">
                      {paymentMilestones.map((m) => {
                        const amt = m.mode === 'percent' 
                          ? (invoiceData.total * (m.percent || 0) / 100).toFixed(2) 
                          : (m.amount || 0).toFixed(2);
                        return (
                          <div key={m.id} className={cn("flex justify-between", isRTL && "flex-row-reverse")}>
                            <span className="text-amber-700 dark:text-amber-400 truncate">{m.label || '—'}</span>
                            <span className="font-mono font-bold text-amber-800 dark:text-amber-300">{amt} €</span>
                          </div>
                        );
                      })}
                      <div className={cn("flex justify-between pt-1 border-t border-amber-300 dark:border-amber-700", isRTL && "flex-row-reverse")}>
                        <span className="text-amber-900 dark:text-amber-200 font-bold">
                          {isRTL ? 'الباقي:' : 'Reste:'}
                        </span>
                        <span className="font-bold font-mono text-amber-900 dark:text-amber-200">
                          {(() => {
                            const totalPaid = paymentMilestones.reduce((sum, m) => sum + (m.mode === 'percent' ? invoiceData.total * (m.percent || 0) / 100 : (m.amount || 0)), 0);
                            return (invoiceData.total - totalPaid).toFixed(2);
                          })()} €
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview of generated text */}
              <div className="p-2 rounded bg-muted/50 border border-border">
                <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
                  📄 {invoiceData.paymentTerms}
                </p>
              </div>
            </CardContent>
          </Card>

      <StepButtons currentStep={6} totalSteps={WIZARD_STEPS.length} onPrev={handlePrevStep} onNext={handleNextStep} canProceed={true} isRTL={isRTL} />
      </>)}

      {/* === STEP 7: TVA & REMISE + RÉSUMÉ === */}
      {currentStep === 7 && (<>
          {/* TVA Settings - French Law Compliance */}
          <Card className="border-gray-500/20 bg-gray-500/5">
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
                    "font-bold text-gray-800 dark:text-gray-200",
                    isRTL && "font-cairo"
                  )}>
                    {isRTL ? 'الـ TVA (الضريبة)' : 'TVA'}
                  </h4>
                </div>
                
                {/* Auto-entrepreneur badge (read-only from profile) */}
                {isAutoEntrepreneur && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-700 dark:text-green-400 font-medium">
                    Auto-entrepreneur
                  </span>
                )}
              </div>

              {isAutoEntrepreneur ? (
                /* RULE 1: Auto-entrepreneur = locked 0% TVA */
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className={cn(
                      "text-sm text-green-700 dark:text-green-400 font-medium",
                      isRTL && "font-cairo text-right"
                    )}>
                      🔒 {isRTL 
                        ? 'TVA = 0% — مقفول تلقائي' 
                        : 'TVA = 0% — Verrouillé automatiquement'}
                    </p>
                    <p className={cn(
                      "text-xs text-green-600 dark:text-green-500 mt-1",
                      isRTL && "font-cairo text-right"
                    )}>
                      {isRTL
                        ? '"TVA non applicable – article 293 B du CGI" هتتكتب تلقائي في الدوكيمون'
                        : 'Mention légale "TVA non applicable – article 293 B du CGI" ajoutée automatiquement'}
                    </p>
                  </div>
                </div>
              ) : (
                /* RULE 2 & 3: Non auto-entrepreneur = project type selector */
                <div className="space-y-3">
                  <p className={cn(
                    "text-xs text-muted-foreground",
                    isRTL && "font-cairo text-right"
                  )}>
                    {isRTL 
                      ? 'اختر نوع الشانتي وهنحسبلك الضريبة تلقائي:' 
                      : 'Sélectionnez le type de chantier, la TVA sera calculée automatiquement :'}
                  </p>

                  <Select value={projectTvaType} onValueChange={(v) => setProjectTvaType(v as any)}>
                    <SelectTrigger className={cn("w-full", isRTL && "text-right font-cairo")}>
                      <SelectValue placeholder={isRTL ? 'اختر نوع الشانتي' : 'Type de chantier'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sous_traitance">
                        🤝 {isRTL ? 'مقاولة باطن' : 'Sous-traitance'} — TVA 0%
                      </SelectItem>
                      <SelectItem value="intracommunautaire">
                        🇪🇺 {isRTL ? 'زبون مهني في أوروبا' : 'Client professionnel en Europe'} — TVA 0%
                      </SelectItem>
                      <SelectItem value="logement_ancien">
                        🏠 {isRTL ? 'خاص — سكن قديم (أكثر من سنتين)' : 'Particulier – logement ancien (plus de 2 ans)'} — TVA 10%
                      </SelectItem>
                      <SelectItem value="logement_neuf">
                        🏗️ {isRTL ? 'خاص — سكن جديد' : 'Particulier – logement neuf'} — TVA 20%
                      </SelectItem>
                      <SelectItem value="local_pro">
                        🏢 {isRTL ? 'زبون مهني في فرنسا' : 'Client professionnel en France'} — TVA 20%
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Computed TVA result (read-only) */}
                  <div className={cn(
                    "p-3 rounded-lg border",
                    (projectTvaType === 'sous_traitance' || projectTvaType === 'intracommunautaire')
                      ? "bg-amber-500/10 border-amber-500/20" 
                      : "bg-primary/10 border-primary/20"
                  )}>
                    <p className={cn(
                      "text-sm font-medium",
                      (projectTvaType === 'sous_traitance' || projectTvaType === 'intracommunautaire')
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-primary",
                      isRTL && "font-cairo text-right"
                    )}>
                      {projectTvaType === 'sous_traitance' && (isRTL ? '📊 TVA = 0% (مقاولة باطن — Autoliquidation)' : '📊 TVA = 0% — Autoliquidation de la TVA – art. 283-2 du CGI')}
                      {projectTvaType === 'intracommunautaire' && (isRTL ? '📊 TVA = 0% (داخل أوروبا — إعفاء)' : '📊 TVA = 0% — Exonération – art. 262 ter I du CGI')}
                      {projectTvaType === 'logement_ancien' && (isRTL ? '📊 TVA = 10% (تجديد سكن قديم)' : '📊 TVA = 10% — art. 279-0 bis du CGI')}
                      {projectTvaType === 'logement_neuf' && (isRTL ? '📊 TVA = 20% (سكن جديد)' : '📊 TVA = 20% — art. 278 du CGI')}
                      {projectTvaType === 'local_pro' && (isRTL ? '📊 TVA = 20% (زبون مهني في فرنسا)' : '📊 TVA = 20% — législation en vigueur')}
                    </p>
                    <p className={cn(
                      "text-xs text-muted-foreground mt-1",
                      isRTL && "font-cairo text-right"
                    )}>
                      {isRTL ? 'TVA محسوبة تلقائياً حسب نوع الشانتي' : 'TVA calculée automatiquement selon le type de chantier'}
                    </p>
                  </div>

                  {/* RULE 5: Coherence alert - logement + B2B client */}
                  {(projectTvaType === 'logement_ancien' || projectTvaType === 'logement_neuf') && clientIsB2B && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <p className={cn(
                        "text-xs text-destructive font-medium",
                        isRTL && "font-cairo text-right"
                      )}>
                        ⚠️ {isRTL 
                          ? 'الزبون شركة والمشروع سكن — تأكد إن الشانتي فعلاً سكن وإلا اختار "محل مهني"'
                          : 'Le client est une entreprise mais le projet est un logement — vérifiez si le chantier est bien un logement'}
                      </p>
                    </div>
                  )}
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

            {/* Discount controls */}
            <div className={cn("space-y-2 py-2 px-3 rounded-lg border border-dashed", discountEnabled ? "border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800" : "border-border")}>
              <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <Label htmlFor="discount-toggle" className={cn("text-sm font-medium cursor-pointer", isRTL && "font-cairo")}>
                  {isRTL ? '🏷️ تطبيق خصم' : '🏷️ Appliquer une remise'}
                </Label>
                <Switch id="discount-toggle" checked={discountEnabled} onCheckedChange={setDiscountEnabled} />
              </div>
              {discountEnabled && (
                <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percent' | 'fixed')}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="fixed">€ fixe</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={discountType === 'percent' ? 100 : invoiceData.subtotal}
                    step={discountType === 'percent' ? 1 : 0.01}
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-24 h-8 text-sm font-mono"
                    placeholder={discountType === 'percent' ? '10' : '50.00'}
                  />
                  {invoiceData.discountAmount && invoiceData.discountAmount > 0 && (
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium font-mono">
                      - {invoiceData.discountAmount.toFixed(2)} €
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className={cn(
              "flex justify-between text-sm",
              isRTL && "flex-row-reverse"
            )}>
              <span className="text-muted-foreground">{invoiceData.tvaRate > 0 ? `TVA (${invoiceData.tvaRate}%) :` : 'TVA :'}</span>
              <span className="font-mono font-medium">{invoiceData.tvaAmount.toFixed(2)} €</span>
            </div>

            {invoiceData.discountAmount && invoiceData.discountAmount > 0 && (
              <div className={cn(
                "flex justify-between text-sm font-semibold",
                isRTL && "flex-row-reverse"
              )}>
                <span className="text-muted-foreground">
                  {isRTL ? 'الخصم:' : `Remise${invoiceData.discountType === 'percent' ? ` (${invoiceData.discountValue}%)` : ''} :`}
                </span>
                <span className="font-mono font-medium text-destructive">- {invoiceData.discountAmount.toFixed(2)} €</span>
              </div>
            )}

            {invoiceData.tvaExempt ? (
              <div className={cn(
                "text-xs text-muted-foreground italic",
                isRTL && "text-right font-cairo"
              )}>
                TVA non applicable, art. 293 B du CGI
              </div>
            ) : invoiceData.tvaRate === 0 ? (
              <div className={cn(
                "text-xs text-amber-600 dark:text-amber-400 italic",
                isRTL && "text-right font-cairo"
              )}>
                Autoliquidation de la TVA – art. 283-2 du CGI
              </div>
            ) : null}
            
            <div className={cn(
              "flex justify-between text-lg font-bold pt-2 border-t",
              isRTL && "flex-row-reverse"
            )}>
              <span>{isRTL ? 'الإجمالي:' : 'Total TTC:'}</span>
              <span className="font-mono text-primary">{invoiceData.total.toFixed(2)} €</span>
            </div>
          </div>

      {/* Photo Attachment Toggle - shown only when photos exist */}
      {sitePhotos.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 space-y-2">
            <div className={cn("flex items-center justify-between gap-3", isRTL && "flex-row-reverse")}>
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <span className="text-lg">📷</span>
                <Label htmlFor="photo-toggle" className={cn("text-sm font-bold cursor-pointer", isRTL && "font-cairo")}>
                  {isRTL ? 'هل تحب تضيف الصور في الـ PDF؟' : 'Souhaitez-vous joindre les photos au PDF ?'}
                </Label>
              </div>
              <Switch
                id="photo-toggle"
                checked={includePhotosInPdf}
                onCheckedChange={setIncludePhotosInPdf}
              />
            </div>
            <p className={cn("text-[10px] text-muted-foreground leading-tight", isRTL && "text-right font-cairo")}>
              {includePhotosInPdf
                ? (isRTL ? `✅ ${sitePhotos.length} صورة هتتضاف في صفحة "Annexe Photos" بعد الصفحة الرئيسية.` : `✅ ${sitePhotos.length} photo(s) seront ajoutées en annexe (page 2+).`)
                : (isRTL ? '📊 الصور هتتستخدم بس في تحليل الأسعار، ومش هتظهر في الـ PDF.' : '📊 Les photos seront utilisées uniquement pour l\'analyse IA, sans apparaître dans le PDF.')}
            </p>
          </CardContent>
        </Card>
      )}

      <StepButtons currentStep={7} totalSteps={WIZARD_STEPS.length} onPrev={handlePrevStep} onNext={() => {}} canProceed={true} isRTL={isRTL} />
      </>)}

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

          <Button
            onClick={saveToDocumentsComptables}
            disabled={isSavingOfficialDocument}
            size="lg"
            className={cn("w-full py-6 text-base font-bold gap-2", isRTL && "font-cairo flex-row-reverse")}
          >
            {isSavingOfficialDocument ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {isSavingOfficialDocument
              ? (isRTL ? '⏳ جاري التحقق والحفظ' : '⏳ Validation et enregistrement...')
              : (isRTL ? '✅ تأكيد وتسجيل' : '✅ Valider et enregistrer')}
          </Button>

          <div className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse"
          )}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleFinishDocument}
              className={cn(isRTL && "font-cairo")}
            >
              {isRTL ? 'تأكيد وانهاء' : 'Confirmer et terminer'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                persistCurrentDocumentState({ showPreview: false });
                setShowPreview(false);
              }}
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
                onBeforeExport={prepareFreshAssetsForExport}
            isPaid={true} /* TRIAL PHASE: set to false to reactivate payments */
          />

          <ProtectedDocumentWrapper
            documentType={prefillData?.source === 'smart_devis' ? 'smart_devis' : documentType}
            returnPath={`/pro/invoice-creator?type=${documentType}`}
          >
            <div ref={invoiceRef} className="print-area">
              <InvoiceDisplay 
                data={invoiceData} 
                showArabic={showArabic}
                onConvertToFacture={documentType === 'devis' && onDocumentTypeChange ? () => {
                  onDocumentTypeChange('facture');
                } : undefined}
              />
            </div>
          </ProtectedDocumentWrapper>
        </div>
      ) : currentStep === WIZARD_STEPS.length - 1 ? (
        <div className="space-y-4">
          {/* Validation Checklist with step navigation */}
          <ValidationChecklist
            input={{
              clientName,
              clientAddress,
              items,
              includeTravelCosts,
              travelPrice,
              subtotal: invoiceData.subtotal,
              tvaRate: invoiceData.tvaRate,
              tvaAmount: invoiceData.tvaAmount,
              total: invoiceData.total,
              tvaExempt: isAutoEntrepreneur || projectTvaType === 'sous_traitance',
              discountEnabled,
              discountValue,
              discountType,
              moyenPaiement,
              acompteEnabled,
              acomptePercent,
              acompteMode,
              acompteFixedAmount,
              milestonesEnabled,
              paymentMilestones,
              docNumber,
              documentType,
            }}
            onNavigateToStep={(step) => {
              persistCurrentDocumentState({ currentStep: step });
              saveCurrentDraftSnapshot();
              setCurrentStep(step);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {/* Action Buttons - Reorganized */}
          <div className={cn(
            "grid grid-cols-1 gap-3",
            isRTL && "font-cairo"
          )}>
            {/* Primary: Generate PDF */}
            <Button
              onClick={async () => {
                try {
                  const ok = await ensureTranslations();
                  if (!ok) return;
                  const missingFields: string[] = [];
                  if (!clientName.trim()) {
                    missingFields.push(isRTL ? '👤 اسم الزبون' : '👤 Nom du client');
                  }
                  if (!clientAddress.trim()) {
                    missingFields.push(isRTL ? '📍 عنوان الفاكتير' : '📍 Adresse de facturation');
                  }
                  // docNumber is auto-assigned at finalization — no validation needed here
                  const clientSirenDigits = clientSiren.replace(/\s/g, '');
                  if (clientIsB2B && !clientSirenDigits) {
                    missingFields.push(isRTL ? '🏢 رقم SIRET الزبون (إجباري B2B)' : '🏢 SIRET du client (obligatoire B2B)');
                  } else if (clientIsB2B && clientSirenDigits && ![9, 14].includes(clientSirenDigits.length)) {
                    missingFields.push(isRTL ? '🏢 رقم SIRET الزبون (9 أو 14 رقم)' : '🏢 SIRET client invalide (9 ou 14 chiffres)');
                  }
                  if (!workSiteSameAsClient && !workSiteAddress.trim()) {
                    missingFields.push(isRTL ? '🏗️ عنوان الشانتييه' : '🏗️ Adresse du chantier');
                  }
                  const hasValidItem = items.some(item => item.designation_fr.trim() && Number(item.unitPrice) > 0);
                  if (!hasValidItem && !(includeTravelCosts && travelPrice > 0)) {
                    missingFields.push(isRTL ? '📋 بند واحد على الأقل بسعره' : '📋 Au moins une prestation avec un prix');
                  }
                   if (missingFields.length > 0) {
                    // Map field emoji to step index for click-to-navigate
                    const fieldToStep: Record<string, number> = {
                      '👤': 0, '📍': 0, '🔢': 3, '🏢': 0, '🏗️': 4, '📋': 2,
                    };
                    const getStepForField = (f: string): number => {
                      for (const [emoji, step] of Object.entries(fieldToStep)) {
                        if (f.startsWith(emoji)) return step;
                      }
                      return 0;
                    };
                    toast({
                      variant: "destructive",
                      title: isRTL ? "⚠️ في حاجات ناقصة" : "⚠️ Données manquantes",
                      description: (
                        <div className="mt-2 space-y-1">
                          <p className={cn("font-medium", isRTL && "font-cairo text-right")}>
                            {isRTL ? 'كمّل الخانات دي — اضغط للتصحيح:' : 'Complétez ces champs — cliquez pour corriger:'}
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
                                ) : (
                                  <button
                                    onClick={() => {
                                      const targetStep = getStepForField(field);
                                      setCurrentStep(targetStep);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="underline hover:opacity-80 cursor-pointer w-full text-right"
                                  >
                                    {field} ←
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ),
                    });
                    return;
                  }
                  setShowChecklist(true);
                } catch (err) {
                  const technicalMessage = getTechnicalErrorMessage(err);
                  console.error('Preview validation error:', err);
                  toast({
                    variant: "destructive",
                    title: isRTL ? "⚠️ خطأ تقني" : "⚠️ Erreur technique",
                    description: technicalMessage,
                  });
                }
              }}
              size="lg"
              className={cn(
                "w-full py-6 text-base font-bold gap-2",
                allSectionsComplete 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : "",
                isRTL && "font-cairo flex-row-reverse"
              )}
            >
              <Check className="h-5 w-5" />
              {isRTL ? '👁️ افتح المعاينة قبل التأكيد' : '👁️ Ouvrir l’aperçu avant validation'}
            </Button>

            {/* Secondary row */}
            <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className={cn("flex-1", isRTL && "font-cairo")}
              >
                {isRTL ? '← رجوع' : '← Retour'}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFinishDocument}
                className={cn("text-destructive hover:text-destructive", isRTL && "font-cairo")}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      
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
        onConfirm={async () => {
          setShowChecklist(false);
          persistCurrentDocumentState({ showPreview: true });
          setShowPreview(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        items={items}
      />
      
      {/* Unit Guide Modal */}
      <UnitGuideModal
        open={showUnitGuide}
        onOpenChange={setShowUnitGuide}
        onSelectUnit={(unitValue) => {
          if (unitGuideTargetItemId) {
            handleItemChange(unitGuideTargetItemId, 'unit', unitValue);
          }
          setUnitGuideTargetItemId(null);
        }}
      />
    </div>
  );
};

export default InvoiceFormBuilder;
