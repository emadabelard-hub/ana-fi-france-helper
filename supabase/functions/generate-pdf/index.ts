const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
      pdfOptions.footerTemplate = `<div style="font-size:8px;color:#999;text-align:center;width:100%;font-family:Arial,sans-serif;padding:0 10mm">${footerLabel} — Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;
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
    console.log(`PDF generated successfully: ${(pdfBuffer.byteLength / 1024).toFixed(1)}KB`);

    return new Response(pdfBuffer, {
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