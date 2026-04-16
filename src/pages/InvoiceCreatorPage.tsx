import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, PenLine, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/auth/AuthModal';
import DocumentTypeModal from '@/components/invoice/DocumentTypeModal';
import SecurityBadge from '@/components/shared/SecurityBadge';
import InvoiceFormBuilder from '@/components/invoice/InvoiceFormBuilder';
import InvoiceGuideModal from '@/components/invoice/InvoiceGuideModal';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { clearCurrentDocument, clearDraft, loadCurrentDocument } from '@/lib/invoiceDraftStorage';
import NumberingOnboardingModal from '@/components/invoice/NumberingOnboardingModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

// Version 1.1.2 - Stable Build
const InvoiceCreatorPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Get document type from URL or show modal
  const urlDocType = searchParams.get('type') as 'devis' | 'facture' | null;
  const prefillSource = searchParams.get('prefill');
  const isSmartDevisFlow = prefillSource === 'smart';
  const isMilestonePrefillFlow = prefillSource === 'milestone';
  const expectsStoredPrefill = prefillSource === 'quote' || isSmartDevisFlow || isMilestonePrefillFlow;
  const resumedDocumentType = !urlDocType && !prefillSource
    ? loadCurrentDocument()?.documentType ?? null
    : null;
  
  const urlSource = searchParams.get('source');
  const isImageQuoteFlow = urlSource === 'image-quote';

  const [documentType, setDocumentType] = useState<'devis' | 'facture' | null>(urlDocType ?? resumedDocumentType);
  const [showTypeModal, setShowTypeModal] = useState(!urlDocType && !resumedDocumentType);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [showNumberingOnboarding, setShowNumberingOnboarding] = useState(false);
  const [numberingChecked, setNumberingChecked] = useState(false);
  // Track whether this is a fresh new document (user chose type from modal, not a resume)
  const [isNewDocument, setIsNewDocument] = useState(false);
  const activeDocumentType = urlDocType ?? documentType;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const SCROLL_KEY = 'invoiceCreator_scroll_v1';

  // Restore scroll position when form is shown for the same document type (not on new doc)
  useEffect(() => {
    if (!activeDocumentType || isNewDocument) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.docType === activeDocumentType && typeof data.top === 'number') {
        // Defer to allow content to render
        requestAnimationFrame(() => {
          el.scrollTop = data.top;
        });
      }
    } catch {}
  }, [activeDocumentType, isNewDocument]);

  // Save scroll position continuously
  useEffect(() => {
    if (!activeDocumentType) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
            docType: activeDocumentType,
            top: el.scrollTop,
          }));
        } catch {}
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [activeDocumentType]);

  // Check if numbering onboarding is needed (first time creating a document)
  useEffect(() => {
    if (!user || numberingChecked) return;
    const onboarded = localStorage.getItem(`numbering_onboarded_${user.id}`);
    if (!onboarded && activeDocumentType) {
      setShowNumberingOnboarding(true);
    }
    setNumberingChecked(true);
  }, [user, activeDocumentType, numberingChecked]);

  const prefillData = useMemo(() => {
    // --- NEW: Image Quote To Invoice flow ---
    if (isImageQuoteFlow) {
      try {
        const raw = sessionStorage.getItem('imageQuoteToInvoiceData');
        if (!raw) {
          console.log('NO imageQuoteToInvoiceData FOUND');
          return null;
        }
        const parsed = JSON.parse(raw);
        console.log('READ imageQuoteToInvoiceData', parsed);
        if (parsed?.items?.length > 0) {
          // Transform to InvoiceFormBuilder expected shape
          const transformed = {
            source: 'image_quote_to_invoice',
            clientName: parsed.clientName || '',
            clientAddress: parsed.clientAddress || '',
            clientPhone: parsed.clientPhone || '',
            descriptionChantier: parsed.description || '',
            items: parsed.items.map((it: any) => ({
              designation_fr: it.designation || '',
              designation_ar: '',
              quantity: Number(it.quantity) || 1,
              unit: it.unit || 'forfait',
              unitPrice: Number(it.unitPrice) || 0,
            })),
            notes: '',
          };
          console.log('[InvoiceCreator] ✅ Prefill from imageQuoteToInvoiceData:', transformed.items.length, 'items');
          return transformed;
        }
      } catch (error) {
        console.error('[InvoiceCreator] Failed to parse imageQuoteToInvoiceData:', error);
      }
      return null;
    }

    if (!expectsStoredPrefill) {
      return null;
    }

    const storageKey = isMilestonePrefillFlow ? 'milestoneInvoiceData' : 'quoteToInvoiceData';

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        console.log(`NO ${storageKey} FOUND`);
        console.log('[DEBUG] All sessionStorage keys:', Object.keys(sessionStorage));
        return null;
      }

      const parsed = JSON.parse(raw);
      console.log(`READ ${storageKey}`, parsed);
      if (parsed?.items?.length > 0) {
        if (isMilestonePrefillFlow) {
          sessionStorage.removeItem(storageKey);
        }
        console.log(`[InvoiceCreator] ✅ Prefill from ${storageKey}:`, parsed.items.length, 'items');
        return parsed;
      }

      console.warn(`[InvoiceCreator] ${storageKey} is present but invalid:`, parsed);
    } catch (error) {
      console.error(`[InvoiceCreator] Failed to parse ${storageKey}:`, error);
    }

    console.log('[InvoiceCreator] No valid quote data found');
    return null;
  }, [expectsStoredPrefill, isImageQuoteFlow, isMilestonePrefillFlow]);

  const missingQuoteData = (expectsStoredPrefill || isImageQuoteFlow) && !prefillData;

  // Navigation guard: block leaving when a document type is selected (form is active)
  const hasUnsavedWork = !!activeDocumentType && !missingQuoteData;
  const { showLeaveDialog, requestLeave, confirmLeave, cancelLeave } = useNavigationGuard(hasUnsavedWork);
  
  // Sync URL with document type (no more prefill loading here — done synchronously above)
  useEffect(() => {
    if (urlDocType && documentType !== urlDocType) {
      setDocumentType(urlDocType);
      setShowTypeModal(false);
    }
  }, [urlDocType, documentType]);

  useEffect(() => {
    if (!urlDocType && documentType) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('type', documentType);
        return next;
      });
    }
  }, [urlDocType, documentType, setSearchParams]);
  
  // Handle document type selection
  const handleTypeSelect = (type: 'devis' | 'facture') => {
    // CRITICAL: Clear previous document state so new document starts clean
    clearCurrentDocument();
    clearDraft();
    // Also clear LineItemEditor persistence and saved scroll position
    try { localStorage.removeItem('lineItemEditor_items_v1'); } catch {}
    try { sessionStorage.removeItem('invoiceCreator_scroll_v1'); } catch {}
    setIsNewDocument(true);
    setDocumentType(type);
    setShowTypeModal(false);
    // Update URL
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('type', type);
      if (isSmartDevisFlow) next.set('prefill', 'smart');
      else next.delete('prefill');
      return next;
    });
  };
  
  
  const buildSmartDevisReturnState = () => {
    try {
      const raw = sessionStorage.getItem('smartDevisWizardState');
      const wizardSnapshot = raw ? JSON.parse(raw) : null;
      return wizardSnapshot
        ? { restoreWizard: true, wizardSnapshot }
        : { restoreWizard: true };
    } catch {
      return { restoreWizard: true };
    }
  };

  // Handle navigation back (guarded)
  const handleNavigateBack = () => {
    if (isSmartDevisFlow) {
      navigate('/pro/smart-devis', {
        state: buildSmartDevisReturnState(),
      });
      return;
    }

    requestLeave(() => {
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }

      navigate('/pro');
    });
  };
  
  // Handle back to type selection (guarded)
  const handleBackToTypeSelection = () => {
    requestLeave(() => {
      setDocumentType(null);
      setShowTypeModal(true);
      setSearchParams({});
    });
  };

  const handleFormBack = () => {
    if (expectsStoredPrefill) {
      handleNavigateBack();
      return;
    }
    handleBackToTypeSelection();
  };
  
  // Show loading while profile loads
  if (user && profileLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="animate-pulse text-muted-foreground">
          {isRTL ? 'جاري التحميل...' : 'Chargement...'}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <section className={cn(
        "flex items-center gap-4 py-4 shrink-0",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNavigateBack}
          className="shrink-0"
        >
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn(
          "flex items-center gap-3 flex-1",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <PenLine className="h-5 w-5 text-green-600" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn(
              "text-lg font-bold text-foreground",
              isRTL && "font-cairo"
            )}>
              {activeDocumentType === 'devis' 
                ? (isRTL ? 'إنشاء عرض سعر (Devis)' : 'Créer un Devis')
                : activeDocumentType === 'facture'
                  ? (isRTL ? 'إنشاء فاتورة (Facture)' : 'Créer une Facture')
                  : (isRTL ? 'اعمل فواتيرك ودوفيهاتك معانا' : 'Factures & Devis')}
            </h1>
            <p className={cn(
              "text-xs text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'أداة احترافية للمستندات المهنية' : 'Outil professionnel de création'}
            </p>
          </div>
        </div>
        
        {/* Education Mode Button */}
        <button
          onClick={() => setShowEducationModal(true)}
          className={cn(
            "flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors",
            isRTL && "flex-row-reverse font-cairo"
          )}
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">{isRTL ? 'إيه الفرق؟' : 'Facture vs Devis?'}</span>
        </button>
      </section>

      {/* Main Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-4">
        {missingQuoteData ? (
          <div className="flex items-center justify-center h-full">
            <p className={cn(
              "text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              No quote data found
            </p>
          </div>
        ) : activeDocumentType ? (
          <InvoiceFormBuilder 
            key={`${activeDocumentType}-${prefillSource ?? urlSource ?? 'none'}-${prefillData?.source ?? 'base'}-${prefillData?.sourceDocumentId ?? prefillData?.sourceDocumentNumber ?? 'local'}-${prefillData?.milestoneId ?? 'default'}`}
            documentType={activeDocumentType}
            onBack={handleFormBack}
            prefillData={prefillData}
            skipDraftRestore={isNewDocument && !prefillData}
            onDocumentTypeChange={(type) => {
              setDocumentType(type);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('type', type);
                if (prefillSource) next.set('prefill', prefillSource);
                else next.delete('prefill');
                return next;
              });
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className={cn(
              "text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'اختر نوع المستند للبدء' : 'Sélectionnez un type de document'}
            </p>
          </div>
        )}
      </div>

      {/* Document Type Selection Modal */}
      <DocumentTypeModal
        open={showTypeModal}
        onOpenChange={(open) => {
          if (!open && !documentType) {
            if (isSmartDevisFlow) {
              navigate('/pro/smart-devis', { state: buildSmartDevisReturnState() });
              return;
            }
            if (prefillSource === 'quote' || prefillSource === 'milestone') {
              handleNavigateBack();
              return;
            }
            // Don't auto-redirect to home — keep the modal open or let user use back button
            return;
          }
          setShowTypeModal(open);
        }}
        onSelect={handleTypeSelect}
      />

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      
      <NumberingOnboardingModal
        open={showNumberingOnboarding}
        onOpenChange={setShowNumberingOnboarding}
        onComplete={() => setShowNumberingOnboarding(false)}
      />
      
      {/* Education Modal */}
      <Dialog open={showEducationModal} onOpenChange={setShowEducationModal}>
        <DialogContent className={cn("max-w-md", isRTL && "font-cairo")}>
          <DialogHeader>
            <DialogTitle className={cn(isRTL && "text-right font-cairo")}>
              {isRTL ? '📚 إيه الفرق بين الفاتورة والدوفي؟' : '📚 Différence entre Facture et Devis'}
            </DialogTitle>
          </DialogHeader>
          
          <div className={cn("space-y-4 text-sm", isRTL && "text-right")}>
            {/* Devis Section */}
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-2">
                {isRTL ? '📝 التقدير (Devis)' : '📝 Le Devis'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL 
                  ? 'ده عرض سعر قبل ما تبدأ الشغل. لما العميل يوقع عليه، بيبقى عقد ملزم للطرفين. يعني لازم تلتزم بالسعر اللي كتبته.'
                  : "C'est une proposition de prix avant les travaux. Une fois signé par le client, il devient un contrat engageant les deux parties."
                }
              </p>
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                {isRTL ? '⚠️ مهم: لما توقع، مفيش تغيير في السعر!' : '⚠️ Important: Une fois signé, le prix est fixe!'}
              </div>
            </div>

            {/* Facture Section */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <h3 className="font-bold text-primary mb-2">
                {isRTL ? '🧾 الفاتورة (Facture)' : '🧾 La Facture'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL 
                  ? 'دي بتتعمل بعد ما تخلص الشغل. بتطلب فيها الفلوس من العميل. لازم تحتوي على كل البيانات القانونية (SIRET، التاريخ، رقم الفاتورة، إلخ).'
                  : "Elle est émise après les travaux pour demander le paiement. Elle doit contenir toutes les mentions légales obligatoires."
                }
              </p>
              <div className="mt-2 text-xs text-primary">
                {isRTL ? '💰 العميل لازم يدفع خلال 30 يوم (عادةً)' : '💰 Le client doit payer sous 30 jours (généralement)'}
              </div>
            </div>

            {/* TVA Section */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-secondary">
              <h3 className="font-bold text-secondary-foreground mb-2">
                {isRTL ? '💶 الضريبة (TVA)' : '💶 La TVA'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL 
                  ? 'لو Auto-entrepreneur: مفيش TVA (هتكتب: TVA non applicable). لو شركة: 10% للتجديد، 20% للبناء الجديد.'
                  : "Auto-entrepreneur: pas de TVA. Société: 10% rénovation, 20% construction neuve."
                }
              </p>
            </div>

            {/* Summary */}
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-muted-foreground text-xs">
                {isRTL 
                  ? '💡 باختصار: الدوفي = قبل الشغل | الفاتورة = بعد الشغل'
                  : '💡 En résumé: Devis = Avant | Facture = Après'
                }
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation Guard Dialog */}
      <AlertDialog open={showLeaveDialog}>
        <AlertDialogContent className={cn(isRTL && "font-cairo")}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(isRTL && "text-right")}>
              {isRTL ? '⚠️ تنبيه' : '⚠️ Attention'}
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && "text-right")}>
              {isRTL 
                ? 'عندك تعديلات مش محفوظة. تحب تحفظ المسودة قبل ما تطلع؟'
                : 'Vous avez des modifications non enregistrées. Voulez-vous sauvegarder le brouillon avant de quitter ?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn("flex flex-col gap-2 sm:flex-col", isRTL && "items-stretch")}>
            <AlertDialogAction 
              onClick={() => {
                // Draft is already auto-saved, just leave silently
                confirmLeave();
              }} 
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
            >
              {isRTL ? '💾 احفظ المسودة واطلع' : '💾 Sauvegarder et quitter'}
            </AlertDialogAction>
            <AlertDialogAction 
              onClick={() => {
                clearDraft();
                 clearCurrentDocument();
                confirmLeave();
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
            >
              {isRTL ? '🗑️ اطلع من غير حفظ' : '🗑️ Quitter sans sauvegarder'}
            </AlertDialogAction>
            <AlertDialogCancel onClick={cancelLeave} className="w-full mt-0">
              {isRTL ? 'لا، كمّل الشغل' : 'Non, continuer'}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SecurityBadge />
    </div>
  );
};

export default InvoiceCreatorPage;
