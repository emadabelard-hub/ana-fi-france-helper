import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { anthropicCompatFetch } from '../_shared/anthropic-compat.ts';
import { BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT } from '../_shared/btpFactualPrompt.ts';
import {
  processSingleDocument,
  isApiSizeLimitError,
  DocumentTooLargeError,
  RESPONSE_MAX_TOKENS,
  PermanentDocumentRequestError,
  type PermanentRequestCategory,
  type ProjectDocument,
} from '../_shared/btpDocumentSequence.ts';
import { buildProjectFactsDossier, type ProjectFactsDossier } from '../_shared/btpProjectDossier.ts';
import { runGlobalAnalysis, type GlobalAnalysisMessages } from '../_shared/btpGlobalAnalysisPrompt.ts';
import { tracedAnalysisFetch, AttemptJournalError } from '../_shared/btpAnalysisTelemetry.ts';
import { requireStepCommit, confirmedFailureStatus, safeAnalysisError } from '../_shared/btpAnalysisStepSafety.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Battement de coeur : prouve que le worker est vivant pendant un appel IA long.
// Le cron "stale" utilise un seuil de 3 minutes ; 30 s laisse une marge de 6x.
const HEARTBEAT_MS = 30_000;

// Lot DOCX : 50 lignes maximum par appel IA (aucun chevauchement).
const DOCX_BATCH_SIZE = 50;
const DOCX_MAX_ROWS = 2000;

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
type StepName = string;

type SourceRow = {
  sourceLineIndex: number;
  tableIndex: number;
  rowIndex: number;
  headers: string[];
  cells: string[];
};

/**
 * Source de vérité = step_results. current_step n'est qu'un indicateur.
 * Si un worker meurt après avoir écrit une étape mais avant de mettre à jour
 * current_step, la reprise ne rejoue pas l'étape.
 */
function nextStepTest(stepResults: Record<string, unknown> | null): StepName {
  const sr = stepResults ?? {};
  if (!('prepare' in sr)) return 'prepare';
  if (!('ai_test' in sr)) return 'ai_test';
  if (!('final' in sr)) return 'finalize';
  return 'completed';
}

function nextStepDocx(stepResults: Record<string, unknown> | null, batchCount: number): StepName {
  const sr = stepResults ?? {};
  if (!('prepare' in sr)) return 'prepare';
  for (let i = 0; i < batchCount; i++) {
    if (!(`extract:${i}` in sr)) return `extract:${i}`;
  }
  if (!('merge' in sr)) return 'merge';
  if (!('final' in sr)) return 'finalize';
  return 'completed';
}

// ------------------------------------------------------- validation DOCX input
function asStringArray(v: unknown, maxLen: number): string[] | null {
  if (!Array.isArray(v) || v.length > maxLen) return null;
  const out: string[] = [];
  for (const c of v) {
    if (typeof c !== 'string') return null;
    out.push(c.slice(0, 2000));
  }
  return out;
}

function validateSourceRows(v: unknown): { rows: SourceRow[] } | { error: string } {
  if (!Array.isArray(v) || v.length === 0) return { error: 'sourceRows vide.' };
  if (v.length > DOCX_MAX_ROWS) return { error: 'Document trop volumineux.' };
  const rows: SourceRow[] = [];
  const seen = new Set<number>();
  for (const r of v) {
    if (!r || typeof r !== 'object') return { error: 'Ligne source invalide.' };
    const o = r as Record<string, unknown>;
    const idx = o.sourceLineIndex;
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) {
      return { error: 'sourceLineIndex invalide.' };
    }
    if (seen.has(idx)) return { error: 'sourceLineIndex en doublon.' };
    seen.add(idx);
    const headers = asStringArray(o.headers, 60);
    const cells = asStringArray(o.cells, 60);
    if (!headers || !cells) return { error: 'headers/cells invalides.' };
    const tableIndex = typeof o.tableIndex === 'number' && Number.isInteger(o.tableIndex) ? o.tableIndex : 0;
    const rowIndex = typeof o.rowIndex === 'number' && Number.isInteger(o.rowIndex) ? o.rowIndex : 0;
    rows.push({ sourceLineIndex: idx, tableIndex, rowIndex, headers, cells });
  }
  rows.sort((a, b) => a.sourceLineIndex - b.sourceLineIndex);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sourceLineIndex !== i) return { error: 'Index des lignes non continus.' };
  }
  return { rows };
}

