/**
 * Factur-X PDF generator
 * Takes a jsPDF-generated PDF blob and embeds CII XML as an attachment
 * conforming to Factur-X / ZUGFeRD standard (PDF/A-3 with embedded XML).
 */
import { PDFDocument, AFRelationship, PDFName, PDFHexString, PDFString } from 'pdf-lib';
import { generateFacturXXml, type FacturXData, type FacturXLineItem } from './facturxXml';

/**
 * Build Factur-X compliant XMP metadata block.
 */
function buildFacturXXmp(params: {
  title: string;
  conformanceLevel: string; // BASIC | MINIMUM | EN 16931 ...
  documentFileName?: string;
}): string {
  const { title, conformanceLevel, documentFileName = 'factur-x.xml' } = params;
  const now = new Date().toISOString();
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Factur-X">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <xmp:CreatorTool>Ana Fi France - Factur-X 2026</xmp:CreatorTool>
      <pdf:Producer>pdf-lib + Factur-X Generator</pdf:Producer>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${documentFileName}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${conformanceLevel}</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Embed Factur-X XML into an existing PDF blob.
 * Returns a new Blob with the XML attached as 'factur-x.xml'.
 */
export async function embedFacturXInPdf(
  pdfBlob: Blob,
  facturxData: FacturXData
): Promise<Blob> {
  // Generate the CII XML
  const xmlString = generateFacturXXml(facturxData);
  const xmlBytes = new TextEncoder().encode(xmlString);

  // Load existing PDF
  const pdfBytes = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Set PDF metadata for Factur-X compliance
  const hasLines = facturxData.lineItems && facturxData.lineItems.length > 0;
  const conformanceLevel = hasLines ? 'BASIC' : 'MINIMUM';
  const profileLabel = `Factur-X ${conformanceLevel}`;
  pdfDoc.setTitle(`${facturxData.invoiceNumber}`);
  pdfDoc.setSubject(profileLabel);
  pdfDoc.setCreator('Ana Fi France - Factur-X 2026');
  pdfDoc.setProducer('pdf-lib + Factur-X Generator');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  // Attach the XML file (Factur-X standard requires 'factur-x.xml')
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'text/xml',
    description: `Factur-X XML invoice data (${profileLabel} profile)`,
    afRelationship: AFRelationship.Data,
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  // Inject Factur-X XMP metadata into the PDF Catalog
  try {
    const xmp = buildFacturXXmp({
      title: facturxData.invoiceNumber,
      conformanceLevel,
    });
    const xmpBytes = new TextEncoder().encode(xmp);
    const metadataStream = pdfDoc.context.stream(xmpBytes, {
      Type: 'Metadata',
      Subtype: 'XML',
      Length: xmpBytes.length,
    });
    const metadataRef = pdfDoc.context.register(metadataStream);
    pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef);
  } catch (e) {
    console.warn('XMP metadata injection failed:', e);
  }

  // Save and return as Blob
  const enhancedPdfBytes = await pdfDoc.save();
  return new Blob([enhancedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Build FacturXData from InvoiceData (the app's invoice model)
 */
export function buildFacturXDataFromInvoice(invoiceData: {
  number: string;
  type: string;
  date: string;
  dueDate?: string;
  emitter: { name: string; siret: string; address: string; iban?: string; bic?: string };
  client: { name: string; address: string; siret?: string; siren?: string; tvaIntra?: string };
  workSite?: { sameAsClient: boolean; address?: string };
  natureOperation?: 'service' | 'goods' | 'mixed';
  items: Array<{ designation_fr: string; quantity: number; unit: string; unitPrice: number; total: number }>;
  subtotal: number;
  subtotalAfterDiscount?: number;
  discountAmount?: number;
  tvaRate: number;
  tvaAmount: number;
  total: number;
  tvaExempt: boolean;
  tvaExemptText?: string;
  paymentTerms: string;
  validUntil?: string;
  legalFooter?: string;
}): FacturXData {
  // Parse address for postal code and city
  const addressParts = invoiceData.emitter.address?.match(/(\d{5})\s+(.+)$/);

  // Detect TVA number from legal footer (supports both "TVA :" and "TVA Intracommunautaire :")
  const tvaMatch = invoiceData.legalFooter?.match(/TVA(?:\s+Intracommunautaire)?\s*:\s*(FR[\s\w]+)/i);

  // Build line items for BASIC profile
  const lineItems: FacturXLineItem[] = invoiceData.items.map((item, idx) => ({
    lineNumber: idx + 1,
    description: item.designation_fr,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    lineTotal: item.total,
    tvaRate: invoiceData.tvaExempt ? 0 : invoiceData.tvaRate,
    tvaCategoryCode: invoiceData.tvaExempt ? 'E' : 'S',
  }));

  // Worksite address (ShipToTradeParty)
  const shipToAddress = invoiceData.workSite && !invoiceData.workSite.sameAsClient
    ? invoiceData.workSite.address
    : undefined;

  // Nature de l'opération -> IncludedNote
  const natureNote = invoiceData.natureOperation
    ? (invoiceData.natureOperation === 'service'
        ? 'Prestation de services'
        : invoiceData.natureOperation === 'goods'
          ? 'Livraison de biens'
          : 'Opération mixte (biens et services)')
    : undefined;

  return {
    invoiceNumber: `${invoiceData.type === 'FACTURE' ? 'FA' : 'DE'}-${invoiceData.number}`,
    typeCode: invoiceData.type === 'FACTURE' ? '380' : '380',
    issueDate: invoiceData.date,
    sellerName: invoiceData.emitter.name,
    sellerSiret: invoiceData.emitter.siret,
    sellerAddress: invoiceData.emitter.address,
    sellerPostalCode: addressParts?.[1],
    sellerCity: addressParts?.[2],
    sellerTvaNumber: tvaMatch?.[1],
    buyerName: invoiceData.client.name,
    buyerAddress: invoiceData.client.address,
    buyerSiret: invoiceData.client.siret,
    subtotalHT: invoiceData.subtotalAfterDiscount ?? invoiceData.subtotal,
    tvaRate: invoiceData.tvaRate,
    tvaAmount: invoiceData.tvaAmount,
    totalTTC: invoiceData.total,
    allowanceAmount: invoiceData.discountAmount,
    tvaExempt: invoiceData.tvaExempt,
    tvaExemptReason: invoiceData.tvaExemptText,
    paymentTerms: invoiceData.paymentTerms,
    dueDate: invoiceData.dueDate,
    paymentMeansIban: invoiceData.emitter.iban,
    paymentMeansBic: invoiceData.emitter.bic,
    shipToAddress,
    includedNote: natureNote,
    lineItems,
  };
}
