import { supabase } from "@/integrations/supabase/client";

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  siret?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
  bic?: string | null;
  created_at: string;
}

export interface SupplierInvoice {
  id: string;
  user_id: string;
  supplier_id: string | null;
  invoice_number: string;
  supplier_reference: string | null;
  invoice_date: string;
  amount_ht: number;
  tva_rate: number;
  amount_tva: number;
  amount_ttc: number;
  status: string;
  source: string;
  pdf_url: string | null;
  factur_x_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier | null;
}

export interface SupplierInvoiceLine {
  id: string;
  supplier_invoice_id: string;
  description: string | null;
  amount_ht: number;
  category_code: string | null;
  created_at: string;
}

const T_INV = "supplier_invoices" as any;
const T_SUP = "suppliers" as any;
const T_LINE = "supplier_invoice_lines" as any;

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from(T_SUP).select("*").order("name");
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function createSupplier(payload: Partial<Supplier> & { name: string }): Promise<Supplier> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from(T_SUP)
    .insert({ ...payload, user_id: user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as Supplier;
}

export async function listSupplierInvoices(): Promise<SupplierInvoice[]> {
  const { data, error } = await supabase
    .from(T_INV)
    .select("*, supplier:suppliers(*)")
    .order("invoice_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierInvoice[];
}

export async function getSupplierInvoice(id: string): Promise<{ invoice: SupplierInvoice; lines: SupplierInvoiceLine[] }> {
  const { data: invoice, error } = await supabase
    .from(T_INV)
    .select("*, supplier:suppliers(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: lines, error: e2 } = await supabase
    .from(T_LINE)
    .select("*")
    .eq("supplier_invoice_id", id)
    .order("created_at");
  if (e2) throw e2;
  return { invoice: invoice as SupplierInvoice, lines: (lines ?? []) as SupplierInvoiceLine[] };
}

export async function markSupplierInvoicePaid(id: string) {
  const { error } = await supabase.from(T_INV).update({ status: "paid" }).eq("id", id);
  if (error) throw error;
}

export async function ocrSupplierInvoice(fileBase64: string, mimeType: string) {
  const { data, error } = await supabase.functions.invoke("ocr-supplier-invoice", {
    body: { fileBase64, mimeType },
  });
  if (error) throw error;
  return data as {
    supplier_name?: string | null;
    supplier_reference?: string | null;
    invoice_date?: string | null;
    amount_ht?: number | null;
    tva_rate?: number | null;
    amount_tva?: number | null;
    amount_ttc?: number | null;
    description?: string | null;
    category_code?: string | null;
  };
}

export async function createSupplierInvoice(payload: {
  supplier_id?: string | null;
  supplier_name?: string | null;
  supplier_reference?: string | null;
  invoice_date: string;
  amount_ht: number;
  tva_rate: number;
  description?: string | null;
  category_code?: string | null;
  notes?: string | null;
  pdf_url?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke("create-supplier-invoice", { body: payload });
  if (error) throw error;
  return data as { success: boolean; invoice: SupplierInvoice };
}

export const CATEGORY_CODES: { code: string; label: string }[] = [
  { code: "601000", label: "601000 — Achats fournitures / matières" },
  { code: "602000", label: "602000 — Autres approvisionnements" },
  { code: "606100", label: "606100 — Électricité / énergie" },
  { code: "606300", label: "606300 — Petit équipement" },
  { code: "611000", label: "611000 — Sous-traitance" },
  { code: "613000", label: "613000 — Locations" },
  { code: "615000", label: "615000 — Entretien / réparations" },
  { code: "616000", label: "616000 — Assurances" },
  { code: "618000", label: "618000 — Documentation" },
  { code: "622600", label: "622600 — Honoraires" },
  { code: "624100", label: "624100 — Transports" },
  { code: "625100", label: "625100 — Déplacements" },
  { code: "626000", label: "626000 — Télécom / internet" },
];
