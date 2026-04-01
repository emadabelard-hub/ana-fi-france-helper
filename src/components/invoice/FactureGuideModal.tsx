import { useState } from 'react';
import { ChevronLeft, ChevronRight, Hash, UserCheck, ListChecks, CreditCard, Receipt, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface FactureGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FactureGuideModal = ({ open, onOpenChange }: FactureGuideModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { isRTL } = useLanguage();

  const steps = [
    {
      icon: Hash,
      emoji: '🔢',
      title_fr: 'Numéro de facture & identité',
      title_ar: 'رقم الفاتورة وبيانات شركتك',
      bullets_fr: [
        '🔢 Le numéro de facture est attribué automatiquement à la validation (séquentiel, obligatoire légalement).',
        '🏢 Vérifiez que vos données société (nom, adresse, SIRET) sont correctes.',
        '📸 Votre logo, signature et cachet seront ajoutés automatiquement depuis votre profil.',
      ],
      bullets_ar: [
        '🔢 رقم الفاتورة بيتولّد تلقائي عند التأكيد (تسلسلي، مطلوب قانونياً).',
        '🏢 تأكد من بيانات شركتك (الاسم، العنوان، SIRET) صحيحة.',
        '📸 اللوجو والتوقيع والكاشي هيتحطوا تلقائي من بروفايلك.',
      ],
      note_fr: '→ Allez dans "Mon identité pro" pour configurer vos infos.',
      note_ar: '→ روح على "بيانات شركتي" وجهّز كل حاجة.',
    },
    {
      icon: UserCheck,
      emoji: '👤',
      title_fr: 'Infos client & adresse chantier',
      title_ar: 'بيانات العميل والعناوين',
      bullets_fr: [
        '📝 Remplissez le nom complet et l\'adresse de facturation du client.',
        '📍 Indiquez l\'adresse du chantier si différente de l\'adresse de facturation.',
        '⚠️ Ces informations sont obligatoires pour la validité légale de la facture.',
      ],
      bullets_ar: [
        '📝 أضف اسم العميل وعنوان الفاتورة.',
        '📍 حط عنوان الشانتيه لو مختلف عن عنوان الفاتورة.',
        '⚠️ البيانات دي مطلوبة عشان الفاتورة تبقى قانونية.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: ListChecks,
      emoji: '📋',
      title_fr: 'Lignes de travaux & prix',
      title_ar: 'بنود الشغل والأسعار',
      bullets_fr: [
        '✍️ Ajoutez chaque prestation avec sa description détaillée.',
        '📏 Indiquez la quantité et le prix unitaire pour chaque ligne.',
        '🔧 Écrivez en arabe, le système traduit automatiquement en français professionnel.',
      ],
      bullets_ar: [
        '✍️ أضف كل بند شغل مع وصف تفصيلي.',
        '📏 حدد الكمية وسعر الوحدة لكل بند.',
        '🔧 اكتب بالعربي والبرنامج هيترجم تلقائي لفرنساوي احترافي.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: CreditCard,
      emoji: '💳',
      title_fr: 'Conditions de paiement',
      title_ar: 'شروط الدفع',
      bullets_fr: [
        '💰 Définissez l\'acompte déjà versé (montant ou pourcentage).',
        '📅 Indiquez le délai de paiement (30, 45 ou 60 jours).',
        '🏦 Précisez le mode de paiement accepté (virement, chèque, espèces).',
      ],
      bullets_ar: [
        '💰 حدد المقدم (الأكونت) اللي اتدفع.',
        '📅 حدد مهلة الدفع (30، 45 أو 60 يوم).',
        '🏦 وضّح طريقة الدفع (تحويل بنكي، شيك، كاش) لحماية حقوقك.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: Receipt,
      emoji: '💶',
      title_fr: 'TVA & Auto-entrepreneur',
      title_ar: 'الضريبة وأوتو-أونتربرينير',
      bullets_fr: [
        '🏷️ Auto-entrepreneur: TVA à 0% (Franchise en base de TVA).',
        '📊 Sinon, choisissez le taux applicable: 5.5%, 10% ou 20%.',
        '⚖️ Le montant TTC est calculé automatiquement.',
      ],
      bullets_ar: [
        '🏷️ لـ أوتو-أونتربرينير (Auto-entrepreneur)، الضريبة 0% تلقائياً.',
        '📊 لغير ذلك، اختر النسبة المناسبة: 5.5%، 10% أو 20%.',
        '⚖️ المبلغ الإجمالي بيتحسب تلقائي.',
      ],
      note_fr: null,
      note_ar: null,
    },
    {
      icon: Download,
      emoji: '📥',
      title_fr: 'Aperçu & téléchargement PDF',
      title_ar: 'معاينة وتحميل PDF',
      bullets_fr: [
        '👁️ Cliquez sur "Aperçu" pour vérifier votre facture avant téléchargement.',
        '📄 Téléchargez un PDF professionnel prêt à envoyer au client.',
        '✅ Le PDF inclut automatiquement votre logo, signature et cachet.',
      ],
      bullets_ar: [
        '👁️ اضغط "معاينة" عشان تشوف الفاتورة قبل التحميل.',
        '📄 حمّل ملف PDF احترافي جاهز للإرسال للعميل.',
        '✅ الـ PDF بيتضاف فيه تلقائي اللوجو والتوقيع والكاشي.',
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
            {isRTL ? 'دليل إنشاء الفاتورة 🧾' : 'Guide complet de la Facture 🧾'}
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

export default FactureGuideModal;
