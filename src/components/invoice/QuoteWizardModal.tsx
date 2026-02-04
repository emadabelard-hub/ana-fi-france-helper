import { useState } from 'react';
import { Wand2, ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineItem } from './LineItemEditor';

interface QuoteWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (items: LineItem[]) => void;
}

type WorkCategory = 'peinture' | 'plomberie' | 'electricite' | 'carrelage' | 'maconnerie' | 'autre';

interface CategoryQuestion {
  id: string;
  question_fr: string;
  question_ar: string;
  type: 'number' | 'select' | 'text';
  options?: { value: string; label_fr: string; label_ar: string }[];
  unit?: string;
}

const CATEGORIES: { value: WorkCategory; label_fr: string; label_ar: string; icon: string }[] = [
  { value: 'peinture', label_fr: 'Peinture', label_ar: 'بانتير (دهان)', icon: '🎨' },
  { value: 'plomberie', label_fr: 'Plomberie', label_ar: 'بلومبري (سباكة)', icon: '🔧' },
  { value: 'electricite', label_fr: 'Électricité', label_ar: 'إليكتريسيتي (كهرباء)', icon: '⚡' },
  { value: 'carrelage', label_fr: 'Carrelage', label_ar: 'كاغلاج (سيراميك)', icon: '🧱' },
  { value: 'maconnerie', label_fr: 'Maçonnerie', label_ar: 'ماسونري (بناء)', icon: '🏗️' },
  { value: 'autre', label_fr: 'Autre', label_ar: 'آخر', icon: '📋' },
];