function buildPlan(rowCount: number) {
  const batchCount = Math.ceil(rowCount / DOCX_BATCH_SIZE);
  const batches: { index: number; start: number; end: number }[] = [];
  for (let i = 0; i < batchCount; i++) {
    batches.push({
      index: i,
      start: i * DOCX_BATCH_SIZE,
      end: Math.min(rowCount, (i + 1) * DOCX_BATCH_SIZE) - 1,
    });
  }
  return { batchSize: DOCX_BATCH_SIZE, batchCount, rowCount, batches };
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
  const wantsDocx = body.kind === 'docx_quote_batch';

  // ---- Job DOCX de devis : payload validé et IMPOSÉ par le serveur ----------
  if (wantsDocx) {
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 300) : '';
    if (!fileName) return json({ error: 'fileName manquant.' }, 400);

    const validated = validateSourceRows(body.sourceRows);
    if ('error' in validated) return json({ error: validated.error }, 400);
    const rows = validated.rows;
    const plan = buildPlan(rows.length);

    const { data, error } = await admin()
      .from('btp_analysis_jobs')
      .insert({
        // user_id vient EXCLUSIVEMENT du JWT.
        user_id: user.id,
        status: 'queued',
        language,
        documents: [],
        user_text: null,
        current_step: 'prepare',
        progress: 0,
        // Marqueur et données imposés par le serveur : le client ne peut injecter
        // ni status, ni step_results, ni lease, ni user_id.
        payload: {
          phase: 4,
          kind: 'docx_quote_batch',
          fileName,
          sourceRows: rows,
          plan,
          attempts: 0,
        },
        step_results: {},
        attempts: 0,
      })
      .select('id, status')
      .single();

    if (error || !data) {
      console.error('ANALYSIS_CREATE_FAILED', 'docx_quote_batch');
      return json({ error: "Création du job impossible." }, 500);
    }

    // Démarrage immédiat best effort ; le cron reste la garantie.
    triggerNext(admin(), data.id).catch(() => {});
    return json({ jobId: data.id, status: data.status, batchCount: plan.batchCount, rowCount: rows.length });
  }

  // ---- « Analyser mon projet » Étape 1 : un job, N documents séquentiels ----
  if (body.kind === 'project_docs_facts') {
    const list = Array.isArray(body.documents) ? body.documents : [];
    if (list.length === 0 || list.length > 20) return json({ error: 'documents invalides.' }, 400);
    const documents: ProjectDocument[] = [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i] as Record<string, unknown>;
      const kind = d?.kind;
      if (kind !== 'image' && kind !== 'pdf' && kind !== 'docx' && kind !== 'text') {
        return json({ error: `Document ${i} : type invalide.` }, 400);
      }
      const fileName = typeof d.fileName === 'string' ? d.fileName.trim().slice(0, 300) : '';
      const text = typeof d.text === 'string' ? d.text : undefined;
      const dataUrl = typeof d.dataUrl === 'string' && d.dataUrl.startsWith('data:image/') ? d.dataUrl : undefined;
      const pageImages = Array.isArray(d.pageImages)
        ? (d.pageImages as unknown[]).filter((x): x is string => typeof x === 'string' && x.startsWith('data:image/'))
        : [];
      const nums = (v: unknown) => Array.isArray(v) ? (v as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) > 0) : [];
      const c = (d.coverage ?? null) as Record<string, unknown> | null;
      const coverage = c && typeof c === 'object' ? {
        totalPages: Number.isInteger(c.totalPages) ? c.totalPages as number : undefined,
        textPages: nums(c.textPages), imagePages: nums(c.imagePages), unreadPages: nums(c.unreadPages),
      } : undefined;
      if (!fileName) return json({ error: `Document ${i} : nom manquant.` }, 400);
      if (d.unreadable === true) {
        // Conservé dans la liste (ordre et visibilité), jamais envoyé à l'IA.
        const reason = typeof d.unreadableReason === 'string' ? d.unreadableReason.slice(0, 300) : undefined;
        documents.push({ docId: `doc${i + 1}`, fileName, kind, unreadable: true, unreadableReason: reason, coverage });
        continue;
      }
      if (!text && !dataUrl && pageImages.length === 0) return json({ error: `Document ${i} : contenu manquant.` }, 400);
      documents.push({ docId: `doc${i + 1}`, fileName, kind, text, dataUrl, pageImages: pageImages.length ? pageImages : undefined, coverage });
    }
    const { data, error } = await admin()
      .from('btp_analysis_jobs')
      .insert({
        user_id: user.id,
        status: 'queued',
        language,
        documents: documents.map((d) => ({ docId: d.docId, fileName: d.fileName, kind: d.kind })),
        user_text: null,
        current_step: 'doc:0',
        progress: 0,
        payload: { phase: 5, kind: 'project_docs_facts', documents },
        step_results: {},
        attempts: 0,
      })
      .select('id, status')
      .single();
    if (error || !data) return json({ error: 'Création du job impossible.' }, 500);
    triggerNext(admin(), data.id).catch(() => {});
    return json({ jobId: data.id, status: data.status, documentCount: documents.length });
  }

  // ---- Test technique Phase 3 (inchangé) -----------------------------------
  const userText = typeof body.userText === 'string' ? body.userText.slice(0, 4000) : null;

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
    console.error('ANALYSIS_CREATE_FAILED', 'persistent_ui_test');
    return json({ error: "Création du job impossible." }, 500);
  }

  return json({ jobId: data.id, status: data.status });
}

// ------------------------------------------------------------------ mode work
async function getWorkerToken(db: Db): Promise<string | null> {
  const { data, error } = await db.rpc('get_analysis_worker_token');
  if (error || typeof data !== 'string' || data.length < 16) {
    console.error('ANALYSIS_WORKER_TOKEN_UNAVAILABLE');
    return null;
  }
  return data;
}

async function assertWorkerAuthorized(req: Request, db: Db): Promise<boolean> {
  const provided = req.headers.get('x-worker-token') ?? '';
  if (!provided) return false;
  const data = await getWorkerToken(db);
  if (!data) return false;
  if (provided.length !== data.length) return false;
  // comparaison à temps constant
  let diff = 0;
  for (let i = 0; i < data.length; i++) diff |= provided.charCodeAt(i) ^ data.charCodeAt(i);
  return diff === 0;
}

/**
 * Enchaînement rapide BEST EFFORT : une seule invocation supplémentaire, jamais
 * récursive dans la même exécution. En cas d'échec, le cron reprend le job ;
 * si l'appel immédiat et le cron arrivent ensemble, le lock atomique arbitre.
 */
