/** Real PostgreSQL, isolated local test database only. Never reaches the Cloud. */
import { execFileSync, execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

const args = ['-h', '127.0.0.1', '-p', '55434', '-U', 'postgres', '-d', 'analysis4a_test', '-v', 'ON_ERROR_STOP=1', '-At'];
const env = { PATH: process.env.PATH, PGSSLMODE: 'disable' };
const sql = (query: string) => execFileSync('psql', args, { input: query, env, encoding: 'utf8' }).trim();
const scalar = (query: string) => sql(query).split('\n').at(-1);
const queryAsync = (query: string) => new Promise<string>((resolve, reject) => {
  const p = execFile('psql', args, { env, encoding: 'utf8' }, (e, out) => e ? reject(e) : resolve(out.trim()));
  p.stdin?.end(query);
});
const claim = (id: string, owner: string) => scalar(`SELECT (public.claim_analysis_job('${id}','${owner}')).id;`);
const releaseCooldown = (id: string) => sql(`UPDATE public.btp_analysis_jobs SET payload = payload - 'next_retry_at' WHERE id = '${id}';`);
const createJob = (kind = 'project_docs_facts', step = 'global_analysis', attempts = 0) => {
  const id = randomUUID();
  const payload = { kind, documents: Array.from({ length: 4 }, () => ({})), plan: { batchCount: 4 } };
  const results = step === 'global_analysis' ? { 'doc:0': { kept: 1 }, 'doc:1': {}, 'doc:2': {}, 'doc:3': {}, dossier: { kept: '268321' } } : {};
  sql(`INSERT INTO public.btp_analysis_jobs(id,user_id,status,current_step,payload,step_results,attempts) VALUES ('${id}','${randomUUID()}','queued','${step}','${JSON.stringify(payload)}','${JSON.stringify(results)}',${attempts});`);
  return id;
};
const commit = (id: string, owner: string, step: string, next: string) => scalar(`SELECT public.commit_analysis_step('${id}','${owner}','${step}','{"kept":true}',90,'${next}','queued',NULL);`);
const fail = (id: string, owner: string, message = 'Échec simulé') => scalar(`SELECT public.fail_analysis_step('${id}','${owner}','${message}',false);`);
const startCall = (id: string, owner: string, step: string) => scalar(`SELECT public.begin_analysis_call('${id}','${owner}','${step}','claude-sonnet-4-5-20250929',140860,150000,72086);`);
const makeStale = (id: string) => sql(`UPDATE public.btp_analysis_jobs SET updated_at=now()-interval '4 minutes' WHERE id='${id}'; SELECT public.requeue_stale_analysis_jobs();`);

describe.skipIf(process.env.RUN_ANALYSIS4A_SQL_TESTS !== '1')('correction 4A — SQL exécuté uniquement en PostgreSQL local', () => {
  beforeAll(() => {
    expect(scalar('SELECT current_database();')).toBe('analysis4a_test');
    expect(scalar('SELECT host(inet_server_addr());')).toBe('127.0.0.1');
    expect(scalar('SELECT inet_server_port();')).toBe('55434');
    sql(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;
      CREATE SCHEMA IF NOT EXISTS auth;
      DO $$ BEGIN
        IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
        IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
      END $$;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
      CREATE TABLE public.btp_analysis_jobs(id uuid PRIMARY KEY, user_id uuid, status text, current_step text,
        progress integer DEFAULT 0, step_results jsonb DEFAULT '{}', payload jsonb DEFAULT '{}',
        final_report text, error_message text, attempts integer DEFAULT 0, updated_at timestamptz DEFAULT now());`);
    sql(readFileSync('drizzle/migrations/0000_analysis_attempt_safety.sql', 'utf8'));
    sql(readFileSync('supabase/pending/20261121025700_project_analysis_completed_guard.sql', 'utf8'));
  });

  it('plafonne trois tentatives globales, conserve tous les résultats et bloque une quatrième reprise', () => {
    const id = createJob();
    for (let i = 1; i <= 3; i++) {
      const owner = randomUUID(); expect(claim(id, owner)).toBe(id);
      expect(fail(id, owner)).toBe(i < 3 ? 'queued' : 'failed'); releaseCooldown(id);
    }
    expect(claim(id, randomUUID())).toBe('');
    expect(scalar(`SELECT count(*) FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('3');
    expect(scalar(`SELECT step_results->'dossier'->>'kept' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('268321');
    expect(scalar(`SELECT error_message LIKE 'ANALYSIS_ATTEMPT_LIMIT:%' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('t');
  });
  it('le délai de reprise refuse un claim immédiat, sans consommer une tentative supplémentaire', () => {
    const id = createJob(); const owner = randomUUID(); claim(id, owner); fail(id, owner);
    expect(claim(id, randomUUID())).toBe('');
    expect(scalar(`SELECT count(*) FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('1');
  });
  it('détecte trois interruptions brutales, clôture leur historique et arrête définitivement le job', () => {
    const id = createJob();
    for (let i = 0; i < 3; i++) { const o = randomUUID(); claim(id, o); startCall(id, o, 'global_analysis'); makeStale(id); releaseCooldown(id); }
    expect(scalar(`SELECT status FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('failed');
    expect(scalar(`SELECT count(*) FROM public.btp_analysis_calls WHERE job_id='${id}' AND status='worker_interrupted' AND ended_at IS NULL AND duration_ms IS NULL AND input_tokens IS NULL AND detected_at IS NOT NULL;`)).toBe('3');
    expect(claim(id, randomUUID())).toBe('');
  });
  it('deux workers concurrents ne peuvent pas prendre la même étape', async () => {
    const id = createJob();
    const outputs = await Promise.all([randomUUID(), randomUUID()].map(o => queryAsync(`BEGIN; SELECT (public.claim_analysis_job('${id}','${o}')).id; SELECT pg_sleep(0.05); COMMIT;`)));
    expect(outputs.filter(out => out.includes(id))).toHaveLength(1);
    expect(scalar(`SELECT count(*) FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('1');
  });
  it('une réponse et son historique sont sauvegardés atomiquement avec les résultats', () => {
    const id = createJob(), o = randomUUID(); claim(id, o); const c = startCall(id, o, 'global_analysis');
    expect(scalar(`SELECT public.record_analysis_call('${c}','${o}','response_received',1200,54321,456,'msg_test',200);`)).toBe('t');
    expect(commit(id, o, 'global_analysis', 'finalize')).toBe('t');
    expect(scalar(`SELECT status||':'||input_tokens||':'||output_tokens||':'||jsonb_array_length(events) FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('response_saved:54321:456:3');
    expect(scalar(`SELECT saved_at IS NOT NULL AND ended_at IS NOT NULL FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('t');
    expect(scalar(`SELECT status FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('saved');
  });
  it('trace une sauvegarde échouée séparément de la réception fournisseur', () => {
    const id = createJob(), o = randomUUID(); claim(id, o); const c = startCall(id, o, 'global_analysis');
    sql(`SELECT public.record_analysis_call('${c}','${o}','response_received',100,NULL,NULL,NULL,200);`); fail(id, o, 'ANALYSIS_SAVE_FAILED: échec simulé');
    expect(scalar(`SELECT status||':'||jsonb_array_length(events) FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('save_failed:3');
    expect(scalar(`SELECT input_tokens IS NULL AND output_tokens IS NULL FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('t');
  });
  it('les appels du document sont plafonnés à deux, y compris après interruption et reprise', () => {
    const id = createJob('project_docs_facts','doc:0'), o = randomUUID(); claim(id,o);
    expect(startCall(id,o,'doc:0')).not.toBe(''); expect(startCall(id,o,'doc:0')).not.toBe('');
    expect(startCall(id,o,'doc:0')).toBe(''); makeStale(id); releaseCooldown(id);
    const o2 = randomUUID(); claim(id,o2); expect(startCall(id,o2,'doc:0')).toBe('');
  });
  it('chaque document et chaque lot Word dispose de son propre budget, même après plus de trois échecs cumulés', () => {
    for (const kind of ['project_docs_facts', 'docx_quote_batch']) {
      const id = createJob(kind, kind === 'docx_quote_batch' ? 'prepare' : 'doc:0');
      if (kind === 'docx_quote_batch') { const o = randomUUID(); claim(id,o); commit(id,o,'prepare','extract:0'); }
      for (let i = 0; i < 4; i++) {
        const step = kind === 'docx_quote_batch' ? `extract:${i}` : `doc:${i}`;
        let o = randomUUID(); expect(claim(id,o)).toBe(id); expect(fail(id,o)).toBe('queued'); releaseCooldown(id);
        o = randomUUID(); expect(claim(id,o)).toBe(id); expect(commit(id,o,step,i===3?'dossier':`doc:${i+1}`)).toBe('t');
      }
      expect(scalar(`SELECT status FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('queued');
      expect(scalar(`SELECT attempts FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('4');
      let o = randomUUID(); expect(claim(id,o)).toBe(id);
      expect(commit(id,o,kind==='docx_quote_batch'?'merge':'dossier','global_analysis')).toBe('t');
      o = randomUUID(); expect(claim(id,o)).toBe(id);
    }
  });
  it('un worker ayant perdu son lease ne peut plus sauver ni tracer après une reprise', () => {
    const id = createJob(), o = randomUUID(); claim(id,o); const c=startCall(id,o,'global_analysis'); makeStale(id); releaseCooldown(id); claim(id,randomUUID());
    expect(commit(id,o,'global_analysis','finalize')).toBe('f');
    expect(scalar(`SELECT public.record_analysis_call('${c}','${o}','response_received',100);`)).toBe('f');
  });
  it('refuse un plafond attribué à cette étape, ne déduit rien du compteur historique et ne reprend pas un job arrêté', () => {
    const legacy = createJob('project_docs_facts','global_analysis',12); expect(claim(legacy,randomUUID())).toBe(legacy);
    const id = createJob('project_docs_facts','global_analysis',12);
    sql(`UPDATE public.btp_analysis_jobs SET payload = payload || '{"recovery_by_step":{"global_analysis":3}}' WHERE id='${id}';`);
    expect(claim(id,randomUUID())).toBe('');
    expect(scalar(`SELECT status FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('failed');
    const stopped=createJob(); sql(`UPDATE public.btp_analysis_jobs SET status='failed', attempts=12 WHERE id='${stopped}';`);
    makeStale(stopped); expect(claim(stopped,randomUUID())).toBe('');
    expect(scalar(`SELECT status||':'||attempts FROM public.btp_analysis_jobs WHERE id='${stopped}';`)).toBe('failed:12');
  });
  it('refuse une erreur libre qui pourrait contenir une clé ou un texte documentaire dans les traces', () => {
    const id=createJob(), o=randomUUID(); claim(id,o); const c=startCall(id,o,'global_analysis');
    expect(scalar(`SELECT public.record_analysis_call('${c}','${o}','secret-document',100);`)).toBe('f');
    expect(scalar(`SELECT error_message IS NULL FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('t');
  });
  it('ne marque jamais la première réponse rejetée comme sauvegardée lors de la réussite du second appel', () => {
    const id=createJob('project_docs_facts','doc:0'), o=randomUUID(); claim(id,o);
    const c1=startCall(id,o,'doc:0'); sql(`SELECT public.record_analysis_call('${c1}','${o}','response_received',100);`);
    const c2=startCall(id,o,'doc:0'); sql(`SELECT public.record_analysis_call('${c2}','${o}','response_received',100);`);
    expect(commit(id,o,'doc:0','doc:1')).toBe('t');
    expect(scalar(`SELECT status FROM public.btp_analysis_calls WHERE id='${c1}';`)).toBe('response_rejected');
    expect(scalar(`SELECT status FROM public.btp_analysis_calls WHERE id='${c2}';`)).toBe('response_saved');
  });
  it('un worker actif avant installation, sans trace, clôture le document au plafond puis poursuit le suivant', () => {
    const id=createJob('project_docs_facts','doc:0');
    for (let i=0; i<2; i++) {
      const o=randomUUID();
      sql(`UPDATE public.btp_analysis_jobs SET status='running', payload=payload||'{"lease_owner":"${o}"}' WHERE id='${id}';`);
      expect(fail(id,o)).toBe('queued');
    }
    expect(scalar(`SELECT step_results->'doc:0'->>'status' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('failed');
    expect(claim(id,randomUUID())).toBe(id);
    expect(scalar(`SELECT current_step FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('doc:1');
  });
  it('une réponse tronquée se distingue dun échec de sauvegarde sans persister la réponse', () => {
    const id=createJob(), o=randomUUID(); claim(id,o); const c=startCall(id,o,'global_analysis');
    sql(`SELECT public.record_analysis_call('${c}','${o}','response_received',100);`);
    fail(id,o,'Analyse globale tronquée (longueur maximale).');
    expect(scalar(`SELECT status||':'||error_type FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('response_rejected:output_truncated');
    expect(scalar(`SELECT error_type FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('output_truncated');
  });
  it('deux interruptions documentaires clôturent seulement la source échouée et préservent les autres résultats', () => {
    const id=createJob('project_docs_facts','doc:0');
    sql(`UPDATE public.btp_analysis_jobs SET step_results='{"doc:1":{"status":"completed","contract":{"facts":[{"factId":"kept"}]}},"doc:2":{"status":"needs_chunking"}}' WHERE id='${id}';`);
    const before=scalar(`SELECT step_results->'doc:1' FROM public.btp_analysis_jobs WHERE id='${id}';`);
    for(let i=0;i<2;i++) { const o=randomUUID(); expect(claim(id,o)).toBe(id); startCall(id,o,'doc:0'); makeStale(id); releaseCooldown(id); }
    expect(scalar(`SELECT status||':'||current_step FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('queued:doc:3');
    expect(scalar(`SELECT step_results->'doc:0'->>'status'||':'||(step_results->'doc:0'->>'failure_reason') FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('failed:worker_interrupted');
    expect(scalar(`SELECT step_results->'doc:0'->>'contract' IS NULL FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('t');
    expect(scalar(`SELECT step_results->'doc:1' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe(before);
    expect(scalar(`SELECT step_results->'doc:2'->>'status' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('needs_chunking');
    expect(scalar(`SELECT public.requeue_stale_analysis_jobs();`)).toBe('0');
    expect(claim(id,randomUUID())).toBe(id);
  });
  it('un plafond de réservations ferme le document sans autoriser un troisième appel, puis passe au suivant', () => {
    const id=createJob('project_docs_facts','doc:0'), o=randomUUID(); claim(id,o);
    startCall(id,o,'doc:0'); startCall(id,o,'doc:0'); makeStale(id); releaseCooldown(id);
    expect(claim(id,randomUUID())).toBe('');
    expect(scalar(`SELECT status||':'||current_step FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('queued:doc:1');
    expect(scalar(`SELECT count(*) FROM public.btp_analysis_calls WHERE job_id='${id}' AND step='doc:0';`)).toBe('2');
    expect(scalar(`SELECT step_results->'doc:0'->>'attempts' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('2');
    expect(claim(id,randomUUID())).toBe(id);
  });
  it('un refus terminal pour limite documentaire conserve le dossier ouvert et son résultat failed explicite', () => {
    const id=createJob('project_docs_facts','doc:0'), o=randomUUID(); claim(id,o);
    expect(scalar(`SELECT public.fail_analysis_step('${id}','${o}','ANALYSIS_ATTEMPT_LIMIT: réservation refusée',true);`)).toBe('queued');
    expect(scalar(`SELECT step_results->'doc:0'->>'status' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('failed');
    expect(claim(id,randomUUID())).toBe(id);
  });
  it('un échec de sauvegarde RPC porte le code save_failed dans les trois registres', () => {
    const id=createJob(),o=randomUUID();claim(id,o); const c=startCall(id,o,'global_analysis');
    sql(`SELECT public.record_analysis_call('${c}','${o}','response_received',100);`);
    fail(id,o,'ANALYSIS_SAVE_FAILED: La sauvegarde de la réponse a échoué.');
    expect(scalar(`SELECT error_type FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('save_failed');
    expect(scalar(`SELECT status FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('save_failed');
    expect(scalar(`SELECT error_message LIKE 'ANALYSIS_SAVE_FAILED:%' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('t');
  });
  it.each(['lease_lost','response_empty','output_truncated','invalid_contract'])('classe %s sans recopier le message libre', code => {
    const id=createJob(),o=randomUUID();claim(id,o);startCall(id,o,'global_analysis');
    fail(id,o,`${code}: CLIENT_CONFIDENTIEL api-key=secret`);
    expect(scalar(`SELECT error_type FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe(code);
    expect(scalar(`SELECT error_message LIKE '%CONFIDENTIEL%' OR error_message LIKE '%secret%' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('f');
    expect(scalar(`SELECT count(*) FROM public.btp_analysis_calls WHERE job_id='${id}' AND error_message LIKE '%secret%';`)).toBe('0');
  });
  it('un message inconnu est neutralisé et les retours faux/null ne confirment pas une écriture', () => {
    const id=createJob(),o=randomUUID();claim(id,o);
    expect(commit(id,randomUUID(),'global_analysis','finalize')).toBe('f');
    expect(fail(id,randomUUID(),'CLIENT_CONFIDENTIEL')).toBe('');
    fail(id,o,'CLIENT_CONFIDENTIEL api-key=secret');
    expect(scalar(`SELECT error_message FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('step_failed: Échec du traitement de cette étape.');
  });
  it('le plafond ne masque pas la cause save_failed de la dernière tentative documentaire', () => {
    const id=createJob('project_docs_facts','doc:0');let o=randomUUID();claim(id,o);fail(id,o);releaseCooldown(id);
    o=randomUUID();claim(id,o); const c=startCall(id,o,'doc:0');
    sql(`SELECT public.record_analysis_call('${c}','${o}','response_received',100);`);
    expect(fail(id,o,'ANALYSIS_SAVE_FAILED: La sauvegarde de la réponse a échoué.')).toBe('queued');
    expect(scalar(`SELECT error_type FROM public.btp_analysis_attempts WHERE job_id='${id}' AND worker_id='${o}';`)).toBe('save_failed');
    expect(scalar(`SELECT step_results->'doc:0'->>'failure_reason' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('save_failed');
    expect(scalar(`SELECT status FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('save_failed');
  });
  it('enregistrer un document failed ne marque pas sa réponse invalide comme response_saved', () => {
    const id=createJob('project_docs_facts','doc:0'),o=randomUUID();claim(id,o);const c=startCall(id,o,'doc:0');
    sql(`SELECT public.record_analysis_call('${c}','${o}','response_received',100);`);
    expect(scalar(`SELECT public.commit_analysis_step('${id}','${o}','doc:0','{"status":"failed","contract":null,"failure_code":"invalid_contract"}',21,'doc:1','queued',NULL);`)).toBe('t');
    expect(scalar(`SELECT status||':'||error_type FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('response_rejected:invalid_contract');
    expect(scalar(`SELECT saved_at IS NULL FROM public.btp_analysis_calls WHERE id='${c}';`)).toBe('t');
    expect(scalar(`SELECT current_step FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('doc:1');
  });
  it('un ancien job queued dont toutes les étapes sont enregistrées se clôture sans nouvel appel ni tentative', () => {
    const id=createJob();
    sql(`UPDATE public.btp_analysis_jobs SET step_results=step_results||'{"global_analysis":{"kept":true},"final":{"kind":"project_global_analysis_ready"}}' WHERE id='${id}';`);
    const before=scalar(`SELECT step_results FROM public.btp_analysis_jobs WHERE id='${id}';`);
    expect(claim(id,randomUUID())).toBe('');
    expect(scalar(`SELECT status||':'||current_step||':'||progress||':'||error_message FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('completed_without_report:completed_without_report:97:GLOBAL_ANALYSIS_FAILED');
    expect(scalar(`SELECT count(*) FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('0');
    expect(scalar(`SELECT step_results FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe(before);
  });
  it('toutes les clés avec un rapport global completed non vide donnent completed', () => {
    const id = createJob();
    sql(`UPDATE public.btp_analysis_jobs SET step_results=step_results||'{"global_analysis":{"data":{"status":"completed","text":" Rapport sauvegardé "}},"final":{}}' WHERE id='${id}';`);
    const before = scalar(`SELECT step_results FROM public.btp_analysis_jobs WHERE id='${id}';`);
    expect(claim(id, randomUUID())).toBe('');
    expect(scalar(`SELECT status||':'||current_step||':'||progress FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('completed:completed:100');
    expect(scalar(`SELECT error_message IS NULL FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('t');
    expect(scalar(`SELECT step_results FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe(before);
  });
  it('toutes les clés avec needs_chunking et texte null donnent la raison de taille sans rapport', () => {
    const id = createJob();
    sql(`UPDATE public.btp_analysis_jobs SET step_results=step_results||'{"global_analysis":{"data":{"status":"needs_chunking","text":null}},"final":{}}' WHERE id='${id}';`);
    const before = scalar(`SELECT step_results FROM public.btp_analysis_jobs WHERE id='${id}';`);
    expect(claim(id, randomUUID())).toBe('');
    expect(scalar(`SELECT status||':'||current_step||':'||progress||':'||error_message FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('completed_without_report:completed_without_report:97:GLOBAL_ANALYSIS_TOO_LARGE');
    expect(scalar(`SELECT step_results FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe(before);
    expect(scalar(`SELECT count(*) FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('0');
  });
  it.each([false, true])('commit completed contrôle le rapport qui sera persisté : rapport présent=%s', hasReport => {
    const id = createJob(), owner = randomUUID();
    expect(claim(id, owner)).toBe(id);
    const result = JSON.stringify({ data: { status: 'completed', text: hasReport ? 'Rapport sauvegardé' : '\t\n\u00a0\ufeff' } });
    expect(scalar(`SELECT public.commit_analysis_step('${id}','${owner}','global_analysis','${result}',100,'completed','completed','Marqueur seul');`)).toBe('t');
    expect(scalar(`SELECT status||':'||current_step||':'||progress FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe(hasReport ? 'completed:completed:100' : 'completed_without_report:completed_without_report:97');
    expect(scalar(`SELECT error_message FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe(hasReport ? '' : 'GLOBAL_ANALYSIS_FAILED');
    expect(scalar(`SELECT step_results->'global_analysis' FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe(scalar(`SELECT '${result}'::jsonb;`));
    expect(scalar(`SELECT status FROM public.btp_analysis_attempts WHERE job_id='${id}';`)).toBe('saved');
  });
  it('le trigger corrige une mise à jour directe completed sans rapport', () => {
    const id = createJob();
    const before = scalar(`SELECT step_results FROM public.btp_analysis_jobs WHERE id='${id}';`);
    sql(`UPDATE public.btp_analysis_jobs SET status='completed',current_step='completed',progress=100 WHERE id='${id}';`);
    expect(scalar(`SELECT status||':'||current_step||':'||progress||':'||error_message FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('completed_without_report:completed_without_report:97:GLOBAL_ANALYSIS_FAILED');
    expect(scalar(`SELECT step_results FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe(before);
  });
  it.each(['docx_quote_batch', 'persistent_ui_test'])('%s conserve completed sans rapport dans claim, commit et mise à jour directe', kind => {
    const id = createJob(kind);
    const results = kind === 'docx_quote_batch'
      ? { prepare: {}, 'extract:0': {}, 'extract:1': {}, 'extract:2': {}, 'extract:3': {}, merge: {}, final: {} }
      : { prepare: {}, ai_test: {}, final: {} };
    sql(`UPDATE public.btp_analysis_jobs SET step_results='${JSON.stringify(results)}' WHERE id='${id}';`);
    expect(claim(id, randomUUID())).toBe('');
    expect(scalar(`SELECT status||':'||progress FROM public.btp_analysis_jobs WHERE id='${id}';`)).toBe('completed:100');
    const commitId = createJob(kind), owner = randomUUID();
    expect(claim(commitId, owner)).toBe(commitId);
    expect(scalar(`SELECT public.commit_analysis_step('${commitId}','${owner}','final','{}',100,'completed','completed',NULL);`)).toBe('t');
    expect(scalar(`SELECT status||':'||progress FROM public.btp_analysis_jobs WHERE id='${commitId}';`)).toBe('completed:100');
    const directId = createJob(kind);
    sql(`UPDATE public.btp_analysis_jobs SET status='completed',progress=100 WHERE id='${directId}';`);
    expect(scalar(`SELECT status||':'||progress FROM public.btp_analysis_jobs WHERE id='${directId}';`)).toBe('completed:100');
  });
  it('le trigger ne change pas un ancien job déjà completed mis à jour sans rapport', () => {
    const id = randomUUID();
    sql(`INSERT INTO public.btp_analysis_jobs(id,user_id,status,current_step,progress,payload,error_message) VALUES ('${id}','${randomUUID()}','completed','completed',100,'{"kind":"project_docs_facts"}','ancien marqueur');`);
    const before = scalar(`SELECT to_jsonb(j) FROM public.btp_analysis_jobs j WHERE id='${id}';`);
    sql(`UPDATE public.btp_analysis_jobs SET status='completed',step_results='{}' WHERE id='${id}';`);
    expect(scalar(`SELECT to_jsonb(j) FROM public.btp_analysis_jobs j WHERE id='${id}';`)).toBe(before);
  });
});