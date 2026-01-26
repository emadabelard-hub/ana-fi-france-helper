import { useState } from 'react';
import { Mic, Camera, Send, FileText, Scale, ListChecks, Copy, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const AssistantPage = () => {
  const { t, isRTL } = useLanguage();
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const handleAnalyze = () => {
    // Placeholder - will trigger payment flow and AI processing
    if (userInput.trim()) {
      setHasResult(true);
    }
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    // Voice recording logic will be implemented
  };

  const handleDocumentUpload = () => {
    // Document upload logic will be implemented
  };

  const handleCopy = () => {
    // Copy to clipboard logic
  };

  const handleDownloadPDF = () => {
    // PDF download logic will be implemented
  };

  return (
    <div className="py-6 space-y-6">
      {/* Title */}
      <section className={cn("text-center space-y-2", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {t('assistant.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('assistant.subtitle')}
        </p>
      </section>

      {/* Input Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Text Input */}
          <Textarea
            placeholder={t('assistant.textPlaceholder')}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className={cn(
              "min-h-[120px] resize-none",
              isRTL && "text-right font-cairo"
            )}
          />

          {/* Action Buttons */}
          <div className={cn(
            "flex items-center gap-3",
            isRTL && "flex-row-reverse"
          )}>
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="sm"
              onClick={handleVoiceRecord}
              className="gap-2"
            >
              <Mic className={cn("h-4 w-4", isRecording && "animate-pulse")} />
              <span className={isRTL ? "font-cairo" : ""}>
                {t('assistant.recordVoice')}
              </span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleDocumentUpload}
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              <span className={isRTL ? "font-cairo" : ""}>
                {t('assistant.uploadDocument')}
              </span>
            </Button>
          </div>

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!userInput.trim()}
            className={cn(
              "w-full gap-2 h-12 text-base",
              isRTL && "font-cairo"
            )}
          >
            <Send className="h-5 w-5" />
            {t('assistant.analyze')}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {hasResult && (
        <Card>
          <CardContent className="p-4">
            <Tabs defaultValue="letter" className="w-full">
              <TabsList className={cn(
                "grid w-full grid-cols-3 mb-4",
                isRTL && "flex-row-reverse"
              )}>
                <TabsTrigger value="letter" className="gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  <span className={isRTL ? "font-cairo" : ""}>
                    {isRTL ? 'الرسالة' : 'Lettre'}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="legal" className="gap-1 text-xs">
                  <Scale className="h-3 w-3" />
                  <span className={isRTL ? "font-cairo" : ""}>
                    {isRTL ? 'قانوني' : 'Juridique'}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="action" className="gap-1 text-xs">
                  <ListChecks className="h-3 w-3" />
                  <span className={isRTL ? "font-cairo" : ""}>
                    {isRTL ? 'الخطة' : 'Actions'}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="letter" className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 min-h-[200px]">
                  <p className="text-sm text-muted-foreground text-center">
                    {/* Placeholder - French letter will appear here */}
                    [La lettre officielle sera générée ici]
                  </p>
                </div>
                <div className={cn(
                  "flex gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                    <Copy className="h-4 w-4" />
                    {t('assistant.copy')}
                  </Button>
                  <Button size="sm" onClick={handleDownloadPDF} className="gap-2">
                    <Download className="h-4 w-4" />
                    {t('assistant.download')}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="legal">
                <div className="bg-muted/50 rounded-xl p-4 min-h-[200px]">
                  <p className="text-sm text-muted-foreground text-center">
                    {/* Placeholder - Legal note will appear here */}
                    [La note juridique sera générée ici]
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="action">
                <div className={cn(
                  "bg-muted/50 rounded-xl p-4 min-h-[200px]",
                  "text-right font-cairo"
                )}>
                  <p className="text-sm text-muted-foreground text-center">
                    {/* Placeholder - Arabic action plan will appear here */}
                    [خطة العمل ستظهر هنا]
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AssistantPage;
