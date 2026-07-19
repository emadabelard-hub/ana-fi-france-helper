import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type StepText = { title: string; subtitle: string; linkLabel?: string };
type Step = {
  key: string;
  icon: string;
  fr: StepText;
  ar: StepText;
  link?: { type: "internal" | "external"; href: string };
};

const STEPS: Step[] = [
  {
    key: "type_societe",
    icon: "✅",
    fr: { title: "J'ai choisi le type de société", subtitle: "SASU / SARL / Auto-entrepreneur" },
    ar: { title: "اخترت نوع الشركة", subtitle: "SASU / SARL / Auto-entrepreneur" },
  },
  {
    key: "statuts",
    icon: "📄",
    fr: { title: "J'ai préparé les statuts", subtitle: "Générez vos statuts ici", linkLabel: "Aller à la page →" },
    ar: { title: "جهزت عقد التأسيس", subtitle: "ولّد الـ Statuts بتاعك من هنا", linkLabel: "روح للصفحة ←" },
    link: { type: "internal", href: "/paiement-creation" },
  },
  {
    key: "compte_bancaire",
    icon: "🏦",
    fr: { title: "J'ai ouvert un compte bancaire professionnel", subtitle: "Compte au nom de la société pour déposer le capital" },
    ar: { title: "فتحت حساب بنكي للشركة", subtitle: "حساب باسم الشركة عشان تودّع رأس المال" },
  },
  {
    key: "depot_capital",
    icon: "💰",
    fr: { title: "J'ai déposé le capital social à la banque", subtitle: "Vous recevrez une attestation de dépôt" },
    ar: { title: "أودعت رأس المال في البنك", subtitle: "هتاخد شهادة إيداع (Attestation de dépôt)" },
  },
  {
    key: "jal",
    icon: "📰",
    fr: { title: "J'ai publié l'annonce légale", subtitle: "Journal d'Annonces Légales (JAL)" },
    ar: { title: "نشرت الإعلان القانوني في الجريدة", subtitle: "Journal d'Annonces Légales (JAL)" },
  },
  {
    key: "guichet_unique",
    icon: "🖥️",
    fr: { title: "Je me suis inscrit sur le Guichet Unique", subtitle: "La plateforme officielle d'immatriculation", linkLabel: "Ouvrir le Guichet Unique ↗" },
    ar: { title: "سجلت على Guichet Unique", subtitle: "المنصة الرسمية لتسجيل الشركة", linkLabel: "افتح Guichet Unique ↗" },
    link: { type: "external", href: "https://procedures.inpi.fr/" },
  },
  {
    key: "siret",
    icon: "📬",
    fr: { title: "J'ai reçu mon numéro SIRET", subtitle: "Numéro d'identification officiel de la société" },
    ar: { title: "استلمت رقم SIRET", subtitle: "رقم تعريف الشركة الرسمي" },
  },
  {
    key: "kbis",
    icon: "📜",
    fr: { title: "J'ai reçu mon extrait Kbis", subtitle: "Carte d'identité de la société" },
    ar: { title: "استلمت الـ Kbis", subtitle: "شهادة وجود الشركة (هويتها)" },
  },
  {
    key: "decennale",
    icon: "🛡️",
    fr: { title: "J'ai souscrit l'assurance décennale", subtitle: "Assurance obligatoire pour le BTP" },
    ar: { title: "اشتركت في التأمين العشري", subtitle: "Assurance Décennale — إجبارية للبناء" },
  },
  {
    key: "demarrage",
    icon: "🎉",
    fr: { title: "J'ai démarré mon activité officiellement !", subtitle: "Félicitations ! Vous pouvez maintenant facturer avec Anafy Pro" },
    ar: { title: "بدأت شغلك رسمياً!", subtitle: "مبروك! دلوقتي تقدر تفوتر بـ Anafy Pro" },
  },
];

export default function MaCreationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, boolean>>({});

  const T = {
    header: isRTL ? "🏗️ مسار فتح شركتك" : "🏗️ Parcours de création de votre société",
    subtitle: isRTL
      ? "تابع خطوة بخطوة حتى تفتح شركتك في فرنسا"
      : "Suivez pas à pas les étapes pour créer votre société en France",
    stepsCount: (n: number, total: number) => isRTL ? `${n} / ${total} خطوات` : `${n} / ${total} étapes`,
    doneAll: isRTL ? "🎉 خلصت كل الخطوات! مبروك!" : "🎉 Toutes les étapes sont terminées ! Félicitations !",
    cancel: isRTL ? "إلغاء" : "Annuler",
    markDone: isRTL ? "علّم كمكتمل" : "Marquer comme terminé",
    saveError: isRTL ? "ما اتحفظش، جرّب تاني" : "Échec de l'enregistrement, réessayez",
    startSuccess: isRTL ? "🎉 مبروك! بدأت رسمياً" : "🎉 Félicitations ! Vous avez démarré officiellement",
  };

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
      toast.error(T.saveError);
      setProgress((p) => ({ ...p, [stepKey]: !next }));
      return;
    }
    if (next && stepKey === "demarrage") {
      toast.success(T.startSuccess);
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
    <div dir={isRTL ? "rtl" : "ltr"} className="container mx-auto max-w-3xl px-4 py-6 pb-32">
      <header className={`mb-6 ${isRTL ? "text-right" : "text-left"}`}>
        <h1 className="text-2xl font-black tracking-tight">{T.header}</h1>
        <p className="text-sm text-muted-foreground mt-1">{T.subtitle}</p>
      </header>

      <Card className={`p-4 mb-6 bg-gradient-to-${isRTL ? "l" : "r"} from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background border-emerald-200 dark:border-emerald-900`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {T.stepsCount(completedCount, STEPS.length)}
          </span>
          <span className="text-xs text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="h-3 [&>div]:bg-emerald-500" />
        {completedCount === STEPS.length && (
          <p className="mt-3 text-center text-sm font-bold text-emerald-600">{T.doneAll}</p>
        )}
      </Card>

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const done = !!progress[step.key];
          const txt = isRTL ? step.ar : step.fr;
          return (
            <Card
              key={step.key}
              className={`p-4 transition-all ${
                done
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                  : "hover:border-primary/40"
              }`}
            >
              <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <button
                  type="button"
                  onClick={() => toggle(step.key)}
                  className="mt-1 shrink-0"
                  aria-label={done ? T.cancel : T.markDone}
                >
                  <Checkbox
                    checked={done}
                    className="h-6 w-6 rounded-full border-2"
                    onCheckedChange={() => toggle(step.key)}
                  />
                </button>
                <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                  <button
                    type="button"
                    onClick={() => toggle(step.key)}
                    className={`w-full ${isRTL ? "text-right" : "text-left"}`}
                  >
                    <div className={`font-bold text-base ${done ? "line-through text-muted-foreground" : ""}`}>
                      <span className={isRTL ? "ml-2" : "mr-2"}>{step.icon}</span>
                      <span>{i + 1}. {txt.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{txt.subtitle}</div>
                  </button>
                  {step.link && txt.linkLabel && (
                    <div className="mt-3">
                      {step.link.type === "internal" ? (
                        <Link
                          to={step.link.href}
                          className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
                        >
                          {txt.linkLabel}
                        </Link>
                      ) : (
                        <a
                          href={step.link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
                        >
                          {txt.linkLabel}
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
