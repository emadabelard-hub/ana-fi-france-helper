import { describe, expect, it, vi } from 'vitest';
import { tracedAnalysisFetch, measureAnalysisRequest, AttemptJournalError, type CallMetadata, type CallOutcome } from '../../supabase/functions/_shared/btpAnalysisTelemetry';

const request = { body: JSON.stringify({ max_tokens: 32000, temperature: 0,
  messages: [{ role: 'system', content: 'instructions' }, { role: 'user', content: 'DONNÉES CONFIDENTIELLES' }] }) };
const journal = () => ({ begin: vi.fn(async (_m: CallMetadata): Promise<string | null> => 'call1'), record: vi.fn(async (_id: string, _o: CallOutcome) => true) });
describe('instrumentation déterministe, sans fournisseur', () => {
  it('mesure le texte et les octets sans persister le contenu ni changer la requête', async () => {
    const j = journal();
    const send = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_test', usage: { prompt_tokens: 54, completion_tokens: 12 }, choices: [] })));
    let t = 0;
    const r = await tracedAnalysisFetch(request, j, send, () => (t += 17));
    expect(send).toHaveBeenCalledWith(request);
    expect(j.begin).toHaveBeenCalledWith(measureAnalysisRequest(request.body));
    expect(j.begin.mock.calls[0][0].inputChars).toBe('instructionsDONNÉES CONFIDENTIELLES'.length);
    expect(j.record).toHaveBeenCalledWith('call1', { status: 'response_received', durationMs: 17,
      inputTokens: 54, outputTokens: 12, providerId: 'msg_test', httpStatus: 200 });
    expect(JSON.stringify(j.begin.mock.calls)).not.toContain('CONFIDENTIELLES');
    expect((await r.json()).usage.prompt_tokens).toBe(54);
  });
  it('ne lance aucun appel lorsque le budget durable ou le lease refuse la réservation', async () => {
    const j = journal(); j.begin.mockResolvedValue(null);
    const send = vi.fn();
    await expect(tracedAnalysisFetch(request, j, send)).rejects.toBeInstanceOf(AttemptJournalError);
    expect(send).not.toHaveBeenCalled();
  });
  it.each(['TimeoutError', 'AbortError', 'TypeError'])('trace %s sans inventer de tokens ni recopier les données', async name => {
    const j = journal(); const e = new Error('DOCUMENT PRIVÉ api-key=secret'); e.name = name;
    await expect(tracedAnalysisFetch(request, j, async () => { throw e; })).rejects.toBe(e);
    const outcome = j.record.mock.calls[0][1];
    expect(outcome.status).toBe(name === 'TypeError' ? 'network_error' : 'timeout');
    expect(outcome).not.toHaveProperty('inputTokens'); expect(outcome).not.toHaveProperty('outputTokens');
    expect(JSON.stringify(outcome)).not.toContain('PRIVÉ'); expect(JSON.stringify(outcome)).not.toContain('secret');
  });
  it('une réponse sans usage ne reçoit aucun chiffre de consommation fictif', async () => {
    const j = journal();
    await tracedAnalysisFetch(request, j, async () => new Response('{}'));
    expect(j.record.mock.calls[0][1].inputTokens).toBeUndefined();
    expect(j.record.mock.calls[0][1].outputTokens).toBeUndefined();
  });
  it('une erreur fournisseur est tracée avec son code, sans son corps confidentiel', async () => {
    const j = journal();
    const r = await tracedAnalysisFetch(request, j, async () => new Response('données privées', { status: 503 }));
    expect(r.status).toBe(503); expect(await r.text()).toBe('données privées');
    expect(j.record.mock.calls[0][1]).toMatchObject({ status: 'provider_error', httpStatus: 503 });
    expect(JSON.stringify(j.record.mock.calls)).not.toContain('privées');
  });
  it('ne confirme pas une réception non journalisée', async () => {
    const j = journal(); j.record.mockResolvedValue(false);
    await expect(tracedAnalysisFetch(request, j, async () => new Response('{}'))).rejects.toBeInstanceOf(AttemptJournalError);
  });
});