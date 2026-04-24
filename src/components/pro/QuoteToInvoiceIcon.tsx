import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface QuoteToInvoiceIconProps {
  className?: string;
}

/**
 * Custom icon combining a quote document and invoice document
 * with a transfer arrow between them
 */
const QuoteToInvoiceIcon = ({ className = "h-8 w-8" }: QuoteToInvoiceIconProps) => {
  const { isRTL } = useLanguage();
  const quoteLabel = isRTL ? 'دوفي' : 'Devis';
  const invoiceLabel = isRTL ? 'فاكتير' : 'Facture';
  return (
    <svg 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Quote document (left) - amber/yellow */}
      <rect 
        x="4" 
        y="6" 
        width="16" 
        height="20" 
        rx="2" 
        fill="currentColor" 
        className="text-amber-400"
        opacity="0.9"
      />
      <rect x="7" y="10" width="10" height="2" rx="1" fill="white" opacity="0.8" />
      <rect x="7" y="14" width="8" height="2" rx="1" fill="white" opacity="0.6" />
      <rect x="7" y="18" width="10" height="2" rx="1" fill="white" opacity="0.6" />
      <text 
        x="12" 
        y="24" 
        fontSize={quoteLabel.length > 4 ? 2.6 : 3.5}
        fill="white" 
        fontWeight="bold" 
        textAnchor="middle"
        opacity="0.9"
        fontFamily={isRTL ? 'Cairo, sans-serif' : 'Inter, sans-serif'}
      >
        {quoteLabel}
      </text>
      
      {/* Transfer arrow (center) - animated pulse effect via CSS */}
      <path 
        d="M22 20 L26 20 L26 17 L31 21 L26 25 L26 22 L22 22 Z" 
        fill="currentColor"
        className="text-primary"
      />
      
      {/* Invoice document (right) - primary/green */}
      <rect 
        x="28" 
        y="10" 
        width="16" 
        height="22" 
        rx="2" 
        fill="currentColor"
        className="text-emerald-500"
      />
      <rect x="31" y="14" width="10" height="2" rx="1" fill="white" opacity="0.8" />
      <rect x="31" y="18" width="8" height="2" rx="1" fill="white" opacity="0.6" />
      <rect x="31" y="22" width="10" height="2" rx="1" fill="white" opacity="0.6" />
      <text 
        x="36" 
        y="28" 
        fontSize="3.5" 
        fill="white" 
        fontWeight="bold" 
        textAnchor="middle"
        opacity="0.9"
        fontFamily="Cairo, sans-serif"
      >
        فاكتير
      </text>
      
      {/* Sparkle effect on invoice (success indicator) */}
      <circle cx="42" cy="12" r="2" fill="currentColor" className="text-yellow-400" />
      <path 
        d="M42 9 L42 11 M42 13 L42 15 M39 12 L41 12 M43 12 L45 12" 
        stroke="currentColor" 
        strokeWidth="0.5"
        className="text-yellow-400"
      />
    </svg>
  );
};

export default QuoteToInvoiceIcon;
