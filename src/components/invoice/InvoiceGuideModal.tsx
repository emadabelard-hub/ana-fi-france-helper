import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Building2, UserCheck, Languages, Receipt, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface InvoiceGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InvoiceGuideModal = ({ open, onOpenChange }: InvoiceGuideModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { isRTL } = useLanguage();

  const steps = [
    {
      icon: Building2,
      emoji: '🏢',
      title_fr: 'Votre identité pro (Données société)',
      title_ar: 'هويتك المهنية (بيانات الشركة)',
      bullets_fr: [
        '📸 Logo : Uploadez votre logo pour qu\'il apparaisse en en-tête de tous vos documents.',
        '✍️ Signature : Dessinez ou uploadez votre signature professionnelle.',
        '🔖 Cachet (Tampon) : Uploadez le tampon officiel de votre entreprise. Il sera placé automatiquement sur tous les PDF.',
      ],
      bullets_ar: [
        '📸 اللوجو: ارفع لوجو شركتك عشان يظهر في رأس كل المستندات.',
        '✍️ التوقيع: ارسم أو ارفع توقيعك المهني.',
        '🔖 الكاشي (الختم): ارفع ختم شركتك الرسمي. هيتحط تلقائي على كل ملفات الـ PDF.',
      ],
      note_fr: '→ Allez dans "Mon identité pro" pour tout configurer.',
      note_ar: '→ روح على "بيانات شركتي" وجهّز كل حاجة.',
    },
    {
      icon: UserCheck,
      emoji: '👤',
      title_fr: 'Infos client & SIRET',
      title_ar: 'بيانات الزبون والـ SIRET',
      bullets_fr: [
        '📝 Remplissez le nom et l\'adresse de votre client.',
        '📍 Indiquez l\'adresse du chantier si différente.',
        '⚠️ Vérifiez votre SIRET en bas de l\'écran pour que le document soit juridiquement valide.',
      ],
      bullets_ar: [
        '📝 اكتب اسم الزبون وعنوانه.',
        '📍 حط عنوان الشانتي لو مختلف.',
        '⚠️ تأكد من رقم الـ SIRET بتاعك في أسفل الشاشة عشان المستند يبقى قانوني.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: Languages,
      emoji: '🌐',
      title_fr: 'Description & traduction intelligente',
      title_ar: 'وصف العمل والترجمة الذكية',
      bullets_fr: [
        '✍️ Écrivez en arabe dans le champ prévu, le système traduit automatiquement en français professionnel.',
        '🔧 Même avec des termes phonétiques comme « bantira », « karlage » ou « manivre », le système comprend et traduit correctement.',
      ],
      bullets_ar: [
        '✍️ اكتب براحتك بالعربي في الخانة المخصصة، والبرنامج هيحول كلامك لفرنساوي احترافي.',
        '🔧 وباطمنك حتى لو كتبت (بانتيرة، كارلاح، مانيفر) برضه البرنامج هايفهمك ويطلع الكلام بالفرنساوي صح للزبون.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: Receipt,
      emoji: '💶',
      title_fr: 'Paiement & TVA',
      title_ar: 'شروط الدفع والضريبة',
      bullets_fr: [
        '💰 Définissez le pourcentage d\'acompte (ex: 30%).',
        '🏷️ Si vous êtes Auto-entrepreneur, la TVA est de 0% (Franchise en base). Sinon, choisissez le taux applicable.',
        '📅 La validité du devis est configurable (30, 60, 90 jours).',
      ],
      bullets_ar: [
        '💰 حدد نسبة العربون (الأكونت) مثلاً 30%.',
        '🏷️ لـ أوتو-أونتربرينير (Auto-entrepreneur)، الضريبة 0% تلقائياً. لغير ذلك، اختر النسبة المناسبة للمشروع.',
        '📅 مدة صلاحية الدوفي تقدر تغيرها (30، 60، 90 يوم).',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: ArrowRightLeft,
      emoji: '✨',
      title_fr: 'Le bouton magique (Devis → Facture)',
      title_ar: 'الزر السحري (التحويل لفاتورة)',
      bullets_fr: [
        '✅ Une fois le devis créé et les travaux terminés, cliquez sur "Convertir en Facture".',
        '⚡ Une facture complète est générée automatiquement sans retaper aucune donnée.',
        '📄 Toutes les infos (client, lignes, prix) sont transférées instantanément.',
      ],
      bullets_ar: [
        '🔄 وبافكرك انك ممكن بدل ما تتعب نفسك وتعمل الفاتورة من اول وجديد، هاخليك تحول الدوفي لفاتورة بمنتهى السهولة بضغطة واحدة.',
        '✅ لما الدوفي يخلص والشغل يتعمل، اضغط "حوّل لفاتورة" وهيتعملك فاتورة كاملة تلقائي.',
        '📄 كل البيانات (الزبون، الخدمات، الأسعار) بتتنقل فوراً وبدقة.',
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
            {isRTL ? 'دليل إنشاء الدوفي 📖' : 'Guide complet du Devis 📖'}
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
            {/* Icon + Title */}
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

            {/* Bullets */}
            <ul className={cn(
              "space-y-2.5",
              isRTL && "text-right"
            )}>
              {(isRTL ? step.bullets_ar : step.bullets_fr).map((bullet, i) => (
                <li key={i} className={cn(
                  "text-sm text-foreground/80 leading-relaxed",
                  isRTL && "font-cairo"
                )}>
                  {bullet}
                </li>
              ))}
            </ul>

            {/* Note */}
            {(isRTL ? step.note_ar : step.note_fr) && (
              <div className={cn(
                "mt-4 p-2.5 rounded-lg bg-foreground/5 border border-foreground/10",
                isRTL && "text-right"
              )}>
                <p className={cn(
                  "text-xs font-bold text-foreground/70",
                  isRTL && "font-cairo"
                )}>
                  {isRTL ? step.note_ar : step.note_fr}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step Counter */}
        <p className="text-center text-xs text-muted-foreground font-bold">
          {currentStep + 1} / {steps.length}
        </p>

        {/* Navigation */}
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

export default InvoiceGuideModal;
