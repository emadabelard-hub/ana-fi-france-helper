import { describe, it, expect } from 'vitest';
import { buildDraftLinesFromFacts } from '@/lib/btpFactsToDraft';

const contract = (facts: any[]) =>
  `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ version: 1, facts })}</ANAFYPRO_BTP_FACTS>`;

describe('contrat unique de fait BTP — transfert sans réinterprétation', () => {
  it('transfère les faits ready en conservant quantité, unité et lot', () => {
    const r = buildDraftLinesFromFacts(contract([
      { factId: 'f1', descriptionExact: 'Création de mur de séparation', lot: 'Cloisons', factType: 'billable_work', quantity: 2, unit: 'ml', transferStatus: 'ready' },
      { factId: 'f2', descriptionExact: 'Peinture des murs', lot: 'Peinture', factType: 'billable_work', quantity: 65, unit: 'm²', transferStatus: 'ready' },
    ]));
    expect(r.lines.map(l => `${l.quantity} ${l.unit}`)).toEqual(['2 ml', '65 m²']);
    expect(r.lines.every(l => l.sourceOrigin === 'btp_facts')).toBe(true);
    expect(r.lines.every(l => l.unitPrice === 0)).toBe(true);
  });

  it('exclut les annotations et dimensions sans les transformer en prestations', () => {
    const r = buildDraftLinesFromFacts(contract([
      { factId: 'f1', descriptionExact: 'Charge à la poutre', factType: 'technical_annotation', quantity: 350, unit: null, transferStatus: 'excluded' },
      { factId: 'f2', descriptionExact: 'Longueur solivage', factType: 'dimension', quantity: 3.5, unit: 'ml', transferStatus: 'excluded' },
    ]));
    expect(r.lines).toHaveLength(0);
    expect(r.excludedAnnotations).toBe(2);
    expect(r.technicalNotes.length).toBe(2);
  });

  it('compte les faits pending sans inventer quantité 1 ni unité u', () => {
    const r = buildDraftLinesFromFacts(contract([
      { factId: 'f1', descriptionExact: 'Pose de WC suspendu', factType: 'billable_work', quantity: 1, unit: null, transferStatus: 'pending' },
      { factId: 'f2', descriptionExact: 'Pose de lave-mains', factType: 'billable_work', quantity: 1, unit: 'u', transferStatus: 'ready' },
    ]));
    expect(r.pendingCount).toBe(1);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].unit).toBe('u');
  });

  it('conserve la mention fourniture client et la réserve technique', () => {
    const r = buildDraftLinesFromFacts(contract([
      {
        factId: 'f1', descriptionExact: 'Fourniture et pose de meuble vasque',
        factType: 'billable_work', quantity: 1, unit: 'u', transferStatus: 'ready',
        clientSupplied: true, technicalReservation: 'support à sonder',
      },
    ]));
    const d = r.lines[0].designation_fr.toLowerCase();
    expect(d).not.toContain('fourniture et pose');
    expect(d).toContain('réserve technique : support à sonder');
    expect(r.lines[0].clientSupplied).toBe(true);
  });

  it('regroupe une seule fois par lot', () => {
    const r = buildDraftLinesFromFacts(contract([
      { factId: 'a', descriptionExact: 'Pose cloison A', lot: 'Cloisons', factType: 'billable_work', quantity: 10, unit: 'm²', transferStatus: 'ready' },
      { factId: 'b', descriptionExact: 'Peinture murs', lot: 'Peinture', factType: 'billable_work', quantity: 30, unit: 'm²', transferStatus: 'ready' },
      { factId: 'c', descriptionExact: 'Pose cloison B', lot: 'Cloisons', factType: 'billable_work', quantity: 12, unit: 'm²', transferStatus: 'ready' },
    ]));
    expect(r.lines.map(l => l.designation_fr)).toEqual(['Pose cloison A', 'Pose cloison B', 'Peinture murs']);
  });
});
