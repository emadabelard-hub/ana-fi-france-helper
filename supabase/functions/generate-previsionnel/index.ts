import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsPDF } from 'npm:jspdf@2.5.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  type_societe: 'SASU' | 'SARL' | 'Auto-entrepreneur';
  activite: string;
  capital: number;
  chiffre_affaires_estime: number;
  is_btp?: boolean;
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as Body;
    if (!body.type_societe || !body.activite || !body.chiffre_affaires_estime) {
      return new Response(JSON.stringify({ error: 'Champs obligatoires manquants' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ca = Number(body.chiffre_affaires_estime) || 0;
    const isAE = body.type_societe === 'Auto-entrepreneur';
    const isSociete = body.type_societe === 'SASU' || body.type_societe === 'SARL';

    const urssaf = isAE ? ca * 0.22 : ca * 0.45;
    const cfe = 500;
    const decennale = body.is_btp ? 1500 : 0;
    const rcpro = 400;
    const comptable = 1200;
    const banque = 300;
    const materiel = ca * 0.15;
    const totalCharges = urssaf + cfe + decennale + rcpro + comptable + banque + materiel;

    const resultatAvantImpot = ca - totalCharges;
    let is = 0;
    if (isSociete && resultatAvantImpot > 0) {
      if (resultatAvantImpot <= 42500) is = resultatAvantImpot * 0.15;
      else is = 42500 * 0.15 + (resultatAvantImpot - 42500) * 0.25;
    }
    const resultatNet = resultatAvantImpot - is;
    const mensuel = resultatNet / 12;

    // PDF
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    const margin = 20;
    const pageWidth = 210;
    const usable = pageWidth - 2 * margin;
    let y = margin;

    const today = new Date().toLocaleDateString('fr-FR');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('PRÉVISIONNEL FINANCIER — ANNÉE 1', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${body.activite} — ${body.type_societe}`, pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10);
    doc.text(`Date de génération : ${today}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    const drawRow = (label: string, value: string, bold = false) => {
      if (y > 270) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.rect(margin, y - 4, usable, 7);
      doc.text(label, margin + 2, y);
      doc.text(value, margin + usable - 2, y, { align: 'right' });
      y += 7;
    };

    const sectionTitle = (t: string) => {
      y += 4;
      if (y > 265) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(t, margin, y);
      y += 6;
    };

    sectionTitle('1. CHARGES ANNUELLES ESTIMÉES');
    drawRow(`Cotisations URSSAF (${isAE ? '22%' : '45%'} du CA)`, eur(urssaf));
    drawRow('CFE (Cotisation Foncière des Entreprises)', eur(cfe));
    if (body.is_btp) drawRow('Assurance décennale (BTP)', eur(decennale));
    drawRow('RC Pro', eur(rcpro));
    drawRow('Comptable', eur(comptable));
    drawRow('Frais bancaires', eur(banque));
    drawRow('Matériel et fournitures (15% du CA)', eur(materiel));
    drawRow('TOTAL CHARGES', eur(totalCharges), true);

    sectionTitle('2. RÉSULTAT PRÉVISIONNEL');
    drawRow("Chiffre d'affaires estimé", eur(ca));
    drawRow('Total charges', eur(totalCharges));
    drawRow('Résultat avant impôt', eur(resultatAvantImpot));
    if (isSociete) drawRow('Impôt sur les Sociétés (15% / 25%)', eur(is));
    drawRow('Résultat net estimé', eur(resultatNet), true);
    drawRow('Équivalent mensuel net', eur(mensuel), true);

    sectionTitle('3. SEUILS IMPORTANTS À CONNAÎTRE');
    const seuils: [string, string, string][] = [
      ['Franchise TVA', '37 500 €', 'En dessous : pas de TVA à facturer'],
      ['Plafond Auto-entrepreneur BTP', '77 700 €', 'Au-delà : changer de statut obligatoire'],
      ['Taux IS réduit', '42 500 €', 'En dessous : IS à 15% seulement'],
      ['ACRE', 'Année 1', 'Réduction 50% cotisations si éligible'],
    ];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const colW = [55, 35, usable - 90];
    if (y > 260) { doc.addPage(); y = margin; }
    doc.rect(margin, y - 4, colW[0], 7);
    doc.rect(margin + colW[0], y - 4, colW[1], 7);
    doc.rect(margin + colW[0] + colW[1], y - 4, colW[2], 7);
    doc.text('Seuil', margin + 2, y);
    doc.text('Montant', margin + colW[0] + 2, y);
    doc.text('Signification', margin + colW[0] + colW[1] + 2, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    for (const [s, m, sig] of seuils) {
      if (y > 270) { doc.addPage(); y = margin; }
      const sigLines = doc.splitTextToSize(sig, colW[2] - 4);
      const h = Math.max(7, sigLines.length * 5 + 2);
      doc.rect(margin, y - 4, colW[0], h);
      doc.rect(margin + colW[0], y - 4, colW[1], h);
      doc.rect(margin + colW[0] + colW[1], y - 4, colW[2], h);
      doc.text(s, margin + 2, y);
      doc.text(m, margin + colW[0] + 2, y);
      doc.text(sigLines, margin + colW[0] + colW[1] + 2, y);
      y += h;
    }

    y += 8;
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFillColor(255, 248, 220);
    doc.rect(margin, y - 4, usable, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Conseil Anafy Pro', margin + 3, y + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const conseil = "Ces chiffres sont des estimations. Consultez un expert-comptable pour valider votre prévisionnel avant dépôt au greffe.";
    doc.text(doc.splitTextToSize(conseil, usable - 6), margin + 3, y + 6);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Document généré par Anafy Pro — à titre indicatif', pageWidth / 2, 290, { align: 'center' });
    }

    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
    const dateStr = new Date().toISOString().slice(0, 10);
    const path = `${userId}/previsionnel-${dateStr}.pdf`;
    const admin = createClient(supabaseUrl, serviceKey);
    const { error: upErr } = await admin.storage.from('documents-creation').upload(path, pdfBytes, {
      contentType: 'application/pdf', upsert: true,
    });
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: signed, error: signErr } = await admin.storage
      .from('documents-creation').createSignedUrl(path, 3600);
    if (signErr) {
      return new Response(JSON.stringify({ error: signErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, path, url: signed.signedUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue';
    console.error('generate-previsionnel error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
