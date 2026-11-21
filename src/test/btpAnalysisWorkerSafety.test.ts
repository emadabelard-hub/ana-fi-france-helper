/** Execute the actual worker in an isolated VM; every network/database operation is fake. */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { confirmedFailureStatus, requireStepCommit, safeAnalysisError } from '../../supabase/functions/_shared/btpAnalysisStepSafety';
import { AttemptJournalError, tracedAnalysisFetch } from '../../supabase/functions/_shared/btpAnalysisTelemetry';
import { processSingleDocument, isApiSizeLimitError, DocumentTooLargeError, RESPONSE_MAX_TOKENS } from '../../supabase/functions/_shared/btpDocumentSequence';
import { buildProjectFactsDossier } from '../../supabase/functions/_shared/btpProjectDossier';
import { runGlobalAnalysis } from '../../supabase/functions/_shared/btpGlobalAnalysisPrompt';
import { BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT } from '../../supabase/functions/_shared/btpFactualPrompt';

const workerCode=ts.transpileModule(readFileSync('supabase/functions/btp-analysis-job/index.ts','utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import[\s\S]*?;\s*/gm,'').replace(/^export /gm,'');
const token='worker-token-for-local-tests';
const id='11111111-1111-4111-8111-111111111111';
const base=() => ({ id, status:'queued', payload:{ kind:'project_docs_facts', documents:[{ docId:'d1',fileName:'private.pdf',kind:'pdf',unreadable:true }] }, step_results:{} });

function harness(seed: ReturnType<typeof base> | Record<string, any>, options: { commit?: unknown; commitStep?: string; fail?: unknown; update?: unknown }={}) {
  const job: Record<string, any>=structuredClone(seed);
  const logs: unknown[][]=[];
  const provider=vi.fn(async (_init: RequestInit) => new Response('{}'));
  const rpc=vi.fn(async (name: string,args: Record<string,any>={}) => {
    if(name==='get_analysis_worker_token') return {data:token,error:null};
    if(name==='claim_analysis_job') {
      if(job.status!=='queued'&&job.status!=='running') return {data:null,error:null};
      job.status='running'; return {data:structuredClone(job),error:null};
    }
    if(name==='heartbeat_analysis_job'||name==='record_analysis_call') return {data:true,error:null};
    if(name==='begin_analysis_call') return {data:'22222222-2222-4222-8222-222222222222',error:null};
    if(name==='commit_analysis_step') {
      if(options.commit && (!options.commitStep || options.commitStep===args._step)) return options.commit;
      job.step_results[args._step]=args._result; job.status=args._status;
      job.progress=args._progress; job.current_step=args._current_step;
      job.final_report=args._final_report ?? job.final_report;
      return {data:true,error:null};
    }
    if(name==='fail_analysis_step') {
      const outcome = (options.fail ?? {data:'queued',error:null}) as {data:unknown;error:unknown};
      if(!outcome.error && (outcome.data==='queued'||outcome.data==='failed')) job.status=outcome.data;
      return outcome;
    }
    throw new Error('Unexpected mock RPC');
  });
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
  runInNewContext(workerCode, {
    Deno:{env:{get:()=> 'local-test-only'},serve:(fn: typeof handler)=>{handler=fn;}},
    createClient:()=>({rpc,from:()=>({update})}),corsHeaders:{},crypto:webcrypto,Request,Response,URL,Error,fetch:fakeFetch,
    console:{log:(...args: unknown[])=>logs.push(args),error:(...args: unknown[])=>logs.push(args)},
    setInterval,clearInterval,setTimeout,
    requireStepCommit,confirmedFailureStatus,safeAnalysisError,tracedAnalysisFetch,AttemptJournalError,
    processSingleDocument,isApiSizeLimitError,DocumentTooLargeError,RESPONSE_MAX_TOKENS,buildProjectFactsDossier,
    BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT,anthropicCompatFetch:provider,runGlobalAnalysis,
  });
  const run=async()=>{
    if(!handler) throw new Error('Worker handler missing');
    const response=await handler(new Request('http://localhost/work?mode=work',{method:'POST',headers:{'x-worker-token':token},body:JSON.stringify({jobId:id})}));
    return { http:response.status, body:await response.json() };
  };
  return {run,job,rpc,provider,logs,update};
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
  Object.assign(seed.step_results,{'doc:0':{status:'failed'},dossier:{data:{dossier:buildProjectFactsDossier([{docId:'d1',fileName:'private.pdf',status:'failed',attempts:2,contract:null,error:'test'}])}}});
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
  it('un document hors budget reste needs_chunking ; le rapport du dossier incomplet peut être sauvegardé',async()=>{
    const h=harness({...base(),payload:{kind:'project_docs_facts',documents:[{docId:'d1',fileName:'big.pdf',kind:'pdf',text:'x'.repeat(300_000)}]}});
    h.provider.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'Rapport du dossier incomplet : document non exploité big.pdf'}}]})));
    await h.run();expect(h.job.step_results['doc:0'].status).toBe('needs_chunking');expect(h.provider).not.toHaveBeenCalled();
    await h.run();await h.run();await h.run();
    expect(h.job.status).toBe('completed');expect(h.job.step_results.dossier.data.dossier.complete).toBe(false);
    expect(h.job.step_results.global_analysis.data.text).toContain('document non exploité');expect(h.provider).toHaveBeenCalledTimes(1);
    console.log('SIMULATION document hors budget',JSON.stringify({documentStatus:h.job.step_results['doc:0'].status,status:h.job.status,reportSaved:true}));
  });
});