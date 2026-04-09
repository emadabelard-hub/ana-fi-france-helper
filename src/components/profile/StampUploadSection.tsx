import { useState, useEffect } from 'react';
import { Stamp, Trash2, Loader2, Check, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { compressImageFile } from '@/lib/imageCompression';
import { extractCompanyAssetPath, getSignedAssetUrl } from '@/lib/storageUtils';

const StampUploadSection = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();

  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  const currentStampUrl = profile?.stamp_url || null;

  // Resolve signed URL for display
  useEffect(() => {
    if (currentStampUrl) {
      getSignedAssetUrl(currentStampUrl).then(url => setDisplayUrl(url));
    } else {
      setDisplayUrl(null);
    }
  }, [currentStampUrl]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Ensure valid authenticated session
      const { data: { session } } = await supabase.auth.getSession();
      let activeUser = session?.user;
      if (!activeUser || activeUser.is_anonymous) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        activeUser = refreshed.session?.user ?? null;
      }
      if (!activeUser || activeUser.is_anonymous) {
        console.error('Stamp upload failed: no active authenticated session');
        return;
      }

      const compressed = await compressImageFile(file, {
        maxWidth: 500,
        maxHeight: 500,
        quality: 0.85,
      });

      const fileName = `${activeUser.id}/stamp-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, compressed, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      await updateProfile({ stamp_url: fileName });
    } catch (error) {
      console.error('Error uploading stamp:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !currentStampUrl) return;
    setIsDeleting(true);
    try {
      const filePath = extractCompanyAssetPath(currentStampUrl);
      if (!filePath) throw new Error('Stamp path not found');
      await supabase.storage.from('company-assets').remove([filePath]);
      await updateProfile({ stamp_url: null });
    } catch (error) {
      console.error('Error deleting stamp:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
          <Stamp className="h-5 w-5 text-primary" />
          {isRTL ? 'الطابع (الكاشي)' : 'Mon Tampon (Cachet)'}
        </CardTitle>
        <CardDescription className={cn(isRTL && "text-right font-cairo")}>
          {isRTL
            ? 'الطابع ده هيظهر تلقائياً تحت التوقيع على كل الفواتير والدوفيهات'
            : 'Ce tampon apparaîtra automatiquement sous votre signature sur tous vos documents'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentStampUrl && displayUrl ? (
          <div className="space-y-4">
            <div className="bg-white border rounded-lg p-4">
              <img src={displayUrl} alt={isRTL ? 'الطابع' : 'Mon tampon'} className="max-h-24 mx-auto" />
            </div>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" />
                {isRTL ? 'الطابع محفوظ' : 'Tampon enregistré'}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn("w-full text-destructive hover:text-destructive", isRTL && "font-cairo")}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {isRTL ? 'حذف وتحميل طابع جديد' : 'Supprimer et importer un nouveau tampon'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'حمّل صورة الطابع (PNG أو JPG)' : 'Importez une image de votre tampon (PNG ou JPG)'}
              </p>
            </div>
            <Input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={isUploading}
              className="cursor-pointer"
            />
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isRTL ? 'جاري التحميل...' : 'Téléchargement...'}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StampUploadSection;
