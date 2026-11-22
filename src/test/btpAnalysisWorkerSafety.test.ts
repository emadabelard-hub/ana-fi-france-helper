/** Execute the actual worker in an isolated VM; every network/database operation is fake. */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { confirmedFailureStatus, requireStepCommit, safeAnalysisError } from '../../supabase/functions/_shared/btpAnalysisStepSafety';
import { AttemptJournalError, tracedAnalysisFetch } from '../../supabase/functions/_shared/btpAnalysisTelemetry';
import { processSingleDocument, isApiSizeLimitError, DocumentTooLargeError, PermanentDocumentRequestError, RESPONSE_MAX_TOKENS } from '../../supabase/functions/_shared/btpDocumentSequence';
import { validateBtpFacts } from '../../supabase/functions/_shared/btpFactsContract';
import { buildProjectFactsDossier } from '../../supabase/functions/_shared/btpProjectDossier';
import { runGlobalAnalysis } from '../../supabase/functions/_shared/btpGlobalAnalysisPrompt';
import { BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT } from '../../supabase/functions/_shared/btpFactualPrompt';

const workerCode=ts.transpileModule(readFileSync('supabase/functions/btp-analysis-job/index.ts','utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import[\s\S]*?;\s*/gm,'').replace(/^export /gm,'');
const token='worker-token-for-local-tests';
const id='11111111-1111-4111-8111-111111111111';
const base=() => ({ id, status:'queued', payload:{ kind:'project_docs_facts', documents:[{ docId:'d1',fileName:'private.pdf',kind:'pdf',unreadable:true }] }, step_results:{} });

type SaveOutcome = { data: unknown; error: unknown; applied?: boolean; loseOwner?: boolean };
function harness(seed: ReturnType<typeof base> | Record<string, any>, options: { commit?: unknown; commitStep?: string; fail?: unknown; update?: unknown;
  commits?: SaveOutcome[]; records?: SaveOutcome[]; readError?: boolean; differentSavedResult?: boolean; differentSavedMetadata?: boolean }={}) {
  const job: Record<string, any>=structuredClone(seed);
  const logs: unknown[][]=[];
  const commits = [...(options.commits ?? [])], records = [...(options.records ?? [])];
  let attempt: Record<string, any> = {}, call: Record<string, any> = {};
  const provider=vi.fn(async (_init: RequestInit) => new Response('{}'));
  const rpc=vi.fn(async (name: string,args: Record<string,any>={}) => {
    if(name==='get_analysis_worker_token') return {data:token,error:null};
    if(name==='claim_analysis_job') {
      if(job.status!=='queued') return {data:null,error:null};
      job.status='running'; job.payload.lease_owner=args._owner;
      attempt={job_id:job.id,worker_id:args._owner,step:job.current_step,status:'running'};
      return {data:structuredClone(job),error:null};
    }
    if(name==='heartbeat_analysis_job') return {data:job.payload.lease_owner===args._owner,error:null};
    if(name==='begin_analysis_call') {
      call={id:'22222222-2222-4222-8222-222222222222',job_id:job.id,worker_id:args._owner,step:args._step,status:'call_started'};
      attempt.step=args._step;
      return {data:call.id,error:null};
    }
    if(name==='record_analysis_call') {
      const outcome=records.shift();
      if(!outcome || outcome.applied) Object.assign(call,{status:args._status,duration_ms:args._duration_ms,input_tokens:args._input_tokens,
        output_tokens:args._output_tokens,provider_request_id:args._provider_id,http_status:args._http_status});
      if(outcome?.loseOwner) job.payload.lease_owner='another-worker';
      if(options.differentSavedMetadata && outcome?.applied) call.output_tokens=999;
      return outcome ?? {data:true,error:null};
    }
    if(name==='commit_analysis_step') {
      if(options.commit && (!options.commitStep || options.commitStep===args._step)) return options.commit;
      const outcome=commits.shift();
      if(outcome && !outcome.applied) {
        if(outcome.loseOwner) job.payload.lease_owner='another-worker';
        return outcome;
      }
      job.step_results[args._step]=JSON.parse(JSON.stringify(args._result)); job.status=args._status;
      job.progress=args._progress; job.current_step=args._current_step;
      job.final_report=args._final_report ?? job.final_report;
      attempt={...attempt,job_id:job.id,worker_id:args._owner,step:args._step,status:'saved'};
      if(options.differentSavedResult && outcome?.applied) job.step_results[args._step]={different:'result'};
      if(call.status==='response_received') call.status='response_saved';
      delete job.payload.lease_owner;
      return outcome ?? {data:true,error:null};
    }
    if(name==='fail_analysis_step') {
      if(job.status!=='running'||job.payload.lease_owner!==args._owner) return {data:null,error:null};
      const outcome = (options.fail ?? {data:args._terminal?'failed':'queued',error:null}) as {data:unknown;error:unknown};
      if(!outcome.error && (outcome.data==='queued'||outcome.data==='failed')) job.status=outcome.data;
      return outcome;
    }
    throw new Error('Unexpected mock RPC');
  });
  const select=(table:string)=>{
    const filters:Record<string,unknown>={};
    const query={eq:(field:string,value:unknown)=>{filters[field]=value;return query;},maybeSingle:async()=>{
      if(options.readError) return {data:null,error:{code:'PGRST001',message:'private read error'}};
      const row=table==='btp_analysis_jobs'?job:table==='btp_analysis_attempts'?attempt:call;
      return {data:Object.entries(filters).every(([key,value])=>row[key]===value)?structuredClone(row):null,error:null};
    }};
    return query;
  };
  let handler: ((request: Request)=>Promise<Response>) | undefined;
  const fakeFetch=vi.fn(async()=>new Response('{}'));
  const update=vi.fn((patch: Record<string,unknown>)=>{
    const filters: Record<string,unknown>={};
    const query={eq:(field:string,value:unknown)=>{filters[field]=value;return query;},select:()=>query,maybeSingle:async()=>{
      if(options.update) return options.update;
      if(filters.id!==job.id || filters.status!==job.status) return {data:null,error:null};
      Object.assign(job,patch);return {data:{id:job.id},error:null};
    }};
    return query;
  });
  const delay=vi.fn((fn:()=>void,_ms:number)=>setTimeout(fn,0));
  runInNewContext(workerCode, {
    Deno:{env:{get:()=> 'local-test-only'},serve:(fn: typeof handler)=>{handler=fn;}},
    createClient:()=>({rpc,from:(table:string)=>({update,select:()=>select(table)})}),corsHeaders:{},crypto:webcrypto,Request,Response,URL,Error,fetch:fakeFetch,
    console:{log:(...args: unknown[])=>logs.push(args),error:(...args: unknown[])=>logs.push(args)},
    setInterval,clearInterval,setTimeout:delay,
    requireStepCommit,confirmedFailureStatus,safeAnalysisError,tracedAnalysisFetch,AttemptJournalError,
    processSingleDocument,isApiSizeLimitError,DocumentTooLargeError,PermanentDocumentRequestError,RESPONSE_MAX_TOKENS,buildProjectFactsDossier,
    BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT,anthropicCompatFetch:provider,runGlobalAnalysis,
  });
  const run=async()=>{
    if(!handler) throw new Error('Worker handler missing');
    const response=await handler(new Request('http://localhost/work?mode=work',{method:'POST',headers:{'x-worker-token':token},body:JSON.stringify({jobId:id})}));
    return { http:response.status, body:await response.json() };
  };
  return {run,job,rpc,provider,logs,update,delay,trigger:fakeFetch};
}

describe('4A BIS — intégration du worker réel avec services simulés',()=>{
  it('un document illisible est sauvegardé failed, sans appel fournisseur, sans perdre les autres sources',async()=>{
    const seed=base(); const kept={status:'completed',contract:{facts:[{factId:'kept'}]}};
    Object.assign(seed.step_results,{'doc:1':kept});
    const h=harness(seed); const result=await h.run();
    expect(result.body.documentStatus).toBe('failed');
    expect(h.job.step_results['doc:0'].contract).toBeNull();
    expect(h.job.step_results['doc:1']).toEqual(kept);
    expect(h.provider).not.toHaveBeenCalled();
  });
  it.each([false,null])('la finalisation projet ne peut pas annoncer completed sur retour %s',async(data)=>{
    const seed=base(); Object.assign(seed.step_results,{'doc:0':{},dossier:{data:{dossier:{complete:false}}},global_analysis:{data:{status:'completed',text:'Rapport déjà sauvegardé'}}});
    const h=harness(seed,{commit:{data,error:null}}); const result=await h.run();
    expect(result.body.status).not.toBe('completed');
    expect(h.rpc.mock.calls.find(([name])=>name==='fail_analysis_step')?.[1]?._message).toMatch(/^lease_lost:/);
  });
  it('une erreur de sauvegarde arrive au SQL avec ANALYSIS_SAVE_FAILED et sans message client',async()=>{
    const h=harness(base(),{commit:{data:null,error:{message:'CLIENT_CONFIDENTIEL api-key=secret'}}});
    const result=await h.run();
    expect(result.body.failureRecorded).toBe(true);
    expect(h.rpc.mock.calls.find(([name])=>name==='fail_analysis_step')?.[1]?._message).toMatch(/^ANALYSIS_SAVE_FAILED:/);
    expect(JSON.stringify(h.logs)).not.toMatch(/CLIENT_CONFIDENTIEL|api-key|private.pdf/);
    expect(JSON.stringify(h.job.step_results)).toBe('{}');
  });
  it.each([{data:'failed',error:{message:'CLIENT_CONFIDENTIEL'}},{data:null,error:null}])('un échec non confirmé reste explicitement unconfirmed',async(fail)=>{
    const h=harness(base(),{commit:{data:false,error:null},fail}); const result=await h.run();
    expect(result.http).toBe(503);expect(result.body.status).toBe('unconfirmed');
    expect(result.body.failureRecorded).toBe(false);
    expect(JSON.stringify(h.logs)).not.toContain('CLIENT_CONFIDENTIEL');
  });
  it('Word conserve les lots de 50, la fusion déterministe et les prix absents null',async()=>{
    const rows=Array.from({length:51},(_,i)=>({sourceLineIndex:i,headers:['Désignation','Qté','Unité','PU','Total'],cells:i===50?['BA13','25','m²','','']:['BA13','25','m²','48','1200'],tableIndex:0,rowIndex:i}));
    const h=harness({id,status:'queued',payload:{kind:'docx_quote_batch',sourceRows:rows,fileName:'private.docx',plan:{rowCount:51,batchCount:2}},step_results:{}});
    h.provider.mockImplementation(async(init?: RequestInit)=>{
      const request=JSON.parse(String(init?.body));
      const chunk=JSON.parse(request.messages[1].content.split('\n\n')[1].split('\n\nRéponds')[0]);
      const items=chunk.map((r:any)=>({sourceLineIndex:r.sourceLineIndex,description:'BA13',quantity:25,unit:'m²',unitPrice:r.sourceLineIndex===50?null:48,total:r.sourceLineIndex===50?null:1200,priceSource:r.sourceLineIndex===50?'missing':'document',lot:null,sourceFile:'private.docx',evidenceText:r.cells.join(' ')}));
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({items})}}]}));
    });
    for(let i=0;i<5;i++) await h.run();
    const items=h.job.step_results.final.data.items;
    expect(h.provider).toHaveBeenCalledTimes(2);
    expect(h.job.step_results['extract:0'].items).toHaveLength(50);
    expect(h.job.step_results['extract:1'].items).toHaveLength(1);
    expect(items).toHaveLength(51);
    expect(items[0]).toMatchObject({quantity:25,unitPrice:48,total:1200});
    expect(items[50]).toMatchObject({unitPrice:null,total:null,priceSource:'missing'});
    expect(h.job.status).toBe('completed');
    expect(JSON.stringify(h.logs)).not.toMatch(/BA13|private.docx/);
  });
});

