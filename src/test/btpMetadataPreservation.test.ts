import { describe, it, expect } from 'vitest';
import { validateDocument, type DocumentItem } from '@/lib/documentValidator';

const btpLine = (over: Partial<DocumentItem>): DocumentItem => ({
  id: 'x',
  sourceOrigin: 'btp_facts',
  designation_fr: 'Prestation',
  designation_ar: '',
  quantity: 1,
  unit: 'u',
  unitPrice: 10,
  total: 10,
  ...over,
});

describe('unités BTP préservées', () => {
  const cases: Array<[number, string]> = [
    [2, 'ml'],
    [65, 'm²'],
    [100, 'm²'],
    [20, 'm²'],
    [17, 'ml'],
    [4, 'u'],
  ];

  for (const [quantity, unit] of cases) {
    it(`${quantity} ${unit} reste ${quantity} ${unit}`, () => {
      const r = validateDocument(
        [btpLine({ designation_fr: 'Traitement de fissures et pose de plinthes', quantity, unit, unitPrice: 30, total: quantity * 30 })],
        20,
        false,
      );
      expect(r.items[0].unit).toBe(unit);
      expect(r.items[0].quantity).toBe(quantity);
      expect(r.items[0].sourceOrigin).toBe('btp_facts');
    });
  }

  it('normalise seulement la typographie (m2 → m², ML → ml, U → u)', () => {
    const r = validateDocument(
      [
        btpLine({ id: 'a', unit: 'm2' }),
        btpLine({ id: 'b', unit: 'ML' }),
        btpLine({ id: 'c', unit: 'U' }),
        btpLine({ id: 'd', unit: 'm3' }),
      ],
      20,
      false,
    );
    expect(r.items.map((i) => i.unit)).toEqual(['m²', 'ml', 'u', 'm³']);
  });

  it('ne compte aucune correction si l’unité est déjà normalisée', () => {
    const r = validateDocument([btpLine({ unit: 'm²' })], 20, false);
    expect(r.corrections.filter((c) => c.field === 'Unité')).toHaveLength(0);
  });

  it('produit un avertissement sans modifier une unité inhabituelle', () => {
    const r = validateDocument(
      [btpLine({ designation_fr: 'Pose de plinthes bois', quantity: 17, unit: 'm²', unitPrice: 12, total: 204 })],
      20,
      false,
    );
    expect(r.items[0].unit).toBe('m²');
    expect(r.warnings.some((w) => w.field === 'Unité')).toBe(true);
    expect(r.corrections).toHaveLength(0);
  });
});

describe('prix BTP jamais réécrits', () => {
  it('conserve un prix volontairement bas et n’écrit aucun total', () => {
    const r = validateDocument(
      [btpLine({ designation_fr: 'Application de peinture', quantity: 65, unit: 'm²', unitPrice: 1, total: 65 })],
      20,
      false,
    );
    expect(r.items[0].unitPrice).toBe(1);
    expect(r.items[0].total).toBe(65);
    expect(r.corrections).toHaveLength(0);
    expect(r.warnings.some((w) => w.reason === 'Prix inhabituel — vérifiez le montant')).toBe(true);
  });

  it('ne corrige plus aucun prix, même hors ligne BTP', () => {
    const r = validateDocument(
      [{ ...btpLine({ designation_fr: 'Application de peinture', quantity: 10, unit: 'm²', unitPrice: 1, total: 10 }), sourceOrigin: undefined }],
      20,
      false,
    );
    expect(r.items[0].unitPrice).toBe(1);
    expect(r.corrections.some((c) => c.field === 'Prix unitaire')).toBe(false);
    expect(r.warnings.some((w) => w.field === 'Prix unitaire')).toBe(true);
  });

});

describe('métadonnées transportées par la ligne', () => {
  it('conserve sourceOrigin, clientSupplied et lot après validation', () => {
    const r = validateDocument(
      [btpLine({ clientSupplied: true, lot: 'Plomberie', designation_fr: 'Pose de WC — Équipement fourni par la cliente', unit: 'u', quantity: 1 })],
      20,
      false,
    );
    expect(r.items[0].clientSupplied).toBe(true);
    expect(r.items[0].lot).toBe('Plomberie');
    expect(r.items[0].sourceOrigin).toBe('btp_facts');
    expect(r.items[0].designation_fr).not.toMatch(/Fourniture et pose/i);
  });

  it('reste correct même si une ligne de frais est ajoutée ou une ligne filtrée', () => {
    const source = [
      btpLine({ id: 'l1', quantity: 2, unit: 'ml', designation_fr: 'Traitement de fissures' }),
      btpLine({ id: 'l2', quantity: 65, unit: 'm²', clientSupplied: true, designation_fr: 'Pose de carrelage — Équipement fourni par la cliente' }),
    ];
    const withFees: DocumentItem[] = [
      ...source.filter((l) => l.designation_fr.trim()),
      { id: 'fees', designation_fr: 'Frais de déplacement', designation_ar: '', quantity: 1, unit: 'forfait', unitPrice: 60, total: 60 },
    ];
    const r = validateDocument(withFees, 20, false);
    expect(r.items[0].unit).toBe('ml');
    expect(r.items[1].unit).toBe('m²');
    expect(r.items[1].clientSupplied).toBe(true);
    expect(r.items[2].sourceOrigin).toBeUndefined();
  });

  it('survit à une sérialisation/désérialisation de brouillon', () => {
    const line = btpLine({ clientSupplied: true, lot: 'Menuiserie', unit: 'ml', quantity: 17 });
    const restored = JSON.parse(JSON.stringify([line])) as DocumentItem[];
    const r = validateDocument(restored, 20, false);
    expect(r.items[0].sourceOrigin).toBe('btp_facts');
    expect(r.items[0].clientSupplied).toBe(true);
    expect(r.items[0].unit).toBe('ml');
    expect(r.items[0].quantity).toBe(17);
  });
});
