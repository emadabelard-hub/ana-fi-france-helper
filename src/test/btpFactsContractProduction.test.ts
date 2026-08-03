import { describe, it, expect } from 'vitest';
import { validateBtpFacts } from '../../supabase/functions/_shared/btpFactsContract';
import { buildDraftLinesFromFacts } from '@/lib/btpFactsToDraft';

const serialize = (contract: unknown) =>
  `<ANAFYPRO_BTP_FACTS>${JSON.stringify(contract)}</ANAFYPRO_BTP_FACTS>`;

const factOf = (contract: ReturnType<typeof validateBtpFacts>, needle: string) =>
  contract.facts.find((f) => f.descriptionExact.toLowerCase().includes(needle.toLowerCase()))!;

describe('contrat BTP — formes de données réellement rencontrées', () => {
  it('attribue u aux prestations dénombrables sans unité (portes, tablettes, sanitaires)', () => {
    const c = validateBtpFacts([
      { id: 'p1', descriptionExact: 'Pose de 4 portes battantes', quantity: 4, unit: null, lot: 'Menuiseries intérieures' },
      { id: 'p2', descriptionExact: 'Fabrication de 3 tablettes', quantity: 3, unit: null, lot: 'Menuiseries intérieures' },
      { id: 'p3', descriptionExact: 'Pose de WC suspendu', quantity: 1, unit: null, lot: 'Sanitaires' },
      { id: 'p4', descriptionExact: 'Installation de douche', quantity: 1, unit: null, lot: 'Sanitaires' },
      { id: 'p5', descriptionExact: 'Pose de baignoire', quantity: 1, unit: null, lot: 'Sanitaires' },
    ]);
    expect(c.facts.map((f) => f.unit)).toEqual(['u', 'u', 'u', 'u', 'u']);
    expect(c.facts.map((f) => f.quantityType)).toEqual(['count', 'count', 'count', 'count', 'count']);
    expect(c.facts.map((f) => f.transferStatus)).toEqual(['ready', 'ready', 'ready', 'ready', 'ready']);
    expect(c.facts.map((f) => f.quantity)).toEqual([4, 3, 1, 1, 1]);
  });

  it('respecte quantityType count déclaré sans unité', () => {
    const c = validateBtpFacts([
      { id: 'q1', descriptionExact: 'Création de points lumineux', quantity: 6, unit: null, quantityType: 'count' },
    ]);
    expect(c.facts[0].unit).toBe('u');
    expect(c.facts[0].transferStatus).toBe('ready');
  });

  it('exclut une portée de poutre de 5,4 m', () => {
    const c = validateBtpFacts([
      { id: 'a1', descriptionExact: 'Portée de la poutre', quantity: 5.4, unit: 'm', evidenceText: 'portée 5,40 m' },
    ]);
    expect(c.facts[0].transferStatus).toBe('excluded');
    expect(c.facts[0].factType).toBe('technical_annotation');
  });

  it('exclut une longueur isolée de soline de 3,50 m', () => {
    const c = validateBtpFacts([
      { id: 'a2', descriptionExact: 'Longueur solivage', quantity: 3.5, unit: 'm', evidenceText: 'longueur 3,50 m' },
    ]);
    expect(c.facts[0].transferStatus).toBe('excluded');
  });

  it('n’applique jamais u à une charge, une section ou une cote sans unité', () => {
    const c = validateBtpFacts([
      { id: 'a3', descriptionExact: 'Charge à la poutre', quantity: 350, unit: null },
      { id: 'a4', descriptionExact: 'Section du profilé', quantity: 120, unit: null },
      { id: 'a5', descriptionExact: 'Hauteur sous plafond', quantity: 2, unit: null },
    ]);
    expect(c.facts.map((f) => f.unit)).toEqual([null, null, null]);
    expect(c.facts.every((f) => f.transferStatus === 'excluded')).toBe(true);
  });

  it('conserve un mur de 2 ml avec réserve technique en ready', () => {
    const c = validateBtpFacts([
      {
        id: 'm1', descriptionExact: 'Dépose de mur de séparation', quantity: 2, unit: 'ml',
        lot: 'Démolition', evidenceText: 'mur de 2 ml, caractère porteur à confirmer',
      },
    ]);
    const f = c.facts[0];
    expect(f.transferStatus).toBe('ready');
    expect(f.unit).toBe('ml');
    expect(f.quantity).toBe(2);
    expect(f.technicalReservation).toBeTruthy();
  });

  it('conserve une façade de 6 ml selon plan structure en ready', () => {
    const c = validateBtpFacts([
      {
        id: 'f1', descriptionExact: 'Reprise de façade', quantity: 6, unit: 'ml',
        lot: 'Maçonnerie', evidenceText: 'façade 6 ml suivant plan structure',
      },
    ]);
    expect(c.facts[0].transferStatus).toBe('ready');
    expect(c.facts[0].unit).toBe('ml');
  });

  it('laisse clientSupplied à null pour « séparer fourniture et pose »', () => {
    const c = validateBtpFacts([
      { id: 's1', descriptionExact: 'Séparer fourniture et pose', quantity: null, unit: null },
    ]);
    expect(c.facts[0].clientSupplied).toBeNull();
  });

  it('conserve coffrage 12 ml et finition 7 m² comme deux faits distincts', () => {
    const c = validateBtpFacts([
      { id: 'c1', descriptionExact: 'Réalisation de coffrage', quantity: 12, unit: 'ml', lot: 'Cloisons' },
      { id: 'c2', descriptionExact: 'Application enduit et peinture', quantity: 7, unit: 'm2', lot: 'Peinture' },
    ]);
    expect(c.facts).toHaveLength(2);
    expect(c.facts.map((f) => `${f.quantity} ${f.unit}`)).toEqual(['12 ml', '7 m²']);
  });

  it('expose les faits pending avec leur motif exact sans les perdre', () => {
    const c = validateBtpFacts([
      { id: 'x1', descriptionExact: 'Création des réseaux par le sous-sol', quantity: null, unit: null },
    ]);
    expect(c.facts[0].transferStatus).toBe('pending');
    const draft = buildDraftLinesFromFacts(serialize(c));
    expect(draft.lines).toHaveLength(0);
    expect(draft.pending).toHaveLength(1);
    expect(draft.pending[0].designation).toBe('Création des réseaux par le sous-sol');
    expect(draft.pending[0].reasons).toContain('quantity_missing');
    expect(draft.pending[0].reasons).toContain('unit_missing');
  });
});

