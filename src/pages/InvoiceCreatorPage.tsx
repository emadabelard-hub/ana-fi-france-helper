import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
import { useToast } from '@/hooks/use-toast';
import { clearCurrentDocument, clearDraft, loadCurrentDocument } from '@/lib/invoiceDraftStorage';
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
  const { toast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Get document type from URL or show modal
  const urlDocType = searchParams.get('type') as 'devis' | 'facture' | null;
  const prefillSource = searchParams.get('prefill');
  const smartDevisReturnState = (location.state as { smartDevisReturnState?: { restoreWizard?: boolean; wizardSnapshot?: any } } | null)?.smartDevisReturnState;
  const smartDevisDataFromState = (location.state as { smartDevisData?: any } | null)?.smartDevisData;
  const isSmartDevisFlow = prefillSource === 'smart' || !!smartDevisReturnState || !!smartDevisDataFromState;
  const resumedDocumentType = !urlDocType && !prefillSource
    ? loadCurrentDocument()?.documentType ?? null
    : null;
  
  const [documentType, setDocumentType] = useState<'devis' | 'facture' | null>(urlDocType ?? resumedDocumentType);
  const [showTypeModal, setShowTypeModal] = useState(!urlDocType && !resumedDocumentType);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  // CRITICAL: Initialize prefillData SYNCHRONOUSLY to prevent draft restore race condition.
  // Do NOT remove storage keys here — defer cleanup to useEffect to survive React double-mount.
  const [prefillData, setPrefillData] = useState<any>(() => {
    // === Source 1: location.state (highest priority) ===
    const stateData = (location.state as any)?.smartDevisData;
    if (stateData && stateData.items?.length > 0) {
      console.log('[InvoiceCreator] Prefill from location.state:', stateData.items.length, 'items');
      return stateData;
    }

    // === Source 2: sessionStorage 'smartDevisData' ===
    if (isSmartDevisFlow || prefillSource === 'smart') {
      for (const storage of [sessionStorage, localStorage]) {
        try {
          const raw = storage.getItem('smartDevisData');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.items?.length > 0) {
              console.log('[InvoiceCreator] Prefill from', storage === sessionStorage ? 'sessionStorage' : 'localStorage', '(smartDevisData):', parsed.items.length, 'items');
              return parsed;
            }
          }
        } catch (e) {
          console.error('Failed to parse smartDevisData:', e);
        }
      }
    }

    // === Source 3: sessionStorage 'quoteToInvoiceData' ===
    if (prefillSource === 'quote') {
      try {
        const raw = sessionStorage.getItem('quoteToInvoiceData');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed) {
            console.log('[InvoiceCreator] Prefill from sessionStorage (quoteToInvoiceData)');
            return parsed;
          }
        }
      } catch (e) {
        console.error('Failed to parse quoteToInvoiceData:', e);
      }
    }

    return null;
  });

  // Cleanup storage AFTER prefillData is confirmed loaded (survives React double-mount)
  useEffect(() => {
    if (!prefillData) return;
    const cleanup = setTimeout(() => {
      try {
        sessionStorage.removeItem('smartDevisData');
        localStorage.removeItem('smartDevisData');
        sessionStorage.removeItem('quoteToInvoiceData');
      } catch { /* ignore */ }
    }, 2000);
    return () => clearTimeout(cleanup);
  }, [prefillData]);
  
  // Navigation guard: block leaving when a document type is selected (form is active)
  const hasUnsavedWork = !!documentType && !isSmartDevisFlow;
  const { showLeaveDialog, requestLeave, confirmLeave, cancelLeave } = useNavigationGuard(hasUnsavedWork);
  
  // Sync URL with document type (no more prefill loading here — done synchronously above)
  useEffect(() => {
    if (urlDocType && !documentType) {
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
    // (no reuse of TVA, discount, project type, etc. from previous document)
    clearCurrentDocument();
    clearDraft();
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
    if (smartDevisReturnState) return smartDevisReturnState;

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
    if (isSmartDevisFlow) {
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
              {documentType === 'devis' 
                ? (isRTL ? 'إنشاء عرض سعر (Devis)' : 'Créer un Devis')
                : documentType === 'facture'
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
      <div className="flex-1 overflow-y-auto pb-4">
        {documentType ? (
          <InvoiceFormBuilder 
            documentType={documentType}
            onBack={handleFormBack}
            prefillData={prefillData}
            onDocumentTypeChange={(type) => {
              setDocumentType(type);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('type', type);
                if (isSmartDevisFlow) next.set('prefill', 'smart');
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
            // Don't auto-redirect to home — keep the modal open or let user use back button
            return;
          }
          setShowTypeModal(open);
        }}
        onSelect={handleTypeSelect}
      />

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      
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
