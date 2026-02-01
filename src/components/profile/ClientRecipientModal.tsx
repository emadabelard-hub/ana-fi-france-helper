import { useState } from 'react';
import { User, MapPin, Building2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export interface ClientRecipientData {
  name: string;
  address: string;
  company?: string;
}

interface ClientRecipientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: ClientRecipientData) => void;
  type?: 'client' | 'recipient';
}

const ClientRecipientModal = ({
  open,
  onOpenChange,
  onConfirm,
  type = 'client',
}: ClientRecipientModalProps) => {
  const { isRTL } = useLanguage();
  
  const [formData, setFormData] = useState<ClientRecipientData>({
    name: '',
    address: '',
    company: '',
  });

  const handleChange = (field: keyof ClientRecipientData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    if (formData.name && formData.address) {
      onConfirm(formData);
      onOpenChange(false);
      // Reset form
      setFormData({ name: '', address: '', company: '' });
    }
  };

  const isValid = formData.name.trim() && formData.address.trim();

  const title = type === 'client' 
    ? (isRTL ? 'بيانات الزبون' : 'Informations du client')
    : (isRTL ? 'الجواب ده رايح لمين؟' : 'Destinataire du courrier');

  const description = type === 'client'
    ? (isRTL ? 'أدخل بيانات الزبون للديفي أو الفاتورة' : 'Entrez les informations du client pour le devis ou la facture')
    : (isRTL ? 'أدخل بيانات المستلم للجواب' : 'Entrez les informations du destinataire');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse font-cairo"
          )}>
            <User className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className={cn(isRTL && "text-right font-cairo")}>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Company (optional) */}
          {type === 'client' && (
            <div className="space-y-2">
              <Label className={cn(
                "flex items-center gap-2 text-sm",
                isRTL && "flex-row-reverse font-cairo"
              )}>
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {isRTL ? 'اسم الشركة (اختياري)' : 'Nom de l\'entreprise (optionnel)'}
              </Label>
              <Input
                value={formData.company || ''}
                onChange={(e) => handleChange('company', e.target.value)}
                placeholder={isRTL ? 'مثال: شركة الإنشاءات' : 'Ex: Entreprise Dupont'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label className={cn(
              "flex items-center gap-2 text-sm",
              isRTL && "flex-row-reverse font-cairo"
            )}>
              <User className="h-4 w-4 text-muted-foreground" />
              {isRTL ? 'الاسم الكامل' : 'Nom complet'}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={isRTL ? 'مثال: محمد أحمد' : 'Ex: Jean Dupont'}
              className={cn(isRTL && "text-right font-cairo")}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label className={cn(
              "flex items-center gap-2 text-sm",
              isRTL && "flex-row-reverse font-cairo"
            )}>
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {isRTL ? 'العنوان' : 'Adresse'}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder={isRTL ? 'العنوان الكامل' : 'Adresse complète'}
              className={cn(isRTL && "text-right font-cairo")}
            />
          </div>
        </div>

        <div className={cn("flex gap-3", isRTL && "flex-row-reverse")}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={cn("flex-1", isRTL && "font-cairo")}
          >
            {isRTL ? 'إلغاء' : 'Annuler'}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid}
            className={cn("flex-1 gap-2", isRTL && "font-cairo")}
          >
            <Check className="h-4 w-4" />
            {isRTL ? 'تأكيد' : 'Confirmer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientRecipientModal;
