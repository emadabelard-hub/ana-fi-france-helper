/**
 * E2E test — Conditions Générales on generated DEVIS PDFs.
 *
 * Pipeline tested end-to-end:
 *   InvoiceDisplay component → React render → printable HTML →
 *   headless Chromium (same engine as Browserless used in production) →
 *   PDF/A → pdftotext extraction → assertions on every page.
 *
 * For each scenario we assert:
 *   1. PDF is a valid binary
 *   2. The 4 mandatory clauses appear in the output
 *   3. The 4 clauses are all on the SAME page (no split)
 *   4. The block sits on the LAST page (bottom of document)
 *
 * The FACTURE scenario asserts the block is absent.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import InvoiceDisplay, { type InvoiceData } from '../InvoiceDisplay';

const CLAUSES = [
  'Réserve de propriété',
  'Suspension de chantier',
  'Garantie décennale',
  'Litiges',
];

// ── Fixture builder ──────────────────────────────────────────────────────────
const baseDoc = (over: Partial<InvoiceData>): InvoiceData => ({
  type: 'DEVIS',
  number: 'D-2026-E2E',
  date: '14/05/2026',
  emitter: {
    name: 'Artisan E2E SARL',
    siret: '12345678901234',
    address: '12 rue Lafayette, 75009 Paris',
    iban: 'FR7630006000011234567890189',
  },
  client: { name: 'Client E2E', address: '5 av. République, 75011 Paris' },
  items: [{ designation_fr: 'Peinture salon', designation_ar: '', quantity: 25, unit: 'm²', unitPrice: 28, total: 700 }],
  subtotal: 700, tvaRate: 10, tvaAmount: 70, total: 770,
  tvaExempt: false, tvaRegime: 'standard',
  paymentTerms: 'Acompte 30% à la commande, solde à la fin des travaux.',
  ...over,
});

const repeatItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    designation_fr: `Prestation BTP ${i + 1} — peinture, plomberie, électricité`,
    designation_ar: '',
    quantity: 10 + i,
    unit: 'm²',
    unitPrice: 28,
    total: (10 + i) * 28,
  }));

const SCENARIOS: Array<{ name: string; data: Partial<InvoiceData>; expectCgv: boolean }> = [
  {
    name: 'court-tva10',
    data: { number: 'D-2026-E001', items: repeatItems(4) },
    expectCgv: true,
  },
  {
    name: 'moyen-tva20-remise',
    data: {
      number: 'D-2026-E002',
      tvaRate: 20, tvaAmount: 140, total: 840,
      discountType: 'percent', discountValue: 10, discountAmount: 70, subtotalAfterDiscount: 630,
      items: repeatItems(15),
    },
    expectCgv: true,
  },
  {
    name: 'long-multipage',
    data: {
      number: 'D-2026-E003',
      items: repeatItems(45),
      subtotal: 12_600, tvaAmount: 1_260, total: 13_860,
    },
    expectCgv: true,
  },
  {
    name: 'edge-pagebreak',
    data: {
      number: 'D-2026-E004',
      items: repeatItems(28),
      paymentMilestones: [
        { id: '1', label: 'Acompte', mode: 'percent', percent: 30 },
        { id: '2', label: 'Mi-chantier', mode: 'percent', percent: 40 },
        { id: '3', label: 'Solde', mode: 'percent', percent: 30 },
      ],
    },
    expectCgv: true,
  },
  {
    name: 'facture-control',
    data: { number: 'F-2026-E001', type: 'FACTURE', items: repeatItems(4) },
    expectCgv: false,
  },
];

// ── HTML wrapping the component output with PDF-faithful styles ──────────────
function wrapHTML(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 10mm; }
html, body { margin: 0; padding: 0; background: #fff; color: #111;
  font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
.invoice-conditions-block,
.invoice-totals-row,
.invoice-signature-block,
.invoice-iban-block {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}
button, .no-print, [data-no-pdf] { display: none !important; }
</style></head><body>${body}</body></html>`;
}

const OUT_DIR = '/tmp/e2e-pdfs';
const QA_DIR = '/mnt/documents/devis-e2e';

function chromiumAvailable(): string | null {
  for (const p of ['/bin/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(p)) return p;
  }
  return null;
}

function genPdf(name: string, html: string): string {
  const fullHTML = wrapHTML(html);
  const htmlPath = path.join(OUT_DIR, `${name}.html`);
  const pdfPath = path.join(OUT_DIR, `${name}.pdf`);
  writeFileSync(htmlPath, fullHTML);

  const chromium = chromiumAvailable()!;
  execSync(
    `${chromium} --headless --no-sandbox --disable-gpu --hide-scrollbars ` +
    `--no-pdf-header-footer --print-to-pdf="${pdfPath}" "file://${htmlPath}"`,
    { stdio: 'pipe' }
  );
  return pdfPath;
}

function pdfPagesText(pdf: string): string[] {
  const totalPages = parseInt(
    execSync(`pdfinfo "${pdf}" | awk '/^Pages:/ {print $2}'`).toString().trim(),
    10
  );
  const pages: string[] = [];
  for (let p = 1; p <= totalPages; p++) {
    pages.push(execSync(`pdftotext -layout -f ${p} -l ${p} "${pdf}" -`).toString());
  }
  return pages;
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('E2E — Conditions Générales sur PDF de devis (Chromium réel)', () => {
  beforeAll(() => {
    if (!chromiumAvailable()) throw new Error('Chromium absent — test e2e ignoré');
    mkdirSync(OUT_DIR, { recursive: true });
    mkdirSync(QA_DIR, { recursive: true });
  });

  for (const sc of SCENARIOS) {
    it(`[${sc.name}] ${sc.expectCgv ? 'affiche les 4 clauses non coupées' : 'NE contient PAS de clauses (FACTURE)'}`, () => {
      const html = renderToStaticMarkup(
        React.createElement(InvoiceDisplay, { data: baseDoc(sc.data), showArabic: false })
      );
      const pdf = genPdf(sc.name, html);

      // Magic bytes
      const head = execSync(`head -c 4 "${pdf}"`).toString();
      expect(head).toBe('%PDF');

      const pages = pdfPagesText(pdf);
      expect(pages.length).toBeGreaterThanOrEqual(1);
      const allText = pages.join('\n');

      if (!sc.expectCgv) {
        expect(allText).not.toMatch(/Conditions Générales/);
        return;
      }

      // 1) every clause present
      for (const clause of CLAUSES) {
        expect(allText, `Clause manquante: ${clause}`).toContain(clause);
      }

      // 2) all clauses on the SAME page (no split)
      const pageOf = (c: string) => pages.findIndex(t => t.includes(c)) + 1;
      const placements = CLAUSES.map(c => ({ clause: c, page: pageOf(c) }));
      const uniquePages = [...new Set(placements.map(p => p.page))];
      expect(
        uniquePages.length,
        `CGV coupées entre pages: ${JSON.stringify(placements)}`
      ).toBe(1);

      // 3) on the LAST page (bottom of document)
      expect(uniquePages[0]).toBe(pages.length);

      // Persist PDF to /mnt/documents for human QA
      execSync(`cp "${pdf}" "${path.join(QA_DIR, `${sc.name}.pdf`)}"`);
    });
  }
});
