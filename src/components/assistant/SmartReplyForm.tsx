import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Send, User, Building, FileText, Loader2 } from 'lucide-react';
import { Profile } from '@/hooks/useProfile';

interface ExtractedInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subject?: string;
  documentDate?: string;
}

interface SmartReplyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SmartReplyData) => void;
  extractedInfo?: ExtractedInfo;
  profile?: Profile | null;
  isRTL?: boolean;
  isLoading?: boolean;
}

export interface SmartReplyData {
  // Sender (from profile)
  senderName: string;
  senderAddress: string;
  senderPhone: string;
  // Recipient
  recipientName: string;
  recipientAddress: string;
  // Document references
  referenceNumber: string;
  subject: string;
  // Key points
  keyPoints: string;
}

const SmartReplyForm = ({
  isOpen,
  onClose,
  onSubmit,
  extractedInfo,
  profile,
  isRTL = true,
  isLoading = false,
}: SmartReplyFormProps) => {
  // Sender info - auto-filled from profile
  const [senderName, setSenderName] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  
  // Recipient info - auto-filled from extracted info
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  
  // Document references - auto-filled from extracted info
  const [referenceNumber, setReferenceNumber] = useState('');
  const [subject, setSubject] = useState('');
  
  // Key points for the response
  const [keyPoints, setKeyPoints] = useState('');

  // Auto-fill from profile when it changes or modal opens
  useEffect(() => {
    if (profile) {
      setSenderName(profile.full_name || '');
      setSenderAddress(profile.address || '');
      setSenderPhone(profile.phone || '');
    }
  }, [profile, isOpen]);

  // Auto-fill from extracted info
  useEffect(() => {
    if (extractedInfo) {
      if (extractedInfo.recipientName) setRecipientName(extractedInfo.recipientName);
      if (extractedInfo.recipientAddress) setRecipientAddress(extractedInfo.recipientAddress);
      if (extractedInfo.referenceNumber) setReferenceNumber(extractedInfo.referenceNumber);
      if (extractedInfo.subject) setSubject(extractedInfo.subject);
    }
  }, [extractedInfo, isOpen]);

  const handleSubmit = () => {
    const data: SmartReplyData = {
      senderName,
      senderAddress,
      senderPhone,
      recipientName,
      recipientAddress,
      referenceNumber,
      subject,
      keyPoints,
    };
    onSubmit(data);
  };

  const canSubmit = recipientName.trim() && subject.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-lg max-h-[90vh] overflow-y-auto",
        isRTL && "font-cairo"
      )}>
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse text-right")}>
            <FileText className="h-5 w-5 text-primary" />
            {isRTL ? '✍️ رد على المستند' : '✍️ Rédiger une réponse'}
          </DialogTitle>
          <DialogDescription className={cn(isRTL && "text-right")}>
            {isRTL 
              ? 'تم استخراج البيانات تلقائياً من المستند - راجعها وأضف النقاط الأساسية' 
              : 'Données extraites automatiquement - vérifiez et ajoutez vos points clés'}
          </DialogDescription>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={['recipient', 'details']} className="space-y-2">
          {/* Sender Section (auto-filled from profile) */}
          <AccordionItem value="sender" className="border rounded-lg px-4">
            <AccordionTrigger className={cn(
              "hover:no-underline",
              isRTL && "flex-row-reverse"
            )}>
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <User className="h-4 w-4 text-green-600" />
                <span className="font-medium">
                  {isRTL ? '✅ بياناتك (من الملف الشخصي)' : '✅ Vos informations (du profil)'}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              {profile ? (
                <div className={cn(
                  "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2",
                  isRTL && "text-right"
                )}>
                  <p className="text-sm">
                    <strong>{isRTL ? 'الاسم:' : 'Nom:'}</strong> {senderName || (isRTL ? 'غير محدد' : 'Non défini')}
                  </p>
                  <p className="text-sm">
                    <strong>{isRTL ? 'العنوان:' : 'Adresse:'}</strong> {senderAddress || (isRTL ? 'غير محدد' : 'Non défini')}
                  </p>
                  <p className="text-sm">
                    <strong>{isRTL ? 'التليفون:' : 'Téléphone:'}</strong> {senderPhone || (isRTL ? 'غير محدد' : 'Non défini')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 {isRTL ? 'لتعديل بياناتك، اذهب للملف الشخصي' : 'Pour modifier, allez dans votre profil'}
                  </p>
                </div>
              ) : (
                <div className={cn(
                  "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3",
                  isRTL && "text-right"
                )}>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ {isRTL ? 'لم يتم العثور على ملف شخصي. سجل دخولك أولاً.' : 'Profil non trouvé. Connectez-vous d\'abord.'}
                  </p>
                  <div className="space-y-2 mt-3">
                    <Input
                      placeholder={isRTL ? 'اسمك الكامل' : 'Votre nom complet'}
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className={cn(isRTL && "text-right")}
                    />
                    <Input
                      placeholder={isRTL ? 'عنوانك' : 'Votre adresse'}
                      value={senderAddress}
                      onChange={(e) => setSenderAddress(e.target.value)}
                      className={cn(isRTL && "text-right")}
                    />
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Recipient Section */}
          <AccordionItem value="recipient" className="border rounded-lg px-4">
            <AccordionTrigger className={cn(
              "hover:no-underline",
              isRTL && "flex-row-reverse"
            )}>
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <Building className="h-4 w-4 text-blue-600" />
                <span className="font-medium">
                  {isRTL ? '📬 المرسل إليه' : '📬 Destinataire'}
                  {extractedInfo?.recipientName && (
                    <span className="text-xs text-green-600 ml-2">
                      {isRTL ? '(تم الاستخراج تلقائياً)' : '(extrait automatiquement)'}
                    </span>
                  )}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className={cn("text-xs", isRTL && "block text-right")}>
                  {isRTL ? 'اسم الجهة / الشخص *' : 'Nom de l\'organisme / personne *'}
                </Label>
                <Input
                  placeholder={isRTL ? 'مثال: CAF de Paris / M. Dupont' : 'Ex: CAF de Paris / M. Dupont'}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className={cn(isRTL && "text-right")}
                />
              </div>
              <div className="space-y-1">
                <Label className={cn("text-xs", isRTL && "block text-right")}>
                  {isRTL ? 'العنوان (اختياري)' : 'Adresse (optionnel)'}
                </Label>
                <Input
                  placeholder={isRTL ? 'مثال: 12 rue de Paris, 75001' : 'Ex: 12 rue de Paris, 75001 Paris'}
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* References & Subject */}
          <AccordionItem value="details" className="border rounded-lg px-4">
            <AccordionTrigger className={cn(
              "hover:no-underline",
              isRTL && "flex-row-reverse"
            )}>
              <span className="font-medium">
                {isRTL ? '📋 المرجع والموضوع' : '📋 Références et Objet'}
                {extractedInfo?.referenceNumber && (
                  <span className="text-xs text-green-600 ml-2">
                    {isRTL ? '(تم الاستخراج)' : '(extrait)'}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className={cn("text-xs", isRTL && "block text-right")}>
                  {isRTL ? 'رقم المرجع / الملف' : 'N° de référence / dossier'}
                </Label>
                <Input
                  placeholder={isRTL ? 'مثال: REF-2024-12345' : 'Ex: REF-2024-12345'}
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label className={cn("text-xs", isRTL && "block text-right")}>
                  {isRTL ? 'الموضوع *' : 'Objet *'}
                </Label>
                <Input
                  placeholder={isRTL ? 'مثال: طلب إعادة النظر في القرار' : 'Ex: Demande de révision de décision'}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={cn(isRTL && "text-right")}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Key Points */}
          <AccordionItem value="keypoints" className="border rounded-lg px-4">
            <AccordionTrigger className={cn(
              "hover:no-underline",
              isRTL && "flex-row-reverse"
            )}>
              <span className="font-medium">
                {isRTL ? '💡 النقاط الأساسية للرد' : '💡 Points clés de la réponse'}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className={cn("text-xs", isRTL && "block text-right")}>
                  {isRTL ? 'إيه اللي عايز تقوله في الرد؟' : 'Que souhaitez-vous dire dans votre réponse?'}
                </Label>
                <Textarea
                  placeholder={isRTL 
                    ? 'مثال: أريد الاعتراض على هذا القرار لأن...\n- السبب الأول\n- السبب الثاني' 
                    : 'Ex: Je souhaite contester cette décision car...\n- Raison 1\n- Raison 2'}
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                  className={cn("min-h-[100px]", isRTL && "text-right")}
                />
              </div>
              <p className={cn("text-xs text-muted-foreground", isRTL && "text-right")}>
                💡 {isRTL 
                  ? 'اكتب بالعربي وأنا هحولها لفرنسي رسمي' 
                  : 'Écrivez en arabe, je le traduirai en français formel'}
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DialogFooter className={cn("mt-4", isRTL && "flex-row-reverse")}>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {isRTL ? 'إلغاء' : 'Annuler'}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isRTL ? 'جاري الكتابة...' : 'Rédaction...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {isRTL ? '✍️ اكتب الرد' : '✍️ Rédiger'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SmartReplyForm;