const reportSeed=(analysis: unknown) => ({...base(),step_results:{'doc:0':{status:'completed',kept:'source'},dossier:{data:{dossier:{complete:true,kept:'dossier'}}},global_analysis:{data:analysis}}});
const globalSeed=()=>{
  const seed=base();
  const source={docId:'d1',fileName:'private.pdf',status:'completed' as const,attempts:1,error:null,
    contract:validateBtpFacts([{id:'A',descriptionExact:'BA13',quantity:25,unit:'m²',sourceFile:'private.pdf',evidenceText:'BA13 25 m²'}])};
  Object.assign(seed.step_results,{'doc:0':source,dossier:{data:{dossier:buildProjectFactsDossier([source])}}});
  return seed;
};

describe('Statut terminal projet — rapport obtenu et sauvegardé obligatoire',()=>{
  it('un rapport déjà sauvegardé permet completed seulement après commit confirmé',async()=>{
    const seed=reportSeed({status:'completed',text:'Rapport conservé'});const kept=JSON.stringify(seed.step_results);
    const h=harness(seed);const result=await h.run();
    expect(result.body.status).toBe('completed');expect(h.job.progress).toBe(100);
    expect(h.job.step_results.global_analysis.data.text).toBe('Rapport conservé');
    expect(JSON.stringify({...h.job.step_results,final:undefined})).toBe(kept);
    expect(h.update).not.toHaveBeenCalled();expect(h.provider).not.toHaveBeenCalled();
  });
  it.each([null,undefined,'','   '])('un texte sauvegardé %s ne permet jamais completed',async text=>{
    const h=harness(reportSeed({status:'completed',text}));await h.run();
    expect(h.job.status).toBe('completed_without_report');expect(h.job.progress).toBe(97);
    expect(h.job.step_results.final.data.reason).toBe('GLOBAL_ANALYSIS_FAILED');
    expect(h.job.final_report).toBeUndefined();expect(h.provider).not.toHaveBeenCalled();
  });
  it('un refus de taille conserve le dossier et qualifie la fin sans faux rapport',async()=>{
    const seed=reportSeed({status:'needs_chunking',text:null});const before=JSON.stringify(seed.step_results);
    const h=harness(seed);const result=await h.run();
    expect(result.body).toMatchObject({status:'completed_without_report',reason:'GLOBAL_ANALYSIS_TOO_LARGE'});
    expect(JSON.stringify({...h.job.step_results,final:undefined})).toBe(before);
    expect(h.job.final_report).toBeUndefined();expect(h.job.progress).toBeLessThan(100);
    await h.run();expect(h.provider).not.toHaveBeenCalled();
  });
  it('un échec global terminal confirmé devient GLOBAL_ANALYSIS_FAILED sans perdre les faits',async()=>{
    const seed=globalSeed();const before=JSON.stringify(seed.step_results);
    const h=harness(seed,{fail:{data:'failed',error:null}});
    h.provider.mockResolvedValue(new Response('{}',{status:403}));const result=await h.run();
    expect(result.body).toMatchObject({status:'completed_without_report',reason:'GLOBAL_ANALYSIS_FAILED'});
    expect(h.job.error_message).toBe('GLOBAL_ANALYSIS_FAILED');
    expect(JSON.stringify(h.job.step_results)).toBe(before);expect(h.provider).toHaveBeenCalledTimes(1);
  });
  it('un échec de finalisation ne requalifie pas un job qui possède déjà son rapport sauvegardé',async()=>{
    const h=harness(reportSeed({status:'completed',text:'Rapport déjà sauvegardé'}),{commit:{data:null,error:{message:'mock final save error'}},fail:{data:'failed',error:null}});
    const result=await h.run();expect(result.body.status).toBe('failed');expect(h.update).not.toHaveBeenCalled();
    expect(h.job.step_results.global_analysis.data.text).toBe('Rapport déjà sauvegardé');
  });
  it('un rapport reçu mais non sauvegardé devient REPORT_SAVE_FAILED à l’arrêt confirmé',async()=>{
    const seed=globalSeed();const before=JSON.stringify(seed.step_results);
    const h=harness(seed,{commit:{data:null,error:{message:'mock save error'}},commitStep:'global_analysis',fail:{data:'failed',error:null}});
    h.provider.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'Rapport reçu'}}]})));
    const result=await h.run();
    expect(result.body).toMatchObject({status:'completed_without_report',reason:'REPORT_SAVE_FAILED'});
    expect(h.job.error_message).toBe('REPORT_SAVE_FAILED');expect(JSON.stringify(h.job.step_results)).toBe(before);
  });
  it('une reprise temporaire reste queued et conserve le mécanisme de sauvegarde existant',async()=>{
    const h=harness(globalSeed());h.provider.mockResolvedValueOnce(new Response('{}',{status:500}));
    expect((await h.run()).body.status).toBe('queued');expect(h.update).not.toHaveBeenCalled();
    h.provider.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'Rapport après reprise'}}]})));
    await h.run();await h.run();expect(h.job.status).toBe('completed');expect(h.provider).toHaveBeenCalledTimes(2);
    expect(h.job.step_results.global_analysis.data.text).toBe('Rapport après reprise');
  });
  it('une qualification terminale non confirmée ne prétend pas être enregistrée',async()=>{
    const h=harness(globalSeed(),{fail:{data:'failed',error:null},update:{data:null,error:{message:'mock update error'}}});
    h.provider.mockResolvedValue(new Response('{}',{status:403}));const result=await h.run();
    expect(result.body).toMatchObject({status:'unconfirmed',failureRecorded:false});expect(h.job.status).toBe('failed');
  });
});

