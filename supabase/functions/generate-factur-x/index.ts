import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  document_id?: string;
  user_id?: string;
}

function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmt(n: unknown): string {
  const v = Number(n ?? 0);
  return (isFinite(v) ? v : 0).toFixed(2);
}

function toDate102(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function splitAddress(addr?: string | null): { line: string; cp?: string; city?: string } {
  if (!addr) return { line: '' };
  const m = addr.match(/^(.*?)[,\n]?\s*(\d{5})\s+(.+)$/);
  if (m) return { line: m[1].trim(), cp: m[2], city: m[3].trim() };
  return { line: addr.trim() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const document_id = body?.document_id;
    const user_id = body?.user_id;

    if (!document_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'document_id and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: invoice, error: invErr } = await supabase
      .from('documents_comptables')
      .select('*')
      .eq('id', document_id)
      .eq('user_id', user_id)
      .eq('document_type', 'facture')
      .maybeSingle();

    if (invErr || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    const data: any = invoice.document_data || {};
    const items: any[] = Array.isArray(data.items) ? data.items : [];

    const subtotalHT = Number(invoice.subtotal_ht ?? data.subtotal ?? 0);
    const tvaAmount = Number(invoice.tva_amount ?? data.tvaAmount ?? 0);
    const totalTTC = Number(invoice.total_ttc ?? data.total ?? 0);
    const tvaRate = Number(invoice.tva_rate ?? data.tvaRate ?? 0);

    const sellerAddr = splitAddress(profile?.company_address || profile?.address);
    const buyerAddr = splitAddress(invoice.client_address || data.client?.address);
    const shipAddr = splitAddress(invoice.work_site_address || buyerAddr.line);

    const buyerName = invoice.client_name || data?.client?.name || 'Client';
    const sellerName = profile?.company_name || profile?.full_name || 'Entreprise';

    const lines = (items.length > 0 ? items : [{
      designation_fr: 'Prestation',
      quantity: 1,
      unitPrice: subtotalHT,
      total: subtotalHT,
    }]).map((it, idx) => {
      const q = Number(it.quantity ?? 0);
      const up = Number(it.unitPrice ?? 0);
      const lt = Number(it.total ?? q * up);
      const lineTva = tvaRate > 0 ? lt * (tvaRate / 100) : 0;
      return `
    <IncludedSupplyChainTradeLineItem>
      <AssociatedDocumentLineDocument>
        <LineID>${idx + 1}</LineID>
      </AssociatedDocumentLineDocument>
      <SpecifiedTradeProduct>
        <Description>${esc(it.designation_fr || it.designation || it.description || `Ligne ${idx + 1}`)}</Description>
      </SpecifiedTradeProduct>
      <SpecifiedLineTradeAgreement>
        <NetPriceProductTradePrice>
          <ChargeAmount>${fmt(up)}</ChargeAmount>
        </NetPriceProductTradePrice>
      </SpecifiedLineTradeAgreement>
      <SpecifiedLineTradeDelivery>
        <BilledQuantity>${fmt(q)}</BilledQuantity>
      </SpecifiedLineTradeDelivery>
      <SpecifiedLineTradeSettlement>
        <ApplicableTradeTax>
          <CalculatedAmount>${fmt(lineTva)}</CalculatedAmount>
          <TypeCode>VAT</TypeCode>
          <RateApplicablePercent>${fmt(tvaRate)}</RateApplicablePercent>
        </ApplicableTradeTax>
        <SpecifiedTradeSettlementLineMonetarySummation>
          <LineTotalAmount>${fmt(lt)}</LineTotalAmount>
        </SpecifiedTradeSettlementLineMonetarySummation>
      </SpecifiedLineTradeSettlement>
    </IncludedSupplyChainTradeLineItem>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <ExchangedDocument>
    <ID>${esc(invoice.document_number)}</ID>
    <TypeCode>380</TypeCode>
    <IssueDateTime>
      <DateTimeString format="102">${toDate102(invoice.created_at)}</DateTimeString>
    </IssueDateTime>
  </ExchangedDocument>

  <SupplyChainTradeTransaction>
    <ApplicableHeaderTradeAgreement>
      <SellerTradeParty>
        <Name>${esc(sellerName)}</Name>
        ${profile?.numero_tva ? `<SpecifiedTaxRegistration>
          <ID schemeID="VA">${esc(profile.numero_tva)}</ID>
        </SpecifiedTaxRegistration>` : ''}
        ${profile?.siret ? `<GlobalID schemeID="0002">${esc(profile.siret)}</GlobalID>` : ''}
      </SellerTradeParty>

      <BuyerTradeParty>
        <Name>${esc(buyerName)}</Name>
        ${data?.client?.numero_tva ? `<SpecifiedTaxRegistration>
          <ID schemeID="VA">${esc(data.client.numero_tva)}</ID>
        </SpecifiedTaxRegistration>` : ''}
        ${data?.client?.siret ? `<GlobalID schemeID="0002">${esc(data.client.siret)}</GlobalID>` : ''}
      </BuyerTradeParty>
    </ApplicableHeaderTradeAgreement>

    <ApplicableHeaderTradeDelivery>
      <ShipToTradeParty>
        <Name>${esc(buyerName)}</Name>
        <PostalTradeAddress>
          ${shipAddr.cp ? `<PostcodeCode>${esc(shipAddr.cp)}</PostcodeCode>` : ''}
          ${shipAddr.line ? `<LineOne>${esc(shipAddr.line)}</LineOne>` : ''}
          ${shipAddr.city ? `<CityName>${esc(shipAddr.city)}</CityName>` : ''}
          <CountryID>FR</CountryID>
        </PostalTradeAddress>
      </ShipToTradeParty>
    </ApplicableHeaderTradeDelivery>

    <ApplicableHeaderTradeSettlement>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>

      <SpecifiedTradeSettlementHeaderMonetarySummation>
        <LineTotalAmount>${fmt(subtotalHT)}</LineTotalAmount>
        <TaxBasisTotalAmount>${fmt(subtotalHT)}</TaxBasisTotalAmount>
        <TaxTotalAmount>${fmt(tvaAmount)}</TaxTotalAmount>
        <GrandTotalAmount>${fmt(totalTTC)}</GrandTotalAmount>
      </SpecifiedTradeSettlementHeaderMonetarySummation>

      <ApplicableTradeTax>
        <CalculatedAmount>${fmt(tvaAmount)}</CalculatedAmount>
        <BasisAmount>${fmt(subtotalHT)}</BasisAmount>
        <TypeCode>VAT</TypeCode>
        <RateApplicablePercent>${fmt(tvaRate)}</RateApplicablePercent>
      </ApplicableTradeTax>
    </ApplicableHeaderTradeSettlement>
${lines}
  </SupplyChainTradeTransaction>
</Invoice>`;

    return new Response(JSON.stringify({ xml }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
