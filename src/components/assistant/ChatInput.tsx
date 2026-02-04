import React, { useRef, useState, useEffect } from 'react';
import { Paperclip, Send, Loader2, X, FileText, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { 
  validateFileUpload, 
  ALLOWED_DOCUMENT_TYPES, 
  MAX_MESSAGE_LENGTH,
  sanitizeString 
} from '@/lib/validation';
import type { AttachedDocument } from './AttachedDocuments';

interface ChatInputProps {
  onSend: (message: string, image?: string) => void;
  onDocumentAdd?: (doc: AttachedDocument) => void;
  isLoading: boolean;
  isRTL: boolean;
  t: (key: string) => string;
  /** If provided, ChatInput won't manage its own file state - parent handles it */
  externalDocumentsMode?: boolean;
}

const ChatInput = ({ onSend, onDocumentAdd, isLoading, isRTL, t, externalDocumentsMode = false }: ChatInputProps) => {
  const { toast } = useToast();
  const [userInput, setUserInput] = useState('');
  // Only used when NOT in external documents mode
  const [uploadedFile, setUploadedFile] = useState<{ data: string; type: 'image' | 'pdf'; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!userInput.trim() && !uploadedFile) return;
    
    // Sanitize and validate message
    const sanitizedMessage = sanitizeString(userInput.trim());
    if (sanitizedMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL 
          ? `الرسالة طويلة جداً (الحد الأقصى ${MAX_MESSAGE_LENGTH} حرف)`
          : `Message trop long (maximum ${MAX_MESSAGE_LENGTH} caractères)`,
      });
      return;
    }
    
    onSend(sanitizedMessage, uploadedFile?.data || undefined);
    setUserInput('');
    setUploadedFile(null);
  };

  const handleDocumentUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const processFile = async (file: File, fromCamera: boolean = false) => {
    try {
      // Validate file using our security validation
      if (!fromCamera) {
        const validation = validateFileUpload(file, ALLOWED_DOCUMENT_TYPES);
        
        if (!validation.valid) {
          toast({
            variant: "destructive",
            title: isRTL ? "خطأ" : "Erreur",
            description: isRTL 
              ? "يرجى رفع صورة (JPG/PNG) أو ملف PDF فقط"
              : "Veuillez télécharger une image (JPG/PNG) ou un fichier PDF uniquement.",
          });
          return;
        }
      } else {
        // Only allow images from camera
        if (!file.type.startsWith('image/')) {
          toast({
            variant: "destructive",
            title: isRTL ? "خطأ" : "Erreur",
            description: isRTL ? "يرجى التقاط صورة فقط" : "Veuillez capturer une image uniquement.",
          });
          return;
        }
      }

      // Check file size (max 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: isRTL 
            ? "الملف كبير جداً (الحد الأقصى 10 ميجا)"
            : "Fichier trop volumineux (max 10 Mo).",
        });
        return;
      }
      
      const isImage = file.type.startsWith('image/');
      
      // Read file as data URL
      const readFileAsDataURL = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(event.target.result as string);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = () => reject(new Error('File read error'));
          reader.readAsDataURL(f);
        });
      };

      const fileData = await readFileAsDataURL(file);
      
      const docData = {
        data: fileData,
        type: isImage ? 'image' as const : 'pdf' as const,
        name: fromCamera ? `camera_${Date.now()}.jpg` : file.name
      };
      
      if (externalDocumentsMode && onDocumentAdd) {
        // In external mode, emit to parent
        const doc: AttachedDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...docData,
          timestamp: Date.now()
        };
        onDocumentAdd(doc);
        toast({
          title: isRTL ? "📎 تم إضافة الملف للدوسيه" : "📎 Fichier ajouté au dossier",
          description: isRTL 
            ? `${docData.name} - يمكنك إضافة المزيد` 
            : `${docData.name} - Vous pouvez en ajouter d'autres`,
        });
      } else {
        // Original behavior - single file
        setUploadedFile(docData);
        toast({
          title: isRTL ? "تم رفع الملف" : "Fichier téléchargé",
          description: isRTL ? `تم رفع ${docData.name} بنجاح` : `${docData.name} a été téléchargé avec succès.`,
        });
      }
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL 
          ? "حدث خطأ أثناء معالجة الملف. حاول مرة تانية."
          : "Erreur lors du traitement du fichier. Réessayez.",
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Limit to max 5 files at once
    const MAX_FILES = 5;
    if (files.length > MAX_FILES) {
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL 
          ? `الحد الأقصى ${MAX_FILES} ملفات في المرة الواحدة`
          : `Maximum ${MAX_FILES} fichiers à la fois`,
      });
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Process files sequentially to avoid memory issues
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await processFile(file, false);
      } catch (error) {
        console.error(`Error processing file ${i + 1}:`, error);
        // Continue with other files even if one fails
      }
    }

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await processFile(file, true);
      } catch (error) {
        console.error('Camera capture error:', error);
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: isRTL 
            ? "حدث خطأ أثناء التقاط الصورة"
            : "Erreur lors de la capture",
        });
      }
    }
    // Reset input
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Determine if we can send (in external mode, always allow if there's text)
  const canSend = externalDocumentsMode 
    ? userInput.trim().length > 0
    : (userInput.trim().length > 0 || !!uploadedFile);

  return (
    <div className="space-y-2">
      {/* Hidden File Input - Multiple files supported */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        className="hidden"
      />
      
      {/* Hidden Camera Input */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleCameraChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Uploaded File Preview - Only in non-external mode */}
      {!externalDocumentsMode && uploadedFile && (
        <div className={cn(
          "flex items-center gap-2 p-2 bg-muted/50 rounded-lg",
          isRTL && "flex-row-reverse"
        )}>
          {uploadedFile.type === 'image' ? (
            <img
              src={uploadedFile.data}
              alt="Uploaded document"
              className="h-12 w-12 object-cover rounded border"
            />
          ) : (
            <div className="h-12 w-12 flex items-center justify-center rounded border bg-background">
              <FileText className="h-6 w-6 text-destructive" />
            </div>
          )}
          <span className={cn(
            "flex-1 text-sm truncate",
            isRTL && "text-right font-cairo"
          )}>
            {uploadedFile.type === 'image' 
              ? (isRTL ? '📷 صورة جاهزة' : '📷 Image prête')
              : uploadedFile.name}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setUploadedFile(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input Row - Horizontal layout with prominent buttons */}
      <div className={cn(
        "flex items-end gap-2",
        isRTL && "flex-row-reverse"
      )}>
        {/* Attachment Buttons - Always visible */}
        <div className={cn(
          "flex gap-1",
          isRTL && "flex-row-reverse"
        )}>
          {/* Camera Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleCameraCapture}
            disabled={isLoading}
            className="h-10 w-10"
            title={isRTL ? "📷 صور مستند" : "📷 Photo"}
          >
            <Camera className="h-5 w-5" />
          </Button>

          {/* Attach File Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleDocumentUpload}
            disabled={isLoading}
            className="h-10 w-10"
            title={isRTL ? "📎 أضف ملف للدوسيه" : "📎 Ajouter au dossier"}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>

        {/* Text Input */}
        <Textarea
          placeholder={isRTL ? 'اكتب سؤالك أو أضف مستند...' : 'Écrivez ou ajoutez un document...'}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          className={cn(
            "min-h-[44px] max-h-[120px] resize-none flex-1 text-base py-2",
            isRTL && "text-right font-cairo",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
          disabled={isLoading}
          rows={1}
        />

        {/* Send Button */}
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!canSend || isLoading}
          className="h-10 w-10"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;
