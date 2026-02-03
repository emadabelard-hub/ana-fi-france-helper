import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  Mail, 
  MapPin, 
  Printer, 
  X, 
  Copy, 
  Check,
  FileText,
  Send,
  Maximize2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DispatchInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subjectLine?: string;
}

interface DispatchGuideProps {
  dispatchInfo: DispatchInfo;
  letterContent: string;
  isRTL?: boolean;
  onClose: () => void;
}

const DispatchGuide = ({ 
  dispatchInfo, 
  letterContent, 
  isRTL = true,
  onClose 
}: DispatchGuideProps) => {
  const [selectedMode, setSelectedMode] = useState<'mail' | 'email' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEmailGuideOpen, setIsEmailGuideOpen] = useState(true);
  const [customAddress, setCustomAddress] = useState(dispatchInfo.recipientAddress || '');

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract email subject from reference number or recipient
  const emailSubject = dispatchInfo.referenceNumber 
    ? `Objet: ${dispatchInfo.subjectLine || 'Réclamation'} - Dossier N°${dispatchInfo.referenceNumber}`
    : `Objet: ${dispatchInfo.subjectLine || 'Demande officielle'} - ${dispatchInfo.recipientName || '[Destinataire]'}`;

  // French formal email body - properly formatted
  const emailBody = `Madame, Monsieur,

Veuillez trouver ci-joint ma lettre officielle concernant ma demande.

Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.`;

  // Fullscreen overlay for La Poste
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4"
        >
          <X className="h-6 w-6" />
        </Button>
        
        <div className="text-center space-y-6">
          <div className="text-6xl">📮</div>
          <p className={cn(
            "text-xl text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'وريهم ده:' : 'Montrez ceci:'}
          </p>
          <div className="bg-primary text-primary-foreground p-8 rounded-xl shadow-lg">
            <p className="text-3xl md:text-4xl font-bold leading-tight">
              Lettre Recommandée<br />
              avec<br />
              Accusé de Réception
            </p>
          </div>
          <p className={cn(
            "text-lg text-muted-foreground max-w-md",
            isRTL && "font-cairo"
          )}>
            {isRTL 
              ? 'موظف البوسطة هيفهم ان انت عايز خطاب مسجل بعلم الوصول' 
              : 'L\'agent postal comprendra que vous voulez un recommandé AR'}
          </p>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsFullscreen(false)}
            className="mt-4"
          >
            <X className="h-4 w-4 mr-2" />
            {isRTL ? 'رجوع' : 'Retour'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "border-2 border-primary/30 bg-primary/5 mt-4",
      isRTL && "font-cairo"
    )}>
      <CardHeader className="pb-3">
        <div className={cn(
          "flex items-center justify-between",
          isRTL && "flex-row-reverse"
        )}>
          <CardTitle className={cn(
            "text-lg flex items-center gap-2",
            isRTL && "flex-row-reverse"
          )}>
            <Send className="h-5 w-5 text-primary" />
            <span>{isRTL ? 'ازاي تبعت الجواب ده؟' : 'Comment envoyer cette lettre?'}</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recipient Address Card */}
        <Card className="bg-background">
          <CardHeader className="pb-2">
            <CardTitle className={cn(
              "text-sm flex items-center gap-2",
              isRTL && "flex-row-reverse text-right"
            )}>
              <MapPin className="h-4 w-4 text-accent" />
              <span>{isRTL ? 'العنوان على الظرف' : 'Adresse sur l\'enveloppe'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dispatchInfo.recipientName && (
              <div className="space-y-2">
                <p className="font-medium text-foreground">{dispatchInfo.recipientName}</p>
                {customAddress ? (
                  <div className={cn("flex items-start gap-2", isRTL && "flex-row-reverse")}>
                    <p className="text-sm text-muted-foreground flex-1 whitespace-pre-line">
                      {customAddress}
                    </p>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleCopy(`${dispatchInfo.recipientName}\n${customAddress}`)}
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className={cn("text-sm", isRTL && "block text-right")}>
                      {isRTL ? 'اكتب هنا عنوان الجهة اللي هتبعتلها' : 'Entrez l\'adresse du destinataire'}
                    </Label>
                    <Input
                      placeholder={isRTL ? 'مثال: 123 Avenue de Paris, 75001 Paris' : 'Ex: 123 Avenue de Paris, 75001 Paris'}
                      value={customAddress}
                      onChange={(e) => setCustomAddress(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                )}
              </div>
            )}
            {!dispatchInfo.recipientName && (
              <div className="space-y-2">
                <Label className={cn("text-sm", isRTL && "block text-right")}>
                  {isRTL ? 'اكتب هنا اسم وعنوان الجهة' : 'Entrez le nom et l\'adresse du destinataire'}
                </Label>
                <Input
                  placeholder={isRTL ? 'اسم الجهة...' : 'Nom du destinataire...'}
                  className="mb-2"
                  dir="ltr"
                />
                <Input
                  placeholder={isRTL ? 'العنوان...' : 'Adresse...'}
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  dir="ltr"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mode Selection */}
        <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
          <Button
            variant={selectedMode === 'mail' ? 'default' : 'outline'}
            className={cn("flex-1 gap-2", isRTL && "flex-row-reverse")}
            onClick={() => setSelectedMode(selectedMode === 'mail' ? null : 'mail')}
          >
            <Printer className="h-4 w-4" />
            {isRTL ? 'بالبوسطة' : 'Par courrier'}
          </Button>
          <Button
            variant={selectedMode === 'email' ? 'default' : 'outline'}
            className={cn("flex-1 gap-2", isRTL && "flex-row-reverse")}
            onClick={() => setSelectedMode(selectedMode === 'email' ? null : 'email')}
          >
            <Mail className="h-4 w-4" />
            {isRTL ? 'بالإيميل' : 'Par email'}
          </Button>
        </div>

        {/* La Poste Mode */}
        {selectedMode === 'mail' && (
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4 space-y-4">
              <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
                <span className="text-2xl">💡</span>
                <div className={cn(isRTL && "text-right")}>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {isRTL ? 'نصيحة مهمة!' : 'Conseil important!'}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {isRTL 
                      ? 'لازم تبعت الجواب ده مسجل بعلم الوصول عشان يبقى معاك إثبات قانوني.' 
                      : 'Envoyez cette lettre en recommandé avec accusé de réception pour avoir une preuve légale.'}
                  </p>
                </div>
              </div>

              <div className="bg-primary text-primary-foreground p-4 rounded-lg text-center">
                <p className="text-lg font-bold">
                  Lettre Recommandée avec Accusé de Réception
                </p>
              </div>

              <Button
                variant="secondary"
                className={cn("w-full gap-2", isRTL && "flex-row-reverse")}
                onClick={() => setIsFullscreen(true)}
              >
                <Maximize2 className="h-4 w-4" />
                {isRTL ? 'كبرها عشان الموظف يشوف' : 'Agrandir pour le guichetier'}
              </Button>

              <div className={cn(
                "text-xs text-muted-foreground",
                isRTL && "text-right"
              )}>
                {isRTL 
                  ? '📱 لو مش عارف تنطق الجملة دي، بس وري الشاشة للموظف وهو هيفهم.' 
                  : '📱 Si vous ne savez pas prononcer cette phrase, montrez simplement l\'écran à l\'agent.'}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email Mode */}
        {selectedMode === 'email' && (
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 space-y-4">
              <Collapsible open={isEmailGuideOpen} onOpenChange={setIsEmailGuideOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn("w-full justify-between", isRTL && "flex-row-reverse")}
                  >
                    <span className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                      <Mail className="h-4 w-4" />
                      {isRTL ? 'دليل الإرسال بالإيميل' : 'Guide d\'envoi par email'}
                    </span>
                    {isEmailGuideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  {/* Step 1: Subject */}
                  <div className={cn("space-y-2", isRTL && "text-right")}>
                    <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                      <span className="font-medium">{isRTL ? 'عنوان الإيميل (Subject)' : 'Objet de l\'email'}</span>
                    </div>
                    <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                      <code 
                        dir="ltr"
                        lang="fr"
                        className="french-email flex-1 bg-background p-2 rounded text-sm border"
                      >
                        {emailSubject}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleCopy(emailSubject)}
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Step 2: Attachment */}
                  <div className={cn("space-y-2", isRTL && "text-right")}>
                    <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                      <span className="font-medium">{isRTL ? 'المرفقات (Attachments)' : 'Pièces jointes'}</span>
                    </div>
                    <div className={cn(
                      "flex items-start gap-2 bg-background p-3 rounded border",
                      isRTL && "flex-row-reverse"
                    )}>
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        {isRTL 
                          ? 'متنساش ترفق الجواب كـ PDF. اطبعه أو حوله لـ PDF واضيفه كمرفق.' 
                          : 'N\'oubliez pas de joindre la lettre en PDF. Imprimez-la ou convertissez-la en PDF.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Body */}
                  <div className={cn("space-y-2", isRTL && "text-right")}>
                    <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                      <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                      <span className="font-medium">{isRTL ? 'نص الإيميل' : 'Corps de l\'email'}</span>
                    </div>
                    <div className="relative">
                      <pre 
                        dir="ltr"
                        lang="fr"
                        className="french-email bg-background p-3 rounded border text-sm whitespace-pre-wrap"
                      >
                        {emailBody}
                      </pre>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => handleCopy(emailBody)}
                      >
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default DispatchGuide;
