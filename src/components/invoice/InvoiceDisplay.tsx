import { cn } from '@/lib/utils';
import DocumentQRCode from './DocumentQRCode';

export interface PaymentMilestone {
  id: string;
  label: string;
  mode: 'percent' | 'fixed';
  percent?: number;
  amount?: number;
  targetDate?: string;
}

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
  descriptionChantier?: string;
  estimatedStartDate?: string;
  estimatedDuration?: string;
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
  paymentMilestones?: PaymentMilestone[];
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
  onConvertToFacture?: () => void;
}

const AR_LABELS: Record<string, string> = {
  'Désignation': 'الوصف',
  'Qté/Unité': 'الكمية / الوحدة',
  'P.U (€)': 'سعر الوحدة',
  'Total (€)': 'الإجمالي',
  'Total HT:': 'المجموع بدون ضريبة',
  'Total TTC:': 'المجموع شامل الضريبة',
  'CLIENT': 'الزبون',
  'DEVIS': 'عرض سعر',
  'FACTURE': 'فاتورة',
  'Prestation de services': 'تقديم خدمات',
  'Livraison de biens': 'توريد بضائع',
  'Prestation de services et livraison de biens': 'خدمات وتوريد بضائع',
  'Conditions de règlement:': 'شروط الدفع:',
  'Le client': 'الزبون',
  'Le prestataire': 'مقدم الخدمة',
  'Bon pour accord': 'موافقة',
  'Date & Signature': 'التاريخ والتوقيع',
  'Signature & Cachet': 'التوقيع والختم',
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
  'Acompte': 'عربون',
  'Solde à la fin des travaux': 'الباقي عند إتمام الأشغال',
  'Paiement à réception': 'الدفع عند الاستلام',
  'Paiement à 30 jours': 'الدفع خلال 30 يوم',
  'Assurance décennale': 'تأمين عشري',
  'TVA non applicable, art. 293 B du CGI': 'معفى من الضريبة، مادة 293 ب',
  'Garantie décennale': 'ضمان عشري',
  'Retenue de garantie': 'ضمان محجوز',
};

