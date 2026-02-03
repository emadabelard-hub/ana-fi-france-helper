import React, { useRef, useState } from 'react';
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

interface ChatInputProps {
  onSend: (message: string, image?: string) => void;
  isLoading: boolean;
  isRTL: boolean;
  t: (key: string) => string;
}

const ChatInput = ({ onSend, isLoading, isRTL, t }: ChatInputProps) => {
  const { toast } = useToast();
  const [userInput, setUserInput] = useState('');
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

  // Enter key now creates new lines - send only via button

  const handleDocumentUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file using our security validation
      const validation = validateFileUpload(file, ALLOWED_DOCUMENT_TYPES);
      
      if (!validation.valid) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: isRTL 
            ? "يرجى رفع صورة (JPG/PNG) أو ملف PDF فقط"
            : "Veuillez télécharger une image (JPG/PNG) ou un fichier PDF uniquement.",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      const isImage = file.type.startsWith('image/');
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedFile({
          data: event.target?.result as string,
          type: isImage ? 'image' : 'pdf',
          name: file.name
        });
        toast({
          title: isRTL ? "تم رفع الملف" : "Fichier téléchargé",
          description: isRTL ? `تم رفع ${file.name} بنجاح` : `${file.name} a été téléchargé avec succès.`,
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Only allow images from camera
      if (!file.type.startsWith('image/')) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: isRTL ? "يرجى التقاط صورة فقط" : "Veuillez capturer une image uniquement.",
        });
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedFile({
          data: event.target?.result as string,
          type: 'image',
          name: `camera_${Date.now()}.jpg`
        });
        toast({
          title: isRTL ? "📷 تم التصوير!" : "📷 Photo capturée!",
          description: isRTL ? "الصورة جاهزة للتحليل" : "L'image est prête à être analysée.",
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".jpg,.jpeg,.png,.pdf"
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

      {/* Uploaded File Preview */}
      {uploadedFile && (
        <div className="relative inline-block">
          {uploadedFile.type === 'image' ? (
            <img
              src={uploadedFile.data}
              alt="Uploaded document"
              className="h-20 object-contain rounded-lg border"
            />
          ) : (
            <div className="h-20 px-4 flex flex-col items-center justify-center rounded-lg border bg-muted/50 gap-1">
              <FileText className="h-8 w-8 text-destructive" />
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {uploadedFile.name}
              </span>
            </div>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={() => setUploadedFile(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input Row */}
      <div className={cn(
        "flex items-end gap-2",
        isRTL && "flex-row-reverse"
      )}>
        {/* Text Input - Disabled while loading */}
        <Textarea
          placeholder={t('assistant.textPlaceholder')}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          className={cn(
            "min-h-[60px] max-h-[150px] resize-none flex-1 transition-opacity",
            isRTL && "text-right font-cairo",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
          disabled={isLoading}
        />

        {/* Action Buttons */}
        <div className="flex flex-col gap-1">
          {/* Camera Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCameraCapture}
            disabled={isLoading}
            className="h-8 w-8"
            title={isRTL ? "صور مستند" : "Photographier"}
          >
            <Camera className="h-4 w-4" />
          </Button>

          {/* Attach File Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDocumentUpload}
            disabled={isLoading}
            className="h-8 w-8"
            title={isRTL ? "رفع ملف" : "Joindre un fichier"}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {/* Send Button */}
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={(!userInput.trim() && !uploadedFile) || isLoading}
            className="h-8 w-8"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
