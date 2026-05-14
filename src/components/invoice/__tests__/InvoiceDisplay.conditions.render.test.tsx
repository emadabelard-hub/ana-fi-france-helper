import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import InvoiceDisplay, { type InvoiceData } from '../InvoiceDisplay';

const makeDoc = (overrides: Partial<InvoiceData>): InvoiceData => ({
  type: 'DEVIS',
  number: 'D-2026-0001',
  date: '14/05/2026',
  emitter: {
    name: 'Artisan Test SARL',
    siret: '12345678901234',
    address: '12 rue Lafayette, 75009 Paris',
    iban: 'FR7630006000011234567890189',
  },
  client: {
    name: 'Client SARL',
    address: '5 av. de la République, 75011 Paris',
  },
  items: [
    { designation_fr: 'Peinture murs salon', designation_ar: '', quantity: 25, unit: 'm²', unitPrice: 28, total: 700 },
  ],
  subtotal: 700,
  tvaRate: 10,
  tvaAmount: 70,
  total: 770,
  tvaExempt: false,
  tvaRegime: 'standard',
  paymentTerms: 'Acompte 30% à la commande, solde à la fin des travaux.',
  ...overrides,
});

const ASSERT_CLAUSES = [
  /Réserve de propriété/,
  /Suspension de chantier/,
  /Garantie décennale/,
  /Litiges/,
];

const devisFixtures: Array<[string, Partial<InvoiceData>]> = [
  ['DEVIS standard TVA 10%', {}],
  ['DEVIS TVA 20% avec remise', {
    number: 'D-2026-0002',
    tvaRate: 20, tvaAmount: 140, total: 840,
    discountType: 'percent', discountValue: 10, discountAmount: 70, subtotalAfterDiscount: 630,
  }],
  ['DEVIS franchise TVA (auto-entrepreneur)', {
    number: 'D-2026-0003',
    tvaRate: 0, tvaAmount: 0, total: 700,
    tvaExempt: true, tvaRegime: 'franchise',
    tvaMention: 'TVA non applicable, art. 293 B du CGI',
  }],
  ['DEVIS multi-jalons', {
    number: 'D-2026-0004',
    paymentMilestones: [
      { id: '1', label: 'Acompte', mode: 'percent', percent: 30 },
      { id: '2', label: 'Solde', mode: 'percent', percent: 70 },
    ],
  }],
  ['DEVIS multi-lignes', {
    number: 'D-2026-0005',
    items: [
      { designation_fr: 'Peinture', designation_ar: '', quantity: 25, unit: 'm²', unitPrice: 28, total: 700 },
      { designation_fr: 'Plomberie', designation_ar: '', quantity: 1, unit: 'forfait', unitPrice: 450, total: 450 },
      { designation_fr: 'Électricité', designation_ar: '', quantity: 1, unit: 'forfait', unitPrice: 320, total: 320 },
    ],
    subtotal: 1470, tvaAmount: 147, total: 1617,
  }],
];

describe('InvoiceDisplay — Conditions Générales rendering on multiple DEVIS', () => {
  for (const [label, overrides] of devisFixtures) {
    it(`affiche les 4 clauses sur : ${label}`, () => {
      const { container } = render(
        <InvoiceDisplay data={makeDoc(overrides)} showArabic={false} />
      );

      const block = container.querySelector('.invoice-conditions-block.mt-2');
      // The conditions block targeted has class 'invoice-conditions-block mt-2 pt-1.5'
      // but there's another payment-conditions block. We pick the one containing 'Conditions Générales'.
      const allBlocks = container.querySelectorAll('.invoice-conditions-block');
      const cgBlock = Array.from(allBlocks).find(el =>
        /Conditions Générales/i.test(el.textContent || '')
      );

      expect(cgBlock, `Bloc "Conditions Générales" introuvable pour ${label}`).toBeTruthy();

      const text = cgBlock!.textContent || '';
      for (const re of ASSERT_CLAUSES) {
        expect(text).toMatch(re);
      }

      // Vérifie le style d'insécabilité PDF inline
      const html = (cgBlock as HTMLElement).outerHTML;
      expect(html).toMatch(/page-break-inside:\s*avoid/i);
      expect(html).toMatch(/border-top:\s*1px solid/i);
    });
  }

  it("n'affiche PAS les Conditions Générales sur une FACTURE", () => {
    const { container } = render(
      <InvoiceDisplay
        data={makeDoc({ type: 'FACTURE', number: 'F-2026-0001' })}
        showArabic={false}
      />
    );
    expect(container.textContent || '').not.toMatch(/Conditions Générales/);
  });
});
