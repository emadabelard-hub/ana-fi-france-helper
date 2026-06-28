import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, FileText, BarChart3, Package, Download, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Associe = { name: string; percent: number };

const PRODUCTS = [
  { id: "statuts", label: "📄 عقد التأسيس فقط", price: 49 },
  { id: "financial", label: "📊 الدراسة المالية فقط", price: 29 },
  { id: "package", label: "📦 الباكدج الكامل", price: 89, recommended: true },
];

export default function PaiementCreationPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<"SASU" | "SARL">("SASU");
  const [activity, setActivity] = useState("");
  const [capital, setCapital] = useState<number>(1000);
  const [address, setAddress] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerBirthDate, setManagerBirthDate] = useState("");
  const [managerNationality, setManagerNationality] = useState("");
  const [managerAddress, setManagerAddress] = useState("");
  const [associes, setAssocies] = useState<Associe[]>([{ name: "", percent: 100 }]);
  const [product, setProduct] = useState("package");
  const [caEstime, setCaEstime] = useState<number>(50000);
  const [isBtp, setIsBtp] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previsionnelUrl, setPrevisionnelUrl] = useState<string | null>(null);

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
    toast.info("قريباً — الدفع هيكون متاح قريباً! ✅");
    setGenerating(true);
    setPdfUrl(null);
    setPrevisionnelUrl(null);
    try {
      if (needStatuts) {
        const { data, error } = await supabase.functions.invoke("generate-statuts", {
          body: {
            companyName, companyType, activity, capital, address,
            managerName, managerBirthDate, managerNationality, managerAddress,
            associes: companyType === "SARL" ? associes : undefined,
            product,
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("PDF non généré");
        setPdfUrl(data.url);
      }
      if (needPrevi) {
        const { data, error } = await supabase.functions.invoke("generate-previsionnel", {
          body: {
            type_societe: companyType,
            activite: activity,
            capital,
            chiffre_affaires_estime: caEstime,
            is_btp: isBtp,
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("PDF non généré");
        setPrevisionnelUrl(data.url);
      }
      if (needPrevi && !needStatuts) {
        toast.success("✅ الدراسة المالية جاهزة! ده الملف اللي هتاخده معاك للبنك عشان تفتح الحساب البنكي للشركة.");
      } else if (needStatuts && needPrevi) {
        toast.success("✅ تم توليد عقد التأسيس + الدراسة المالية!");
      } else {
        toast.success("✅ تم توليد عقد التأسيس!");
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "خطأ");
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
          <Label>الاسم الكامل</Label>
          <Input value={managerName} onChange={e => setManagerName(e.target.value)} dir="ltr" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>تاريخ الميلاد</Label>
            <Input type="date" value={managerBirthDate} onChange={e => setManagerBirthDate(e.target.value)} dir="ltr" lang="fr" />
          </div>
          <div className="space-y-2">
            <Label>الجنسية</Label>
            <Input value={managerNationality} onChange={e => setManagerNationality(e.target.value)} placeholder="française" dir="ltr" />
          </div>
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

      {pdfUrl && (
        <Card className="p-5 space-y-3 bg-green-50 dark:bg-green-950/30 border-green-500">
          <p className="font-semibold">
            ✅ تم توليد عقد التأسيس بتاعك! اطبعه وامضيه وخده مع ورقة الإيداع البنكي لتسجيل الشركة.
          </p>
          <Button asChild className="w-full">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download>
              <Download className="ml-2 h-4 w-4" /> تحميل عقد التأسيس
            </a>
          </Button>
        </Card>
      )}

      {previsionnelUrl && (
        <Card className="p-5 space-y-3 bg-blue-50 dark:bg-blue-950/30 border-blue-500">
          <p className="font-semibold">
            ✅ الدراسة المالية جاهزة! ده الملف اللي هتاخده معاك للبنك عشان تفتح الحساب البنكي للشركة.
          </p>
          <Button asChild className="w-full">
            <a href={previsionnelUrl} target="_blank" rel="noopener noreferrer" download>
              <Download className="ml-2 h-4 w-4" /> تحميل الدراسة المالية
            </a>
          </Button>
        </Card>
      )}
    </div>
  );
}
