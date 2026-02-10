import { cn } from '@/lib/utils';

export interface InvoiceData {
  type: string;
  number: string;
  date: string;
  validUntil?: string;
  emitter: {
    name: string;
    siret: string;
    address: string;
    phone?: string;
    email?: string;
    decennale?: string;
  };
  client: {
    name: string;
    address: string;
  };
  workSite?: {
    sameAsClient: boolean;
    address?: string;
  };
  items: Array<{
    designation_fr: string;
    designation_ar: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tvaRate: number;
  tvaAmount: number;
  total: number;
  tvaExempt: boolean;
  tvaExemptText?: string;
  paymentTerms: string;
  legalMentions?: string;
  // Artisan permanent signature (unique signature affichée sur les PDF)
  artisanSignatureUrl?: string;
  // Stamp (cachet)
  stampUrl?: string;
}


interface InvoiceDisplayProps {
  data: InvoiceData;
  showArabic: boolean;
}

const InvoiceDisplay = ({ data, showArabic }: InvoiceDisplayProps) => {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format number without € symbol (for table cells)
  const formatNumber = (amount: number) => {
    return amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  return (
    <div 
      dir="ltr"
      lang="fr"
      className="french-invoice bg-white text-black rounded-lg shadow-lg max-w-2xl mx-auto print:shadow-none"
      style={{
        padding: '1.5cm 1.5cm 2cm 1.5cm',
        boxSizing: 'border-box',
        minHeight: 'auto',
      }}
    >
      {/* Header */}
      <div className="border-b-2 border-primary pb-3 mb-3">
        <div className="flex justify-between items-start">
          {/* Company Info */}
          <div>
            <h1 className="text-lg font-bold text-primary">{data.emitter.name}</h1>
            <p className="text-[11px] text-gray-600 whitespace-pre-line">{data.emitter.address}</p>
            <p className="text-[11px] text-gray-600">SIRET: {data.emitter.siret}</p>
            {data.emitter.phone && <p className="text-[11px] text-gray-600">Tél: {data.emitter.phone}</p>}
            {data.emitter.email && <p className="text-[11px] text-gray-600">Email: {data.emitter.email}</p>}
            {data.emitter.decennale && (
              <p className="text-[11px] text-gray-600">Assurance Décennale: {data.emitter.decennale}</p>
            )}
          </div>
          
          {/* Document Info */}
          <div className="text-right">
            <h2 className="text-xl font-bold text-primary">{data.type}</h2>
            <p className="text-[11px] text-gray-600">N° {data.number}</p>
          </div>
        </div>
        
        {/* Date Bar */}
        <div className="flex flex-wrap gap-4 text-[9px] font-bold bg-muted/50 p-2 rounded-lg border border-border mt-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>📅 Émis le : {data.date}</span>
          </div>
          {data.type === 'DEVIS' && data.validUntil && (
            <>
              <div className="w-[1px] bg-border hidden sm:block"></div>
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                <span>⏳ Valide jusqu'au : {data.validUntil}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-muted/30 p-3 rounded-lg mb-4">
        <h3 className="font-semibold text-gray-700 mb-1 text-[11px]">CLIENT</h3>
        <p className="font-medium text-[12px]">{data.client.name}</p>
        <p className="text-[11px] text-gray-600 whitespace-pre-line">{data.client.address}</p>
        
        {/* Work Site Address (if different from client) */}
        {data.workSite && !data.workSite.sameAsClient && data.workSite.address && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5">📍 Adresse du Chantier</p>
            <p className="text-[11px] text-gray-600 whitespace-pre-line">{data.workSite.address}</p>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-primary text-primary-foreground text-[10px]">
              <th className="p-1.5 text-left border align-middle" style={{ width: '40%' }}>Désignation</th>
              <th className="p-1.5 text-center border align-middle" style={{ width: '15%' }}>Qté/Unité</th>
              <th className="p-1.5 text-left border align-middle" style={{ width: '20%' }}>P.U (€)</th>
              <th className="p-1.5 text-left border align-middle" style={{ width: '25%' }}>Total (€)</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => {
              const isSection = item.designation_fr.toUpperCase().startsWith('ZONE') || 
                               item.unit.toLowerCase() === 'forfait' ||
                               item.unit.toLowerCase() === 'f';
              
              return (
                <tr 
                  key={index} 
                  className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                >
                  <td 
                    className="p-1.5 border text-left align-middle"
                    style={isSection && index > 0 ? { paddingTop: '32px' } : undefined}
                  >
                    <div>
                      <span 
                        className={`font-medium leading-tight ${isSection ? 'font-bold text-primary' : ''}`}
                        style={{ textAlign: 'left', display: 'block' }}
                      >
                        {item.designation_fr}
                      </span>
                      {showArabic && item.designation_ar && (
                        <span className="block text-[9px] text-gray-500 mt-0.5 print:hidden" dir="rtl">
                          {item.designation_ar}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-1.5 text-center border align-middle">
                    <div className="flex flex-col items-center leading-tight">
                      <span className="font-bold">{item.quantity}</span>
                      <span className="text-[9px] text-gray-500">{item.unit}</span>
                    </div>
                  </td>
                  <td className="p-1.5 text-left border align-middle font-medium">{formatNumber(item.unitPrice)}</td>
                  <td className="p-1.5 text-left border align-middle font-bold">{formatNumber(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-4">
        <div className="w-56">
          <div className="flex justify-between py-1.5 border-b">
            <span className="text-gray-600 text-[11px]">Total HT:</span>
            <span className="font-medium text-[11px]">{formatCurrency(data.subtotal)}</span>
          </div>
          
          {data.tvaExempt ? (
            <div className="py-2 border-b">
              <p className="text-xs text-gray-500 italic">{data.tvaExemptText}</p>
            </div>
          ) : (
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-gray-600 text-[11px]">TVA ({data.tvaRate}%):</span>
              <span className="font-medium text-[11px]">{formatCurrency(data.tvaAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between py-2 bg-primary text-primary-foreground px-3 rounded-b-lg">
            <span className="font-bold text-[12px]">Total TTC:</span>
            <span className="font-bold text-[14px]">{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Signatures Section (Signature above Stamp) */}
      {(data.artisanSignatureUrl || data.stampUrl) && (
        <div className="border-t-2 border-dashed border-gray-300 pt-4 mt-4">
          <div className="flex justify-end">
            <div className="w-48 text-center">
              <p className="text-[11px] font-medium text-gray-700 mb-0.5">Le prestataire</p>
              <p className="text-[10px] text-gray-500 mb-2">Date: {data.date}</p>

              {data.artisanSignatureUrl && (
                <div className="bg-white border border-gray-200 rounded-lg p-1.5 mb-1">
                  <img src={data.artisanSignatureUrl} alt="Signature du prestataire" className="max-h-16 mx-auto" />
                </div>
              )}

              {data.stampUrl && (
                <div className="bg-white border border-gray-200 rounded-lg p-1.5 mb-1.5">
                  <img src={data.stampUrl} alt="Cachet du prestataire" className="max-h-16 mx-auto" />
                </div>
              )}

              <div className="border-t border-gray-400 pt-0.5">
                <p className="text-[10px] text-gray-500">Signature & Cachet</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer / Legal Mentions */}
      <div className="border-t pt-2 text-[10px] text-gray-500 space-y-1 mt-3">
        <p><strong>Conditions de paiement:</strong> {data.paymentTerms}</p>
        {data.legalMentions && <p>{data.legalMentions}</p>}
        <div className="mt-2 pt-1 border-t border-gray-200">
          <p>En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, 
          ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement (Art. L.441-10 du Code de commerce).</p>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDisplay;
