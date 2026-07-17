import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, Download, Eye, HardHat, X, Receipt } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  const { isRTL, t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<SupplierInvoice | null>(null);
  const [lines, setLines] = useState<SupplierInvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [chantiers, setChantiers] = useState<Array<{ id: string; name: string; reference_number: string | null }>>([]);
  const [savingChantier, setSavingChantier] = useState(false);
  const [linkableExpenses, setLinkableExpenses] = useState<Array<{ id: string; title: string; amount: number; expense_date: string }>>([]);
  const [linkedExpense, setLinkedExpense] = useState<{ id: string; title: string } | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('chantiers').select('id, name, reference_number').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setChantiers((data as any) || []));
  }, [user]);

  useEffect(() => {
    if (!user || !invoice) return;
    (async () => {
      const [{ data: free }, { data: current }] = await Promise.all([
        (supabase.from('expenses') as any)
          .select('id, title, amount, expense_date')
          .eq('user_id', user.id)
          .is('supplier_invoice_id', null)
          .order('expense_date', { ascending: false })
          .limit(100),
        (supabase.from('expenses') as any)
          .select('id, title')
          .eq('user_id', user.id)
          .eq('supplier_invoice_id', invoice.id)
          .maybeSingle(),
      ]);
      setLinkableExpenses((free as any) || []);
      setLinkedExpense((current as any) || null);
    })();
  }, [user, invoice]);

  const updateLinkedExpense = async (newExpenseId: string | null) => {
    if (!invoice || !user) return;
    setSavingExpense(true);
    try {
      if (linkedExpense) {
        await (supabase.from('expenses') as any)
          .update({ supplier_invoice_id: null })
          .eq('id', linkedExpense.id)
          .eq('user_id', user.id);
      }
      if (newExpenseId) {
        const { error } = await (supabase.from('expenses') as any)
          .update({ supplier_invoice_id: invoice.id })
          .eq('id', newExpenseId)
          .eq('user_id', user.id);
        if (error) throw error;
        const chosen = linkableExpenses.find((e) => e.id === newExpenseId);
        setLinkedExpense(chosen ? { id: chosen.id, title: chosen.title } : null);
        toast.success(t('supplierInvoiceDetail.expense.toastAttached'));
      } else {
        setLinkedExpense(null);
        toast.success(t('supplierInvoiceDetail.expense.toastDetached'));
      }
      const { data: free } = await (supabase.from('expenses') as any)
        .select('id, title, amount, expense_date')
        .eq('user_id', user.id)
        .is('supplier_invoice_id', null)
        .order('expense_date', { ascending: false })
        .limit(100);
      setLinkableExpenses((free as any) || []);
    } catch (e: any) {
      console.error('[supplier-invoice] link expense failed:', e);
      toast.error(t('supplierInvoiceDetail.genericError'));
    } finally {
      setSavingExpense(false);
    }
  };


  const updateChantier = async (newId: string | null) => {
    if (!invoice || !user) return;
    setSavingChantier(true);
    const { error } = await supabase
      .from('supplier_invoices' as any)
      .update({ chantier_id: newId } as any)
      .eq('id', invoice.id)
      .eq('user_id', user.id);
    setSavingChantier(false);
    if (error) {
      console.error('[supplier-invoice] update chantier failed:', error);
      toast.error(t('supplierInvoiceDetail.genericError'));
      return;
    }
    setInvoice({ ...invoice, chantier_id: newId });
    toast.success(newId
      ? t('supplierInvoiceDetail.chantier.toastAttached')
      : t('supplierInvoiceDetail.chantier.toastDetached'));
  };

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await getSupplierInvoice(id);
      setInvoice(r.invoice);
      setLines(r.lines);
    } catch (e) {
      console.error(e);
      toast.error(t('supplierInvoices.toast.loadError'));
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
      toast.success(t('supplierInvoiceDetail.markPaidToast'));
      await reload();
    } catch (e: any) {
      console.error('[supplier-invoice] markPaid failed:', e);
      toast.error(t('supplierInvoiceDetail.genericError'));
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
        {t('supplierInvoiceDetail.back')}
      </Button>

      <Card className="p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-xs text-primary font-semibold" dir="ltr">{invoice.invoice_number}</div>
            <h1 className="text-xl font-bold mt-1">{invoice.supplier?.name || t('supplierInvoiceDetail.noSupplier')}</h1>
            {invoice.supplier?.siret && (
              <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{t('supplierInvoiceDetail.siret')} {invoice.supplier.siret}</div>
            )}
            {invoice.supplier?.email && (
              <div className="text-xs text-muted-foreground" dir="ltr">{invoice.supplier.email}</div>
            )}
          </div>
          <Badge>{invoice.status}</Badge>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">{t('supplierInvoiceDetail.date')}</div>
            <div className="font-medium" dir="ltr">{new Date(invoice.invoice_date).toLocaleDateString("fr-FR")}</div>
          </div>
          <div>
            <div className="text-muted-foreground">{t('supplierInvoiceDetail.source')}</div>
            <div className="font-medium capitalize">{invoice.source}</div>
          </div>
          {invoice.supplier_reference && (
            <div className="col-span-2">
              <div className="text-muted-foreground">{t('supplierInvoiceDetail.supplierReference')}</div>
              <div className="font-medium" dir="ltr">{invoice.supplier_reference}</div>
            </div>
          )}
        </div>

        <Separator className="my-3" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>{t('supplierInvoiceDetail.amountHT')}</span><span className="font-medium" dir="ltr">{formatEUR(Number(invoice.amount_ht))}</span></div>
          <div className="flex justify-between"><span dir="ltr">{t('supplierInvoiceDetail.tva')} {Number(invoice.tva_rate)}%</span><span className="font-medium" dir="ltr">{formatEUR(Number(invoice.amount_tva))}</span></div>
          <div className="flex justify-between text-base pt-1 border-t"><span className="font-semibold">{t('supplierInvoiceDetail.ttc')}</span><span className="font-bold" dir="ltr">{formatEUR(Number(invoice.amount_ttc))}</span></div>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <HardHat className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-sm">{t('supplierInvoiceDetail.chantier.title')}</h3>
        </div>
        <div className="flex gap-2 items-center">
          <Select
            value={invoice.chantier_id || 'none'}
            onValueChange={(v) => updateChantier(v === 'none' ? null : v)}
            disabled={savingChantier}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('supplierInvoiceDetail.chantier.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('supplierInvoiceDetail.chantier.none')}</SelectItem>
              {chantiers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.reference_number ? ` · ${c.reference_number}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {invoice.chantier_id && (
            <Button variant="ghost" size="icon" onClick={() => updateChantier(null)} disabled={savingChantier} title={t('supplierInvoiceDetail.chantier.remove')}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">{t('supplierInvoiceDetail.chantier.note')}</p>
      </Card>

      {/* Dépense associée — évite le double comptage dans la rentabilité chantier */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Receipt className="h-4 w-4 text-red-500" />
          <h3 className="font-semibold text-sm">{t('supplierInvoiceDetail.expense.title')}</h3>
        </div>
        <div className="flex gap-2 items-center">
          <Select
            value={linkedExpense?.id || 'none'}
            onValueChange={(v) => updateLinkedExpense(v === 'none' ? null : v)}
            disabled={savingExpense}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('supplierInvoiceDetail.expense.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('supplierInvoiceDetail.expense.none')}</SelectItem>
              {linkedExpense && (
                <SelectItem value={linkedExpense.id}>{linkedExpense.title} ({t('supplierInvoiceDetail.expense.alreadyLinked')})</SelectItem>
              )}
              {linkableExpenses.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title} · {new Date(e.expense_date).toLocaleDateString('fr-FR')} · {formatEUR(Number(e.amount))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {t('supplierInvoiceDetail.expense.note')}
        </p>
      </Card>




      {lines.length > 0 && (
        <Card className="p-4 mb-4">
          <h3 className="font-semibold mb-2">{t('supplierInvoiceDetail.lines.title')}</h3>
          <div className="space-y-2 text-sm">
            {lines.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                <div className="min-w-0">
                  <div>{l.description || "—"}</div>
                  {l.category_code && <div className="text-xs text-muted-foreground font-mono" dir="ltr">{l.category_code}</div>}
                </div>
                <div className="font-medium shrink-0" dir="ltr">{formatEUR(Number(l.amount_ht))}</div>
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
          { compte: "601000", libelle: t('supplierInvoiceDetail.accounting.purchases'), debit: ht, credit: 0 },
          ...(tva > 0 ? [{ compte: "445660", libelle: t('supplierInvoiceDetail.accounting.tvaDeductible'), debit: tva, credit: 0 }] : []),
          { compte: "401000", libelle: t('supplierInvoiceDetail.accounting.suppliers'), debit: 0, credit: ttc },
        ];
        return (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{t('supplierInvoiceDetail.accounting.title')}</h3>
              <Badge variant="outline" className="font-mono text-xs">ACH</Badge>
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {t('supplierInvoiceDetail.accounting.subtitle')}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="ltr">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left py-1.5 pr-2">{t('supplierInvoiceDetail.accounting.account')}</th>
                    <th className="text-left py-1.5 pr-2">{t('supplierInvoiceDetail.accounting.label')}</th>
                    <th className="text-right py-1.5 pr-2">{t('supplierInvoiceDetail.accounting.debit')}</th>
                    <th className="text-right py-1.5">{t('supplierInvoiceDetail.accounting.credit')}</th>
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
                    <td colSpan={2} className="py-1.5 pr-2 text-right">{t('supplierInvoiceDetail.accounting.total')}</td>
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
        {invoice.pdf_url ? (
          <>
            <Button
              variant="outline"
              onClick={async () => {
                const { data, error } = await supabase.storage
                  .from("documents")
                  .createSignedUrl(invoice.pdf_url as string, 600);
                if (error || !data?.signedUrl) {
                  console.warn("[supplier-invoice] sign view failed:", error);
                  toast.error(t('supplierInvoiceDetail.originalUnavailable'));
                  return;
                }
                window.open(data.signedUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              {t('supplierInvoiceDetail.viewOriginal')}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const { data, error } = await supabase.storage
                  .from("documents")
                  .createSignedUrl(invoice.pdf_url as string, 600, { download: true });
                if (error || !data?.signedUrl) {
                  console.warn("[supplier-invoice] sign download failed:", error);
                  toast.error(t('supplierInvoiceDetail.originalUnavailable'));
                  return;
                }
                window.location.href = data.signedUrl;
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              {t('supplierInvoiceDetail.downloadOriginal')}
            </Button>
          </>
        ) : (
          <div className="text-xs text-muted-foreground italic">
            {t('supplierInvoiceDetail.originalMissing')}
          </div>
        )}
        {invoice.status !== "paid" && (
          <Button onClick={markPaid} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {t('supplierInvoiceDetail.markPaid')}
          </Button>
        )}
      </div>
    </div>
  );
}
