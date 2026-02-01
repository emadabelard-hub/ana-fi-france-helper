import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FileText, Send } from 'lucide-react';

interface MissingField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

interface MissingInfoFormProps {
  fields: MissingField[];
  onSubmit: (data: Record<string, string>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  isRTL?: boolean;
}

const MissingInfoForm = ({ 
  fields, 
  onSubmit, 
  onCancel, 
  isLoading = false, 
  isRTL = true 
}: MissingInfoFormProps) => {
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isFormValid = fields.every(field => formData[field.key]?.trim());

  return (
    <Card className={cn(
      "border-2 border-accent/50 bg-accent/5",
      isRTL && "font-cairo"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className={cn(
          "text-lg flex items-center gap-2",
          isRTL && "flex-row-reverse text-right"
        )}>
          <FileText className="h-5 w-5 text-accent" />
          <span>{isRTL ? 'بيانات ناقصة عشان الجواب يكمل' : 'Informations manquantes pour compléter la lettre'}</span>
        </CardTitle>
        <p className={cn(
          "text-sm text-muted-foreground",
          isRTL && "text-right"
        )}>
          {isRTL 
            ? 'عشان أكتبلك جواب رسمي متكامل، محتاج منك البيانات دي:' 
            : 'Pour rédiger une lettre complète, j\'ai besoin de ces informations:'}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label 
                htmlFor={field.key}
                className={cn(
                  "text-sm font-medium",
                  isRTL && "block text-right"
                )}
              >
                {field.label}
              </Label>
              <Input
                id={field.key}
                type={field.type || 'text'}
                placeholder={field.placeholder}
                value={formData[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className={cn(isRTL && "text-right")}
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>
          ))}
          
          <div className={cn(
            "flex gap-3 pt-3",
            isRTL && "flex-row-reverse"
          )}>
            <Button
              type="submit"
              disabled={!isFormValid || isLoading}
              className={cn("flex-1 gap-2", isRTL && "flex-row-reverse")}
            >
              <Send className="h-4 w-4" />
              {isLoading 
                ? (isRTL ? 'جار الكتابة...' : 'Rédaction...') 
                : (isRTL ? 'تمام، اكتب الجواب' : 'Générer la lettre')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              {isRTL ? 'إلغاء' : 'Annuler'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default MissingInfoForm;
