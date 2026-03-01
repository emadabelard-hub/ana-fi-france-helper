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
        "pointer-events-none absolute inset-0 z-50 overflow-hidden select-none print:hidden",
        className
      )}
      aria-hidden="true"
    >
      {/* Repeated diagonal watermark rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="absolute whitespace-nowrap text-center"
          style={{
            top: `${10 + i * 16}%`,
            left: '-20%',
            right: '-20%',
            transform: 'rotate(-35deg)',
            fontSize: '1.4rem',
            fontWeight: 900,
            color: 'rgba(220, 38, 38, 0.18)',
            letterSpacing: '0.08em',
            lineHeight: 1.8,
            userSelect: 'none',
          }}
        >
          <div className="font-cairo">نسخة معاينة - غير صالحة للتقديم</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '1.1rem' }}>
            PREVIEW ONLY — NOT VALID FOR SUBMISSION
          </div>
        </div>
      ))}
    </div>
  );
};

export default DocumentWatermark;
