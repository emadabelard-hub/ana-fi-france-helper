/**
 * Factur-X PDF generator
 * Takes a jsPDF-generated PDF blob and embeds CII XML as an attachment
 * conforming to Factur-X / ZUGFeRD standard (PDF/A-3 with embedded XML).
 */
import { PDFDocument, AFRelationship } from 'pdf-lib';
import { generateFacturXXml, type FacturXData } from './facturxXml';

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
  pdfDoc.setTitle(`${facturxData.invoiceNumber}`);
  pdfDoc.setSubject('Factur-X MINIMUM');
  pdfDoc.setCreator('Ana Fi France - Factur-X 2026');
  pdfDoc.setProducer('pdf-lib + Factur-X Generator');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  // Attach the XML file (Factur-X standard requires 'factur-x.xml')
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'text/xml',
    description: 'Factur-X XML invoice data (MINIMUM profile)',
    afRelationship: AFRelationship.Data,
    creationDate: new Date(),
    modificationDate: new Date(),
  });

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
  emitter: { name: string; siret: string; address: string };
  client: { name: string; address: string; siret?: string };
  subtotal: number;
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

  // Detect TVA number from legal footer
  const tvaMatch = invoiceData.legalFooter?.match(/TVA\s*:\s*(FR\w+)/i);

  return {
    invoiceNumber: `${invoiceData.type === 'FACTURE' ? 'FA' : 'DE'}-${invoiceData.number}`,
    typeCode: invoiceData.type === 'FACTURE' ? '380' : '380', // Devis aren't standard in Factur-X, use 380
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
    subtotalHT: invoiceData.subtotal,
    tvaRate: invoiceData.tvaRate,
    tvaAmount: invoiceData.tvaAmount,
    totalTTC: invoiceData.total,
    tvaExempt: invoiceData.tvaExempt,
    tvaExemptReason: invoiceData.tvaExemptText,
    paymentTerms: invoiceData.paymentTerms,
  };
}
