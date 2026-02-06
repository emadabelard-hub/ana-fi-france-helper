import { useRef, useEffect, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { RotateCcw, Check } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (signatureDataUrl: string | null) => void;
  signatureDataUrl?: string | null;
}

const SignaturePad = ({ onSignatureChange, signatureDataUrl }: SignaturePadProps) => {
  const { isRTL } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size for retina displays
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    // Initialize signature pad
    const signaturePad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 0.5,
      maxWidth: 2.5,
    });

    signaturePadRef.current = signaturePad;

    // Listen for signature changes
    signaturePad.addEventListener('endStroke', () => {
      setIsEmpty(signaturePad.isEmpty());
      if (!signaturePad.isEmpty()) {
        onSignatureChange(signaturePad.toDataURL('image/png'));
      }
    });

    // Load existing signature if provided
    if (signatureDataUrl) {
      signaturePad.fromDataURL(signatureDataUrl);
      setIsEmpty(false);
    }

    // Handle resize
    const resizeCanvas = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = signaturePad.toData();
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      signaturePad.clear();
      signaturePad.fromData(data);
    };

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      signaturePad.off();
    };
  }, []);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setIsEmpty(true);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-3">
      {/* Legal text above signature */}
      <div className="text-center space-y-1 p-3 bg-muted/50 rounded-lg border">
        <p className="text-sm font-medium text-foreground">
          Bon pour accord
        </p>
        <p className="text-xs text-muted-foreground">
          Date: {new Date().toLocaleDateString('fr-FR')}
        </p>
      </div>

      {/* Signature canvas */}
      <div className="relative border-2 border-dashed border-primary/30 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{ height: '180px' }}
        />
        
        {/* Placeholder text when empty */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className={cn(
              "text-muted-foreground/50 text-sm",
              isRTL && "font-cairo"
            )}>
              {isRTL ? '✍️ وقّع هنا بصباعك' : '✍️ Signez ici avec votre doigt'}
            </p>
          </div>
        )}
        
        {/* Signature line */}
        <div className="absolute bottom-8 left-8 right-8 border-b border-gray-300" />
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
          Signature du client
        </p>
      </div>

      {/* Actions */}
      <div className={cn(
        "flex gap-2",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty}
          className="flex-1"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          {isRTL ? 'امسح' : 'Effacer'}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={isEmpty}
          className={cn("flex-1", isEmpty && "opacity-50")}
        >
          <Check className="h-4 w-4 mr-1" />
          {isRTL ? 'تم التوقيع ✅' : 'Signé ✅'}
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
