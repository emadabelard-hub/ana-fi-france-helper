import React, { useState, useMemo } from 'react';
import { Calculator, Paintbrush, Layers, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PeintureHeader from '@/components/peinture/PeintureHeader';
import TradeDetection from '@/components/peinture/TradeDetection';
import AnalysisResult from '@/components/peinture/AnalysisResult';

const RATIO_M2_PER_DAY_PER_PERSON = 45;

type WallCondition = 'clean' | 'damaged';

const PeinturePage = () => {
  const { language, isRTL } = useLanguage();
  const isFr = language === 'fr';

  // Basic fields
  const [surface, setSurface] = useState('');
  const [wallCondition, setWallCondition] = useState<WallCondition>('clean');
  const [days, setDays] = useState('');
  const [tradeInput, setTradeInput] = useState('');
  const [showResult, setShowResult] = useState(false);

  // Financial fields
  const [tvaRate, setTvaRate] = useState<10 | 20>(10);
  const [margePct, setMargePct] = useState(10);
  const [beneficePct, setBeneficePct] = useState(15);

  // Technical fields
  const [scaffoldingCost, setScaffoldingCost] = useState('');
  const [paintCost, setPaintCost] = useState('');
  const [consumablesCost, setConsumablesCost] = useState('');
  const [rooms, setRooms] = useState('');
  const [equipmentRental, setEquipmentRental] = useState(false);

  const resetResult = () => setShowResult(false);

  const calculation = useMemo(() => {
    const s = parseFloat(surface) || 0;
    const d = parseFloat(days) || 1;
    if (s === 0) return null;

    const effectiveRatio = wallCondition === 'damaged' ? RATIO_M2_PER_DAY_PER_PERSON * 0.7 : RATIO_M2_PER_DAY_PER_PERSON;
    
    // Room overhead: +0.5 day per extra room for protection/taping
    const roomCount = parseInt(rooms) || 1;
    const roomOverhead = Math.max(0, (roomCount - 1) * 0.5);
    
    const baseDaysNeeded = s / effectiveRatio;
    const totalDaysNeeded = Math.ceil(baseDaysNeeded + roomOverhead);
    const workersNeeded = Math.ceil(totalDaysNeeded / d);
    const needsReinforcement = workersNeeded > 1;

    // Financial calculations
    const materialTotal = (parseFloat(paintCost) || 0) + (parseFloat(consumablesCost) || 0) + (parseFloat(scaffoldingCost) || 0);
    
    // Base labor cost estimate: 200€/day/worker as baseline
    const laborCost = workersNeeded * d * 200;
    const subtotal = laborCost + materialTotal;
    
    const margeAmount = subtotal * (margePct / 100);
    const beneficeAmount = subtotal * (beneficePct / 100);
    const totalHT = subtotal + margeAmount + beneficeAmount;
    const totalTVA = totalHT * (tvaRate / 100);
    const totalTTC = totalHT + totalTVA;

    const totalExpenses = materialTotal + totalTVA;
    const gainNetJournalier = d > 0 ? (totalHT - materialTotal - totalTVA) / d : 0;

    return {
      totalDaysNeeded, workersNeeded, needsReinforcement,
      totalHT, totalTVA, totalTTC, gainNetJournalier,
      tvaRate, margeAmount, beneficeAmount,
    };
  }, [surface, days, wallCondition, rooms, paintCost, consumablesCost, scaffoldingCost, margePct, beneficePct, tvaRate]);

  const handleCalculate = () => {
    if (surface && days) setShowResult(true);
  };

  return (
    <div className={cn("min-h-screen bg-background pb-24", isRTL && "font-cairo")} dir={isRTL ? 'rtl' : 'ltr'}>
      <PeintureHeader isFr={isFr} isRTL={isRTL} />

      <div className="p-4 space-y-5 max-w-lg mx-auto">
        <TradeDetection isFr={isFr} isRTL={isRTL} tradeInput={tradeInput} setTradeInput={setTradeInput} />

        {/* Main Form */}
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
              <Input type="number" placeholder={isFr ? 'Ex: 120' : 'مثال: 120'} value={surface}
                onChange={(e) => { setSurface(e.target.value); resetResult(); }} className="text-base font-bold" min="1" />
            </div>

            {/* Wall condition */}
            <div className="space-y-2">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                {isFr ? 'État des murs' : 'حالة الحيطان'}
              </Label>
              <div className={cn("flex gap-3", isRTL && "flex-row-reverse")}>
                <Button type="button" variant={wallCondition === 'clean' ? 'default' : 'outline'}
                  onClick={() => { setWallCondition('clean'); resetResult(); }} className="flex-1 font-bold">
                  {isFr ? '✨ Propre' : '✨ نظيفة'}
                </Button>
                <Button type="button" variant={wallCondition === 'damaged' ? 'destructive' : 'outline'}
                  onClick={() => { setWallCondition('damaged'); resetResult(); }} className="flex-1 font-bold">
                  {isFr ? '🔨 Abîmé' : '🔨 متخربة'}
                </Button>
              </div>
            </div>

            {/* Days */}
            <div className="space-y-1">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                {isFr ? 'Nombre de jours souhaités' : 'عدد الأيام المطلوبة'}
              </Label>
              <Input type="number" placeholder={isFr ? 'Ex: 3' : 'مثال: 3'} value={days}
                onChange={(e) => { setDays(e.target.value); resetResult(); }} className="text-base font-bold" min="1" />
            </div>

            {/* Rooms */}
            <div className="space-y-1">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                <Home className="h-4 w-4 inline mr-1" />
                {isFr ? 'Nombre de pièces' : 'عدد الغرف (البيسات)'}
              </Label>
              <Input type="number" placeholder={isFr ? 'Ex: 4' : 'مثال: 4'} value={rooms}
                onChange={(e) => { setRooms(e.target.value); resetResult(); }} className="text-base font-bold" min="1" />
              <p className={cn("text-xs text-muted-foreground font-bold", isRTL && "text-right")}>
                {isFr ? '+0,5 jour par pièce supplémentaire (protection, scotch…)' : '+0.5 يوم لكل غرفة إضافية (حماية، سكوتش...)'}
              </p>
            </div>

            {/* Equipment rental */}
            <div className={cn("flex items-center gap-3 pt-1", isRTL && "flex-row-reverse")}>
              <Checkbox id="equipment" checked={equipmentRental} onCheckedChange={(c) => setEquipmentRental(!!c)} />
              <Label htmlFor="equipment" className="font-bold text-sm cursor-pointer">
                {isFr ? '🛠️ Location de matériel' : '🛠️ تأجير معدات'}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Financial Intelligence */}
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-base font-black flex items-center gap-2 text-amber-600 dark:text-amber-400", isRTL && "flex-row-reverse")}>
              💰 {isFr ? 'Intelligence Financière' : 'الذكاء المالي'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* TVA Selector */}
            <div className="space-y-2">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                {isFr ? 'Taux de TVA' : 'نسبة الضريبة (TVA)'}
              </Label>
              <div className={cn("flex gap-3", isRTL && "flex-row-reverse")}>
                <Button type="button" variant={tvaRate === 10 ? 'default' : 'outline'}
                  onClick={() => { setTvaRate(10); resetResult(); }} className="flex-1 font-bold">
                  10% {isFr ? '(Rénovation)' : '(تجديد)'}
                </Button>
                <Button type="button" variant={tvaRate === 20 ? 'default' : 'outline'}
                  onClick={() => { setTvaRate(20); resetResult(); }} className="flex-1 font-bold">
                  20% {isFr ? '(Neuf/Pro)' : '(جديد/Pro)'}
                </Button>
              </div>
            </div>

            {/* Marge de Sécurité */}
            <div className="space-y-2">
              <div className={cn("flex justify-between items-center", isRTL && "flex-row-reverse")}>
                <Label className="font-bold text-sm">
                  {isFr ? 'Marge de sécurité' : 'هامش الأمان'}
                </Label>
                <span className="text-sm font-black text-amber-600">{margePct}%</span>
              </div>
              <Slider value={[margePct]} onValueChange={(v) => { setMargePct(v[0]); resetResult(); }}
                min={0} max={20} step={1} className="w-full" />
              <p className={cn("text-xs text-muted-foreground font-bold", isRTL && "text-right")}>
                {isFr ? 'Imprévus, retouches, pertes matériaux' : 'مشاكل غير متوقعة، تصحيحات، خسارة مواد'}
              </p>
            </div>

            {/* Bénéfice Net */}
            <div className="space-y-2">
              <div className={cn("flex justify-between items-center", isRTL && "flex-row-reverse")}>
                <Label className="font-bold text-sm">
                  {isFr ? 'Bénéfice Net' : 'الربح الصافي'}
                </Label>
                <span className="text-sm font-black text-green-600">{beneficePct}%</span>
              </div>
              <Slider value={[beneficePct]} onValueChange={(v) => { setBeneficePct(v[0]); resetResult(); }}
                min={0} max={40} step={1} className="w-full" />
            </div>
          </CardContent>
        </Card>

        {/* Technical Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-base font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Layers className="h-5 w-5 text-primary" />
              {isFr ? 'Fournitures & Détails Techniques' : 'المواد والتفاصيل التقنية'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                {isFr ? 'Prix Peinture total (€)' : 'ثمن الصباغة الإجمالي (€)'}
              </Label>
              <Input type="number" placeholder="0" value={paintCost}
                onChange={(e) => { setPaintCost(e.target.value); resetResult(); }} className="text-base font-bold" min="0" />
            </div>

            <div className="space-y-1">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                {isFr ? 'Enduits & Consommables (€)' : 'معجون ومواد استهلاكية (€)'}
              </Label>
              <Input type="number" placeholder="0" value={consumablesCost}
                onChange={(e) => { setConsumablesCost(e.target.value); resetResult(); }} className="text-base font-bold" min="0" />
            </div>

            <div className="space-y-1">
              <Label className={cn("font-bold text-sm", isRTL && "block text-right")}>
                🏗️ {isFr ? 'Échafaudage / Location hauteur (€)' : 'سقالات / إيجار ارتفاع (€)'}
              </Label>
              <Input type="number" placeholder={isFr ? 'Si hauteur > 2.5m' : 'إذا الارتفاع > 2.5 متر'} value={scaffoldingCost}
                onChange={(e) => { setScaffoldingCost(e.target.value); resetResult(); }} className="text-base font-bold" min="0" />
            </div>
          </CardContent>
        </Card>

        {/* Calculate Button */}
        <Button onClick={handleCalculate} disabled={!surface || !days}
          className="w-full font-black text-base py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
          <Calculator className="h-5 w-5 mr-2" />
          {isFr ? 'Lancer l\'Analyse Complète' : 'ابدأ التحليل الشامل'}
        </Button>

        {/* Analysis Result */}
        {showResult && calculation && (
          <AnalysisResult
            data={calculation}
            isFr={isFr}
            isRTL={isRTL}
            surface={surface}
            days={days}
            wallCondition={wallCondition}
            equipmentRental={equipmentRental}
          />
        )}
      </div>
    </div>
  );
};

export default PeinturePage;
