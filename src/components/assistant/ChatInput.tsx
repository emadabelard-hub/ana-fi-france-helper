import React, { useRef, useState } from 'react';
import { Mic, Camera, Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (message: string, image?: string) => void;
  isLoading: boolean;
  isRTL: boolean;
  t: (key: string) => string;
}

const ChatInput = ({ onSend, isLoading, isRTL, t }: ChatInputProps) => {
  const { toast } = useToast();
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!userInput.trim() && !uploadedImage) return;
    onSend(userInput.trim(), uploadedImage || undefined);
    setUserInput('');
    setUploadedImage(null);
  };

  // Enter key now creates new lines - send only via button

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    toast({
      title: isRTL ? "قريباً" : "Bientôt disponible",
      description: isRTL ? "تسجيل الصوت قيد التطوير" : "L'enregistrement vocal sera bientôt disponible.",
    });
  };

  const handleDocumentUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedImage(event.target?.result as string);
          toast({
            title: isRTL ? "تم رفع الصورة" : "Image téléchargée",
            description: isRTL ? "تم رفع المستند بنجاح" : "Le document a été téléchargé avec succès.",
          });
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: isRTL ? "يرجى رفع صورة" : "Veuillez télécharger une image.",
        });
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Uploaded Image Preview */}
      {uploadedImage && (
        <div className="relative inline-block">
          <img
            src={uploadedImage}
            alt="Uploaded document"
            className="h-20 object-contain rounded-lg border"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={() => setUploadedImage(null)}
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
        {/* Text Input */}
        <Textarea
          placeholder={t('assistant.textPlaceholder')}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          className={cn(
            "min-h-[60px] max-h-[150px] resize-none flex-1",
            isRTL && "text-right font-cairo"
          )}
          disabled={isLoading}
        />

        {/* Action Buttons */}
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleVoiceRecord}
            disabled={isLoading}
            className={cn("h-8 w-8", isRecording && "text-destructive")}
          >
            <Mic className={cn("h-4 w-4", isRecording && "animate-pulse")} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDocumentUpload}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <Camera className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={(!userInput.trim() && !uploadedImage) || isLoading}
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
