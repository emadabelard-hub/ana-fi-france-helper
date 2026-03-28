import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CopyButtonProps {
  text: string;
  isRTL?: boolean;
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'icon';
  showLabel?: boolean;
  className?: string;
}

const CopyButton = ({
  text,
  isRTL = false,
  variant = 'ghost',
  size = 'sm',
  showLabel = true,
  className,
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(async () => {
    if (copied) return;
    try {
      // Strip HTML tags for clean text copy
      const clean = text
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      toast({
        title: isRTL ? '✅ اتنسخ!' : '✅ Copié !',
        description: isRTL ? 'النص جاهز للصق' : 'Texte prêt à coller',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'مقدرش انسخ' : 'Impossible de copier',
        variant: 'destructive',
      });
    }
  }, [text, copied, isRTL, toast]);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn(
        'gap-1.5 transition-all duration-200',
        copied && 'text-green-600 dark:text-green-400',
        isRTL && 'flex-row-reverse',
        className,
      )}
      aria-label={isRTL ? 'نسخ' : 'Copier'}
    >
      <span
        className={cn(
          'transition-transform duration-200',
          copied && 'scale-110',
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </span>
      {showLabel && (
        <span className={cn('text-xs', isRTL && 'font-cairo')}>
          {copied
            ? (isRTL ? 'اتنسخ!' : 'Copié !')
            : (isRTL ? 'انسخ' : 'Copier')}
        </span>
      )}
    </Button>
  );
};

export default CopyButton;
