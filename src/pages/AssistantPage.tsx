import { useState } from 'react';
import { Mic, Camera, Send, FileText, Scale, ListChecks, Copy, Download, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import AuthModal from '@/components/auth/AuthModal';

interface AIResult {
  formalLetter: string;
  legalNote: string;
  actionPlan: string;
}

const AssistantPage = () => {
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleAnalyze = async () => {
    if (!userInput.trim()) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-request', {
        body: { 
          userMessage: userInput,
          profile: profile ? {
            full_name: profile.full_name,
            address: profile.address,
            phone: profile.phone,
            caf_number: profile.caf_number,
            foreigner_number: profile.foreigner_number,
            social_security: profile.social_security,
          } : null
        }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: data.error,
        });
        return;
      }

      setResult(data);
      toast({
        title: isRTL ? "تم التحليل" : "Analyse terminée",
        description: isRTL ? "تم إنشاء الرسالة بنجاح" : "Votre lettre a été générée avec succès.",
      });
    } catch (error) {
      console.error('Error analyzing:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "حدث خطأ أثناء التحليل" : "Une erreur est survenue lors de l'analyse.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    toast({
      title: isRTL ? "قريباً" : "Bientôt disponible",
      description: isRTL ? "تسجيل الصوت قيد التطوير" : "L'enregistrement vocal sera bientôt disponible.",
    });
  };

  const handleDocumentUpload = () => {
    toast({
      title: isRTL ? "قريباً" : "Bientôt disponible",
      description: isRTL ? "رفع المستندات قيد التطوير" : "Le téléchargement de documents sera bientôt disponible.",
    });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: isRTL ? "تم النسخ" : "Copié",
        description: isRTL ? "تم نسخ النص" : "Le texte a été copié dans le presse-papier.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل النسخ" : "Impossible de copier le texte.",
      });
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    
    // Create a simple text file for now
    const blob = new Blob([result.formalLetter], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lettre-administrative.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: isRTL ? "تم التحميل" : "Téléchargé",
      description: isRTL ? "تم تحميل الرسالة" : "La lettre a été téléchargée.",
    });
  };

  return (
    <div className="py-6 pb-28 space-y-6">
      {/* Title */}
      <section className={cn("text-center space-y-2", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {isRTL ? 'أريد حلاً' : 'Je veux une solution'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'تحليل الأوراق وكتابة الخطابات' : 'Analyse de documents et rédaction de courriers'}
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
            disabled={!userInput.trim() || isAnalyzing}
            className={cn(
              "w-full gap-2 h-12 text-base",
              isRTL && "font-cairo"
            )}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {isRTL ? "جار التحليل..." : "Analyse en cours..."}
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                {t('assistant.analyze')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
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
                    {t('assistant.formalLetter')}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="legal" className="gap-1 text-xs">
                  <Scale className="h-3 w-3" />
                  <span className={isRTL ? "font-cairo" : ""}>
                    {t('assistant.legalNote')}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="action" className="gap-1 text-xs">
                  <ListChecks className="h-3 w-3" />
                  <span className={isRTL ? "font-cairo" : ""}>
                    {t('assistant.actionPlan')}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="letter" className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-4 min-h-[200px] whitespace-pre-wrap text-sm">
                  {result.formalLetter}
                </div>
                <div className={cn(
                  "flex gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <Button variant="outline" size="sm" onClick={() => handleCopy(result.formalLetter)} className="gap-2">
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
                <div className="bg-muted/50 rounded-xl p-4 min-h-[200px] whitespace-pre-wrap text-sm">
                  {result.legalNote}
                </div>
              </TabsContent>

              <TabsContent value="action">
                <div className={cn(
                  "bg-muted/50 rounded-xl p-4 min-h-[200px] whitespace-pre-wrap text-sm",
                  "text-right font-cairo"
                )} dir="rtl">
                  {result.actionPlan}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
};

export default AssistantPage;
