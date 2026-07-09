import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, FileText, BarChart3, Package, Plus, Trash2 } from "lucide-react";
import { buildStatutsPdf, buildPrevisionnelPdf } from "@/lib/creationPdf";
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

// Détecte si le texte contient de l'arabe (nécessite traduction avant PDF français)
function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

async function translateArabicToFrench(text: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("btp-translate", {
    body: { text, sourceLang: "ar", targetLang: "fr" },
  });
  if (error) throw new Error(error.message || "Traduction impossible");
  const translated = (data as { translated?: string })?.translated?.trim();
  if (!translated) throw new Error("Traduction vide");
  return translated;
}

type Associe = { name: string; percent: number };

const PRODUCTS = [
  { id: "statuts", label: "📄 عقد التأسيس فقط", price: 49 },
  { id: "financial", label: "📊 الدراسة المالية فقط", price: 29 },
  { id: "package", label: "📦 الباكدج الكامل", price: 89, recommended: true },
];

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function savePdfSafely(doc: ReturnType<typeof buildStatutsPdf>, filename: string) {
  try {
    doc.save(filename);
  } catch (e) {
    try {
      doc.output("dataurlnewwindow");
    } catch {
      throw e;
    }
  }
}

export default function PaiementCreationPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<"SASU" | "SARL">("SASU");
  const [activity, setActivity] = useState("");
  const [capital, setCapital] = useState<number>(1000);
  const [address, setAddress] = useState("");
  const [managerName, setManagerName] = useState("");
  const [birthDay, setBirthDay] = useState<string>("");
  const [birthMonth, setBirthMonth] = useState<string>("");
  const [birthYear, setBirthYear] = useState<string>("");
  const [managerNationality, setManagerNationality] = useState("");
  const [managerAddress, setManagerAddress] = useState("");
  const [associes, setAssocies] = useState<Associe[]>([{ name: "", percent: 100 }]);
  const [product, setProduct] = useState("package");
  const [caEstime, setCaEstime] = useState<number>(50000);
  const [isBtp, setIsBtp] = useState(true);

  const [generating, setGenerating] = useState(false);

  const managerBirthDate = useMemo(() => {
    if (!birthDay || !birthMonth || !birthYear) return "";
    const dd = birthDay.padStart(2, "0");
    const mm = birthMonth.padStart(2, "0");
    return `${dd}/${mm}/${birthYear}`;
  }, [birthDay, birthMonth, birthYear]);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = 2008; y >= 1940; y--) arr.push(y);
    return arr;
  }, []);

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [isLoading, user, navigate]);

  const handleGenerate = async () => {
    const needStatuts = product === "statuts" || product === "package";
    const needPrevi = product === "financial" || product === "package";

    if (needStatuts && (!companyName || !activity || !address || !managerName)) {
      toast.error("املأ الحقول المطلوبة");
      return;
    }
    if (needPrevi && (!activity || !caEstime || caEstime <= 0)) {
      toast.error("اكتب الإيرادات السنوية المتوقعة");
      return;
    }
    setGenerating(true);
    try {
      if (needStatuts) {
        const doc = buildStatutsPdf({
          companyName, companyType, activity, capital, address,
          managerName, managerBirthDate, managerNationality, managerAddress,
          associes: companyType === "SARL" ? associes : undefined,
        });
        savePdfSafely(doc, `statuts-${companyName || "societe"}.pdf`);
      }
      if (needPrevi) {
        const doc = buildPrevisionnelPdf({
          type_societe: companyType,
          activite: activity,
          capital,
          chiffre_affaires_estime: caEstime,
          is_btp: isBtp,
        });
        savePdfSafely(doc, `previsionnel-${activity || "activite"}.pdf`);
      }
      toast.success("الوثيقة جاهزة ✅");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطأ غير معروف";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const addAssocie = () => setAssocies([...associes, { name: "", percent: 0 }]);
  const removeAssocie = (i: number) => setAssocies(associes.filter((_, idx) => idx !== i));
  const updateAssocie = (i: number, field: keyof Associe, value: string) => {
    setAssocies(associes.map((a, idx) => idx === i ? { ...a, [field]: field === "percent" ? Number(value) : value } : a));
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
          <li>👥 لو معاك شركاء: أساميهم وعناوينهم ونسبة كل واحد</li>
          <li>📅 تاريخ ومكان ميلاد الجيرون (Gérant)</li>
        </ul>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-bold">📝 بيانات الشركة</h2>

        <div className="space-y-2">
          <Label>اسم الشركة (Dénomination)</Label>
          <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="ex: ANAFY BTP" dir="ltr" />
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
          <Input value={activity} onChange={e => setActivity(e.target.value)} placeholder="travaux de peinture et revêtements" dir="ltr" />
        </div>

        <div className="space-y-2">
          <Label>رأس المال (€)</Label>
          <Input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <div className="space-y-2">
          <Label>عنوان الشركة (siège social)</Label>
          <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="12 rue de la Paix, 75002 Paris" dir="ltr" lang="fr" />
        </div>

        <hr />
        <h2 className="text-xl font-bold">👤 المسير (Gérant)</h2>

        <div className="space-y-2">
          <Label>اسم الجيرون (Gérant)</Label>
          <Input value={managerName} onChange={e => setManagerName(e.target.value)} dir="ltr" />
        </div>

        <div className="space-y-2">
          <Label>تاريخ الميلاد</Label>
          <div className="grid grid-cols-3 gap-2" dir="rtl">
            <div className="space-y-1">
              <Label className="text-xs">اليوم</Label>
              <Select value={birthDay} onValueChange={setBirthDay}>
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
              <Select value={birthMonth} onValueChange={setBirthMonth}>
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
              <Select value={birthYear} onValueChange={setBirthYear}>
                <SelectTrigger><SelectValue placeholder="سنة" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>الجنسية</Label>
          <Input value={managerNationality} onChange={e => setManagerNationality(e.target.value)} placeholder="française" dir="ltr" />
        </div>

        <div className="space-y-2">
          <Label>عنوان المسير (لو مختلف)</Label>
          <Textarea value={managerAddress} onChange={e => setManagerAddress(e.target.value)} dir="ltr" lang="fr" />
        </div>

        {companyType === "SARL" && (
          <>
            <hr />
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">👥 توزيع الحصص</h2>
              <Button type="button" size="sm" variant="outline" onClick={addAssocie}><Plus className="h-4 w-4 ml-1" /> أضف شريك</Button>
            </div>
            {associes.map((a, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">اسم الشريك</Label>
                  <Input value={a.name} onChange={e => updateAssocie(i, "name", e.target.value)} dir="ltr" />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">%</Label>
                  <Input type="number" value={a.percent} onChange={e => updateAssocie(i, "percent", e.target.value)} dir="ltr" lang="fr" />
                </div>
                {associes.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeAssocie(i)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
          </>
        )}

        <hr />
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
