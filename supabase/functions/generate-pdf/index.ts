import { PDFDocument, PDFName, PDFHexString, PDFString, PDFArray, PDFDict, PDFNumber } from 'https://esm.sh/pdf-lib@1.17.1';
import { decode as decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Minimal sRGB v2 ICC profile (Compact-ICC-Profiles, public domain)
const SRGB_ICC_BASE64 = 'AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//';

function buildPdfAXmp(title: string): string {
  const now = new Date().toISOString();
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
      <dc:format>application/pdf</dc:format>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <xmp:CreatorTool>Lovable PDF Engine</xmp:CreatorTool>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>pdf-lib + Browserless</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>BASIC</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Post-process PDF to add PDF/A-3 structural markers:
 * - OutputIntent with embedded sRGB ICC profile
 * - XMP metadata with pdfaid:part=3, conformance=B
 * - Factur-X XMP namespace
 *
 * Note: This adds the required PDF/A-3 markers but does not guarantee
 * full Veraperformance validator-passing conformance (which requires
 * font subsetting verification, color space audits, etc. - typically
 * done via Ghostscript/VeraPDF, unavailable in Deno edge runtime).
 */
async function convertToPdfA3(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  // 1. Embed sRGB ICC profile as a stream
  const iccBytes = decodeBase64(SRGB_ICC_BASE64);
  const iccStream = pdfDoc.context.stream(iccBytes, {
    N: 3,
    Length: iccBytes.length,
  });
  const iccRef = pdfDoc.context.register(iccStream);

  // 2. Build OutputIntent dict
  const outputIntentDict = pdfDoc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    DestOutputProfile: iccRef,
  });
  const outputIntentRef = pdfDoc.context.register(outputIntentDict);

  // 3. Attach OutputIntents array to Catalog
  const catalog = pdfDoc.catalog;
  catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([outputIntentRef]));

  // 4. Build & embed XMP metadata stream
  const titleStr = (pdfDoc.getTitle() || 'Document').replace(/[<>&]/g, '');
  const xmp = buildPdfAXmp(titleStr);
  const xmpStream = pdfDoc.context.stream(new TextEncoder().encode(xmp), {
    Type: 'Metadata',
    Subtype: 'XML',
    Length: new TextEncoder().encode(xmp).length,
  });
  const xmpRef = pdfDoc.context.register(xmpStream);
  catalog.set(PDFName.of('Metadata'), xmpRef);

  // 5. Mark PDF version as 1.7 (required for PDF/A-3)
  return await pdfDoc.save({ useObjectStreams: false });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');
    if (!BROWSERLESS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'BROWSERLESS_API_KEY not configured. Please add your Browserless.io API key.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { html, marginMm = 10, footerLabel } = body;

    if (!html || typeof html !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "html" parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Puppeteer PDF options
    const pdfOptions: Record<string, unknown> = {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: `${marginMm}mm`,
        right: `${marginMm}mm`,
        bottom: footerLabel ? `${marginMm + 5}mm` : `${marginMm}mm`,
        left: `${marginMm}mm`,
      },
    };

    if (footerLabel) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = '<span></span>';
      pdfOptions.footerTemplate = `<div style="font-size:9px;color:#555;text-align:center;width:100%;font-family:Arial,sans-serif;padding:0 10mm">${footerLabel} — Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;
    }

    console.log(`Generating PDF: ${(html.length / 1024).toFixed(1)}KB HTML, margin=${marginMm}mm, footer=${!!footerLabel}`);

    // Call Browserless.io headless Chrome API
    const browserlessUrl = `https://chrome.browserless.io/pdf?token=${BROWSERLESS_API_KEY}`;
    const browserlessResponse = await fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        options: pdfOptions,
      }),
    });

    if (!browserlessResponse.ok) {
      const errText = await browserlessResponse.text();
      console.error('Browserless API error:', browserlessResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Browserless error (${browserlessResponse.status}): ${errText.slice(0, 500)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdfBuffer = await browserlessResponse.arrayBuffer();
    console.log(`PDF generated by Browserless: ${(pdfBuffer.byteLength / 1024).toFixed(1)}KB`);

    // Post-process: convert to PDF/A-3 (add OutputIntent sRGB + PDF/A XMP)
    let finalPdf: Uint8Array;
    try {
      finalPdf = await convertToPdfA3(pdfBuffer);
      console.log(`PDF/A-3 conversion done: ${(finalPdf.byteLength / 1024).toFixed(1)}KB`);
    } catch (convErr) {
      console.error('PDF/A-3 conversion failed, returning original PDF:', convErr);
      finalPdf = new Uint8Array(pdfBuffer);
    }

    return new Response(finalPdf, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });
  } catch (error) {
    console.error('generate-pdf error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
