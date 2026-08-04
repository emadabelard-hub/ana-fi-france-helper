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

    incoming.sort((a, b) => a.name.localeCompare(b.name, 'fr'));


    const content: Record<string, unknown>[] = [
      {
        type: 'input_text',
        text:
          "Tu reçois des documents d'architecte (plans, coupes, façades, CCTP, notices, devis, photos). " +
          'Extrais UNIQUEMENT les prestations de travaux réellement nécessaires au devis, telles qu’elles ressortent des documents.\n' +
          'RÈGLES IMPÉRATIVES :\n' +
          "- N'invente RIEN, aucune prestation absente des documents.\n" +
          '- Ne crée AUCUN prix, aucun montant.\n' +
          '- quantity_evidence doit contenir un court extrait LITTÉRAL du document justifiant précisément la quantité ET l’unité.\n' +
          '- Si aucun extrait précis ne justifie la quantité : quantity = null, unit = null, quantity_evidence = null.\n' +
          '- Jamais 0, jamais une estimation.\n' +
          '- client_supplied_material = true UNIQUEMENT si client_supplied_evidence contient un extrait littéral indiquant clairement que le matériel concerné est fourni par le client, sinon false et client_supplied_evidence = null.\n' +
          '- Une mention générale de mobilier fourni par le client ne doit JAMAIS être appliquée aux réseaux, raccordements, consommables, colle ou main-d’œuvre.\n' +
          '- source_file doit reprendre EXACTEMENT le nom de fichier annoncé.\n' +
          '- source_page = numéro de page ou repère du plan si connu, sinon null.\n' +
          '- Regroupe les prestations par lot (lot = corps de métier en français majuscules).\n' +
          '- Fusionne uniquement les doublons évidents (même prestation, même périmètre).\n' +
          '- designation_fr : français professionnel BTP, court (Action + Prestation + Périmètre).\n' +
          '- explication_ar : arabe simple et clair (une phrase).\n' +
          '- unit : uniquement "m²", "ml", "u", "forfait" ou null.\n' +
          '- reading_status : uniquement "Confirmé dans le document", "Partiellement lisible" ou "Quantité à confirmer".\n' +
          '- observation : ne JAMAIS indiquer « quantité à confirmer » lorsque quantity contient une valeur confirmée ; si la quantité est confirmée mais qu’une condition technique reste à vérifier, l’observation précise UNIQUEMENT cette condition technique ; sinon chaîne vide.\n' +
          'Réponds STRICTEMENT en JSON, sans texte autour :\n' +
          '{"prestations":[{"lot":"","designation_fr":"","explication_ar":"","quantity":null,"unit":null,"quantity_evidence":null,"source_file":"","source_page":null,"reading_status":"Confirmé dans le document","client_supplied_material":false,"client_supplied_evidence":null,"observation":""}]}',
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
        temperature: 0,
        max_output_tokens: 12000,
        text: {
          format: {
            type: 'json_schema',
            name: 'btp_prestations',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['prestations'],
              properties: {
                prestations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: [
                      'lot',
                      'designation_fr',
                      'explication_ar',
                      'quantity',
                      'unit',
                      'quantity_evidence',
                      'source_file',
                      'source_page',
                      'reading_status',
                      'client_supplied_material',
                      'client_supplied_evidence',
                      'observation',
                    ],
                    properties: {
                      lot: { type: 'string' },
                      designation_fr: { type: 'string' },
                      explication_ar: { type: 'string' },
                      quantity: { type: ['number', 'null'] },
                      unit: { type: ['string', 'null'], enum: ['m²', 'ml', 'u', 'forfait', null] },
                      quantity_evidence: { type: ['string', 'null'] },
                      source_file: { type: 'string' },
                      source_page: { type: ['string', 'null'] },
                      reading_status: {
                        type: 'string',
                        enum: [
                          'Confirmé dans le document',
                          'Partiellement lisible',
                          'Quantité à confirmer',
                        ],
                      },
                      client_supplied_material: { type: 'boolean' },
                      client_supplied_evidence: { type: ['string', 'null'] },
                      observation: { type: 'string' },
                    },

                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('OpenAI error:', aiRes.status, errText.slice(0, 1000));
      return json({ success: false, error: `Erreur OpenAI (${aiRes.status})` }, 502);
    }

    const aiJson = await aiRes.json();

    if (aiJson.status && aiJson.status !== 'completed') {
      console.error('OpenAI réponse non complète:', aiJson.status, aiJson.incomplete_details);
      return json(
        {
          success: false,
          error:
            aiJson.status === 'incomplete'
              ? "Analyse interrompue : réponse tronquée par le modèle. Réduisez le nombre ou la taille des documents."
              : `Analyse non aboutie (${aiJson.status}).`,
        },
        502,
      );
    }

    let text: string = typeof aiJson.output_text === 'string' ? aiJson.output_text : '';
    if (Array.isArray(aiJson.output)) {
      if (!text) {
        for (const item of aiJson.output) {
          for (const c of item?.content ?? []) {
            if (typeof c?.text === 'string') text += c.text;
          }
        }
      }
      for (const item of aiJson.output) {
        for (const c of item?.content ?? []) {
          if (c?.type === 'refusal') {
            console.error('OpenAI refus:', c.refusal);
            return json({ success: false, error: "L'analyse a été refusée par le modèle." }, 502);
          }
        }
      }
    }

    if (!text.trim()) {
      return json({ success: false, error: 'Réponse vide du modèle.' }, 502);
    }


    const ALLOWED_UNITS = ['m²', 'ml', 'u', 'forfait'];
    const ALLOWED_STATUS = ['Confirmé dans le document', 'Partiellement lisible', 'Quantité à confirmer'];

    type Prestation = {
      lot: string;
      designation_fr: string;
      explication_ar: string;
      quantity: number | null;
      unit: string | null;
      quantity_evidence: string | null;
      source_file: string;
      source_page: string | number | null;
      reading_status: string;
      client_supplied_material: boolean;
      client_supplied_evidence: string | null;
      observation: string;
    };

    let parsed: { prestations?: unknown } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('Parsing réponse OpenAI impossible:', e);
      return json({ success: false, error: 'Réponse du modèle non conforme au schéma attendu.' }, 502);
    }

    if (!parsed || !Array.isArray(parsed.prestations)) {
      return json({ success: false, error: 'Réponse du modèle non conforme au schéma attendu.' }, 502);
    }

    const prestations: Prestation[] = (parsed.prestations as Record<string, unknown>[])
      .map((p: Record<string, unknown>): Prestation => {
        const qtyRaw = p.quantity;
        let qty =
          typeof qtyRaw === 'number' && Number.isFinite(qtyRaw)
            ? qtyRaw
            : typeof qtyRaw === 'string' && qtyRaw.trim() && Number.isFinite(Number(qtyRaw.replace(',', '.')))
              ? Number(qtyRaw.replace(',', '.'))
              : null;
        const unitRaw = typeof p.unit === 'string' ? p.unit.trim() : '';
        let unit: string | null = ALLOWED_UNITS.includes(unitRaw) ? unitRaw : null;

        const qtyEvidence =
          typeof p.quantity_evidence === 'string' && p.quantity_evidence.trim()
            ? p.quantity_evidence.trim()
            : null;
        if (!qtyEvidence) {
          qty = null;
          unit = null;
        }

        const clientEvidence =
          typeof p.client_supplied_evidence === 'string' && p.client_supplied_evidence.trim()
            ? p.client_supplied_evidence.trim()
            : null;
        const clientSupplied = p.client_supplied_material === true && clientEvidence !== null;

        const statusRaw = typeof p.reading_status === 'string' ? p.reading_status.trim() : '';
        const src = typeof p.source_file === 'string' ? p.source_file.trim() : '';
        return {
          lot: typeof p.lot === 'string' && p.lot.trim() ? p.lot.trim() : 'AUTRES PRESTATIONS',
          designation_fr: typeof p.designation_fr === 'string' ? p.designation_fr.trim() : '',
          explication_ar: typeof p.explication_ar === 'string' ? p.explication_ar.trim() : '',
          quantity: qty,
          unit,
          quantity_evidence: qtyEvidence,
          source_file: names.includes(src) ? src : '',
          source_page:
            typeof p.source_page === 'number' || (typeof p.source_page === 'string' && p.source_page.trim())
              ? (p.source_page as string | number)
              : null,
          reading_status: ALLOWED_STATUS.includes(statusRaw)
            ? statusRaw
            : qty === null
              ? 'Quantité à confirmer'
              : 'Partiellement lisible',
          client_supplied_material: clientSupplied,
          client_supplied_evidence: clientEvidence,
          observation: typeof p.observation === 'string' ? p.observation.trim() : '',
        };
      })

      .filter((p: Prestation) => p.designation_fr.length > 0);

    if (prestations.length === 0) {
      return json(
        { success: false, error: 'Aucune prestation exploitable n’a pu être extraite des documents.' },
        422,
      );
    }

    return json({ success: true, prestations });

  } catch (e) {
    console.error('btp-quote-from-documents error:', e);
    return json({ error: 'Internal server error' }, 500);
  }
});
