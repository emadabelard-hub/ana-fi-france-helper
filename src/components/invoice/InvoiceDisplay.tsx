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
  'Qté': 'الكمية',
  'Unité': 'الوحدة',
  'P.U HT': 'سعر الوحدة',
  'Total HT': 'الإجمالي',
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

  const assurance = data.assuranceDecennale;
  const assuranceHeaderLine = assurance?.assureurName && assurance?.policyNumber
    ? `Assurance Décennale : ${assurance.assureurName} — N° ${assurance.policyNumber}`
    : data.emitter.decennale || '';

  const ArSub = ({ fr, className }: { fr: string; className?: string }) => (
    <>
      <span className={className}>{fr}</span>
      {showArabic && AR_LABELS[fr] && (
        <span className="block text-[7px] text-gray-400 font-normal leading-tight print:hidden" dir="rtl" style={{ fontFamily: 'IBM Plex Sans Arabic, Cairo, sans-serif' }}>
          {AR_LABELS[fr]}
        </span>
      )}
    </>
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatNumber = (amount: number) =>
    amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pageContainerClass = "french-invoice bg-white text-gray-900 rounded-lg shadow-lg max-w-2xl mx-auto print:shadow-none print:max-w-none print:rounded-none select-none";
  const pageContainerStyle: React.CSSProperties = {
    padding: '10mm 12mm 14mm 12mm',
    boxSizing: 'border-box',
    minHeight: 'auto',
    fontSize: '9pt',
    lineHeight: '1.5',
    fontFamily: 'Arial, "Helvetica Neue", sans-serif',
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

        {/* ── HEADER — Clean, no borders ── */}
        <div className="flex justify-between items-start mb-6">
          {/* Left: Logo + Company */}
          <div className="flex-1 min-w-0">
            {data.logoUrl && (
              <img src={data.logoUrl} alt="Logo" className="mb-2 object-contain" style={{ maxHeight: '44px', maxWidth: '120px' }} />
            )}
            <h1 className="text-[13pt] font-bold text-gray-900 leading-tight tracking-tight">
              {data.emitter.name}
              {(data.emitter.legalStatus === 'auto-entrepreneur' || data.emitter.legalStatus === 'ei') && (
                <span className="text-[8pt] font-medium text-gray-400 ml-1.5">EI</span>
              )}
            </h1>
            <p className="text-[8pt] text-gray-500 mt-0.5">SIRET : {data.emitter.siret}</p>
            <p className="text-[8pt] text-gray-500 whitespace-pre-line leading-snug">{data.emitter.address}</p>
            {data.emitter.phone && <p className="text-[8pt] text-gray-500">Tél : {data.emitter.phone}</p>}
            {data.emitter.email && <p className="text-[8pt] text-gray-500">{data.emitter.email}</p>}
            {assuranceHeaderLine && (
              <p className="text-[7pt] text-gray-500 mt-1 font-medium">{assuranceHeaderLine}</p>
            )}
          </div>

          {/* Right: Document type + QR */}
          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
            <div>
              <h2 className="text-[22pt] font-extrabold text-gray-900 leading-none tracking-tight">
                <ArSub fr={data.type} />
              </h2>
              <p className="text-[9pt] text-gray-500 mt-0.5">N° {data.number}</p>
            </div>
            <DocumentQRCode
              documentNumber={data.number}
              date={data.date}
              totalTTC={data.total}
              size={50}
            />
          </div>
        </div>

        {/* ── COMPANY & CLIENT — 2-column, no boxes ── */}
        <div className="flex justify-between gap-6 mb-4">
          {/* Dates */}
          <div className="flex-1">
            <div className="text-[8pt] text-gray-500 space-y-0.5">
              <p>Date d'émission : <span className="text-gray-700 font-medium">{data.date}</span></p>
              {data.type === 'DEVIS' && data.validUntil && (
                <p>Valable jusqu'au : <span className="text-gray-700 font-medium">{data.validUntil}</span></p>
              )}
              {data.dueDate && (
                <p>Échéance : <span className="text-gray-700 font-medium">{data.dueDate}</span></p>
              )}
              {data.estimatedStartDate && (
                <p>Début estimé : <span className="text-gray-700 font-medium">{data.estimatedStartDate}</span></p>
              )}
              {data.estimatedDuration && (
                <p>Durée estimée : <span className="text-gray-700 font-medium">{data.estimatedDuration}</span></p>
              )}
            </div>
          </div>

          {/* Client info — right aligned */}
          <div className="w-[45%] text-left">
            <p className="text-[7pt] font-semibold text-gray-400 uppercase tracking-widest mb-1"><ArSub fr="CLIENT" /></p>
            <p className="text-[10pt] font-bold text-gray-900 leading-tight">{data.client.name}</p>
            <p className="text-[8pt] text-gray-500 whitespace-pre-line leading-snug mt-0.5">{data.client.address}</p>
            {data.client.phone && <p className="text-[8pt] text-gray-500">Tél : {data.client.phone}</p>}
            {data.client.email && <p className="text-[8pt] text-gray-500">{data.client.email}</p>}
            {data.client.siren && <p className="text-[8pt] text-gray-500">SIREN : {data.client.siren}</p>}
            {data.client.tvaIntra && !data.tvaExempt && <p className="text-[8pt] text-gray-500">TVA Intra : {data.client.tvaIntra}</p>}
            {data.workSite && !data.workSite.sameAsClient && data.workSite.address && (
              <div className="mt-1.5">
                <p className="text-[7pt] font-semibold text-gray-400 uppercase">Adresse du chantier</p>
                <p className="text-[8pt] text-gray-500 whitespace-pre-line leading-snug">{data.workSite.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── OBJET + NATURE — simple text + thin divider ── */}
        <div className="mb-4">
          {data.natureOperation && (
            <p className="text-[8pt] text-gray-500 mb-0.5">
              Nature de l'opération : <span className="text-gray-700 font-medium">
                {data.natureOperation === 'service' ? 'Prestation de services'
                  : data.natureOperation === 'goods' ? 'Livraison de biens'
                  : 'Prestation de services et livraison de biens'}
              </span>
            </p>
          )}
          {dynamicSubject && (
            <p className="text-[10pt] font-bold text-gray-900">
              {data.type === 'DEVIS' ? 'Objet : ' : 'Objet : '}
              <span>{dynamicSubject}</span>
            </p>
          )}
          <div className="mt-2" style={{ borderBottom: '1px solid #e5e7eb' }} />
        </div>

        {/* ── TABLE DES PRESTATIONS ── */}
        <table className="w-full border-collapse mb-8" style={{ tableLayout: 'fixed', fontSize: '8.5pt' }}>
          <colgroup>
            <col style={{ width: '55%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead style={{ display: 'table-header-group' }}>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th className="py-2.5 px-3 text-left text-[8pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="Désignation" />
              </th>
              <th className="py-2.5 px-1 text-center text-[8pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="Qté" />
              </th>
              <th className="py-2.5 px-1 text-center text-[8pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="Unité" />
              </th>
              <th className="py-2.5 px-2.5 text-right text-[8pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="P.U HT" />
              </th>
              <th className="py-2.5 px-2.5 text-right text-[8pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="Total HT" />
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => {
              const designLower = item.designation_fr.toLowerCase();
              const isSectionTitle = item.designation_fr.toUpperCase().startsWith('ZONE') ||
                ['fourniture et pose', 'main d\'œuvre', 'dépose', 'repose', 'finitions', 'sous-traitance',
                 'peinture', 'plomberie', 'électricité', 'maçonnerie', 'carrelage', 'menuiserie',
                 'plâtrerie', 'isolation', 'démolition', 'ravalement', 'étanchéité', 'toiture', 'terrassement']
                  .some(kw => designLower.startsWith(kw)) ||
                (item.quantity === 0 && item.unitPrice === 0);

              return (
                <tr
                  key={index}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                  }}
                >
                  <td
                    className="py-2 px-3"
                    style={{
                      verticalAlign: 'top',
                      whiteSpace: 'normal',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      overflow: 'hidden',
                      borderBottom: '1px solid #f0f0f0',
                      ...(isSectionTitle && index > 0 ? { paddingTop: '14px' } : {}),
                    }}
                  >
                    {isSectionTitle ? (
                      <span className="block text-left text-[9pt] font-bold text-gray-900 uppercase tracking-wide leading-snug">
                        {item.designation_fr}
                      </span>
                    ) : (
                      <span className="leading-snug block text-left text-gray-700">
                        {item.designation_fr.includes('\n')
                          ? (
                            <ul className="list-disc list-inside space-y-0 ml-0">
                              {item.designation_fr.split('\n').filter(l => l.trim()).map((line, i) => (
                                <li key={i} className="text-[8pt] leading-snug">{line.trim().replace(/^[-•·]\s*/, '')}</li>
                              ))}
                            </ul>
                          )
                          : item.designation_fr}
                      </span>
                    )}
                    {showArabic && item.designation_ar && (
                      <span className="block text-[7pt] text-gray-400 mt-0.5 leading-snug print:hidden" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
                        {item.designation_ar}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-1 text-center text-gray-700" style={{ verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' }}>
                    {item.quantity}
                  </td>
                  <td className="py-2 px-1 text-center text-[7.5pt] text-gray-500" style={{ verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' }}>
                    {item.unit}
                  </td>
                  <td className="py-2 px-2.5 text-right text-gray-700 tabular-nums" style={{ verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' }}>
                    {formatNumber(item.unitPrice)} €
                  </td>
                  <td className="py-2 px-2.5 text-right font-semibold text-gray-900 tabular-nums" style={{ verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' }}>
                    {formatNumber(item.total)} €
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── TOTALS + SIGNATURE + LEGAL — Never split across pages ── */}
        {/* ── TOTALS + SIGNATURE + LEGAL — Never split across pages ── */}
        <div className="invoice-totals-signature-block" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>

          {/* Totals row: schedule left, amounts right */}
          <div className="flex justify-between items-start mb-8 gap-6 mt-4">
            {/* Payment Schedule (compact, left side) */}
            {data.paymentMilestones && data.paymentMilestones.length > 0 && (
              <div className="flex-1 max-w-[48%]">
                <p className="text-[8pt] font-bold text-gray-700 mb-2">Échéancier de paiement</p>
                <ul className="space-y-1">
                  {data.paymentMilestones.map((m) => {
                    const milestoneAmount = m.mode === 'percent'
                      ? Math.round(data.total * (m.percent || 0) / 100 * 100) / 100
                      : (m.amount || 0);
                    const milestonePercent = m.mode === 'percent'
                      ? (m.percent || 0)
                      : Math.round((m.amount || 0) / data.total * 100 * 10) / 10;
                    return (
                      <li key={m.id} className="flex justify-between text-[8pt] py-1" style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <span className="text-gray-600 truncate mr-2">• {m.label}</span>
                        <span className="text-gray-700 whitespace-nowrap font-medium">{milestonePercent}% — {formatCurrency(milestoneAmount)}</span>
                      </li>
                    );
                  })}
                </ul>
                {(() => {
                  const first = data.paymentMilestones[0];
                  const firstAmt = first.mode === 'percent'
                    ? Math.round(data.total * (first.percent || 0) / 100 * 100) / 100
                    : (first.amount || 0);
                  return (
                    <div className="mt-3 rounded-md px-3 py-2" style={{ backgroundColor: '#f5f5f5', border: '1px solid #e5e5e5' }}>
                      <div className="flex justify-between text-[8.5pt]">
                        <span className="text-gray-700 font-bold">Net à payer (ét.1)</span>
                        <span className="font-bold text-gray-900">{formatCurrency(firstAmt)}</span>
                      </div>
                      <div className="flex justify-between text-[7pt] text-gray-500 mt-1">
                        <span>Restant</span>
                        <span>{formatCurrency(Math.round((data.total - firstAmt) * 100) / 100)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Totals block — right aligned */}
            <div className="w-56 ml-auto">
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <span className="text-gray-500 text-[8.5pt]"><ArSub fr="Total HT:" /></span>
                <span className="text-gray-800 text-[9pt] font-medium">{formatCurrency(data.subtotal)}</span>
              </div>
              {data.tvaExempt ? (
                <div className="py-2" style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-[8.5pt]">TVA (0%) :</span>
                    <span className="text-gray-800 text-[9pt] font-medium">{formatCurrency(0)}</span>
                  </div>
                  <p className="text-[7pt] text-gray-400 italic leading-tight mt-0.5">TVA non applicable, art. 293 B du CGI</p>
                </div>
              ) : (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <span className="text-gray-500 text-[8.5pt]">TVA ({data.tvaRate}%) :</span>
                  <span className="text-gray-800 text-[9pt] font-medium">{formatCurrency(data.tvaAmount)}</span>
                </div>
              )}
              {/* Thin divider before TTC */}
              <div style={{ borderBottom: '2px solid #d1d5db', margin: '4px 0' }} />
              {/* TTC — clean highlight */}
              <div className="flex justify-between items-center py-2.5 px-3 rounded-md" style={{ backgroundColor: '#f3f4f6' }}>
                <span className="font-bold text-[10pt] text-gray-900"><ArSub fr="Total TTC:" /></span>
                <span className="font-extrabold text-[14pt] text-gray-900">{formatCurrency(data.total)}</span>
              </div>

              {/* Simple acompte (no milestones) */}
              {data.acompteAmount && data.acompteAmount > 0 && (!data.paymentMilestones || data.paymentMilestones.length === 0) && (
                <div className="mt-3 rounded-md overflow-hidden" style={{ border: '1px solid #e5e5e5' }}>
                  <div className="flex justify-between py-1.5 px-3" style={{ backgroundColor: '#f5f5f5' }}>
                    <span className="text-gray-600 text-[8pt] font-semibold">
                      <ArSub fr="Acompte" /> {data.acomptePercent ? `(${data.acomptePercent}%)` : ''}
                    </span>
                    <span className="font-bold text-gray-700 text-[8pt]">{formatCurrency(data.acompteAmount)}</span>
                  </div>
                  {data.netAPayer !== undefined && (
                    <div className="flex justify-between py-2 px-3" style={{ backgroundColor: '#efefef' }}>
                      <span className="text-gray-800 text-[9pt] font-bold">Net à payer</span>
                      <span className="font-bold text-gray-900 text-[11pt]">{formatCurrency(data.netAPayer)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── PAYMENT CONDITIONS — bullet points, clean ── */}
          <div className="mb-6 mt-2 text-[8pt] text-gray-500">
            <p className="text-gray-600 font-semibold mb-2"><ArSub fr="Conditions de règlement:" /></p>
            <ul className="space-y-1.5 ml-1">
              <li>• {data.paymentTerms}</li>
              {data.paymentDeadline === 'immediate' && (
                <li className="text-gray-600 font-medium">• Paiement à réception de la facture.</li>
              )}
              {data.legalMentions && <li>• {data.legalMentions}</li>}
              <li className="text-gray-400 text-[7pt]">• Indemnité forfaitaire de 40 € pour frais de recouvrement en cas de retard (Art. L.441-10 du Code de commerce).</li>
            </ul>
          </div>

          {/* ── ACCEPTANCE & SIGNATURE — compact horizontal layout ── */}
          <div className="pt-5 mt-3" style={{ borderTop: '1px solid #e5e7eb' }}>
            <h4 className="text-[8.5pt] font-bold text-gray-700 text-center mb-1.5">
              {data.type === 'DEVIS' ? 'Acceptation du devis' : 'Acceptation de la facture'}
            </h4>
            <p className="text-[7pt] text-gray-400 text-center mb-1 italic leading-snug">
              {data.type === 'DEVIS'
                ? 'Le client déclare avoir pris connaissance des conditions ci-dessus et accepte le présent devis.'
                : 'Le client déclare avoir pris connaissance de la présente facture.'}
            </p>
            <p className="text-[7.5pt] text-gray-500 text-center mb-3">
              Mention manuscrite : « <span className="italic font-medium">Bon pour accord</span> »
            </p>

            <div className="flex justify-between items-start gap-4">
              {/* Client acceptance */}
              <div className="flex-1 rounded p-2.5" style={{ border: '1px solid #e8e8e8' }}>
                <p className="text-[7.5pt] font-bold text-gray-500 mb-1 text-center"><ArSub fr="Le client" /></p>
                <div className="grid grid-cols-2 gap-2 mb-1.5">
                  <div>
                    <p className="text-[6.5pt] text-gray-400 mb-0.5">Nom :</p>
                    <div className="h-3.5" style={{ borderBottom: '1px dotted #d1d5db' }} />
                  </div>
                  <div>
                    <p className="text-[6.5pt] text-gray-400 mb-0.5">Date :</p>
                    <div className="h-3.5" style={{ borderBottom: '1px dotted #d1d5db' }} />
                  </div>
                </div>
                <p className="text-[6.5pt] text-gray-400 mb-0.5">Signature :</p>
                <div className="h-10 rounded" style={{ border: '1px dashed #d5d5d5' }} />
              </div>

              {/* Artisan signature & stamp — smaller */}
              <div className="w-32 text-center">
                <p className="text-[7.5pt] font-bold text-gray-500 mb-1"><ArSub fr="Le prestataire" /></p>
                <p className="text-[6.5pt] text-gray-400 mb-1">Date : {data.date}</p>
                {data.artisanSignatureUrl ? (
                  <div className="rounded p-0.5 mb-1" style={{ border: '1px solid #e8e8e8' }}>
                    <img src={data.artisanSignatureUrl} alt="Signature" className="max-h-8 mx-auto object-contain" />
                  </div>
                ) : (
                  <div className="h-8 rounded mb-1" style={{ border: '1px dashed #d5d5d5' }} />
                )}
                {data.stampUrl ? (
                  <div className="rounded p-0.5 mx-auto" style={{ border: '1px solid #e8e8e8', width: '80px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={data.stampUrl} alt="Cachet" style={{ maxWidth: '72px', maxHeight: '35px', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div className="h-7 rounded" style={{ border: '1px dashed #d5d5d5' }} />
                )}
                <p className="text-[6pt] text-gray-400 mt-0.5"><ArSub fr="Signature & Cachet" /></p>
              </div>
            </div>
          </div>

        </div>{/* end invoice-totals-signature-block */}

        {/* Online Payment Section */}
        {(data.type === 'FACTURE' || data.paymentDeadline === 'immediate') && (
          <div className="rounded-md px-4 py-3 mt-6 flex items-center gap-3 print:hidden" style={{ border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
            <div className="flex-1 min-w-0">
              <p className="text-[8.5pt] font-bold text-gray-700">
                {data.paymentDeadline === 'immediate' ? 'Paiement immédiat' : 'Paiement en ligne'}
              </p>
              <p className="text-[7pt] text-gray-500 leading-tight mt-0.5">Scannez le QR code pour payer en ligne.</p>
            </div>
            <div className="w-10 h-10 rounded flex items-center justify-center text-[6pt] text-gray-400 text-center leading-tight shrink-0" style={{ border: '1px dashed #d1d5db' }}>QR</div>
            <button className="px-4 py-2 rounded-md text-[8.5pt] font-bold text-white shadow-sm shrink-0" style={{ backgroundColor: '#059669' }} onClick={(e) => e.stopPropagation()}>Payer</button>
          </div>
        )}

        {/* Convert to Facture button */}
        {data.type === 'DEVIS' && onConvertToFacture && (
          <div className="mt-4 print:hidden">
            <button
              onClick={(e) => { e.stopPropagation(); onConvertToFacture(); }}
              className="w-full py-2.5 rounded-lg text-[10pt] font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ backgroundColor: '#10b981' }}
            >
              🔄 Convertir ce devis en facture
            </button>
          </div>
        )}

        {/* Legal Footer — discreet, light grey */}
        {(data.legalFooter || data.emitter.iban || assuranceHeaderLine) && (
          <div className="invoice-footer-block mt-8 pt-4 text-center" style={{ borderTop: '1px solid #e5e7eb', pageBreakInside: 'avoid' }}>
            {data.legalFooter && <p className="text-[6pt] text-gray-300 leading-snug whitespace-pre-line">{data.legalFooter}</p>}
            {data.emitter.iban && (
              <p className="text-[6.5pt] text-gray-400 mt-0.5">
                IBAN : <span className="font-mono font-medium tracking-wider">{data.emitter.iban}</span>
                {data.emitter.bic && <> — BIC : <span className="font-mono font-medium">{data.emitter.bic}</span></>}
              </p>
            )}
            <p className="text-[6pt] text-gray-300 mt-1 leading-snug">
              {assuranceHeaderLine
                ? `${assuranceHeaderLine} — Zone : ${assurance?.geographicCoverage || 'France Métropolitaine'}.`
                : 'Assurance Décennale souscrite pour la zone France Métropolitaine.'}
              {data.type === 'DEVIS' && ' Validité du devis : 30 jours.'}
            </p>
          </div>
        )}

        {/* Page reference (screen only) */}
        <div className="mt-3 text-center text-[7pt] text-gray-400 print:hidden">
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
            <div className="invoice-print-footer hidden print:block">
              {docRef} — Annexe
            </div>

            <div className="flex justify-between items-center mb-4 pb-2" style={{ borderBottom: '1px solid #e5e7eb' }}>
              <div>
                <h2 className="text-[11pt] font-bold text-gray-900">{data.emitter.name}</h2>
                <p className="text-[8pt] text-gray-500">{docRef} — {data.date}</p>
              </div>
              <h3 className="text-[10pt] font-bold text-gray-700">Annexe — Photos du chantier</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {pagePhotos.map((photo, photoIdx) => (
                <div key={photoIdx} className="rounded-md overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                  <img
                    src={photo.data}
                    alt={photo.name || `Photo ${pageIdx * 4 + photoIdx + 1}`}
                    className="w-full object-cover"
                    style={{ height: '180px' }}
                  />
                  <div className="px-2 py-1" style={{ backgroundColor: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
                    <p className="text-[7pt] text-gray-500 truncate">{photo.name || `Photo ${pageIdx * 4 + photoIdx + 1}`}</p>
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
