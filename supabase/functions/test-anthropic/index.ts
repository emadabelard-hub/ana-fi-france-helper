const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: 'ANTHROPIC_API_KEY missing' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Réponds uniquement par: PONG' }],
      }),
    });
    const data = await r.json();
    const text = data?.content?.[0]?.text ?? null;
    return new Response(JSON.stringify({
      ok: r.ok,
      status: r.status,
      text,
      keyPresent: true,
      keyPrefix: key.slice(0, 7),
      raw: r.ok ? undefined : data,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
