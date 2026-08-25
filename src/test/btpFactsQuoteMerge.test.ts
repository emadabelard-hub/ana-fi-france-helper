import { describe, it, expect } from 'vitest';
import { mergeFactsForQuote } from '@/lib/btpFactsQuoteMerge';

const f = (over: Record<string, unknown>) => ({
  factId: Math.random().toString(36).slice(2),
  lot: 'Isolation',
  location: 'Combles',
  transferStatus: 'ready',
  ...over,
});

describe('mergeFactsForQuote — consolidation avant devis', () => {
  it('fusionne le même ouvrage décrit par trois documents en une ligne enrichie', () => {
    const out = mergeFactsForQuote([
      f({ descriptionExact: 'Isolation des combles', quantity: 96, unit: 'm2', sourceFile: 'plan.pdf', sourcePage: 2 }),
      f({ descriptionExact: 'Isolation des combles', material: 'R ≥ 7 m².K/W', sourceFile: 'notice.pdf', quantity: null, unit: null }),
      f({ descriptionExact: "Fourniture et pose d'une isolation des combles", sourceFile: 'cctp.pdf' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].descriptionExact).toContain('Fourniture et pose');
    expect(out[0].descriptionExact).toContain('R ≥ 7');
    expect(out[0].quantity).toBe(96);
    expect(out[0].unit).toBe('m2');
    expect(out[0].mergedSources).toHaveLength(3);
  });

  it('supprime le doublon strict en conservant les sources', () => {
    const out = mergeFactsForQuote([
      f({ descriptionExact: 'Pose de cloison', quantity: 12, unit: 'ml', sourceFile: 'a.pdf' }),
      f({ descriptionExact: 'Pose de cloison', quantity: 12, unit: 'ml', sourceFile: 'b.pdf' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(12);
    expect(out[0].mergedSources).toEqual(['a.pdf', 'b.pdf']);
  });

  it('marque « à vérifier » sans arbitrer les quantités contradictoires', () => {
    const out = mergeFactsForQuote([
      f({ descriptionExact: 'Isolation des combles', quantity: 96, unit: 'm2', sourceFile: 'a.pdf' }),
      f({ descriptionExact: 'Isolation des combles', quantity: 110, unit: 'm2', sourceFile: 'b.pdf' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].transferStatus).toBe('pending');
    expect(out[0].quantity).toBeNull();
    expect(String(out[0].reasons)).toMatch(/à vérifier/);
  });

  it('ne fusionne pas des localisations différentes', () => {
    const out = mergeFactsForQuote([
      f({ descriptionExact: 'Peinture murs', location: 'Salon', quantity: 20, unit: 'm2' }),
      f({ descriptionExact: 'Peinture murs', location: 'Cuisine', quantity: 12, unit: 'm2' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('laisse intacts les faits exclus', () => {
    const out = mergeFactsForQuote([
      f({ descriptionExact: 'Cote L = 3,20 m', transferStatus: 'excluded' }),
      f({ descriptionExact: 'Pose de cloison', quantity: 12, unit: 'ml' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.some((x) => x.transferStatus === 'excluded')).toBe(true);
  });
});
