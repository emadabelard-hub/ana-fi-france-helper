import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsPDF } from 'npm:jspdf@2.5.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Associe { name: string; percent: number }
interface Body {
  companyName: string;
  companyType: 'SASU' | 'SARL';
  activity: string;
  capital: number;
  address: string;
  managerName: string;
  managerBirthDate: string;
  managerNationality: string;
  managerAddress: string;
  associes?: Associe[];
  product: string;
}

function numberToFrenchWords(n: number): string {
  // Simple fallback
  return n.toLocaleString('fr-FR') + ' (' + n + ')';
}

function extractCity(address: string): string {
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return '';
  const last = parts[parts.length - 1];
  // strip postcode
  return last.replace(/^\d{4,5}\s*/, '').trim() || last;
}

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
    if (!body.companyName || !body.companyType || !body.activity || !body.address || !body.managerName) {
      return new Response(JSON.stringify({ error: 'Champs obligatoires manquants' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSASU = body.companyType === 'SASU';
    const city = extractCity(body.address);
    const today = new Date().toLocaleDateString('fr-FR');
    const capitalStr = `${body.capital.toLocaleString('fr-FR')}€`;
    const capitalLettres = numberToFrenchWords(body.capital);

    // Build PDF
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('times', 'normal');
    const margin = 25;
    const pageWidth = 210;
    const usableWidth = pageWidth - 2 * margin;
    let y = margin;

    const addText = (text: string, opts: { bold?: boolean; size?: number; align?: 'left' | 'center'; spacing?: number } = {}) => {
      doc.setFont('times', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size ?? 11);
      const lines = doc.splitTextToSize(text, usableWidth);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); y = margin; }
        doc.text(line, opts.align === 'center' ? pageWidth / 2 : margin, y, { align: opts.align ?? 'left' });
        y += (opts.size ?? 11) * 0.5;
      }
      y += opts.spacing ?? 3;
    };

    addText(`STATUTS DE ${body.companyType}`, { bold: true, size: 16, align: 'center', spacing: 4 });
    addText(body.companyName.toUpperCase(), { bold: true, size: 14, align: 'center', spacing: 10 });

    addText('Article 1 — Forme', { bold: true, size: 12 });
    addText(`Il est constitué entre les soussignés une société ${body.companyType} régie par les dispositions du Code de commerce.`);

    addText('Article 2 — Objet social', { bold: true, size: 12 });
    addText(`La société a pour objet : ${body.activity}. Et généralement toutes opérations commerciales, industrielles ou financières se rattachant directement ou indirectement à cet objet.`);

    addText('Article 3 — Dénomination sociale', { bold: true, size: 12 });
    addText(`La société prend la dénomination : ${body.companyName}`);

    addText('Article 4 — Siège social', { bold: true, size: 12 });
    addText(`Le siège social est fixé à : ${body.address}`);

    addText('Article 5 — Durée', { bold: true, size: 12 });
    addText(`La durée de la société est fixée à 99 ans à compter de son immatriculation au RCS.`);

    addText('Article 6 — Capital social', { bold: true, size: 12 });
    addText(`Le capital social est fixé à ${capitalStr} (${capitalLettres} euros).`);
    if (isSASU) {
      addText(`Il est divisé en ${body.capital} actions de 1€ chacune, entièrement souscrites et libérées par l'associé unique.`);
    } else {
      const lignes = (body.associes ?? []).map(a => `- ${a.name} : ${a.percent}%`).join('\n');
      addText(`Il est réparti comme suit :\n${lignes || '- ' + body.managerName + ' : 100%'}`);
    }

    addText('Article 7 — Gérance', { bold: true, size: 12 });
    if (isSASU) {
      addText(`La société est dirigée par un Président : M/Mme ${body.managerName}, né(e) le ${body.managerBirthDate}, de nationalité ${body.managerNationality}, demeurant ${body.managerAddress || body.address}.`);
    } else {
      addText(`La société est gérée par M/Mme ${body.managerName}, né(e) le ${body.managerBirthDate}, demeurant ${body.managerAddress || body.address}.`);
    }

    addText('Article 8 — Exercice social', { bold: true, size: 12 });
    addText(`L'exercice social commence le 1er janvier et se termine le 31 décembre de chaque année.`);

    addText('Article 9 — Décisions collectives', { bold: true, size: 12 });
    if (isSASU) {
      addText(`Les décisions relevant de la compétence des associés sont prises par l'associé unique.`);
    } else {
      addText(`Les décisions collectives sont prises en assemblée générale ou par consultation écrite.`);
    }

    addText('Article 10 — Dissolution — Liquidation', { bold: true, size: 12 });
    addText(`En cas de dissolution, la liquidation est effectuée par le gérant ou tout mandataire désigné.`);

    y += 8;
    addText(`Fait à ${city}, le ${today}`, { spacing: 12 });
    addText(`Signature du gérant : _______________________`, { spacing: 4 });
    addText(body.managerName, { bold: true });

    // Footer on each page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.text(
        "Document généré automatiquement par Anafy Pro à partir des informations fournies par l'utilisateur. Veuillez vérifier l'exactitude des informations avant signature et dépôt.",
        pageWidth / 2, 290, { align: 'center', maxWidth: usableWidth }
      );
    }

    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));

    const safeName = body.companyName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    const path = `${userId}/statuts-${safeName}-${dateStr}.pdf`;

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
    console.error('generate-statuts error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
