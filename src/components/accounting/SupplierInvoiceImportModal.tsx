import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ocrSupplierInvoice,
  createSupplierInvoice,
  CATEGORY_CODES,
} from "@/services/supplierInvoices";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const TVA_RATES = [0, 5.5, 10, 20];

const toBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const b64 = s.includes(",") ? s.split(",")[1] : s;
      res(b64);
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default function SupplierInvoiceImportModal({ open, onOpenChange, onCreated }: Props) {
  const { isRTL } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "form">("upload");
  const [ocring, setOcring] = useState(false);
  const [saving, setSaving] = useState(false);

  const [supplierName, setSupplierName] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [amountHt, setAmountHt] = useState<string>("");
  const [tvaRate, setTvaRate] = useState<string>("20");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("601000");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setStep("upload"); setOcring(false); setSaving(false);
    setSupplierName(""); setSupplierRef("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setAmountHt(""); setTvaRate("20");
    setDescription(""); setCategory("601000"); setNotes("");
  };

  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? "الملف كبير جداً (10 ميغا كحد أقصى)" : "Fichier trop volumineux (10 Mo max)");
      return;
    }
    setOcring(true);
    try {
      const b64 = await toBase64(file);
      const r = await ocrSupplierInvoice(b64, file.type || "application/octet-stream");
      if (r?.supplier_name) setSupplierName(r.supplier_name);
      if (r?.supplier_reference) setSupplierRef(r.supplier_reference);
      if (r?.invoice_date) setInvoiceDate(r.invoice_date);
      if (typeof r?.amount_ht === "number") setAmountHt(String(r.amount_ht));
      if (typeof r?.tva_rate === "number") setTvaRate(String(r.tva_rate));
      if (r?.description) setDescription(r.description);
      if (r?.category_code) setCategory(r.category_code);
      toast.success(isRTL ? "تم استخراج البيانات — راجعها" : "Données extraites — vérifiez");
    } catch (e: any) {
      console.error(e);
      toast.warning(isRTL ? "تعذّر الاستخراج التلقائي — أدخل يدوياً" : "OCR indisponible — saisie manuelle");
    } finally {
      setOcring(false);
      setStep("form");
    }
  };

  const submit = async () => {
    const ht = Number(String(amountHt).replace(",", "."));
    if (!invoiceDate || !isFinite(ht) || ht < 0) {
      toast.error(isRTL ? "تاريخ أو مبلغ غير صالح" : "Date ou montant invalide");
      return;
    }
    setSaving(true);
    try {
      await createSupplierInvoice({
        supplier_name: supplierName.trim() || null,
        supplier_reference: supplierRef.trim() || null,
        invoice_date: invoiceDate,
        amount_ht: ht,
        tva_rate: Number(tvaRate),
        description: description.trim() || null,
        category_code: category,
        notes: notes.trim() || null,
      });
      toast.success(isRTL ? "تم إنشاء الفاتورة" : "Facture créée");
      onCreated();
      close();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const ht = Number(String(amountHt).replace(",", ".")) || 0;
  const rate = Number(tvaRate) || 0;
  const tva = Math.round(ht * rate) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className={isRTL ? "font-cairo text-right" : ""}>
            {isRTL ? "استيراد فاتورة مورّد" : "Importer une facture fournisseur"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={ocring}
              className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 hover:bg-muted/40 transition-colors text-center"
            >
              {ocring ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>{isRTL ? "جاري المعالجة..." : "Analyse en cours..."}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span className="font-medium text-foreground">
                    {isRTL ? "اختر ملف الفاتورة" : "Choisir un fichier"}
                  </span>
                  <span className="text-xs">PDF · JPG · PNG · Factur-X (10 Mo max)</span>
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf,application/xml,text/xml,.pdf,.jpg,.jpeg,.png,.xml"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
            />
            <Button variant="outline" className="w-full" onClick={() => setStep("form")} disabled={ocring}>
              {isRTL ? "تخطّي وإدخال يدوي" : "Saisir manuellement"}
            </Button>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-3">
            <div>
              <Label>{isRTL ? "المورّد" : "Fournisseur"}</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder={isRTL ? "اسم المورّد" : "Nom du fournisseur"} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{isRTL ? "التاريخ" : "Date"}</Label>
                <Input type="date" lang="fr" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <Label>{isRTL ? "مرجع المورّد" : "Réf. fournisseur"}</Label>
                <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="F-2026-..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{isRTL ? "المبلغ بدون ضريبة" : "Montant HT"}</Label>
                <Input type="number" inputMode="decimal" step="0.01" lang="fr" value={amountHt} onChange={(e) => setAmountHt(e.target.value)} />
              </div>
              <div>
                <Label>TVA %</Label>
                <Select value={tvaRate} onValueChange={setTvaRate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TVA_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md bg-muted p-2 text-sm">
              <div className="flex justify-between"><span>HT</span><span>{ht.toFixed(2)} €</span></div>
              <div className="flex justify-between"><span>TVA</span><span>{tva.toFixed(2)} €</span></div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>TTC</span><span>{ttc.toFixed(2)} €</span></div>
            </div>
            <div>
              <Label>{isRTL ? "الوصف" : "Description"}</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>{isRTL ? "الفئة المحاسبية" : "Catégorie comptable"}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={close} disabled={saving}>
            <X className="h-4 w-4 mr-1" />
            {isRTL ? "إلغاء" : "Annuler"}
          </Button>
          {step === "form" && (
            <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {isRTL ? "التحقق والإنشاء" : "Valider et créer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
