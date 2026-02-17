import React from 'react';
import { ClipboardList, Loader2, MapPin, Clock, ShoppingCart, Home, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface JobDescriptionInputProps {
  isFr: boolean;
  isRTL: boolean;
  description: string;
  setDescription: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  estimatedDuration: string;
  setEstimatedDuration: (v: string) => void;
  materialBuyer: string;
  setMaterialBuyer: (v: string) => void;
  propertyAge: string;
  setPropertyAge: (v: string) => void;
  taxStatus: string;
  setTaxStatus: (v: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
}

const EXAMPLES = {
  fr: [
    "Peinture complète d'un appartement T3 (65m²), murs abîmés, 4 pièces + couloir, hauteur 2.5m",
    "Pose de carrelage 40m² dans une cuisine et salle de bain, sol existant à déposer",
    "Rénovation électrique complète d'un local commercial 80m², mise aux normes NF C 15-100",
  ],
  ar: [
    "بانتير (Peinture) شقة كاملة 65 متر مربع، 4 أوض + طرقة، الحيطان محتاجة تصليح",
    "تركيب كاريلاج (Carrelage) 40 متر في المطبخ والحمام، لازم نشيل القديم الأول",
    "تجديد إليكتريسيتي (Électricité) كامل لمحل تجاري 80 متر مربع",
  ],
};

const LOCATIONS = [
  { label: "Paris / Île-de-France", value: "Paris / Île-de-France" },
  { label: "Lyon / Rhône-Alpes", value: "Lyon / Rhône-Alpes" },
  { label: "Marseille / PACA", value: "Marseille / PACA" },
  { label: "Province (autre)", value: "Province" },
];

const JobDescriptionInput: React.FC<JobDescriptionInputProps> = ({
  isFr, isRTL, description, setDescription, location, setLocation, estimatedDuration, setEstimatedDuration,
  materialBuyer, setMaterialBuyer, propertyAge, setPropertyAge, taxStatus, setTaxStatus,
  onAnalyze, isLoading
}) => {
  const examples = isFr ? EXAMPLES.fr : EXAMPLES.ar;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-base font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <ClipboardList className="h-5 w-5 text-primary" />
          {isFr ? 'Description du chantier' : 'وصف الشغل'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Location & Duration row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={cn("text-xs font-black flex items-center gap-1", isRTL && "flex-row-reverse")}>
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {isFr ? 'Localisation' : 'المكان'}
            </Label>
            <Input
              placeholder={isFr ? "Ex: Paris, Lyon..." : "باريس، ليون..."}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={cn("text-sm font-bold", isRTL && "text-right")}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            <div className="flex flex-wrap gap-1">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc.value}
                  onClick={() => setLocation(loc.value)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors",
                    location === loc.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={cn("text-xs font-black flex items-center gap-1", isRTL && "flex-row-reverse")}>
              <Clock className="h-3.5 w-3.5 text-primary" />
              {isFr ? 'Durée estimée' : 'المدة المتوقعة'}
            </Label>
            <Input
              placeholder={isFr ? "Ex: 5 jours, 2 semaines" : "5 أيام، أسبوعين"}
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(e.target.value)}
              className={cn("text-sm font-bold", isRTL && "text-right")}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          </div>
        </div>

        {/* Interactive Questions */}
        <div className="space-y-2.5 bg-muted/30 rounded-xl p-3 border border-border/50">
          <p className={cn("text-xs font-black text-primary flex items-center gap-1.5", isRTL && "flex-row-reverse")}>
            💡 {isFr ? 'Questions importantes pour le calcul' : 'أسئلة مهمة عشان الحسابات تطلع صح'}
          </p>

          {/* Material Buyer */}
          <div className="space-y-1.5">
            <Label className={cn("text-xs font-bold flex items-center gap-1", isRTL && "flex-row-reverse")}>
              <ShoppingCart className="h-3 w-3 text-amber-500" />
              {isFr ? 'Qui achète les matériaux ?' : 'مين اللي هيشتري المواد؟'}
            </Label>
            <div className="flex gap-2">
              <button
                onClick={() => setMaterialBuyer('client')}
                className={cn(
                  "flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition-colors",
                  materialBuyer === 'client'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                {isFr ? '🏠 Le client' : '🏠 الزبون'}
              </button>
              <button
                onClick={() => setMaterialBuyer('contractor')}
                className={cn(
                  "flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition-colors",
                  materialBuyer === 'contractor'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                {isFr ? '🔧 L\'entrepreneur' : '🔧 المقاول'}
              </button>
            </div>
            <p className={cn("text-[10px] text-muted-foreground", isRTL && "text-right")}>
              {isFr 
                ? 'Impacte le calcul de TVA (10% rénovation vs 20% neuf)' 
                : 'ده بيأثر على حساب الضريبة (تي في إيه TVA)'}
            </p>
          </div>

          {/* Property Age */}
          <div className="space-y-1.5">
            <Label className={cn("text-xs font-bold flex items-center gap-1", isRTL && "flex-row-reverse")}>
              <Home className="h-3 w-3 text-emerald-500" />
              {isFr ? 'Âge du bien ?' : 'البيت بقاله قد إيه؟'}
            </Label>
            <div className="flex gap-2">
              <button
                onClick={() => setPropertyAge('old')}
                className={cn(
                  "flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition-colors",
                  propertyAge === 'old'
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                {isFr ? '🏗️ +2 ans (TVA 10%)' : '🏗️ أكتر من سنتين (10%)'}
              </button>
              <button
                onClick={() => setPropertyAge('new')}
                className={cn(
                  "flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition-colors",
                  propertyAge === 'new'
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                {isFr ? '🆕 Neuf (TVA 20%)' : '🆕 جديد (20%)'}
              </button>
            </div>
          </div>

          {/* Tax Status */}
          <div className="space-y-1.5">
            <Label className={cn("text-xs font-bold flex items-center gap-1", isRTL && "flex-row-reverse")}>
              <Briefcase className="h-3 w-3 text-purple-500" />
              {isFr ? 'Votre statut ?' : 'نظامك الضريبي إيه؟'}
            </Label>
            <div className="flex gap-2">
              <button
                onClick={() => setTaxStatus('ae')}
                className={cn(
                  "flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition-colors",
                  taxStatus === 'ae'
                    ? "bg-indigo-500 text-white border-indigo-500"
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                {isFr ? 'Auto-entrepreneur' : 'أوتو أونتروبرونور'}
              </button>
              <button
                onClick={() => setTaxStatus('sarl')}
                className={cn(
                  "flex-1 text-xs font-bold py-2 px-3 rounded-lg border transition-colors",
                  taxStatus === 'sarl'
                    ? "bg-violet-500 text-white border-violet-500"
                    : "bg-background border-border hover:bg-muted"
                )}
              >
                {isFr ? 'SARL / EURL' : 'ساغل (SARL)'}
              </button>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className={cn("text-xs font-bold text-muted-foreground", isRTL && "text-right block")}>
            {isFr 
              ? 'Plus vous décrivez, plus le calcul est précis' 
              : 'اكتب كل تفاصيل المشروع.. كل ما زادت التفاصيل، كل ما الحسابات بقت أدق'}
          </Label>
          <Textarea
            placeholder={isFr
              ? "Décrivez le chantier en détail : type de travaux, surface, état actuel, nombre de pièces, contraintes particulières..."
              : "وصّف الشغل بالتفصيل: نوع الشغل، المساحة، الحالة الحالية، عدد الأوض، أي حاجة خاصة..."
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cn("min-h-[140px] text-base font-bold resize-none", isRTL && "text-right")}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Quick examples */}
        <div className="space-y-1.5">
          <p className={cn("text-xs font-bold text-muted-foreground", isRTL && "text-right")}>
            {isFr ? '💡 Exemples rapides :' : '💡 أمثلة سريعة:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => setDescription(ex)}
                className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground px-2.5 py-1.5 rounded-lg font-bold transition-colors text-left"
              >
                {ex.length > 50 ? ex.slice(0, 50) + '…' : ex}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={onAnalyze}
          disabled={!description.trim() || isLoading}
          className="w-full font-black text-base py-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {isFr ? 'Analyse en cours...' : 'جاري التحليل...'}
            </>
          ) : (
            <>
              <ClipboardList className="h-5 w-5 mr-2" />
              {isFr ? 'Lancer l\'Analyse IA' : 'ابدأ التحليل بالذكاء الاصطناعي'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default JobDescriptionInput;
