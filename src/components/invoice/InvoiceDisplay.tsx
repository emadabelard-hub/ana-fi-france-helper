import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
}

interface InvoiceDisplayProps {
  data: InvoiceData;
  showArabic: boolean;
}

const InvoiceDisplay = ({ data, showArabic }: InvoiceDisplayProps) => {
  const { isRTL } = useLanguage();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <div 
      dir="ltr"
      lang="fr"
      className="french-invoice bg-white text-black p-6 rounded-lg shadow-lg max-w-2xl mx-auto print:shadow-none"
    >
      {/* Header */}
      <div className="border-b-2 border-primary pb-4 mb-4">
        <div className="flex justify-between items-start">
          {/* Company Info */}
          <div>
            <h1 className="text-xl font-bold text-primary">{data.emitter.name}</h1>
            <p className="text-sm text-gray-600 whitespace-pre-line">{data.emitter.address}</p>
            <p className="text-sm text-gray-600">SIRET: {data.emitter.siret}</p>
            {data.emitter.phone && <p className="text-sm text-gray-600">Tél: {data.emitter.phone}</p>}
            {data.emitter.email && <p className="text-sm text-gray-600">Email: {data.emitter.email}</p>}
            {data.emitter.decennale && (
              <p className="text-sm text-gray-600">Assurance Décennale: {data.emitter.decennale}</p>
            )}
          </div>
          
          {/* Document Info */}
          <div className="text-right">
            <h2 className="text-2xl font-bold text-primary">{data.type}</h2>
            <p className="text-sm text-gray-600">N° {data.number}</p>
            <p className="text-sm text-gray-600">Date: {data.date}</p>
            {data.validUntil && (
              <p className="text-sm text-gray-600">Valide jusqu'au: {data.validUntil}</p>
            )}
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-muted/30 p-4 rounded-lg mb-6">
        <h3 className="font-semibold text-gray-700 mb-2">CLIENT</h3>
        <p className="font-medium">{data.client.name}</p>
        <p className="text-sm text-gray-600 whitespace-pre-line">{data.client.address}</p>
      </div>

      {/* Items Table */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="p-3 text-left border">Désignation</th>
              <th className="p-3 text-center border w-20">Qté</th>
              <th className="p-3 text-center border w-20">Unité</th>
              <th className="p-3 text-right border w-28">Prix Unit.</th>
              <th className="p-3 text-right border w-28">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="p-3 border">
                  <div>
                    <span className="font-medium">
                      {showArabic ? item.designation_ar : item.designation_fr}
                    </span>
                    {showArabic && (
                      <span className="block text-xs text-gray-500 mt-1">
                        {item.designation_fr}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-center border">{item.quantity}</td>
                <td className="p-3 text-center border">{item.unit}</td>
                <td className="p-3 text-right border">{formatCurrency(item.unitPrice)}</td>
                <td className="p-3 text-right border font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-64">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Total HT:</span>
            <span className="font-medium">{formatCurrency(data.subtotal)}</span>
          </div>
          
          {data.tvaExempt ? (
            <div className="py-2 border-b">
              <p className="text-xs text-gray-500 italic">{data.tvaExemptText}</p>
            </div>
          ) : (
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">TVA ({data.tvaRate}%):</span>
              <span className="font-medium">{formatCurrency(data.tvaAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between py-3 bg-primary text-primary-foreground px-3 rounded-b-lg">
            <span className="font-bold">Total TTC:</span>
            <span className="font-bold text-lg">{formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer / Legal Mentions */}
      <div className="border-t pt-4 text-xs text-gray-500 space-y-2">
        <p><strong>Conditions de paiement:</strong> {data.paymentTerms}</p>
        {data.legalMentions && <p>{data.legalMentions}</p>}
        
        {/* Standard French Invoice Legal Mentions */}
        <div className="mt-4 pt-2 border-t border-gray-200">
          <p>En cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée, 
          ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement (Art. L.441-10 du Code de commerce).</p>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDisplay;
