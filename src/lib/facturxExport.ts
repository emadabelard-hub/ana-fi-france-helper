/**
 * Build a Factur-X CII XML file from a stored invoice + profile,
 * and trigger a browser download. Used by Mes Documents ("Envoyer Factur-X").
 *
 * Does NOT modify the existing PDF.
 */
import { generateFacturXXml, type FacturXData, type FacturXLineItem } from './facturxXml';

interface BuildArgs {
  invoice: {
    document_number: string;
    client_name: string | null;
    client_address?: string | null;
    subtotal_ht: number | null;
    tva_rate?: number | null;
    tva_amount: number | null;
    total_ttc: number | null;
    tva_exempt?: boolean | null;
    work_site_address?: string | null;
    nature_operation?: string | null;
    created_at: string;
    document_data?: any;
  };
  profile?: {
    company_name?: string | null;
    full_name?: string | null;
    siret?: string | null;
    company_address?: string | null;
    address?: string | null;
    numero_tva?: string | null;
    iban?: string | null;
    bic?: string | null;
    tva_exempt?: boolean | null;
  } | null;
}

function toDDMMYYYY(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function splitAddress(addr?: string | null): { line: string; cp?: string; city?: string } {
  if (!addr) return { line: '' };
  const m = addr.match(/^(.*?)[,\n]?\s*(\d{5})\s+(.+)$/);
  if (m) return { line: m[1].trim(), cp: m[2], city: m[3].trim() };
  return { line: addr.trim() };
}

export function buildFacturXDataFromInvoice({ invoice, profile }: BuildArgs): FacturXData {
  const data = invoice.document_data || {};
  const items: any[] = Array.isArray(data.items) ? data.items : [];

  const subtotalHT = Number(invoice.subtotal_ht || data.subtotal || 0);
  const tvaAmount = Number(invoice.tva_amount || data.tvaAmount || 0);
  const totalTTC = Number(invoice.total_ttc || data.total || 0);
  const tvaRate = Number(invoice.tva_rate ?? data.tvaRate ?? 0);
  const tvaExempt = !!(invoice.tva_exempt ?? data.tvaExempt);

  const sellerAddr = splitAddress(profile?.company_address || profile?.address);

  const lineItems: FacturXLineItem[] = items.map((it, idx) => ({
    lineNumber: idx + 1,
    description: it.designation_fr || it.designation || it.description || `Ligne ${idx + 1}`,
    quantity: Number(it.quantity || 0),
    unit: it.unit || 'u',
    unitPrice: Number(it.unitPrice || 0),
    lineTotal: Number(it.total ?? (Number(it.quantity || 0) * Number(it.unitPrice || 0))),
    tvaRate: tvaExempt ? 0 : tvaRate,
    tvaCategoryCode: tvaExempt ? 'E' : 'S',
  }));

  return {
    invoiceNumber: invoice.document_number,
    typeCode: '380',
    issueDate: toDDMMYYYY(invoice.created_at),
    sellerName: profile?.company_name || profile?.full_name || 'Entreprise',
    sellerSiret: profile?.siret || undefined,
    sellerAddress: sellerAddr.line || undefined,
    sellerPostalCode: sellerAddr.cp,
    sellerCity: sellerAddr.city,
    sellerTvaNumber: profile?.numero_tva || undefined,
    buyerName: invoice.client_name || data.client?.name || 'Client',
    buyerAddress: invoice.client_address || data.client?.address || undefined,
    subtotalHT,
    tvaRate: tvaExempt ? 0 : tvaRate,
    tvaAmount: tvaExempt ? 0 : tvaAmount,
    totalTTC,
    paymentMeansIban: profile?.iban || undefined,
    paymentMeansBic: profile?.bic || undefined,
    shipToAddress: invoice.work_site_address || undefined,
    tvaExempt,
    tvaExemptReason: tvaExempt ? "TVA non applicable, art. 293 B du CGI" : undefined,
    includedNote: invoice.nature_operation || undefined,
    lineItems: lineItems.length > 0 ? lineItems : undefined,
  };
}

export function downloadFacturXXml(invoice: BuildArgs['invoice'], profile: BuildArgs['profile']) {
  const xml = generateFacturXXml(buildFacturXDataFromInvoice({ invoice, profile }));
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `facturx-${(invoice.document_number || 'facture').replace(/[^\w.-]+/g, '_')}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Chorus Pro public portal — official DGFiP B2G/B2B e-invoicing entry point. */
export const CHORUS_PRO_URL = 'https://chorus-pro.gouv.fr';
