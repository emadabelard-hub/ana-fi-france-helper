import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  getSupplierInvoice,
  markSupplierInvoicePaid,
  SupplierInvoice,
  SupplierInvoiceLine,
} from "@/services/supplierInvoices";

const formatEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);

export default function SupplierInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<SupplierInvoice | null>(null);
  const [lines, setLines] = useState<SupplierInvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await getSupplierInvoice(id);
      setInvoice(r.invoice);
      setLines(r.lines);
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? "خطأ في التحميل" : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [id]);

  const markPaid = async () => {
    if (!invoice) return;
    setBusy(true);
    try {
      await markSupplierInvoicePaid(invoice.id);
      toast.success(isRTL ? "تم التحديث" : "Marquée comme payée");
      await reload();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !invoice) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`container mx-auto max-w-3xl px-3 py-4 ${isRTL ? "font-cairo text-right" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      <Button variant="ghost" size="sm" onClick={() => navigate("/accounting/supplier-invoices")} className="mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />
        {isRTL ? "رجوع" : "Retour"}
      </Button>

      <Card className="p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-xs text-primary font-semibold">{invoice.invoice_number}</div>
            <h1 className="text-xl font-bold mt-1">{invoice.supplier?.name || (isRTL ? "بدون مورّد" : "Sans fournisseur")}</h1>
            {invoice.supplier?.siret && (
              <div className="text-xs text-muted-foreground mt-0.5">SIRET {invoice.supplier.siret}</div>
            )}
            {invoice.supplier?.email && (
              <div className="text-xs text-muted-foreground">{invoice.supplier.email}</div>
            )}
          </div>
          <Badge>{invoice.status}</Badge>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">{isRTL ? "التاريخ" : "Date"}</div>
            <div className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString("fr-FR")}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{isRTL ? "المصدر" : "Source"}</div>
            <div className="font-medium capitalize">{invoice.source}</div>
          </div>
          {invoice.supplier_reference && (
            <div className="col-span-2">
              <div className="text-muted-foreground">{isRTL ? "مرجع المورّد" : "Réf. fournisseur"}</div>
              <div className="font-medium">{invoice.supplier_reference}</div>
            </div>
          )}
        </div>

        <Separator className="my-3" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>{isRTL ? "المبلغ بدون ضريبة" : "Montant HT"}</span><span className="font-medium">{formatEUR(Number(invoice.amount_ht))}</span></div>
          <div className="flex justify-between"><span>TVA {Number(invoice.tva_rate)}%</span><span className="font-medium">{formatEUR(Number(invoice.amount_tva))}</span></div>
          <div className="flex justify-between text-base pt-1 border-t"><span className="font-semibold">TTC</span><span className="font-bold">{formatEUR(Number(invoice.amount_ttc))}</span></div>
        </div>
      </Card>

      {lines.length > 0 && (
        <Card className="p-4 mb-4">
          <h3 className="font-semibold mb-2">{isRTL ? "بنود الفاتورة" : "Lignes"}</h3>
          <div className="space-y-2 text-sm">
            {lines.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                <div className="min-w-0">
                  <div>{l.description || "—"}</div>
                  {l.category_code && <div className="text-xs text-muted-foreground font-mono">{l.category_code}</div>}
                </div>
                <div className="font-medium shrink-0">{formatEUR(Number(l.amount_ht))}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Écritures comptables générées (Journal ACH) */}
      {(() => {
        const ht = Number(invoice.amount_ht) || 0;
        const tva = Number(invoice.amount_tva) || 0;
        const ttc = Number(invoice.amount_ttc) || 0;
        const rows = [
          { compte: "601000", libelle: isRTL ? "مشتريات مواد أولية" : "Achats matières premières", debit: ht, credit: 0 },
          ...(tva > 0 ? [{ compte: "445660", libelle: isRTL ? "ضريبة قابلة للخصم" : "TVA déductible", debit: tva, credit: 0 }] : []),
          { compte: "401000", libelle: isRTL ? "المورّدون" : "Fournisseurs", debit: 0, credit: ttc },
        ];
        return (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{isRTL ? "المحاسبة — يومية ACH" : "Comptabilité — Journal ACH"}</h3>
              <Badge variant="outline" className="font-mono text-xs">ACH</Badge>
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {isRTL ? "القيود المُولَّدة تلقائياً وتُدرَج في تصدير FEC" : "Écritures générées automatiquement et incluses dans l'export FEC"}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="ltr">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1.5 pr-2">Compte</th>
                    <th className="text-left py-1.5 pr-2">Libellé</th>
                    <th className="text-right py-1.5 pr-2">Débit</th>
                    <th className="text-right py-1.5">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-2 font-mono">{r.compte}</td>
                      <td className="py-1.5 pr-2">{r.libelle}</td>
                      <td className="py-1.5 pr-2 text-right font-medium">{r.debit > 0 ? formatEUR(r.debit) : "—"}</td>
                      <td className="py-1.5 text-right font-medium">{r.credit > 0 ? formatEUR(r.credit) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={2} className="py-1.5 pr-2 text-right">Total</td>
                    <td className="py-1.5 pr-2 text-right">{formatEUR(ht + tva)}</td>
                    <td className="py-1.5 text-right">{formatEUR(ttc)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}


      <div className="flex gap-2 flex-wrap">
        {invoice.pdf_url && (
          <Button variant="outline" asChild>
            <a href={invoice.pdf_url} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4 mr-1" />
              {isRTL ? "تحميل PDF" : "Télécharger PDF"}
            </a>
          </Button>
        )}
        {invoice.status !== "paid" && (
          <Button onClick={markPaid} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {isRTL ? "تحديد كمدفوعة" : "Marquer comme payée"}
          </Button>
        )}
      </div>
    </div>
  );
}