const InvoiceDisplay = ({ data, showArabic, onConvertToFacture }: InvoiceDisplayProps) => {
  const photos = data.sitePhotos || [];
  const totalPhotoPages = photos.length > 0 ? Math.ceil(photos.length / 4) : 0;
  const docRef = `${data.type} N° ${data.number}`;

  // ── Dynamic "Objet du devis" based on highest-priced item trade ──
  const dynamicSubject = (() => {
    if (data.descriptionChantier) return data.descriptionChantier;
    if (!data.items || data.items.length === 0) return '';
    const TRADE_KEYWORDS: Record<string, string> = {
      'peinture': 'Travaux de peinture',
      'carrelage': 'Travaux de carrelage',
      'plomberie': 'Travaux de plomberie',
      'électricité': 'Mise aux normes électriques',
      'electri': 'Mise aux normes électriques',
      'maçonnerie': 'Travaux de maçonnerie',
      'démolition': 'Travaux de démolition',
      'isolation': 'Travaux d\'isolation',
      'plâtr': 'Travaux de plâtrerie',
      'menuiserie': 'Travaux de menuiserie',
      'ravalement': 'Ravalement de façade',
      'étanchéité': 'Travaux d\'étanchéité',
      'toiture': 'Travaux de toiture',
      'terrassement': 'Travaux de terrassement',
    };
    const highestItem = [...data.items].sort((a, b) => b.total - a.total)[0];
    const desc = highestItem.designation_fr.toLowerCase();
    for (const [keyword, label] of Object.entries(TRADE_KEYWORDS)) {
      if (desc.includes(keyword)) return label;
    }
    return 'Travaux de rénovation';
  })();

  // ── Assurance décennale info for header & footer ──
  const assurance = data.assuranceDecennale;
  const assuranceHeaderLine = assurance?.assureurName && assurance?.policyNumber
    ? `Assurance Décennale : ${assurance.assureurName} — N° ${assurance.policyNumber}`
    : data.emitter.decennale || '';

  const ArSub = ({ fr, className }: { fr: string; className?: string }) => (
    <>
      <span className={className}>{fr}</span>
      {showArabic && AR_LABELS[fr] && (
        <span className="block text-[8px] text-gray-500 font-normal leading-tight print:hidden" dir="rtl" style={{ fontFamily: 'IBM Plex Sans Arabic, Cairo, sans-serif' }}>
          {AR_LABELS[fr]}
        </span>
      )}
    </>
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatNumber = (amount: number) =>
    amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Common container styles for A4 simulation
  const pageContainerClass = "french-invoice bg-white text-black rounded-lg shadow-lg max-w-2xl mx-auto print:shadow-none print:max-w-none print:rounded-none select-none";
  const pageContainerStyle: React.CSSProperties = {
    padding: '10mm 12mm 16mm 12mm',
    boxSizing: 'border-box',
    minHeight: 'auto',
    fontSize: '9pt',
    lineHeight: '1.4',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  };
  const preventCopy = {
    onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    onCut: (e: React.ClipboardEvent) => e.preventDefault(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return (
    <>
      {/* ===== MAIN DOCUMENT ===== */}
      <div dir="ltr" lang="fr" className={pageContainerClass} style={pageContainerStyle} {...preventCopy}>

        {/* Running footer — fixed to bottom of every printed page */}
        <div className="invoice-print-footer hidden print:block">
          {docRef}
        </div>

        {/* ── HEADER (Page 1 only) ── */}
        <div className="pb-2 mb-2" style={{ borderBottom: '2pt solid #1a1a1a' }}>
          <div className="flex justify-between items-start gap-4">
            {/* Emitter */}
            <div className="flex-1 min-w-0">
              {data.logoUrl && (
                <img src={data.logoUrl} alt="Logo" className="mb-1 object-contain" style={{ maxHeight: '50px', maxWidth: '110px' }} />
              )}
              <h1 className="text-[12pt] font-bold text-black leading-tight">
                {data.emitter.name}
                {(data.emitter.legalStatus === 'auto-entrepreneur' || data.emitter.legalStatus === 'ei') && (
                  <span className="text-[8pt] font-semibold text-gray-500 ml-1">EI</span>
                )}
              </h1>
              <p className="text-[8pt] text-gray-600 font-semibold">SIRET : {data.emitter.siret}</p>
              <p className="text-[8pt] text-gray-600 whitespace-pre-line leading-snug">{data.emitter.address}</p>
              {data.emitter.phone && <p className="text-[8pt] text-gray-600">Tél : {data.emitter.phone}</p>}
              {data.emitter.email && <p className="text-[8pt] text-gray-600">Email : {data.emitter.email}</p>}
              {assuranceHeaderLine && (
                <p className="text-[8pt] text-gray-600">{assuranceHeaderLine}</p>
              )}
            </div>
            {/* Doc title + number + QR */}
            <div className="text-right shrink-0 flex items-start gap-2">
              <div>
                <h2 className="text-[16pt] font-bold text-black leading-none">
                  <ArSub fr={data.type} />
                </h2>
                <p className="text-[9pt] text-gray-600 font-medium mt-0.5">N° {data.number}</p>
              </div>
              <DocumentQRCode
                documentNumber={data.number}
                date={data.date}
                totalTTC={data.total}
                size={54}
              />
            </div>
          </div>

          {/* Date bar — compact */}
          <div className="flex flex-wrap gap-3 text-[7pt] font-semibold bg-gray-50 px-2 py-1 rounded mt-2 border border-gray-200">
            <span className="text-gray-700">📅 Date d'émission : {data.date}</span>
            {data.type === 'DEVIS' && data.validUntil && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-amber-600">⏳ Valide jusqu'au : {data.validUntil}</span>
              </>
            )}
            {data.dueDate && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-red-600">📅 Échéance : {data.dueDate}</span>
              </>
            )}
          </div>
        </div>

        {/* ── CLIENT ── */}
        <div className="bg-gray-50 px-2 py-1.5 rounded border border-gray-200 mb-2">
          <h3 className="font-semibold text-gray-700 text-[8pt] mb-0.5 uppercase tracking-wider"><ArSub fr="CLIENT" /></h3>
          <p className="font-medium text-[9pt] leading-tight">{data.client.name}</p>
          <p className="text-[8pt] text-gray-600 whitespace-pre-line leading-snug">{data.client.address}</p>
          {data.client.phone && <p className="text-[8pt] text-gray-600">Tél : {data.client.phone}</p>}
          {data.client.email && <p className="text-[8pt] text-gray-600">Email : {data.client.email}</p>}
          {data.client.siren && <p className="text-[8pt] text-gray-600">SIREN : {data.client.siren}</p>}
          {/* Show client TVA intra only when emitter is NOT exempt */}
          {data.client.tvaIntra && !data.tvaExempt && <p className="text-[8pt] text-gray-600">TVA Intra : {data.client.tvaIntra}</p>}

          {data.workSite && !data.workSite.sameAsClient && data.workSite.address && (
            <div className="mt-1 pt-1 border-t border-gray-200">
              <p className="text-[7pt] font-semibold text-gray-500 uppercase">📍 Adresse du chantier</p>
              <p className="text-[8pt] text-gray-600 whitespace-pre-line leading-snug">{data.workSite.address}</p>
            </div>
          )}
        </div>

        {/* Nature of Operation */}
        {data.natureOperation && (
          <div className="mb-2 text-[8pt] text-gray-600">
            <span className="font-semibold text-gray-700">Nature de l'opération : </span>
            {(() => {
              const label = data.natureOperation === 'service' ? 'Prestation de services'
                : data.natureOperation === 'goods' ? 'Livraison de biens'
                : 'Prestation de services et livraison de biens';
              return <ArSub fr={label} />;
            })()}
          </div>
        )}

        {/* ── OBJET DU DEVIS / DESCRIPTION DU CHANTIER (Dynamic) ── */}
        {dynamicSubject && (
          <div className="mb-2 px-2 py-1.5 rounded border border-gray-200 bg-gray-50">
            <p className="text-[7pt] font-bold text-gray-700 uppercase tracking-wider mb-0.5">
              {data.type === 'DEVIS' ? '📝 Objet du devis' : '📝 Objet de la facture'}
            </p>
            <p className="text-[8pt] text-gray-700 whitespace-pre-line leading-snug font-semibold">{dynamicSubject}</p>
          </div>
        )}

        {/* ── VALIDITÉ DU DEVIS ── */}
        {data.type === 'DEVIS' && data.validUntil && (
          <div className="mb-2 px-2 py-1 rounded border border-amber-200 bg-amber-50/50">
            <p className="text-[8pt] text-amber-800 font-semibold">
              📅 Ce devis est valable jusqu'au {data.validUntil}.
              {data.estimatedStartDate && <> — Début estimé des travaux : {data.estimatedStartDate}.</>}
              {data.estimatedDuration && <> — Durée estimée : {data.estimatedDuration}.</>}
            </p>
          </div>
        )}

        {/* ── Estimated timeline (Facture or Devis without validUntil) ── */}
        {(data.estimatedStartDate || data.estimatedDuration) && !(data.type === 'DEVIS' && data.validUntil) && (
          <div className="mb-2 px-2 py-1 rounded border border-gray-200 bg-gray-50">
            <p className="text-[8pt] text-gray-700 font-medium">
              {data.estimatedStartDate && <>🚧 Début estimé des travaux : {data.estimatedStartDate}. </>}
              {data.estimatedDuration && <>⏱️ Durée estimée : {data.estimatedDuration}.</>}
            </p>
          </div>
        )}

        {/* ── TABLE DES PRESTATIONS ── */}
        {/* Uses native <table> so thead repeats on every printed page automatically */}
        <table className="w-full border-collapse mb-2" style={{ tableLayout: 'fixed', fontSize: '8pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
              <th className="py-1 px-1.5 text-left border border-gray-700 text-[8pt] font-semibold" style={{ width: '44%' }}><ArSub fr="Désignation" /></th>
              <th className="py-1 px-1 text-center border border-gray-700 text-[8pt] font-semibold" style={{ width: '12%' }}><ArSub fr="Qté/Unité" /></th>
              <th className="py-1 px-1 text-right border border-gray-700 text-[8pt] font-semibold" style={{ width: '20%' }}><ArSub fr="P.U (€)" /></th>
              <th className="py-1 px-1 text-right border border-gray-700 text-[8pt] font-semibold" style={{ width: '24%' }}><ArSub fr="Total (€)" /></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => {
              const isSection = item.designation_fr.toUpperCase().startsWith('ZONE') ||
                item.unit.toLowerCase() === 'forfait' ||
                item.unit.toLowerCase() === 'f';

              return (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td
                    className="py-0.5 px-1.5 border border-gray-200"
                    style={{ verticalAlign: 'top', ...(isSection && index > 0 ? { paddingTop: '14px' } : {}) }}
                  >
                    <span className={`font-semibold leading-snug block whitespace-pre-wrap text-left ${isSection ? 'text-black font-bold' : 'text-gray-800'}`}>
                      {item.designation_fr.includes('\n')
                        ? (
                          <ul className="list-disc list-inside space-y-0 ml-0">
                            {item.designation_fr.split('\n').filter(l => l.trim()).map((line, i) => (
                              <li key={i} className="text-[8pt] leading-snug font-semibold">{line.trim().replace(/^[-•·]\s*/, '')}</li>
                            ))}
                          </ul>
                        )
                        : item.designation_fr}
                    </span>
                    {showArabic && item.designation_ar && (
                      <span className="block text-[7pt] text-gray-400 mt-0.5 leading-snug print:hidden" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
                        {item.designation_ar}
                      </span>
                    )}
                  </td>
                  <td className="py-0.5 px-1 text-center border border-gray-200" style={{ verticalAlign: 'middle' }}>
                    <span className="font-semibold block leading-tight">{item.quantity}</span>
                    <span className="text-[7pt] text-gray-400 block">{item.unit}</span>
                  </td>
                  <td className="py-0.5 px-1 text-right border border-gray-200 font-medium" style={{ verticalAlign: 'middle' }}>{formatNumber(item.unitPrice)}</td>
                  <td className="py-0.5 px-1 text-right border border-gray-200 font-bold" style={{ verticalAlign: 'middle' }}>{formatNumber(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── TOTALS + SIGNATURE + LEGAL — Never split across pages ── */}
        <div className="invoice-totals-signature-block" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>

          {/* Totals row: schedule left, amounts right */}
          <div className="flex justify-between items-start mb-2 gap-4">
            {/* Payment Schedule (compact, left side) */}
            {data.paymentMilestones && data.paymentMilestones.length > 0 && (
              <div className="flex-1 max-w-[50%]">
                <p className="text-[7pt] font-bold text-black mb-0.5">📅 Échéancier de paiement</p>
                {data.paymentMilestones.map((m) => {
                  const milestoneAmount = m.mode === 'percent'
                    ? Math.round(data.total * (m.percent || 0) / 100 * 100) / 100
                    : (m.amount || 0);
                  const milestonePercent = m.mode === 'percent'
                    ? (m.percent || 0)
                    : Math.round((m.amount || 0) / data.total * 100 * 10) / 10;
                  return (
                    <div key={m.id} className="flex justify-between text-[7pt] py-0.5 border-b border-gray-100">
                      <span className="text-gray-700 font-medium truncate mr-2">{m.label}</span>
                      <span className="font-mono text-gray-600 whitespace-nowrap">{milestonePercent}% — {formatCurrency(milestoneAmount)}</span>
                    </div>
                  );
                })}
                {(() => {
                  const first = data.paymentMilestones[0];
                  const firstAmt = first.mode === 'percent'
                    ? Math.round(data.total * (first.percent || 0) / 100 * 100) / 100
                    : (first.amount || 0);
                  return (
                    <div className="mt-1 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                      <div className="flex justify-between text-[8pt]">
                        <span className="text-amber-900 font-bold">Net à payer (ét.1)</span>
                        <span className="font-bold text-amber-900 font-mono">{formatCurrency(firstAmt)}</span>
                      </div>
                      <div className="flex justify-between text-[7pt] text-amber-600">
                        <span>Restant</span>
                        <span className="font-mono">{formatCurrency(Math.round((data.total - firstAmt) * 100) / 100)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Totals block */}
            <div className="w-48 ml-auto">
              <div className="flex justify-between py-0.5 border-b border-gray-200">
                <span className="text-gray-600 text-[8pt]"><ArSub fr="Total HT:" /></span>
                <span className="font-medium text-[8pt]">{formatCurrency(data.subtotal)}</span>
              </div>
              {data.tvaExempt ? (
                <div className="py-0.5 border-b border-gray-200 space-y-0">
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-[8pt]">TVA (0%) :</span>
                    <span className="font-medium text-[8pt]">{formatCurrency(0)}</span>
                  </div>
                  <p className="text-[7pt] text-gray-500 italic leading-tight">TVA non applicable, art. 293 B du CGI</p>
                </div>
              ) : (
                <div className="flex justify-between py-0.5 border-b border-gray-200">
                  <span className="text-gray-600 text-[8pt]">TVA ({data.tvaRate}%) :</span>
                  <span className="font-medium text-[8pt]">{formatCurrency(data.tvaAmount)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 px-2 rounded-b" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                <span className="font-bold text-[9pt]"><ArSub fr="Total TTC:" /></span>
                <span className="font-bold text-[11pt]">{formatCurrency(data.total)}</span>
              </div>

              {/* Simple acompte (no milestones) */}
              {data.acompteAmount && data.acompteAmount > 0 && (!data.paymentMilestones || data.paymentMilestones.length === 0) && (
                <div className="mt-1 border border-amber-300 rounded overflow-hidden">
                  <div className="flex justify-between py-0.5 px-2 bg-amber-50 border-b border-amber-200">
                    <span className="text-amber-700 text-[8pt] font-semibold">
                      <ArSub fr="Acompte" /> {data.acomptePercent ? `(${data.acomptePercent}%)` : ''}
                    </span>
                    <span className="font-bold text-amber-700 text-[8pt]">{formatCurrency(data.acompteAmount)}</span>
                  </div>
                  {data.netAPayer !== undefined && (
                    <div className="flex justify-between py-1 px-2 bg-amber-100">
                      <span className="text-amber-900 text-[8pt] font-bold">Net à payer</span>
                      <span className="font-bold text-amber-900 text-[9pt]">{formatCurrency(data.netAPayer)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── ACCEPTANCE & SIGNATURE BLOCK ── */}
          <div className="border-t-2 border-gray-800 pt-3 mt-2">
            <h4 className="text-[9pt] font-bold text-black text-center mb-2 uppercase tracking-wider">
              {data.type === 'DEVIS' ? 'Acceptation du devis' : 'Acceptation de la facture'}
            </h4>
            <p className="text-[7pt] text-gray-600 text-center mb-2 italic leading-snug">
              {data.type === 'DEVIS' 
                ? 'Le client déclare avoir pris connaissance des conditions ci-dessus et accepte le présent devis.'
                : 'Le client déclare avoir pris connaissance de la présente facture.'}
            </p>
            <p className="text-[8pt] text-gray-700 text-center mb-3 font-semibold">
              Mention manuscrite : « <span className="italic">Bon pour accord</span> »
            </p>
            
            <div className="flex justify-between items-start gap-4">
              {/* Client acceptance */}
              <div className="flex-1 border border-gray-300 rounded-lg p-2">
                <p className="text-[8pt] font-bold text-gray-700 mb-1 text-center"><ArSub fr="Le client" /></p>
                <p className="text-[8pt] text-gray-800 mb-2" dir="ltr" lang="fr" style={{ direction: 'ltr', textAlign: 'left' }}>
                  Bon pour accord, date et lieu : ....................................................
                </p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <p className="text-[7pt] text-gray-500 mb-0.5">Nom :</p>
                    <div className="h-4 border-b border-dotted border-gray-300" />
                  </div>
                  <div>
                    <p className="text-[7pt] text-gray-500 mb-0.5">Date :</p>
                    <div className="h-4 border-b border-dotted border-gray-300" />
                  </div>
                </div>
                <p className="text-[7pt] text-gray-500 mb-0.5">Signature :</p>
                <div className="h-14 border border-dashed border-gray-300 rounded" />
              </div>
              
              {/* Artisan signature & stamp */}
              <div className="w-40 text-center">
                <p className="text-[8pt] font-bold text-gray-700 mb-1"><ArSub fr="Le prestataire" /></p>
                <p className="text-[7pt] text-gray-500 mb-0.5">Date : {data.date}</p>
                {data.artisanSignatureUrl ? (
                  <div className="bg-white border border-gray-200 rounded p-0.5 mb-0.5">
                    <img src={data.artisanSignatureUrl} alt="Signature" className="max-h-10 mx-auto object-contain" />
                  </div>
                ) : (
                  <div className="h-10 border border-dashed border-gray-300 rounded mb-0.5" />
                )}
                {data.stampUrl ? (
                  <div className="bg-white border border-gray-200 rounded p-0.5 mx-auto" style={{ width: '100px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={data.stampUrl} alt="Cachet" style={{ maxWidth: '90px', maxHeight: '44px', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div className="h-8 border border-dashed border-gray-300 rounded" />
                )}
                <p className="text-[7pt] text-gray-400 mt-0.5"><ArSub fr="Signature & Cachet" /></p>
              </div>
            </div>
          </div>


          {/* ── PAYMENT CONDITIONS & LEGAL ── */}
          <div className="invoice-footer-block border-t border-gray-200 pt-1 mt-2 text-[7pt] text-gray-500 space-y-0.5">
            <p><strong className="text-gray-600"><ArSub fr="Conditions de règlement:" /></strong> {data.paymentTerms}</p>
            {data.paymentDeadline === 'immediate' && (
              <p><strong className="text-gray-600">Paiement à réception</strong></p>
            )}
            {data.legalMentions && <p>{data.legalMentions}</p>}
            <p className="text-gray-500">Indemnité forfaitaire de 40 € pour frais de recouvrement en cas de retard de paiement (Art. L.441-10 et D.441-5 du Code de commerce).</p>
          </div>
        </div>{/* end invoice-totals-signature-block */}

        {/* Online Payment Section */}
        {(data.type === 'FACTURE' || data.paymentDeadline === 'immediate') && (
          <div className={cn(
            "border rounded px-2 py-1.5 mt-2 flex items-center gap-2 print:hidden",
            data.paymentDeadline === 'immediate'
              ? "border-amber-300 bg-amber-50"
              : "border-gray-200 bg-gray-50"
          )}>
            <div className="flex-1 min-w-0">
              <p className="text-[8pt] font-bold text-gray-700">
                {data.paymentDeadline === 'immediate' ? '⚡ Paiement immédiat' : '💳 Paiement en ligne'}
              </p>
              <p className="text-[7pt] text-gray-500 leading-tight">Scannez le QR code pour payer en ligne.</p>
            </div>
            <div className="w-10 h-10 border border-dashed border-gray-300 rounded flex items-center justify-center text-[6pt] text-gray-400 text-center leading-tight shrink-0">QR</div>
            <button className="px-3 py-1 rounded-lg text-[8pt] font-bold text-white shadow-sm shrink-0" style={{ background: 'linear-gradient(135deg, #BFA071, #9A7B4F)' }} onClick={(e) => e.stopPropagation()}>Payer</button>
          </div>
        )}

        {/* Convert to Facture button */}
        {data.type === 'DEVIS' && onConvertToFacture && (
          <div className="mt-2 print:hidden">
            <button
              onClick={(e) => { e.stopPropagation(); onConvertToFacture(); }}
              className="w-full py-2 rounded-xl text-[10pt] font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              🔄 Convertir ce devis en facture
            </button>
          </div>
        )}

        {/* Auto-generated Legal Footer with IBAN — single line */}
        {(data.legalFooter || data.emitter.iban || assuranceHeaderLine) && (
          <div className="invoice-footer-block mt-2 pt-1.5 border-t border-gray-300 text-center" style={{ pageBreakInside: 'avoid' }}>
            {data.legalFooter && <p className="text-[6pt] text-gray-400 leading-snug whitespace-pre-line">{data.legalFooter}</p>}
            {data.emitter.iban && (
              <p className="text-[7pt] text-gray-500 mt-0.5">
                🏦 IBAN : <span className="font-mono font-semibold tracking-wider">{data.emitter.iban}</span>
                {data.emitter.bic && <> — BIC : <span className="font-mono font-semibold">{data.emitter.bic}</span></>}
              </p>
            )}
            {/* Fixed legal compliance footer — 8pt */}
            <p className="text-[8pt] text-gray-500 mt-1 leading-snug">
              {assuranceHeaderLine
                ? `${assuranceHeaderLine} — Zone : ${assurance?.geographicCoverage || 'France Métropolitaine'}.`
                : 'Assurance Décennale souscrite pour la zone France Métropolitaine.'}
              {data.type === 'DEVIS' && ' Validité du devis : 30 jours.'}
            </p>
          </div>
        )}

        {/* Page reference (screen only — print uses the running footer) */}
        <div className="mt-2 text-center text-[7pt] text-gray-400 font-medium print:hidden">
          {docRef}
        </div>
      </div>

      {/* ===== ANNEXE PAGES — Site Photos ===== */}
      {photos.length > 0 && Array.from({ length: totalPhotoPages }).map((_, pageIdx) => {
        const pagePhotos = photos.slice(pageIdx * 4, (pageIdx + 1) * 4);
        return (
          <div
            key={`annexe-${pageIdx}`}
            dir="ltr"
            lang="fr"
            className={cn(pageContainerClass, "invoice-annexe-page mt-6 print:mt-0")}
            style={{ ...pageContainerStyle, pageBreakBefore: 'always' }}
            {...preventCopy}
          >
            {/* Running footer for annexe pages too */}
            <div className="invoice-print-footer hidden print:block">
              {docRef} — Annexe
            </div>

            {/* Annexe Header */}
            <div className="pb-2 mb-3" style={{ borderBottom: '2pt solid #1a1a1a' }}>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-[11pt] font-bold text-black">{data.emitter.name}</h2>
                  <p className="text-[8pt] text-gray-600">{docRef} — {data.date}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-[10pt] font-bold text-black">📷 Annexe — Photos du chantier</h3>
                </div>
              </div>
            </div>

            {/* Photo Grid 2×2 */}
            <div className="grid grid-cols-2 gap-2">
              {pagePhotos.map((photo, photoIdx) => (
                <div key={photoIdx} className="border border-gray-200 rounded overflow-hidden">
                  <img
                    src={photo.data}
                    alt={photo.name || `Photo ${pageIdx * 4 + photoIdx + 1}`}
                    className="w-full object-cover"
                    style={{ height: '180px' }}
                  />
                  <div className="px-1.5 py-0.5 bg-gray-50 border-t border-gray-200">
                    <p className="text-[7pt] text-gray-500 truncate">📸 {photo.name || `Photo ${pageIdx * 4 + photoIdx + 1}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default InvoiceDisplay;
