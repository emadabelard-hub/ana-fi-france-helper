/**
 * Factur-X BASIC profile XML generator
 * Conforms to EN 16931-1:2017 / Factur-X 1.0 (CII D16B)
 * Reference: https://fnfe-mpe.org/factur-x/
 */

export interface FacturXLineItem {
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  tvaRate: number;
  tvaCategoryCode: string; // 'S' = standard, 'E' = exempt
}

export interface FacturXData {
  // Document
  invoiceNumber: string;
  typeCode: '380' | '381' | '389'; // 380=Invoice, 381=Credit note, 389=Self-billed
  issueDate: string; // DD/MM/YYYY format
  // Seller
  sellerName: string;
  sellerSiret?: string;
  sellerAddress?: string;
  sellerPostalCode?: string;
  sellerCity?: string;
  sellerTvaNumber?: string;
  // Buyer
  buyerName: string;
  buyerAddress?: string;
  buyerSiret?: string;
  // Amounts
  subtotalHT: number;
  tvaRate: number;
  tvaAmount: number;
  totalTTC: number;
  currencyCode?: string;
  // Payment
  paymentTerms?: string;
  dueDate?: string; // DD/MM/YYYY
  // TVA exemption
  tvaExempt?: boolean;
  tvaExemptReason?: string;
  // Line items (BASIC profile)
  lineItems?: FacturXLineItem[];
}

/** Convert DD/MM/YYYY to YYYYMMDD (format 102) */
function toDateFormat102(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}${parts[1]}${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

/** Format number to 2 decimal places for XML */
function fmt(n: number): string {
  return n.toFixed(2);
}

/** Escape XML special characters */
function escXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Map unit string to UN/ECE Recommendation 20 code */
function mapUnitCode(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === 'h' || u === 'heure' || u === 'heures') return 'HUR';
  if (u === 'jour' || u === 'jours' || u === 'j') return 'DAY';
  if (u === 'm²' || u === 'm2') return 'MTK';
  if (u === 'm' || u === 'ml' || u === 'mètre' || u === 'mètres') return 'MTR';
  if (u === 'kg') return 'KGM';
  if (u === 'l' || u === 'litre' || u === 'litres') return 'LTR';
  if (u === 'lot' || u === 'forfait' || u === 'ensemble') return 'C62';
  if (u === 'unité' || u === 'u' || u === 'pièce' || u === 'pièces') return 'C62';
  return 'C62'; // default: unit
}

/**
 * Generate a single CII line item XML block
 */
function generateLineItemXml(item: FacturXLineItem, currency: string): string {
  const unitCode = mapUnitCode(item.unit);
  return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${item.lineNumber}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escXml(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${fmt(item.unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode}">${fmt(item.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${item.tvaCategoryCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmt(item.tvaRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${fmt(item.lineTotal)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
}

/**
 * Generate Factur-X BASIC profile CII XML
 * Compliant with EN 16931-1:2017 and Factur-X 1.0
 */
export function generateFacturXXml(data: FacturXData): string {
  const currency = data.currencyCode || 'EUR';
  const issueDate102 = toDateFormat102(data.issueDate);
  const hasLineItems = data.lineItems && data.lineItems.length > 0;
  const profileId = hasLineItems
    ? 'urn:factur-x.eu:1p0:basic'
    : 'urn:factur-x.eu:1p0:minimum';

  const sellerTaxReg = data.sellerTvaNumber
    ? `<ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escXml(data.sellerTvaNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
    : '';

  const sellerLegalOrg = data.sellerSiret
    ? `<ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escXml(data.sellerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>`
    : '';

  const sellerPostal = `<ram:PostalTradeAddress>
        ${data.sellerAddress ? `<ram:LineOne>${escXml(data.sellerAddress)}</ram:LineOne>` : ''}
        ${data.sellerPostalCode ? `<ram:PostcodeCode>${escXml(data.sellerPostalCode)}</ram:PostcodeCode>` : ''}
        ${data.sellerCity ? `<ram:CityName>${escXml(data.sellerCity)}</ram:CityName>` : ''}
        <ram:CountryID>FR</ram:CountryID>
      </ram:PostalTradeAddress>`;

  const buyerLegalOrg = data.buyerSiret
    ? `<ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escXml(data.buyerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>`
    : '';

  const buyerPostal = data.buyerAddress
    ? `<ram:PostalTradeAddress>
          <ram:LineOne>${escXml(data.buyerAddress)}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>`
    : '';

  // Tax section
  const taxSection = data.tvaExempt
    ? `<ram:ApplicableTradeTax>
          <ram:CalculatedAmount>${fmt(0)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:ExemptionReason>${escXml(data.tvaExemptReason || 'TVA non applicable, art. 293 B du CGI')}</ram:ExemptionReason>
          <ram:BasisAmount>${fmt(data.subtotalHT)}</ram:BasisAmount>
          <ram:CategoryCode>E</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmt(0)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`
    : `<ram:ApplicableTradeTax>
          <ram:CalculatedAmount>${fmt(data.tvaAmount)}</ram:CalculatedAmount>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:BasisAmount>${fmt(data.subtotalHT)}</ram:BasisAmount>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmt(data.tvaRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>`;

  // Due date
  const dueDateSection = data.dueDate
    ? `<ram:SpecifiedTradePaymentTerms>
          <ram:Description>${escXml(data.paymentTerms || 'Paiement à réception')}</ram:Description>
          <ram:DueDateDateTime>
            <udt:DateTimeString format="102">${toDateFormat102(data.dueDate)}</udt:DateTimeString>
          </ram:DueDateDateTime>
        </ram:SpecifiedTradePaymentTerms>`
    : data.paymentTerms
      ? `<ram:SpecifiedTradePaymentTerms>
            <ram:Description>${escXml(data.paymentTerms)}</ram:Description>
          </ram:SpecifiedTradePaymentTerms>`
      : '';

  // Line items XML (BASIC profile)
  const lineItemsXml = hasLineItems
    ? data.lineItems!.map(item => generateLineItemXml(item, currency)).join('')
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice 
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${profileId}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escXml(data.invoiceNumber)}</ram:ID>
    <ram:TypeCode>${data.typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate102}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>${lineItemsXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escXml(data.sellerName)}</ram:Name>
        ${sellerLegalOrg}
        ${sellerPostal}
        ${sellerTaxReg}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escXml(data.buyerName)}</ram:Name>
        ${buyerLegalOrg}
        ${buyerPostal}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      ${taxSection}
      ${dueDateSection}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmt(data.subtotalHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmt(data.subtotalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${fmt(data.tvaAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmt(data.totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmt(data.totalTTC)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
