import { describe, it, expect } from 'vitest';
import { buildDraftLinesFromFacts, sanitizeReformulatedDesignation } from '@/lib/btpFactsToDraft';

const wrap = (facts: any[]) =>
  `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ facts })}</ANAFYPRO_BTP_FACTS>`;

const makeFacts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    descriptionExact: `Pose de cloison zone ${i + 1}`,
    quantity: i + 2,
    unit: i % 3 === 0 ? 'ml' : i % 3 === 1 ? 'm²' : 'u',
    lot: 'Cloisons',
    status: 'ready_for_draft',
  }));

describe('REFORMULATION — 28 lignes avant / 28 lignes après', () => {
  const before = buildDraftLinesFromFacts(wrap(makeFacts(28)));

  it('28 faits ready produisent 28 lignes', () => {
    expect(before.lines).toHaveLength(28);
  });

  it('la reformulation ne change ni quantité, ni unité, ni lot, ni nombre de lignes', () => {
    const after = before.lines.map((l) => ({
      ...l,
      designation_fr: sanitizeReformulatedDesignation({
        original: l.designation_fr,
        reformulated: `Pose de cloison en plaques de plâtre — zone ${l.designation_fr.split(' ').pop()}`,
      }),
    }));
    expect(after).toHaveLength(28);
    expect(after.map((l) => l.quantity)).toEqual(before.lines.map((l) => l.quantity));
    expect(after.map((l) => l.unit)).toEqual(before.lines.map((l) => l.unit));
    expect(after.map((l) => l.lot)).toEqual(before.lines.map((l) => l.lot));
    expect(after.every((l) => l.unitPrice === 0)).toBe(true);
  });
});

describe('REFORMULATION — mentions obligatoires conservées', () => {
  it('la fourniture client est restaurée si l’IA la supprime', () => {
    const out = sanitizeReformulatedDesignation({
      original: 'Pose de WC suspendu — équipement fourni par la cliente',
      reformulated: 'Pose d’un WC suspendu',
      clientSupplied: true,
    });
    expect(out).toMatch(/fournie? par la cliente/i);
    expect(out).not.toMatch(/^Fourniture/);
  });

  it('la réserve technique est restaurée si l’IA la supprime', () => {
    const out = sanitizeReformulatedDesignation({
      original: 'Pose de poutre bois (réserve technique : section à confirmer après sondage)',
      reformulated: 'Pose d’une poutre en bois',
    });
    expect(out).toMatch(/r[ée]serve technique : section à confirmer après sondage/i);
  });

  it('une réserve déjà présente n’est pas dupliquée', () => {
    const out = sanitizeReformulatedDesignation({
      original: 'Pose de linteau (réserve technique : charge à vérifier)',
      reformulated: 'Pose d’un linteau (réserve technique : charge à vérifier)',
    });
    expect(out.match(/r[ée]serve technique/gi)).toHaveLength(1);
  });

  it('une désignation sans action réelle conserve la source', () => {
    expect(
      sanitizeReformulatedDesignation({ original: 'Pose de lave-mains', reformulated: 'Lave-mains blanc' }),
    ).toBe('Pose de lave-mains');
  });
});
