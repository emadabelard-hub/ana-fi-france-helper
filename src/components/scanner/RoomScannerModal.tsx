import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Camera, Ruler, Send, Loader2, RefreshCw, ScanLine, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RoomDimensions {
  length: number;
  width: number;
  height: number;
  confidence: string;
  notes: string;
}

interface RoomScannerModalProps {
  open: boolean;
  onClose: () => void;
  isRTL: boolean;
}

type Step = 'capture' | 'analyzing' | 'results';

const RoomScannerModal: React.FC<RoomScannerModalProps> = ({ open, onClose, isRTL }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('capture');
  const [dimensions, setDimensions] = useState<RoomDimensions>({
    length: 4, width: 3.5, height: 2.5, confidence: '', notes: '',
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const surfaceSol = +(dimensions.length * dimensions.width).toFixed(2);
  const perimetre = 2 * (dimensions.length + dimensions.width);
  const surfaceMurs = +(perimetre * dimensions.height).toFixed(2);

  const resetState = () => {
    setStep('capture');
    setDimensions({ length: 4, width: 3.5, height: 2.5, confidence: '', notes: '' });
    setPhotoPreview(null);
    setIsEditing(false);
  };

  const handleCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: isRTL ? 'الملف كبير جداً' : 'Fichier trop volumineux' });
      return;
    }

    setStep('analyzing');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoPreview(base64);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-room`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageBase64: base64,
            language: isRTL ? 'ar' : 'fr',
          }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'Analysis failed');
        }

        const result: RoomDimensions = await resp.json();
        setDimensions(result);
        setStep('results');
      } catch (err: any) {
        console.error('Room scan error:', err);
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ في التحليل' : 'Erreur d\'analyse',
          description: err.message,
        });
        // Fall back to manual entry
        setStep('results');
        setIsEditing(true);
      }
    };
    reader.readAsDataURL(file);

    if (cameraRef.current) cameraRef.current.value = '';
  }, [isRTL, toast]);

  const handleSendToDevis = () => {
    const description = isRTL
      ? `غرفة ${dimensions.length}م × ${dimensions.width}م × ${dimensions.height}م ارتفاع\nسطح الأرض: ${surfaceSol} م²\nسطح الحيطان: ${surfaceMurs} م²`
      : `Pièce ${dimensions.length}m × ${dimensions.width}m × ${dimensions.height}m hauteur\nSurface sol: ${surfaceSol} m²\nSurface murs: ${surfaceMurs} m²`;

    navigate('/pro/smart-devis', {
      state: {
        prefillDescription: description,
        roomDimensions: {
          length: dimensions.length,
          width: dimensions.width,
          height: dimensions.height,
          surfaceSol,
          surfaceMurs,
        },
      },
    });

    toast({
      title: isRTL ? '📐 تم إرسال القياسات للديفي الذكي' : '📐 Dimensions envoyées au Devis Intelligent',
    });

    onClose();
    resetState();
  };

  const handleDimChange = (key: 'length' | 'width' | 'height', value: string) => {
    const num = parseFloat(value) || 0;
    setDimensions(prev => ({ ...prev, [key]: num }));
  };

  const suggestedWorks = [
    { label: isRTL ? '🎨 دهان حيطان' : '🎨 Peinture murs', surface: `${surfaceMurs} m²` },
    { label: isRTL ? '🏗️ كاريلاج أرضية' : '🏗️ Carrelage sol', surface: `${surfaceSol} m²` },
    { label: isRTL ? '🪵 باركي' : '🪵 Parquet', surface: `${surfaceSol} m²` },
    { label: isRTL ? '🧱 شابة بيطون' : '🧱 Chape béton', surface: `${surfaceSol} m²` },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetState(); } }}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2 text-lg", isRTL && "font-cairo flex-row-reverse")}>
            <ScanLine size={22} className="text-primary" />
            {isRTL ? '📐 سكانير الغرفة' : '📐 Scanner la pièce'}
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Capture */}
        {step === 'capture' && (
          <div className="space-y-4 py-2">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Camera size={36} className="text-primary" />
              </div>
              <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")} dir={isRTL ? "rtl" : "ltr"}>
                {isRTL
                  ? 'صوّر الغرفة والذكاء الاصطناعي هيقدّر القياسات. بعدها تقدر تعدّل يدوياً.'
                  : 'Prenez une photo de la pièce. L\'IA estimera les dimensions, puis vous pourrez les ajuster.'}
              </p>
            </div>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />

            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
            >
              <Camera size={20} />
              {isRTL ? '📸 صوّر الغرفة' : '📸 Photographier la pièce'}
            </button>

            {/* Manual entry option */}
            <button
              onClick={() => { setStep('results'); setIsEditing(true); }}
              className="w-full py-3 rounded-xl border border-border text-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors"
            >
              <Pencil size={16} />
              {isRTL ? '✏️ إدخال يدوي' : '✏️ Saisie manuelle'}
            </button>
          </div>
        )}

        {/* STEP 2: Analyzing */}
        {step === 'analyzing' && (
          <div className="py-8 text-center space-y-4">
            {photoPreview && (
              <img src={photoPreview} alt="Room" className="w-full h-40 object-cover rounded-xl border border-border" />
            )}
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 size={28} className="text-primary animate-spin" />
              </div>
              <p className={cn("text-sm font-bold text-foreground", isRTL && "font-cairo")}>
                {isRTL ? '🔍 جاري تحليل الغرفة...' : '🔍 Analyse de la pièce...'}
              </p>
              <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'الذكاء الاصطناعي بيقدّر الأبعاد' : 'L\'IA estime les dimensions'}
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: Results */}
        {step === 'results' && (
          <div className="space-y-4 py-2" dir={isRTL ? "rtl" : "ltr"}>
            {/* Photo preview */}
            {photoPreview && (
              <img src={photoPreview} alt="Room" className="w-full h-32 object-cover rounded-xl border border-border" />
            )}

            {/* Confidence badge */}
            {dimensions.confidence && (
              <div className="flex items-center justify-center">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  dimensions.confidence === 'high' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  dimensions.confidence === 'medium' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  {isRTL
                    ? `دقة: ${dimensions.confidence === 'high' ? 'عالية ✅' : dimensions.confidence === 'medium' ? 'متوسطة ⚠️' : 'منخفضة ❌'}`
                    : `Précision: ${dimensions.confidence === 'high' ? 'haute ✅' : dimensions.confidence === 'medium' ? 'moyenne ⚠️' : 'basse ❌'}`}
                </span>
              </div>
            )}

            {dimensions.notes && (
              <p className={cn("text-xs text-muted-foreground text-center", isRTL && "font-cairo")}>{dimensions.notes}</p>
            )}

            {/* Dimensions inputs */}
            <div className="bg-muted/50 rounded-xl p-3 space-y-3 border border-border">
              <div className="flex items-center justify-between">
                <h3 className={cn("text-sm font-bold text-foreground flex items-center gap-1.5", isRTL && "font-cairo")}>
                  <Ruler size={16} className="text-primary" />
                  {isRTL ? 'الأبعاد (متر)' : 'Dimensions (m)'}
                </h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs text-primary font-bold hover:underline"
                >
                  {isEditing ? (isRTL ? 'تم ✓' : 'OK ✓') : (isRTL ? 'تعديل ✏️' : 'Modifier ✏️')}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['length', 'width', 'height'] as const).map((key) => (
                  <div key={key} className="text-center">
                    <label className={cn("text-[10px] font-bold text-muted-foreground uppercase block mb-1", isRTL && "font-cairo")}>
                      {key === 'length' ? (isRTL ? 'الطول' : 'Long.') :
                       key === 'width' ? (isRTL ? 'العرض' : 'Larg.') :
                       (isRTL ? 'الارتفاع' : 'Haut.')}
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="20"
                        value={dimensions[key]}
                        onChange={(e) => handleDimChange(key, e.target.value)}
                        className="w-full text-center text-lg font-bold bg-background border border-border rounded-lg py-1.5 text-foreground outline-none focus:border-primary"
                      />
                    ) : (
                      <div className="text-lg font-bold text-foreground">{dimensions[key]}m</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calculated surfaces */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className={cn("text-[10px] font-bold text-muted-foreground uppercase mb-1", isRTL && "font-cairo")}>
                  {isRTL ? 'سطح الأرض' : 'Surface sol'}
                </p>
                <p className="text-xl font-bold text-primary">{surfaceSol} m²</p>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <p className={cn("text-[10px] font-bold text-muted-foreground uppercase mb-1", isRTL && "font-cairo")}>
                  {isRTL ? 'سطح الحيطان' : 'Surface murs'}
                </p>
                <p className="text-xl font-bold text-primary">{surfaceMurs} m²</p>
              </div>
            </div>

            {/* Suggested works */}
            <div className="space-y-1.5">
              <h4 className={cn("text-xs font-bold text-muted-foreground", isRTL && "font-cairo")}>
                {isRTL ? '💡 أعمال مقترحة:' : '💡 Travaux suggérés :'}
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {suggestedWorks.map((w, i) => (
                  <div key={i} className="flex items-center justify-between px-2.5 py-2 bg-muted rounded-lg border border-border">
                    <span className={cn("text-[11px] font-medium text-foreground", isRTL && "font-cairo")}>{w.label}</span>
                    <span className="text-[10px] font-bold text-primary">{w.surface}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { resetState(); }}
                className="flex-1 py-3 rounded-xl border border-border text-foreground font-medium text-sm flex items-center justify-center gap-1.5 hover:bg-muted transition-colors"
              >
                <RefreshCw size={16} />
                {isRTL ? 'إعادة' : 'Refaire'}
              </button>
              <button
                onClick={handleSendToDevis}
                className="flex-[2] py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
              >
                <Send size={16} />
                {isRTL ? '📋 أرسل للديفي الذكي' : '📋 Envoyer au Devis'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RoomScannerModal;
