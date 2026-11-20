/** Fixed vocabulary shared by the worker and the pending SQL; never retain raw errors. */
export type AnalysisErrorCode = 'save_failed' | 'attempt_limit' | 'lease_lost' | 'response_empty'
  | 'output_truncated' | 'invalid_contract' | 'rpc_failed' | 'step_failed';

const messages: Record<AnalysisErrorCode, string> = {
  save_failed: 'ANALYSIS_SAVE_FAILED: La sauvegarde de la réponse a échoué.',
  attempt_limit: 'ANALYSIS_ATTEMPT_LIMIT: Limite de tentatives atteinte. Résultats conservés.',
  lease_lost: 'lease_lost: Le traitement ne possède plus le verrou.',
  response_empty: 'response_empty: Le fournisseur a retourné une réponse vide.',
  output_truncated: 'output_truncated: Réponse limitée par le plafond de sortie du fournisseur.',
  invalid_contract: 'invalid_contract: Le contrat reçu ne peut pas être validé.',
  rpc_failed: 'rpc_failed: La base ne confirme pas l’enregistrement de l’échec.',
  step_failed: 'step_failed: Échec du traitement de cette étape.',
};

export class AnalysisStepError extends Error {
  constructor(readonly code: AnalysisErrorCode) { super(messages[code]); }
}

export function safeAnalysisError(error: unknown): { code: AnalysisErrorCode; message: string } {
  const text = error instanceof Error ? error.message : '';
  const code: AnalysisErrorCode = error instanceof AnalysisStepError ? error.code
    : text.startsWith('ANALYSIS_SAVE_FAILED:') ? 'save_failed'
    : text.startsWith('ANALYSIS_ATTEMPT_LIMIT:') ? 'attempt_limit'
    : /^(lease_lost:|Lease perdu)/.test(text) ? 'lease_lost'
    : /^(response_empty:|Analyse globale vide\.)/.test(text) ? 'response_empty'
    : text.startsWith('output_truncated:') || /tronquée \(longueur maximale\)/.test(text) ? 'output_truncated'
    : /^(invalid_contract:|Bloc |Aucune entrée exploitable|Contrat |JSON IA invalide|Réponse IA non exploitable)/.test(text) ? 'invalid_contract'
    : 'step_failed';
  return { code, message: messages[code] };
}

export type RpcOutcome = { data: unknown; error: unknown };

/** A successful transport is not a confirmed commit. False means lease lost/duplicate. */
export function requireStepCommit(result: RpcOutcome): void {
  if (result.error) throw new AnalysisStepError('save_failed');
  if (result.data !== true) throw new AnalysisStepError('lease_lost');
}

export function confirmedFailureStatus(result: RpcOutcome): 'queued' | 'failed' {
  if (result.error) throw new AnalysisStepError('rpc_failed');
  if (result.data !== 'queued' && result.data !== 'failed') throw new AnalysisStepError('lease_lost');
  return result.data;
}