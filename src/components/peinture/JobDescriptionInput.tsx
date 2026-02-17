import React from 'react';
import { ClipboardList, Loader2, MapPin, Clock } from 'lucide-react';
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
    "صباغة شقة كاملة 65 متر مربع، 4 غرف + ممر، الحيطان متخربة",
    "تركيب زليج 40 متر في المطبخ والحمام، لازم نحيّد الزليج القديم",
    "تجديد الكهرباء الكاملة لمحل تجاري 80 متر مربع",
  ],
};

const LOCATIONS = [
  { label: "Paris / Île-de-France", value: "Paris / Île-de-France" },
  { label: "Lyon / Rhône-Alpes", value: "Lyon / Rhône-Alpes" },
  { label: "Marseille / PACA", value: "Marseille / PACA" },
  { label: "Province (autre)", value: "Province" },
];

const JobDescriptionInput: React.FC<JobDescriptionInputProps> = ({
  isFr, isRTL, description, setDescription, location, setLocation, estimatedDuration, setEstimatedDuration, onAnalyze, isLoading
}) => {
  const examples = isFr ? EXAMPLES.fr : EXAMPLES.ar;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-base font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <ClipboardList className="h-5 w-5 text-primary" />
          {isFr ? 'Description du chantier' : 'وصف العمل المطلوب'}
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

        <Textarea
          placeholder={isFr
            ? "Décrivez le chantier en détail : type de travaux, surface, état actuel, nombre de pièces, contraintes particulières..."
            : "وصّف الخدمة بالتفصيل: نوع العمل، المساحة، الحالة الحالية، عدد الغرف، أي شيء خاص..."
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={cn("min-h-[120px] text-base font-bold resize-none", isRTL && "text-right")}
          dir={isRTL ? 'rtl' : 'ltr'}
        />

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
