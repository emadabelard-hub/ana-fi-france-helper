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
  legalFooter?: string;
  logoUrl?: string;
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
      <div className="border-b-2 border-primary pb-2 mb-2">
        <div className="flex justify-between items-start">
          <div>
            {data.logoUrl && (
              <img src={data.logoUrl} alt="Logo" className="mb-1 object-contain" style={{ maxHeight: '60px', maxWidth: '120px' }} />
            )}
            <h1 className="text-base font-bold text-primary leading-tight">{data.emitter.name}</h1>
            <p className="text-[10px] text-gray-600 whitespace-pre-line leading-snug">{data.emitter.address}</p>
            <p className="text-[10px] text-gray-600">SIRET: {data.emitter.siret}</p>
            {data.emitter.phone && <p className="text-[10px] text-gray-600">Tél: {data.emitter.phone}</p>}
            {data.emitter.email && <p className="text-[10px] text-gray-600">Email: {data.emitter.email}</p>}
            {data.emitter.decennale && (
              <p className="text-[10px] text-gray-600">Assurance Décennale: {data.emitter.decennale}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-primary">{data.type}</h2>
            <p className="text-[10px] text-gray-600">N° {data.number}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 text-[8px] font-bold bg-gray-50 p-1.5 rounded border border-gray-200 mt-2">
          <span className="text-gray-500">📅 Émis le : {data.date}</span>
          {data.type === 'DEVIS' && data.validUntil && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-amber-600 font-semibold">⏳ Valide jusqu'au : {data.validUntil}</span>
            </>
          )}
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-gray-50 p-2 rounded border border-gray-200 mb-3">
        <h3 className="font-semibold text-gray-700 text-[10px] mb-0.5">CLIENT</h3>
        <p className="font-medium text-[11px] leading-tight">{data.client.name}</p>
        <p className="text-[10px] text-gray-600 whitespace-pre-line leading-snug">{data.client.address}</p>
        
        {data.workSite && !data.workSite.sameAsClient && data.workSite.address && (
          <div className="mt-1.5 pt-1.5 border-t border-gray-200">
            <p className="text-[9px] font-semibold text-gray-500 uppercase">📍 Adresse du Chantier</p>
            <p className="text-[10px] text-gray-600 whitespace-pre-line leading-snug">{data.workSite.address}</p>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="mb-3">
        <table className="w-full border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-primary text-primary-foreground text-[9px]">
              <th className="py-1.5 px-1.5 text-left border border-primary/30" style={{ width: '40%', verticalAlign: 'middle' }}>Désignation</th>
              <th className="py-1.5 px-1 text-center border border-primary/30" style={{ width: '15%', verticalAlign: 'middle' }}>Qté/Unité</th>
              <th className="py-1.5 px-1.5 text-left border border-primary/30" style={{ width: '20%', verticalAlign: 'middle' }}>P.U (€)</th>
              <th className="py-1.5 px-1.5 text-left border border-primary/30" style={{ width: '25%', verticalAlign: 'middle' }}>Total (€)</th>
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
                    className="py-1 px-1.5 border border-gray-200"
                    style={{ 
                      verticalAlign: 'middle',
                      ...(isSection && index > 0 ? { paddingTop: '24px' } : {})
                    }}
                  >
                    <span 
                      className={`font-medium leading-tight block whitespace-pre-wrap text-left ${isSection ? 'font-bold text-primary' : ''}`}
                    >
                      {item.designation_fr.includes('\n') 
                        ? item.designation_fr.split('\n').filter(l => l.trim()).map((line, i) => (
                            <span key={i} className="block">- {line.trim()}</span>
                          ))
                        : item.designation_fr}
                    </span>
                    {showArabic && item.designation_ar && (
                      <span className="block text-[8px] text-gray-400 mt-0.5 print:hidden" dir="rtl">
                        {item.designation_ar}
                      </span>
                    )}
                  </td>
                  <td className="py-1 px-1 text-center border border-gray-200" style={{ verticalAlign: 'middle' }}>
                    <span className="font-bold block leading-tight">{item.quantity}</span>
                    <span className="text-[8px] text-gray-400 block">{item.unit}</span>
                  </td>
                  <td className="py-1 px-1.5 border border-gray-200 font-medium" style={{ verticalAlign: 'middle' }}>{formatNumber(item.unitPrice)}</td>
                  <td className="py-1 px-1.5 border border-gray-200 font-bold" style={{ verticalAlign: 'middle' }}>{formatNumber(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-3">
        <div className="w-52">
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span className="text-gray-600 text-[10px]">Total HT:</span>
            <span className="font-medium text-[10px]">{formatCurrency(data.subtotal)}</span>
          </div>
          
          {data.tvaExempt ? (
            <div className="py-1 border-b border-gray-200">
              <p className="text-[9px] text-gray-500 italic leading-tight">{data.tvaExemptText}</p>
            </div>
          ) : (
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600 text-[10px]">TVA ({data.tvaRate}%):</span>
              <span className="font-medium text-[10px]">{formatCurrency(data.tvaAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between py-1.5 bg-primary text-primary-foreground px-2.5 rounded-b-lg">
            <span className="font-bold text-[11px]">Total TTC:</span>
            <span className="font-bold text-[13px]">{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Signature & Stamp Section */}
      <div className="border-t border-gray-300 pt-3 mt-2">
        <div className="flex justify-between items-end">
          {/* Client signature space */}
          <div className="w-40 text-center">
            <p className="text-[9px] font-medium text-gray-600 mb-0.5">Le client</p>
            <p className="text-[8px] text-gray-400 mb-1">Bon pour accord</p>
            <div className="h-14 border border-dashed border-gray-300 rounded" />
            <p className="text-[8px] text-gray-400 mt-0.5">Date & Signature</p>
          </div>

          {/* Artisan signature & stamp */}
          <div className="w-44 text-center">
            <p className="text-[9px] font-medium text-gray-600 mb-0.5">Le prestataire</p>
            <p className="text-[8px] text-gray-400 mb-1">Date: {data.date}</p>

            {data.artisanSignatureUrl ? (
              <div className="bg-white border border-gray-200 rounded p-1 mb-0.5">
                <img src={data.artisanSignatureUrl} alt="Signature" className="max-h-12 mx-auto object-contain" />
              </div>
            ) : (
              <div className="h-12 border border-dashed border-gray-300 rounded mb-0.5" />
            )}

            {data.stampUrl ? (
              <div className="bg-white border border-gray-200 rounded p-1" style={{ width: '120px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', marginRight: 'auto' }}>
                <img src={data.stampUrl} alt="Cachet" style={{ maxWidth: '110px', maxHeight: '52px', width: 'auto', height: 'auto', objectFit: 'contain', backgroundColor: 'white' }} />
              </div>
            ) : (
              <div className="h-10 border border-dashed border-gray-300 rounded" />
            )}

            <p className="text-[8px] text-gray-400 mt-0.5">Signature & Cachet</p>
          </div>
        </div>
      </div>

      {/* Footer / Legal Mentions */}
      <div className="border-t border-gray-200 pt-1.5 text-[8px] text-gray-400 space-y-0.5 mt-2">
        <p><strong className="text-gray-500">Conditions de règlement:</strong> {data.paymentTerms}</p>
        {data.legalMentions && <p>{data.legalMentions}</p>}
      </div>

      {/* Auto-generated Legal Footer */}
      {data.legalFooter && (
        <div className="mt-3 pt-2 border-t border-gray-300 text-center">
          <p className="text-[7px] text-gray-400 leading-snug">{data.legalFooter}</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceDisplay;
