import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Upload, Image, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import AuthModal from '@/components/auth/AuthModal';
import { supabase } from '@/integrations/supabase/client';
import { compressImage, isImageData } from '@/lib/imageCompression';

interface NormalizedQuoteData {
  source: 'image_quote_to_invoice';
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  description: string;
  items: Array<{
    designation: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  totalHT: number;
  tva: number;
  totalTTC: number;
}

const ImageQuoteToInvoicePage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<NormalizedQuoteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: isRTL ? "صورة فقط" : "Image uniquement",
        description: isRTL ? "يرجى تحميل صورة فقط" : "Veuillez télécharger une image (JPG, PNG)",
      });
      return;
    }

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
    setPreviewUrl(URL.createObjectURL(file));
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
      // Read file as base64
      const reader = new FileReader();
      const fullBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      let base64Data = fullBase64.split(',')[1];
      let mimeType = uploadedFile.type;

      // Compress image
      if (isImageData(fullBase64)) {
        try {
          const compressed = await compressImage(fullBase64);
          base64Data = compressed.split(',')[1];
          mimeType = 'image/jpeg';
        } catch {
          // use original
        }
      }

      const { data, error: fnError } = await supabase.functions.invoke('image-quote-extract', {
        body: { imageBase64: base64Data, mimeType },
      });

      if (fnError) {
        let msg = fnError.message || 'Erreur inconnue';
        try {
          if (fnError.context?.body) {
            const body = typeof fnError.context.body === 'string' ? JSON.parse(fnError.context.body) : fnError.context.body;
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      if (data?.error) throw new Error(data.error);
      if (!data?.data) throw new Error('Aucune donnée extraite');

      const normalized = data.data as NormalizedQuoteData;

      // Auto-redirect: write + navigate immediately, no verification step
      if (normalized.items && normalized.items.length > 0) {
        sessionStorage.setItem('imageQuoteToInvoiceData', JSON.stringify(normalized));
        console.log('WRITE imageQuoteToInvoiceData (auto)', normalized);
        toast({
          title: isRTL ? "✅ تم التحليل!" : "✅ Analyse réussie!",
          description: isRTL ? "جاري فتح الفاتورة..." : "Ouverture de la facture...",
        });
        navigate('/pro/invoice-creator?type=facture&source=image-quote');
        return;
      }

      // Fallback: no items extracted
      setExtractedData(normalized);
      toast({
        variant: "destructive",
        title: isRTL ? "⚠️ بيانات ناقصة" : "⚠️ Données incomplètes",
        description: isRTL ? "لم يتم استخراج أي عنصر" : "Aucun article extrait du document",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast({ variant: "destructive", title: isRTL ? "خطأ" : "Erreur", description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateInvoice = () => {
    if (!extractedData) return;

    sessionStorage.setItem('imageQuoteToInvoiceData', JSON.stringify(extractedData));
    console.log('WRITE imageQuoteToInvoiceData', extractedData);

    // Verify
    const verify = sessionStorage.getItem('imageQuoteToInvoiceData');
    console.log('VERIFY imageQuoteToInvoiceData written:', !!verify);

    navigate('/pro/invoice-creator?type=facture&source=image-quote');
  };

  const handleReset = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="py-4 space-y-6">
      {/* Header */}
      <section className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/pro')} className="shrink-0">
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn("flex items-center gap-3 flex-1", isRTL && "flex-row-reverse")}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Image className="h-7 w-7 text-blue-600" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn("text-lg font-bold text-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'صورة الدوفي → فاتورة' : 'Image Devis → Facture'}
            </h1>
            <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
              {isRTL ? 'حمّل صورة الدوفي وحوّلها لفاتورة' : 'Uploadez une photo de devis, créez la facture'}
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
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className={cn("flex flex-col items-center gap-4 py-8", isRTL && "font-cairo")}>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">
                    {isRTL ? 'اضغط لتحميل صورة الدوفي' : 'Cliquez pour uploader l\'image du devis'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">JPG, PNG, WEBP</p>
                </div>
              </div>
            </label>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
                {previewUrl && (
                  <img src={previewUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg border" />
                )}
                <div className={cn("flex-1", isRTL && "text-right")}>
                  <p className="font-medium text-foreground truncate">{uploadedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={isProcessing}>
                  {isRTL ? 'تغيير' : 'Changer'}
                </Button>
              </div>

              {/* Analyze Button */}
              {!extractedData && !error && (
                <Button onClick={handleAnalyze} disabled={isProcessing} className="w-full" size="lg">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className={cn(isRTL && "font-cairo")}>
                        {isRTL ? 'جاري التحليل...' : 'Analyse en cours...'}
                      </span>
                    </>
                  ) : (
                    <span className={cn(isRTL && "font-cairo")}>
                      {isRTL ? '🔍 حلل الصورة' : '🔍 Analyser l\'image'}
                    </span>
                  )}
                </Button>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className={cn("flex items-center gap-2 text-destructive", isRTL && "flex-row-reverse")}>
                    <AlertCircle className="h-5 w-5" />
                    <span className={cn("font-medium", isRTL && "font-cairo")}>
                      {isRTL ? 'فشل التحليل' : 'Échec de l\'analyse'}
                    </span>
                  </div>
                  <p className={cn("text-sm text-muted-foreground mt-2", isRTL && "text-right font-cairo")}>{error}</p>
                  <Button variant="outline" size="sm" onClick={handleAnalyze} className="mt-3">
                    {isRTL ? 'إعادة المحاولة' : 'Réessayer'}
                  </Button>
                </div>
              )}

              {/* Success */}
              {extractedData && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className={cn("flex items-center gap-2 text-primary mb-3", isRTL && "flex-row-reverse")}>
                      <CheckCircle2 className="h-5 w-5" />
                      <span className={cn("font-medium", isRTL && "font-cairo")}>
                        {isRTL ? '✅ تم استخراج البيانات!' : '✅ Données extraites!'}
                      </span>
                    </div>
                    <div className={cn("space-y-2 text-sm", isRTL && "text-right font-cairo")}>
                      {extractedData.clientName && (
                        <p><span className="text-muted-foreground">Client: </span><span className="font-medium">{extractedData.clientName}</span></p>
                      )}
                      {extractedData.description && (
                        <p><span className="text-muted-foreground">Objet: </span><span className="font-medium">{extractedData.description}</span></p>
                      )}
                      <p><span className="text-muted-foreground">Articles: </span><span className="font-medium">{extractedData.items.length}</span></p>
                      {extractedData.items.length > 0 && (
                        <div className="mt-2 p-2 bg-background rounded border">
                          {extractedData.items.slice(0, 4).map((item, i) => (
                            <p key={i} className="text-xs truncate">
                              • {item.designation} ({item.quantity} {item.unit} × {item.unitPrice}€)
                            </p>
                          ))}
                          {extractedData.items.length > 4 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              +{extractedData.items.length - 4} autres
                            </p>
                          )}
                        </div>
                      )}
                      {extractedData.totalHT > 0 && (
                        <p><span className="text-muted-foreground">Total HT: </span><span className="font-medium">{extractedData.totalHT.toFixed(2)}€</span></p>
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
      <div className={cn("text-center px-4", isRTL && "font-cairo")}>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isRTL
            ? '📸 حمّل صورة الدوفي والذكاء الاصطناعي يملأ فاتورتك تلقائياً'
            : '📸 Prenez en photo votre devis, l\'IA remplit la facture automatiquement'}
        </p>
      </div>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
};

export default ImageQuoteToInvoicePage;
