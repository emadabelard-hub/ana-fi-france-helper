/**
 * E2E test for the `generate-pdf` Edge Function.
 *
 * Goal: prove that, for several DEVIS configurations, calling the production
 * PDF pipeline (auth → Browserless headless Chrome → PDF/A-3) produces a PDF
 * whose 4 mandatory "Conditions Générales" clauses are all present and never
 * split across pages.
 *
 * Run via: supabase--test_edge_functions { "functions": ["generate-pdf"] }
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Client as PgClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
// pdfjs-dist legacy build runs in Deno without DOM
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

assert(SUPABASE_URL, "SUPABASE_URL missing");
assert(ANON_KEY, "ANON_KEY missing");
assert(DB_URL, "SUPABASE_DB_URL missing");

const CLAUSES = [
  "Réserve de propriété",
  "Suspension de chantier",
  "Garantie décennale",
  "Litiges",
];

// ── HTML builder mirroring InvoiceDisplay's CGV block contract ──────────────
function buildLines(n: number) {
  let rows = "";
  for (let i = 1; i <= n; i++) {
    rows += `<tr>
      <td style="border:1px solid #ccc;padding:4px;font-size:8pt">${i}</td>
      <td style="border:1px solid #ccc;padding:4px;font-size:8pt">Prestation BTP ${i}</td>
      <td style="border:1px solid #ccc;padding:4px;font-size:8pt;text-align:center">${10 + i}</td>
      <td style="border:1px solid #ccc;padding:4px;font-size:8pt;text-align:center">m²</td>
      <td style="border:1px solid #ccc;padding:4px;font-size:8pt;text-align:right">28,00 €</td>
      <td style="border:1px solid #ccc;padding:4px;font-size:8pt;text-align:right">${((10 + i) * 28).toFixed(2)} €</td>
    </tr>`;
  }
  return rows;
}

function buildDevisHTML(opts: {
  number: string;
  label: string;
  lines: number;
  tvaLabel?: string;
  withMilestones?: boolean;
}) {
  const { number, label, lines, tvaLabel = "TVA (10%)", withMilestones } = opts;
  const milestones = withMilestones
    ? `<div style="margin-top:6px;font-size:8pt">Échéancier: 30% à la commande, 40% à mi-chantier, 30% à la réception.</div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 10mm; }
body { font-family: Arial, sans-serif; color:#111; margin:0 }
.french-invoice { padding:4px }
table { width:100%; border-collapse:collapse }
thead { display: table-header-group }
tr { page-break-inside: avoid }
.invoice-conditions-block { page-break-inside: avoid !important; break-inside: avoid !important }
</style></head><body><div class="french-invoice">
<h1 style="font-size:14pt;margin:0 0 6px">DEVIS N° ${number} — ${label}</h1>
<p style="font-size:9pt">Émetteur: Artisan Test SARL — SIRET 12345678901234<br>
Client: Client SARL — Date: 14/05/2026 — Validité: 30 jours</p>
<table><thead><tr>
<th style="border:1px solid #ccc;padding:4px;background:#f3f4f6;font-size:8pt">#</th>
<th style="border:1px solid #ccc;padding:4px;background:#f3f4f6;font-size:8pt">Désignation</th>
<th style="border:1px solid #ccc;padding:4px;background:#f3f4f6;font-size:8pt">Qté</th>
<th style="border:1px solid #ccc;padding:4px;background:#f3f4f6;font-size:8pt">Unité</th>
<th style="border:1px solid #ccc;padding:4px;background:#f3f4f6;font-size:8pt">P.U HT</th>
<th style="border:1px solid #ccc;padding:4px;background:#f3f4f6;font-size:8pt">Total HT</th>
</tr></thead><tbody>${buildLines(lines)}</tbody></table>
${milestones}
<div style="margin-top:8px;text-align:right;font-size:9pt">
Total HT: 12.345,00 €<br>${tvaLabel}: 1.234,50 €<br><b>Total TTC: 13.579,50 €</b>
</div>
<div style="margin-top:10px;padding-top:6px;border-top:1px solid #e5e7eb;font-size:6pt;color:#9ca3af;text-align:center">
Assurance Décennale — Zone: France Métropolitaine. Validité du devis: 30 jours.
</div>
<div class="invoice-conditions-block" style="margin-top:8px;padding-top:6px;border-top:1px solid #d1d5db;page-break-inside:avoid;break-inside:avoid">
<p style="font-size:7pt;font-weight:bold;color:#6b7280;margin:0 0 4px;text-transform:uppercase">Conditions Générales</p>
<div style="font-size:6.5pt;color:#9ca3af;line-height:1.3">
<p style="margin:0 0 2px"><b style="color:#6b7280">4. Réserve de propriété</b> — Les matériaux et fournitures livrés restent la propriété de l'entreprise jusqu'au paiement intégral de la facture.</p>
<p style="margin:0 0 2px"><b style="color:#6b7280">5. Suspension de chantier</b> — En cas de non-paiement à l'échéance, l'entreprise se réserve le droit de suspendre les travaux sans mise en demeure préalable.</p>
<p style="margin:0 0 2px"><b style="color:#6b7280">6. Garantie décennale</b> — Les travaux sont couverts par notre assurance décennale conformément aux articles 1792 et suivants du Code civil.</p>
<p style="margin:0"><b style="color:#6b7280">7. Litiges</b> — En cas de litige, le Tribunal compétent sera celui du lieu d'exécution des travaux.</p>
</div></div></div></body></html>`;
}

// ── Auth: signup via REST + force-confirm via direct DB connection ──────────
async function getAccessToken(): Promise<{ token: string; userId: string }> {
  const email = `e2e-pdf-${Date.now()}@example.com`;
  const password = "E2eTestPdf!23";
  const userClient = createClient(SUPABASE_URL, ANON_KEY);

  const { error: signupErr } = await userClient.auth.signUp({ email, password });
  if (signupErr) throw signupErr;

  // Force email confirmation directly in the DB (test environment only).
  const pg = new PgClient(DB_URL);
  await pg.connect();
  try {
    await pg.queryArray(
      "UPDATE auth.users SET email_confirmed_at = now(), confirmed_at = now() WHERE email = $1",
      [email],
    );
  } finally {
    await pg.end();
  }

  const { data: signed, error: signErr } =
    await userClient.auth.signInWithPassword({ email, password });
  if (signErr || !signed.session) throw signErr ?? new Error("no session");

  return { token: signed.session.access_token, userId: signed.user!.id };
}

// ── PDF text extraction with pdfjs-dist ──────────────────────────────────────
async function extractTextPerPage(pdfBytes: Uint8Array): Promise<string[]> {
  // pdfjs needs a copy because it transfers the buffer
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: any) => it.str ?? "").join(" "));
  }
  return pages;
}

// ── Test scenarios (varied DEVIS configurations) ─────────────────────────────
const SCENARIOS = [
  { name: "court_tva10",     opts: { number: "D-2026-0101", label: "court TVA 10%",         lines: 5,  tvaLabel: "TVA (10%)" } },
  { name: "moyen_tva20",     opts: { number: "D-2026-0102", label: "moyen TVA 20%",         lines: 25, tvaLabel: "TVA (20%)" } },
  { name: "long_jalons",     opts: { number: "D-2026-0103", label: "long avec jalons",      lines: 55, tvaLabel: "TVA (10%)", withMilestones: true } },
  { name: "edge_pagebreak",  opts: { number: "D-2026-0104", label: "edge near page break",  lines: 38, tvaLabel: "TVA (10%)" } },
];

let cachedToken: string | null = null;
async function token() {
  if (!cachedToken) cachedToken = (await getAccessToken()).token;
  return cachedToken;
}

for (const sc of SCENARIOS) {
  Deno.test({
    name: `generate-pdf E2E — DEVIS [${sc.name}] : 4 clauses présentes et non coupées`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
      const accessToken = await token();
      const html = buildDevisHTML(sc.opts);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          html,
          marginMm: 10,
          footerLabel: `Devis E2E ${sc.opts.number}`,
        }),
      });

      assertEquals(res.status, 200, `HTTP ${res.status}: ${await res.clone().text().catch(() => "")}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      assert(buf.byteLength > 1000, "PDF suspiciously small");
      assertEquals(
        new TextDecoder().decode(buf.slice(0, 4)),
        "%PDF",
        "Response is not a PDF",
      );

      const pages = await extractTextPerPage(buf);
      assert(pages.length >= 1, "PDF has no pages");

      // 1) The 4 clauses must each appear at least once
      const fullText = pages.join("\n");
      for (const clause of CLAUSES) {
        assert(
          fullText.includes(clause),
          `Clause manquante du PDF [${sc.name}]: "${clause}"`,
        );
      }

      // 2) The 4 clauses must all be on the SAME page (no split)
      const pageOf = (clause: string) =>
        pages.findIndex((t) => t.includes(clause)) + 1;
      const pagesFound = CLAUSES.map(pageOf);
      const uniquePages = [...new Set(pagesFound)];
      assertEquals(
        uniquePages.length,
        1,
        `CGV coupées entre pages [${sc.name}]: ${JSON.stringify(
          CLAUSES.map((c, i) => ({ c, page: pagesFound[i] })),
        )}`,
      );

      // 3) The block must sit at the END of the document (last page)
      assertEquals(
        uniquePages[0],
        pages.length,
        `CGV pas en bas du document [${sc.name}]: page ${uniquePages[0]}/${pages.length}`,
      );
    },
  });
}
