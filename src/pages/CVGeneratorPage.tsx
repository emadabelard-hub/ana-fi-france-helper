import { useState, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import CVFormSection from '@/components/cv/CVFormSection';
import CVPreview from '@/components/cv/CVPreview';
import CVGuideModal from '@/components/cv/CVGuideModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Eye, Loader2, Sparkles, Pencil, AlertCircle, CheckCircle, Download, Share2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ProtectedDocumentWrapper from '@/components/shared/ProtectedDocumentWrapper';
import { buildCvHtml } from '@/lib/cvPdfTemplate';
import html2canvas from 'html2canvas';

export interface CVData {
  fullName: string;
  profession: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  maritalStatus: string;
  drivingLicense: string;
  summary: string;
  experiences: Experience[];
  education: Education[];
  skills: string[];
  languages: Language[];
  interests: string[];
  photoUrl?: string;
}

export interface Experience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface Language {
  id: string;
  name: string;
  level: string;
}

const initialCVData: CVData = {
  fullName: '',
  profession: '',
  email: '',
  phone: '',
  address: '',
  birthDate: '',
  maritalStatus: '',
  drivingLicense: '',
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  languages: [],
  interests: [],
  photoUrl: undefined,
};

const sanitizeForFilename = (input: string, fallback = 'CV'): string => {
  if (!input) return fallback;
  const cleaned = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
};

const CVGeneratorPage = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const cvPreviewRef = useRef<HTMLDivElement>(null);

  const [cvData, setCVData] = useState<CVData>(initialCVData);
  const [translatedData, setTranslatedData] = useState<CVData | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isImaging, setIsImaging] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('edit');
  const [showGuide, setShowGuide] = useState(false);

  const handleTranslate = async () => {
    // Validate minimum required fields before calling API
    if (!cvData.fullName.trim() || !cvData.profession.trim()) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'بيانات ناقصة' : 'Données manquantes',
        description: isRTL 
          ? 'يرجى ملء الاسم والمهنة على الأقل' 
          : 'Veuillez remplir au moins le nom et la profession',
      });
      return;
    }

    if (cvData.education.length === 0 && cvData.skills.length === 0 && cvData.languages.length === 0) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'بيانات ناقصة' : 'Données manquantes',
        description: isRTL 
          ? 'يرجى إضافة التعليم أو المهارات أو اللغات على الأقل' 
          : 'Veuillez ajouter au moins une formation, compétence ou langue',
      });
      return;
    }

    setIsTranslating(true);
    try {
      // Exclude photoUrl from translation payload — photo is visual only
      const { photoUrl, ...cvDataWithoutPhoto } = cvData;

      const { data, error } = await supabase.functions.invoke('translate-cv', {
        body: { cvData: cvDataWithoutPhoto },
      });

      if (error) {
        let detailMsg = '';
        try {
          if (error.context?.body) {
            const body = typeof error.context.body === 'string' ? JSON.parse(error.context.body) : error.context.body;
            if (body?.error) detailMsg = body.error;
          }
        } catch { /* ignore parse errors */ }
        console.error('translate-cv detailed error:', { status: error.status, message: detailMsg, raw: error });
        throw new Error(detailMsg || 'translation_failed');
      }

      // Preserve original photo in translated data
      setTranslatedData({ ...data.translatedCV, photoUrl });
      setActiveTab('preview');
      toast({
        title: isRTL ? 'تمت الترجمة بنجاح!' : 'Traduction réussie !',
        description: isRTL 
          ? 'تم ترجمة بياناتك للفرنسية المهنية' 
          : 'Vos données ont été traduites en français professionnel',
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';
      console.error('Translation error:', errMsg, error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في الترجمة' : 'Erreur de traduction',
        description: isRTL 
          ? 'عذراً، نظام الترجمة مشغول حالياً، حاول مرة أخرى 🔄' 
          : 'Le service de traduction est temporairement indisponible, réessayez 🔄',
      });
    } finally {
      setIsTranslating(false);
    }
  };
  const displayData = translatedData || cvData;

  // ─── Build PDF blob via Browserless (same engine as devis/factures) ───
  const buildCvPdfBlob = useCallback(async (): Promise<Blob | null> => {
    const html = await buildCvHtml(displayData);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`,
      },
      body: JSON.stringify({
        html,
        marginMm: 0,
        footerLabel: `CV — ${displayData.fullName || ''}`.trim(),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[CV PDF] Error:', response.status, errText);
      return null;
    }
    return await response.blob();
  }, [displayData]);

  const buildCvFilename = useCallback((): string => {
    const name = sanitizeForFilename(displayData.fullName, 'CV');
    const date = new Date().toISOString().split('T')[0];
    return `CV-${name}-${date}.pdf`;
  }, [displayData.fullName]);

  // ─── Upload PDF to /cvs/[user_id]/CV-[NAME]-[DATE].pdf ───
  const uploadCvPdf = useCallback(async (blob: Blob): Promise<string | null> => {
    if (!user) return null;
    const name = sanitizeForFilename(displayData.fullName, 'CV');
    const date = new Date().toISOString().split('T')[0];
    const storagePath = `cvs/${user.id}/CV-${name}-${date}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('signed-documents')
      .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('[CV Upload] Storage error:', uploadError);
      return null;
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from('signed-documents')
      .createSignedUrl(storagePath, 60 * 60 * 24);

    if (signedError || !signedData?.signedUrl) {
      console.error('[CV Upload] Signed URL error:', signedError);
      return null;
    }
    return signedData.signedUrl;
  }, [user, displayData.fullName]);

  // ─── Insert CV record in documents_comptables (visible in مستنداتي) ───
  const persistCvDocument = useCallback(async (pdfUrl: string): Promise<string | null> => {
    if (!user) return null;
    const date = new Date().toISOString().split('T')[0];
    const docNumber = `CV-${date}-${Date.now().toString().slice(-4)}`;

    const { data, error } = await (supabase.from('documents_comptables') as any)
      .insert({
        user_id: user.id,
        document_type: 'cv',
        document_number: docNumber,
        client_name: displayData.fullName || 'CV',
        status: 'finalized',
        subtotal_ht: 0,
        tva_amount: 0,
        total_ttc: 0,
        tva_rate: 0,
        tva_exempt: true,
        document_data: displayData as unknown as Record<string, unknown>,
        pdf_url: pdfUrl,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[CV Persist] Insert error:', error);
      return null;
    }
    return data?.id ?? null;
  }, [user, displayData]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // ─── Action 1: Confirm & Save ───
  const handleConfirmAndSave = useCallback(async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'يجب تسجيل الدخول' : 'Connexion requise',
        description: isRTL ? 'سجل دخولك لحفظ السي في' : 'Connectez-vous pour sauvegarder',
      });
      return;
    }
    setIsSaving(true);
    try {
      const blob = await buildCvPdfBlob();
      if (!blob) throw new Error('PDF generation failed');
      const url = await uploadCvPdf(blob);
      if (!url) throw new Error('Upload failed');
      const docId = await persistCvDocument(url);
      setSignedPdfUrl(url);
      setSavedDocId(docId);
      toast({
        title: isRTL ? '✅ تم الحفظ' : '✅ CV enregistré',
        description: isRTL ? 'السي في محفوظ في مستنداتي' : 'CV sauvegardé dans Mes documents',
      });
    } catch (err) {
      console.error('[CV Save] error:', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'تعذر حفظ السي في' : 'Impossible de sauvegarder',
      });
    } finally {
      setIsSaving(false);
    }
  }, [user, isRTL, toast, buildCvPdfBlob, uploadCvPdf, persistCvDocument]);

  // ─── Action 2: Download PDF ───
  const handleExportPDF = useCallback(async () => {
    if (!displayData.fullName?.trim() && !displayData.profession?.trim()) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'السي في فارغ. يرجى ملء البيانات أولاً' : 'Le CV est vide. Veuillez remplir vos données d\'abord.',
      });
      return;
    }
    setIsExporting(true);
    try {
      const blob = await buildCvPdfBlob();
      if (!blob) throw new Error('PDF generation failed');
      downloadBlob(blob, buildCvFilename());
      // Silent upload in background
      void (async () => {
        const url = await uploadCvPdf(blob);
        if (url) setSignedPdfUrl(url);
      })();
      toast({
        title: isRTL ? '📥 تم التحميل' : '📥 PDF téléchargé',
        description: isRTL ? 'تم تحميل السي في بنجاح' : 'Votre CV a été téléchargé',
      });
    } catch (error) {
      console.error('CV PDF generation error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في التحميل' : 'Erreur de téléchargement',
        description: isRTL ? 'تعذر إنشاء ملف PDF.' : 'Impossible de générer le PDF.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [displayData, isRTL, toast, buildCvPdfBlob, buildCvFilename, uploadCvPdf]);

  // ─── Action 3: WhatsApp Share ───
  const handleWhatsAppShare = useCallback(async () => {
    setIsSharing(true);
    try {
      let url = signedPdfUrl;
      let blob: Blob | null = null;
      if (!url) {
        blob = await buildCvPdfBlob();
        if (!blob) throw new Error('PDF generation failed');
        url = await uploadCvPdf(blob);
      }
      if (!blob) blob = await buildCvPdfBlob();
      if (blob) downloadBlob(blob, buildCvFilename());
      if (url) setSignedPdfUrl(url);

      const message = url
        ? `مرحبا، إليكم سيرتي الذاتية (CV) - ${displayData.fullName || ''}\nLien : ${url}`
        : `مرحبا، إليكم سيرتي الذاتية (CV) - ${displayData.fullName || ''}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');

      toast({
        title: isRTL ? '📲 جاهز للإرسال' : '📲 Prêt à envoyer',
        description: url
          ? (isRTL ? 'الرابط في الواتساب والـ PDF محفوظ' : 'Lien dans WhatsApp + PDF téléchargé')
          : (isRTL ? 'أرفق PDF في الواتساب' : 'Joignez le PDF dans WhatsApp'),
      });
    } catch (err) {
      console.error('[CV WhatsApp] error:', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'تعذر المشاركة' : 'Impossible de partager',
      });
    } finally {
      setIsSharing(false);
    }
  }, [signedPdfUrl, displayData.fullName, isRTL, toast, buildCvPdfBlob, uploadCvPdf, buildCvFilename]);

  // ─── Action 4: Save as Image (PNG of CV preview) ───
  const handleSaveAsImage = useCallback(async () => {
    if (!cvPreviewRef.current) return;
    setIsImaging(true);
    try {
      const canvas = await html2canvas(cvPreviewRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (!blob) {
          toast({
            variant: 'destructive',
            title: isRTL ? 'خطأ' : 'Erreur',
            description: isRTL ? 'تعذر إنشاء الصورة' : 'Impossible de créer l\'image',
          });
          return;
        }
        const name = sanitizeForFilename(displayData.fullName, 'CV');
        const date = new Date().toISOString().split('T')[0];
        downloadBlob(blob, `CV-${name}-${date}.png`);
        toast({
          title: isRTL ? '🖼️ تم حفظ الصورة' : '🖼️ Image enregistrée',
          description: isRTL ? 'تم تحميل السي في كصورة' : 'CV téléchargé en image PNG',
        });
      }, 'image/png');
    } catch (err) {
      console.error('[CV Image] error:', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'تعذر إنشاء الصورة' : 'Impossible de créer l\'image',
      });
    } finally {
      setIsImaging(false);
    }
  }, [displayData.fullName, isRTL, toast]);

  const hasData = cvData.fullName || cvData.profession || cvData.experiences.length > 0;
  const isCvReady = !!(displayData.fullName?.trim() || displayData.profession?.trim());

  return (
    <div className="py-4 space-y-4">
      {/* Guide Modal */}
      <CVGuideModal open={showGuide} onOpenChange={setShowGuide} />

      {/* Red Help Banner */}
      <div
        onClick={() => setShowGuide(true)}
        className={cn(
          "bg-red-600 text-white rounded-xl px-4 py-3 cursor-pointer hover:bg-red-700 transition-colors",
          "flex items-center justify-center gap-2",
          isRTL && "font-cairo"
        )}
      >
        <span className="text-sm font-black">
          {isRTL ? 'عايز تعرف ازاي تعمل السي في؟ اضغط هنا 👈' : 'Comment créer votre CV ? Cliquez ici 👈'}
        </span>
      </div>

      {/* Header */}
      <section className={cn("text-center", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isRTL ? 'مُولّد CV الاحترافي 📄' : 'Générateur de CV Pro 📄'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRTL 
            ? 'اكتب بالعربي والذكاء الاصطناعي يترجمه لفرنسي احترافي' 
            : 'Écrivez en arabe, l\'IA traduit en français professionnel'}
        </p>
      </section>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit" className="gap-2">
            <FileText className="h-4 w-4" />
            {isRTL ? 'تحرير' : 'Éditer'}
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            {isRTL ? 'معاينة' : 'Aperçu'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4">
          <CVFormSection 
            cvData={cvData} 
            onChange={setCVData}
            isRTL={isRTL}
          />
          
          {/* Translate Button */}
          <div className="mt-6">
            <Button
              onClick={handleTranslate}
              disabled={!hasData || isTranslating}
              className="w-full gap-2"
              size="lg"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isRTL ? 'جاري الترجمة...' : 'Traduction en cours...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  {isRTL ? '✨ ترجم للفرنسية وعاين' : '✨ Traduire et apercevoir'}
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          {/* Edit Button */}
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('edit')}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              {isRTL ? 'تعديل ✏️' : 'Modifier ✏️'}
            </Button>
          </div>

          {/* CV Preview with protection */}
          <div className="bg-muted/30 rounded-lg p-4 overflow-auto">
            <ProtectedDocumentWrapper
              documentType="cv"
              returnPath="/cv-generator"
              renderDownloadButton={() => (
                <Button
                  onClick={handleExportPDF}
                  disabled={!isCvReady || isExporting}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {isRTL ? 'جاري إنشاء PDF...' : 'Génération du PDF...'}
                    </>
                  ) : (
                    <>
                      {isRTL ? '📥 تحميل PDF' : '📥 Télécharger PDF'}
                    </>
                  )}
                </Button>
              )}
            >
              <div className="print-area">
                <CVPreview data={displayData} />
              </div>
            </ProtectedDocumentWrapper>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CVGeneratorPage;
