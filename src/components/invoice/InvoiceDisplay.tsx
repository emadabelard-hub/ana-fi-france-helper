import { cn } from '@/lib/utils';
import DocumentQRCode from './DocumentQRCode';

export interface PaymentMilestone {
  id: string;
  label: string;
  /** Optional Arabic label (UI helper). The French `label` is the source of truth for the PDF. */
  labelAr?: string;
  mode: 'percent' | 'fixed';
  percent?: number;
  amount?: number;
  targetDate?: string;
}

export interface SelectedTVA {
  taux: number;
  mention: string;
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
  descriptionChantierAr?: string;
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
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  subtotalAfterDiscount?: number;
  tvaRate: number;
  tvaAmount: number;
  total: number;
  tvaExempt: boolean;
  tvaExemptText?: string;
  tvaRegime?: 'standard' | 'franchise' | 'autoliquidation' | 'intracommunautaire';
  selectedTVA?: SelectedTVA;
  tvaMention?: string;
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
  sourceDevisNumber?: string;
  acompteLabel?: string;
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
  'TVA non applicable, article 293B du CGI': 'معفى من الضريبة، مادة 293 ب',
  'Autoliquidation de la TVA – article 283-2 du CGI': 'احتساب عكسي للضريبة، مادة 283-2',
  'Autoliquidation de la TVA – article 283 du CGI': 'احتساب عكسي للضريبة، مادة 283',
  'Exonération de TVA – livraison intracommunautaire – article 262 ter I du CGI': 'إعفاء من الضريبة — توريد داخل أوروبا — مادة 262 ter I',
  'Exonération de TVA – article 262 ter I du CGI': 'إعفاء من الضريبة — مادة 262 ter I',
  'TVA au taux réduit de 10% conformément à l\'article 279-0 bis du CGI': 'ضريبة مخفضة 10% — مادة 279-0 bis',
  'TVA au taux normal de 20% conformément à l\'article 278 du CGI': 'ضريبة 20% — مادة 278',
  'TVA au taux normal de 20% conformément à la législation en vigueur': 'ضريبة 20% حسب التشريع الساري',
  'Garantie décennale': 'ضمان عشري',
  'Retenue de garantie': 'ضمان محجوز',
};

