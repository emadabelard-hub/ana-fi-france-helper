import { describe, it, expect } from 'vitest';
import { validateBtpFacts, serializeFactsContract } from '../../supabase/functions/_shared/btpFactsContract';
import { buildDraftLinesFromFacts } from '@/lib/btpFactsToDraft';

const FILE = 'cdc-projet-helene-labi-delaplace.docx';
const PREFIX = 'depose|demolition|depose-de-';

// 28 prestations distinctes du même fichier, avec des ids bruts partageant
// volontairement les 64 premiers caractères (collisions constatées en production).
const longId = (n: number) =>
  `${FILE}|${PREFIX}${'x'.repeat(80)}|${n}`;

const READY = Array.from({ length: 28 }, (_, i) => ({
  id: longId(i),
  sourceFile: FILE,
  page: 1 + (i % 3),
  lot: i % 2 === 0 ? 'Démolition' : 'Peinture',
  descriptionExact: `Dépose de l'ouvrage n°${i + 1}`,
  quantity: i + 2,
  unit: i % 3 === 0 ? 'ml' : i % 3 === 1 ? 'm²' : 'u',
  status: 'ready_for_draft',
}));

describe('collisions de factId', () => {
  const contract = validateBtpFacts(READY);

  it('28 faits ready', () => {
    expect(contract.counts.ready).toBe(28);
  });

  it('28 factId distincts', () => {
    const ids = new Set(contract.facts.map((f) => f.factId));
    expect(ids.size).toBe(28);
    expect(contract.facts.every((f) => f.factId.startsWith('btp_'))).toBe(true);
  });

  it('28 lignes produites par buildDraftLinesFromFacts', () => {
    const r = buildDraftLinesFromFacts(serializeFactsContract(contract));
    expect(r.lines).toHaveLength(28);
  });

  it('aucune quantité, unité ou lot modifié', () => {
    const r = buildDraftLinesFromFacts(serializeFactsContract(contract));
    expect(r.lines.map((l) => l.quantity)).toEqual(READY.map((f) => f.quantity));
    expect(r.lines.map((l) => l.unit)).toEqual(
      contract.facts.map((f) => f.unit),
    );
    expect(r.lines.every((l) => !!l.lot)).toBe(true);
  });

  it('identifiant stable pour un même fait', () => {
    const again = validateBtpFacts(READY);
    expect(again.facts.map((f) => f.factId)).toEqual(contract.facts.map((f) => f.factId));
  });

  it('un vrai doublon strictement identique est encore supprimé', () => {
    const dup = { ...READY[0] };
    const c = validateBtpFacts([...READY, dup]);
    const r = buildDraftLinesFromFacts(serializeFactsContract(c));
    expect(r.lines).toHaveLength(28);
  });
});
