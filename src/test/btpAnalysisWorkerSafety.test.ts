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

const workerCode=ts.transpileModule(readFileSync('supabase/functions/btp-analysis-job/index.ts','utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import[\s\S]*?;\s*/gm,'').replace(/^export /gm,'');
const token='worker-token-for-local-tests';
const id='11111111-1111-4111-8111-111111111111';
const base=() => ({ id, status:'queued', payload:{ kind:'project_docs_facts', documents:[{ docId:'d1',fileName:'private.pdf',kind:'pdf',unreadable:true }] }, step_results:{} });

function harness(seed: ReturnType<typeof base> | Record<string, any>, options: { commit?: unknown; fail?: unknown }={}) {
  const job=structuredClone(seed);
  const logs: unknown[][]=[];
  const provider=vi.fn(async (_init: RequestInit) => new Response('{}'));
  const rpc=vi.fn(async (name: string,args: Record<string,any>={}) => {
    if(name==='get_analysis_worker_token') return {data:token,error:null};
    if(name==='claim_analysis_job') return {data:structuredClone(job),error:null};
    if(name==='heartbeat_analysis_job'||name==='record_analysis_call') return {data:true,error:null};
    if(name==='begin_analysis_call') return {data:'22222222-2222-4222-8222-222222222222',error:null};
    if(name==='commit_analysis_step') {
      if(options.commit) return options.commit;
      job.step_results[args._step]=args._result; job.status=args._status;
      return {data:true,error:null};
    }
    if(name==='fail_analysis_step') return options.fail ?? {data:'queued',error:null};
    throw new Error('Unexpected mock RPC');
  });
  let handler: ((request: Request)=>Promise<Response>) | undefined;
  const fakeFetch=vi.fn(async()=>new Response('{}'));
  runInNewContext(workerCode, {
    Deno:{env:{get:()=> 'local-test-only'},serve:(fn: typeof handler)=>{handler=fn;}},
    createClient:()=>({rpc}),corsHeaders:{},crypto:webcrypto,Request,Response,URL,Error,fetch:fakeFetch,
    console:{log:(...args: unknown[])=>logs.push(args),error:(...args: unknown[])=>logs.push(args)},
    setInterval,clearInterval,setTimeout,
    requireStepCommit,confirmedFailureStatus,safeAnalysisError,tracedAnalysisFetch,AttemptJournalError,
    processSingleDocument,isApiSizeLimitError,DocumentTooLargeError,RESPONSE_MAX_TOKENS,buildProjectFactsDossier,
    BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT:'fixed-test-prompt',anthropicCompatFetch:provider,
    runGlobalAnalysis:vi.fn(),
  });
  const run=async()=>{
    if(!handler) throw new Error('Worker handler missing');
    const response=await handler(new Request('http://localhost/work?mode=work',{method:'POST',headers:{'x-worker-token':token},body:JSON.stringify({jobId:id})}));
    return { http:response.status, body:await response.json() };
  };
  return {run,job,rpc,provider,logs};
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
    const seed=base(); Object.assign(seed.step_results,{'doc:0':{},dossier:{data:{dossier:{complete:false}}},global_analysis:{data:{status:'completed'}}});
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