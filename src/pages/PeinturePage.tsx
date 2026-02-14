import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Paintbrush, AlertTriangle, Calculator, Users, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const PAINTING_KEYWORDS = ['بانتيرة', 'صباغة', 'peinture', 'bantera', 'painting', 'peindre'];
const RATIO_M2_PER_DAY_PER_PERSON = 45;

type WallCondition = 'clean' | 'damaged';

const PeinturePage = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  const [surface, setSurface] = useState('');
  const [wallCondition, setWallCondition] = useState<WallCondition>('clean');
  const [days, setDays] = useState('');
  const [equipmentRental, setEquipmentRental] = useState(false);
  const [tradeInput, setTradeInput] = useState('');
  const [showResult, setShowResult] = useState(false);

  const detectedTrade = useMemo(() => {
    const lower = tradeInput.toLowerCase();
    return PAINTING_KEYWORDS.some(kw => lower.includes(kw));
  }, [tradeInput]);

  const calculation = useMemo(() => {
    const s = parseFloat(surface) || 0;
    const d = parseFloat(days) || 1;
    if (s === 0) return null;

    // Damaged walls reduce efficiency by 30%
    const effectiveRatio = wallCondition === 'damaged' ? RATIO_M2_PER_DAY_PER_PERSON * 0.7 : RATIO_M2_PER_DAY_PER_PERSON;
    const totalDaysNeeded = Math.ceil(s / effectiveRatio);
    const workersNeeded = Math.ceil(totalDaysNeeded / d);
    const needsReinforcement = workersNeeded > 1;

    return { totalDaysNeeded, workersNeeded, needsReinforcement, effectiveRatio };
  }, [surface, days, wallCondition]);

  const handleCalculate = () => {
    if (surface && days) setShowResult(true);
  };

  const isFr = language === 'fr';

  return (
    <div className={cn("min-h-screen bg-background pb-24", isRTL && "font-cairo")} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 pt-14 flex items-center gap-3 text-white">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/20">
          <ArrowLeft size={24} className={isRTL ? 'rotate-180' : ''} />
        </button>
        <Paintbrush size={28} />
        <div>
          <h1 className="text-xl font-black">
            {isFr ? 'Module Peinture (Bantera)' : 'وحدة الصباغة (بانتيرة)'}
          </h1>
          <p className="text-xs opacity-80 font-bold">
            {isFr ? 'Estimation intelligente des travaux' : 'حساب ذكي لأشغال الصباغة'}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-5 max-w-lg mx-auto">
        {/* Trade Detection */}
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-base font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Paintbrush className="h-5 w-5 text-amber-500" />
              {isFr ? 'Détection du métier' : 'تحديد المهنة'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder={isFr ? 'Tapez votre métier (ex: peinture, بانتيرة, صباغة)' : 'اكتب مهنتك (مثلا: بانتيرة، صباغة، peinture)'}
              value={tradeInput}
              onChange={(e) => setTradeInput(e.target.value)}
              className={cn("text-base font-bold", isRTL && "text-right")}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            {tradeInput && (
              <p className={cn("mt-2 text-sm font-bold", detectedTrade ? "text-green-600" : "text-muted-foreground", isRTL && "text-right")}>
                {detectedTrade
                  ? (isFr ? '✅ Métier détecté : Peinture' : '✅ المهنة المكتشفة: صباغة (بانتيرة)')
                  : (isFr ? '❓ Métier non reconnu' : '❓ المهنة غير معروفة')
                }
              </p>
            )}
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-base font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Calculator className="h-5 w-5 text-primary" />
              {isFr ? 'Données du chantier' : 'بيانات الشانتييه'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Surface */}
            <div className="space-y-1">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                {isFr ? 'Surface en m²' : 'المساحة بالمتر المربع (m²)'}
              </Label>
              <Input
                type="number"
                placeholder={isFr ? 'Ex: 120' : 'مثال: 120'}
                value={surface}
                onChange={(e) => { setSurface(e.target.value); setShowResult(false); }}
                className="text-base font-bold"
                min="1"
              />
            </div>

            {/* Wall condition */}
            <div className="space-y-2">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                {isFr ? 'État des murs' : 'حالة الحيطان'}
              </Label>
              <div className={cn("flex gap-3", isRTL && "flex-row-reverse")}>
                <Button
                  type="button"
                  variant={wallCondition === 'clean' ? 'default' : 'outline'}
                  onClick={() => { setWallCondition('clean'); setShowResult(false); }}
                  className="flex-1 font-bold"
                >
                  {isFr ? '✨ Propre' : '✨ نظيفة'}
                </Button>
                <Button
                  type="button"
                  variant={wallCondition === 'damaged' ? 'destructive' : 'outline'}
                  onClick={() => { setWallCondition('damaged'); setShowResult(false); }}
                  className="flex-1 font-bold"
                >
                  {isFr ? '🔨 Abîmé' : '🔨 متخربة'}
                </Button>
              </div>
            </div>

            {/* Days */}
            <div className="space-y-1">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                {isFr ? 'Nombre de jours souhaités' : 'عدد الأيام المطلوبة'}
              </Label>
              <Input
                type="number"
                placeholder={isFr ? 'Ex: 3' : 'مثال: 3'}
                value={days}
                onChange={(e) => { setDays(e.target.value); setShowResult(false); }}
                className="text-base font-bold"
                min="1"
              />
            </div>

            {/* Equipment rental */}
            <div className={cn("flex items-center gap-3 pt-2", isRTL && "flex-row-reverse")}>
              <Checkbox
                id="equipment"
                checked={equipmentRental}
                onCheckedChange={(checked) => setEquipmentRental(!!checked)}
              />
              <Label htmlFor="equipment" className="font-bold text-sm cursor-pointer">
                {isFr ? '🛠️ Location de matériel' : '🛠️ تأجير معدات'}
              </Label>
            </div>

            <Button
              onClick={handleCalculate}
              disabled={!surface || !days}
              className="w-full mt-4 font-black text-base py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              <Calculator className="h-5 w-5 mr-2" />
              {isFr ? 'Calculer' : 'احسب'}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {showResult && calculation && (
          <Card className="border-2 border-amber-400 animate-fade-in">
            <CardHeader className="pb-2">
              <CardTitle className={cn("text-base font-black flex items-center gap-2 text-amber-600", isRTL && "flex-row-reverse")}>
                <Users className="h-5 w-5" />
                {isFr ? 'Résultat de l\'estimation' : 'نتيجة الحساب'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={cn("grid grid-cols-2 gap-3")}>
                <div className="bg-muted rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-primary">{calculation.totalDaysNeeded}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {isFr ? 'Jours (1 personne)' : 'أيام (شخص واحد)'}
                  </p>
                </div>
                <div className="bg-muted rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-amber-600">{calculation.workersNeeded}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {isFr ? 'Ouvrier(s) nécessaire(s)' : 'عمال مطلوبين'}
                  </p>
                </div>
              </div>

              {wallCondition === 'damaged' && (
                <p className={cn("text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-950 p-3 rounded-xl", isRTL && "text-right")}>
                  ⚠️ {isFr ? 'Murs abîmés : rendement réduit de 30% (ponçage, enduit, etc.)' : 'الحيطان متخربة: الإنتاجية أقل بـ30% (صنفرة، معجون، إلخ)'}
                </p>
              )}

              {equipmentRental && (
                <p className={cn("text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 p-3 rounded-xl", isRTL && "text-right")}>
                  🛠️ {isFr ? 'N\'oubliez pas d\'inclure le coût de location dans votre devis.' : 'ما تنساش تحط تكلفة الإيجار في الدوفي بتاعك.'}
                </p>
              )}

              {/* Reinforcement Alert */}
              {calculation.needsReinforcement && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 border-2 border-red-300 dark:border-red-700 rounded-2xl p-4 animate-fade-in">
                  <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
                    <AlertTriangle className="h-8 w-8 text-red-500 shrink-0 mt-1" />
                    <div className={isRTL ? "text-right" : ""}>
                      <p className="font-black text-lg text-red-700 dark:text-red-400 font-cairo">
                        Ya Batal, il te faut du renfort pour finir à temps !
                      </p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-300 mt-1">
                        {isFr
                          ? `Vous avez besoin de ${calculation.workersNeeded} ouvriers pour finir ${surface}m² en ${days} jour(s).`
                          : `محتاج ${calculation.workersNeeded} عمال عشان تخلص ${surface}م² في ${days} يوم.`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!calculation.needsReinforcement && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 rounded-2xl p-4">
                  <p className={cn("font-black text-green-700 dark:text-green-400", isRTL && "text-right font-cairo")}>
                    ✅ {isFr
                      ? `C'est faisable seul en ${calculation.totalDaysNeeded} jour(s). Bon courage !`
                      : `تقدر تخلصها لوحدك في ${calculation.totalDaysNeeded} يوم. بالتوفيق!`
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PeinturePage;