describe('Simulations du parcours complet — fournisseur et base factices',()=>{
  it.each([1,5,20])('%i documents admissibles aboutissent à un rapport sauvegardé',async count=>{
    const seed={...base(),payload:{kind:'project_docs_facts',documents:Array.from({length:count},(_,i)=>({docId:`d${i}`,fileName:`d${i}.pdf`,kind:'pdf',text:`Prestation ${i}`}))}};
    const h=harness(seed);
    h.provider.mockImplementation(async(init:RequestInit)=>{
      const request=JSON.parse(String(init.body));
      const content=Array.isArray(request.messages[1].content)?`<ANAFYPRO_BTP_FACTS>${JSON.stringify({facts:[{id:'A',descriptionExact:'Pose',quantity:1,unit:'u',sourcePage:1,evidenceText:'Pose'}]})}</ANAFYPRO_BTP_FACTS>`:'## 1. Résumé du projet\nRapport simulé sauvegardé';
      return new Response(JSON.stringify({choices:[{message:{content}}]}));
    });
    for(let i=0;i<count+3;i++) await h.run();
    expect(h.job.status).toBe('completed');expect(h.provider).toHaveBeenCalledTimes(count+1);
    expect(h.job.step_results.global_analysis.data.text).toContain('Rapport simulé sauvegardé');
  });
  it.each([800,1600])('dossier de %i faits : refus global hors budget et faits intacts',async count=>{
    const h=harness({...base(),payload:{kind:'project_docs_facts',documents:[{docId:'d1',fileName:'test.pdf',kind:'pdf',text:'Prestations du dossier fictif'}]}});
    const facts=Array.from({length:count},(_,i)=>({id:`F${i}`,descriptionExact:`Prestation ${i}`,quantity:1,unit:'u',sourceFile:'test.pdf',evidenceText:`Prestation ${i}`}));
    h.provider.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:`<ANAFYPRO_BTP_FACTS>${JSON.stringify({facts})}</ANAFYPRO_BTP_FACTS>`}}]})));
    await h.run();await h.run();const kept=JSON.stringify(h.job.step_results.dossier);
    await h.run();await h.run();
    expect(h.job.status).toBe('completed_without_report');expect(h.job.step_results.final.data.reason).toBe('GLOBAL_ANALYSIS_TOO_LARGE');
    expect(h.job.step_results.global_analysis.data.estimatedInputTokens).toBeGreaterThan(138_000);
    expect(h.job.step_results.dossier.data.dossier.contract.facts).toHaveLength(count);
    expect(JSON.stringify(h.job.step_results.dossier)).toBe(kept);expect(h.provider).toHaveBeenCalledTimes(1);
    console.log('SIMULATION',count,JSON.stringify({status:h.job.status,reason:h.job.step_results.final.data.reason,tokens:h.job.step_results.global_analysis.data.estimatedInputTokens}));
  });
  it('un unique document hors budget reste needs_chunking et le dossier vide ne déclenche aucun global',async()=>{
    const h=harness({...base(),payload:{kind:'project_docs_facts',documents:[{docId:'d1',fileName:'big.pdf',kind:'pdf',text:'x'.repeat(300_000)}]}});
    h.provider.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'Rapport du dossier incomplet : document non exploité big.pdf'}}]})));
    await h.run();expect(h.job.step_results['doc:0'].status).toBe('needs_chunking');expect(h.provider).not.toHaveBeenCalled();
    await h.run();await h.run();await h.run();
    expect(h.job.status).toBe('completed_without_report');expect(h.job.step_results.dossier.data.dossier.complete).toBe(false);
    expect(h.job.step_results.global_analysis.data).toMatchObject({failureCode:'EMPTY_FACTUAL_DOSSIER',text:null,factsCount:0});
    expect(h.provider).not.toHaveBeenCalled();expect(h.rpc.mock.calls.filter(([name])=>name==='begin_analysis_call')).toHaveLength(0);
  });
});

