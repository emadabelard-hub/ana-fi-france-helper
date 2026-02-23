import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import CVFormSection from '@/components/cv/CVFormSection';
import CVPreview from '@/components/cv/CVPreview';
import CVGuideModal from '@/components/cv/CVGuideModal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Eye, Download, Loader2, Sparkles, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const cvRef = useRef<HTMLDivElement>(null);
  
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

  const handleExportPDF = () => {
    window.print();
  };

  const displayData = translatedData || cvData;
  const hasData = cvData.fullName || cvData.profession || cvData.experiences.length > 0;

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

          {/* CV Preview */}
          <div className="bg-muted/30 rounded-lg p-4 overflow-auto">
            <div className="print-area">
              <CVPreview ref={cvRef} data={displayData} />
            </div>
          </div>

          {/* Export Button */}
          <div className="mt-4">
            <Button
              onClick={handleExportPDF}
              disabled={!hasData}
              className="w-full gap-2"
              size="lg"
            >
              <Download className="h-5 w-5" />
              {isRTL ? '📥 تحميل PDF' : '📥 Télécharger PDF'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CVGeneratorPage;
