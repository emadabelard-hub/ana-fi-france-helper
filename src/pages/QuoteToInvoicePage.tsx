import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Upload, FileText, Image, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/auth/AuthModal';
import QuoteToInvoiceIcon from '@/components/pro/QuoteToInvoiceIcon';
import { supabase } from '@/integrations/supabase/client';
import { compressImage, isImageData } from '@/lib/imageCompression';

interface ExtractedData {
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

const QuoteToInvoicePage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleNavigateBack = () => {
    navigate('/pro');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: isRTL ? "نوع ملف غير مدعوم" : "Type de fichier non supporté",
        description: isRTL 
          ? "يرجى تحميل صورة (JPG, PNG) أو PDF" 
          : "Veuillez télécharger une image (JPG, PNG) ou un PDF",
      });
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: isRTL ? "الملف كبير جداً" : "Fichier trop volumineux",
        description: isRTL ? "الحد الأقصى 10 ميغابايت" : "Maximum 10 Mo",
      });
      return;
    }

    setUploadedFile(file);
    setError(null);
    setExtractedData(null);

    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let base64Data: string;
      let mimeType = uploadedFile.type;

      // First read file as base64
      const reader = new FileReader();
      const fullBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      // Remove data:...;base64, prefix to get raw base64
      base64Data = fullBase64.split(',')[1];

      // If it's an image, compress it
      if (uploadedFile.type.startsWith('image/') && isImageData(fullBase64)) {
        try {
          const compressedBase64 = await compressImage(fullBase64);
          // Extract just the base64 part (remove data:image/jpeg;base64,)
          base64Data = compressedBase64.split(',')[1];
          mimeType = 'image/jpeg'; // Compression converts to JPEG
        } catch (compressError) {
          console.warn('Compression failed, using original:', compressError);
        }
      }

      // Call edge function to analyze document
      const { data, error: fnError } = await supabase.functions.invoke('quote-to-invoice', {
        body: {
          document: base64Data,
          mimeType,
          fileName: uploadedFile.name,
        },
      });

      if (fnError) {
        let detailMsg = fnError.message || 'Unknown error';
        try {
          if (fnError.context?.body) {
            const body = typeof fnError.context.body === 'string' ? JSON.parse(fnError.context.body) : fnError.context.body;
            if (body?.error) detailMsg = body.error;
          }
        } catch { /* ignore */ }
        console.error('quote-to-invoice detailed error:', { status: fnError.status, message: detailMsg, raw: fnError });
        throw new Error(detailMsg);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setExtractedData(data.extractedData);
      
      toast({
        title: isRTL ? "✅ تم التحليل بنجاح!" : "✅ Analyse réussie!",
        description: isRTL 
          ? "البيانات جاهزة لإنشاء الفاتورة" 
          : "Les données sont prêtes pour créer la facture",
      });

    } catch (err) {
      console.error('Analysis error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ في التحليل" : "Erreur d'analyse",
        description: message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateInvoice = () => {
    if (!extractedData) return;

    const prefillPayload = {
      ...extractedData,
      source: 'quote_to_invoice',
    };

    // Clear ALL stale data to prevent ghost overwrites
    try {
      localStorage.removeItem('invoice_draft_v1');
      sessionStorage.removeItem('invoice_draft_v1');
      // Clear current document state too
      localStorage.removeItem('current_invoice_document');
      sessionStorage.removeItem('current_invoice_document');
    } catch { /* ignore */ }

    // Store in sessionStorage — single source of truth
    const payload = JSON.stringify(prefillPayload);
    sessionStorage.setItem('quoteToInvoiceData', payload);
    console.log('[QuoteToInvoice] Stored prefill data:', prefillPayload.items?.length, 'items');
    
    navigate('/pro/invoice-creator?type=facture&prefill=quote');
  };

  const handleReset = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="py-4 space-y-6">
      {/* Header */}
      <section className={cn(
        "flex items-center gap-4",
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 flex items-center justify-center">
            <QuoteToInvoiceIcon className="h-8 w-8" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn(
              "text-lg font-bold text-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'تحويل الدوفي إلى فاتورة' : 'Devis → Facture'}
            </h1>
            <p className={cn(
              "text-xs text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'حول الدوفي لفاتورة بالذكاء الاصطناعي' : 'Convertissez automatiquement avec l\'IA'}
            </p>
          </div>
        </div>
      </section>

      {/* Upload Area */}
      <Card className={cn(
        "border-2 border-dashed transition-colors",
        uploadedFile ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
      )}>
        <CardContent className="p-6">
          {!uploadedFile ? (
            <label className="cursor-pointer block">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className={cn(
                "flex flex-col items-center gap-4 py-8",
                isRTL && "font-cairo"
              )}>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">
                    {isRTL ? 'اضغط لتحميل الدوفي' : 'Cliquez pour télécharger le devis'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isRTL ? 'PDF أو صورة (JPG, PNG)' : 'PDF ou image (JPG, PNG)'}
                  </p>
                </div>
                <div className={cn(
                  "flex gap-6 text-muted-foreground",
                  isRTL && "flex-row-reverse"
                )}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">PDF</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    <span className="text-xs">JPG/PNG</span>
                  </div>
                </div>
              </div>
            </label>
          ) : (
            <div className="space-y-4">
              {/* File Preview */}
              <div className={cn(
                "flex items-center gap-4",
                isRTL && "flex-row-reverse"
              )}>
                {previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-20 h-20 object-cover rounded-lg border"
                  />
                ) : (
                  <div className="w-20 h-20 bg-destructive/10 rounded-lg flex items-center justify-center">
                    <FileText className="h-8 w-8 text-destructive" />
                  </div>
                )}
                <div className={cn("flex-1", isRTL && "text-right")}>
                  <p className="font-medium text-foreground truncate">
                    {uploadedFile.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  {isRTL ? 'تغيير' : 'Changer'}
                </Button>
              </div>

              {/* Analyze Button */}
              {!extractedData && !error && (
                <Button
                  onClick={handleAnalyze}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className={cn(isRTL && "font-cairo")}>
                        {isRTL ? 'جاري التحليل والترجمة...' : 'Analyse et traduction en cours...'}
                      </span>
                    </>
                  ) : (
                    <span className={cn(isRTL && "font-cairo")}>
                      {isRTL ? '🔍 حلل الدوفي' : '🔍 Analyser le devis'}
                    </span>
                  )}
                </Button>
              )}

              {/* Error State */}
              {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className={cn(
                    "flex items-center gap-2 text-destructive",
                    isRTL && "flex-row-reverse"
                  )}>
                    <AlertCircle className="h-5 w-5" />
                    <span className={cn("font-medium", isRTL && "font-cairo")}>
                      {isRTL ? 'فشل التحليل' : 'Échec de l\'analyse'}
                    </span>
                  </div>
                  <p className={cn(
                    "text-sm text-muted-foreground mt-2",
                    isRTL && "text-right font-cairo"
                  )}>
                    {error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAnalyze}
                    className="mt-3"
                  >
                    {isRTL ? 'إعادة المحاولة' : 'Réessayer'}
                  </Button>
                </div>
              )}

              {/* Success State - Extracted Data Preview */}
              {extractedData && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className={cn(
                      "flex items-center gap-2 text-primary mb-3",
                      isRTL && "flex-row-reverse"
                    )}>
                      <CheckCircle2 className="h-5 w-5" />
                      <span className={cn("font-medium", isRTL && "font-cairo")}>
                        {isRTL ? '✅ تم استخراج البيانات!' : '✅ Données extraites!'}
                      </span>
                    </div>
                    
                    <div className={cn(
                      "space-y-2 text-sm",
                      isRTL && "text-right font-cairo"
                    )}>
                      {extractedData.clientName && (
                        <p>
                          <span className="text-muted-foreground">
                            {isRTL ? 'العميل: ' : 'Client: '}
                          </span>
                          <span className="font-medium">{extractedData.clientName}</span>
                        </p>
                      )}
                      <p>
                        <span className="text-muted-foreground">
                          {isRTL ? 'عدد البنود: ' : 'Articles: '}
                        </span>
                        <span className="font-medium">{extractedData.items.length}</span>
                      </p>
                      {extractedData.items.length > 0 && (
                        <div className="mt-2 p-2 bg-background rounded border">
                          {extractedData.items.slice(0, 3).map((item, i) => (
                            <p key={i} className="text-xs truncate">
                              • {item.designation_fr} ({item.quantity} {item.unit})
                            </p>
                          ))}
                          {extractedData.items.length > 3 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              +{extractedData.items.length - 3} {isRTL ? 'بنود أخرى' : 'autres articles'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateInvoice}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                    size="lg"
                  >
                    <span className={cn(isRTL && "font-cairo")}>
                      {isRTL ? '🧾 إنشاء الفاتورة' : '🧾 Créer la Facture'}
                    </span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Helper Text */}
      <div className={cn(
        "text-center px-4",
        isRTL && "font-cairo"
      )}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isRTL 
            ? '💡 وفر وقتك: حمّل الدوفي (حتى لو مكتوب بالعربي)، والذكاء الاصطناعي يملأ فاتورتك بالفرنسية تلقائياً!'
            : '💡 Gagnez du temps: téléchargez votre devis (même écrit en arabe), l\'IA remplit votre facture en français pour vous!'}
        </p>
      </div>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
};

export default QuoteToInvoicePage;
