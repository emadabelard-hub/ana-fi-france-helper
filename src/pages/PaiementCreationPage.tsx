import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, FileText, BarChart3, Package, Plus, Trash2, UserPlus } from "lucide-react";
import { buildStatutsPdf, buildPrevisionnelPdf, buildAttestationPdf, buildBeneficiairesPdf, buildGuideDepotPdf, buildLettreBanquePdf, buildPvNominationPdf, buildChecklistFinalePdf, buildFicheSynthesePdf, effectiveFormOf, type AssocieDetail, type Personne } from "@/lib/creationPdf";
import { computePrevisionnelQuick } from "@/lib/previsionnelCheck";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { useLanguage } from "@/contexts/LanguageContext";

// ─────────── TRADUCTION ─────────── //
function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || "");
}
async function translateArToFr(text: string, instruction?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("btp-translate", {
    body: { text, sourceLang: "ar", targetLang: "fr", ...(instruction ? { instruction } : {}) },
  });
  if (error) throw new Error(error.message || "Traduction impossible");
  const t = (data as { translated?: string })?.translated?.trim();
  if (!t) throw new Error("Traduction vide");
  return t;
}
async function trIfAr(text: string, instruction?: string): Promise<string> {
  if (!text) return text;
  if (!containsArabic(text)) return text;
  return await translateArToFr(text, instruction);
}

// Restaure les accents français des nationalités les plus fréquentes (le LLM peut renvoyer sans accents)
const NATIONALITY_ACCENTS: Record<string, string> = {
  "francaise": "française",
  "egyptienne": "égyptienne",
  "algerienne": "algérienne",
  "senegalaise": "sénégalaise",
  "camerounaise": "camerounaise",
  "ivoirienne": "ivoirienne",
  "libanaise": "libanaise",
  "syrienne": "syrienne",
  "tunisienne": "tunisienne",
  "marocaine": "marocaine",
  "italienne": "italienne",
  "espagnole": "espagnole",
  "portugaise": "portugaise",
  "allemande": "allemande",
  "belge": "belge",
  "grecque": "grecque",
  "roumaine": "roumaine",
  "turque": "turque",
  "mauritanienne": "mauritanienne",
  "malienne": "malienne",
  "libyenne": "libyenne",
  "jordanienne": "jordanienne",
  "irakienne": "irakienne",
  "iranienne": "iranienne",
};

// Normalise une nationalité au féminin français, minuscule (ex: "italienne", "égyptienne")
function normalizeNationalityFeminine(input: string): string {
  if (!input) return input;
  let s = input.trim().toLocaleLowerCase("fr-FR");
  // Si masculin en -ien / -ain / -ais / -ois / -in → féminin
  // Cas déjà féminins : se termine par "e" → on garde
  const alreadyFeminine = /(ienne|aine|aise|oise|ine|ande|onne|ègre|èque|ane|iène)$/.test(s);
  if (!alreadyFeminine) {
    if (/ien$/.test(s)) s = s.replace(/ien$/, "ienne");
    else if (/ain$/.test(s)) s = s.replace(/ain$/, "aine");
    else if (/ais$/.test(s)) s = s.replace(/ais$/, "aise");
    else if (/ois$/.test(s)) s = s.replace(/ois$/, "oise");
    else if (/in$/.test(s)) s = s.replace(/in$/, "ine");
    else if (/and$/.test(s)) s = s.replace(/and$/, "ande");
    else if (/on$/.test(s)) s = s.replace(/on$/, "onne");
    else if (!/e$/.test(s)) s = s + "e";
  }
  // Restaure les accents français si version sans accents connue
  const withoutAccents = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (NATIONALITY_ACCENTS[withoutAccents]) return NATIONALITY_ACCENTS[withoutAccents];
  if (NATIONALITY_ACCENTS[s]) return NATIONALITY_ACCENTS[s];
  return s;
}

// Nettoie une nationalité et retire les chiffres, garde uniquement lettres françaises/tirets
function stripDigits(input: string): string {
  return (input || "").replace(/[0-9]/g, "").trim();
}

// Trim + remplace toute suite d'espaces/tabs/retours par un espace simple
function cleanSpaces(input: string): string {
  if (!input) return input;
  return input.replace(/\s+/g, " ").trim();
}

// Map minimale pour restaurer les accents français des pays fréquents
const COUNTRY_ACCENTS: Record<string, string> = {
  "egypte": "Égypte", "égypte": "Égypte",
  "algerie": "Algérie", "algérie": "Algérie",
  "tunisie": "Tunisie",
  "maroc": "Maroc",
  "senegal": "Sénégal", "sénégal": "Sénégal",
  "liban": "Liban",
  "syrie": "Syrie",
  "france": "France",
  "italie": "Italie",
  "belgique": "Belgique",
  "espagne": "Espagne",
  "portugal": "Portugal",
  "allemagne": "Allemagne",
  "turquie": "Turquie",
  "grece": "Grèce", "grèce": "Grèce",
  "roumanie": "Roumanie",
  "cote d'ivoire": "Côte d'Ivoire", "côte d'ivoire": "Côte d'Ivoire",
  "cameroun": "Cameroun",
  "mali": "Mali",
  "mauritanie": "Mauritanie",
  "libye": "Libye",
  "jordanie": "Jordanie",
  "irak": "Irak",
  "iran": "Iran",
};

// Alias tolérants (typos fréquents, formes anglaises, translittérations approximatives)
const COUNTRY_ALIASES: Record<string, string> = {
  "turqui": "Turquie", "turkie": "Turquie", "turkey": "Turquie", "turquia": "Turquie",
  "egypt": "Égypte", "egipt": "Égypte", "egipte": "Égypte", "egyp": "Égypte",
  "algeria": "Algérie", "algerien": "Algérie",
  "morocco": "Maroc", "marocco": "Maroc",
  "tunisia": "Tunisie",
  "lebanon": "Liban",
  "syria": "Syrie",
  "greece": "Grèce",
  "romania": "Roumanie", "roumani": "Roumanie",
  "italy": "Italie", "itali": "Italie",
  "spain": "Espagne", "espagn": "Espagne",
  "germany": "Allemagne", "allemagn": "Allemagne",
  "portugual": "Portugal",
  "senegal": "Sénégal",
  "ivory coast": "Côte d'Ivoire",
  "libya": "Libye",
  "jordan": "Jordanie",
  "iraq": "Irak",
};

