import { describe, it, expect } from 'vitest';
import { buildDraftLinesFromFacts } from '@/lib/btpFactsToDraft';

const wrap = (facts: any[]) =>
  `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ facts })}</ANAFYPRO_BTP_FACTS>`;

describe('buildDraftLinesFromFacts', () => {
  it('TEST 1 — transfère toutes les lignes ready_for_draft', () => {
    const r = buildDraftLinesFromFacts(wrap([
      { descriptionExact: 'Dépose de cloisons', quantity: 17, unit: 'ml', lot: 'Démolition', status: 'ready_for_draft' },
      { descriptionExact: 'Peinture murs', quantity: 42.5, unit: 'm²', lot: 'Peinture', status: 'ready_for_draft' },
    ]));
    expect(r.lines).toHaveLength(2);
    expect(r.lines.map(l => l.unit)).toEqual(['ml', 'm²']);
    expect(r.lines.every(l => l.unitPrice === 0)).toBe(true);
    expect(r.lines[0].lot).toBe('Démolition');
  });

  it('TEST 2 — réserve technique conservée sans déclasser la quantité', () => {
    const r = buildDraftLinesFromFacts(wrap([
      {
        descriptionExact: 'Ragréage sol', quantity: 24, unit: 'm²',
        status: 'ready_for_draft_with_technical_reservation',
        technicalReservation: 'support à sonder', clientSupplied: true,
      },
    ]));
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].quantity).toBe(24);
    expect(r.lines[0].unit).toBe('m²');
    expect(r.lines[0].designation_fr).toContain('réserve technique : support à sonder');
    expect(r.lines[0].designation_fr).toContain('fourniture à la charge du client');
    expect(r.lines[0].unitPrice).toBe(0);
  });

  it('TEST 3 — mélange : exclut quantity_to_confirm sans bloquer, aucune quantité 1', () => {
    const r = buildDraftLinesFromFacts(wrap([
      { descriptionExact: 'Dépose portes', quantity: 4, unit: 'u', status: 'ready_for_draft' },
      { descriptionExact: 'Dépose fenêtres', quantity: null, unit: null, status: 'quantity_to_confirm' },
      { descriptionExact: 'Divers', quantity: 3, unit: 'u', status: 'not_transferable' },
      { descriptionExact: 'Dépose portes', quantity: 4, unit: 'u', status: 'ready_for_draft' },
    ]));
    expect(r.lines).toHaveLength(1);
    expect(r.pendingCount).toBe(3);
    expect(r.lines.every(l => l.quantity !== 1)).toBe(true);
  });

  it('TEST 4 — aucune ligne transférable', () => {
    const r = buildDraftLinesFromFacts(wrap([
      { descriptionExact: 'Hypothèse', quantity: null, unit: null, status: 'lecture_partielle' },
    ]));
    expect(r.lines).toHaveLength(0);
    expect(r.hasStructuredFacts).toBe(true);
  });
});
