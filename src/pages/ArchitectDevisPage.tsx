import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Upload, X, FileText, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const MAX_FILES = 10;
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'jpg', 'jpeg', 'png'];

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 Ko';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`.replace('.0', '');
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`.replace(/\.00$/, '');
};

const isAcceptedFile = (file: File): boolean => {
  if (ACCEPTED_MIMES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_EXTENSIONS.includes(ext);
};

const ArchitectDevisPage = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [receivedCount, setReceivedCount] = useState<number | null>(null);
  const [receivedBytes, setReceivedBytes] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExtract = useCallback(async () => {
    if (files.length === 0) return;
    setIsSending(true);
    setErrorMessage(null);
    setReceivedCount(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Session expirée');

      const formData = new FormData();
      files.forEach((f, i) => formData.append(`file_${i}`, f, f.name));

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/btp-quote-from-documents`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);

      setReceivedCount(Number(data.fileCount) || 0);
      setReceivedBytes(Number(data.totalBytes) || 0);
    } catch (e) {
      console.error('btp-quote-from-documents error:', e);
      setErrorMessage(
        isRTL
          ? 'حصل خطأ أثناء إرسال المستندات. حاول تاني.'
          : "Une erreur est survenue lors de l’envoi des documents. Veuillez réessayer."
      );
    } finally {
      setIsSending(false);
    }
  }, [files, isRTL]);


  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const newFiles: File[] = [];
    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      if (!isAcceptedFile(file)) continue;
      if (file.size > MAX_SIZE) continue;
      newFiles.push(file);
    }
    setFiles((prev) => {
      const merged = [...prev, ...newFiles];
      return merged.slice(0, MAX_FILES);
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/anafy-translate')}
          className={cn(
            'mb-4 gap-1 font-medium',
            isRTL && 'flex-row-reverse font-cairo'
          )}
        >
          <Arrow className="h-4 w-4" />
          {isRTL ? 'رجوع' : 'Retour'}
        </Button>

        <h1 className={cn(
          'text-2xl font-bold text-foreground mb-4',
          isRTL && 'text-right font-cairo'
        )}>
          {isRTL
            ? 'اعمل الدوفي من مستندات الأرشيتكت'
            : 'Créer un devis depuis les documents de l’architecte'}
        </h1>

        <p className={cn(
          'text-sm text-muted-foreground leading-relaxed mb-6',
          isRTL && 'text-right font-cairo'
        )}>
          {isRTL
            ? 'أضف مستندات الأرشيتكت (PDF أو DOCX أو صور) عشان نجهز لك التحليل في الخطوة الجاية.'
            : 'Ajoutez les documents de l’architecte (PDF, DOCX ou images) pour préparer l’analyse à l’étape suivante.'}
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors',
            'flex flex-col items-center justify-center gap-3 text-center',
            isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50',
            isRTL && 'font-cairo'
          )}
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isRTL ? 'اسحب الملفات هنا أو اضغط لاختيارها' : 'Glissez-déposez vos fichiers ou cliquez pour les choisir'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL
                ? 'PDF · DOCX · JPG · JPEG · PNG — 10 ملفات كحد أقصى — 20 ميجا للملف الواحد'
                : 'PDF · DOCX · JPG · JPEG · PNG — 10 fichiers max — 20 Mo par fichier'}
            </p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className={cn(
              'flex items-center justify-between text-sm',
              isRTL && 'flex-row-reverse font-cairo'
            )}>
              <span className="font-medium text-foreground">
                {isRTL ? `الملفات المرفقة (${files.length}/${MAX_FILES})` : `Fichiers attachés (${files.length}/${MAX_FILES})`}
              </span>
              <span className="text-xs text-muted-foreground">
                {isRTL ? `${MAX_FILES} ملفات كحد أقصى` : `${MAX_FILES} fichiers maximum`}
              </span>
            </div>

            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border bg-background',
                    isRTL && 'flex-row-reverse font-cairo'
                  )}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={isRTL ? 'حذف الملف' : 'Supprimer le fichier'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={cn('mt-6 space-y-3', isRTL && 'font-cairo')}>
          <Button
            disabled={files.length === 0 || isSending}
            className="w-full"
            onClick={handleExtract}
          >
            {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSending
              ? isRTL ? 'جاري الإرسال…' : 'Envoi en cours…'
              : isRTL ? 'استخرج البنود' : 'Extraire les prestations'}
          </Button>

          {receivedCount !== null && (
            <div className={cn('space-y-1', isRTL && 'text-right')}>
              <p className="text-sm font-medium text-foreground">
                {isRTL
                  ? `المحتوى المستلم: ${receivedCount} مستند`
                  : `Contenu reçu : ${receivedCount} document(s)`}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? `الحجم الإجمالي: ${formatSize(receivedBytes)}`
                  : `Taille totale reçue : ${formatSize(receivedBytes)}`}
              </p>
            </div>
          )}


          {errorMessage && (
            <p className={cn('text-sm text-destructive', isRTL && 'text-right')}>{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchitectDevisPage;
