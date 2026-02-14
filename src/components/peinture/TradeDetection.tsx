import React from 'react';
import { Paintbrush } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PAINTING_KEYWORDS = ['بانتيرة', 'صباغة', 'peinture', 'bantera', 'painting', 'peindre'];

interface TradeDetectionProps {
  isFr: boolean;
  isRTL: boolean;
  tradeInput: string;
  setTradeInput: (v: string) => void;
}

const TradeDetection: React.FC<TradeDetectionProps> = ({ isFr, isRTL, tradeInput, setTradeInput }) => {
  const detectedTrade = PAINTING_KEYWORDS.some(kw => tradeInput.toLowerCase().includes(kw));

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-base font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <Paintbrush className="h-5 w-5 text-amber-500" />
          {isFr ? 'Détection du métier' : 'تحديد المهنة'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          placeholder={isFr ? 'Tapez votre métier (ex: peinture, بانتيرة)' : 'اكتب مهنتك (مثلا: بانتيرة، صباغة)'}
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
  );
};

export default TradeDetection;
