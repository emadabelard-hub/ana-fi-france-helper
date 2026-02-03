import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FileText, Mail, Receipt, PenLine, Building2, X } from 'lucide-react';

export interface CompanyHeader {
  companyName: string;
  siret: string;
  address: string;
  phone: string;
  email: string;
}

export interface DocumentFormData {
  type: 'devis' | 'facture' | 'lettre' | 'email';
  // Company header
  companyHeader: CompanyHeader;
  // Client info (for Devis/Facture)
  clientName?: string;
  clientAddress?: string;
  // Letter/Email specific
  recipientName?: string;
  recipientAddress?: string;
  subject?: string;
  description?: string;
  // Items (for Devis/Facture)
  items?: string;
}

interface DocumentTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DocumentFormData) => void;
  isRTL?: boolean;
}

const COMPANY_HEADER_KEY = 'company_header_info';

const DocumentTypeSelector = ({
  isOpen,
  onClose,
  onSubmit,
  isRTL = true,
}: DocumentTypeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<DocumentFormData['type'] | null>(null);
  const [companyHeader, setCompanyHeader] = useState<CompanyHeader>({
    companyName: '',
    siret: '',
    address: '',
    phone: '',
    email: '',
  });
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState('');

  // Load company header from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(COMPANY_HEADER_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CompanyHeader;
        setCompanyHeader(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, [isOpen]);

  // Save company header to localStorage when it changes
  const updateCompanyHeader = (updates: Partial<CompanyHeader>) => {
    const updated = { ...companyHeader, ...updates };
    setCompanyHeader(updated);
    localStorage.setItem(COMPANY_HEADER_KEY, JSON.stringify(updated));
  };

  const handleSubmit = () => {
    if (!selectedType) return;

    const formData: DocumentFormData = {
      type: selectedType,
      companyHeader,
      clientName,
      clientAddress,
      recipientName,
      recipientAddress,
      subject,
      description,
      items,
    };

    onSubmit(formData);
    resetForm();
  };

  const resetForm = () => {
    setSelectedType(null);
    setClientName('');
    setClientAddress('');
    setRecipientName('');
    setRecipientAddress('');
    setSubject('');
    setDescription('');
    setItems('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const documentTypes = [
    {
      type: 'devis' as const,
      icon: PenLine,
      title: isRTL ? 'تقدير (Devis)' : 'Devis',
      description: isRTL ? 'عرض سعر قبل بدء العمل' : 'Proposition de prix avant travaux',
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
    },
    {
      type: 'facture' as const,
      icon: Receipt,
      title: isRTL ? 'فاتورة (Facture)' : 'Facture',
      description: isRTL ? 'طلب الدفع بعد الشغل' : 'Demande de paiement après travaux',
      color: 'text-green-600',
      bg: 'bg-green-500/10',
    },
    {
      type: 'lettre' as const,
      icon: FileText,
      title: isRTL ? 'خطاب رسمي (Courrier)' : 'Lettre officielle',
      description: isRTL ? 'جواب رسمي لجهة إدارية' : 'Courrier officiel à une administration',
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
    },
    {
      type: 'email' as const,
      icon: Mail,
      title: isRTL ? 'إيميل رسمي' : 'Email professionnel',
      description: isRTL ? 'رسالة إلكترونية رسمية' : 'Message électronique officiel',
      color: 'text-purple-600',
      bg: 'bg-purple-500/10',
    },
  ];

  const isDevisOrFacture = selectedType === 'devis' || selectedType === 'facture';
  const isLetterOrEmail = selectedType === 'lettre' || selectedType === 'email';

  const canSubmit = () => {
    if (!selectedType) return false;
    
    if (isDevisOrFacture) {
      return companyHeader.companyName && companyHeader.siret && clientName && items;
    }
    
    if (isLetterOrEmail) {
      return recipientName && subject && description;
    }
    
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-lg max-h-[90vh] overflow-y-auto",
        isRTL && "font-cairo"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(isRTL && "text-right")}>
            {isRTL ? '📄 اختار نوع المستند' : '📄 Choisir le type de document'}
          </DialogTitle>
          <DialogDescription className={cn(isRTL && "text-right")}>
            {isRTL 
              ? 'اختار المستند اللي عايزه وادخل البيانات' 
              : 'Sélectionnez le document et remplissez les informations'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Type Selection */}
          {!selectedType && (
            <div className="grid grid-cols-2 gap-3">
              {documentTypes.map((doc) => {
                const Icon = doc.icon;
                return (
                  <Card
                    key={doc.type}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]",
                      "border-2 border-transparent hover:border-primary/30"
                    )}
                    onClick={() => setSelectedType(doc.type)}
                  >
                    <CardContent className={cn(
                      "flex flex-col items-center text-center p-4 gap-2",
                      isRTL && "font-cairo"
                    )}>
                      <div className={cn("p-3 rounded-full", doc.bg)}>
                        <Icon className={cn("h-6 w-6", doc.color)} />
                      </div>
                      <h3 className="font-semibold text-sm">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground">{doc.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Form for selected type */}
          {selectedType && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedType(null)}
                className={cn("gap-2", isRTL && "flex-row-reverse")}
              >
                <X className="h-4 w-4" />
                {isRTL ? 'رجوع للاختيار' : 'Retour au choix'}
              </Button>

              <Accordion type="multiple" defaultValue={['company', 'details']} className="space-y-2">
                {/* Company Header Section (for Devis/Facture) */}
                {isDevisOrFacture && (
                  <AccordionItem value="company" className="border rounded-lg px-4">
                    <AccordionTrigger className={cn(
                      "hover:no-underline",
                      isRTL && "flex-row-reverse"
                    )}>
                      <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {isRTL ? 'بيانات شركتك (En-tête)' : 'Votre entreprise (En-tête)'}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className={cn("text-xs", isRTL && "block text-right")}>
                            {isRTL ? 'اسم الشركة' : 'Nom entreprise'}
                          </Label>
                          <Input
                            placeholder={isRTL ? 'مثال: شركة محمد للبناء' : 'Ex: Entreprise Dupont'}
                            value={companyHeader.companyName}
                            onChange={(e) => updateCompanyHeader({ companyName: e.target.value })}
                            className={cn(isRTL && "text-right")}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={cn("text-xs", isRTL && "block text-right")}>
                            SIRET
                          </Label>
                          <Input
                            placeholder="123 456 789 00012"
                            value={companyHeader.siret}
                            onChange={(e) => updateCompanyHeader({ siret: e.target.value })}
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className={cn("text-xs", isRTL && "block text-right")}>
                          {isRTL ? 'العنوان' : 'Adresse'}
                        </Label>
                        <Input
                          placeholder={isRTL ? '123 شارع باريس، 75001' : '123 Rue de Paris, 75001 Paris'}
                          value={companyHeader.address}
                          onChange={(e) => updateCompanyHeader({ address: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className={cn("text-xs", isRTL && "block text-right")}>
                            {isRTL ? 'التليفون' : 'Téléphone'}
                          </Label>
                          <Input
                            placeholder="06 12 34 56 78"
                            value={companyHeader.phone}
                            onChange={(e) => updateCompanyHeader({ phone: e.target.value })}
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={cn("text-xs", isRTL && "block text-right")}>
                            Email
                          </Label>
                          <Input
                            type="email"
                            placeholder="contact@example.com"
                            value={companyHeader.email}
                            onChange={(e) => updateCompanyHeader({ email: e.target.value })}
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <p className={cn(
                        "text-xs text-muted-foreground",
                        isRTL && "text-right"
                      )}>
                        💾 {isRTL ? 'البيانات دي هتتحفظ تلقائياً' : 'Ces informations sont sauvegardées automatiquement'}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Client Info (for Devis/Facture) */}
                {isDevisOrFacture && (
                  <AccordionItem value="client" className="border rounded-lg px-4">
                    <AccordionTrigger className={cn(
                      "hover:no-underline",
                      isRTL && "flex-row-reverse"
                    )}>
                      <span className="font-medium">
                        {isRTL ? '👤 بيانات العميل' : '👤 Informations client'}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <Label className={cn("text-xs", isRTL && "block text-right")}>
                          {isRTL ? 'اسم العميل' : 'Nom du client'}
                        </Label>
                        <Input
                          placeholder={isRTL ? 'مثال: م. جان دوبون' : 'Ex: M. Jean Dupont'}
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className={cn(isRTL && "text-right")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className={cn("text-xs", isRTL && "block text-right")}>
                          {isRTL ? 'عنوان العميل' : 'Adresse du client'}
                        </Label>
                        <Input
                          placeholder={isRTL ? 'العنوان الكامل' : 'Adresse complète'}
                          value={clientAddress}
                          onChange={(e) => setClientAddress(e.target.value)}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Details Section */}
                <AccordionItem value="details" className="border rounded-lg px-4">
                  <AccordionTrigger className={cn(
                    "hover:no-underline",
                    isRTL && "flex-row-reverse"
                  )}>
                    <span className="font-medium">
                      {isRTL ? '📝 التفاصيل' : '📝 Détails'}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    {/* Recipient info for Letter/Email */}
                    {isLetterOrEmail && (
                      <>
                        <div className="space-y-1">
                          <Label className={cn("text-xs", isRTL && "block text-right")}>
                            {isRTL ? 'اسم الجهة المستلمة' : 'Nom du destinataire'}
                          </Label>
                          <Input
                            placeholder={isRTL ? 'مثال: CAF de Paris' : 'Ex: CAF de Paris'}
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={cn("text-xs", isRTL && "block text-right")}>
                            {isRTL ? 'عنوان الجهة (اختياري)' : 'Adresse (optionnel)'}
                          </Label>
                          <Input
                            placeholder={isRTL ? 'العنوان' : 'Adresse'}
                            value={recipientAddress}
                            onChange={(e) => setRecipientAddress(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={cn("text-xs", isRTL && "block text-right")}>
                            {isRTL ? 'الموضوع' : 'Objet'}
                          </Label>
                          <Input
                            placeholder={isRTL ? 'مثال: طلب إعادة النظر' : 'Ex: Demande de révision'}
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    {/* Description/Items */}
                    <div className="space-y-1">
                      <Label className={cn("text-xs", isRTL && "block text-right")}>
                        {isDevisOrFacture 
                          ? (isRTL ? 'تفاصيل الشغل والأسعار' : 'Détails des travaux et prix')
                          : (isRTL ? 'تفاصيل الطلب' : 'Détails de la demande')
                        }
                      </Label>
                      <Textarea
                        placeholder={isDevisOrFacture 
                          ? (isRTL 
                              ? 'مثال: بويا 3 أوض (30 متر مربع)، سعر المتر 15 يورو...' 
                              : 'Ex: Peinture 3 pièces (30m²), 15€/m²...')
                          : (isRTL 
                              ? 'اشرح مشكلتك أو طلبك بالتفصيل...' 
                              : 'Décrivez votre demande en détail...')
                        }
                        value={isDevisOrFacture ? items : description}
                        onChange={(e) => isDevisOrFacture 
                          ? setItems(e.target.value) 
                          : setDescription(e.target.value)
                        }
                        rows={4}
                        className={cn(isRTL && "text-right")}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </div>

        {selectedType && (
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={handleClose}>
              {isRTL ? 'إلغاء' : 'Annuler'}
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!canSubmit()}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {isRTL ? 'إنشاء المستند' : 'Générer le document'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentTypeSelector;
