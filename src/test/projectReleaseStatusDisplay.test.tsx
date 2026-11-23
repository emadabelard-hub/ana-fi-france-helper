import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectAnalysisPage from '../pages/ProjectAnalysisPage';

const state = vi.hoisted(() => ({ rtl: false, row: null as any }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ isRTL: state.rtl }) }));
vi.mock('@/lib/pdfIngest', () => ({ ingestImage: vi.fn() }));
vi.mock('@/lib/projectDocumentIngest', () => ({ extractProjectDocx: vi.fn(), extractProjectDocxStructured: vi.fn(), ingestProjectPdf: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.row, error: null }) }) }) }) } }));
afterEach(() => { cleanup(); sessionStorage.clear(); state.rtl = false; });

const TEXT = {
  fr: {
    ok: 'Les informations essentielles du rapport ont été retrouvées dans les documents. Cette vérification automatique ne remplace pas votre relecture.',
    ko: 'Rapport non validé : certaines informations essentielles n’ont pas pu être vérifiées dans les documents. Les éléments du rapport sont à vérifier avant tout usage.',
  },
  ar: {
    ok: 'المعلومات الأساسية في التقرير لقيناها في المستندات. التحقق الآلي ده مايغنيش عن مراجعتك.',
    ko: 'التقرير مش معتمد: فيه معلومات أساسية ماقدرناش نتأكد منها في المستندات. لازم تراجع محتوى التقرير قبل ما تستخدمه.',
  },
};

async function show(rtl: boolean, approved: boolean) {
  state.rtl = rtl;
  state.row = { id: 'rel', status: 'completed', step_results: {
    dossier: { data: { dossier: { documents: [] } } },
    global_analysis: { data: { status: 'completed', text: '## 1. Résumé du projet\nTexte du rapport conservé.', complete: true, release: { approved } } },
  } };
  sessionStorage.setItem('anafypro_project_analysis_job', JSON.stringify({ id: 'rel' }));
  render(<ProjectAnalysisPage />);
  return screen.findByRole('note');
}

describe('Affichage réel du statut de fiabilité du rapport', () => {
  it.each([[false, 'fr'], [true, 'ar']] as const)('« validé » affiché (RTL=%s)', async (rtl, lang) => {
    const note = await show(rtl, true);
    expect(note).toHaveAttribute('data-release', 'true');
    expect(note).toHaveTextContent(TEXT[lang].ok);
    expect(note).not.toHaveTextContent(TEXT[lang].ko);
    expect(screen.getByText(/Texte du rapport conservé/)).toBeInTheDocument();
  });
  it.each([[false, 'fr'], [true, 'ar']] as const)('« non validé » affiché sans masquer le rapport (RTL=%s)', async (rtl, lang) => {
    const note = await show(rtl, false);
    expect(note).toHaveAttribute('data-release', 'false');
    expect(note).toHaveTextContent(TEXT[lang].ko);
    expect(note).not.toHaveTextContent(TEXT[lang].ok);
    expect(screen.getByText(/Texte du rapport conservé/)).toBeInTheDocument();
  });
  it('le français ne contient aucun caractère arabe', async () => {
    const note = await show(false, false);
    expect(note.textContent).not.toMatch(/[\u0600-\u06FF]/);
  });
});
