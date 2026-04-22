/**
 * Real, scannable QR code for document verification.
 * Encodes the public verification URL so any smartphone can validate authenticity.
 */
import { useEffect, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = buildVerifyUrl(documentId, documentNumber);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {
      // Silent fail — visual silence policy
    });
  }, [url, size]);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="border border-gray-300 rounded"
        style={{ shapeRendering: 'crispEdges' }}
      />
      <span className="text-[5pt] text-gray-400 font-medium tracking-wide">
        Scannez pour vérifier
      </span>
    </div>
  );
};

export default DocumentQRCode;
