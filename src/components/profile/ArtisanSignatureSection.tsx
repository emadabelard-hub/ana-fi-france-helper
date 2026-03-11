import { useState, useRef, useEffect } from 'react';
import { PenLine, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import SignaturePad from 'signature_pad';
import { getSignedAssetUrl } from '@/lib/storageUtils';

const ArtisanSignatureSection = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  // Get current signature from profile
  const currentSignatureUrl = profile?.artisan_signature_url || null;

  // Resolve signed URL for display
  useEffect(() => {
    if (currentSignatureUrl) {
      getSignedAssetUrl(currentSignatureUrl).then(url => setDisplayUrl(url));
    } else {
      setDisplayUrl(null);
    }
  }, [currentSignatureUrl]);

  // Initialize signature pad
  useEffect(() => {
    if (!canvasRef.current || currentSignatureUrl) return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    signaturePadRef.current = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 3,
    });

    signaturePadRef.current.addEventListener('endStroke', () => {
      setHasSignature(!signaturePadRef.current?.isEmpty());
    });

    return () => {
      signaturePadRef.current?.off();
    };
  }, [currentSignatureUrl]);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setHasSignature(false);
  };

  const handleSave = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty() || !user) return;

    setIsSaving(true);
    try {
      // Get signature as data URL
      const dataUrl = signaturePadRef.current.toDataURL('image/png');
      
      // Convert to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Upload to storage
      const fileName = `${user.id}/artisan-signature-${Date.now()}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);

      // Update profile with signature URL
      await updateProfile({ artisan_signature_url: publicUrl } as any);

    } catch (error) {
      console.error('Error saving signature:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !currentSignatureUrl) return;

    setIsDeleting(true);
    try {
      // Extract file path from URL
      const urlParts = currentSignatureUrl.split('/');
      const filePath = urlParts.slice(-2).join('/');

      // Delete from storage
      await supabase.storage
        .from('company-assets')
        .remove([filePath]);

      // Clear from profile
      await updateProfile({ artisan_signature_url: null } as any);
    } catch (error) {
      console.error('Error deleting signature:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
          <PenLine className="h-5 w-5 text-primary" />
          {isRTL ? 'توقيعي الدائم' : 'Ma signature permanente'}
        </CardTitle>
        <CardDescription className={cn(isRTL && "text-right font-cairo")}>
          {isRTL 
            ? 'التوقيع ده هيظهر تلقائياً على كل الفواتير والدوفيهات بتاعتك'
            : 'Cette signature apparaîtra automatiquement sur tous vos devis et factures'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentSignatureUrl && displayUrl ? (
          // Display saved signature
          <div className="space-y-4">
            <div className="bg-white border rounded-lg p-4">
              <img 
                src={displayUrl} 
                alt={isRTL ? 'توقيعي' : 'Ma signature'} 
                className="max-h-24 mx-auto"
              />
            </div>
            
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" />
                {isRTL ? 'التوقيع محفوظ' : 'Signature enregistrée'}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                "w-full text-destructive hover:text-destructive",
                isRTL && "font-cairo"
              )}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {isRTL ? 'حذف وإنشاء توقيع جديد' : 'Supprimer et créer une nouvelle signature'}
            </Button>
          </div>
        ) : (
          // Signature drawing area
          <div className="space-y-4">
            <div className={cn(
              "text-sm text-muted-foreground bg-accent/50 p-3 rounded-md",
              isRTL && "text-right font-cairo"
            )}>
              <AlertCircle className="inline h-4 w-4 mr-1" />
              {isRTL 
                ? 'وقّع هنا بإصبعك أو بالماوس. التوقيع ده هو توقيعك المهني الرسمي.'
                : 'Signez ici avec votre doigt ou votre souris. Cette signature est votre signature professionnelle officielle.'
              }
            </div>

            <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-40 touch-none"
                style={{ touchAction: 'none' }}
              />
            </div>

            <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
              <Button
                variant="outline"
                onClick={handleClear}
                disabled={!hasSignature}
                className={cn("flex-1", isRTL && "font-cairo")}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isRTL ? 'امسح' : 'Effacer'}
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={!hasSignature || isSaving}
                className={cn("flex-1", isRTL && "font-cairo")}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {isRTL ? 'احفظ التوقيع' : 'Enregistrer la signature'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ArtisanSignatureSection;
