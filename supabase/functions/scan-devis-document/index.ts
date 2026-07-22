// Edge function: scan-devis-document
// Accepts: { fileData: base64 (no prefix), mimeType, fileName? }
// Returns: DocumentAnalysisResult-compatible payload
//   { items: DocumentAnalysisItem[], documentType, subject, warnings, unreadableElements, analysisComplete }
// Legacy fields on each item (designation_fr, designation_ar, quantity, unit, unitPrice, lot)
// are preserved for frontend compatibility.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeAnalysisPayload,
  DOCUMENT_ANALYSIS_ERROR_CODE,
  DOCUMENT_ANALYSIS_ERROR_MESSAGE,
  DOCUMENT_ANALYSIS_PROMPT_SPEC,
} from '../_shared/documentAnalysisSchema.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `Tu es un expert BTP français. Analyse ce document (devis, CCTP, DPGF, BPU, métré, notice descriptive, cahier des charges, ou tout document BTP en français ou en arabe).
Ta mission principale est de produire un DEVIS DÉTAILLÉ ligne par ligne dans "items[]" à partir de TOUTES les prestations facturables présentes dans le document, en décomposant chaque ouvrage avec la même granularité que le document source (préparation, sous-couches, couches, finitions, supports, pièces, lots). Un simple résumé de quelques lignes est INSUFFISANT.
Renvoie un JSON respectant STRICTEMENT le schéma décrit ci-dessous.
${DOCUMENT_ANALYSIS_PROMPT_SPEC}
Réponds UNIQUEMENT avec le JSON, sans texte autour, sans markdown.`;


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth guard
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user || user.is_anonymous) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const fileData: string | undefined = body?.fileData;
    const mimeType: string = body?.mimeType || 'image/jpeg';
    const fileName: string | null = typeof body?.fileName === 'string' && body.fileName.trim()
      ? String(body.fileName).slice(0, 300)
      : null;

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

    const userText = fileName
      ? `Extrais les prestations facturables au format JSON demandé. Nom du fichier source : ${fileName}.`
      : `Extrais les prestations facturables au format JSON demandé.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: userText },
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
    console.log('[scan-devis-document] stop_reason:', data?.stop_reason);

    if (data?.stop_reason === 'max_tokens') {
      console.error('[scan-devis-document] stop_reason=max_tokens — réponse tronquée, devis partiel refusé');
      return new Response(JSON.stringify({
        error: 'Le document contient trop de prestations pour être analysé intégralement en une seule fois. Aucune ligne de devis n’a été créée afin d’éviter un devis incomplet.',
        code: 'DEVIS_DOCUMENT_TOO_LONG',
      }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text: string = data?.content?.[0]?.text ?? '';
    console.log('[scan-devis-document] raw text length:', text.length);

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (e) { console.error('[scan-devis-document] JSON parse fail:', e); }
      }
    }

    if (!parsed || !Array.isArray(parsed.items)) {
      console.error('[scan-devis-document] JSON invalide ou incomplet — aucune ligne retournée');
      return new Response(JSON.stringify({
        error: 'Le document n’a pas pu être analysé complètement. Aucune ligne de devis n’a été créée. Merci de réessayer avec un document plus lisible.',
        code: 'DEVIS_DOCUMENT_PARSE_ERROR',
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let normalized;
    try {
      normalized = normalizeAnalysisPayload(parsed, { fileName });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === DOCUMENT_ANALYSIS_ERROR_CODE) {
        return new Response(JSON.stringify({
          error: DOCUMENT_ANALYSIS_ERROR_MESSAGE,
          code: DOCUMENT_ANALYSIS_ERROR_CODE,
        }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw e;
    }

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[scan-devis-document] error:', e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
