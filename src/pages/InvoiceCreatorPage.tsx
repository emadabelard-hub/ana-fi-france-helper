import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, PenLine, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/auth/AuthModal';
import DocumentTypeModal from '@/components/invoice/DocumentTypeModal';
import InvoiceFormBuilder from '@/components/invoice/InvoiceFormBuilder';
import InvoiceGuideModal from '@/components/invoice/InvoiceGuideModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const InvoiceCreatorPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get document type from URL or show modal
  const urlDocType = searchParams.get('type') as 'devis' | 'facture' | null;
  const prefillSource = searchParams.get('prefill');
  
  const [documentType, setDocumentType] = useState<'devis' | 'facture' | null>(urlDocType);
  const [showTypeModal, setShowTypeModal] = useState(!urlDocType);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [prefillData, setPrefillData] = useState<any>(null);
  
  // Sync URL with document type and check for prefill data
  useEffect(() => {
    if (urlDocType && !documentType) {
      setDocumentType(urlDocType);
      setShowTypeModal(false);
    }
    
    // Check for prefill data from quote-to-invoice
    if (prefillSource === 'quote') {
      const storedData = sessionStorage.getItem('quoteToInvoiceData');
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          setPrefillData(parsed);
          // Clear after reading
          sessionStorage.removeItem('quoteToInvoiceData');
        } catch (e) {
          console.error('Failed to parse prefill data:', e);
        }
      }
    }
  }, [urlDocType, documentType, prefillSource]);
  
  // Handle document type selection
  const handleTypeSelect = (type: 'devis' | 'facture') => {
    setDocumentType(type);
    setShowTypeModal(false);
    // Update URL
    setSearchParams({ type });
  };
  
  // Handle back to type selection
  const handleBackToTypeSelection = () => {
    setDocumentType(null);
    setShowTypeModal(true);
    setSearchParams({});
  };
  
  // Handle navigation back to Pro page
  const handleNavigateBack = () => {
    navigate('/pro');
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
            onBack={handleBackToTypeSelection}
            prefillData={prefillData}
            onDocumentTypeChange={(type) => {
              setDocumentType(type);
              setSearchParams({ type });
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
            // If closing without selection, go back
            navigate('/pro');
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
    </div>
  );
};

export default InvoiceCreatorPage;
