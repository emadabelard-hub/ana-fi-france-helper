import { useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import CVFormSection from '@/components/cv/CVFormSection';
import CVPreview from '@/components/cv/CVPreview';
import CVGuideModal from '@/components/cv/CVGuideModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Eye, Loader2, Sparkles, Pencil, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProtectedDocumentWrapper from '@/components/shared/ProtectedDocumentWrapper';
import { buildCvHtml } from '@/lib/cvPdfTemplate';

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

const CVGeneratorPage = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  
  
  const [cvData, setCVData] = useState<CVData>(initialCVData);
  const [translatedData, setTranslatedData] = useState<CVData | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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
      // Build standalone HTML with controlled CSS
      const html = await buildCvHtml(displayData);

      // Send to the same Browserless edge function used for invoices
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
          marginMm: 0, // margins are in the HTML @page rule
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[CV PDF] Error:', response.status, errText);
        throw new Error(`PDF generation failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CV_${displayData.fullName?.replace(/\s+/g, '_') || 'document'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: isRTL ? 'تم التحميل!' : 'PDF téléchargé !',
        description: isRTL ? 'تم تحميل السي في بنجاح' : 'Votre CV a été téléchargé avec succès',
      });
    } catch (error) {
      console.error('CV PDF generation error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في التحميل' : 'Erreur de téléchargement',
        description: isRTL ? 'تعذر إنشاء ملف PDF. حاول مرة أخرى.' : 'Impossible de générer le PDF. Réessayez.',
      });
    } finally {
      setIsExporting(false);
    }
  }, [displayData, isRTL, toast]);

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
                <CVPreview ref={cvRef} data={displayData} />
              </div>
            </ProtectedDocumentWrapper>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CVGeneratorPage;
