import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Filter, FileText, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { listSupplierInvoices, SupplierInvoice } from "@/services/supplierInvoices";
import SupplierInvoiceImportModal from "@/components/accounting/SupplierInvoiceImportModal";

const formatEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);

const statusStyle = (s: string) => {
  switch (s) {
    case "received": return "bg-blue-100 text-blue-800 border-blue-200";
    case "processed": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "paid": return "bg-gray-100 text-gray-700 border-gray-200";
    default: return "bg-muted text-foreground";
  }
};

const statusLabel = (s: string, isRTL: boolean) => {
  const map: Record<string, [string, string]> = {
    received: ["Reçue", "مستلمة"],
    processed: ["Traitée", "معالجة"],
    paid: ["Payée", "مدفوعة"],
  };
  const v = map[s] ?? [s, s];
  return isRTL ? v[1] : v[0];
};

export default function SupplierInvoicesPage() {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "pdp">("all");

  const reload = async () => {
    setLoading(true);
    try {
      setItems(await listSupplierInvoices());
    } catch (e: any) {
      console.error(e);
      toast.error(isRTL ? "خطأ في تحميل الفواتير" : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const visibleItems = sourceFilter === "all"
    ? items
    : items.filter((i) => (i.source || "manual") === sourceFilter);

  const totalTTC = items.reduce((s, i) => s + Number(i.amount_ttc || 0), 0);

  return (
    <div className={`container mx-auto max-w-5xl px-3 py-4 ${isRTL ? "font-cairo text-right" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      <header className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          {isRTL ? "فواتير المورّدين" : "Factures Fournisseurs"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {items.length} {isRTL ? "فاتورة" : "facture(s)"} · {formatEUR(totalTTC)} TTC
        </p>
      </header>

      <Button
        onClick={() => setImportOpen(true)}
        className="w-full mb-4 h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <Plus className="h-5 w-5 mr-2" />
        {isRTL ? "استيراد فاتورة" : "Importer une facture"}
      </Button>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>{isRTL ? "لا توجد فواتير بعد" : "Aucune facture fournisseur pour l'instant"}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((inv) => (
            <button
              key={inv.id}
              onClick={() => navigate(`/accounting/supplier-invoices/${inv.id}`)}
              className="w-full text-left"
            >
              <Card className="p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-primary">{inv.invoice_number}</span>
                      <Badge variant="outline" className={statusStyle(inv.status)}>{statusLabel(inv.status, isRTL)}</Badge>
                    </div>
                    <div className="font-medium truncate">{inv.supplier?.name || (isRTL ? "بدون مورّد" : "Sans fournisseur")}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(inv.invoice_date).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold">{formatEUR(Number(inv.amount_ttc))}</div>
                    <div className="text-[11px] text-muted-foreground">HT {formatEUR(Number(inv.amount_ht))}</div>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      <SupplierInvoiceImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onCreated={reload}
      />
    </div>
  );
}
