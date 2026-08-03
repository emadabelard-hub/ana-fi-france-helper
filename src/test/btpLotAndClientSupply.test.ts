import { describe, it, expect } from 'vitest';
import { buildDraftLinesFromFacts, sanitizeReformulatedDesignation } from '@/lib/btpFactsToDraft';

const wrap = (facts: any[]) =>
  `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ facts })}</ANAFYPRO_BTP_FACTS>`;

describe('TEST LOTS — chaque ligne conserve son lot réel', () => {
  const r = buildDraftLinesFromFacts(wrap([
    { descriptionExact: 'Dépose de cloison existante', quantity: 12, unit: 'm²', lot: 'Démolition', status: 'ready_for_draft' },
    { descriptionExact: 'Pose de cloison BA13 avec isolation', quantity: 24, unit: 'm²', lot: 'Cloisons', status: 'ready_for_draft' },
    { descriptionExact: 'Pose de bloc-porte intérieur', quantity: 3, unit: 'u', lot: 'Menuiserie', status: 'ready_for_draft' },
    { descriptionExact: 'Application de peinture murs et plafonds', quantity: 65, unit: 'm²', lot: 'Peinture', status: 'ready_for_draft' },
    { descriptionExact: 'Pose de carrelage au sol', quantity: 20, unit: 'm²', lot: 'Revêtements de sol', status: 'ready_for_draft' },
    { descriptionExact: 'Pose de WC suspendu', quantity: 1, unit: 'ens', lot: 'Plomberie', status: 'ready_for_draft' },
    { descriptionExact: 'Application de peinture sur boiseries', quantity: 8, unit: 'm²', lot: 'Peinture', status: 'ready_for_draft' },
  ]));

  it('aucun lot remplacé par Création', () => {
    expect(r.lines).toHaveLength(7);
    expect(r.lines.every((l) => !/cr[ée]ation/i.test(l.lot || ''))).toBe(true);
  });

  it('chaque ligne reste dans son lot métier', () => {
    const byDes = new Map(r.lines.map((l) => [l.designation_fr, l.lot]));
    expect(byDes.get('Dépose de cloison existante')).toBe('DÉPOSE / DÉMOLITION');
    expect(byDes.get('Pose de cloison BA13 avec isolation')).toBe('CLOISONS / DOUBLAGE / ISOLATION');
    expect(byDes.get('Pose de bloc-porte intérieur')).toBe('MENUISERIE');
    expect(byDes.get('Pose de carrelage au sol')).toBe('SOLS / REVÊTEMENTS');
    expect(byDes.get('Pose de WC suspendu')).toBe('PLOMBERIE / SANITAIRES');
  });

  it('le lot Peinture est regroupé une seule fois, ordre conservé', () => {
    const lots = r.lines.map((l) => l.lot);
    const uniq = [...new Set(lots)];
    expect(uniq).toHaveLength(6);
    expect(lots.filter((l) => l === 'FINITIONS / PEINTURE')).toHaveLength(2);
    // les deux lignes peinture sont adjacentes après regroupement
    const first = lots.indexOf('FINITIONS / PEINTURE');
    expect(lots[first + 1]).toBe('FINITIONS / PEINTURE');
  });

  it('aucune unité, quantité ou prix modifié', () => {
    expect(r.lines.map((l) => l.unit).sort()).toEqual(['ens', 'm²', 'm²', 'm²', 'm²', 'm²', 'u'].sort());
    expect(r.lines.every((l) => l.unitPrice === 0)).toBe(true);
    expect(r.lines.every((l) => l.quantity > 0)).toBe(true);
  });

  it('lot inféré uniquement si le lot source est absent ou générique', () => {
    const x = buildDraftLinesFromFacts(wrap([
      { descriptionExact: 'Pose de parquet flottant', quantity: 15, unit: 'm²', lot: 'Création', status: 'ready_for_draft' },
      { descriptionExact: 'Pose de prises et interrupteurs', quantity: 10, unit: 'u', status: 'ready_for_draft' },
      { descriptionExact: 'Pose de plinthes', quantity: 30, unit: 'ml', lot: 'Lot spécifique agencement', status: 'ready_for_draft' },
    ]));
    expect(x.lines[0].lot).toBe('SOLS / REVÊTEMENTS');
    expect(x.lines[1].lot).toBe('ÉLECTRICITÉ');
    expect(x.lines[2].lot).toBe('SPÉCIFIQUE AGENCEMENT');
  });
});