const CATEGORY_QUESTIONS: Record<WorkCategory, CategoryQuestion[]> = {
  peinture: [
    {
      id: 'surface',
      question_fr: 'Quelle est la surface à peindre ?',
      question_ar: 'كام متر مربع؟',
      type: 'number',
      unit: 'm²',
    },
    {
      id: 'wall_condition',
      question_fr: 'État des murs ?',
      question_ar: 'حالة الحيطان؟',
      type: 'select',
      options: [
        { value: 'bon', label_fr: 'Bon état', label_ar: 'حالة كويسة' },
        { value: 'moyen', label_fr: 'Moyen (fissures légères)', label_ar: 'متوسط (شقوق خفيفة)' },
        { value: 'mauvais', label_fr: 'Mauvais (gros travaux)', label_ar: 'سيء (شغل كتير)' },
      ],
    },
    {
      id: 'coats',
      question_fr: 'Nombre de couches ?',
      question_ar: 'كام طبقة (كوش)?',
      type: 'select',
      options: [
        { value: '1', label_fr: '1 couche', label_ar: 'طبقة واحدة' },
        { value: '2', label_fr: '2 couches', label_ar: 'طبقتين' },
        { value: '3', label_fr: '3 couches', label_ar: '3 طبقات' },
      ],
    },
  ],
  plomberie: [
    {
      id: 'work_type',
      question_fr: 'Type de travaux ?',
      question_ar: 'نوع الشغل؟',
      type: 'select',
      options: [
        { value: 'reparation', label_fr: 'Réparation / Dépannage', label_ar: 'تصليح / دابناج' },
        { value: 'installation', label_fr: 'Installation neuve', label_ar: 'تركيب جديد' },
        { value: 'renovation', label_fr: 'Rénovation complète', label_ar: 'تجديد كامل' },
      ],
    },
    {
      id: 'rooms',
      question_fr: 'Nombre de pièces concernées ?',
      question_ar: 'كام غرفة؟',
      type: 'number',
    },
    {
      id: 'fixtures',
      question_fr: 'Éléments à installer/réparer ?',
      question_ar: 'إيه اللي هتركبه/تصلحه؟',
      type: 'text',
    },
  ],
  electricite: [
    {
      id: 'work_type',
      question_fr: 'Type de travaux ?',
      question_ar: 'نوع الشغل؟',
      type: 'select',
      options: [
        { value: 'depannage', label_fr: 'Dépannage / Réparation', label_ar: 'تصليح / دابناج' },
        { value: 'mise_aux_normes', label_fr: 'Mise aux normes', label_ar: 'تطبيق المعايير' },
        { value: 'installation', label_fr: 'Installation neuve', label_ar: 'تركيب جديد' },
      ],
    },
    {
      id: 'points',
      question_fr: 'Nombre de points électriques ?',
      question_ar: 'كام نقطة كهربا؟',
      type: 'number',
    },
    {
      id: 'tableau',
      question_fr: 'Remplacement du tableau ?',
      question_ar: 'تغيير التابلو؟',
      type: 'select',
      options: [
        { value: 'non', label_fr: 'Non', label_ar: 'لا' },
        { value: 'oui', label_fr: 'Oui', label_ar: 'نعم' },
      ],
    },
  ],
  carrelage: [
    {
      id: 'surface',
      question_fr: 'Surface à carreler ?',
      question_ar: 'كام متر مربع؟',
      type: 'number',
      unit: 'm²',
    },
    {
      id: 'tile_size',
      question_fr: 'Taille des carreaux ?',
      question_ar: 'حجم السيراميك؟',
      type: 'select',
      options: [
        { value: 'petit', label_fr: 'Petit (< 30cm)', label_ar: 'صغير' },
        { value: 'moyen', label_fr: 'Moyen (30-60cm)', label_ar: 'متوسط' },
        { value: 'grand', label_fr: 'Grand format (> 60cm)', label_ar: 'كبير' },
      ],
    },
    {
      id: 'depose',
      question_fr: 'Dépose ancien carrelage ?',
      question_ar: 'شيل السيراميك القديم؟',
      type: 'select',
      options: [
        { value: 'non', label_fr: 'Non', label_ar: 'لا' },
        { value: 'oui', label_fr: 'Oui', label_ar: 'نعم' },
      ],
    },
  ],
  maconnerie: [
    {
      id: 'work_type',
      question_fr: 'Type de travaux ?',
      question_ar: 'نوع الشغل؟',
      type: 'select',
      options: [
        { value: 'mur', label_fr: 'Construction de mur', label_ar: 'بناء حيطة' },
        { value: 'demolition', label_fr: 'Démolition', label_ar: 'هدم' },
        { value: 'fondation', label_fr: 'Fondation', label_ar: 'أساس' },
        { value: 'reparation', label_fr: 'Réparation', label_ar: 'تصليح' },
      ],
    },
    {
      id: 'surface',
      question_fr: 'Surface ou longueur ?',
      question_ar: 'المساحة أو الطول؟',
      type: 'number',
      unit: 'm²/ml',
    },
    {
      id: 'access',
      question_fr: 'Accès au chantier ?',
      question_ar: 'الوصول للشانتي؟',
      type: 'select',
      options: [
        { value: 'facile', label_fr: 'Facile (RDC)', label_ar: 'سهل (دور أرضي)' },
        { value: 'moyen', label_fr: 'Moyen (étage avec ascenseur)', label_ar: 'متوسط (دور + أسانسير)' },
        { value: 'difficile', label_fr: 'Difficile (sans ascenseur)', label_ar: 'صعب (بدون أسانسير)' },
      ],
    },
  ],
  autre: [
    {
      id: 'description',
      question_fr: 'Décrivez les travaux',
      question_ar: 'وصف الشغل؟',
      type: 'text',
    },
    {
      id: 'estimated_hours',
      question_fr: 'Heures estimées ?',
      question_ar: 'كام ساعة تقريباً؟',
      type: 'number',
      unit: 'h',
    },
  ],
};

