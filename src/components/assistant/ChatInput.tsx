import React, { useRef, useState } from 'react';
import { Mic, Paperclip, Send, Loader2, X, FileText } from 'lucide-react';
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
  const [uploadedFile, setUploadedFile] = useState<{ data: string; type: 'image' | 'pdf'; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!userInput.trim() && !uploadedFile) return;
    onSend(userInput.trim(), uploadedFile?.data || undefined);
    setUserInput('');
    setUploadedFile(null);
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
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      
      if (isImage || isPDF) {
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
      } else {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: isRTL ? "يرجى رفع صورة أو ملف PDF" : "Veuillez télécharger une image ou un fichier PDF.",
        });
      }
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,application/pdf"
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
            <Paperclip className="h-4 w-4" />
          </Button>

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
