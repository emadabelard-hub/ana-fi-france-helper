import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, FileText, BarChart3, Package, Plus, Trash2, UserPlus } from "lucide-react";
import { buildStatutsPdf, buildPrevisionnelPdf, type AssocieDetail, type Personne } from "@/lib/creationPdf";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─────────── TRADUCTION ─────────── //
function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || "");
}
async function translateArToFr(text: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("btp-translate", {
    body: { text, sourceLang: "ar", targetLang: "fr" },
  });
  if (error) throw new Error(error.message || "Traduction impossible");
  const t = (data as { translated?: string })?.translated?.trim();
  if (!t) throw new Error("Traduction vide");
  return t;
}
async function trIfAr(text: string): Promise<string> {
  if (!text) return text;
  if (!containsArabic(text)) return text;
  return await translateArToFr(text);
}

// ─────────── TYPES FORMULAIRE ─────────── //
type BirthParts = { d: string; m: string; y: string };
type AssocieForm = {
  fullName: string;
  birth: BirthParts;
  birthPlace: string;
  nationality: string;
  address: string;
  percent: number;
  isManager: boolean;
};
type ManagerForm = {
  fullName: string;
  birth: BirthParts;
  birthPlace: string;
  nationality: string;
  address: string;
};

const emptyAssocie = (percent = 0, isManager = false): AssocieForm => ({
  fullName: "", birth: { d: "", m: "", y: "" }, birthPlace: "", nationality: "", address: "",
  percent, isManager,
});
const emptyManager = (): ManagerForm => ({
  fullName: "", birth: { d: "", m: "", y: "" }, birthPlace: "", nationality: "", address: "",
});

const PRODUCTS = [
  { id: "statuts", label: "📄 عقد التأسيس فقط", price: 49 },
  { id: "financial", label: "📊 الدراسة المالية فقط", price: 29 },
  { id: "package", label: "📦 الباكدج الكامل", price: 89, recommended: true },
];

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function birthToStr(b: BirthParts): string {
  if (!b.d || !b.m || !b.y) return "";
  return `${b.d.padStart(2, "0")}/${b.m.padStart(2, "0")}/${b.y}`;
}

function savePdfSafely(doc: ReturnType<typeof buildStatutsPdf>, filename: string) {
  try { doc.save(filename); }
  catch (e) {
    try { doc.output("dataurlnewwindow"); } catch { throw e; }
  }
}