function lookupCountry(key: string): string | null {
  if (!key) return null;
  const k = key.trim().toLocaleLowerCase("fr-FR");
  if (!k) return null;
  const noAcc = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (COUNTRY_ACCENTS[k]) return COUNTRY_ACCENTS[k];
  if (COUNTRY_ACCENTS[noAcc]) return COUNTRY_ACCENTS[noAcc];
  if (COUNTRY_ALIASES[k]) return COUNTRY_ALIASES[k];
  if (COUNTRY_ALIASES[noAcc]) return COUNTRY_ALIASES[noAcc];
  // essai en complétant avec un 'e' final (ex: "turqui" -> "turquie")
  if (COUNTRY_ACCENTS[noAcc + "e"]) return COUNTRY_ACCENTS[noAcc + "e"];
  // essai en retirant un 'e' final
  if (noAcc.endsWith("e") && COUNTRY_ACCENTS[noAcc.slice(0, -1)]) return COUNTRY_ACCENTS[noAcc.slice(0, -1)];
  return null;
}

function formatCountry(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return input;
  const hit = lookupCountry(raw);
  if (hit) return hit;
  const key = raw.toLocaleLowerCase("fr-FR");
  // Capitalisation par défaut
  return key.split(/(\s+|-)/).map(seg => seg && !/^\s+$/.test(seg) && seg !== "-"
    ? seg.charAt(0).toLocaleUpperCase("fr-FR") + seg.slice(1)
    : seg).join("");
}

function capitalizePlaceWord(s: string): string {
  if (!s) return s;
  const lower = s.toLocaleLowerCase("fr-FR");
  return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
}

// Reformate "Ville, Pays" (avec virgule + accents pays), même si l'utilisateur a séparé par espace/tiret uniquement.
function formatBirthPlace(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return raw;
  if (raw.includes(",")) {
    const parts = raw.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const country = formatCountry(parts[parts.length - 1]);
      const city = parts.slice(0, -1).map(capitalizePlaceWord).join(", ");
      return `${city}, ${country}`;
    }
    return capitalizePlaceWord(raw);
  }
  // Pas de virgule : tenter de détecter le(s) dernier(s) mot(s) comme pays connu
  const tokens = raw.split(/\s+/);
  for (let i = 1; i < tokens.length; i++) {
    const tail = tokens.slice(i).join(" ");
    const hit = lookupCountry(tail);
    if (hit) {
      const city = tokens.slice(0, i).map(capitalizePlaceWord).join(" ");
      return `${city}, ${hit}`;
    }
  }
  return tokens.map(capitalizePlaceWord).join(" ");
}

const NATIONALITY_INSTRUCTION =
  "Traduis en français le gentilé (nationalité) uniquement. Réponds UNIQUEMENT par un seul mot au féminin singulier, en minuscule, sans article ni ponctuation (ex: italienne, égyptienne, française, marocaine, tunisienne, algérienne, syrienne, libanaise, sénégalaise).";

// ─────────── TYPES FORMULAIRE ─────────── //
type Gender = "M" | "F";
type BirthParts = { d: string; m: string; y: string };
type AssocieForm = {
  gender: Gender;
  fullName: string;
  birth: BirthParts;
  birthPlace: string;
  nationality: string;
  address: string;
  fatherName: string;
  motherName: string;
  percent: number;
  isManager: boolean;
};
type ManagerForm = {
  gender: Gender;
  fullName: string;
  birth: BirthParts;
  birthPlace: string;
  nationality: string;
  address: string;
  fatherName: string;
  motherName: string;
};

const emptyAssocie = (percent = 0, isManager = false): AssocieForm => ({
  gender: "M",
  fullName: "", birth: { d: "", m: "", y: "" }, birthPlace: "", nationality: "", address: "",
  fatherName: "", motherName: "",
  percent, isManager,
});
const emptyManager = (): ManagerForm => ({
  gender: "M",
  fullName: "", birth: { d: "", m: "", y: "" }, birthPlace: "", nationality: "", address: "",
  fatherName: "", motherName: "",
});

