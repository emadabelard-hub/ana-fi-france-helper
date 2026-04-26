import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getPeriodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "quarter":
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();
    case "year":
      return new Date(now.getFullYear(), 0, 1).toISOString();
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
}

function cleanCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/"/g, '').replace(/\\/g, '').trim();
}

function formatDateDDMMYYYY(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function computeHT(ttc: number, tvaRate: number): number {
  if (!tvaRate || tvaRate <= 0) return ttc;
  return ttc / (1 + tvaRate / 100);
}

function generateCSV(docs: any[], expenses: any[]): string {
  const BOM = "\uFEFF";
  const sep = ",";

  // Section 1: FACTURES
  const invHeaders = ["Numero","Date","Client","Type","Compte","Libelle","Montant_HT","TVA_Taux","TVA_Montant","Montant_TTC","Statut"];
  const invRows: string[] = [];
  for (const d of docs) {
    const ht = d.subtotal_ht > 0 ? d.subtotal_ht : computeHT(d.total_ttc, d.tva_rate || 0);
    const tvaRate = d.tva_rate || 0;
    const tva = d.tva_amount > 0 ? d.tva_amount : (d.total_ttc - ht);
    invRows.push([
      cleanCell(d.document_number), formatDateDDMMYYYY(d.created_at), cleanCell(d.client_name),
      "Vente", "706", "Prestation travaux",
      ht.toFixed(2), tvaRate.toFixed(2), tva.toFixed(2), (d.total_ttc || 0).toFixed(2), "Validee",
    ].join(sep));
  }

  // Section 2: DEPENSES
  const expHeaders = ["Date","Fournisseur","Type","Compte","Libelle","Montant_HT","TVA_Taux","TVA_Montant","Montant_TTC"];
  const expRows: string[] = [];
  for (const e of expenses) {
    const tvaAmt = e.tva_amount || 0;
    const amt = e.amount || 0;
    const htExp = amt;
    const ttcExp = amt + tvaAmt;
    const tvaRate = htExp > 0 && tvaAmt > 0 ? ((tvaAmt / htExp) * 100) : 0;
    const isTransport = (e.title || "").toLowerCase().includes("transport");
    expRows.push([
      formatDateDDMMYYYY(e.expense_date || e.created_at), cleanCell(e.title || "Fournisseur"),
      isTransport ? "Transport" : "Achat", isTransport ? "625" : "601",
      cleanCell(e.title || "Achat materiel"),
      htExp.toFixed(2), tvaRate.toFixed(2), tvaAmt.toFixed(2), ttcExp.toFixed(2),
    ].join(sep));
  }

  // Section 3: SYNTHESE
  const totalHTVentes = docs.reduce((s: number, d: any) => s + (d.subtotal_ht > 0 ? d.subtotal_ht : computeHT(d.total_ttc, d.tva_rate || 0)), 0);
  const totalTVACollectee = docs.reduce((s: number, d: any) => s + (d.tva_amount > 0 ? d.tva_amount : (d.total_ttc - computeHT(d.total_ttc, d.tva_rate || 0))), 0);
  const totalTTCVentes = docs.reduce((s: number, d: any) => s + (d.total_ttc || 0), 0);
  const totalHTDepenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const totalTVADeductible = expenses.reduce((s: number, e: any) => s + (e.tva_amount || 0), 0);
  const totalTTCDepenses = totalHTDepenses + totalTVADeductible;
  const tvaAPayer = totalTVACollectee - totalTVADeductible;

  const synthHeaders = ["Indicateur","Montant"];
  const synthRows = [
    `Total_HT_Ventes,${totalHTVentes.toFixed(2)}`,
    `Total_TVA_Collectee,${totalTVACollectee.toFixed(2)}`,
    `Total_TTC_Ventes,${totalTTCVentes.toFixed(2)}`,
    `Total_HT_Depenses,${totalHTDepenses.toFixed(2)}`,
    `Total_TVA_Deductible,${totalTVADeductible.toFixed(2)}`,
    `Total_TTC_Depenses,${totalTTCDepenses.toFixed(2)}`,
    `TVA_A_Payer,${tvaAPayer.toFixed(2)}`,
  ];

  return BOM + [
    invHeaders.join(sep), ...invRows, "",
    expHeaders.join(sep), ...expRows, "",
    synthHeaders.join(sep), ...synthRows,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth
    const authHeader = req.headers.get("Authorization");
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { period, accountantEmail } = await req.json();
    if (!accountantEmail) throw new Error("Missing accountant email");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const periodStart = getPeriodStart(period);

    // Fetch documents for the period (factures only for accountant)
    const { data: docs } = await supabaseAdmin
      .from("documents_comptables")
      .select("*")
      .eq("user_id", user.id)
      .eq("document_type", "facture")
      .gte("created_at", periodStart)
      .order("created_at", { ascending: true });

    // Fetch expenses for the period
    const { data: expenses } = await supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", periodStart)
      .order("created_at", { ascending: true });

    const allDocs = docs || [];
    const allExpenses = expenses || [];

    if (allDocs.length === 0 && allExpenses.length === 0) {
      return new Response(JSON.stringify({ error: "No documents found for this period" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company name from profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_name, full_name")
      .eq("user_id", user.id)
      .single();

    const companyName = profile?.company_name || profile?.full_name || "Artisan";

    // Generate CSV
    const csvContent = generateCSV(allDocs, allExpenses);
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));

    const periodLabels: Record<string, string> = {
      month: "du mois en cours",
      quarter: "du trimestre en cours",
      year: "de l'année en cours",
    };

    // Send email via Resend
    const emailBody = {
      from: "Ana Fi France <noreply@resend.dev>",
      to: [accountantEmail],
      subject: `📩 Documents comptables - ${companyName} (${periodLabels[period] || period})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a2e;">Documents comptables - ${companyName}</h2>
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint le récapitulatif comptable ${periodLabels[period] || ""} de <strong>${companyName}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f0f0f0;">
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Factures</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${allDocs.length}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Notes de frais</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${allExpenses.length}</td>
            </tr>
            <tr style="background: #f0f0f0;">
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total factures TTC</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${allDocs.reduce((s: number, d: any) => s + (d.total_ttc || 0), 0).toFixed(2)} €</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total dépenses</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${allExpenses.reduce((s: number, e: any) => s + (e.amount || 0) + (e.tva_amount || 0), 0).toFixed(2)} €</td>
            </tr>
          </table>
          <p>Le fichier CSV détaillé est joint à cet email.</p>
          <p style="color: #888; font-size: 12px;">Envoyé automatiquement via Ana Fi France</p>
        </div>
      `,
      attachments: [
        {
          filename: `comptabilite_${companyName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`,
          content: csvBase64,
          type: "text/csv",
        },
      ],
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailBody),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      throw new Error(`Resend error [${resendRes.status}]: ${errBody}`);
    }

    // Mark documents as sent to accountant
    const now = new Date().toISOString();
    const docIds = allDocs.map((d: any) => d.id);
    const expIds = allExpenses.map((e: any) => e.id);

    if (docIds.length > 0) {
      await supabaseAdmin
        .from("documents_comptables")
        .update({ sent_to_accountant_at: now })
        .eq("user_id", user.id)
        .in("id", docIds);
    }
    if (expIds.length > 0) {
      await supabaseAdmin
        .from("expenses")
        .update({ sent_to_accountant_at: now })
        .eq("user_id", user.id)
        .in("id", expIds);
    }

    return new Response(JSON.stringify({
      success: true,
      docsSent: docIds.length,
      expensesSent: expIds.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("send-to-accountant error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