// ─────────── DATE PICKER RÉUTILISABLE ─────────── //
function BirthDatePicker({ value, onChange }: { value: BirthParts; onChange: (b: BirthParts) => void }) {
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = 2008; y >= 1940; y--) arr.push(y);
    return arr;
  }, []);
  return (
    <div className="grid grid-cols-3 gap-2" dir="rtl">
      <div className="space-y-1">
        <Label className="text-xs">اليوم</Label>
        <Select value={value.d} onValueChange={(v) => onChange({ ...value, d: v })}>
          <SelectTrigger><SelectValue placeholder="يوم" /></SelectTrigger>
          <SelectContent className="max-h-64">
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <SelectItem key={d} value={String(d)}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">الشهر</Label>
        <Select value={value.m} onValueChange={(v) => onChange({ ...value, m: v })}>
          <SelectTrigger><SelectValue placeholder="شهر" /></SelectTrigger>
          <SelectContent className="max-h-64">
            {AR_MONTHS.map((name, idx) => (
              <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">السنة</Label>
        <Select value={value.y} onValueChange={(v) => onChange({ ...value, y: v })}>
          <SelectTrigger><SelectValue placeholder="سنة" /></SelectTrigger>
          <SelectContent className="max-h-64">
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─────────── PAGE ─────────── //
export default function PaiementCreationPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<"SASU" | "SARL">("SASU");
  const [activity, setActivity] = useState("");
  const [capital, setCapital] = useState<number>(1000);
  const [address, setAddress] = useState("");
  const [signatureCity, setSignatureCity] = useState("");

  const [associes, setAssocies] = useState<AssocieForm[]>([emptyAssocie(100, true)]);
  const [extraManagers, setExtraManagers] = useState<ManagerForm[]>([]);

  const [product, setProduct] = useState("package");
  const [caEstime, setCaEstime] = useState<number>(50000);
  const [isBtp, setIsBtp] = useState(true);

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [isLoading, user, navigate]);

  // Ajuster automatiquement les associés lors du changement SASU <-> SARL
  useEffect(() => {
    if (companyType === "SASU") {
      setAssocies([{ ...emptyAssocie(100, true), ...(associes[0] ?? {}), percent: 100, isManager: true }]);
      setExtraManagers([]);
    } else {
      setAssocies(prev => {
        if (prev.length >= 2) return prev;
        const first = { ...(prev[0] ?? emptyAssocie(50, true)), percent: 50, isManager: true };
        return [first, emptyAssocie(50, false)];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyType]);

  const totalPercent = useMemo(
    () => associes.reduce((s, a) => s + (Number(a.percent) || 0), 0),
    [associes]
  );

  const updateAssocie = <K extends keyof AssocieForm>(i: number, field: K, value: AssocieForm[K]) => {
    setAssocies(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  };
  const addAssocie = () => setAssocies(prev => [...prev, emptyAssocie(0, false)]);
  const removeAssocie = (i: number) => setAssocies(prev => prev.filter((_, idx) => idx !== i));

  const updateManager = <K extends keyof ManagerForm>(i: number, field: K, value: ManagerForm[K]) => {
    setExtraManagers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };
  const addManager = () => setExtraManagers(prev => [...prev, emptyManager()]);
  const removeManager = (i: number) => setExtraManagers(prev => prev.filter((_, idx) => idx !== i));

  // ─── Validation ─── //
  function validateStatuts(): string | null {
    if (!companyName.trim()) return "اسم الشركة مطلوب";
    if (!activity.trim()) return "النشاط مطلوب";
    if (!address.trim()) return "عنوان الشركة مطلوب";
    if (!signatureCity.trim()) return "مدينة التوقيع مطلوبة";
    for (let i = 0; i < associes.length; i++) {
      const a = associes[i];
      const label = companyType === "SASU" ? "الشريك الوحيد" : `الشريك رقم ${i + 1}`;
      if (!a.fullName.trim()) return `${label}: الاسم الكامل مطلوب`;
      if (!birthToStr(a.birth)) return `${label}: تاريخ الميلاد مطلوب`;
      if (!a.birthPlace.trim()) return `${label}: مكان الميلاد مطلوب`;
      if (!a.nationality.trim()) return `${label}: الجنسية مطلوبة`;
      if (!a.address.trim()) return `${label}: العنوان مطلوب`;
    }
    if (companyType === "SARL") {
      if (associes.length < 2) return "الشركة SARL تتطلب شريكين على الأقل";
      if (Math.round(totalPercent) !== 100) return `مجموع النسب يجب أن يساوي 100% (حاليا ${totalPercent}%)`;
      const hasManager = associes.some(a => a.isManager) || extraManagers.length > 0;
      if (!hasManager) return "يجب اختيار مدير واحد على الأقل";
      for (let i = 0; i < extraManagers.length; i++) {
        const m = extraManagers[i];
        const label = `المدير غير الشريك رقم ${i + 1}`;
        if (!m.fullName.trim()) return `${label}: الاسم الكامل مطلوب`;
        if (!birthToStr(m.birth)) return `${label}: تاريخ الميلاد مطلوب`;
        if (!m.birthPlace.trim()) return `${label}: مكان الميلاد مطلوب`;
        if (!m.nationality.trim()) return `${label}: الجنسية مطلوبة`;
        if (!m.address.trim()) return `${label}: العنوان مطلوب`;
      }
    }
    return null;
  }

  const handleGenerate = async () => {
    const needStatuts = product === "statuts" || product === "package";
    const needPrevi = product === "financial" || product === "package";

    if (needStatuts) {
      const err = validateStatuts();
      if (err) { toast.error(err); return; }
    }
    if (needPrevi && (!activity || !caEstime || caEstime <= 0)) {
      toast.error("اكتب الإيرادات السنوية المتوقعة");
      return;
    }

    setGenerating(true);
    const tid = toast.loading("جاري الترجمة...");
    try {
      // Traduction en parallèle de tous les champs susceptibles d'être en arabe
      const [
        companyNameFr, activityFr, addressFr, signatureCityFr,
      ] = await Promise.all([
        trIfAr(companyName), trIfAr(activity), trIfAr(address), trIfAr(signatureCity),
      ]);

      const associesFr: AssocieDetail[] = await Promise.all(
        associes.map(async (a) => ({
          fullName: await trIfAr(a.fullName),
          birthDate: birthToStr(a.birth),
          birthPlace: await trIfAr(a.birthPlace),
          nationality: await trIfAr(a.nationality),
          address: await trIfAr(a.address),
          percent: Number(a.percent) || 0,
          isManager: !!a.isManager,
        }))
      );
      const extraManagersFr: Personne[] = await Promise.all(
        extraManagers.map(async (m) => ({
          fullName: await trIfAr(m.fullName),
          birthDate: birthToStr(m.birth),
          birthPlace: await trIfAr(m.birthPlace),
          nationality: await trIfAr(m.nationality),
          address: await trIfAr(m.address),
        }))
      );

      toast.dismiss(tid);

      if (needStatuts) {
        const doc = buildStatutsPdf({
          companyName: companyNameFr,
          companyType,
          activity: activityFr,
          capital,
          address: addressFr,
          signatureCity: signatureCityFr,
          associes: associesFr,
          extraManagers: extraManagersFr,
        });
        savePdfSafely(doc, `statuts-${companyNameFr || "societe"}.pdf`);
      }
      if (needPrevi) {
        const doc = buildPrevisionnelPdf({
          type_societe: companyType,
          activite: activityFr,
          capital,
          chiffre_affaires_estime: caEstime,
          is_btp: isBtp,
        });
        savePdfSafely(doc, `previsionnel-${activityFr || "activite"}.pdf`);
      }
      toast.success("الوثيقة جاهزة ✅");
    } catch (e) {
      toast.dismiss(tid);
      const msg = e instanceof Error ? e.message : "خطأ غير معروف";
      toast.error(`تعذّرت الترجمة أو التوليد: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div dir="rtl" className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold">افتح شركتك في فرنسا 🇫🇷</h1>
        <p className="text-muted-foreground">املأ البيانات ونولّد لك عقد التأسيس بالفرنسي</p>
      </header>

      <Card className="p-5 space-y-3 bg-amber-50 dark:bg-amber-950/30 border-amber-500">
        <h2 className="text-lg font-bold">📋 جهز الأوراق دي قبل ما تبدأ</h2>
        <ul className="space-y-2 text-sm">
          <li>🪪 بطاقة الإقامة أو الهوية بتاعتك</li>
          <li>🏠 عنوان مقر الشركة (ممكن يكون عنوان سكنك)</li>
          <li>💰 المبلغ اللي هتحطه رأس مال (حتى لو 1 يورو)</li>
          <li>👥 لو معاك شركاء: أساميهم، تاريخ ومكان ميلادهم، جنسياتهم، عناوينهم ونسبة كل واحد</li>
          <li>📅 تاريخ ومكان ميلاد كل مدير (Gérant / Président)</li>
        </ul>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-bold">📝 بيانات الشركة</h2>

        <div className="space-y-2">
          <Label>اسم الشركة (Dénomination)</Label>
          <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="ex: ANAFY BTP" />
        </div>

        <div className="space-y-2">
          <Label>نوع الشركة</Label>
          <RadioGroup value={companyType} onValueChange={(v) => setCompanyType(v as "SASU" | "SARL")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="SASU" /> SASU</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="SARL" /> SARL</label>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>النشاط الرئيسي</Label>
          <Input value={activity} onChange={e => setActivity(e.target.value)} placeholder="travaux de peinture / أعمال الدهانات" />
        </div>

        <div className="space-y-2">
          <Label>رأس المال (€)</Label>
          <Input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <div className="space-y-2">
          <Label>عنوان الشركة (siège social)</Label>
          <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="12 rue de la Paix, 75002 Paris" />
        </div>

        <div className="space-y-2">
          <Label>المدينة (مكان التوقيع)</Label>
          <Input value={signatureCity} onChange={e => setSignatureCity(e.target.value)} placeholder="Paris" />
        </div>
      </Card>

      {/* ─────── ASSOCIÉS ─────── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {companyType === "SASU" ? "👤 الشريك الوحيد" : "👥 الشركاء"}
          </h2>
          {companyType === "SARL" && (
            <Button type="button" size="sm" variant="outline" onClick={addAssocie}>
              <Plus className="h-4 w-4 ml-1" /> إضافة شريك
            </Button>
          )}
        </div>

        {companyType === "SARL" && (
          <div className={`text-sm px-3 py-2 rounded ${Math.round(totalPercent) === 100 ? "bg-green-50 text-green-700 dark:bg-green-950/30" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30"}`}>
            مجموع النسب : {totalPercent}% {Math.round(totalPercent) === 100 ? "✅" : "(المطلوب 100%)"}
          </div>
        )}

        {associes.map((a, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {companyType === "SASU" ? "الشريك الوحيد" : `الشريك ${i + 1}`}
              </span>
              {companyType === "SARL" && associes.length > 2 && (
                <Button type="button" size="icon" variant="ghost" onClick={() => removeAssocie(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input value={a.fullName} onChange={e => updateAssocie(i, "fullName", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>تاريخ الميلاد</Label>
              <BirthDatePicker value={a.birth} onChange={(b) => updateAssocie(i, "birth", b)} />
            </div>

            <div className="space-y-2">
              <Label>مكان الميلاد (مدينة + دولة)</Label>
              <Input value={a.birthPlace} onChange={e => updateAssocie(i, "birthPlace", e.target.value)} placeholder="Le Caire, Égypte" />
            </div>

            <div className="space-y-2">
              <Label>الجنسية</Label>
              <Input value={a.nationality} onChange={e => updateAssocie(i, "nationality", e.target.value)} placeholder="française / égyptienne" />
            </div>

            <div className="space-y-2">
              <Label>العنوان الكامل</Label>
              <Textarea value={a.address} onChange={e => updateAssocie(i, "address", e.target.value)} />
            </div>

            {companyType === "SARL" && (
              <div className="space-y-2">
                <Label>النسبة ٪</Label>
                <Input type="number" min={0} max={100} value={a.percent}
                  onChange={e => updateAssocie(i, "percent", Number(e.target.value))} dir="ltr" lang="fr" />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <Checkbox
                checked={a.isManager}
                disabled={companyType === "SASU"}
                onCheckedChange={(v) => updateAssocie(i, "isManager", Boolean(v))}
              />
              <span>هو المدير؟ ({companyType === "SASU" ? "Président" : "Gérant"})</span>
            </label>
          </div>
        ))}

        {companyType === "SARL" && (
          <>
            <div className="flex items-center justify-between pt-4 border-t">
              <h3 className="font-semibold">مدير غير شريك (اختياري)</h3>
              <Button type="button" size="sm" variant="outline" onClick={addManager}>
                <UserPlus className="h-4 w-4 ml-1" /> إضافة مدير
              </Button>
            </div>
            {extraManagers.map((m, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">مدير غير شريك {i + 1}</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeManager(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>الاسم الكامل</Label>
                  <Input value={m.fullName} onChange={e => updateManager(i, "fullName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الميلاد</Label>
                  <BirthDatePicker value={m.birth} onChange={(b) => updateManager(i, "birth", b)} />
                </div>
                <div className="space-y-2">
                  <Label>مكان الميلاد</Label>
                  <Input value={m.birthPlace} onChange={e => updateManager(i, "birthPlace", e.target.value)} placeholder="Le Caire, Égypte" />
                </div>
                <div className="space-y-2">
                  <Label>الجنسية</Label>
                  <Input value={m.nationality} onChange={e => updateManager(i, "nationality", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>العنوان الكامل</Label>
                  <Textarea value={m.address} onChange={e => updateManager(i, "address", e.target.value)} />
                </div>
              </div>
            ))}
          </>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-bold">📊 الدراسة المالية</h2>
        <div className="space-y-2">
          <Label>الإيرادات السنوية المتوقعة (CA annuel en €)</Label>
          <Input type="number" value={caEstime} onChange={e => setCaEstime(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={isBtp} onCheckedChange={(v) => setIsBtp(Boolean(v))} />
          <span>نوع النشاط BTP ؟ (يضيف التأمين العشري)</span>
        </label>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-bold">💳 اختر الباكدج</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRODUCTS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProduct(p.id)}
              className={`relative text-right border-2 rounded-xl p-4 transition ${product === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            >
              {p.recommended && <Badge className="absolute -top-2 right-2">الأوفر</Badge>}
              <div className="text-2xl mb-2">{p.id === "statuts" ? <FileText /> : p.id === "financial" ? <BarChart3 /> : <Package />}</div>
              <div className="font-semibold text-sm mb-1">{p.label}</div>
              <div className="text-lg font-bold">{p.price}€</div>
            </button>
          ))}
        </div>
      </Card>

      <Button onClick={handleGenerate} disabled={generating} size="lg" className="w-full">
        {generating ? <><Loader2 className="ml-2 animate-spin h-5 w-5" /> جاري التوليد...</> : "توليد الوثيقة"}
      </Button>
    </div>
  );
}
