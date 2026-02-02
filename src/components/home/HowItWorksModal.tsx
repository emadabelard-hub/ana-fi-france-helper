import { useState } from 'react';
import { HelpCircle, X, FileText, Camera, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const HowItWorksModal = () => {
  const [open, setOpen] = useState(false);

  const steps = [
    {
      number: '١',
      icon: FileText,
      title: 'اختار الخدمة',
      description: 'استشارات وحلول أو دراعك اليمين',
    },
    {
      number: '٢',
      icon: Camera,
      title: 'اكتب أو صور',
      description: 'اكتب مشكلتك أو صور الجواب',
    },
    {
      number: '٣',
      icon: CheckCircle,
      title: 'خد الحل',
      description: 'هتاخد الرد الرسمي أو الملف PDF',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-primary-foreground/20"
          aria-label="كيف يعمل التطبيق"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="text-xl font-bold font-cairo text-center">
            التطبيق بيشتغل ازاي؟ 💡
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div 
                key={index} 
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl",
                  "bg-gradient-to-r from-primary/10 to-transparent",
                  "border border-primary/20"
                )}
              >
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl font-cairo">
                  {step.number}
                </div>
                <div className="flex-1 text-right font-cairo">
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                <Icon className="h-6 w-6 text-primary/60" />
              </div>
            );
          })}
        </div>

        <Button 
          onClick={() => setOpen(false)}
          className="w-full font-cairo"
        >
          فهمت! 👍
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default HowItWorksModal;