const InvoiceDisplay = ({ data, showArabic, onConvertToFacture }: InvoiceDisplayProps) => {
  const photos = data.sitePhotos || [];
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

  // Determine TVA regime deterministically from explicit field
  const tvaRegime: 'standard' | 'franchise' | 'autoliquidation' | 'intracommunautaire' = (() => {
    if (data.tvaRegime) return data.tvaRegime;
    // Fallback for legacy data without tvaRegime
    if (data.tvaExempt || (data.tvaRate === 0 && !data.legalMentions?.includes('283') && !data.legalMentions?.includes('262 ter'))) return 'franchise';
    if (data.tvaRate === 0 && data.legalMentions?.includes('283')) return 'autoliquidation';
    if (data.tvaRate === 0 && data.legalMentions?.includes('262 ter')) return 'intracommunautaire';
    return 'standard';
  })();

  const isAutoliquidationTva = tvaRegime === 'autoliquidation';
  const isIntracomTva = tvaRegime === 'intracommunautaire';
  const isFranchise = tvaRegime === 'franchise';

  // The legal mention from the form selection is the SINGLE source of truth — never recompute
  const vatFooterMention = data.tvaMention || data.selectedTVA?.mention || data.legalMentions || (() => {
    // Fallback only for legacy documents without legalMentions
    if (isFranchise) return 'TVA non applicable, article 293B du Code général des impôts (CGI)';
    if (isAutoliquidationTva) return 'Autoliquidation de la TVA – article 283-2 du Code général des impôts (CGI)';
    if (isIntracomTva) return 'Exonération de TVA – livraison intracommunautaire – article 262 ter I du Code général des impôts (CGI)';
    if (data.tvaRate === 10) return 'TVA au taux réduit de 10% conformément à l\'article 279-0 bis du Code général des impôts (CGI)';
    return 'TVA au taux normal de 20% conformément à l\'article 278 du Code général des impôts (CGI)';
  })();
  const displayedTvaMention = vatFooterMention.trim();

  // ── LOT DETECTION — auto-group items by trade (corps d'état) ──
  const LOT_RULES: { lot: string; keywords: RegExp }[] = [
    { lot: 'Installation chantier', keywords: /\b(installation\s+(de\s+)?chantier|protection|b[âa]che|signalisation|tri\s+s[ée]lectif|mise\s+en\s+place\s+(des|de)\s+protections|تجهيز\s*ال?ورشة|حماية)/i },
    { lot: 'Démolition et dépose', keywords: /\b(d[ée]molition|d[ée]pose|[ée]vacuation\s+(des\s+)?gravats|gravats|d[ée]chets\s+de\s+chantier|هدم|شيل\s*ال?هدم|إخلاء\s*ال?مخلفات)/i },
    { lot: 'Maçonnerie et étanchéité', keywords: /\b(ma[çc]onnerie|[ée]tanch[ée]it[ée]|ragr[ée]age|chape|enduit\s+ext|hydrofuge|بناء|عزل\s*مائي)/i },
    { lot: 'Peinture et enduits', keywords: /\b(peinture|enduit(?!\s+ext)|sous[- ]couche|impression|pon[çc]age|rebouchage|fa[çc]ade|دهان|بانتير|معجون|صباغة)/i },
    { lot: 'Revêtements sol', keywords: /\b(rev[êe]tement\s+(de\s+)?sol|parquet|stratifi[ée]|moquette|lino|pvc\s+sol|أرضية(?!\s*بلاط))/i },
    { lot: 'Carrelage et faïence', keywords: /\b(carrelage|fa[ïi]ence|joints?\s+de\s+carrelage|pose\s+de\s+carrelage|بلاط|تبليط|سيراميك|زليج)/i },
    { lot: 'Plomberie sanitaire', keywords: /\b(plomberie|sanitaire|robinetterie|[ée]tanch[ée]it[ée]\s+plomberie|wc|lavabo|douche|baignoire|سباكة|بلومبري)/i },
    { lot: 'Électricité', keywords: /\b([ée]lectri|c[âa]blage|prise|interrupteur|tableau\s+[ée]lectrique|nf\s+c\s*15-?100|كهرباء|كهربا|مقابس|مفاتيح)/i },
    { lot: 'Menuiserie', keywords: /\b(menuiserie|porte|fen[êe]tre|placard|quincaillerie|نجارة|أبواب)/i },
    { lot: 'Nettoyage', keywords: /\b(nettoyage|remise\s+en\s+[ée]tat|fin\s+de\s+chantier|تنظيف)/i },
  ];

  const detectLot = (item: { designation_fr: string; designation_ar?: string }): string | null => {
    const text = `${item.designation_fr || ''} ${item.designation_ar || ''}`;
    for (const { lot, keywords } of LOT_RULES) {
      if (keywords.test(text)) return lot;
    }
    return null;
  };

  // ── AUTO GARANTIE — detect garantie mention in any line ──
  const detectedGarantieYears = (() => {
    const allText = (data.items || [])
      .map(i => `${i.designation_fr || ''} ${i.designation_ar || ''}`)
      .join(' ')
      .toLowerCase();
    // French: "garantie X an(s)" / "X année(s) de garantie"
    const frMatch = allText.match(/garantie\s+(?:de\s+)?(\d+)\s*(?:an|ann[ée]e)/i)
      || allText.match(/(\d+)\s*(?:an|ann[ée]e)s?\s+de\s+garantie/i);
    if (frMatch) return parseInt(frMatch[1], 10);
    // Arabic: "ضمان X سنة/سنين/سنوات"
    const arMatch = allText.match(/ضمان\s+(\d+)\s*(?:سنة|سنين|سنوات)/);
    if (arMatch) return parseInt(arMatch[1], 10);
    // Arabic: "ضمان سنة" (1 year, no digit)
    if (/ضمان\s+سنة/.test(allText)) return 1;
    // French: "garantie un an"
    if (/garantie\s+(?:d['e]\s*)?un\s+an/i.test(allText)) return 1;
    return null;
  })();

  const cleanLegalFooter = (data.legalFooter || '')
    .replace(/TVA appliquée à\s*\d+(?:[.,]\d+)?%/gi, '')
    .replace(/TVA au taux de\s*\d+(?:[.,]\d+)?%/gi, '')
    .replace(/TVA non applicable,?\s*art(?:icle)?\.?\s*293\s*B\s*du\s*CGI/gi, '')
    .replace(/TVA non applicable,\s*article\s*293B\s*du\s*CGI/gi, '')
    .replace(/Autoliquidation de la TVA\s*[–-]\s*article\s*283(?:-2)?\s*du\s*CGI/gi, '')
    .replace(/Exonération de TVA\s*[–-]\s*article\s*262\s*ter\s*I\s*du\s*CGI/gi, '')
    .replace(/\s+—\s+—\s+/g, ' — ')
    .replace(/^\s*—\s*|\s*—\s*$/g, '')
    .trim();

  const pageContainerClass = "french-invoice bg-white text-gray-900 rounded-lg shadow-lg max-w-2xl mx-auto print:shadow-none print:max-w-none print:rounded-none select-none";
  const pageContainerStyle: React.CSSProperties = {
    padding: '8mm 10mm 10mm 10mm',
    boxSizing: 'border-box',
    minHeight: 'auto',
    fontSize: '8.5pt',
    lineHeight: '1.4',
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

        {/* ── HEADER — Clean, no borders ── */}
        <div data-pdf-section="header" className="flex justify-between items-start mb-2">
          {/* Left: Logo + Company */}
          <div className="flex-1 min-w-0">
            {data.logoUrl && (
              <img src={data.logoUrl} alt="Logo" className="mb-1 object-contain" style={{ maxHeight: '32px', maxWidth: '90px' }} />
            )}
            <h1 className="text-[10pt] font-bold text-gray-900 leading-tight tracking-tight">
              {data.emitter.name}
              {(data.emitter.legalStatus === 'auto-entrepreneur' || data.emitter.legalStatus === 'ei') && (
                <span className="text-[6.5pt] font-medium text-gray-400 ml-1">EI</span>
              )}
            </h1>
            <p className="text-[6.5pt] text-gray-500 mt-0.5">SIRET : {data.emitter.siret}</p>
            <p className="text-[6.5pt] text-gray-500 whitespace-pre-line leading-snug">{data.emitter.address}</p>
            {data.emitter.phone && <p className="text-[6.5pt] text-gray-500">Tél : {data.emitter.phone}</p>}
            {data.emitter.email && <p className="text-[6.5pt] text-gray-500">{data.emitter.email}</p>}
            {assuranceHeaderLine && (
              <p className="text-[6pt] text-gray-500 mt-0.5 font-medium">{assuranceHeaderLine}</p>
            )}
          </div>

          {/* Right: Document type + QR */}
          <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
            <div>
              <h2 className="text-[14pt] font-extrabold text-gray-900 leading-none tracking-tight">
                <ArSub fr={data.type} />
              </h2>
              <p className="text-[7pt] text-gray-500 mt-0.5">N° {data.number}</p>
            </div>
            <DocumentQRCode
              documentNumber={data.number}
              date={data.date}
              totalTTC={data.total}
              size={42}
            />
          </div>
        </div>

        {/* ── COMPANY & CLIENT — 2-column, no boxes ── */}
        <div data-pdf-section="client" className="flex justify-between gap-3 mb-2">
          {/* Dates */}
          <div className="flex-1">
            <div className="text-[6.5pt] text-gray-500 space-y-0">
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
            <p className="text-[6pt] font-semibold text-gray-400 uppercase tracking-widest mb-0.5"><ArSub fr="CLIENT" /></p>
            <p className="text-[8pt] font-bold text-gray-900 leading-tight">{data.client.name}</p>
            <p className="text-[6.5pt] text-gray-500 whitespace-pre-line leading-snug mt-0.5">{data.client.address}</p>
            {data.client.phone && <p className="text-[6.5pt] text-gray-500">Tél : {data.client.phone}</p>}
            {data.client.email && <p className="text-[6.5pt] text-gray-500">{data.client.email}</p>}
            {data.client.siren && <p className="text-[6.5pt] text-gray-500">SIREN : {data.client.siren}</p>}
            {data.client.tvaIntra && !data.tvaExempt && <p className="text-[6.5pt] text-gray-500">TVA Intra : {data.client.tvaIntra}</p>}
            {data.workSite && !data.workSite.sameAsClient && data.workSite.address && (
              <div className="mt-1">
                <p className="text-[6.5pt] font-semibold text-gray-400 uppercase">Adresse du chantier</p>
                <p className="text-[7pt] text-gray-500 whitespace-pre-line leading-snug">{data.workSite.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── OBJET + NATURE — simple text + thin divider ── */}
        <div data-pdf-section="objet" className="mb-2">
          {data.natureOperation && (
            <p className="text-[6.5pt] text-gray-500 mb-0.5">
              Nature de l'opération : <span className="text-gray-700 font-medium">
                {data.natureOperation === 'service' ? 'Prestation de services'
                  : data.natureOperation === 'goods' ? 'Livraison de biens'
                  : 'Prestation de services et livraison de biens'}
              </span>
            </p>
          )}
          {dynamicSubject && (
            <p className="text-[8pt] font-bold text-gray-900">
              Objet : <span className="font-semibold">{dynamicSubject}</span>
            </p>
          )}
          {data.descriptionChantierAr && showArabic && (
            <p className="text-[6.5pt] text-gray-500 mt-0.5 font-cairo" dir="rtl">
              ({data.descriptionChantierAr})
            </p>
          )}
          <div className="mt-1" style={{ borderBottom: '1px solid #e5e7eb' }} />
        </div>

        {/* ── TABLE DES PRESTATIONS ── */}
        <table data-pdf-section="table" className="w-full border-collapse mb-2" style={{ tableLayout: 'fixed', fontSize: '7pt' }}>
          <colgroup>
            <col style={{ width: '55%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead style={{ display: 'table-header-group' }}>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th className="py-1 px-1.5 text-left text-[6.5pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="Désignation" />
              </th>
              <th className="py-1 px-1 text-center text-[6.5pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="Qté" />
              </th>
              <th className="py-1 px-1 text-center text-[6.5pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="Unité" />
              </th>
              <th className="py-1 px-1.5 text-right text-[6.5pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
                <ArSub fr="P.U HT" />
              </th>
              <th className="py-1 px-1.5 text-right text-[6.5pt] font-bold text-gray-700 uppercase tracking-wide" style={{ borderBottom: '2px solid #d1d5db' }}>
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
                    className="py-0.5 px-1.5"
                    style={{
                      verticalAlign: 'top',
                      whiteSpace: 'normal',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      overflow: 'visible',
                      borderBottom: '1px solid #f0f0f0',
                      ...(isSectionTitle && index > 0 ? { paddingTop: '6px' } : {}),
                    }}
                  >
                    {isSectionTitle ? (
                      <span className="block text-left text-[7.5pt] font-bold text-gray-900 tracking-wide leading-snug">
                        {item.designation_fr}
                      </span>
                    ) : (
                      <span className="leading-snug block text-left text-gray-700 text-[7pt]">
                        {(() => {
                          const text = item.designation_fr;
                          // Bold the first phrase/segment for hierarchy
                          const dashIdx = text.indexOf(' - ');
                          const colonIdx = text.indexOf(' : ');
                          const splitIdx = dashIdx >= 0 && (colonIdx < 0 || dashIdx < colonIdx) ? dashIdx : colonIdx;
                          if (splitIdx > 0 && !text.includes('\n')) {
                            return (
                              <>
                                <span className="font-semibold text-gray-800">{text.slice(0, splitIdx)}</span>
                                {text.slice(splitIdx)}
                              </>
                            );
                          }
                          return null;
                        })() || (item.designation_fr.includes('\n')
                          ? (
                            <ul className="list-disc list-inside space-y-0 ml-0">
                              {item.designation_fr.split('\n').filter(l => l.trim()).map((line, i) => (
                                <li key={i} className="text-[6.5pt] leading-snug">{line.trim().replace(/^[-•·]\s*/, '')}</li>
                              ))}
                            </ul>
                          )
                          : item.designation_fr)}
                      </span>
                    )}
                    {showArabic && item.designation_ar && (
                      <span className="block text-[6.5pt] text-gray-400 mt-0.5 leading-snug print:hidden" dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
                        {item.designation_ar}
                      </span>
                    )}
                    {data.acompteLabel && (
                      <span className="block text-[6.5pt] text-gray-500 mt-0.5 italic leading-snug">
                        {data.acompteLabel}
                      </span>
                    )}
                    {data.sourceDevisNumber && (
                      <span className="block text-[6.5pt] text-gray-500 mt-0.5 italic leading-snug">
                        Selon devis n° {data.sourceDevisNumber}
                      </span>
                    )}
                  </td>
                  <td className="py-0.5 px-1 text-center text-gray-700 text-[7pt]" style={{ verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' }}>
                    {item.quantity}
                  </td>
                  <td className="py-0.5 px-1 text-center text-[6.5pt] text-gray-500" style={{ verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' }}>
                    {item.unit}
                  </td>
                  <td className="py-0.5 px-1.5 text-right text-gray-700 tabular-nums text-[7pt]" style={{ verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' }}>
                    {formatNumber(item.unitPrice)} €
                  </td>
                  <td className="py-0.5 px-1.5 text-right font-semibold text-gray-900 tabular-nums text-[7pt]" style={{ verticalAlign: 'middle', borderBottom: '1px solid #f0f0f0' }}>
                    {formatNumber(item.total)} €
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── END BLOCK: totaux + conditions + signature + IBAN — insecable ── */}
        <div data-pdf-section="end-block" className="invoice-totals-signature-block">

          {/* Totals row: schedule left, amounts right */}
          <div className="invoice-totals-row pdf-keep-together flex justify-between items-start mb-2 gap-3 mt-1">
            {/* Payment Schedule (compact, left side) */}
            {data.paymentMilestones && data.paymentMilestones.length > 0 && (
              <div className="flex-1 max-w-[48%]">
                <p className="text-[6.5pt] font-bold text-gray-700 mb-0.5">Échéancier de paiement</p>
                <ul className="space-y-1">
                  {data.paymentMilestones.map((m) => {
                    const milestoneAmount = m.mode === 'percent'
                      ? Math.round(data.total * (m.percent || 0) / 100 * 100) / 100
                      : (m.amount || 0);
                    const milestonePercent = m.mode === 'percent'
                      ? (m.percent || 0)
                      : Math.round((m.amount || 0) / data.total * 100 * 10) / 10;
                    return (
                      <li key={m.id} className="flex justify-between text-[6.5pt] py-0.5" style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <span className="text-gray-600 truncate mr-2">• {m.label}</span>
                        <span className="text-gray-700 whitespace-nowrap font-medium">{milestonePercent}% — {formatCurrency(milestoneAmount)}</span>
                      </li>
                    );
                  })}
                </ul>
                {data.type !== 'DEVIS' && (() => {
                  const first = data.paymentMilestones[0];
                  const firstAmt = first.mode === 'percent'
                    ? Math.round(data.total * (first.percent || 0) / 100 * 100) / 100
                    : (first.amount || 0);
                  return (
                    <div className="mt-1 rounded-md px-2 py-1" style={{ backgroundColor: '#f5f5f5', border: '1px solid #e5e5e5' }}>
                      <div className="flex justify-between text-[7pt]">
                        <span className="text-gray-700 font-bold">Net à payer (ét.1)</span>
                        <span className="font-bold text-gray-900">{formatCurrency(firstAmt)}</span>
                      </div>
                      <div className="flex justify-between text-[6pt] text-gray-500 mt-0.5">
                        <span>Restant</span>
                        <span>{formatCurrency(Math.round((data.total - firstAmt) * 100) / 100)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Totals block — right aligned */}
            <div className="w-48 ml-auto">
              {/* Total HT */}
              <div className="flex justify-between py-1" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <span className="text-gray-500 text-[7pt]"><ArSub fr="Total HT:" /></span>
                <span className="text-gray-800 text-[7.5pt] font-medium tabular-nums">{formatCurrency(data.subtotal)}</span>
              </div>

              {/* Remise (after HT, before TVA) */}
              {data.discountAmount && data.discountAmount > 0 && (
                <>
                  <div className="flex justify-between py-1" style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <span className="text-gray-500 text-[7pt]">
                      Remise {data.discountType === 'percent' ? `(${data.discountValue}%)` : ''} :
                    </span>
                    <span className="text-red-600 text-[7.5pt] font-medium tabular-nums">- {formatCurrency(data.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between py-1" style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <span className="text-gray-500 text-[7pt]">Sous-total HT :</span>
                    <span className="text-gray-800 text-[7.5pt] font-medium tabular-nums">{formatCurrency(data.subtotalAfterDiscount ?? data.subtotal)}</span>
                  </div>
                </>
              )}

              {/* TVA line — only shown for standard regime (real TVA > 0%) */}
              {tvaRegime === 'standard' && (
                <div className="py-1" style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-[7pt]">
                      {`TVA (${data.tvaRate}%) :`}
                    </span>
                    <span className="text-gray-800 text-[7.5pt] font-medium tabular-nums">{formatCurrency(data.tvaAmount)}</span>
                  </div>
                </div>
              )}
              {/* Thin divider before TTC */}
              <div style={{ borderBottom: '2px solid #d1d5db', margin: '2px 0' }} />
              {/* TTC — prominent but balanced */}
              <div className="flex justify-between items-center py-1.5 px-2 rounded-md" style={{ backgroundColor: '#f0f1f3' }}>
                <span className="font-bold text-[8pt] text-gray-900"><ArSub fr="Total TTC:" /></span>
                <span className="font-extrabold text-[11pt] text-gray-900 tabular-nums">{formatCurrency(data.total)}</span>
              </div>

              {/* TVA legal mention — displayed right after Total TTC, before Acompte */}
              {displayedTvaMention && (
                <div className="mt-1 px-2 py-1 rounded text-center" style={{ backgroundColor: '#fefce8', border: '1px solid #fde68a' }}>
                  <p className="text-[6.5pt] text-gray-600 font-medium italic">
                    {displayedTvaMention}
                  </p>
                </div>
              )}

              {/* Simple acompte (no milestones) */}
              {data.acompteAmount && data.acompteAmount > 0 && (!data.paymentMilestones || data.paymentMilestones.length === 0) && (
                  <div className="mt-1 rounded-md overflow-hidden" style={{ border: '1px solid #d1d5db' }}>
                   <div className="flex justify-between py-0.5 px-1.5" style={{ backgroundColor: '#f5f5f5' }}>
                    <span className="text-gray-600 text-[6.5pt] font-semibold">
                      {data.type === 'DEVIS' ? <ArSub fr="Acompte à la commande" /> : <ArSub fr="Acompte" />} {data.acomptePercent ? `(${data.acomptePercent}%)` : ''}
                    </span>
                    <span className="font-bold text-gray-700 text-[6.5pt] tabular-nums">{formatCurrency(data.acompteAmount)}</span>
                  </div>
                  {data.type !== 'DEVIS' && data.netAPayer !== undefined && (
                    <div className="flex justify-between py-1 px-1.5" style={{ backgroundColor: '#e8eaed' }}>
                      <span className="text-gray-900 text-[7.5pt] font-extrabold">Net à payer</span>
                      <span className="font-extrabold text-gray-900 text-[9pt] tabular-nums">{formatCurrency(data.netAPayer)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── PAYMENT CONDITIONS — bullet points, clean ── */}
          <div className="invoice-conditions-block pdf-keep-together mb-2 mt-1 text-[6.5pt] text-gray-500">
            <p className="text-gray-600 font-semibold mb-0.5"><ArSub fr="Conditions de règlement:" /></p>
            <ul className="space-y-0 ml-1">
              <li>• {data.paymentTerms}</li>
              {data.paymentDeadline === 'immediate' && (
                <li className="text-gray-600 font-medium">• Paiement à réception de la facture.</li>
              )}
              <li className="text-gray-400 text-[6pt]">• Indemnité forfaitaire de 40 € pour frais de recouvrement en cas de retard (Art. L.441-10 du Code de commerce).</li>
            </ul>
          </div>

          {/* ── ACCEPTANCE & SIGNATURE — compact horizontal layout ── */}
          <div className="invoice-signature-block pdf-keep-together pt-3 mt-2" style={{ borderTop: '1px solid #e5e7eb' }}>
            <h4 className="text-[7.5pt] font-bold text-gray-700 text-center mb-0.5">
              {data.type === 'DEVIS' ? 'Acceptation du devis' : 'Acceptation de la facture'}
            </h4>
            <p className="text-[6.5pt] text-gray-400 text-center mb-0.5 italic leading-snug">
              {data.type === 'DEVIS'
                ? 'Le client déclare avoir pris connaissance des conditions ci-dessus et accepte le présent devis.'
                : 'Le client déclare avoir pris connaissance de la présente facture.'}
            </p>
            <p className="text-[7pt] text-gray-500 text-center mb-2">
              Mention manuscrite : « <span className="italic font-medium">Bon pour accord</span> »
            </p>

            <div className="flex justify-between items-start gap-3">
              {/* Client acceptance */}
              <div className="flex-1 rounded p-1.5" style={{ border: '1px solid #e8e8e8' }}>
                <p className="text-[6.5pt] font-bold text-gray-500 mb-0.5 text-center"><ArSub fr="Le client" /></p>
                <div className="grid grid-cols-2 gap-1 mb-0.5">
                  <div>
                    <p className="text-[5.5pt] text-gray-400 mb-0.5">Nom :</p>
                    <div className="h-2.5" style={{ borderBottom: '1px dotted #d1d5db' }} />
                  </div>
                  <div>
                    <p className="text-[5.5pt] text-gray-400 mb-0.5">Date :</p>
                    <div className="h-2.5" style={{ borderBottom: '1px dotted #d1d5db' }} />
                  </div>
                </div>
                <p className="text-[5.5pt] text-gray-400 mb-0.5">Signature :</p>
                <div className="h-5 rounded" style={{ border: '1px dashed #d5d5d5' }} />
              </div>

              {/* Artisan signature & stamp — smaller */}
              <div className="w-24 text-center">
                <p className="text-[6.5pt] font-bold text-gray-500 mb-0.5"><ArSub fr="Le prestataire" /></p>
                <p className="text-[5.5pt] text-gray-400 mb-0.5">Date : {data.date}</p>
                {data.artisanSignatureUrl ? (
                  <div className="rounded p-0.5 mb-0.5" style={{ border: '1px solid #e8e8e8' }}>
                    <img src={data.artisanSignatureUrl} alt="Signature" className="max-h-6 mx-auto object-contain" />
                  </div>
                ) : (
                  <div className="h-6 rounded mb-0.5" style={{ border: '1px dashed #d5d5d5' }} />
                )}
                {data.stampUrl ? (
                  <div className="rounded p-0.5 mx-auto" style={{ border: '1px solid #e8e8e8', width: '64px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={data.stampUrl} alt="Cachet" style={{ maxWidth: '58px', maxHeight: '28px', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div className="h-5 rounded" style={{ border: '1px dashed #d5d5d5' }} />
                )}
                <p className="text-[5pt] text-gray-400 mt-0.5"><ArSub fr="Signature & Cachet" /></p>
              </div>
            </div>
          </div>

          {/* Legal Footer — inside end-block so it's never isolated */}
          <div className="invoice-iban-block invoice-footer-block mt-1.5 pt-1 text-center" style={{ borderTop: '1px solid #e5e7eb' }}>
              {displayedTvaMention && <p className="text-[6pt] text-gray-500 leading-snug font-medium italic">{displayedTvaMention}</p>}
              {cleanLegalFooter && <p className="text-[5.5pt] text-gray-300 leading-snug whitespace-pre-line">{cleanLegalFooter}</p>}
              {data.emitter.iban && (
                <p className="text-[6pt] text-gray-400 mt-0.5">
                  IBAN : <span className="font-mono font-medium tracking-wider">{data.emitter.iban}</span>
                  {data.emitter.bic && <> — BIC : <span className="font-mono font-medium">{data.emitter.bic}</span></>}
                </p>
              )}
              <p className="text-[5.5pt] text-gray-300 mt-0.5 leading-snug">
                {assuranceHeaderLine
                  ? `${assuranceHeaderLine} — Zone : ${assurance?.geographicCoverage || 'France Métropolitaine'}.`
                  : 'Assurance Décennale souscrite pour la zone France Métropolitaine.'}
                {data.type === 'DEVIS' && ' Validité du devis : 30 jours.'}
              </p>
            </div>

        </div>{/* end invoice-totals-signature-block */}

        {/* Online Payment Section */}
        {(data.type === 'FACTURE' || data.paymentDeadline === 'immediate') && (
          <div className="no-print rounded-md px-4 py-3 mt-6 flex items-center gap-3 print:hidden" style={{ border: '1px solid #e5e7eb', backgroundColor: '#fafafa' }}>
            <div className="flex-1 min-w-0">
              <p className="text-[8.5pt] font-bold text-gray-700">
                {data.paymentDeadline === 'immediate' ? 'Paiement immédiat' : 'Paiement en ligne'}
              </p>
              <p className="text-[7pt] text-gray-500 leading-tight mt-0.5">Scannez le QR code pour payer en ligne.</p>
            </div>
            <div className="w-10 h-10 rounded flex items-center justify-center text-[6pt] text-gray-400 text-center leading-tight shrink-0" style={{ border: '1px dashed #d1d5db' }}>QR</div>
            <button className="px-4 py-2 rounded-lg text-[8pt] font-bold text-white shadow-sm shrink-0 transition-colors hover:opacity-90" style={{ backgroundColor: '#059669' }} onClick={(e) => e.stopPropagation()}>Payer</button>
          </div>
        )}

        {/* Convert to Facture button */}
        {data.type === 'DEVIS' && onConvertToFacture && (
          <div className="no-print mt-4 print:hidden">
            <button
              onClick={(e) => { e.stopPropagation(); onConvertToFacture(); }}
              className="w-full py-2.5 rounded-lg text-[10pt] font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ backgroundColor: '#10b981' }}
            >
              🔄 Convertir ce devis en facture
            </button>
          </div>
        )}

        {/* Page reference (screen only) */}
        <div className="no-print mt-3 text-center text-[7pt] text-gray-400 print:hidden">
          {docRef}
        </div>
      </div>

      {/* ===== ANNEXE PAGES — Site Photos full-page ===== */}
      {photos.length > 0 && (() => {
        const PHOTOS_PER_PAGE = 1;
        const annexePages = Math.ceil(photos.length / PHOTOS_PER_PAGE);
        return Array.from({ length: annexePages }).map((_, pageIdx) => {
          const pagePhotos = photos.slice(pageIdx * PHOTOS_PER_PAGE, (pageIdx + 1) * PHOTOS_PER_PAGE);
          const photo = pagePhotos[0];
          return (
            <div
              key={`annexe-${pageIdx}`}
              dir="ltr"
              lang="fr"
              className={cn(pageContainerClass, "invoice-annexe-page mt-6 print:mt-0")}
              style={{ ...pageContainerStyle, pageBreakBefore: 'always', display: 'flex', flexDirection: 'column', minHeight: '277mm' }}
              {...preventCopy}
            >
              <div className="flex justify-between items-center mb-3 pb-2" style={{ borderBottom: '1px solid #e5e7eb' }}>
                <div>
                  <h2 className="text-[11pt] font-bold text-gray-900">{data.emitter.name}</h2>
                  <p className="text-[8pt] text-gray-500">{docRef} — {data.date}</p>
                </div>
                <h3 className="text-[10pt] font-bold text-gray-700">Annexe {annexePages > 1 ? `${pageIdx + 1}/${annexePages}` : ''} — Photos du chantier</h3>
              </div>

              <div className="annexe-photo-single flex-1 flex flex-col justify-start">
                <div className="annexe-photo-media flex-1 flex items-start justify-center rounded-md" style={{ border: '1px solid #e5e7eb', padding: '6mm', backgroundColor: '#ffffff', overflow: 'visible' }}>
                  <img
                    src={photo.data}
                    alt={photo.name || `Photo ${pageIdx + 1}`}
                    className="w-full h-full object-contain"
                    style={{ width: '100%', maxHeight: '232mm', objectFit: 'contain', objectPosition: 'center top', backgroundColor: '#fafafa' }}
                  />
                </div>
                <div className="px-3 py-1.5 mt-2" style={{ backgroundColor: '#fafafa', border: '1px solid #f0f0f0' }}>
                  <p className="text-[8pt] text-gray-600">{photo.name || `Photo ${pageIdx + 1}`}</p>
                </div>
              </div>
            </div>
          );
        });
      })()}
    </>
  );
};

export default InvoiceDisplay;