const PRODUCT_DEFS = [
  { id: "statuts", labelKey: "paiementCreation.pack.statuts", price: 49 },
  { id: "financial", labelKey: "paiementCreation.pack.financial", price: 29 },
  { id: "package", labelKey: "paiementCreation.pack.package", price: 89, recommended: true },
] as const;

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
  const { t, isRTL } = useLanguage();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = 2008; y >= 1940; y--) arr.push(y);
    return arr;
  }, []);
  return (
    <div className="grid grid-cols-3 gap-2" dir={isRTL ? "rtl" : "ltr"}>
      <div className="space-y-1">
        <Label className="text-xs">{t('paiementCreation.birth.day')}</Label>
        <Select value={value.d} onValueChange={(v) => onChange({ ...value, d: v })}>
          <SelectTrigger><SelectValue placeholder={t('paiementCreation.birth.dayPh')} /></SelectTrigger>
          <SelectContent className="max-h-64">
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <SelectItem key={d} value={String(d)}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('paiementCreation.birth.month')}</Label>
        <Select value={value.m} onValueChange={(v) => onChange({ ...value, m: v })}>
          <SelectTrigger><SelectValue placeholder={t('paiementCreation.birth.monthPh')} /></SelectTrigger>
          <SelectContent className="max-h-64">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <SelectItem key={m} value={String(m)}>{t(`paiementCreation.birth.month${m}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('paiementCreation.birth.year')}</Label>
        <Select value={value.y} onValueChange={(v) => onChange({ ...value, y: v })}>
          <SelectTrigger><SelectValue placeholder={t('paiementCreation.birth.yearPh')} /></SelectTrigger>
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
  const { t, isRTL } = useLanguage();
  const fmt = (key: string, vars: Record<string, string | number> = {}): string => {
    let out = t(key);
    for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
    return out;
  };
  const PRODUCTS: Array<{ id: string; label: string; price: number; recommended?: boolean }> =
    PRODUCT_DEFS.map(p => ({ id: p.id, label: t(p.labelKey), price: p.price, recommended: 'recommended' in p ? p.recommended : undefined }));

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

  // Plan de démarrage
  const [hasInvestMateriel, setHasInvestMateriel] = useState<"yes" | "no" | "">("");
  const [investMateriel, setInvestMateriel] = useState<number>(0);
  const [vehSituation, setVehSituation] = useState<"owned" | "toBuy" | "notNeeded" | "">("");
  const [vehMode, setVehMode] = useState<"cash" | "credit" | "leasing" | "">("");
  const [hasEmprunt, setHasEmprunt] = useState<"yes" | "no" | "">("");
  const [empMontant, setEmpMontant] = useState<number>(0);
  const [empAnnees, setEmpAnnees] = useState<number>(0);
  const [carnet, setCarnet] = useState<"acquired" | "promises" | "prospecting" | "">("");

  // Charges personnalisées
  const [remuDirigeant, setRemuDirigeant] = useState<number>(0);
  const [nbSalaries, setNbSalaries] = useState<number>(0);
  const [salaireMoyen, setSalaireMoyen] = useState<number>(0);
  const [vehiculeMensuel, setVehiculeMensuel] = useState<number>(0);
  const [loyerMensuel, setLoyerMensuel] = useState<number>(0);
  const [assurancesAnnuelles, setAssurancesAnnuelles] = useState<number>(1900);
  const [comptableAnnuel, setComptableAnnuel] = useState<number>(1200);
  const [achatsMateriaux, setAchatsMateriaux] = useState<number>(0);
  const [autresCharges, setAutresCharges] = useState<number>(1000);

  const [generating, setGenerating] = useState(false);
  const [generatedDocs, setGeneratedDocs] = useState<Array<{ label: string; filename: string; doc: ReturnType<typeof buildStatutsPdf> }>>([]);
  const [deficitDialogOpen, setDeficitDialogOpen] = useState(false);
  const [deficitAmount, setDeficitAmount] = useState<number>(0);


  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [isLoading, user, navigate]);

  // Ajuster automatiquement les associés lors du changement SASU <-> SARL
  useEffect(() => {
    setAssocies(prev => {
      if (companyType === "SASU") {
        // Famille SAS/SASU : par défaut 1 associé (SASU). L'utilisateur peut en ajouter → SAS.
        if (prev.length === 0) {
          return [{ ...emptyAssocie(100, true), percent: 100, isManager: true }];
        }
        return prev;
      } else {
        // Famille SARL/EURL : par défaut 2 associés (SARL). L'utilisateur peut réduire à 1 → EURL.
        if (prev.length === 0) {
          const first = { ...emptyAssocie(50, true), percent: 50, isManager: true };
          return [first, emptyAssocie(50, false)];
        }
        return prev;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyType]);

  const totalPercent = useMemo(
    () => associes.reduce((s, a) => s + (Number(a.percent) || 0), 0),
    [associes]
  );

  const effectiveForm = useMemo(
    () => effectiveFormOf(companyType, associes.length),
    [companyType, associes.length]
  );
  const effectiveHint: Record<string, string> = {
    EURL: t('paiementCreation.hint.EURL'),
    SARL: t('paiementCreation.hint.SARL'),
    SASU: t('paiementCreation.hint.SASU'),
    SAS: t('paiementCreation.hint.SAS'),
  };

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
  function addressHasCity(addr: string): boolean {
    // Siège social (France) : code postal 5 chiffres + ville (accents, tirets, apostrophes, espaces)
    const m = addr.match(/\b\d{5}\b[\s,\-]*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-']+)/);
    if (!m || !m[1]) return false;
    const city = m[1].trim();
    // Doit contenir au moins 2 lettres (hors tirets/apostrophes/espaces)
    const letters = city.replace(/[\s\-']/g, "");
    return letters.length >= 2;
  }
  function personalAddressValid(addr: string): boolean {
    // Adresse personnelle (peut être à l'étranger) : ≥10 chars, ≥1 chiffre, ≥1 mot de 2+ lettres
    const s = addr.trim();
    if (s.length < 10) return false;
    if (!/\d/.test(s)) return false;
    if (!/[A-Za-zÀ-ÿ\u0600-\u06FF]{2,}/.test(s)) return false;
    return true;
  }
  function validateStatuts(): string | null {
    if (!companyName.trim()) return t('paiementCreation.validation.companyNameRequired');
    if (!activity.trim()) return t('paiementCreation.validation.activityRequired');
    if (!address.trim()) return t('paiementCreation.validation.addressRequired');
    if (!addressHasCity(address)) return t('paiementCreation.validation.addressCityRequired');
    if (!signatureCity.trim()) return t('paiementCreation.validation.signatureCityRequired');
    for (let i = 0; i < associes.length; i++) {
      const a = associes[i];
      const isSingle = associes.length === 1;
      const label = isSingle
        ? t('paiementCreation.validation.associateSingleLabel')
        : fmt('paiementCreation.validation.associateNumbered', { n: i + 1 });
      if (!a.fullName.trim()) return `${label}: ${t('paiementCreation.validation.fullNameRequired')}`;
      if (!birthToStr(a.birth)) return `${label}: ${t('paiementCreation.validation.birthDateRequired')}`;
      if (!a.birthPlace.trim()) return `${label}: ${t('paiementCreation.validation.birthPlaceRequired')}`;
      if (!a.nationality.trim()) return `${label}: ${t('paiementCreation.validation.nationalityRequired')}`;
      if (/[0-9]/.test(a.nationality)) return `${label}: ${t('paiementCreation.validation.nationalityNoDigits')}`;
      if (!a.address.trim()) return `${label}: ${t('paiementCreation.validation.addressPersonalRequired')}`;
      if (!personalAddressValid(a.address)) return `${label}: ${t('paiementCreation.validation.addressPersonalIncomplete')}`;
      if (!a.fatherName.trim()) return `${label}: ${t('paiementCreation.validation.fatherNameRequired')}`;
      if (!a.motherName.trim()) return `${label}: ${t('paiementCreation.validation.motherNameRequired')}`;
    }
    if (associes.length > 1) {
      if (Math.round(totalPercent) !== 100) return fmt('paiementCreation.validation.percentSum', { p: totalPercent });
      const hasManager = associes.some(a => a.isManager) || extraManagers.length > 0;
      if (!hasManager) return t('paiementCreation.validation.needManager');
      for (let i = 0; i < extraManagers.length; i++) {
        const m = extraManagers[i];
        const label = fmt('paiementCreation.validation.managerNumbered', { n: i + 1 });
        if (!m.fullName.trim()) return `${label}: ${t('paiementCreation.validation.fullNameRequired')}`;
        if (!birthToStr(m.birth)) return `${label}: ${t('paiementCreation.validation.birthDateRequired')}`;
        if (!m.birthPlace.trim()) return `${label}: ${t('paiementCreation.validation.birthPlaceRequired')}`;
        if (!m.nationality.trim()) return `${label}: ${t('paiementCreation.validation.nationalityRequired')}`;
        if (/[0-9]/.test(m.nationality)) return `${label}: ${t('paiementCreation.validation.nationalityNoDigits')}`;
        if (!m.address.trim()) return `${label}: ${t('paiementCreation.validation.addressPersonalRequired')}`;
        if (!personalAddressValid(m.address)) return `${label}: ${t('paiementCreation.validation.addressPersonalIncomplete')}`;
        if (!m.fatherName.trim()) return `${label}: ${t('paiementCreation.validation.fatherNameRequired')}`;
        if (!m.motherName.trim()) return `${label}: ${t('paiementCreation.validation.motherNameRequired')}`;
      }
    }
    return null;
  }

  const handleGenerate = async (skipDeficitCheck = false) => {
    const needStatuts = product === "statuts" || product === "package";
    const needPrevi = product === "financial" || product === "package";

    if (needStatuts) {
      const err = validateStatuts();
      if (err) { toast.error(err); return; }
    }
    if (needPrevi && (!activity || !caEstime || caEstime <= 0)) {
      toast.error(t('paiementCreation.validation.needCA'));
      return;
    }
    if (needPrevi && isBtp && (!achatsMateriaux || achatsMateriaux <= 0)) {
      toast.error(t('paiementCreation.validation.needMaterials'));
      return;
    }

    // ─── Contrôle prévisionnel AVANT paiement : avertissement si résultat négatif ───
    // N'impacte ni les calculs ni le PDF. L'utilisateur peut toujours poursuivre.
    if (needPrevi && !skipDeficitCheck) {
      const check = computePrevisionnelQuick({
        type_societe: effectiveForm,
        activite: activity,
        capital,
        chiffre_affaires_estime: caEstime,
        is_btp: isBtp,
        remuneration_dirigeant_mensuelle: remuDirigeant,
        nb_salaries: nbSalaries,
        salaire_moyen_mensuel: salaireMoyen,
        vehicule_mensuel: vehiculeMensuel,
        loyer_mensuel: loyerMensuel,
        assurances_annuelles: assurancesAnnuelles,
        comptable_annuel: comptableAnnuel,
        achats_materiaux_annuels: achatsMateriaux,
        autres_charges_annuelles: autresCharges,
        investissement_materiel: hasInvestMateriel === "yes" ? investMateriel : 0,
        vehicule_situation: vehSituation || undefined,
        vehicule_mode: vehSituation === "toBuy" ? (vehMode || undefined) : undefined,
        emprunt_montant: hasEmprunt === "yes" ? empMontant : 0,
        emprunt_annees: hasEmprunt === "yes" ? empAnnees : 0,
        carnet_commandes: carnet || undefined,
      });
      if (check.isNegatif) {
        setDeficitAmount(Math.abs(Math.round(check.resultatAvantImpot)));
        setDeficitDialogOpen(true);
        return;
      }
    }


    setGenerating(true);
    const tid = toast.loading(t('paiementCreation.toast.translating'));
    try {
      // Traduction en parallèle de tous les champs susceptibles d'être en arabe
      const [
        companyNameFrRaw, activityFrRaw, addressFrRaw, signatureCityFrRaw,
      ] = await Promise.all([
        trIfAr(companyName), trIfAr(activity), trIfAr(address), trIfAr(signatureCity),
      ]);
      const companyNameFr = cleanSpaces(companyNameFrRaw);
      const activityFr = cleanSpaces(activityFrRaw);
      const addressFr = cleanSpaces(addressFrRaw);
      const signatureCityFr = cleanSpaces(signatureCityFrRaw);

      const associesFr: AssocieDetail[] = [];
      for (const a of associes) {
        const natRaw = stripDigits(await trIfAr(stripDigits(a.nationality), NATIONALITY_INSTRUCTION));
        const bpTr = await trIfAr(a.birthPlace);
        const fullName = await trIfAr(a.fullName);
        const address = await trIfAr(a.address);
        const fatherName = await trIfAr(a.fatherName);
        const motherName = await trIfAr(a.motherName);
        associesFr.push({
          gender: a.gender,
          fullName: cleanSpaces(fullName),
          birthDate: birthToStr(a.birth),
          birthPlace: cleanSpaces(formatBirthPlace(bpTr)),
          nationality: cleanSpaces(normalizeNationalityFeminine(natRaw)),
          address: cleanSpaces(address),
          fatherName: cleanSpaces(fatherName),
          motherName: cleanSpaces(motherName),
          percent: Number(a.percent) || 0,
          isManager: !!a.isManager,
        });
      }
      const extraManagersFr: Personne[] = [];
      for (const m of extraManagers) {
        const natRaw = stripDigits(await trIfAr(stripDigits(m.nationality), NATIONALITY_INSTRUCTION));
        const bpTr = await trIfAr(m.birthPlace);
        const fullName = await trIfAr(m.fullName);
        const address = await trIfAr(m.address);
        const fatherName = await trIfAr(m.fatherName);
        const motherName = await trIfAr(m.motherName);
        extraManagersFr.push({
          gender: m.gender,
          fullName: cleanSpaces(fullName),
          birthDate: birthToStr(m.birth),
          birthPlace: cleanSpaces(formatBirthPlace(bpTr)),
          nationality: cleanSpaces(normalizeNationalityFeminine(natRaw)),
          address: cleanSpaces(address),
          fatherName: cleanSpaces(fatherName),
          motherName: cleanSpaces(motherName),
        });
      }

      toast.dismiss(tid);

      const built: Array<{ label: string; filename: string; doc: ReturnType<typeof buildStatutsPdf> }> = [];

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
        built.push({ label: t('paiementCreation.doc.statuts'), filename: `statuts-${companyNameFr || "societe"}.pdf`, doc });

        // 3 documents complémentaires du dossier de création
        const isSAS = companyType === "SASU";
        const role: "gérant" | "Président" = isSAS ? "Président" : "gérant";
        const allDirigeants: Personne[] = [
          ...associesFr.filter(a => a.isManager),
          ...extraManagersFr,
        ];
        allDirigeants.forEach((p, idx) => {
          const attDoc = buildAttestationPdf({
            person: p,
            denomination: companyNameFr,
            role,
            signatureCity: signatureCityFr,
          });
          const suffix = allDirigeants.length > 1 ? `-${idx + 1}` : "";
          built.push({
            label: `${t('paiementCreation.doc.attestation')} — ${p.fullName || `#${idx + 1}`}`,
            filename: `attestation-non-condamnation${suffix}-${p.fullName || "dirigeant"}.pdf`,
            doc: attDoc,
          });
        });

        const beDoc = await buildBeneficiairesPdf({
          companyName: companyNameFr,
          associes: associesFr,
          extraManagers: extraManagersFr,
          companyType,
        });
        built.push({ label: t('paiementCreation.doc.beneficiaires'), filename: `beneficiaires-effectifs-${companyNameFr || "societe"}.pdf`, doc: beDoc });

        // Lettre banque — demande d'ouverture de compte de dépôt de capital
        const lettreDoc = buildLettreBanquePdf({
          companyName: companyNameFr,
          companyType,
          capital,
          address: addressFr,
          signatureCity: signatureCityFr,
          associes: associesFr,
          extraManagers: extraManagersFr,
        });
        built.push({ label: t('paiementCreation.doc.lettreBanque'), filename: `lettre-banque-depot-capital-${companyNameFr || "societe"}.pdf`, doc: lettreDoc });

        // PV de nomination du dirigeant
        const pvDoc = buildPvNominationPdf({
          companyName: companyNameFr,
          companyType,
          capital,
          address: addressFr,
          signatureCity: signatureCityFr,
          associes: associesFr,
          extraManagers: extraManagersFr,
        });
        built.push({ label: t('paiementCreation.doc.pvNomination'), filename: `pv-nomination-dirigeant-${companyNameFr || "societe"}.pdf`, doc: pvDoc });

        // Fiche de synthèse
        const ficheDoc = buildFicheSynthesePdf({
          companyName: companyNameFr,
          companyType,
          activity: activityFr,
          capital,
          address: addressFr,
          signatureCity: signatureCityFr,
          associes: associesFr,
          extraManagers: extraManagersFr,
        });
        built.push({ label: t('paiementCreation.doc.ficheSynthese'), filename: `fiche-synthese-${companyNameFr || "societe"}.pdf`, doc: ficheDoc });

        // Check-list finale bilingue (toujours utile après les statuts)
        const checklistDoc = await buildChecklistFinalePdf();
        built.push({ label: t('paiementCreation.doc.checklist'), filename: "checklist-finale-dossier.pdf", doc: checklistDoc });
      }
      if (needPrevi) {
        const doc = buildPrevisionnelPdf({
          type_societe: effectiveForm,
          activite: activityFr,
          capital,
          chiffre_affaires_estime: caEstime,
          is_btp: isBtp,
          remuneration_dirigeant_mensuelle: remuDirigeant,
          nb_salaries: nbSalaries,
          salaire_moyen_mensuel: salaireMoyen,
          vehicule_mensuel: vehiculeMensuel,
          loyer_mensuel: loyerMensuel,
          assurances_annuelles: assurancesAnnuelles,
          comptable_annuel: comptableAnnuel,
          achats_materiaux_annuels: achatsMateriaux,
          autres_charges_annuelles: autresCharges,
          investissement_materiel: hasInvestMateriel === "yes" ? investMateriel : 0,
          vehicule_situation: vehSituation || undefined,
          vehicule_mode: vehSituation === "toBuy" ? (vehMode || undefined) : undefined,
          emprunt_montant: hasEmprunt === "yes" ? empMontant : 0,
          emprunt_annees: hasEmprunt === "yes" ? empAnnees : 0,
          carnet_commandes: carnet || undefined,
        });
        built.push({ label: t('paiementCreation.doc.previsionnel'), filename: `previsionnel-${activityFr || "activite"}.pdf`, doc });
      }

      // Le guide de dépôt (document 3) est TOUJOURS offert, y compris pour les achats individuels
      const guideDoc = await buildGuideDepotPdf();
      built.push({ label: t('paiementCreation.doc.guide'), filename: "guide-depot-inpi.pdf", doc: guideDoc });

      setGeneratedDocs(built);
      toast.success(t('paiementCreation.toast.ready'));
    } catch (e) {
      toast.dismiss(tid);
      console.error("[PaiementCreation] generation error:", e);
      toast.error(t('paiementCreation.toast.error'));
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{t('paiementCreation.header.title')}</h1>
        <p className="text-muted-foreground">{t('paiementCreation.header.subtitle')}</p>
      </header>

      <Card className="p-5 space-y-3 bg-amber-50 dark:bg-amber-950/30 border-amber-500">
        <h2 className="text-lg font-bold">{t('paiementCreation.checklist.title')}</h2>
        <ul className="space-y-2 text-sm">
          <li>{t('paiementCreation.checklist.item1')}</li>
          <li>{t('paiementCreation.checklist.item2')}</li>
          <li>{t('paiementCreation.checklist.item3')}</li>
          <li>{t('paiementCreation.checklist.item4')}</li>
          <li>{t('paiementCreation.checklist.item5')}</li>
        </ul>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-bold">{t('paiementCreation.company.title')}</h2>

        <div className="space-y-2">
          <Label>{t('paiementCreation.company.name')}</Label>
          <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="ex: ANAFY BTP" />
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.company.type')}</Label>
          <RadioGroup value={companyType} onValueChange={(v) => setCompanyType(v as "SASU" | "SARL")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="SASU" /> SAS / SASU</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="SARL" /> SARL / EURL</label>
          </RadioGroup>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="secondary" className="text-sm">{fmt('paiementCreation.company.legalForm', { form: effectiveForm })}</Badge>
            <span className="text-xs text-muted-foreground">{effectiveHint[effectiveForm]}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.company.activity')}</Label>
          <Input value={activity} onChange={e => setActivity(e.target.value)} placeholder={t('paiementCreation.company.activityPlaceholder')} />
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.company.capital')}</Label>
          <Input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.company.address')}</Label>
          <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="12 rue de la Paix, 75002 Paris" dir="ltr" style={{ textAlign: "left" }} />
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.company.signatureCity')}</Label>
          <Input value={signatureCity} onChange={e => setSignatureCity(e.target.value)} placeholder="Paris" dir="ltr" style={{ textAlign: "left" }} />
        </div>
      </Card>

      {/* ─────── ASSOCIÉS ─────── */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {associes.length === 1 ? t('paiementCreation.associates.singleTitle') : t('paiementCreation.associates.multipleTitle')}
          </h2>
          <Button type="button" size="sm" variant="outline" onClick={addAssocie}>
            <Plus className="h-4 w-4 ml-1" /> {t('paiementCreation.associates.add')}
          </Button>
        </div>

        {associes.length > 1 && (
          <div className={`text-sm px-3 py-2 rounded ${Math.round(totalPercent) === 100 ? "bg-green-50 text-green-700 dark:bg-green-950/30" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30"}`}>
            {fmt('paiementCreation.associates.totalPercent', { p: totalPercent })} {Math.round(totalPercent) === 100 ? "✅" : t('paiementCreation.associates.required100')}
          </div>
        )}

        {associes.map((a, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {associes.length === 1 ? t('paiementCreation.associates.singleLabel') : fmt('paiementCreation.associates.numbered', { n: i + 1 })}
              </span>
              {associes.length > 1 && (
                <Button type="button" size="icon" variant="ghost" onClick={() => removeAssocie(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>


            <div className="space-y-2">
              <Label>{t('paiementCreation.associates.gender')}</Label>
              <RadioGroup value={a.gender} onValueChange={(v) => updateAssocie(i, "gender", v as Gender)} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="M" /> {t('paiementCreation.associates.genderM')}</label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="F" /> {t('paiementCreation.associates.genderF')}</label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>{t('paiementCreation.associates.fullName')}</Label>
              <Input value={a.fullName} onChange={e => updateAssocie(i, "fullName", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{t('paiementCreation.associates.birthDate')}</Label>
              <BirthDatePicker value={a.birth} onChange={(b) => updateAssocie(i, "birth", b)} />
            </div>

            <div className="space-y-2">
              <Label>{t('paiementCreation.associates.birthPlace')}</Label>
              <Input value={a.birthPlace} onChange={e => updateAssocie(i, "birthPlace", e.target.value)} placeholder="Le Caire, Égypte" />
            </div>

            <div className="space-y-2">
              <Label>{t('paiementCreation.associates.nationality')}</Label>
              <Input value={a.nationality} onChange={e => updateAssocie(i, "nationality", e.target.value)} placeholder={t('paiementCreation.associates.nationalityPh')} />
            </div>

            <div className="space-y-2">
              <Label>{t('paiementCreation.associates.address')}</Label>
              <Textarea value={a.address} onChange={e => updateAssocie(i, "address", e.target.value)} dir="ltr" style={{ textAlign: "left" }} />
            </div>

            <div className="space-y-2">
              <Label>{t('paiementCreation.associates.fatherName')}</Label>
              <Input value={a.fatherName} onChange={e => updateAssocie(i, "fatherName", e.target.value)} placeholder="Ahmed Mohamed" />
            </div>

            <div className="space-y-2">
              <Label>{t('paiementCreation.associates.motherName')}</Label>
              <Input value={a.motherName} onChange={e => updateAssocie(i, "motherName", e.target.value)} placeholder="Fatma Ali" />
            </div>

            {associes.length > 1 && (
              <div className="space-y-2">
                <Label>{t('paiementCreation.associates.percent')}</Label>
                <Input type="number" min={0} max={100} value={a.percent}
                  onChange={e => updateAssocie(i, "percent", Number(e.target.value))} dir="ltr" lang="fr" />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <Checkbox
                checked={a.isManager}
                disabled={associes.length === 1}
                onCheckedChange={(v) => updateAssocie(i, "isManager", Boolean(v))}
              />
              <span>{fmt('paiementCreation.associates.isManager', { role: companyType === "SASU" ? "Président" : "Gérant" })}</span>
            </label>
          </div>
        ))}

        {associes.length > 1 && (
          <>
            <div className="flex items-center justify-between pt-4 border-t">
              <h3 className="font-semibold">{t('paiementCreation.managers.sectionTitle')}</h3>
              <Button type="button" size="sm" variant="outline" onClick={addManager}>
                <UserPlus className="h-4 w-4 ml-1" /> {t('paiementCreation.managers.add')}
              </Button>
            </div>
            {extraManagers.map((m, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{fmt('paiementCreation.managers.numbered', { n: i + 1 })}</span>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeManager(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>{t('paiementCreation.associates.gender')}</Label>
                  <RadioGroup value={m.gender} onValueChange={(v) => updateManager(i, "gender", v as Gender)} className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="M" /> {t('paiementCreation.associates.genderM')}</label>
                    <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="F" /> {t('paiementCreation.associates.genderF')}</label>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>{t('paiementCreation.associates.fullName')}</Label>
                  <Input value={m.fullName} onChange={e => updateManager(i, "fullName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('paiementCreation.associates.birthDate')}</Label>
                  <BirthDatePicker value={m.birth} onChange={(b) => updateManager(i, "birth", b)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('paiementCreation.associates.birthPlace')}</Label>
                  <Input value={m.birthPlace} onChange={e => updateManager(i, "birthPlace", e.target.value)} placeholder="Le Caire, Égypte" />
                </div>
                <div className="space-y-2">
                  <Label>{t('paiementCreation.associates.nationality')}</Label>
                  <Input value={m.nationality} onChange={e => updateManager(i, "nationality", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('paiementCreation.associates.address')}</Label>
                  <Textarea value={m.address} onChange={e => updateManager(i, "address", e.target.value)} dir="ltr" style={{ textAlign: "left" }} />
                </div>
                <div className="space-y-2">
                  <Label>{t('paiementCreation.associates.fatherName')}</Label>
                  <Input value={m.fatherName} onChange={e => updateManager(i, "fatherName", e.target.value)} placeholder="Ahmed Mohamed" />
                </div>
                <div className="space-y-2">
                  <Label>{t('paiementCreation.associates.motherName')}</Label>
                  <Input value={m.motherName} onChange={e => updateManager(i, "motherName", e.target.value)} placeholder="Fatma Ali" />
                </div>
              </div>
            ))}
          </>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-bold">{t('paiementCreation.startup.title')}</h2>

        {/* Q1 — Investissement matériel */}
        <div className="space-y-2">
          <Label>{t('paiementCreation.startup.equipmentQ')}</Label>
          <RadioGroup value={hasInvestMateriel} onValueChange={(v) => setHasInvestMateriel(v as "yes" | "no")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" /> {t('paiementCreation.startup.yes')}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" /> {t('paiementCreation.startup.no')}</label>
          </RadioGroup>
          {hasInvestMateriel === "yes" && (
            <div className="pt-2 space-y-2">
              <Label>{t('paiementCreation.startup.equipmentAmount')}</Label>
              <Input type="number" inputMode="decimal" value={investMateriel}
                onChange={e => setInvestMateriel(Number(e.target.value))} dir="ltr" lang="fr" />
            </div>
          )}
        </div>

        {/* Q2 — Véhicule */}
        <div className="space-y-2 pt-3 border-t">
          <Label>{t('paiementCreation.startup.vehicleQ')}</Label>
          <RadioGroup value={vehSituation} onValueChange={(v) => setVehSituation(v as "owned" | "toBuy" | "notNeeded")} className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="owned" /> {t('paiementCreation.startup.vehOwned')}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="toBuy" /> {t('paiementCreation.startup.vehToBuy')}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="notNeeded" /> {t('paiementCreation.startup.vehNotNeeded')}</label>
          </RadioGroup>
          {vehSituation === "owned" && (
            <p className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 p-2 rounded">
              {t('paiementCreation.startup.vehOwnedHint')}
            </p>
          )}
          {vehSituation === "toBuy" && (
            <div className="pt-2 space-y-3">
              <div className="space-y-2">
                <Label>{t('paiementCreation.startup.vehModeQ')}</Label>
                <RadioGroup value={vehMode} onValueChange={(v) => setVehMode(v as "cash" | "credit" | "leasing")} className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="cash" /> {t('paiementCreation.startup.vehCash')}</label>
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="credit" /> {t('paiementCreation.startup.vehCredit')}</label>
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="leasing" /> {t('paiementCreation.startup.vehLeasing')}</label>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>{t('paiementCreation.startup.vehMonthlyCost')}</Label>
                <Input type="number" inputMode="decimal" value={vehiculeMensuel}
                  onChange={e => setVehiculeMensuel(Number(e.target.value))} dir="ltr" lang="fr" />
                <p className="text-xs text-muted-foreground">{t('paiementCreation.startup.vehMonthlyHint')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Q3 — Emprunt bancaire */}
        <div className="space-y-2 pt-3 border-t">
          <Label>{t('paiementCreation.startup.loanQ')}</Label>
          <RadioGroup value={hasEmprunt} onValueChange={(v) => setHasEmprunt(v as "yes" | "no")} className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="yes" /> {t('paiementCreation.startup.yes')}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="no" /> {t('paiementCreation.startup.no')}</label>
          </RadioGroup>
          {hasEmprunt === "yes" && (
            <div className="pt-2 space-y-3">
              <div className="space-y-2">
                <Label>{t('paiementCreation.startup.loanAmount')}</Label>
                <Input type="number" inputMode="decimal" value={empMontant}
                  onChange={e => setEmpMontant(Number(e.target.value))} dir="ltr" lang="fr" />
              </div>
              <div className="space-y-2">
                <Label>{t('paiementCreation.startup.loanYears')}</Label>
                <Input type="number" inputMode="decimal" value={empAnnees}
                  onChange={e => setEmpAnnees(Number(e.target.value))} dir="ltr" lang="fr" />
                <p className="text-xs text-muted-foreground">{t('paiementCreation.startup.loanHint')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Q4 — Carnet de commandes */}
        <div className="space-y-2 pt-3 border-t">
          <Label>{t('paiementCreation.startup.carnetQ')}</Label>
          <RadioGroup value={carnet} onValueChange={(v) => setCarnet(v as "acquired" | "promises" | "prospecting")} className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="acquired" /> {t('paiementCreation.startup.carnetAcquired')}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="promises" /> {t('paiementCreation.startup.carnetPromises')}</label>
            <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="prospecting" /> {t('paiementCreation.startup.carnetProspecting')}</label>
          </RadioGroup>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-bold">{t('paiementCreation.finance.title')}</h2>

        <div className="space-y-2">
          <Label>{t('paiementCreation.finance.ca')}</Label>
          <Input type="number" inputMode="decimal" value={caEstime}
            onChange={e => setCaEstime(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.finance.remuneration')}</Label>
          <Input type="number" inputMode="decimal" value={remuDirigeant}
            onChange={e => setRemuDirigeant(Number(e.target.value))} dir="ltr" lang="fr" />
          <p className="text-xs text-muted-foreground">{t('paiementCreation.finance.remunerationHint')}</p>
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.finance.employees')}</Label>
          <Input type="number" inputMode="decimal" value={nbSalaries}
            onChange={e => setNbSalaries(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        {nbSalaries > 0 && (
          <div className="space-y-2">
            <Label>{t('paiementCreation.finance.avgSalary')}</Label>
            <Input type="number" inputMode="decimal" value={salaireMoyen}
              onChange={e => setSalaireMoyen(Number(e.target.value))} dir="ltr" lang="fr" />
          </div>
        )}

        <div className="space-y-2">
          <Label>{t('paiementCreation.finance.vehicleMonthly')}</Label>
          <Input type="number" inputMode="decimal" value={vehiculeMensuel}
            onChange={e => setVehiculeMensuel(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.finance.rent')}</Label>
          <Input type="number" inputMode="decimal" value={loyerMensuel}
            onChange={e => setLoyerMensuel(Number(e.target.value))} dir="ltr" lang="fr" />
          <p className="text-xs text-muted-foreground">{t('paiementCreation.finance.rentHint')}</p>
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.finance.insurance')}</Label>
          <Input type="number" inputMode="decimal" value={assurancesAnnuelles}
            onChange={e => setAssurancesAnnuelles(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.finance.accountant')}</Label>
          <Input type="number" inputMode="decimal" value={comptableAnnuel}
            onChange={e => setComptableAnnuel(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <div className="space-y-2">
          <Label>{fmt('paiementCreation.finance.materials', { req: isBtp ? '*' : '' })}</Label>
          <Input type="number" inputMode="decimal" value={achatsMateriaux}
            onChange={e => setAchatsMateriaux(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <div className="space-y-2">
          <Label>{t('paiementCreation.finance.other')}</Label>
          <Input type="number" inputMode="decimal" value={autresCharges}
            onChange={e => setAutresCharges(Number(e.target.value))} dir="ltr" lang="fr" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer pt-2 border-t">
          <Checkbox checked={isBtp} onCheckedChange={(v) => setIsBtp(Boolean(v))} />
          <span>{t('paiementCreation.finance.isBtp')}</span>
        </label>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-xl font-bold">{t('paiementCreation.pack.title')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRODUCTS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProduct(p.id)}
              className={`relative text-right border-2 rounded-xl p-4 transition ${product === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            >
              {p.recommended && <Badge className="absolute -top-2 right-2">{t('paiementCreation.pack.bestValue')}</Badge>}
              <div className="text-2xl mb-2">{p.id === "statuts" ? <FileText /> : p.id === "financial" ? <BarChart3 /> : <Package />}</div>
              <div className="font-semibold text-sm mb-1">{p.label}</div>
              <div className="text-lg font-bold">{p.price}€</div>
            </button>
          ))}
        </div>
      </Card>

      <Button onClick={() => handleGenerate(false)} disabled={generating} size="lg" className="w-full">
        {generating ? <><Loader2 className="ml-2 animate-spin h-5 w-5" /> {t('paiementCreation.cta.generating')}</> : t('paiementCreation.cta.generate')}
      </Button>

      <AlertDialog open={deficitDialogOpen} onOpenChange={setDeficitDialogOpen}>
        <AlertDialogContent dir="ltr">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Prévisionnel déficitaire</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-foreground/80">
                <p>Votre prévisionnel fait apparaître un résultat estimé négatif de :</p>
                <p className="text-xl font-bold text-destructive">- {deficitAmount.toLocaleString('fr-FR')} €</p>
                <p>Ce résultat ne bloque pas la création de votre société.</p>
                <p>Nous vous recommandons néanmoins de vérifier vos hypothèses (chiffre d'affaires, charges, rémunération, investissements…) avant de poursuivre.</p>
                <p>Vous pouvez modifier vos informations ou continuer malgré cet avertissement.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Modifier mes données</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeficitDialogOpen(false);
                void handleGenerate(true);
              }}
            >
              Continuer malgré tout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {generatedDocs.length > 0 && (
        <Card className="p-5 space-y-3 bg-green-50 dark:bg-green-950/30 border-green-500">
          <h2 className="text-xl font-bold">{t('paiementCreation.result.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('paiementCreation.result.hint')}</p>
          <div className="space-y-2">
            {generatedDocs.map((d, i) => (
              <Button
                key={i}
                type="button"
                variant="outline"
                className="w-full justify-between text-right"
                onClick={() => savePdfSafely(d.doc, d.filename)}
              >
                <span className="text-xs opacity-60">{t('paiementCreation.result.download')}</span>
                <span className="font-semibold">{d.label}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
