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
    <div className="space-y-2">
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
        {/* Attachment Buttons - Left side */}
        <div className={cn(
          "flex gap-1",
          isRTL && "flex-row-reverse"
        )}>
          {/* Camera Button - Big & Visible */}
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
            title={isRTL ? "📎 رفع ملف" : "📎 Fichier"}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>

        {/* Text Input - Expands to fill space */}
        <Textarea
          placeholder={isRTL ? 'اكتب سؤالك أو صور المستند...' : 'Écrivez ou joignez un document...'}
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

        {/* Send Button - Prominent */}
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={(!userInput.trim() && !uploadedFile) || isLoading}
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