const LOGISTICS_QUESTIONS: CategoryQuestion[] = [
  {
    id: 'distance',
    question_fr: 'Distance du chantier (km) ?',
    question_ar: 'المسافة للشانتي (كم)؟',
    type: 'number',
    unit: 'km',
  },
  {
    id: 'parking',
    question_fr: 'Difficulté de stationnement ?',
    question_ar: 'صعوبة الباركينغ؟',
    type: 'select',
    options: [
      { value: 'facile', label_fr: 'Facile (gratuit)', label_ar: 'سهل (مجاني)' },
      { value: 'moyen', label_fr: 'Moyen (payant)', label_ar: 'متوسط (مدفوع)' },
      { value: 'difficile', label_fr: 'Difficile (Paris/centre-ville)', label_ar: 'صعب (باريس/وسط المدينة)' },
    ],
  },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

const QuoteWizardModal = ({ open, onOpenChange, onGenerate }: QuoteWizardModalProps) => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCategory, setSelectedCategory] = useState<WorkCategory | null>(null);
  const [categoryAnswers, setCategoryAnswers] = useState<Record<string, string>>({});
  const [logisticsAnswers, setLogisticsAnswers] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const resetWizard = () => {
    setStep(1);
    setSelectedCategory(null);
    setCategoryAnswers({});
    setLogisticsAnswers({});
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetWizard, 300);
  };

  const handleCategorySelect = (category: WorkCategory) => {
    setSelectedCategory(category);
    setCategoryAnswers({});
    setStep(2);
  };

  const handleGenerate = async () => {
    if (!selectedCategory) return;
    
    setIsGenerating(true);
    
    try {
      const categoryInfo = CATEGORIES.find(c => c.value === selectedCategory);
      const questions = CATEGORY_QUESTIONS[selectedCategory];
      
      // Build context for AI
      const answersContext = questions.map(q => {
        const answer = categoryAnswers[q.id];
        if (q.type === 'select' && answer) {
          const option = q.options?.find(o => o.value === answer);
          return `${q.question_fr}: ${option?.label_fr || answer}`;
        }
        return `${q.question_fr}: ${answer || 'Non spécifié'}`;
      }).join('\n');

      const logisticsContext = LOGISTICS_QUESTIONS.map(q => {
        const answer = logisticsAnswers[q.id];
        if (q.type === 'select' && answer) {
          const option = q.options?.find(o => o.value === answer);
          return `${q.question_fr}: ${option?.label_fr || answer}`;
        }
        return `${q.question_fr}: ${answer || 'Non spécifié'}${q.unit ? ` ${q.unit}` : ''}`;
      }).join('\n');

      const { data, error } = await supabase.functions.invoke('invoice-mentor', {
        body: {
          action: 'generate_quote',
          category: categoryInfo?.label_fr,
          categoryAnswers: answersContext,
          logistics: logisticsContext,
        },
      });

      if (error) throw error;

      if (data?.lineItems && Array.isArray(data.lineItems)) {
        const items: LineItem[] = data.lineItems.map((item: any) => ({
          id: generateId(),
          designation_fr: item.designation_fr || item.description || '',
          designation_ar: item.designation_ar || '',
          quantity: item.quantity || 1,
          unit: item.unit || 'm²',
          unitPrice: item.unitPrice || item.prix_unitaire || 0,
          total: (item.quantity || 1) * (item.unitPrice || item.prix_unitaire || 0),
        }));

        onGenerate(items);
        handleClose();
        
        toast({
          title: isRTL ? '✨ تم إنشاء العرض' : '✨ Devis généré',
          description: isRTL 
            ? `تم إضافة ${items.length} سطر. يمكنك تعديلها حسب رغبتك!`
            : `${items.length} lignes ajoutées. Vous pouvez les modifier à votre guise!`,
        });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Quote generation error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'تعذر إنشاء العرض' : 'Impossible de générer le devis',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderCategoryQuestion = (question: CategoryQuestion) => {
    const value = categoryAnswers[question.id] || '';
    
    return (
      <div key={question.id} className="space-y-2">
        <Label className={cn("text-sm font-medium", isRTL && "font-cairo text-right block")}>
          {isRTL ? question.question_ar : question.question_fr}
          {question.unit && <span className="text-muted-foreground ml-1">({question.unit})</span>}
        </Label>
        
        {question.type === 'number' && (
          <Input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setCategoryAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
            className={cn(isRTL && "text-right")}
          />
        )}
        
        {question.type === 'text' && (
          <Input
            value={value}
            onChange={(e) => setCategoryAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
            className={cn(isRTL && "text-right font-cairo")}
            placeholder={isRTL ? "اكتب هنا..." : "Décrivez..."}
          />
        )}
        
        {question.type === 'select' && question.options && (
          <Select
            value={value}
            onValueChange={(v) => setCategoryAnswers(prev => ({ ...prev, [question.id]: v }))}
          >
            <SelectTrigger className={cn(isRTL && "font-cairo")}>
              <SelectValue placeholder={isRTL ? "اختر..." : "Choisir..."} />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {question.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className={cn(isRTL && "font-cairo")}>
                  {isRTL ? opt.label_ar : opt.label_fr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  };

  const renderLogisticsQuestion = (question: CategoryQuestion) => {
    const value = logisticsAnswers[question.id] || '';
    
    return (
      <div key={question.id} className="space-y-2">
        <Label className={cn("text-sm font-medium", isRTL && "font-cairo text-right block")}>
          {isRTL ? question.question_ar : question.question_fr}
        </Label>
        
        {question.type === 'number' && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setLogisticsAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
              className={cn("flex-1", isRTL && "text-right")}
            />
            {question.unit && (
              <span className="text-sm text-muted-foreground">{question.unit}</span>
            )}
          </div>
        )}
        
        {question.type === 'select' && question.options && (
          <RadioGroup
            value={value}
            onValueChange={(v) => setLogisticsAnswers(prev => ({ ...prev, [question.id]: v }))}
            className="space-y-2"
          >
            {question.options.map((opt) => (
              <div key={opt.value} className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <RadioGroupItem value={opt.value} id={`${question.id}-${opt.value}`} />
                <Label 
                  htmlFor={`${question.id}-${opt.value}`}
                  className={cn("text-sm cursor-pointer", isRTL && "font-cairo")}
                >
                  {isRTL ? opt.label_ar : opt.label_fr}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}
      </div>
    );
  };

  const currentQuestions = selectedCategory ? CATEGORY_QUESTIONS[selectedCategory] : [];
  const canProceedToStep3 = currentQuestions.every(q => {
    if (q.type === 'text') return true; // Text is optional
    return !!categoryAnswers[q.id];
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn("max-w-lg", isRTL && "font-cairo")}>
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse text-right")}>
            <Wand2 className="h-5 w-5 text-primary" />
            {step === 1 && (isRTL ? '🧙‍♂️ مساعد الديفي - اختر نوع الشغل' : '🧙‍♂️ Assistant Devis - Nature des travaux')}
            {step === 2 && (isRTL ? '📋 تفاصيل الشغل' : '📋 Détails des travaux')}
            {step === 3 && (isRTL ? '🚚 اللوجستيك' : '🚚 Logistique')}
            {step === 4 && (isRTL ? '✨ إنشاء العرض' : '✨ Génération du devis')}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                step >= s ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Step 1: Category Selection */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 py-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleCategorySelect(cat.value)}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all hover:border-primary hover:bg-primary/5",
                  "flex flex-col items-center gap-2 text-center",
                  isRTL && "font-cairo"
                )}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="font-medium text-sm">{cat.label_fr}</span>
                <span className="text-xs text-muted-foreground">{cat.label_ar}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Category Questions */}
        {step === 2 && selectedCategory && (
          <div className="space-y-4 py-4">
            {currentQuestions.map(renderCategoryQuestion)}
            
            <div className={cn("flex gap-2 pt-4", isRTL && "flex-row-reverse")}>
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                {isRTL ? <ArrowRight className="h-4 w-4 ml-2" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
                {isRTL ? 'رجوع' : 'Retour'}
              </Button>
              <Button 
                onClick={() => setStep(3)} 
                disabled={!canProceedToStep3}
                className="flex-1"
              >
                {isRTL ? 'التالي' : 'Suivant'}
                {isRTL ? <ArrowLeft className="h-4 w-4 mr-2" /> : <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Logistics */}
        {step === 3 && (
          <div className="space-y-4 py-4">
            {LOGISTICS_QUESTIONS.map(renderLogisticsQuestion)}
            
            <div className={cn("flex gap-2 pt-4", isRTL && "flex-row-reverse")}>
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                {isRTL ? <ArrowRight className="h-4 w-4 ml-2" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
                {isRTL ? 'رجوع' : 'Retour'}
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                {isRTL ? 'التالي' : 'Suivant'}
                {isRTL ? <ArrowLeft className="h-4 w-4 mr-2" /> : <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Generate */}
        {step === 4 && (
          <div className="space-y-4 py-4">
            <div className={cn(
              "p-4 rounded-lg bg-primary/10 border border-primary/20 text-center",
              isRTL && "font-cairo"
            )}>
              <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                {isRTL 
                  ? 'الذكاء الاصطناعي سيحلل إجاباتك ويقترح أسعار السوق الفرنسي'
                  : "L'IA va analyser vos réponses et suggérer des prix du marché français"
                }
              </p>
              <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
                {isRTL 
                  ? '⚠️ تقدر تعدل أي سعر أو كمية بعد الإنشاء!'
                  : '⚠️ Vous pourrez modifier tous les prix et quantités après génération!'
                }
              </p>
            </div>

            <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                {isRTL ? <ArrowRight className="h-4 w-4 ml-2" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
                {isRTL ? 'رجوع' : 'Retour'}
              </Button>
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="flex-1 bg-primary"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isRTL ? 'جاري الإنشاء...' : 'Génération...'}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {isRTL ? '✨ أنشئ الديفي' : '✨ Générer le devis'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuoteWizardModal;
