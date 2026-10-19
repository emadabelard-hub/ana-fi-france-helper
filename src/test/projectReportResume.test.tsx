import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ProjectAnalysisPage from '../pages/ProjectAnalysisPage';
import { buildProjectFactsDossier } from '../../supabase/functions/_shared/btpProjectDossier';
import { validateBtpFacts } from '../../supabase/functions/_shared/btpFactsContract';
import { runGlobalAnalysis } from '../../supabase/functions/_shared/btpGlobalAnalysisPrompt';

const state = vi.hoisted(() => ({ rtl: false, row: null as any, read: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ isRTL: state.rtl }) }));
vi.mock('@/lib/pdfIngest', () => ({ ingestImage: vi.fn() }));
vi.mock('@/lib/projectDocumentIngest', () => ({ extractProjectDocx: vi.fn(), ingestProjectPdf: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => { state.read(); return Promise.resolve({ data: state.row, error: null }); } }) }) }) } }));
afterEach(() => { cleanup(); sessionStorage.clear(); state.rtl = false; state.read.mockClear(); });

describe('22 reprise interrompue — résultats sauvegardés et aucune régénération', () => {
  it('le worker reprend exactement la première étape absente, même avec un current_step périmé', () => {
    // Execute the actual pure worker function, without importing Deno.serve or any provider.
    const src = readFileSync('supabase/functions/btp-analysis-job/index.ts', 'utf8');
    const start = src.indexOf('export function nextStepProjectDocs(');
    const end = src.indexOf('\n}\n', start);
    const fn = src.slice(start, end + 2).replace('export ', '').replace('stepResults: Record<string, unknown> | null', 'stepResults').replace('docCount: number', 'docCount').replace('): string', ')');
    const next = new Function(`${fn}; return nextStepProjectDocs;`)() as (sr: Record<string, unknown>, count: number) => string;
    expect(next({}, 2)).toBe('doc:0'); expect(next({ 'doc:0': {} }, 2)).toBe('doc:1');
    const sr = { 'doc:0': {}, 'doc:1': {}, dossier: {} };
    expect(next(sr, 2)).toBe('global_analysis');
    expect(next({ ...sr, global_analysis: { data: { text: 'rapport conservé' } } }, 2)).toBe('finalize');
    expect(next({ ...sr, global_analysis: {}, final: {} }, 2)).toBe('completed');
  });
  it.each([false, true])('restaure le rapport et son diagnostic après sortie/retour (RTL=%s)', async (rtl) => {
    state.rtl = rtl;
    const dossier = buildProjectFactsDossier([{ docId: 'a', fileName: 'a.pdf', status: 'completed', attempts: 1, error: null,
      contract: validateBtpFacts([{ descriptionExact: 'Pose de cloison', sourceFile: 'a.pdf', quantity: 24, unit: 'm²', evidenceText: 'Pose de cloison' }]) }]);
    const id = dossier.contract.facts[0].factId;
    let calls = 0;
    const analysis = await runGlobalAnalysis(dossier, async () => { calls++; return `## 1. Résumé du projet\nPose de cloison. Quantité : 42 m² ; [${id}]`; });
    state.row = { id: 'saved', status: 'completed', step_results: { dossier: { data: { dossier } }, global_analysis: { data: analysis } } };
    sessionStorage.setItem('anafypro_project_analysis_job', JSON.stringify({ id: 'saved' }));
    const first = render(<ProjectAnalysisPage />);
    await waitFor(() => expect(state.read).toHaveBeenCalledTimes(1));
    const label = rtl ? 'اختلافات مثبتة في حقول صريحة' : 'Écarts démontrés dans des champs explicites';
    expect(await screen.findByText(`${label} : 1`)).toBeInTheDocument();
    first.unmount(); render(<ProjectAnalysisPage />);
    expect(await screen.findByText(`${label} : 1`)).toBeInTheDocument();
    expect(calls).toBe(1); expect(state.read).toHaveBeenCalledTimes(2);
    expect(analysis.text).toContain('42 m²'); expect(analysis.audit?.semanticFidelityGuaranteed).toBe(false);
  });
});