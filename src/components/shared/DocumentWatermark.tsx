import { cn } from '@/lib/utils';

interface DocumentWatermarkProps {
  className?: string;
}

/**
 * Diagonal watermark overlay for document previews.
 * Renders "نسخة معاينة - غير صالحة للتقديم" and "PREVIEW ONLY"
 * as a repeated semi-transparent diagonal pattern.
 */
const DocumentWatermark = ({ className }: DocumentWatermarkProps) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-50 overflow-hidden select-none print:hidden flex items-center justify-center",
        className
      )}
      aria-hidden="true"
    >
      {/* Single centered diagonal watermark */}
      <div
        className="absolute whitespace-nowrap text-center"
        style={{
          transform: 'rotate(-35deg)',
          fontSize: '2.2rem',
          fontWeight: 900,
          color: 'rgba(220, 38, 38, 0.22)',
          letterSpacing: '0.08em',
          lineHeight: 2,
          userSelect: 'none',
        }}
      >
        <div className="font-cairo">نسخة معاينة - غير صالحة للتقديم</div>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '1.3rem' }}>
          PREVIEW ONLY — NOT VALID FOR SUBMISSION
        </div>
      </div>
    </div>
  );
};

export default DocumentWatermark;
