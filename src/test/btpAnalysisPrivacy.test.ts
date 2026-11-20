import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { validateBtpFacts } from '../../supabase/functions/_shared/btpFactsContract';

describe('4A BIS — confidentialité des journaux réels',()=>{
  it('le validateur conserve les faits mais ne journalise que des compteurs',()=>{
    const log=vi.spyOn(console,'log').mockImplementation(()=>{});
    try {
      const contract=validateBtpFacts([{id:'A',descriptionExact:'CLIENT_CONFIDENTIEL travaux',quantity:25,unit:'m²',lot:'CLIENT_CONFIDENTIEL',category:'travaux',role:'main',sourceFile:'CLIENT_CONFIDENTIEL.pdf',sourcePage:1,evidenceText:'CLIENT_CONFIDENTIEL api-key=secret',scope:'CLIENT_CONFIDENTIEL'}]);
      expect(contract.facts).toHaveLength(1);
      expect(contract.facts[0].descriptionExact).toBe('CLIENT_CONFIDENTIEL travaux');
      expect(log).toHaveBeenCalledWith('[btpFacts][phaseB] counts',JSON.stringify(contract.counts));
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/CLIENT_CONFIDENTIEL|api-key|secret/);
    } finally {log.mockRestore();}
  });
  it('le shim ne journalise pas le corps fournisseur et conserve le code HTTP et le modèle',async()=>{
    const source=ts.transpileModule(readFileSync('supabase/functions/_shared/anthropic-compat.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^export /gm,'');
    const logs:unknown[][]=[];
    const send=vi.fn(async(_url: string,_init: RequestInit)=>new Response('CLIENT_CONFIDENTIEL api-key=secret',{status:400}));
    const call=runInNewContext(source+'\nanthropicCompatFetch;',{
      Deno:{env:{get:()=> 'local-test-only'}},fetch:send,Response,
      console:{error:(...args:unknown[])=>logs.push(args)},
    }) as (init:RequestInit)=>Promise<Response>;
    const response=await call({body:JSON.stringify({max_tokens:32000,temperature:0,messages:[{role:'user',content:'PROMPT_CONFIDENTIEL'}]})});
    expect(response.status).toBe(400);
    // Error content is still returned in memory for the existing size classifier, never logged.
    expect(await response.text()).toContain('CLIENT_CONFIDENTIEL');
    expect(JSON.stringify(logs)).toContain('http_status');
    expect(JSON.stringify(logs)).toContain('claude-sonnet-4-5-20250929');
    expect(JSON.stringify(logs)).not.toMatch(/CLIENT_CONFIDENTIEL|PROMPT_CONFIDENTIEL|api-key|secret/);
    const request=JSON.parse(String(send.mock.calls[0]?.[1]?.body));
    expect(request.max_tokens).toBe(32000);expect(request.temperature).toBe(0);
  });
});