import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX_FILES = 10;
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB par fichier
const MAX_TOTAL = 45 * 1024 * 1024; // 45 MB cumulés
const ACCEPTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'jpg', 'jpeg', 'png'];

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() || '';

const isAccepted = (name: string, type: string): boolean => {
  if (ACCEPTED_MIMES.includes((type || '').toLowerCase())) return true;
  return ACCEPTED_EXTENSIONS.includes(extOf(name));
};

const isImage = (name: string, type: string): boolean => {
  const t = (type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  return ['jpg', 'jpeg', 'png'].includes(extOf(name));
};

const isPdf = (name: string, type: string): boolean =>
  (type || '').toLowerCase() === 'application/pdf' || extOf(name) === 'pdf';

const mimeFor = (name: string, type: string): string => {
  if (ACCEPTED_MIMES.includes((type || '').toLowerCase())) return type.toLowerCase();
  const ext = extOf(name);
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.is_anonymous) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return json({ error: 'OPENAI_API_KEY non configurée' }, 500);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: 'Requête invalide (FormData attendu)' }, 400);
    }

    const incoming: File[] = [];
    for (const [, value] of form.entries()) {
      if (value instanceof File) incoming.push(value);
    }

    if (incoming.length === 0) return json({ error: 'Aucun document reçu' }, 400);
    if (incoming.length > MAX_FILES) return json({ error: `Maximum ${MAX_FILES} documents` }, 400);

    const content: Record<string, unknown>[] = [
      {
        type: 'input_text',
        text:
          "Tu reçois des documents d'architecte (plans, notices, devis, photos). " +
          'Pour CHAQUE document reçu, dans le même ordre que les fichiers fournis, indique : ' +
          "son type de document identifié (ex : plan de niveau, coupe, façade, CCTP, devis, photo de chantier), " +
          "si son contenu est réellement lisible (readable=true) ou seulement partiellement lisible (readable=false), " +
          'et un résumé factuel de 2 lignes maximum. ' +
          "N'invente rien. Réponds STRICTEMENT en JSON : " +
          '{"documents":[{"name":"","readable":true,"documentType":"","shortSummary":""}]} ' +
          'Le champ name doit reprendre exactement le nom de fichier annoncé.',
      },
    ];

    let totalBytes = 0;
    const names: string[] = [];

    for (const file of incoming) {
      if (!isAccepted(file.name, file.type)) {
        return json({ error: `Format non accepté : ${file.name}` }, 400);
      }
      if (file.size > MAX_SIZE) {
        return json({ error: `Fichier trop volumineux : ${file.name}` }, 400);
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_TOTAL) {
        return json({ error: 'Taille cumulée supérieure à 45 Mo' }, 413);
      }

      const base64 = toBase64(bytes);
      const mime = mimeFor(file.name, file.type);
      names.push(file.name);

      content.push({ type: 'input_text', text: `Document suivant : ${file.name}` });

      if (isImage(file.name, file.type)) {
        content.push({
          type: 'input_image',
          image_url: `data:${mime};base64,${base64}`,
        });
      } else {
        content.push({
          type: 'input_file',
          filename: file.name,
          file_data: `data:${mime};base64,${base64}`,
          ...(isPdf(file.name, file.type) ? { detail: 'high' } : {}),
        });
      }
    }

    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input: [{ role: 'user', content }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('OpenAI error:', aiRes.status, errText.slice(0, 1000));
      return json({ error: `Erreur OpenAI (${aiRes.status})` }, 502);
    }

    const aiJson = await aiRes.json();
    let text: string = aiJson.output_text ?? '';
    if (!text && Array.isArray(aiJson.output)) {
      for (const item of aiJson.output) {
        for (const c of item?.content ?? []) {
          if (typeof c?.text === 'string') text += c.text;
        }
      }
    }

    let documents: { name: string; readable: boolean; documentType: string; shortSummary: string }[] = [];
    try {
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      if (parsed && Array.isArray(parsed.documents)) {
        documents = parsed.documents.map((d: Record<string, unknown>, i: number) => ({
          name: typeof d.name === 'string' && d.name ? d.name : (names[i] ?? ''),
          readable: d.readable !== false,
          documentType: typeof d.documentType === 'string' ? d.documentType : '',
          shortSummary: typeof d.shortSummary === 'string' ? d.shortSummary : '',
        }));
      }
    } catch (e) {
      console.error('Parsing réponse OpenAI impossible:', e);
    }

    if (documents.length === 0) {
      documents = names.map((name) => ({
        name,
        readable: false,
        documentType: '',
        shortSummary: '',
      }));
    }

    return json({ success: true, documents });
  } catch (e) {
    console.error('btp-quote-from-documents error:', e);
    return json({ error: 'Internal server error' }, 500);
  }
});
