import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Step = {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  link?: { type: "internal" | "external"; href: string; label: string };
};

const STEPS: Step[] = [
  { key: "type_societe", icon: "✅", title: "اخترت نوع الشركة", subtitle: "SASU / SARL / Auto-entrepreneur" },
  { key: "statuts", icon: "📄", title: "جهزت عقد التأسيس", subtitle: "ولّد الـ Statuts بتاعك من هنا", link: { type: "internal", href: "/paiement-creation", label: "روح للصفحة ←" } },
  { key: "compte_bancaire", icon: "🏦", title: "فتحت حساب بنكي للشركة", subtitle: "حساب باسم الشركة عشان تودّع رأس المال" },
  { key: "depot_capital", icon: "💰", title: "أودعت رأس المال في البنك", subtitle: "هتاخد شهادة إيداع (Attestation de dépôt)" },
  { key: "jal", icon: "📰", title: "نشرت الإعلان القانوني في الجريدة", subtitle: "Journal d'Annonces Légales (JAL)" },
  { key: "guichet_unique", icon: "🖥️", title: "سجلت على Guichet Unique", subtitle: "المنصة الرسمية لتسجيل الشركة", link: { type: "external", href: "https://procedures.inpi.fr/", label: "افتح Guichet Unique ↗" } },
  { key: "siret", icon: "📬", title: "استلمت رقم SIRET", subtitle: "رقم تعريف الشركة الرسمي" },
  { key: "kbis", icon: "📜", title: "استلمت الـ Kbis", subtitle: "شهادة وجود الشركة (هويتها)" },
  { key: "decennale", icon: "🛡️", title: "اشتركت في التأمين العشري", subtitle: "Assurance Décennale — إجبارية للبناء" },
  { key: "demarrage", icon: "🎉", title: "بدأت شغلك رسمياً!", subtitle: "مبروك! دلوقتي تقدر تفوتر بـ Anafy Pro" },
];

export default function MaCreationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("creation_progress")
        .select("step_key, completed")
        .eq("user_id", user.id);
      if (!error && data) {
        const map: Record<string, boolean> = {};
        data.forEach((r: any) => { map[r.step_key] = !!r.completed; });
        setProgress(map);
      }
      setLoading(false);
    })();
  }, [user]);

  const completedCount = useMemo(
    () => STEPS.filter((s) => progress[s.key]).length,
    [progress]
  );
  const percent = Math.round((completedCount / STEPS.length) * 100);

  const toggle = async (stepKey: string) => {
    if (!user) return;
    const next = !progress[stepKey];
    setProgress((p) => ({ ...p, [stepKey]: next }));
    const { error } = await supabase
      .from("creation_progress")
      .upsert(
        {
          user_id: user.id,
          step_key: stepKey,
          completed: next,
          completed_at: next ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,step_key" }
      );
    if (error) {
      console.error("[ma-creation] upsert failed", error);
      toast.error("ما اتحفظش، جرّب تاني");
      setProgress((p) => ({ ...p, [stepKey]: !next }));
      return;
    }
    if (next && stepKey === "demarrage") {
      toast.success("🎉 مبروك! بدأت رسمياً");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="container mx-auto max-w-3xl px-4 py-6 pb-32">
      <header className="mb-6 text-right">
        <h1 className="text-2xl font-black tracking-tight">🏗️ مسار فتح شركتك</h1>
        <p className="text-sm text-muted-foreground mt-1">
          تابع خطوة بخطوة حتى تفتح شركتك في فرنسا
        </p>
      </header>

      <Card className="p-4 mb-6 bg-gradient-to-l from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background border-emerald-200 dark:border-emerald-900">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {completedCount} / {STEPS.length} خطوات
          </span>
          <span className="text-xs text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="h-3 [&>div]:bg-emerald-500" />
        {completedCount === STEPS.length && (
          <p className="mt-3 text-center text-sm font-bold text-emerald-600">
            🎉 خلصت كل الخطوات! مبروك!
          </p>
        )}
      </Card>

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const done = !!progress[step.key];
          return (
            <Card
              key={step.key}
              className={`p-4 transition-all ${
                done
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                  : "hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-3 flex-row-reverse">
                <button
                  type="button"
                  onClick={() => toggle(step.key)}
                  className="mt-1 shrink-0"
                  aria-label={done ? "إلغاء" : "علّم كمكتمل"}
                >
                  <Checkbox
                    checked={done}
                    className="h-6 w-6 rounded-full border-2"
                    onCheckedChange={() => toggle(step.key)}
                  />
                </button>
                <div className="flex-1 text-right">
                  <button
                    type="button"
                    onClick={() => toggle(step.key)}
                    className="w-full text-right"
                  >
                    <div className={`font-bold text-base ${done ? "line-through text-muted-foreground" : ""}`}>
                      <span className="ml-2">{step.icon}</span>
                      <span>{i + 1}. {step.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{step.subtitle}</div>
                  </button>
                  {step.link && (
                    <div className="mt-3">
                      {step.link.type === "internal" ? (
                        <Link
                          to={step.link.href}
                          className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
                        >
                          {step.link.label}
                        </Link>
                      ) : (
                        <a
                          href={step.link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
                        >
                          {step.link.label}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
