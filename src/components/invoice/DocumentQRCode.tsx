/**
 * Real, scannable QR code for document verification.
 * Renders as a base64 PNG <img> so it survives PDF export
 * (a <canvas> would be empty when serialized to HTML for Browserless).
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface DocumentQRCodeProps {
  /** Database UUID of the saved document. If absent, falls back to a deterministic hash. */
  documentId?: string;
  documentNumber: string;
  date: string;
  totalTTC: number;
  size?: number;
}

const VERIFY_BASE_URL = 'https://ana-fi-france-helper.lovable.app/verify';

const buildVerifyUrl = (documentId?: string, documentNumber?: string) => {
  if (documentId) return `${VERIFY_BASE_URL}/${documentId}`;
  // Fallback: encode number when no DB id (preview mode)
  return `${VERIFY_BASE_URL}/preview?n=${encodeURIComponent(documentNumber || '')}`;
};

const DocumentQRCode = ({ documentId, documentNumber, date, totalTTC, size = 64 }: DocumentQRCodeProps) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const url = buildVerifyUrl(documentId, documentNumber);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size * 2, // 2× for crisp rendering when downscaled
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((png) => {
        if (!cancelled) setDataUrl(png);
      })
      .catch(() => {
        // Silent fail — visual silence policy
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <div className="flex flex-col items-center gap-0.5">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="QR de vérification"
          width={size}
          height={size}
          className="border border-gray-300 rounded"
          style={{ width: `${size}px`, height: `${size}px`, imageRendering: 'pixelated' }}
        />
      ) : (
        <div
          className="border border-gray-300 rounded bg-gray-50"
          style={{ width: `${size}px`, height: `${size}px` }}
        />
      )}
      <span className="text-[5pt] text-gray-400 font-medium tracking-wide">
        Scannez pour vérifier
      </span>
    </div>
  );
};

export default DocumentQRCode;
