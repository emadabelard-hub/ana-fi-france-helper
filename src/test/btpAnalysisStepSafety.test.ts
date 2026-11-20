import { describe, expect, it } from 'vitest';
import { AnalysisStepError, confirmedFailureStatus, requireStepCommit, safeAnalysisError } from '../../supabase/functions/_shared/btpAnalysisStepSafety';

describe('correction 4A BIS — confirmations RPC et codes neutres', () => {
  it('confirme uniquement un commit explicitement vrai', () => {
    expect(() => requireStepCommit({ data: true, error: null })).not.toThrow();
    for (const data of [false, null, 'true', undefined]) {
      expect(() => requireStepCommit({ data, error: null })).toThrow('lease_lost:');
    }
  });
  it('une erreur RPC de sauvegarde devient save_failed sans contenu sensible', () => {
    try { requireStepCommit({ data: true, error: { message: 'CLIENT PRIVÉ api-key=secret' } }); }
    catch (error) { expect(safeAnalysisError(error)).toEqual({ code: 'save_failed', message: 'ANALYSIS_SAVE_FAILED: La sauvegarde de la réponse a échoué.' }); return; }
    throw new Error('Le commit devait être refusé');
  });
  it('une erreur RPC de failure ne peut pas annoncer un échec enregistré', () => {
    expect(() => confirmedFailureStatus({ data: 'failed', error: { message: 'privé' } })).toThrow('rpc_failed:');
    for (const data of [null, false, 'running', 'completed']) {
      expect(() => confirmedFailureStatus({ data, error: null })).toThrow('lease_lost:');
    }
    expect(confirmedFailureStatus({ data: 'failed', error: null })).toBe('failed');
    expect(confirmedFailureStatus({ data: 'queued', error: null })).toBe('queued');
  });
  it.each(['save_failed', 'attempt_limit', 'lease_lost', 'response_empty', 'output_truncated', 'invalid_contract'] as const)('préserve la catégorie %s et exclut les données brutes', code => {
    const result=safeAnalysisError(new AnalysisStepError(code));
    expect(result.code).toBe(code);
    expect(JSON.stringify(result)).not.toContain('CLIENT PRIVÉ');
  });
  it.each([
    ['ANALYSIS_SAVE_FAILED: CLIENT PRIVÉ', 'save_failed'],
    ['ANALYSIS_ATTEMPT_LIMIT: CLIENT PRIVÉ', 'attempt_limit'],
    ['Lease perdu CLIENT PRIVÉ', 'lease_lost'],
    ['Analyse globale vide.', 'response_empty'],
    ['Analyse globale tronquée (longueur maximale). CLIENT PRIVÉ', 'output_truncated'],
    ['Bloc factuel absent ou illisible. CLIENT PRIVÉ', 'invalid_contract'],
    ['CLIENT PRIVÉ api-key=secret', 'step_failed'],
  ])('classe une erreur historique sans recopier son contenu', (message, code) => {
    const result=safeAnalysisError(new Error(message));
    expect(result.code).toBe(code);
    expect(result.message).not.toContain('CLIENT PRIVÉ');
    expect(result.message).not.toContain('secret');
  });
});