const factualSeed = () => ({ ...base(), payload: { kind: 'project_docs_facts', documents: [
  { docId: 'd1', fileName: 'private.docx', kind: 'docx', text: 'BA13 25 m²' },
] } });
const factualReply = () => new Response(JSON.stringify({ id: 'msg_factual', usage: { prompt_tokens: 11, completion_tokens: 22 },
  choices: [{ message: { content: `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ facts: [{ id: 'A', descriptionExact: 'BA13', quantity: 25, unit: 'm²', evidenceText: 'BA13 25 m²', sourceFile: 'private.docx' }] })}</ANAFYPRO_BTP_FACTS>` } }] }));
const globalReply = () => new Response(JSON.stringify({ id: 'msg_global', usage: { prompt_tokens: 33, completion_tokens: 44 }, choices: [{ message: { content: 'Rapport reçu sans recalcul' } }] }));
const temporary = { data: null, error: { code: 'PGRST001', message: 'CLIENT_CONFIDENTIEL api-key=secret' } };
const rpcCalls = (h: ReturnType<typeof harness>, name: string) => h.rpc.mock.calls.filter(([n]) => n === name);

describe('Phase 2F — confirmation selon la représentation JSON persistée', () => {
  const start = workerCode.indexOf('function sameSavedValue(');
  const end = workerCode.indexOf('function temporarySaveError(', start);
  const same = runInNewContext(`${workerCode.slice(start, end)}; sameSavedValue;`) as (a: unknown, b: unknown) => boolean;

  it.each([
    [{ quantity: 25, optional: undefined }, { quantity: 25 }],
    [{ source: { reference: 'A', optional: undefined } }, { source: { reference: 'A' } }],
    [[undefined, { quantity: 25, optional: undefined }, null], [null, { quantity: 25 }, null]],
    [{ value: null, list: [] }, { list: [], value: null }],
    [{ facts: [{ reference: 'A', quantity: 25, citation: 'BA13 25 m²' }] }, { facts: [{ citation: 'BA13 25 m²', quantity: 25, reference: 'A' }] }],
  ])('confirme exactement les équivalences JSON %#', (memory, persisted) => {
    expect(same(memory, persisted)).toBe(true);
    expect(same(persisted, memory)).toBe(true);
  });
  it.each([
    [{ quantity: 25 }, { quantity: 26 }],
    [{ reference: 'A' }, { reference: 'B' }],
    [{ citation: 'BA13 25 m²' }, { citation: 'BA13 26 m²' }],
    [{ nested: { quantity: 25 } }, { nested: { quantity: 26 } }],
    [[1, 2], [2, 1]], [[null], []],
    [{ value: null }, {}], [{ value: null }, { value: undefined }],
    [undefined, undefined], [undefined, null], [{ value: 25n }, { value: '25' }],
  ])('refuse les divergences et valeurs non persistables %#', (memory, persisted) => {
    expect(same(memory, persisted)).toBe(false);
  });
  it.each([false, null])('un RPC ambigu %s n’est confirmé que par la lecture JSON exacte', async data => {
    const h = harness(globalSeed(), { commits: [{ data, error: null, applied: true }] });
    h.provider.mockImplementation(async () => globalReply());
    const result = await h.run();
    expect(result.body.status).toBe('queued');
    expect(h.job.step_results.global_analysis.data.text).toBe('Rapport reçu sans recalcul');
    expect(rpcCalls(h, 'commit_analysis_step')).toHaveLength(1);
    expect(h.provider).toHaveBeenCalledTimes(1);
    expect(h.trigger).not.toHaveBeenCalled();
    expect(h.delay).not.toHaveBeenCalled();
  });
});