describe('cohérence contrat ↔ rapport ↔ brouillon de devis', () => {
  const raw = [
    { id: 'p1', descriptionExact: 'Pose de 4 portes battantes', quantity: 4, unit: null, lot: 'Menuiseries intérieures' },
    { id: 'p2', descriptionExact: 'Pose de WC suspendu', quantity: 1, unit: null, lot: 'Sanitaires' },
    { id: 'p3', descriptionExact: 'Dépose de mur de séparation', quantity: 2, unit: 'ml', lot: 'Démolition' },
    { id: 'p4', descriptionExact: 'Réalisation de coffrage', quantity: 12, unit: 'ml', lot: 'Cloisons' },
    { id: 'p5', descriptionExact: 'Application enduit et peinture', quantity: 7, unit: 'm2', lot: 'Peinture' },
    { id: 'p6', descriptionExact: 'Création des réseaux par le sous-sol', quantity: null, unit: null },
    { id: 'p7', descriptionExact: 'Portée de la poutre', quantity: 5.4, unit: 'm' },
  ];

  it('le nombre de faits ready égale le nombre de lignes créées', () => {
    const contract = validateBtpFacts(raw);
    const draft = buildDraftLinesFromFacts(serialize(contract));
    const readyIds = contract.facts.filter((f) => f.transferStatus === 'ready').map((f) => f.factId);
    expect(draft.fromContract).toBe(true);
    expect(draft.lines).toHaveLength(readyIds.length);
    expect(draft.pendingCount).toBe(contract.counts.pending);
    expect(draft.excludedAnnotations).toBe(contract.counts.excluded);
  });

  it('ne dédoublonne qu’un doublon portant exactement le même factId', () => {
    const contract = validateBtpFacts([
      ...raw,
      { id: 'p3', descriptionExact: 'Dépose de mur de séparation', quantity: 2, unit: 'ml', lot: 'Démolition' },
      { id: 'p8', descriptionExact: 'Dépose de mur de séparation', quantity: 2, unit: 'ml', lot: 'Démolition' },
    ]);
    const draft = buildDraftLinesFromFacts(serialize(contract));
    const uniqueReady = new Set(
      contract.facts.filter((f) => f.transferStatus === 'ready').map((f) => f.factId),
    );
    expect(draft.lines).toHaveLength(uniqueReady.size);
    // Le fait distinct p8, de libellé identique, reste une ligne à part entière.
    expect(draft.lines.filter((l) => l.designation_fr.startsWith('Dépose de mur'))).toHaveLength(2);
  });

  it('aucune quantité ni unité du contrat n’est réécrite dans le brouillon', () => {
    const contract = validateBtpFacts(raw);
    const draft = buildDraftLinesFromFacts(serialize(contract));
    for (const line of draft.lines) {
      const f = factOf(contract, line.designation_fr.split(' (')[0].split(' — ')[0]);
      expect(line.quantity).toBe(f.quantity);
      expect(line.unit).toBe(f.unit);
      expect(line.unitPrice).toBe(0);
    }
  });
});
