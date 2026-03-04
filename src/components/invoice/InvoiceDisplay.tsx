import { cn } from '@/lib/utils';

export interface InvoiceData {
  type: string;
  number: string;
  date: string;
  validUntil?: string;
  dueDate?: string;
  emitter: {
    name: string;
    siret: string;
    address: string;
    phone?: string;
    email?: string;
    decennale?: string;
    legalStatus?: string;
    iban?: string;
    bic?: string;
  };
  client: {
    name: string;
    address: string;
    siren?: string;
    phone?: string;
    email?: string;
    tvaIntra?: string;
    isB2B?: boolean;
  };
  workSite?: {
    sameAsClient: boolean;
    address?: string;
  };
  natureOperation?: 'service' | 'goods' | 'mixed';
  assuranceDecennale?: {
    assureurName: string;
    assureurAddress: string;
    policyNumber: string;
    geographicCoverage: string;
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
  paymentDeadline?: string;
  acomptePercent?: number;
  acompteAmount?: number;
  acompteMode?: 'percent' | 'fixed';
  netAPayer?: number;
  legalMentions?: string;
  legalFooter?: string;
  logoUrl?: string;
  artisanSignatureUrl?: string;
  stampUrl?: string;
  sitePhotos?: Array<{ data: string; name: string }>;
}


interface InvoiceDisplayProps {
  data: InvoiceData;
  showArabic: boolean;
}

// Arabic translation dictionary for document terms (visual only, not in PDF)
const AR_LABELS: Record<string, string> = {
  // Table headers
  'Désignation': 'الوصف',
  'Qté/Unité': 'الكمية / الوحدة',
  'P.U (€)': 'سعر الوحدة',
  'Total (€)': 'الإجمالي',
  // Totals
  'Total HT:': 'المجموع بدون ضريبة',
  'Total TTC:': 'المجموع شامل الضريبة',
  // Document types
  'CLIENT': 'الزبون',
  'DEVIS': 'عرض سعر',
  'FACTURE': 'فاتورة',
  // Nature of operation
  'Prestation de services': 'تقديم خدمات',
  'Livraison de biens': 'توريد بضائع',
  'Prestation de services et livraison de biens': 'خدمات وتوريد بضائع',
  // Signature block
  'Conditions de règlement:': 'شروط الدفع:',
  'Le client': 'الزبون',
  'Le prestataire': 'مقدم الخدمة',
  'Bon pour accord': 'موافقة',
  'Date & Signature': 'التاريخ والتوقيع',
  'Signature & Cachet': 'التوقيع والختم',
  // Units (unités)
  'm²': 'متر مربع',
  'ml': 'متر طولي',
  'u': 'وحدة',
  'h': 'ساعة',
  'j': 'يوم',
  'f': 'شامل',
  'forfait': 'مبلغ إجمالي',
  'lot': 'مجموعة',
  'kg': 'كيلوغرام',
  'l': 'لتر',
  // BTP terms (بناء وأشغال عامة)
  'Peinture': 'دهان',
  'Plomberie': 'سباكة',
  'Électricité': 'كهرباء',
  'Maçonnerie': 'بناء',
  'Carrelage': 'بلاط',
  'Menuiserie': 'نجارة',
  'Plâtrerie': 'محارة',
  'Isolation': 'عزل',
  'Démolition': 'هدم',
  'Ravalement': 'ترميم واجهات',
  'Étanchéité': 'عزل مائي',
  'Toiture': 'أسقف',
  'Terrassement': 'حفر وتسوية',
  'Fourniture et pose': 'توريد وتركيب',
  'Main d\'œuvre': 'مصنعية',
  'Dépose': 'فك',
  'Repose': 'إعادة تركيب',
  'Finitions': 'تشطيبات',
  'Sous-traitance': 'مقاولة باطن',
  // Legal mentions (mentions légales)
  'Acompte': 'عربون',
  'Solde à la fin des travaux': 'الباقي عند إتمام الأشغال',
  'Paiement à réception': 'الدفع عند الاستلام',
  'Paiement à 30 jours': 'الدفع خلال 30 يوم',
  'Assurance décennale': 'تأمين عشري',
  'TVA non applicable, art. 293 B du CGI': 'معفى من الضريبة، مادة 293 ب',
  'Garantie décennale': 'ضمان عشري',
  'Retenue de garantie': 'ضمان محجوز',
};

const InvoiceDisplay = ({ data, showArabic }: InvoiceDisplayProps) => {
  const photos = data.sitePhotos || [];
  const totalPhotoPages = photos.length > 0 ? Math.ceil(photos.length / 4) : 0;
  const totalPages = 1 + totalPhotoPages;

  /** Render a French label with optional Arabic subtitle underneath (print:hidden) */
  const ArSub = ({ fr, className }: { fr: string; className?: string }) => (
    <>
      <span className={className}>{fr}</span>
      {showArabic && AR_LABELS[fr] && (
        <span className="block text-[9px] text-muted-foreground/90 font-normal leading-tight print:hidden" dir="rtl" style={{ fontFamily: 'IBM Plex Sans Arabic, Cairo, sans-serif' }}>
          {AR_LABELS[fr]}
        </span>
      )}
    </>
  );

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
    <>
    <div 
      dir="ltr"
      lang="fr"
      className="french-invoice bg-white text-black rounded-lg shadow-lg max-w-2xl mx-auto print:shadow-none select-none"
      style={{
        padding: '1.5cm 1.5cm 2cm 1.5cm',
        boxSizing: 'border-box',
        minHeight: 'auto',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="border-b-2 border-black pb-2 mb-2">
        <div className="flex justify-between items-start">
          <div>
            {data.logoUrl && (
              <img src={data.logoUrl} alt="Logo" className="mb-1 object-contain" style={{ maxHeight: '60px', maxWidth: '120px' }} />
            )}
            <h1 className="text-base font-bold text-black leading-tight">
              {data.emitter.name}
              {(data.emitter.legalStatus === 'auto-entrepreneur' || data.emitter.legalStatus === 'ei') && (
                <span className="text-[9px] font-semibold text-gray-500 ml-1">EI</span>
              )}
            </h1>
            <p className="text-[10px] text-gray-600 whitespace-pre-line leading-snug">{data.emitter.address}</p>
            <p className="text-[10px] text-gray-600">SIRET: {data.emitter.siret}</p>
            {data.emitter.phone && <p className="text-[10px] text-gray-600">Tél: {data.emitter.phone}</p>}
            {data.emitter.email && <p className="text-[10px] text-gray-600">Email: {data.emitter.email}</p>}
            {data.emitter.decennale && (
              <p className="text-[10px] text-gray-600">Assurance Décennale: {data.emitter.decennale}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-black">
              <ArSub fr={data.type} />
            </h2>
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
          {data.type === 'FACTURE' && data.dueDate && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-red-600 font-semibold">📅 Échéance : {data.dueDate}</span>
            </>
          )}
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-gray-50 p-2 rounded border border-gray-200 mb-3">
        <h3 className="font-semibold text-gray-700 text-[10px] mb-0.5"><ArSub fr="CLIENT" /></h3>
        <p className="font-medium text-[11px] leading-tight">{data.client.name}</p>
        <p className="text-[10px] text-gray-600 whitespace-pre-line leading-snug">{data.client.address}</p>
        {data.client.phone && <p className="text-[10px] text-gray-600">Tél: {data.client.phone}</p>}
        {data.client.email && <p className="text-[10px] text-gray-600">Email: {data.client.email}</p>}
        {data.client.siren && (
          <p className="text-[10px] text-gray-600">SIREN: {data.client.siren}</p>
        )}
        {data.client.tvaIntra && (
          <p className="text-[10px] text-gray-600">TVA Intracommunautaire: {data.client.tvaIntra}</p>
        )}
        
        {data.workSite && !data.workSite.sameAsClient && data.workSite.address && (
          <div className="mt-1.5 pt-1.5 border-t border-gray-200">
            <p className="text-[9px] font-semibold text-gray-500 uppercase">📍 Adresse du Chantier</p>
            <p className="text-[10px] text-gray-600 whitespace-pre-line leading-snug">{data.workSite.address}</p>
          </div>
        )}
      </div>

      {/* Nature of Operation */}
      {data.natureOperation && (
        <div className="mb-2 text-[9px] text-gray-600">
          <span className="font-semibold text-gray-700">Nature de l'opération : </span>
          {(() => {
            const label = data.natureOperation === 'service' ? 'Prestation de services' 
              : data.natureOperation === 'goods' ? 'Livraison de biens' 
              : 'Prestation de services et livraison de biens';
            return <ArSub fr={label} />;
          })()}
        </div>
      )}

      {/* Items Table */}
      <div className="mb-3">
        <table className="w-full border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="text-[9px]" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
              <th className="py-1.5 px-1.5 text-left border border-gray-700" style={{ width: '40%', verticalAlign: 'middle' }}><ArSub fr="Désignation" /></th>
              <th className="py-1.5 px-1 text-center border border-gray-700" style={{ width: '15%', verticalAlign: 'middle' }}><ArSub fr="Qté/Unité" /></th>
              <th className="py-1.5 px-1.5 text-left border border-gray-700" style={{ width: '20%', verticalAlign: 'middle' }}><ArSub fr="P.U (€)" /></th>
              <th className="py-1.5 px-1.5 text-left border border-gray-700" style={{ width: '25%', verticalAlign: 'middle' }}><ArSub fr="Total (€)" /></th>
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
                      className={`font-bold leading-tight block whitespace-pre-wrap text-left ${isSection ? 'text-black font-extrabold' : 'text-gray-800'}`}
                    >
                      {item.designation_fr.includes('\n') 
                        ? (
                          <ul className="list-disc list-inside space-y-0.5 ml-0">
                            {item.designation_fr.split('\n').filter(l => l.trim()).map((line, i) => (
                              <li key={i} className="text-[10px] leading-snug font-bold">{line.trim().replace(/^[-•·]\s*/, '')}</li>
                            ))}
                          </ul>
                        )
                        : item.designation_fr}
                    </span>
                    {showArabic && item.designation_ar && (
                      <span className="block text-[9px] text-muted-foreground/90 font-normal mt-0.5 leading-snug print:hidden" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
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
        <div className="w-56">
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span className="text-gray-600 text-[10px]"><ArSub fr="Total HT:" /></span>
            <span className="font-medium text-[10px]">{formatCurrency(data.subtotal)}</span>
          </div>
          
          {data.tvaExempt ? (
            <div className="py-1 border-b border-gray-200 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-600 text-[10px]">TVA (0%):</span>
                <span className="font-medium text-[10px]">{formatCurrency(0)}</span>
              </div>
              <p className="text-[8px] text-gray-500 italic leading-tight">TVA non applicable, art. 293 B du CGI</p>
            </div>
          ) : (
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600 text-[10px]">TVA ({data.tvaRate}%):</span>
              <span className="font-medium text-[10px]">{formatCurrency(data.tvaAmount)}</span>
            </div>
          )}
          
          <div className="flex justify-between py-1.5 px-2.5 rounded-b-lg" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
            <span className="font-bold text-[11px]"><ArSub fr="Total TTC:" /></span>
            <span className="font-bold text-[13px]">{formatCurrency(data.total)}</span>
          </div>

          {/* Acompte Breakdown */}
          {data.acompteAmount && data.acompteAmount > 0 && (
            <div className="mt-1.5 border border-amber-300 rounded-lg overflow-hidden">
              <div className="flex justify-between py-1 px-2 bg-amber-50 border-b border-amber-200">
                <span className="text-amber-700 text-[10px] font-semibold">
                  <ArSub fr="Acompte" /> {data.acomptePercent ? `(${data.acomptePercent}%)` : ''}
                </span>
                <span className="font-bold text-amber-700 text-[10px]">
                  {formatCurrency(data.acompteAmount)}
                </span>
              </div>
              {data.netAPayer !== undefined && (
                <div className="flex justify-between py-1.5 px-2 bg-amber-100">
                  <span className="text-amber-900 text-[10px] font-bold">Net à payer</span>
                  <span className="font-bold text-amber-900 text-[11px]">
                    {formatCurrency(data.netAPayer)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assurance Décennale (BTP) */}
      {data.assuranceDecennale && data.assuranceDecennale.assureurName && (
        <div className="border border-gray-300 bg-gray-50 rounded p-2 mb-3 text-[9px] text-gray-700 space-y-0.5">
          <p className="font-bold text-black text-[10px] mb-1">🛡️ Assurance de responsabilité décennale</p>
          <p>Assurance de responsabilité décennale obligatoire souscrite auprès de :</p>
          <p className="font-semibold">{data.assuranceDecennale.assureurName}</p>
          {data.assuranceDecennale.assureurAddress && (
            <p>{data.assuranceDecennale.assureurAddress}</p>
          )}
          <p>N° de police : <span className="font-mono font-semibold">{data.assuranceDecennale.policyNumber}</span></p>
          <p>Couverture géographique : {data.assuranceDecennale.geographicCoverage}</p>
        </div>
      )}

      {/* Signature & Stamp Section */}
      <div className="border-t border-gray-300 pt-3 mt-2">
        <div className="flex justify-between items-end">
          {/* Client signature space */}
          <div className="w-40 text-center">
            <p className="text-[9px] font-medium text-gray-600 mb-0.5"><ArSub fr="Le client" /></p>
            <p className="text-[8px] text-gray-400 mb-1"><ArSub fr="Bon pour accord" /></p>
            <div className="h-14 border border-dashed border-gray-300 rounded" />
            <p className="text-[8px] text-gray-400 mt-0.5"><ArSub fr="Date & Signature" /></p>
          </div>

          {/* Artisan signature & stamp */}
          <div className="w-44 text-center">
            <p className="text-[9px] font-medium text-gray-600 mb-0.5"><ArSub fr="Le prestataire" /></p>
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

            <p className="text-[8px] text-gray-400 mt-0.5"><ArSub fr="Signature & Cachet" /></p>
          </div>
        </div>
      </div>

      {/* Coordonnées bancaires (IBAN / BIC) */}
      {data.emitter.iban && (
        <div className="border border-gray-200 rounded p-2 mb-3 text-[9px] text-gray-700 space-y-0.5">
          <p className="font-bold text-gray-800 text-[10px] mb-1">🏦 Coordonnées bancaires</p>
          <p>IBAN : <span className="font-mono font-semibold tracking-wider">{data.emitter.iban}</span></p>
          {data.emitter.bic && <p>BIC : <span className="font-mono font-semibold">{data.emitter.bic}</span></p>}
        </div>
      )}

      {/* Footer / Legal Mentions */}
      <div className="border-t border-gray-200 pt-1.5 text-[8px] text-gray-400 space-y-0.5 mt-2">
        <p><strong className="text-gray-500"><ArSub fr="Conditions de règlement:" /></strong> {data.paymentTerms}</p>
        <p><strong className="text-gray-500"><ArSub fr="Paiement à réception" /></strong></p>
        {data.legalMentions && <p>{data.legalMentions}</p>}
        <p className="text-gray-500 font-medium">Indemnité forfaitaire de 40€ pour frais de recouvrement en cas de retard de paiement (Art. L.441-10 et D.441-5 du Code de commerce).</p>
      </div>

      {/* Online Payment Section */}
      {data.type === 'FACTURE' && (
        <div className="mt-3 border border-gray-300 rounded-lg p-3 flex items-center justify-between bg-gray-50">
          <div className="flex-1">
            <p className="text-[10px] font-bold text-gray-700 mb-0.5">💳 Paiement en ligne disponible</p>
            <p className="text-[8px] text-gray-500">Scannez le QR code ou cliquez sur le bouton pour payer cette facture en ligne de manière sécurisée via Stripe.</p>
          </div>
          <div className="flex items-center gap-3 ml-3">
            {/* QR Code placeholder — will be populated with actual payment link */}
            <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-[7px] text-gray-400 text-center leading-tight">
              QR Code
            </div>
            <button
              className="px-4 py-2 rounded-xl text-[10px] font-bold text-white shadow-md print:hidden"
              style={{ background: 'linear-gradient(135deg, #BFA071, #9A7B4F)' }}
              onClick={(e) => {
                e.stopPropagation();
                // Payment link will be injected here
              }}
            >
              Payer en ligne
            </button>
          </div>
        </div>
      )}

      {/* Auto-generated Legal Footer */}
      {data.legalFooter && (
        <div className="mt-3 pt-2 border-t border-gray-300 text-center">
          <p className="text-[7px] text-gray-400 leading-snug">{data.legalFooter}</p>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-3 text-center text-[8px] text-gray-400 font-medium">
        Page 1/{totalPages}
      </div>
    </div>

    {/* Photo Annexe Pages */}
    {photos.length > 0 && Array.from({ length: totalPhotoPages }).map((_, pageIdx) => {
      const pagePhotos = photos.slice(pageIdx * 4, (pageIdx + 1) * 4);
      return (
        <div
          key={`annexe-${pageIdx}`}
          dir="ltr"
          lang="fr"
          className="french-invoice bg-white text-black rounded-lg shadow-lg max-w-2xl mx-auto mt-6 print:shadow-none print:mt-0 select-none"
          style={{
            padding: '1.5cm 1.5cm 2cm 1.5cm',
            boxSizing: 'border-box',
            minHeight: 'auto',
            pageBreakBefore: 'always',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Annexe Header */}
          <div className="border-b-2 border-black pb-2 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-black">{data.emitter.name}</h2>
                <p className="text-[10px] text-gray-600">{data.type} N° {data.number}</p>
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-black">📷 Annexe Photos</h3>
                <p className="text-[9px] text-gray-500">Photos du chantier / des lieux</p>
              </div>
            </div>
          </div>

          {/* Photo Grid - 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            {pagePhotos.map((photo, photoIdx) => (
              <div key={photoIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                <img
                  src={photo.data}
                  alt={photo.name || `Photo ${pageIdx * 4 + photoIdx + 1}`}
                  className="w-full h-48 object-cover"
                  style={{ maxHeight: '200px' }}
                />
                <div className="px-2 py-1 bg-gray-50 border-t border-gray-200">
                  <p className="text-[8px] text-gray-500 truncate">
                    📸 {photo.name || `Photo ${pageIdx * 4 + photoIdx + 1}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-4 text-center text-[8px] text-gray-400 font-medium">
            Page {2 + pageIdx}/{totalPages}
          </div>
        </div>
      );
    })}
    </>
  );
};

export default InvoiceDisplay;
