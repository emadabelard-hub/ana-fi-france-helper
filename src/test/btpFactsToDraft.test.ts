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
    expect(r.lines.every(l => l.sourceOrigin === 'btp_facts')).toBe(true);
  });

  it('TEST 2 — réserve technique conservée sans déclasser la quantité', () => {
    const r = buildDraftLinesFromFacts(wrap([
      {
        descriptionExact: 'Ragréage sol', quantity: 24, unit: 'm²',
        status: 'ready_for_draft_with_technical_reservation',
        technicalReservation: 'support à sonder',
      },
    ]));
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].quantity).toBe(24);
    expect(r.lines[0].unit).toBe('m²');
    expect(r.lines[0].designation_fr).toContain('réserve technique : support à sonder');
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
    expect(r.pendingCount).toBe(1); // fenêtres à confirmer ; « Divers » = annotation exclue
    expect(r.excludedAnnotations).toBe(1);
    expect(r.lines.every(l => l.quantity !== 1)).toBe(true);
  });

  it('TEST 4 — aucune ligne transférable', () => {
    const r = buildDraftLinesFromFacts(wrap([
      { descriptionExact: 'Hypothèse', quantity: null, unit: null, status: 'lecture_partielle' },
    ]));
    expect(r.lines).toHaveLength(0);
    expect(r.hasStructuredFacts).toBe(true);
  });

  it('TEST UNITÉS — les unités sources sont conservées telles quelles', () => {
    const r = buildDraftLinesFromFacts(wrap([
      { descriptionExact: 'Création de mur de séparation', quantity: 2, unit: 'ml', status: 'ready_for_draft' },
      { descriptionExact: 'Dépose de parquet et plinthes', quantity: 20, unit: 'm²', status: 'ready_for_draft' },
      { descriptionExact: 'Peinture des murs existants', quantity: 65, unit: 'm²', status: 'ready_for_draft' },
      { descriptionExact: 'Peinture des plafonds', quantity: 100, unit: 'm²', status: 'ready_for_draft' },
    ]));
    expect(r.lines.map(l => `${l.quantity} ${l.unit}`)).toEqual([
      '2 ml', '20 m²', '65 m²', '100 m²',
    ]);
  });

  it('TEST FOURNITURES CLIENT — jamais « Fourniture et pose »', () => {
    const r = buildDraftLinesFromFacts(wrap([
      {
        descriptionExact: 'Fourniture et pose de WC suspendu',
        evidenceText: 'WC suspendu fourni par la cliente',
        quantity: 1, unit: 'u', status: 'ready_for_draft',
      },
    ]));
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].clientSupplied).toBe(true);
    expect(r.lines[0].designation_fr.toLowerCase()).not.toContain('fourniture et pose');
    expect(r.lines[0].designation_fr.toLowerCase()).toContain('pose de wc suspendu');
    expect(r.lines[0].designation_fr.toLowerCase()).toContain('fourni par la cliente');
  });

  it('TEST ANNOTATIONS — charge de poutre et cotes ne créent aucune ligne', () => {
    const r = buildDraftLinesFromFacts(wrap([
      {
        descriptionExact: 'Charge à la poutre bois posée sur linteau L = 3,42 m',
        quantity: 350, unit: 'cm', status: 'certain', category: 'annotation de plan',
      },
      { descriptionExact: 'Solivage longueur', dimensions: '3,50 m', quantity: 3.5, unit: 'm', status: 'certain' },
      { descriptionExact: 'Solivage largeur', dimensions: '3,05 m', quantity: 3.05, unit: 'm', status: 'certain' },
    ]));
    expect(r.lines).toHaveLength(0);
    expect(r.technicalNotes.length).toBeGreaterThan(0);
  });

  it('TEST LOTS — regroupement par lot, un seul bloc par lot', () => {
    const r = buildDraftLinesFromFacts(wrap([
      { descriptionExact: 'Pose de cloison A', quantity: 10, unit: 'm²', lot: 'Cloisons', status: 'ready_for_draft' },
      { descriptionExact: 'Peinture murs A', quantity: 30, unit: 'm²', lot: 'Peinture', status: 'ready_for_draft' },
      { descriptionExact: 'Pose de cloison B', quantity: 12, unit: 'm²', lot: 'Cloisons', status: 'ready_for_draft' },
      { descriptionExact: 'Peinture plafonds A', quantity: 40, unit: 'm²', lot: 'Peinture', status: 'ready_for_draft' },
    ]));
    expect(r.lines.map(l => l.lot)).toEqual(['Cloisons', 'Cloisons', 'Peinture', 'Peinture']);
    expect(r.lines.map(l => l.designation_fr)).toEqual([
      'Pose de cloison A', 'Pose de cloison B', 'Peinture murs A', 'Peinture plafonds A',
    ]);
  });
});

