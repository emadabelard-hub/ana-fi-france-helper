import { useState } from 'react';
import { ChevronLeft, ChevronRight, User, FileText, Briefcase, GraduationCap, Languages, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface CVGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CVGuideModal = ({ open, onOpenChange }: CVGuideModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { isRTL } = useLanguage();

  const steps = [
    {
      icon: User,
      emoji: '👤',
      title_fr: 'Informations personnelles',
      title_ar: 'البيانات الشخصية',
      bullets_fr: [
        '📝 Remplissez votre nom complet, profession et adresse avec précision.',
        '📞 Ajoutez vos coordonnées (téléphone, email) pour être contacté.',
        '👁️ Ces informations sont la première chose que l\'employeur voit.',
      ],
      bullets_ar: [
        '📝 دخل بياناتك الشخصية (الاسم، المهنة، العنوان) بدقة.',
        '📞 أضف بيانات التواصل (تليفون، إيميل) عشان يقدروا يتواصلوا معاك.',
        '👁️ دي أول حاجة بيشوفها صاحب الشغل.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: FileText,
      emoji: '✍️',
      title_fr: 'Résumé professionnel',
      title_ar: 'النبذة المهنية',
      bullets_fr: [
        '✍️ Écrivez un court résumé en arabe décrivant votre profil.',
        '🤖 L\'IA le transformera en description professionnelle en français.',
        '💡 Soyez concis et mettez en avant vos points forts.',
      ],
      bullets_ar: [
        '✍️ اكتب نبذة مختصرة عنك بالعربي.',
        '🤖 الذكاء الاصطناعي هيحولها لوصف وظيفي مبهر بالفرنساوي.',
        '💡 خليها قصيرة وركز على نقاط قوتك.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: Briefcase,
      emoji: '💼',
      title_fr: 'Expériences professionnelles',
      title_ar: 'الخبرات المهنية',
      bullets_fr: [
        '💼 Ajoutez vos expériences de la plus récente à la plus ancienne.',
        '📋 Décrivez vos responsabilités et réalisations pour chaque poste.',
        '📅 Indiquez les dates de début et de fin pour chaque expérience.',
      ],
      bullets_ar: [
        '💼 أضف خبراتك المهنية السابقة بالترتيب من الأحدث للأقدم.',
        '📋 اوصف مسؤولياتك وإنجازاتك في كل وظيفة.',
        '📅 حدد تاريخ البداية والنهاية لكل خبرة.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: GraduationCap,
      emoji: '🎓',
      title_fr: 'Formation & diplômes',
      title_ar: 'التعليم والشهادات',
      bullets_fr: [
        '🎓 Ajoutez vos diplômes et formations obtenues.',
        '📚 Mentionnez l\'établissement, la spécialité et les dates.',
        '🏅 Incluez les certifications et formations complémentaires.',
      ],
      bullets_ar: [
        '🎓 أضف شهاداتك الدراسية والدورات التدريبية.',
        '📚 اذكر اسم المؤسسة والتخصص والتواريخ.',
        '🏅 ضيف أي شهادات إضافية أو دورات حصلت عليها.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: Languages,
      emoji: '🌟',
      title_fr: 'Compétences & langues',
      title_ar: 'المهارات واللغات',
      bullets_fr: [
        '🔧 Listez vos compétences techniques et professionnelles.',
        '🌍 Indiquez les langues maîtrisées avec votre niveau.',
        '📈 Plus vous êtes précis, plus votre CV sera attractif.',
      ],
      bullets_ar: [
        '🔧 حدد مهاراتك الفنية والمهنية.',
        '🌍 اذكر اللغات اللي بتتقنها ومستواك فيها.',
        '📈 كل ما كنت دقيق أكتر، كل ما السي في بتاعك هيبقى أقوى.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: Download,
      emoji: '📥',
      title_fr: 'Traduction & téléchargement PDF',
      title_ar: 'الترجمة والتحميل',
      bullets_fr: [
        '✨ Cliquez sur "Traduire et apercevoir" pour générer votre CV en français.',
        '👁️ Vérifiez l\'aperçu avant de télécharger.',
        '📄 Téléchargez un PDF professionnel prêt à envoyer.',
      ],
      bullets_ar: [
        '✨ اضغط على زر الترجمة والمعاينة عشان تشوف الـ CV النهائي بالفرنساوي.',
        '👁️ راجع المعاينة قبل ما تنزل الملف.',
        '📄 نزّل ملف PDF احترافي جاهز للإرسال.',
      ],
      note_fr: null,
      note_ar: null,
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleClose = () => {
    onOpenChange(false);
    setCurrentStep(0);
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else onOpenChange(true);
    }}>
      <DialogContent className="max-w-md mx-4 rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 text-center">
          <DialogTitle className={cn(
            "text-xl font-black text-foreground text-center",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'دليل إنشاء السي في 📄' : 'Guide du CV Professionnel 📄'}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex justify-center gap-1.5 px-6">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === currentStep ? "bg-foreground w-6" : "bg-muted-foreground/30 w-1.5"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-2">
          <div className={cn(
            "py-6 px-4 rounded-xl border border-foreground/10",
            "bg-gradient-to-b from-foreground/5 to-transparent"
          )}>
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="text-4xl">{step.emoji}</div>
              <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center">
                <Icon className="h-6 w-6 text-foreground" />
              </div>
              <h3 className={cn(
                "text-base font-black text-foreground text-center leading-tight",
                isRTL && "font-cairo"
              )}>
                {isRTL ? step.title_ar : step.title_fr}
              </h3>
            </div>

            <ul className={cn("space-y-2.5", isRTL && "text-right")}>
              {(isRTL ? step.bullets_ar : step.bullets_fr).map((bullet, i) => (
                <li key={i} className={cn(
                  "text-sm text-foreground/80 leading-relaxed",
                  isRTL && "font-cairo"
                )}>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground font-bold">
          {currentStep + 1} / {steps.length}
        </p>

        <div className="flex gap-2 px-6 pb-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex-1 font-bold"
          >
            <ChevronLeft className="h-4 w-4" />
            {isRTL ? 'اللي قبله' : 'Précédent'}
          </Button>

          {currentStep === steps.length - 1 ? (
            <Button
              onClick={handleClose}
              className={cn("flex-1 font-black bg-[hsl(220,70%,25%)] hover:bg-[hsl(220,70%,20%)] text-white", isRTL && "font-cairo")}
            >
              {isRTL ? 'فهمت يا معلم! 👍' : 'Compris ! 👍'}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              className={cn("flex-1 font-bold", isRTL && "font-cairo")}
            >
              {isRTL ? 'اللي بعده' : 'Suivant'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CVGuideModal;
