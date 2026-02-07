import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import CVFormSection from '@/components/cv/CVFormSection';
import CVPreview from '@/components/cv/CVPreview';
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
  summary: string;
  experiences: Experience[];
  education: Education[];
  skills: string[];
  languages: Language[];
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
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  languages: [],
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

  const handleTranslate = async () => {
    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-cv', {
        body: { cvData },
      });

      if (error) throw error;

      setTranslatedData(data.translatedCV);
      setActiveTab('preview');
      toast({
        title: isRTL ? 'تمت الترجمة بنجاح!' : 'Traduction réussie !',
        description: isRTL 
          ? 'تم ترجمة بياناتك للفرنسية المهنية' 
          : 'Vos données ont été traduites en français professionnel',
      });
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في الترجمة' : 'Erreur de traduction',
        description: isRTL 
          ? 'حدث خطأ أثناء الترجمة، حاول مرة أخرى' 
          : 'Une erreur est survenue, réessayez',
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!cvRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cvRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const finalWidth = imgWidth * ratio * 0.95;
      const finalHeight = imgHeight * ratio * 0.95;
      const x = (pdfWidth - finalWidth) / 2;
      const y = 5;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      
      const fileName = translatedData?.fullName || cvData.fullName || 'CV';
      pdf.save(`CV-${fileName.replace(/\s+/g, '-')}-${Date.now()}.pdf`);

      toast({
        title: isRTL ? 'تم التحميل!' : 'Téléchargé !',
        description: isRTL ? 'تم حفظ الـ CV بنجاح' : 'Le CV a été enregistré',
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل في إنشاء PDF' : 'Échec de la création du PDF',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const displayData = translatedData || cvData;
  const hasData = cvData.fullName || cvData.profession || cvData.experiences.length > 0;

  return (
    <div className="py-4 space-y-4">
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
            <CVPreview ref={cvRef} data={displayData} />
          </div>

          {/* Export Button */}
          <div className="mt-4">
            <Button
              onClick={handleExportPDF}
              disabled={isExporting || !hasData}
              className="w-full gap-2"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isRTL ? 'جاري التصدير...' : 'Export en cours...'}
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  {isRTL ? '📥 تحميل PDF' : '📥 Télécharger PDF'}
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CVGeneratorPage;