async function triggerNext(db: Db, jobId: string): Promise<void> {
  const token = await getWorkerToken(db);
  if (!token) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/btp-analysis-job?mode=work`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'x-worker-token': token,
      },
      body: JSON.stringify({ jobId }),
    });
  } catch (e) {
    console.log('ANALYSIS_TRIGGER_FAILED', jobId);
  }
}

class TerminalStepError extends Error {}

/** Closed, anchored schema errors only; never return/log a provider message. */
export function classifyPermanentProviderError(status: number, full: string): PermanentRequestCategory | null {
  if (status !== 400) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(full);
    if (typeof parsed?.error?.message === 'string' && !parsed.error.type) parsed = JSON.parse(parsed.error.message);
  } catch { return null; }
  if (parsed?.error?.type !== 'invalid_request_error' || typeof parsed.error.message !== 'string') return null;
  const message = parsed.error.message;
  if (/^(?:max_tokens|messages|model): Field required$/.test(message)
    || /^[a-z_][a-z0-9_]*: Extra inputs are not permitted$/.test(message)) return 'REQUEST_SCHEMA_INVALID';
  if (/^messages\.\d+\.role: Input should be 'user' or 'assistant'$/.test(message)) return 'MESSAGE_ROLE_INVALID';
  if (/^messages\.\d+\.content\.\d+\.image\.source(?:\.data)?: (?:Could not decode base64 image|Invalid base64 data)$/.test(message)
    || /^messages\.\d+\.content\.\d+\.image\.source\.media_type: Unsupported media type$/.test(message)) return 'IMAGE_SOURCE_INVALID';
  return null;
}

function sameSavedValue(a: unknown, b: unknown): boolean {
  // Compare the JSON actually sent to persistence, not optional in-memory keys.
  // Missing/non-serializable roots cannot prove that a result was saved.
  try {
    const leftJson = JSON.stringify(a), rightJson = JSON.stringify(b);
    if (leftJson === undefined || rightJson === undefined) return false;
    const equal = (left: unknown, right: unknown): boolean => {
      if (left === right) return true;
      if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
      const l = left as Record<string, unknown>, r = right as Record<string, unknown>;
      const keys = Object.keys(l);
      return keys.length === Object.keys(r).length && keys.every(k => Object.prototype.hasOwnProperty.call(r, k) && equal(l[k], r[k]));
    };
    return equal(JSON.parse(leftJson), JSON.parse(rightJson));
  } catch { return false; }
}

/** Only recognized connection/availability/transaction failures are retried. */
function temporarySaveError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  return ['PGRST000', 'PGRST001', 'PGRST002', '08000', '08003', '08006', '53300', '57P01', '57P02', '57P03', '40001', '40P01'].includes(e.code ?? '')
    || /^TypeError: (?:fetch failed|Failed to fetch)$/.test(e.message ?? '');
}

/** Retry this write, not its producer. Reconciliation never trusts false/null. */
async function recoverProjectSave(
  write: () => PromiseLike<{ data: unknown; error: unknown }>,
  reconcile: () => Promise<{ saved: boolean; owned: boolean }>,
): Promise<{ data: unknown; error: unknown }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let result: { data: unknown; error: unknown };
    try { result = await write(); } catch (error) { result = { data: null, error }; }
    if (!result.error && result.data === true) return result;
    let state: { saved: boolean; owned: boolean };
    try { state = await reconcile(); } catch { return result; }
    if (state.saved) return { data: true, error: null }; // Independent, exact read-back confirmation.
    if (!state.owned || !temporarySaveError(result.error) || attempt === 2) return result;
    await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 250 : 750));
  }
  return { data: false, error: null };
}

async function readProjectOwner(db: Db, jobId: string, owner: string) {
  const r = await db.from('btp_analysis_jobs').select('status, payload, step_results').eq('id', jobId).maybeSingle();
  if (r.error || !r.data) throw new Error('Save reconciliation unavailable.');
  return { job: r.data, owned: r.data.status === 'running' && r.data.payload?.lease_owner === owner };
}

async function commitProjectResponse(db: Db, jobId: string, owner: string, step: string, args: Record<string, unknown>): Promise<{ status: string; trigger: boolean }> {
  let readBackStatus: string | undefined;
  const result = await recoverProjectSave(() => db.rpc('commit_analysis_step', args), async () => {
    const { job, owned } = await readProjectOwner(db, jobId, owner);
    const attempt = await db.from('btp_analysis_attempts').select('status').eq('job_id', jobId).eq('worker_id', owner).eq('step', step).maybeSingle();
    if (attempt.error) throw new Error('Save reconciliation unavailable.');
    const saved = attempt.data?.status === 'saved' && sameSavedValue(job.step_results?.[step], args._result);
    if (saved) readBackStatus = job.status;
    return { owned: owned && attempt.data?.status === 'running' && !Object.prototype.hasOwnProperty.call(job.step_results ?? {}, step), saved };
  });
  requireStepCommit(result);
  return { status: readBackStatus ?? String(args._status), trigger: readBackStatus === undefined };
}

/** All persistent-job calls use metadata-only durable traces, including Word batches. */
async function tracedProviderCall(db: Db, jobId: string, owner: string, step: string, init: RequestInit, recoverResponse = false): Promise<Response> {
  return tracedAnalysisFetch(init, {
    async begin(m) {
      const r = await db.rpc('begin_analysis_call', { _job_id: jobId, _owner: owner, _step: step,
        _model: m.model, _chars: m.inputChars, _bytes: m.requestBytes, _tokens: m.estimatedTokens });
      if (r.error) throw new AttemptJournalError('Journal de tentative indisponible.');
      return typeof r.data === 'string' ? r.data : null;
    },
    async record(id, o) {
      const args = { _call_id: id, _owner: owner, _status: o.status,
        _duration_ms: o.durationMs, _input_tokens: o.inputTokens ?? null,
        _output_tokens: o.outputTokens ?? null, _provider_id: o.providerId ?? null, _http_status: o.httpStatus ?? null };
      const write = () => db.rpc('record_analysis_call', args);
      const r = recoverResponse && o.status === 'response_received' ? await recoverProjectSave(write, async () => {
        const { owned } = await readProjectOwner(db, jobId, owner);
        const call = await db.from('btp_analysis_calls').select('status, duration_ms, input_tokens, output_tokens, provider_request_id, http_status')
          .eq('id', id).eq('job_id', jobId).eq('worker_id', owner).eq('step', step).maybeSingle();
        if (call.error || !call.data) throw new Error('Save reconciliation unavailable.');
        const saved = ['response_received', 'response_saved'].includes(call.data.status)
          && call.data.duration_ms === o.durationMs && (call.data.input_tokens ?? null) === args._input_tokens
          && (call.data.output_tokens ?? null) === args._output_tokens && (call.data.provider_request_id ?? null) === args._provider_id
          && (call.data.http_status ?? null) === args._http_status;
        return { owned: owned && call.data.status === 'call_started', saved };
      }) : await write();
      return !r.error && r.data === true;
    },
  }, anthropicCompatFetch);
}

/** Failure is reported as persisted only after the database explicitly confirms it. */
async function reportFailedStep(db: Db, jobId: string, owner: string, step: string, error: unknown): Promise<Response> {
  const safe = safeAnalysisError(error);
  console.error('analysis_step_failed', JSON.stringify({ jobId, step, code: safe.code }));
  try {
    const outcome = await db.rpc('fail_analysis_step', {
      _job_id: jobId, _owner: owner, _message: safe.message,
      _terminal: error instanceof TerminalStepError || error instanceof AttemptJournalError,
    });
    const status = confirmedFailureStatus(outcome);
    if (status === 'queued') triggerNext(db, jobId).catch(() => {});
    return json({ jobId, executed: step, status, failureRecorded: true, error: true }, 500);
  } catch (failure) {
    console.error('analysis_failure_unconfirmed', JSON.stringify({ jobId, step, code: safeAnalysisError(failure).code }));
    return json({ jobId, executed: step, status: 'unconfirmed', failureRecorded: false, error: true }, 503);
  }
}

/** Un seul petit appel IA déterministe, via le fournisseur déjà utilisé dans le projet. */
async function runAiTest(jobId: string, owner: string): Promise<{ persistentJobTest: true }> {
  console.log('ai_test:provider_call', JSON.stringify({ jobId, owner, at: new Date().toISOString() }));

  const resp = await tracedProviderCall(admin(), jobId, owner, 'ai_test', {
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
    await resp.text();
    if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
      throw new TerminalStepError(`IA refus permanent ${resp.status}.`);
    }
    throw new Error(`IA erreur ${resp.status}.`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  const text = typeof raw === 'string' ? raw.trim() : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('invalid_contract: Réponse IA non exploitable.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('invalid_contract: JSON IA invalide.');
  }
  if (!parsed || typeof parsed !== 'object' || (parsed as Record<string, unknown>).persistentJobTest !== true) {
    throw new Error('invalid_contract: Contrat ai_test non respecté.');
  }
  return { persistentJobTest: true };
}

// ------------------------------------------- extraction DOCX : anti-invention
const normText = (s: string) =>
  s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Normalisation de présentation uniquement (m2 → m²), déjà utilisée dans ANAFYPRO. */
const normUnit = (s: string) => normText(s).replace(/m2/g, 'm²').replace(/m3/g, 'm³');

/** Tous les nombres RÉELLEMENT écrits dans les cellules de la ligne source. */
function numbersInCells(cells: string[]): number[] {
  const out: number[] = [];
  for (const cell of cells) {
    const cleaned = cell.replace(/\u00a0/g, ' ');
    const tokens = cleaned.match(/\d[\d .,']*\d|\d/g) ?? [];
    for (const tok of tokens) {
      // séparateur décimal = dernier ',' ou '.' suivi de 1 à 2 chiffres ; le
      // reste est un séparateur de milliers.
      let t = tok.replace(/[ ']/g, '');
      const dec = t.match(/[.,](\d{1,2})$/);
      if (dec) {
        const head = t.slice(0, t.length - dec[0].length).replace(/[.,]/g, '');
        t = `${head}.${dec[1]}`;
      } else {
        t = t.replace(/[.,]/g, '');
      }
      const n = Number(t);
      if (Number.isFinite(n)) out.push(n);
    }
  }
  return out;
}

const numberSupported = (value: number, pool: number[]) =>
  pool.some((n) => Math.abs(n - value) < 0.005);

function rowSupportsUnit(cells: string[], unit: string): boolean {
  const u = normUnit(unit);
  if (!u) return false;
  return cells.some((c) => normUnit(c).split(/[^a-z0-9²³%€.]+/).includes(u)) ||
    cells.some((c) => normUnit(c) === u);
}

type QuoteItem = {
  sourceLineIndex: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  priceSource: 'document' | 'missing';
  lot: string | null;
  sourceFile: string;
  evidenceText: string;
};

const BATCH_SYSTEM_PROMPT = `Tu es un moteur d'EXTRACTION LIGNE À LIGNE d'un tableau de devis BTP. Tu reçois un LOT de lignes déjà découpées et déjà indexées. Tu ne relis aucun fichier, tu ne recomposes rien.

INTERDICTIONS ABSOLUES :
- ne jamais créer, estimer, recalculer, arrondir ni déduire un prix ;
- ne jamais calculer unitPrice = total / quantity ;
- ne jamais calculer total = quantity × unitPrice ;
- ne jamais inventer une quantité ni une unité ;
- ne jamais inventer, fusionner, diviser, réordonner ni supprimer une ligne.

RÈGLES :
1. Tu renvoies EXACTEMENT un item par sourceLineIndex reçu, ni plus ni moins.
2. "sourceLineIndex" : recopie EXACTEMENT celui reçu.
3. "description" : la désignation réellement écrite dans la ligne, rien d'autre.
4. "quantity" : la valeur numérique réellement écrite dans la ligne, sinon null.
5. "unit" : l'unité réellement écrite dans la ligne, sinon null.
6. "unitPrice" : le prix unitaire réellement écrit (« 48,00 € » → 48), sinon null.
7. "total" : le total de ligne réellement écrit (« 1 200,00 € » → 1200), sinon null.
8. "priceSource" : "document" si un prix est réellement écrit, sinon "missing".
9. "lot" : uniquement si un lot est explicitement identifiable dans la ligne ou ses en-têtes, sinon null.
10. "sourceFile" : le nom de fichier fourni.
11. "evidenceText" : le contenu réel de la ligne source.

SORTIE : JSON strict uniquement, sans markdown, sans texte avant ni après :
{"items":[{"sourceLineIndex":0,"description":"","quantity":null,"unit":null,"unitPrice":null,"total":null,"priceSource":"missing","lot":null,"sourceFile":"","evidenceText":""}]}`;

async function runDocxBatch(
  jobId: string,
  owner: string,
  batchIndex: number,
  fileName: string,
  chunk: SourceRow[],
): Promise<{ items: QuoteItem[] }> {
  console.log('extract:provider_call', JSON.stringify({
    jobId, owner, batchIndex, rows: chunk.length, provider: 'anthropic', at: new Date().toISOString(),
  }));

  const userText = `LOT ${batchIndex} — fichier : ${fileName}
Chaque ligne est indivisible. "cells" suit l'ordre de "headers" DE SA PROPRE LIGNE.

${JSON.stringify(
    chunk.map((r) => ({
      sourceLineIndex: r.sourceLineIndex,
      headers: r.headers,
      cells: r.cells,
    })),
    null,
    1,
  )}

Réponds uniquement par { "items": [...] } avec exactement un item par sourceLineIndex reçu.`;

  const resp = await tracedProviderCall(admin(), jobId, owner, `extract:${batchIndex}`, {
    body: JSON.stringify({
      max_tokens: 16000,
      temperature: 0,
      messages: [
        { role: 'system', content: BATCH_SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
    }),
  });

  if (!resp.ok) {
    await resp.text();
    if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
      throw new TerminalStepError(`IA refus permanent ${resp.status}.`);
    }
    throw new Error(`IA erreur ${resp.status}.`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  const text = typeof raw === 'string' ? raw : '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`Réponse IA non exploitable (lot ${batchIndex}).`);

  let parsed: any;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(`JSON IA invalide (lot ${batchIndex}).`);
  }
  const list = Array.isArray(parsed?.items) ? parsed.items : null;
  if (!list) throw new Error(`Contrat de lot non respecté (lot ${batchIndex}).`);

  const byIndex = new Map<number, SourceRow>(chunk.map((r) => [r.sourceLineIndex, r]));
  const seen = new Set<number>();
  const items: QuoteItem[] = [];

  for (const it of list) {
    const idx = typeof it?.sourceLineIndex === 'number' ? it.sourceLineIndex : NaN;
    const src = byIndex.get(idx);
    if (!src) throw new Error(`Index hors lot ${batchIndex} : ${String(it?.sourceLineIndex)}`);
    if (seen.has(idx)) throw new Error(`Index en doublon dans le lot ${batchIndex} : ${idx}`);
    seen.add(idx);

    const pool = numbersInCells(src.cells);
    const rowText = src.cells.join(' | ');

    const num = (v: unknown, label: string): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
      if (!Number.isFinite(n)) throw new Error(`${label} non numérique (ligne ${idx}).`);
      if (!numberSupported(n, pool)) {
        throw new Error(`${label} absent de la ligne source ${idx} (valeur inventée).`);
      }
      return n;
    };

    const unitRaw = typeof it?.unit === 'string' && it.unit.trim() ? it.unit.trim() : null;
    if (unitRaw && !rowSupportsUnit(src.cells, unitRaw)) {
      throw new Error(`Unité absente de la ligne source ${idx} (valeur inventée).`);
    }

    const quantity = num(it?.quantity, 'quantity');
    const unitPrice = num(it?.unitPrice, 'unitPrice');
    const total = num(it?.total, 'total');

    const description = typeof it?.description === 'string' ? it.description.trim() : '';
    // Le lot n'est retenu que s'il est réellement écrit dans la ligne ou ses
    // en-têtes : aucune catégorie déduite par le modèle n'est acceptée.
    const lotRaw = typeof it?.lot === 'string' && it.lot.trim() ? it.lot.trim().slice(0, 200) : null;
    const lotHay = normText([...src.cells, ...src.headers].join(' | '));
    const lot = lotRaw && lotHay.includes(normText(lotRaw)) ? lotRaw : null;
    const evidence = typeof it?.evidenceText === 'string' && it.evidenceText.trim()
      ? it.evidenceText.trim().slice(0, 1000)
      : rowText.slice(0, 1000);

    items.push({
      sourceLineIndex: idx,
      description,
      quantity,
      unit: unitRaw ? unitRaw.slice(0, 40) : null,
      unitPrice,
      total,
      priceSource: unitPrice !== null || total !== null ? 'document' : 'missing',
      lot,
      sourceFile: fileName,
      evidenceText: evidence,
    });
  }

  if (seen.size !== chunk.length) {
    throw new Error(`Lot ${batchIndex} incomplet : ${seen.size}/${chunk.length} lignes.`);
  }

  items.sort((a, b) => a.sourceLineIndex - b.sourceLineIndex);
  return { items };
}

/** Fusion déterministe : aucune IA, tri par sourceLineIndex uniquement. */
function mergeExtracts(stepResults: Record<string, unknown>, batchCount: number, rowCount: number): QuoteItem[] {
  const all: QuoteItem[] = [];
  for (let i = 0; i < batchCount; i++) {
    const step = stepResults[`extract:${i}`] as { items?: QuoteItem[] } | undefined;
    const items = Array.isArray(step?.items) ? step!.items! : null;
    if (!items) throw new TerminalStepError(`Lot ${i} manquant à la fusion.`);
    all.push(...items);
  }
  all.sort((a, b) => a.sourceLineIndex - b.sourceLineIndex);
  const seen = new Set<number>();
  for (const it of all) {
    if (seen.has(it.sourceLineIndex)) {
      throw new TerminalStepError(`Ligne ${it.sourceLineIndex} en doublon après fusion.`);
    }
    seen.add(it.sourceLineIndex);
  }
  for (let i = 0; i < rowCount; i++) {
    if (!seen.has(i)) throw new TerminalStepError(`Ligne ${i} manquante après fusion.`);
  }
  return all;
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
    console.error('ANALYSIS_CLAIM_RPC_FAILED', jobId);
    return json({ error: 'Verrouillage impossible.' }, 500);
  }
  // PostgREST peut renvoyer un enregistrement composite entièrement nul lorsque la
  // fonction ne retourne aucune ligne : l'absence d'id est le seul test fiable.
  const job = (locked ?? {}) as Record<string, unknown>;
  if (!job.id) {
    // Job inexistant, lease encore détenu par un worker vivant, ou statut terminal.
    return json({ skipped: true, reason: 'not_lockable' });
  }

  const payload = (job.payload ?? {}) as Record<string, unknown>;
  if (payload.kind === 'docx_quote_batch') {
    return await workDocx(db, jobId, owner, job, payload);
  }
  if (payload.kind === 'project_docs_facts') {
    return await workProjectDocs(db, jobId, owner, job, payload);
  }
  return await workTest(db, jobId, owner, job);
}

// ------------------------------------------------- worker : job DOCX de devis
async function workDocx(
  db: Db,
  jobId: string,
  owner: string,
  job: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<Response> {
  const stepResults = (job.step_results ?? {}) as Record<string, unknown>;
  const sourceRows = Array.isArray(payload.sourceRows) ? (payload.sourceRows as SourceRow[]) : [];
  const fileName = typeof payload.fileName === 'string' ? payload.fileName : '';
  const plan = (payload.plan ?? {}) as { batchCount?: number; rowCount?: number };
  const rowCount = typeof plan.rowCount === 'number' ? plan.rowCount : sourceRows.length;
  const batchCount = typeof plan.batchCount === 'number' && plan.batchCount > 0
    ? plan.batchCount
    : Math.ceil(rowCount / DOCX_BATCH_SIZE);

  const step = nextStepDocx(stepResults, batchCount);

  let heartbeat: number | undefined;
  let leaseLost = false;

  const finish = async (executed: string, status: string, progress: number, extra?: Record<string, unknown>) => {
    if (status === 'queued') triggerNext(db, jobId).catch(() => {});
    return json({ jobId, executed, status, progress, ...(extra ?? {}) });
  };

  try {
    if (step === 'prepare') {
      // Contrôles déterministes, aucun appel IA.
      if (sourceRows.length === 0 || sourceRows.length !== rowCount) {
        throw new TerminalStepError('Lignes source incohérentes avec le plan.');
      }
      for (let i = 0; i < sourceRows.length; i++) {
        if (sourceRows[i]?.sourceLineIndex !== i) {
          throw new TerminalStepError(`Index source non continu à la position ${i}.`);
        }
      }
      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId,
        _owner: owner,
        _step: 'prepare',
        _result: { ok: true, rowCount, batchCount, batchSize: DOCX_BATCH_SIZE },
        _progress: 5,
        _current_step: 'extract:0',
        _status: 'queued',
      });
      requireStepCommit(ok);
      return await finish('prepare', 'queued', 5);
    }

    if (step.startsWith('extract:')) {
      const i = Number(step.slice('extract:'.length));
      const start = i * DOCX_BATCH_SIZE;
      const chunk = sourceRows.slice(start, start + DOCX_BATCH_SIZE);
      if (chunk.length === 0) throw new TerminalStepError(`Lot ${i} vide.`);

      heartbeat = setInterval(async () => {
        const hb = await db.rpc('heartbeat_analysis_job', { _job_id: jobId, _owner: owner });
        if (hb.data !== true) {
          leaseLost = true;
          console.error('extract:lease_lost', jobId, owner, i);
        }
      }, HEARTBEAT_MS) as unknown as number;

      const result = await runDocxBatch(jobId, owner, i, fileName, chunk);
      clearInterval(heartbeat);
      heartbeat = undefined;
      if (leaseLost) throw new Error(`Lease perdu pendant le lot ${i}.`);

      const progress = 5 + Math.round((85 * (i + 1)) / batchCount);
      const nextName = i + 1 < batchCount ? `extract:${i + 1}` : 'merge';
      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId,
        _owner: owner,
        _step: step,
        _result: result,
        _progress: progress,
        _current_step: nextName,
        _status: 'queued',
      });
      requireStepCommit(ok);
      return await finish(step, 'queued', progress, { items: result.items.length });
    }

    if (step === 'merge') {
      const merged = mergeExtracts(stepResults, batchCount, rowCount);
      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId,
        _owner: owner,
        _step: 'merge',
        _result: { ok: true, count: merged.length },
        _progress: 95,
        _current_step: 'finalize',
        _status: 'queued',
      });
      requireStepCommit(ok);
      return await finish('merge', 'queued', 95);
    }

    if (step === 'finalize') {
      const merged = mergeExtracts(stepResults, batchCount, rowCount);
      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId,
        _owner: owner,
        _step: 'final',
        _result: {
          kind: 'quote_items',
          data: { sourceFile: fileName, sourceRowCount: rowCount, items: merged },
        },
        _progress: 100,
        _current_step: 'completed',
        _status: 'completed',
        _final_report: 'Extraction du devis terminée',
      });
      requireStepCommit(ok);
      return json({ jobId, executed: 'finalize', status: 'completed', progress: 100 });
    }

    return json({ jobId, skipped: true, reason: 'already_saved' });
  } catch (e) {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    return await reportFailedStep(db, jobId, owner, step, e);
  }
}

// ------------------------ worker : « Analyser mon projet » — Étape 1
/** Prochaine étape = premier document sans résultat (step_results fait foi). */
export function nextStepProjectDocs(stepResults: Record<string, unknown> | null, docCount: number): string {
  const sr = stepResults ?? {};
  for (let i = 0; i < docCount; i++) if (!(`doc:${i}` in sr)) return `doc:${i}`;
  if (!('dossier' in sr)) return 'dossier';
  if (!('global_analysis' in sr)) return 'global_analysis';
  if (!('final' in sr)) return 'finalize';
  return 'completed';
}

/** Prompt n°2 : UN appel, uniquement le dossier consolidé (aucun document original). */
async function callGlobalAnalysis(db: Db, jobId: string, owner: string, messages: GlobalAnalysisMessages): Promise<string> {
  const resp = await tracedProviderCall(db, jobId, owner, 'global_analysis', {
    body: JSON.stringify({ max_tokens: RESPONSE_MAX_TOKENS, temperature: 0, messages }),
  }, true);
  if (!resp.ok) {
    const full = await resp.text();

    // 413, ou 400 avec message explicite de taille/contexte uniquement.
    if (isApiSizeLimitError(resp.status, full)) throw new DocumentTooLargeError(`HTTP ${resp.status}: limite de taille fournisseur.`);
    if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
      throw new TerminalStepError(`IA refus permanent ${resp.status}.`);
    }
    const category = classifyPermanentProviderError(resp.status, full);
    if (category) {
      console.log('analysis_provider_permanent', JSON.stringify({ jobId, step: 'global_analysis', http_status: resp.status, category }));
      throw new TerminalStepError('IA requête permanente refusée.');
    }
    throw new Error(`IA erreur ${resp.status}.`);
  }
  const data = await resp.json();
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length' || choice?.finish_reason === 'max_tokens') throw new Error('Analyse globale tronquée (longueur maximale).');
  return typeof choice?.message?.content === 'string' ? choice.message.content : '';
}

/** Un seul document par appel IA : Prompt n°1 + la seule pièce concernée. */
async function callFactualForOneDocument(db: Db, jobId: string, owner: string, step: string, doc: ProjectDocument): Promise<string> {
  const parts: any[] = [
    { type: 'text', text: 'EXTRACTION FACTUELLE DEMANDÉE. Relève uniquement les informations explicitement écrites et parfaitement lisibles dans la pièce ci-dessous. Réponds uniquement par le bloc <ANAFYPRO_BTP_FACTS>.' },
    { type: 'text', text: `PIÈCE ORIGINALE (document unique) : ${doc.fileName} (${doc.kind})` },
  ];
  if (doc.dataUrl) parts.push({ type: 'image_url', image_url: { url: doc.dataUrl } });
  (doc.pageImages ?? []).forEach((url, k) => {
    const page = doc.coverage?.imagePages?.[k];
    parts.push({ type: 'text', text: `IMAGE DE LA PAGE ${page ?? k + 1} de ${doc.fileName} :` });
    parts.push({ type: 'image_url', image_url: { url } });
  });
  if (doc.text) parts.push({ type: 'text', text: `CONTENU DU FICHIER ${doc.fileName} :\n${doc.text}` });
  const resp = await tracedProviderCall(db, jobId, owner, step, {
    body: JSON.stringify({
      max_tokens: RESPONSE_MAX_TOKENS,
      temperature: 0,
      messages: [
        { role: 'system', content: BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT },
        { role: 'user', content: parts },
      ],
    }),
  }, true);
  if (!resp.ok) {
    const full = await resp.text();

    if (isApiSizeLimitError(resp.status, full)) {
      throw new DocumentTooLargeError(`HTTP ${resp.status}: limite de taille fournisseur.`);
    }
    if (resp.status === 401 || resp.status === 402 || resp.status === 403) {
      throw new TerminalStepError(`IA refus permanent ${resp.status}.`);
    }
    const category = classifyPermanentProviderError(resp.status, full);
    if (category) {
      console.log('analysis_provider_permanent', JSON.stringify({ jobId, step, http_status: resp.status, category }));
      throw new PermanentDocumentRequestError(category);
    }
    throw new Error(`IA erreur ${resp.status}.`);
  }
  const data = await resp.json();
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length' || choice?.finish_reason === 'max_tokens') throw new Error('Réponse IA tronquée (longueur maximale).');
  return typeof choice?.message?.content === 'string' ? choice.message.content : '';
}

async function workProjectDocs(
  db: Db,
  jobId: string,
  owner: string,
  job: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<Response> {
  const stepResults = (job.step_results ?? {}) as Record<string, unknown>;
  const documents = (Array.isArray(payload.documents) ? payload.documents : []) as ProjectDocument[];
  const step = nextStepProjectDocs(stepResults, documents.length);
  let heartbeat: number | undefined;
  let leaseLost = false;
  try {
    if (step.startsWith('doc:')) {
      const i = Number(step.slice(4));
      heartbeat = setInterval(async () => {
        const hb = await db.rpc('heartbeat_analysis_job', { _job_id: jobId, _owner: owner });
        if (hb.data !== true) leaseLost = true;
      }, HEARTBEAT_MS) as unknown as number;
      // Refus permanent (401/402/403) : aucune relance, job en échec terminal.
      let terminal: Error | null = null;
      let called = false;
      const result = await processSingleDocument(documents[i], async (d) => {
        if (terminal) throw terminal;
        // A retry is delayed, not an immediate replay. Its durable call budget survives worker loss.
        if (called) await new Promise(resolve => setTimeout(resolve, HEARTBEAT_MS));
        called = true;
        try { return await callFactualForOneDocument(db, jobId, owner, step, d); }
        catch (e) { if (e instanceof TerminalStepError || e instanceof AttemptJournalError) terminal = e; throw e; }
      }, BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT);
      if (terminal) throw terminal;
      if (leaseLost) throw new Error(`Lease perdu pendant le document ${i}.`);
      const failure = result.status === 'failed' ? safeAnalysisError(new Error(result.error ?? '')) : null;
      const persistedResult = failure ? { ...result, error: failure.message, failure_code: failure.code } : result;
      console.log('[projectDocs] document', JSON.stringify({ jobId, i, status: result.status, attempts: result.attempts, facts: result.contract?.facts.length ?? 0 }));
      const progress = Math.round((85 * (i + 1)) / documents.length);
      const saved = await commitProjectResponse(db, jobId, owner, step, {
        _job_id: jobId, _owner: owner, _step: step, _result: persistedResult, _progress: progress,
        _current_step: i + 1 < documents.length ? `doc:${i + 1}` : 'dossier', _status: 'queued',
      });
      clearInterval(heartbeat);
      heartbeat = undefined;
      if (saved.trigger) triggerNext(db, jobId).catch(() => {});
      return json({ jobId, executed: step, status: saved.status, documentStatus: result.status });
    }
    if (step === 'dossier') {
      // Consolidation déterministe (aucun appel IA) des contrats indépendants.
      const results = documents.map((_, i) => stepResults[`doc:${i}`]);
      const dossier = buildProjectFactsDossier(results as any);
      console.log('[projectDocs] dossier', JSON.stringify({ jobId, complete: dossier.complete, facts: dossier.contract.counts.total, missing: dossier.missingDocuments.length }));
      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId, _owner: owner, _step: 'dossier',
        _result: { kind: 'project_facts_dossier', data: { documents: results, dossier } },
        _progress: 90, _current_step: 'global_analysis', _status: 'queued',
      });
      requireStepCommit(ok);
      triggerNext(db, jobId).catch(() => {});
      return json({ jobId, executed: 'dossier', status: 'queued' });
    }
    if (step === 'global_analysis') {
      const dossier = (stepResults.dossier as any)?.data?.dossier as ProjectFactsDossier;
      if (!dossier?.contract) throw new TerminalStepError('Dossier factuel consolidé absent.');
      if (!Array.isArray(dossier.contract.facts)) throw new TerminalStepError('Contrat factuel consolidé invalide.');
      heartbeat = setInterval(async () => {
        const hb = await db.rpc('heartbeat_analysis_job', { _job_id: jobId, _owner: owner });
        if (hb.data !== true) leaseLost = true;
      }, HEARTBEAT_MS) as unknown as number;
      const analysis = dossier.contract.facts.length === 0
        ? { version: 1, status: 'failed', text: null, factsCount: 0, complete: dossier.complete,
            missingDocuments: dossier.missingDocuments, error: 'EMPTY_FACTUAL_DOSSIER', failureCode: 'EMPTY_FACTUAL_DOSSIER' }
        : await runGlobalAnalysis(dossier, messages => callGlobalAnalysis(db, jobId, owner, messages));
      if (leaseLost) throw new Error("Lease perdu pendant l'analyse globale.");
      const saved = await commitProjectResponse(db, jobId, owner, 'global_analysis', {
        _job_id: jobId, _owner: owner, _step: 'global_analysis',
        _result: { kind: 'project_global_analysis', data: analysis },
        _progress: 97, _current_step: 'finalize', _status: 'queued',
      });
      clearInterval(heartbeat);
      heartbeat = undefined;
      if (saved.trigger) triggerNext(db, jobId).catch(() => {});
      return json({ jobId, executed: 'global_analysis', status: saved.status });
    }
    if (step === 'finalize') {
      // Références seulement : dossier et analyse restent dans deux clés distinctes.
      const dossier = (stepResults.dossier as any)?.data?.dossier as ProjectFactsDossier;
      const savedAnalysis = (stepResults.global_analysis as any)?.data;
      const analysisStatus = savedAnalysis?.status ?? null;
      const hasReport = analysisStatus === 'completed' && typeof savedAnalysis?.text === 'string' && savedAnalysis.text.trim().length > 0;
      const status = hasReport ? 'completed' : 'completed_without_report';
      const reason = hasReport ? null : analysisStatus === 'needs_chunking' ? 'GLOBAL_ANALYSIS_TOO_LARGE' : 'GLOBAL_ANALYSIS_FAILED';
      const ok = await db.rpc('commit_analysis_step', {
        _job_id: jobId, _owner: owner, _step: 'final',
        _result: { kind: 'project_global_analysis_ready', data: { dossierStep: 'dossier', analysisStep: 'global_analysis', complete: dossier?.complete ?? false, analysisStatus, ...(reason ? { reason } : {}) } },
        _progress: hasReport ? 100 : 97, _current_step: status, _status: status,
        _final_report: hasReport ? dossier?.complete ? 'Analyse globale terminée (dossier complet)' : 'Analyse globale terminée (dossier incomplet)' : null,
      });
      requireStepCommit(ok);
      return json({ jobId, executed: 'finalize', status, ...(reason ? { reason } : {}) });
    }
    return json({ jobId, skipped: true, reason: 'already_saved' });
  } catch (e) {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    const failure = await reportFailedStep(db, jobId, owner, step, e);
    // Ne change ni les reprises ni la sauvegarde : qualifier uniquement l'arrêt confirmé.
    const savedReport = (stepResults.global_analysis as any)?.data?.text;
    if ((step === 'global_analysis' || step === 'finalize') && !(typeof savedReport === 'string' && savedReport.trim().length > 0)) {
      const outcome = await failure.clone().json();
      if (outcome.status === 'failed') {
        const reason = (stepResults.global_analysis as any)?.data?.status === 'needs_chunking' ? 'GLOBAL_ANALYSIS_TOO_LARGE'
          : step === 'global_analysis' && safeAnalysisError(e).code === 'save_failed' ? 'REPORT_SAVE_FAILED' : 'GLOBAL_ANALYSIS_FAILED';
        const recorded = await db.from('btp_analysis_jobs')
          .update({ status: 'completed_without_report', current_step: 'completed_without_report', error_message: reason })
          .eq('id', jobId).eq('status', 'failed').select('id').maybeSingle();
        if (recorded.error || recorded.data?.id !== jobId) {
          return json({ jobId, executed: step, status: 'unconfirmed', failureRecorded: false, error: true }, 503);
        }
        return json({ jobId, executed: step, status: 'completed_without_report', reason, failureRecorded: true, error: true }, 500);
      }
    }
    return failure;
  }
}

// --------------------------------------------- worker : test technique Phase 3
async function workTest(
  db: Db,
  jobId: string,
  owner: string,
  job: Record<string, unknown>,
): Promise<Response> {
  const stepResults = (job.step_results ?? {}) as Record<string, unknown>;
  const step = nextStepTest(stepResults);

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
      requireStepCommit(ok);
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
      requireStepCommit(ok);
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
      requireStepCommit(ok);
      return json({ jobId, executed: 'finalize', status: 'completed', progress: 100 });
    }

    // Toutes les étapes sont déjà présentes : clôture sans rien rejouer.
    return json({ jobId, skipped: true, reason: 'already_saved' });
  } catch (e) {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    return await reportFailedStep(db, jobId, owner, step, e);
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
