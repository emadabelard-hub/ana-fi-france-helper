import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { anthropicCompatFetch } from '../_shared/anthropic-compat.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Battement de coeur : prouve que le worker est vivant pendant un appel IA long.
// Le cron "stale" utilise un seuil de 3 minutes ; 30 s laisse une marge de 6x.
const HEARTBEAT_MS = 30_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const admin = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

type Db = ReturnType<typeof admin>;
type StepName = 'prepare' | 'ai_test' | 'finalize' | 'completed';

/**
 * Source de vérité = step_results. current_step n'est qu'un indicateur.
 * Si un worker meurt après avoir écrit une étape mais avant de mettre à jour
 * current_step, la reprise ne rejoue pas l'étape.
 */
function nextStep(stepResults: Record<string, unknown> | null): StepName {
  const sr = stepResults ?? {};
  if (!('prepare' in sr)) return 'prepare';
  if (!('ai_test' in sr)) return 'ai_test';
  if (!('final' in sr)) return 'finalize';
  return 'completed';
}

// ---------------------------------------------------------------- mode create
async function handleCreate(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Authentification requise.' }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return json({ error: 'Session invalide.' }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const language = body.language === 'ar' ? 'ar' : 'fr';
  const userText = typeof body.userText === 'string' ? body.userText.slice(0, 4000) : null;

  // user_id vient EXCLUSIVEMENT du JWT ; tout user_id envoyé par le client est ignoré.
  const { data, error } = await admin()
    .from('btp_analysis_jobs')
    .insert({
      user_id: user.id,
      status: 'queued',
      language,
      documents: [],
      user_text: userText,
      current_step: 'prepare',
      progress: 0,
      // Marqueur imposé par le serveur : le client ne peut rien injecter dans payload.
      payload: { phase: 3, kind: 'persistent_ui_test' },
      step_results: {},
      attempts: 0,
    })
    .select('id, status')
    .single();

  if (error || !data) {
    console.error('create failed', error?.message);
    return json({ error: "Création du job impossible." }, 500);
  }

  return json({ jobId: data.id, status: data.status });
}

// ------------------------------------------------------------------ mode work
async function assertWorkerAuthorized(req: Request, db: Db): Promise<boolean> {
  const provided = req.headers.get('x-worker-token') ?? '';
  if (!provided) return false;
  const { data, error } = await db.rpc('get_analysis_worker_token');
  if (error || typeof data !== 'string' || data.length < 16) {
    console.error('worker token unavailable', error?.message);
    return false;
  }
  if (provided.length !== data.length) return false;
  // comparaison à temps constant
  let diff = 0;
  for (let i = 0; i < data.length; i++) diff |= provided.charCodeAt(i) ^ data.charCodeAt(i);
  return diff === 0;
}

class TerminalStepError extends Error {}

