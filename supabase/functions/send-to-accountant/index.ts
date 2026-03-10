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

function generateCSV(docs: any[], expenses: any[]): string {
  const BOM = "\uFEFF";
  const headers = ["Date", "Type", "Numéro", "Client", "Montant HT (€)", "TVA (€)", "Total TTC (€)", "Statut"];
  const rows: string[] = [];

  for (const d of docs) {
    const date = new Date(d.created_at).toLocaleDateString("fr-FR");
    const type = d.document_type === "devis" ? "Devis" : "Facture";
    rows.push([
      date, type, d.document_number,
      `"${(d.client_name || "").replace(/"/g, '""')}"`,
      d.subtotal_ht?.toFixed(2) || "0.00",
      d.tva_amount?.toFixed(2) || "0.00",
      d.total_ttc?.toFixed(2) || "0.00",
      d.status === "finalized" ? "Finalisé" : "Brouillon",
    ].join(";"));
  }

  for (const e of expenses) {
    const date = new Date(e.expense_date || e.created_at).toLocaleDateString("fr-FR");
    rows.push([
      date, "Dépense", `EXP-${e.id.slice(0, 6).toUpperCase()}`,
      `"${(e.title || "").replace(/"/g, '""')}"`,
      e.amount?.toFixed(2) || "0.00",
      e.tva_amount?.toFixed(2) || "0.00",
      (e.amount + (e.tva_amount || 0)).toFixed(2),
      "Payé",
    ].join(";"));
  }

  return BOM + [headers.join(";"), ...rows].join("\n");
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
        .in("id", docIds);
    }
    if (expIds.length > 0) {
      await supabaseAdmin
        .from("expenses")
        .update({ sent_to_accountant_at: now })
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
