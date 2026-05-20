// Edge function: scan-devis-document
// Accepts: { fileData: base64 (no prefix), mimeType: 'image/jpeg'|'image/png'|'application/pdf' }
// Returns: { items: [{ designation_fr, designation_ar?, quantity, unit, unitPrice }] }
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `Tu es un expert BTP. Analyse ce document (devis, demande de travaux, ou tout document BTP en français ou arabe).
Extrais TOUS les postes de travail sous forme de liste JSON STRICTEMENT au format suivant :
{
  "items": [
    {
      "designation_fr": "string (français professionnel BTP, traduis si en arabe)",
      "designation_ar": "string (arabe si présent dans le document, sinon vide)",
      "quantity": number (1 par défaut),
      "unit": "string (m², ml, u, forfait, h...)",
      "unitPrice": number (0 si non mentionné)
    }
  ]
}
Si aucun prix n'est mentionné dans le document, mets unitPrice à 0. NE PAS inventer de prix. NE PAS inventer de quantités si non explicites (mets 1).
Réponds UNIQUEMENT avec le JSON, sans texte autour, sans markdown.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const fileData: string | undefined = body?.fileData;
    const mimeType: string = body?.mimeType || 'image/jpeg';

    if (!fileData || typeof fileData !== 'string') {
      return new Response(JSON.stringify({ error: 'fileData (base64) requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(mimeType)) {
      return new Response(JSON.stringify({ error: `mimeType non supporté: ${mimeType}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPdf = mimeType === 'application/pdf';
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileData } };

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: 'Extrais les postes de travail au format JSON demandé.' },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('[scan-devis-document] Anthropic error:', anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: `Anthropic ${anthropicRes.status}: ${errText}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await anthropicRes.json();
    const text: string = data?.content?.[0]?.text ?? '';
    console.log('[scan-devis-document] raw text length:', text.length);

    // Extract JSON object from response
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (e) { console.error('JSON parse fail:', e); }
      }
    }

    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const normalized = items.map((it: any) => ({
      designation_fr: String(it?.designation_fr || '').trim(),
      designation_ar: String(it?.designation_ar || '').trim(),
      quantity: Number(it?.quantity) > 0 ? Number(it.quantity) : 1,
      unit: String(it?.unit || 'u').trim() || 'u',
      unitPrice: Number(it?.unitPrice) > 0 ? Number(it.unitPrice) : 0,
    })).filter((it: any) => it.designation_fr || it.designation_ar);

    return new Response(JSON.stringify({ items: normalized }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[scan-devis-document] error:', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