/** Un seul petit appel IA déterministe, via le fournisseur déjà utilisé dans le projet. */
async function runAiTest(jobId: string, owner: string): Promise<{ persistentJobTest: true }> {
  console.log('ai_test:provider_call', JSON.stringify({ jobId, owner, at: new Date().toISOString() }));

  const resp = await anthropicCompatFetch({
    body: JSON.stringify({
      max_tokens: 64,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content:
            'Réponds uniquement avec le JSON suivant :\n{"persistentJobTest":true}\nN\'écris rien d\'autre.',
        },
      ],
    }),
  });

  if (!resp.ok) {
    const text = (await resp.text()).slice(0, 300);
    if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
      throw new TerminalStepError(`IA refus permanent ${resp.status}: ${text}`);
    }
    throw new Error(`IA erreur ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  const text = typeof raw === 'string' ? raw.trim() : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Réponse IA non exploitable: ${text.slice(0, 200)}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error(`JSON IA invalide: ${match[0].slice(0, 200)}`);
  }
  if (!parsed || typeof parsed !== 'object' || (parsed as Record<string, unknown>).persistentJobTest !== true) {
    throw new Error(`Contrat ai_test non respecté: ${match[0].slice(0, 200)}`);
  }
  return { persistentJobTest: true };
}

async function handleWork(req: Request): Promise<Response> {
  const db = admin();

  if (!(await assertWorkerAuthorized(req, db))) {
    return json({ error: 'Non autorisé.' }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const jobId = typeof body.jobId === 'string' ? body.jobId : '';
  if (!UUID_RE.test(jobId)) {
    return json({ error: 'jobId invalide.' }, 400);
  }

  // Lease atomique côté serveur : queued -> running + propriétaire enregistré.
  const owner = crypto.randomUUID();
  const { data: locked, error: lockError } = await db.rpc('claim_analysis_job', {
    _job_id: jobId,
    _owner: owner,
  });

  if (lockError) {
    console.error('lock error', lockError.message);
    return json({ error: 'Verrouillage impossible.' }, 500);
  }
  // PostgREST peut renvoyer un enregistrement composite entièrement nul lorsque la
  // fonction ne retourne aucune ligne : l'absence d'id est le seul test fiable.
  const job = (locked ?? {}) as Record<string, unknown>;
  if (!job.id) {
    // Job inexistant, lease encore détenu par un worker vivant, ou statut terminal.
    return json({ skipped: true, reason: 'not_lockable' });
  }

  const stepResults = (job.step_results ?? {}) as Record<string, unknown>;
  const step = nextStep(stepResults);

  let heartbeat: number | undefined;
  let leaseLost = false;

  try {
    if (step === 'prepare') {
      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId,
        _owner: owner,
        _step: 'prepare',
        _result: { ok: true },
        _progress: 30,
        _current_step: 'ai_test',
        _status: 'queued',
      });
      if (ok.error) throw new Error(ok.error.message);
      if (ok.data !== true) return json({ skipped: true, reason: 'lease_lost_or_duplicate' });
      return json({ jobId, executed: 'prepare', status: 'queued', progress: 30 });
    }

    if (step === 'ai_test') {
      // Le lease est déjà détenu (claim atomique) et step_results.ai_test est absent :
      // aucun autre worker ne peut être dans cette branche au même instant.
      heartbeat = setInterval(async () => {
        const hb = await db.rpc('heartbeat_analysis_job', { _job_id: jobId, _owner: owner });
        if (hb.data !== true) {
          leaseLost = true;
          console.error('ai_test:lease_lost', jobId, owner);
        }
      }, HEARTBEAT_MS) as unknown as number;

      const result = await runAiTest(jobId, owner);
      clearInterval(heartbeat);
      heartbeat = undefined;

      if (leaseLost) throw new Error('Lease perdu pendant l\'appel IA.');

      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId,
        _owner: owner,
        _step: 'ai_test',
        _result: result,
        _progress: 70,
        _current_step: 'finalize',
        _status: 'queued',
      });
      if (ok.error) throw new Error(ok.error.message);
      if (ok.data !== true) return json({ skipped: true, reason: 'lease_lost_or_duplicate' });
      return json({ jobId, executed: 'ai_test', status: 'queued', progress: 70 });
    }

    if (step === 'finalize') {
      const aiTest = (stepResults.ai_test ?? {}) as Record<string, unknown>;
      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId,
        _owner: owner,
        _step: 'final',
        _result: { kind: 'test', data: { persistentJobTest: aiTest.persistentJobTest === true } },
        _progress: 100,
        _current_step: 'completed',
        _status: 'completed',
        _final_report: 'Test IA persistant terminé',
      });
      if (ok.error) throw new Error(ok.error.message);
      if (ok.data !== true) return json({ skipped: true, reason: 'lease_lost_or_duplicate' });
      return json({ jobId, executed: 'finalize', status: 'completed', progress: 100 });
    }

    // Toutes les étapes sont déjà présentes : clôture sans rien rejouer.
    const { error } = await db
      .from('btp_analysis_jobs')
      .update({
        progress: 100,
        current_step: 'completed',
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('status', 'running');
    if (error) throw new Error(error.message);
    return json({ jobId, executed: 'none', status: 'completed', progress: 100 });
  } catch (e) {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    const terminal = e instanceof TerminalStepError;
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    console.error('step failed', step, terminal ? '(terminal)' : '(retryable)', message);
    const { data: newStatus } = await db.rpc('fail_analysis_step', {
      _job_id: jobId,
      _owner: owner,
      _message: message,
      _terminal: terminal,
    });
    return json({ jobId, executed: step, status: newStatus ?? 'unchanged', error: true }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405);
  }

  const url = new URL(req.url);
  let mode = url.searchParams.get('mode') ?? '';

  // Le corps est lu une seule fois : on le reconstruit pour les handlers.
  const raw = await req.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  if (!mode && typeof parsed.mode === 'string') mode = parsed.mode;

  const rebuilt = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: raw || '{}',
  });

  if (mode === 'create') return await handleCreate(rebuilt);
  if (mode === 'work') return await handleWork(rebuilt);
  return json({ error: 'mode invalide (create|work).' }, 400);
});
