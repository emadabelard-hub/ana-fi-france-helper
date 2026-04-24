import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface DocumentReadyCardProps {
  title?: string;
  isRTL?: boolean;
  onOpen: () => void;
}

const DocumentReadyCard = ({
  title,
  isRTL = true,
  onOpen,
}: DocumentReadyCardProps) => {
  return (
    <Card className={cn('p-4 border border-border bg-background', isRTL && 'font-cairo')}>
      <div className={cn('flex items-start justify-between gap-3', isRTL && 'flex-row-reverse')}>
        <div className={cn('space-y-1', isRTL && 'text-right')}>
          <div className={cn('text-sm font-semibold text-foreground', !isRTL && 'font-medium')}>
            {isRTL ? `✅ المستند جاهز${title ? `: ${title}` : ''}` : `✅ Document prêt${title ? ` : ${title}` : ''}`}
          </div>
          <div className={cn('text-xs text-muted-foreground', isRTL && 'leading-relaxed')}>
            {isRTL
              ? 'المستند جاهز للطباعة—افتحه في عرض الورقة.'
              : 'Document prêt à imprimer — ouvrez-le en vue « papier ».'}
          </div>
        </div>

        <Button
          onClick={onOpen}
          size="lg"
          className={cn('gap-2 whitespace-nowrap', isRTL && 'flex-row-reverse')}
        >
          <FileText className="h-5 w-5" />
          <span>{isRTL ? '📄 عرض المستند' : '📄 Ouvrir le document'}</span>
        </Button>
      </div>
    </Card>
  );
};

export default DocumentReadyCard;
