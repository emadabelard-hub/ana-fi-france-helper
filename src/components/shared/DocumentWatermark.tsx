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
      {/* Repeated heavy SPECIMEN watermark */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute whitespace-nowrap text-center"
          style={{
            transform: 'rotate(-35deg)',
            fontSize: '3rem',
            fontWeight: 900,
            color: 'rgba(220, 38, 38, 0.18)',
            letterSpacing: '0.15em',
            lineHeight: 1.8,
            userSelect: 'none',
            top: `${15 + i * 35}%`,
            left: '50%',
            marginLeft: '-50%',
            width: '200%',
          }}
        >
          <div style={{ fontFamily: 'Arial, sans-serif' }}>
            SPECIMEN — PROJET
          </div>
          <div className="font-cairo" style={{ fontSize: '1.6rem' }}>
            نسخة غير صالحة للتقديم
          </div>
        </div>
      ))}
    </div>
  );
};

export default DocumentWatermark;