describe('réintégration des vraies prestations (pose / fabrication)', () => {
  const facts = [
    { descriptionExact: 'Fabrication de 3 tablettes dans l\u2019espace douche', quantity: 3, unit: 'u', status: 'ready_for_draft' },
    { descriptionExact: 'WC suspendu', evidenceText: 'WC suspendu fourni par la cliente, pose \u00e0 pr\u00e9voir', quantity: 1, unit: 'u', status: 'ready_for_draft' },
    { descriptionExact: 'Lave-mains', evidenceText: 'lave-mains fourni par la cliente', quantity: 1, unit: 'u', status: 'certain' },
    { descriptionExact: 'Meuble vasque 90 \u00d7 50 cm avec miroir', evidenceText: 'meuble vasque avec miroir fourni par la cliente', quantity: 1, unit: 'u', status: 'ready_for_draft' },
    { descriptionExact: 'Douche compl\u00e8te', evidenceText: 'douche compl\u00e8te fournie par la cliente', quantity: 1, unit: 'u', status: 'ready_for_draft' },
    { descriptionExact: 'Baignoire baln\u00e9o avec tablier', evidenceText: 'baignoire baln\u00e9o avec tablier fournie par la cliente', quantity: 1, unit: 'u', status: 'ready_for_draft' },
    { descriptionExact: 'Charge \u00e0 la poutre bois pos\u00e9e sur linteau L = 3,42 m', quantity: 350, unit: 'cm', status: 'certain', category: 'annotation de plan' },
    { descriptionExact: 'Solivage longueur', dimensions: '3,50 m', quantity: 3.5, unit: 'm', status: 'certain' },
    { descriptionExact: 'Solivage largeur', dimensions: '3,05 m', quantity: 3.05, unit: 'm', status: 'certain' },
  ];

  it('conserve les 6 prestations et exclut les annotations', () => {
    const r = buildDraftLinesFromFacts(wrap(facts));
    const d = r.lines.map((l) => l.designation_fr.toLowerCase());
    expect(r.lines).toHaveLength(6);
    expect(d.some((x) => x.includes('tablettes'))).toBe(true);
    expect(d.some((x) => x.includes('wc suspendu'))).toBe(true);
    expect(d.some((x) => x.includes('lave-mains'))).toBe(true);
    expect(d.some((x) => x.includes('meuble vasque'))).toBe(true);
    expect(d.some((x) => x.includes('douche compl'))).toBe(true);
    expect(d.some((x) => x.includes('baignoire baln'))).toBe(true);
    expect(d.some((x) => x.includes('charge'))).toBe(false);
    expect(d.some((x) => x.includes('solivage'))).toBe(false);
    expect(d.some((x) => x.includes('fourniture et pose'))).toBe(false);
    const tablettes = r.lines.find((l) => l.designation_fr.toLowerCase().includes('tablettes'))!;
    expect(tablettes.quantity).toBe(3);
    expect(tablettes.unit).toBe('u');
  });
});
