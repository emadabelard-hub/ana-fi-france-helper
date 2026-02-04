import { useState } from 'react';
import { HelpCircle, FileText, Users, ListPlus, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const InvoiceGuideModal = () => {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { isRTL } = useLanguage();

  const steps = [
    {
      icon: FileText,
      title_fr: 'Choisir le type',
      title_ar: 'اختار النوع',
      description_fr: 'Clique sur "Devis" pour un devis ou "Facture" pour facturer.',
      description_ar: 'اضغط على "عرض سعر" للتسعير أو "فاتورة" للفوترة.',
      emoji: '📋',
    },
    {
      icon: Users,
      title_fr: 'Infos client & chantier',
      title_ar: 'بيانات العميل والشانتي',
      description_fr: 'Remplis le nom du client et l\'adresse du chantier.',
      description_ar: 'اكتب اسم العميل وعنوان الشانتي.',
      emoji: '👤',
    },
    {
      icon: ListPlus,
      title_fr: 'Ajouter les lignes',
      title_ar: 'أضف الخدمات',
      description_fr: 'Ajoute tes prestations: Peinture, Carrelage, etc. avec les prix.',
      description_ar: 'أضف شغلك: بانتيرة، كاريلاج... مع الأسعار.',
      emoji: '✏️',
    },
    {
      icon: Download,
      title_fr: 'Télécharger le PDF',
      title_ar: 'حمّل الـ PDF',
      description_fr: 'Clique sur "Créer PDF" et c\'est prêt !',
      description_ar: 'اضغط "إنشاء PDF" وخلاص!',
      emoji: '📥',
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setCurrentStep(0);
    }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 border-dashed",
            isRTL && "font-cairo"
          )}
        >
          <HelpCircle className="h-4 w-4" />
          {isRTL ? '❓ كيف أستخدمه؟' : '❓ Comment ça marche ?'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader className="text-center pb-2">
          <DialogTitle className={cn(
            "text-xl font-bold text-center",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'دليل سريع 📖' : 'Guide rapide 📖'}
          </DialogTitle>
        </DialogHeader>
        
        {/* Step Indicator */}
        <div className="flex justify-center gap-2 mb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index === currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Current Step Content */}
        <div className={cn(
          "text-center py-8 px-4 rounded-xl",
          "bg-gradient-to-b from-primary/10 to-transparent",
          "border border-primary/20"
        )}>
          <div className="text-5xl mb-4">{currentStepData.emoji}</div>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h3 className={cn(
            "text-lg font-bold text-foreground mb-2",
            isRTL && "font-cairo"
          )}>
            {isRTL ? currentStepData.title_ar : currentStepData.title_fr}
          </h3>
          <p className={cn(
            "text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? currentStepData.description_ar : currentStepData.description_fr}
          </p>
        </div>

        {/* Step Counter */}
        <p className="text-center text-sm text-muted-foreground">
          {currentStep + 1} / {steps.length}
        </p>

        {/* Navigation */}
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {currentStep === steps.length - 1 ? (
            <Button
              onClick={() => setOpen(false)}
              className={cn("flex-1", isRTL && "font-cairo")}
            >
              {isRTL ? 'فهمت! 👍' : 'Compris ! 👍'}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              className="flex-1"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceGuideModal;