describe('TEST FOURNITURE CLIENT', () => {
  const r = buildDraftLinesFromFacts(wrap([
    { descriptionExact: 'Fourniture et pose de WC suspendu', evidenceText: 'équipement fourni par la cliente', quantity: 1, unit: 'ens', lot: 'Plomberie', status: 'ready_for_draft' },
    { descriptionExact: 'Pose de carrelage', evidenceText: 'carrelage fourni par le client', quantity: 20, unit: 'm²', lot: 'Sols', status: 'ready_for_draft' },
    { descriptionExact: 'Pose de porte', clientSupplied: true, quantity: 2, unit: 'u', lot: 'Menuiserie', status: 'ready_for_draft' },
    { descriptionExact: 'Pose de meuble vasque', evidenceText: 'à la charge du client', quantity: 1, unit: 'u', lot: 'Plomberie', status: 'ready_for_draft' },
  ]));

  it('la prestation de pose est conservée et signalée', () => {
    expect(r.lines).toHaveLength(4);
    expect(r.lines.every((l) => /pose/i.test(l.designation_fr))).toBe(true);
    expect(r.lines.every((l) => l.clientSupplied === true)).toBe(true);
    expect(r.lines.every((l) => /fourni(?:e)?\s+par\s+(?:le|la)\s+client/i.test(l.designation_fr))).toBe(true);
  });

  it('aucune désignation ne devient « Fourniture et pose » / « Fourniture de »', () => {
    expect(r.lines.every((l) => !/^fourniture/i.test(l.designation_fr))).toBe(true);
  });

  it('aucun détail technique non prouvé ajouté', () => {
    const banned = /raccordement|mise en service|b[âa]ti[- ]support|robinetterie|colle|joints|[ée]tanch[ée]it[ée]|[ée]vacuation|nettoyage/i;
    expect(r.lines.every((l) => !banned.test(l.designation_fr))).toBe(true);
  });
});

describe('TEST REFORMULATION — validation déterministe post-IA', () => {
  it('restaure la mention client et refuse « Fourniture et pose »', () => {
    const out = sanitizeReformulatedDesignation({
      original: 'Pose de WC suspendu — équipement fourni par la cliente',
      reformulated: 'Fourniture et pose de WC suspendu',
      clientSupplied: true,
    });
    expect(out).toMatch(/^Pose de WC suspendu/);
    expect(out).not.toMatch(/^Fourniture/);
    expect(out).toMatch(/fournie? par la cliente|fourni par le client/i);
  });

  it('conserve la désignation d’origine si l’action réelle disparaît', () => {
    const original = 'Pose de carrelage — matériel fourni par le client';
    expect(sanitizeReformulatedDesignation({ original, reformulated: 'Carrelage grès cérame 60x60', clientSupplied: true }))
      .toBe(original);
  });

  it('accepte une reformulation fidèle', () => {
    expect(sanitizeReformulatedDesignation({
      original: 'Pose cloison',
      reformulated: 'Pose de cloison en plaques de plâtre',
    })).toBe('Pose de cloison en plaques de plâtre');
  });
});

describe('TEST NON-RÉGRESSION', () => {
  it('unités et quantités sources intactes, annotations exclues', () => {
    const r = buildDraftLinesFromFacts(wrap([
      { descriptionExact: 'Fabrication de tablette sur mesure', quantity: 2, unit: 'ml', lot: 'Menuiserie', status: 'ready_for_draft' },
      { descriptionExact: 'Charge à reprendre sur linteau', quantity: 350, unit: 'kg', lot: 'Structure', status: 'ready_for_draft' },
      { descriptionExact: 'Section poutre IPE', quantity: 120, unit: 'mm', lot: 'Structure', status: 'ready_for_draft' },
      { descriptionExact: 'Pose de lave-mains', quantity: 1, unit: 'u', lot: 'Plomberie', status: 'ready_for_draft' },
    ]));
    expect(r.lines.map((l) => l.designation_fr)).toEqual([
      'Fabrication de tablette sur mesure',
      'Pose de lave-mains',
    ]);
    expect(r.lines.map((l) => l.unit)).toEqual(['ml', 'u']);
    expect(r.lines.map((l) => l.quantity)).toEqual([2, 1]);
    expect(r.lines.every((l) => l.unitPrice === 0)).toBe(true);
    expect(r.excludedAnnotations).toBe(2);
  });
});