describe('Phase 2D — trois corrections isolées au parcours projet', () => {
  it.each(['messages: Field required', "messages.0.role: Input should be 'user' or 'assistant'", 'messages.1.content.0.image.source.data: Invalid base64 data'])(
    'un HTTP 400 permanent %s ne déclenche pas de second appel documentaire', async message => {
      const h = harness(factualSeed());
      h.provider.mockImplementation(async () => new Response(JSON.stringify({ error: { message: JSON.stringify({ error: { type: 'invalid_request_error', message } }) } }), { status: 400 }));
      const r = await h.run();
      expect(r.body.documentStatus).toBe('failed'); expect(h.provider).toHaveBeenCalledTimes(1);
      expect(rpcCalls(h, 'begin_analysis_call')).toHaveLength(1); expect(h.job.step_results['doc:0'].attempts).toBe(1);
      expect(h.job.step_results['doc:0'].contract).toBeNull(); expect(h.job.status).toBe('queued');
      expect(JSON.stringify(h.logs)).not.toContain(message); expect(JSON.stringify(h.logs)).not.toMatch(/private.docx|api-key|secret/);
    });
  it.each([400, 429, 500])('un HTTP %i indéterminé/transitoire conserve les deux essais documentaires', async status => {
    const h = harness(factualSeed()); h.provider.mockImplementation(async () => new Response('{"error":{"type":"invalid_request_error","message":"quota ou incident indéterminé"}}', { status }));
    await h.run(); expect(h.provider).toHaveBeenCalledTimes(2); expect(h.job.step_results['doc:0'].attempts).toBe(2);
    expect(h.job.step_results['doc:0'].status).toBe('failed'); expect(h.delay.mock.calls.some(([,ms])=>ms===30_000)).toBe(true);
  });
  it.each([400, 413])('un HTTP %i de taille conserve needs_chunking sans relance', async status => {
    const h = harness(factualSeed()); h.provider.mockImplementation(async () => new Response('prompt is too long', { status }));
    await h.run(); expect(h.provider).toHaveBeenCalledTimes(1); expect(h.job.step_results['doc:0'].status).toBe('needs_chunking');
  });
  it.each([401, 402, 403])('le refus d’accès %i reste terminal et sans second appel', async status => {
    const h = harness(factualSeed()); h.provider.mockImplementation(async () => new Response('{}', { status }));
    await h.run(); expect(h.provider).toHaveBeenCalledTimes(1); expect(h.job.status).toBe('failed');
  });
  it('un HTTP 400 permanent global utilise la fin sans rapport existante sans reprise', async () => {
    const h = harness(globalSeed()); const before = JSON.stringify(h.job.step_results);
    h.provider.mockImplementation(async () => new Response('{"error":{"type":"invalid_request_error","message":"messages: Field required"}}', { status: 400 }));
    await h.run(); expect(h.job.status).toBe('completed_without_report'); expect(h.job.error_message).toBe('GLOBAL_ANALYSIS_FAILED');
    expect(h.provider).toHaveBeenCalledTimes(1); expect(JSON.stringify(h.job.step_results)).toBe(before);
  });
  it('zéro fait réel bloque le global même si un compteur est incohérent, puis reste terminal sans appel', async () => {
    const seed = base(); const source = { docId: 'd1', fileName: 'private.pdf', status: 'failed' as const, attempts: 2, contract: null, error: 'source failed' };
    const dossier = buildProjectFactsDossier([source]); dossier.contract.counts.total = 9;
    Object.assign(seed.step_results, { 'doc:0': source, dossier: { data: { dossier } } });
    const h = harness(seed); const before = JSON.stringify(h.job.step_results.dossier);
    await h.run(); await h.run(); const r = await h.run();
    expect(h.job.status).toBe('completed_without_report'); expect(h.job.error_message).toBeUndefined();
    expect(h.job.step_results.final.data.reason).toBe('GLOBAL_ANALYSIS_FAILED');
    expect(h.job.step_results.global_analysis.data).toMatchObject({ status: 'failed', factsCount: 0, text: null, failureCode: 'EMPTY_FACTUAL_DOSSIER', missingDocuments: dossier.missingDocuments });
    expect(JSON.stringify(h.job.step_results.dossier)).toBe(before); expect(h.provider).not.toHaveBeenCalled();
    expect(rpcCalls(h, 'begin_analysis_call')).toHaveLength(0); expect(r.body.skipped).toBe(true);
  });
  it('contrat invalide sans facts ne devient pas un dossier vide valide', async () => {
    const seed = base(); Object.assign(seed.step_results, { 'doc:0': {}, dossier: { data: { dossier: { contract: { counts: { total: 0 } } } } } });
    const h = harness(seed); await h.run(); expect(h.provider).not.toHaveBeenCalled();
    expect(h.job.step_results.global_analysis).toBeUndefined(); expect(h.job.status).toBe('completed_without_report');
  });
  it('un dossier incomplet avec un fait suit le parcours normal et conserve quantités, citations et références', async () => {
    const seed = globalSeed(); const source = seed.step_results['doc:0'];
    const dossier = buildProjectFactsDossier([source, { docId: 'd2', fileName: 'failed.pdf', status: 'failed', attempts: 2, contract: null, error: 'failed source' }]);
    Object.assign(seed.step_results, { dossier: { data: { dossier } } }); const before = JSON.stringify(seed.step_results);
    const h = harness(seed); h.provider.mockImplementation(async () => globalReply()); await h.run(); await h.run();
    expect(h.job.status).toBe('completed'); expect(h.provider).toHaveBeenCalledTimes(1); expect(dossier.complete).toBe(false);
    expect(JSON.stringify({ ...h.job.step_results, global_analysis: undefined, final: undefined })).toBe(before);
    expect(h.job.step_results.dossier.data.dossier.contract.facts[0]).toMatchObject({ quantity: 25, unit: 'm²', evidenceText: 'BA13 25 m²' });
  });
  it.each(['document', 'global'])('une sauvegarde %s temporaire est récupérée sans nouvelle génération', async kind => {
    const h = harness(kind === 'document' ? factualSeed() : globalSeed(), { commits: [temporary] });
    h.provider.mockImplementation(async () => kind === 'document' ? factualReply() : globalReply());
    const r = await h.run(); expect(r.body.status).toBe('queued'); expect(h.provider).toHaveBeenCalledTimes(1);
    expect(rpcCalls(h, 'begin_analysis_call')).toHaveLength(1); expect(rpcCalls(h, 'commit_analysis_step')).toHaveLength(2);
    const calls = rpcCalls(h, 'commit_analysis_step'); expect(calls[1][1]._result).toBe(calls[0][1]._result);
    expect(h.delay.mock.calls.map(([,ms])=>ms)).toEqual([250]); expect(JSON.stringify(h.logs)).not.toMatch(/CLIENT_CONFIDENTIEL|api-key|secret/);
    expect(h.job.step_results[kind === 'document' ? 'doc:0' : 'global_analysis']).toBeDefined();
  });
  it('le journal de réception temporairement indisponible est récupéré avec ses tokens réels et la réponse intacte', async () => {
    const h = harness(factualSeed(), { records: [temporary] }); h.provider.mockImplementation(async () => factualReply());
    await h.run(); expect(h.provider).toHaveBeenCalledTimes(1); expect(rpcCalls(h, 'record_analysis_call')).toHaveLength(2);
    expect(rpcCalls(h, 'record_analysis_call')[1][1]).toEqual(rpcCalls(h, 'record_analysis_call')[0][1]);
    expect(rpcCalls(h, 'record_analysis_call')[1][1]).toMatchObject({ _input_tokens: 11, _output_tokens: 22, _provider_id: 'msg_factual' });
    expect(h.job.step_results['doc:0'].contract.facts[0]).toMatchObject({ quantity: 25, unit: 'm²', evidenceText: 'BA13 25 m²' });
  });
  it.each(['commit', 'journal'])('une réponse RPC perdue après %s confirmé par lecture exacte ne provoque pas de réécriture', async kind => {
    const h = harness(globalSeed(), kind === 'commit' ? { commits: [{ ...temporary, applied: true }] } : { records: [{ ...temporary, applied: true }] });
    h.provider.mockImplementation(async () => globalReply()); const r = await h.run();
    expect(r.body.status).toBe('queued'); expect(h.provider).toHaveBeenCalledTimes(1);
    expect(rpcCalls(h, 'commit_analysis_step')).toHaveLength(1); expect(rpcCalls(h, 'record_analysis_call')).toHaveLength(1);
    expect(h.job.step_results.global_analysis.data.text).toBe('Rapport reçu sans recalcul'); expect(h.delay).not.toHaveBeenCalled();
    if (kind === 'commit') expect(h.trigger).not.toHaveBeenCalled();
  });
  it.each([false, null])('un retour RPC %s sans preuve indépendante ne confirme pas le commit et ne le réessaie pas', async data => {
    const h = harness(globalSeed(), { commits: [{ data, error: null }] }); h.provider.mockImplementation(async () => globalReply());
    const r = await h.run(); expect(r.body.status).not.toBe('completed'); expect(h.job.step_results.global_analysis).toBeUndefined();
    expect(rpcCalls(h, 'commit_analysis_step')).toHaveLength(1); expect(h.delay).not.toHaveBeenCalled(); expect(h.provider).toHaveBeenCalledTimes(1);
  });
  it.each(['commit', 'journal'])('la perte de propriétaire pendant %s interdit tout retry et tout faux succès', async kind => {
    const h = harness(globalSeed(), kind === 'commit' ? { commits: [{ ...temporary, loseOwner: true }] } : { records: [{ ...temporary, loseOwner: true }] });
    h.provider.mockImplementation(async () => globalReply()); const r = await h.run();
    expect(r.body).toMatchObject({ status: 'unconfirmed', failureRecorded: false }); expect(h.provider).toHaveBeenCalledTimes(1);
    expect(h.job.step_results.global_analysis).toBeUndefined(); expect(h.delay).not.toHaveBeenCalled();
    expect(rpcCalls(h, kind === 'commit' ? 'commit_analysis_step' : 'record_analysis_call')).toHaveLength(1);
  });
  it.each(['commit', 'journal'])('un résultat différent après %s ambigu n’est ni écrasé ni reconnu à tort', async kind => {
    const h = harness(globalSeed(), kind === 'commit' ? { commits: [{ ...temporary, applied: true }], differentSavedResult: true }
      : { records: [{ ...temporary, applied: true }], differentSavedMetadata: true });
    h.provider.mockImplementation(async () => globalReply()); const r = await h.run();
    expect(r.body.status).not.toBe('completed'); expect(h.provider).toHaveBeenCalledTimes(1); expect(h.delay).not.toHaveBeenCalled();
    expect(rpcCalls(h, kind === 'commit' ? 'commit_analysis_step' : 'record_analysis_call')).toHaveLength(1);
    if (kind === 'commit') expect(h.job.step_results.global_analysis).toEqual({ different: 'result' });
    else expect(h.job.step_results.global_analysis).toBeUndefined();
  });
  it('une lecture de réconciliation échouée ne confirme pas une sauvegarde', async () => {
    const h = harness(globalSeed(), { commits: [temporary], readError: true }); h.provider.mockImplementation(async () => globalReply());
    await h.run(); expect(h.job.step_results.global_analysis).toBeUndefined(); expect(rpcCalls(h, 'commit_analysis_step')).toHaveLength(1);
    expect(h.delay).not.toHaveBeenCalled(); expect(h.provider).toHaveBeenCalledTimes(1);
  });
  it('la récupération est bornée à trois essais de sauvegarde, indépendants du budget IA', async () => {
    const h = harness(globalSeed(), { commits: [temporary, temporary, temporary] }); h.provider.mockImplementation(async () => globalReply());
    await h.run(); expect(rpcCalls(h, 'commit_analysis_step')).toHaveLength(3); expect(h.delay.mock.calls.map(([,ms])=>ms)).toEqual([250, 750]);
    expect(h.provider).toHaveBeenCalledTimes(1); expect(rpcCalls(h, 'begin_analysis_call')).toHaveLength(1); expect(h.job.step_results.global_analysis).toBeUndefined();
  });
  it('une erreur permanente de sauvegarde n’est pas réessayée', async () => {
    const h = harness(globalSeed(), { commits: [{ data: null, error: { code: '42501', message: 'private permission error' } }] });
    h.provider.mockImplementation(async () => globalReply()); await h.run(); expect(rpcCalls(h, 'commit_analysis_step')).toHaveLength(1);
    expect(h.delay).not.toHaveBeenCalled(); expect(h.provider).toHaveBeenCalledTimes(1);
  });
  it('le test technique ne reçoit ni la classification ni la récupération projet', async () => {
    const h = harness({ ...base(), payload: { kind: 'persistent_ui_test' }, step_results: { prepare: {} } }, { records: [temporary] });
    h.provider.mockImplementation(async () => new Response('{"choices":[{"message":{"content":"{\\"persistentJobTest\\":true}"}}]}'));
    await h.run(); expect(h.provider).toHaveBeenCalledTimes(1); expect(rpcCalls(h, 'record_analysis_call')).toHaveLength(1); expect(h.delay).not.toHaveBeenCalled();
  });
});