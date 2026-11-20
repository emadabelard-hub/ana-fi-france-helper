/** Metadata only. The request body is measured in memory, never persisted/logged. */
import { estimateTokensConservative, IMAGE_TOKENS_MAX, REQUEST_OVERHEAD_TOKENS } from './btpDocumentSequence.ts';

export const ANALYSIS_MODEL = 'claude-sonnet-4-5-20250929'; // telemetry, not model selection
export class AttemptJournalError extends Error {}
export type CallStatus = 'response_received' | 'timeout' | 'network_error' | 'provider_error';
export type CallMetadata = { model: string; inputChars: number; requestBytes: number; estimatedTokens: number };
export type CallOutcome = {
  status: CallStatus; durationMs: number; inputTokens?: number; outputTokens?: number; providerId?: string; httpStatus?: number;
};
export interface AttemptJournal {
  begin(metadata: CallMetadata): Promise<string | null>;
  record(id: string, outcome: CallOutcome): Promise<boolean>;
}

export function measureAnalysisRequest(body: string): CallMetadata {
  const parsed = JSON.parse(body);
  let chars = 0, tokens = REQUEST_OVERHEAD_TOKENS;
  for (const message of parsed.messages ?? []) {
    const parts = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content ?? [];
    for (const part of parts) {
      if (part.type === 'text' && typeof part.text === 'string') {
        chars += part.text.length;
        tokens += estimateTokensConservative(part.text);
      } else if (part.type === 'image_url' || part.type === 'image') {
        tokens += IMAGE_TOKENS_MAX;
      }
    }
  }
  return { model: ANALYSIS_MODEL, inputChars: chars, requestBytes: new TextEncoder().encode(body).length, estimatedTokens: tokens };
}

const reportedTokens = (n: unknown): number | undefined =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : undefined;

/** Preserve the existing non-streaming shim and request; gate the call durably first. */
export async function tracedAnalysisFetch(
  init: RequestInit, journal: AttemptJournal,
  send: (init: RequestInit) => Promise<Response>, now: () => number = () => performance.now(),
): Promise<Response> {
  if (typeof init.body !== 'string') throw new AttemptJournalError('Requête non mesurable.');
  const id = await journal.begin(measureAnalysisRequest(init.body));
  if (!id) throw new AttemptJournalError('ANALYSIS_ATTEMPT_LIMIT: Réservation refusée ou limite de tentatives atteinte. Résultats conservés.');
  const start = now();
  let response: Response;
  try {
    response = await send(init);
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const status = name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error';
    // Fixed vocabulary, never the raw exception (which can contain document text/URLs).
    if (!await journal.record(id, { status, durationMs: now() - start })) {
      throw new AttemptJournalError('Journal de tentative indisponible.');
    }
    throw error;
  }
  const durationMs = now() - start;
  let inputTokens: number | undefined, outputTokens: number | undefined, providerId: string | undefined;
  if (response.ok) {
    // The shim has already received/decoded the whole response; do not alter the caller's body.
    const data = await response.clone().json().catch(() => null);
    inputTokens = reportedTokens(data?.usage?.prompt_tokens);
    outputTokens = reportedTokens(data?.usage?.completion_tokens);
    if (typeof data?.id === 'string' && /^msg_[a-zA-Z0-9_-]+$/.test(data.id)) providerId = data.id;
  }
  if (!await journal.record(id, {
    status: response.ok ? 'response_received' : 'provider_error', durationMs, inputTokens, outputTokens, providerId, httpStatus: response.status,
  })) throw new AttemptJournalError('Réponse reçue mais journal non sauvegardé.');
  return response;
}