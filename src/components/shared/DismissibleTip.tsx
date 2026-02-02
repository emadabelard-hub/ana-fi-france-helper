import { useState, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DismissibleTipProps {
  storageKey: string;
  title: string;
  text: string;
  className?: string;
}

const DismissibleTip = ({ storageKey, title, text, className }: DismissibleTipProps) => {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    setIsDismissed(dismissed === 'true');
  }, [storageKey]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };

  if (isDismissed) return null;

  return (
    <Alert className={cn(
      "relative border-accent/30 bg-accent/10",
      "animate-in fade-in slide-in-from-top-2 duration-300",
      className
    )}>
      <Lightbulb className="h-4 w-4 text-accent" />
      <AlertDescription className="font-cairo text-right pr-6">
        <span className="font-semibold text-foreground">{title}</span>
        <br />
        <span className="text-muted-foreground text-sm">{text}</span>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 left-2 h-6 w-6 rounded-full hover:bg-accent/20"
        onClick={handleDismiss}
        aria-label="إغلاق"
      >
        <X className="h-3 w-3" />
      </Button>
    </Alert>
  );
};

export default DismissibleTip;
