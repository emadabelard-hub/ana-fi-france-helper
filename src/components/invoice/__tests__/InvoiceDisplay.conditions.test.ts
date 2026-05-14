import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Static guard: ensures the "Conditions Générales" block exists in
 * InvoiceDisplay, is rendered ONLY for DEVIS, kept on a single page,
 * styled as small grey text, and visually separated by a top border.
 */
describe('InvoiceDisplay — Conditions Générales (DEVIS only)', () => {
  const source = readFileSync(
    path.resolve(__dirname, '../InvoiceDisplay.tsx'),
    'utf-8'
  );

  // Isolate the CGV block
  const blockMatch = source.match(
    /CONDITIONS GÉNÉRALES[\s\S]*?\{data\.type === 'DEVIS' && \(([\s\S]*?)\n\s{12}\)\}/
  );

  it('contains the conditions block', () => {
    expect(blockMatch, 'Conditions Générales block not found').toBeTruthy();
  });

  const block = blockMatch?.[1] ?? '';

  it('is gated on DEVIS only (never rendered for FACTURE)', () => {
    expect(source).toMatch(/\{data\.type === 'DEVIS' && \([\s\S]*?Conditions Générales/);
  });

  it('includes the 4 mandatory clauses', () => {
    expect(block).toMatch(/Réserve de propriété/);
    expect(block).toMatch(/Suspension de chantier/);
    expect(block).toMatch(/Garantie décennale/);
    expect(block).toMatch(/Litiges/);
  });

  it('uses small text sizes (≤ 7pt)', () => {
    expect(block).toMatch(/text-\[7pt\]/);   // title
    expect(block).toMatch(/text-\[6\.5pt\]/); // body
  });

  it('uses sober grey colors', () => {
    expect(block).toMatch(/text-gray-(400|500)/);
  });

  it('is visually separated by a top border', () => {
    expect(block).toMatch(/borderTop:\s*'1px solid/);
  });

  it('is marked unbreakable across PDF pages', () => {
    expect(block).toMatch(/pageBreakInside:\s*'avoid'/);
    expect(block).toMatch(/breakInside:\s*'avoid'/);
    expect(block).toMatch(/invoice-conditions-block/);
  });
});

/**
 * Guard the PDF engine CSS contract that enforces the page-break rule
 * for .invoice-conditions-block.
 */
describe('pdfEngine — page-break rule for conditions block', () => {
  const engine = readFileSync(
    path.resolve(__dirname, '../../../lib/pdfEngine.ts'),
    'utf-8'
  );

  it('keeps .invoice-conditions-block on a single page', () => {
    const rule = engine.match(
      /\.invoice-conditions-block[\s\S]{0,200}page-break-inside:\s*avoid/
    );
    expect(rule, 'CSS rule for invoice-conditions-block missing').toBeTruthy();
  });
});
