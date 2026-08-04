import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX_FILES = 10;
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'jpg', 'jpeg', 'png'];

const isAccepted = (name: string, type: string): boolean => {
  if (ACCEPTED_MIMES.includes((type || '').toLowerCase())) return true;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_EXTENSIONS.includes(ext);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.is_anonymous) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return new Response(JSON.stringify({ error: 'Requête invalide (FormData attendu)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const incoming: File[] = [];
    for (const [, value] of form.entries()) {
      if (value instanceof File) incoming.push(value);
    }

    if (incoming.length === 0) {
      return new Response(JSON.stringify({ error: 'Aucun document reçu' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (incoming.length > MAX_FILES) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_FILES} documents` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const files: { name: string; size: number; type: string }[] = [];
    let totalBytes = 0;

    for (const file of incoming) {
      if (!isAccepted(file.name, file.type)) {
        return new Response(JSON.stringify({ error: `Format non accepté : ${file.name}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (file.size > MAX_SIZE) {
        return new Response(JSON.stringify({ error: `Fichier trop volumineux : ${file.name}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Lecture du contenu réel puis abandon immédiat (aucune conservation)
      const bytes = new Uint8Array(await file.arrayBuffer());
      totalBytes += bytes.byteLength;
      files.push({ name: file.name, size: bytes.byteLength, type: file.type });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contenu des documents reçu',
        fileCount: files.length,
        totalBytes,
        files,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (e) {
    console.error('btp-quote-from-documents error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
