// SmartDevisPage - v4.0 Simple Flow
// Step 1: Saisie texte arabe + photo optionnelle
// Step 2: 1 appel analyze_image
// Step 3: Affichage direct des items dans formulaire éditable
// Step 4: Bouton final → /pro/invoice-creator
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Camera, Loader2, Plus, Sparkles, Trash2, X, Send, Languages } from 'lucide-react';
import VoiceInputButton from '@/components/shared/VoiceInputButton';
import { extractDocxWithTables, type DocxTable } from '@/lib/docxExtractor';

const INTRO_TIP_KEY = 'smart_devis_intro_tip_v1';
const introTipTitleAr = '💡 كيف تستخدم الديڤي الذكي ؟';
const introTipTextAr = `① اكتب أو اتكلم بالعربي وصف الشغل اللي عايزه
   مثال : 'دهان حيطان وسقف ٢٠٠ متر بنتيرة أزرق'
② ممكن تضيف الأسعار مباشرة
   مثال : 'دهان حيطان بـ ٢٢ يورو المتر'
③ ممكن تحدد الوحدة
   مثال : 'تركيب باركيه فورفيه' أو 'سباكة ٣ نقط'
④ بعد التحليل تقدر تعدل أي حاجة بإيدك
⑤ اضغط التالي لإنشاء الديڤي`;
const introTipTitleFr = '💡 Comment utiliser le Devis intelligent ?';
const introTipTextFr = `① Décrivez ou dictez le travail souhaité (français ou arabe)
   Ex : « Peinture murs et plafond 200 m² peinture bleue »
② Vous pouvez indiquer les prix directement
   Ex : « Peinture murs à 22 € le m² »
③ Vous pouvez préciser l'unité
   Ex : « Pose parquet forfait » ou « Plomberie 3 points »
④ Après l'analyse, vous pouvez ajuster chaque ligne manuellement
⑤ Appuyez sur Suivant pour générer le devis`;

// ────────────────────────────────────────────────────────────────────────────
// Parseur LOCAL des lignes déjà structurées (issues de l'extraction documents)
// Format attendu :
//   LOT : NOM DU LOT
//   Désignation | 310 | m²
//   Désignation | À confirmer |
// Aucun appel IA : les désignations, quantités et unités sont conservées telles
// quelles. Aucune quantité ni prix n'est inventé.
// ────────────────────────────────────────────────────────────────────────────
interface ParsedStructuredItem {
  designation_fr: string;
  quantity: number | null;
  unit: string;
  lot?: string;
}

const parseFrNumber = (raw: string): number | null => {
  const cleaned = raw
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parseStructuredDevisText = (text: string): ParsedStructuredItem[] | null => {
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  let hasLot = false;
  let currentLot: string | undefined;
  const items: ParsedStructuredItem[] = [];

  for (const line of rawLines) {
    const lotMatch = line.match(/^LOT\s*[:：]\s*(.+)$/i);
    if (lotMatch) {
      hasLot = true;
      currentLot = lotMatch[1].trim() || undefined;
      continue;
    }

    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 2) return null; // ligne non structurée → texte libre

    const designation = parts[0];
    if (!designation) return null;

    const qtyRaw = parts[1] || '';
    const unitRaw = (parts[2] || '').trim();

    let quantity: number | null = null;
    if (qtyRaw && qtyRaw !== '—' && !/^à\s*confirmer$/i.test(qtyRaw)) {
      quantity = parseFrNumber(qtyRaw);
      if (quantity === null) return null; // quantité illisible → on laisse l'IA
    }

    items.push({
      designation_fr: designation,
      quantity,
      unit: quantity === null ? '' : unitRaw,
      lot: currentLot,
    });
  }

  if (!hasLot || items.length === 0) return null;
  return items;
};


interface UploadedImage {
  id: string;
  data: string; // base64 (no prefix)
  name: string;
  preview: string; // data URL for thumbnail
  mimeType: string;
}

interface LineItem {
  id: string;
  designation_fr: string;
  designation_ar: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lot?: string;
  /** Provenance (ex. 'btp_facts') : verrouille l'unité en aval. */
  sourceOrigin?: string;
  /** Fourniture explicitement à la charge du client. */
  clientSupplied?: boolean;
}

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ALLOWED_SCAN_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const EXT_TO_SCAN_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const normalizeScanMimeType = (file: File): string | null => {
  const rawType = (file.type || '').toLowerCase();
  const canonicalType = rawType === 'image/jpg' ? 'image/jpeg' : rawType;
  if (ALLOWED_SCAN_TYPES.includes(canonicalType)) return canonicalType;
  const ext = (file.name || '').slice((file.name || '').lastIndexOf('.')).toLowerCase();
  return EXT_TO_SCAN_MIME[ext] || null;
};

// ── Import DOCX (devis Word) ────────────────────────────────────────────────
// Réutilise strictement l'architecture validée : extractDocxWithTables →
// sourceRows → btp-analysis-job (kind docx_quote_batch) → quote_items.
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_JOB_KEY = 'smart_devis_docx_job_v1';

/** Reconnaissance DOCX par MIME OU extension (Android : type vide/octet-stream). */
const isDocxFile = (file: File): boolean => {
  const type = (file.type || '').toLowerCase();
  if (type === DOCX_MIME) return true;
  return (file.name || '').toLowerCase().endsWith('.docx');
};

type DocxSourceRow = {
  sourceLineIndex: number;
  tableIndex: number;
  rowIndex: number;
  headers: string[];
  cells: string[];
};

// Classification STRUCTURELLE des tableaux Word : seule la structure des
// colonnes de l'en-tête décide. Aucun mot-clé de cellule ne supprime un
// tableau, et aucun tableau de prestations valide n'est écarté.
const normHeader = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const HEADER_DESIGNATION = /(designation|description|prestation|libelle|ouvrage|poste|travaux)/;
const HEADER_QTY = /(quantite|quantites|qte|qty|nombre)/;
const HEADER_UNIT = /(^u$|^unite$|^unit$|^unite\b|\bunite\b|^u\.|^un\.)/;
const HEADER_PRICE = /(prix unitaire|p\.?\s?u\.?(\s|$|ht)|prix ht|prix)/;
const HEADER_TOTAL = /(total|montant)/;

/** Analyse de l'en-tête d'un tableau : colonne désignation + colonnes de devis. */
const classifyHeaderRow = (cells: string[]) => {
  const norm = cells.map(normHeader);
  const hasDesignation = norm.some((c) => HEADER_DESIGNATION.test(c));
  const kinds = new Set<string>();
  norm.forEach((c) => {
    if (HEADER_QTY.test(c)) kinds.add('qty');
    if (HEADER_UNIT.test(c)) kinds.add('unit');
    if (HEADER_PRICE.test(c)) kinds.add('price');
    if (HEADER_TOTAL.test(c)) kinds.add('total');
  });
  return { hasDesignation, quoteColumns: kinds.size, isHeaderLike: hasDesignation || kinds.size >= 2 };
};

type DocxRowsResult =
  | { status: 'ok'; rows: DocxSourceRow[]; tablesKept: number[]; tablesIgnored: number[] }
  | { status: 'ambiguous'; ambiguousTable: number }
  | { status: 'empty' };

/**
 * Règle déterministe et structurelle :
 * - tableau de prestations = en-tête avec une colonne de désignation ET au
 *   moins deux colonnes typiques de devis (quantité, unité, PU, total) ;
 * - tableau récapitulatif (ex. Lot | Nombre de lignes | Sous-total HT) =
 *   aucune colonne de désignation → exclu, sans jamais se fonder sur les
 *   mots « total », « TVA » ou « sous-total » présents dans les cellules ;
 * - continuation d'un tableau de prestations (aucun en-tête répété, même
 *   nombre de colonnes) → en-têtes précédents réutilisés, TOUTES les lignes
 *   conservées, y compris la première ;
 * - plusieurs tableaux de prestations valides → tous conservés ;
 * - structure réellement ambiguë → arrêt, sans deviner.
 */
const buildDocxSourceRows = (tables: DocxTable[]): DocxRowsResult => {
  const rows: DocxSourceRow[] = [];
  const tablesKept: number[] = [];
  const tablesIgnored: number[] = [];
  let lastQuoteHeaders: string[] | null = null;
  let sourceLineIndex = 0;

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const nonEmpty = (tables[tableIndex].rows || []).filter((r) =>
      (r.cells || []).some((c) => c.trim().length > 0),
    );
    if (nonEmpty.length === 0) continue;

    const firstInfo = classifyHeaderRow(nonEmpty[0].cells);

    // a) En-tête de prestations explicite : désignation + ≥ 2 colonnes de devis.
    if (firstInfo.hasDesignation && firstInfo.quoteColumns >= 2) {
      if (nonEmpty.length < 2) { tablesIgnored.push(tableIndex); continue; }
      const headers = nonEmpty[0].cells;
      lastQuoteHeaders = headers;
      tablesKept.push(tableIndex);
      for (let i = 1; i < nonEmpty.length; i++) {
        rows.push({
          sourceLineIndex: sourceLineIndex++,
          tableIndex,
          rowIndex: i,
          headers,
          cells: nonEmpty[i].cells,
        });
      }
      continue;
    }

    // b) Continuation : aucun en-tête répété, même nombre de colonnes que le
    //    tableau de prestations précédent → toutes les lignes sont conservées.
    if (
      lastQuoteHeaders &&
      !firstInfo.isHeaderLike &&
      nonEmpty.every((r) => (r.cells || []).length === lastQuoteHeaders!.length)
    ) {
      tablesKept.push(tableIndex);
      for (let i = 0; i < nonEmpty.length; i++) {
        rows.push({
          sourceLineIndex: sourceLineIndex++,
          tableIndex,
          rowIndex: i,
          headers: lastQuoteHeaders,
          cells: nonEmpty[i].cells,
        });
      }
      continue;
    }

    // c) Tableau sans colonne de désignation : structure de synthèse
    //    (récapitulatif, totaux) → exclu des prestations.
    if (!firstInfo.hasDesignation) {
      tablesIgnored.push(tableIndex);
      continue;
    }

    // d) Désignation présente mais structure de devis incomplète → ambigu.
    return { status: 'ambiguous', ambiguousTable: tableIndex };
  }

  if (rows.length === 0) return { status: 'empty' };
  return { status: 'ok', rows, tablesKept, tablesIgnored };
};

const SmartDevisPage = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userText, setUserText] = useState('');
  const [rawArabic, setRawArabic] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [subjectFr, setSubjectFr] = useState('');
  const [showIntroTip, setShowIntroTip] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(INTRO_TIP_KEY) !== 'true'; } catch { return true; }
  });
  const dismissIntroTip = () => {
    setShowIntroTip(false);
    try { localStorage.setItem(INTRO_TIP_KEY, 'true'); } catch {}
  };

  // Hydrate depuis l'analyseur documentaire universel (P4)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('smart_devis_prefill_v1');
      if (!raw) return;
      sessionStorage.removeItem('smart_devis_prefill_v1');
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      if (items.length === 0) return;
      // Aucune valeur artificielle : ni quantité « 1 », ni unité « u » par défaut.
      const mapped: LineItem[] = items.map((it: any, idx: number) => ({
        id: `prefill-${Date.now()}-${idx}`,
        designation_fr: String(it.designation_fr || '').trim(),
        designation_ar: String(it.designation_ar || '').trim(),
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : ('' as unknown as number),
        unit: typeof it.unit === 'string' ? it.unit.trim() : '',
        unitPrice: Number(it.unitPrice) > 0 ? Number(it.unitPrice) : 0,
        lot: typeof it.lot === 'string' && it.lot.trim() ? it.lot.trim() : undefined,
        sourceOrigin: typeof it.sourceOrigin === 'string' ? it.sourceOrigin : undefined,
        clientSupplied: it.clientSupplied === true ? true : undefined,
      }));
      setLineItems(mapped);
      if (parsed?.subject) setSubjectFr(String(parsed.subject));
      toast({ title: '✅ Lignes importées depuis l\'analyseur documentaire' });
    } catch (e) {
      console.error('[SmartDevis] prefill hydration failed:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (rawArabic.trim()) handleAnalyze();
    }, 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawArabic]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(f);
        });
        const compressedDataUrl = await compressImage(dataUrl);
        const base64 = compressedDataUrl.replace(/^data:[^;]+;base64,/, '');
        setImages(prev => [...prev, {
          id: generateId(),
          data: base64,
          name: f.name,
          preview: compressedDataUrl,
          mimeType: 'image/jpeg',
        }]);
      } catch (e) {
        console.error('[SmartDevis] image error:', e);
      }
    }
  }, []);

  const removeImage = (id: string) => setImages(prev => prev.filter(i => i.id !== id));

  // ── Job DOCX persistant : la base est la seule source de vérité ───────────
  const [docxJobId, setDocxJobId] = useState<string | null>(null);
  const [docxJobStatus, setDocxJobStatus] = useState<string | null>(null);
  const [docxProgress, setDocxProgress] = useState(0);

  const applyDocxJob = useCallback((job: any): boolean => {
    const final = job?.step_results?.final;
    if (!final || final.kind !== 'quote_items' || !Array.isArray(final.data?.items)) return false;
    const items: any[] = final.data.items;
    // Aucune valeur artificielle : aucun prix réellement lu n'est remplacé.
    const mapped: LineItem[] = items
      .filter((it) => typeof it?.description === 'string' && it.description.trim().length > 0)
      .map((it, idx) => ({
        id: `docx-${job.id}-${idx}`,
        designation_fr: String(it.description).trim(),
        designation_ar: '',
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : ('' as unknown as number),
        unit: typeof it.unit === 'string' ? it.unit.trim() : '',
        unitPrice: Number(it.unitPrice) > 0 ? Number(it.unitPrice) : 0,
        lot: typeof it.lot === 'string' && it.lot.trim() ? it.lot.trim() : undefined,
      }));
    if (mapped.length === 0) return false;
    setLineItems(mapped);
    toast({ title: isRTL ? '✅ تم استخراج بنود الوثيقة' : `✅ ${mapped.length} ligne(s) importée(s) du document Word` });
    return true;
  }, [toast, isRTL]);

  // Reprise : au retour sur la page, le job est retrouvé depuis la base.
  useEffect(() => {
    let alive = true;
    (async () => {
      let stored: string | null = null;
      try { stored = localStorage.getItem(DOCX_JOB_KEY); } catch { stored = null; }
      if (!stored) return;
      const { data, error } = await supabase
        .from('btp_analysis_jobs')
        .select('id, status, progress, step_results, error_message')
        .eq('id', stored)
        .maybeSingle();
      if (!alive) return;
      if (error || !data) { console.error('[SmartDevis][docx-job] lookup', error?.message); return; }
      setDocxJobStatus(data.status);
      setDocxProgress(Number(data.progress) || 0);
      if (data.status === 'completed') {
        applyDocxJob(data);
        try { localStorage.removeItem(DOCX_JOB_KEY); } catch {}
      } else if (data.status === 'queued' || data.status === 'running') {
        setDocxJobId(data.id);
      } else {
        try { localStorage.removeItem(DOCX_JOB_KEY); } catch {}
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Observation 3 s : quitter la page n'annule rien côté serveur.
  useEffect(() => {
    if (!docxJobId || (docxJobStatus !== 'queued' && docxJobStatus !== 'running')) return;
    let alive = true;
    const timer = setInterval(async () => {
      const { data, error } = await supabase
        .from('btp_analysis_jobs')
        .select('id, status, progress, step_results, error_message')
        .eq('id', docxJobId)
        .maybeSingle();
      if (!alive) return;
      if (error || !data) { console.error('[SmartDevis][docx-job] poll', error?.message); return; }
      setDocxJobStatus(data.status);
      setDocxProgress(Number(data.progress) || 0);
      if (data.status === 'completed') {
        applyDocxJob(data);
        setDocxJobId(null);
        try { localStorage.removeItem(DOCX_JOB_KEY); } catch {}
      } else if (data.status === 'failed') {
        console.error('[SmartDevis][docx-job] failed', data.error_message);
        setDocxJobId(null);
        try { localStorage.removeItem(DOCX_JOB_KEY); } catch {}
        toast({
          variant: 'destructive',
          title: isRTL ? 'تعذّر استخراج الوثيقة' : 'Extraction du document impossible',
        });
      }
    }, 3000);
    return () => { alive = false; clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docxJobId, docxJobStatus, applyDocxJob]);

  /** DOCX → sourceRows → btp-analysis-job (kind docx_quote_batch). */
  const handleDocxFile = useCallback(async (file: File) => {
    setScanning(true);
    try {
      const structured = await extractDocxWithTables(file);
      const analysis = buildDocxSourceRows(structured.tables || []);
      if (analysis.status === 'ambiguous') {
        // Structure ambiguë : arrêt, aucune interprétation devinée.
        console.error('[SmartDevis][docx] tableau ambigu', analysis.ambiguousTable);
        toast({
          variant: 'destructive',
          title: isRTL ? 'جدول غير واضح في الوثيقة' : 'Structure de tableau ambiguë',
          description: isRTL
            ? `الجدول رقم ${analysis.ambiguousTable + 1} غير واضح — التحليل موقوف`
            : `Le tableau n°${analysis.ambiguousTable + 1} n'a pas une structure de devis claire. Traitement arrêté.`,
        });
        return;
      }
      if (analysis.status !== 'ok' || analysis.rows.length === 0) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'لا يوجد جدول بنود في الوثيقة' : 'Aucun tableau de prestations trouvé dans ce document',
        });
        return;
      }
      const plan = analysis;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error(isRTL ? 'الجلسة منتهية، سجّل الدخول من جديد' : 'Session expirée, reconnecte-toi');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/btp-analysis-job?mode=create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mode: 'create',
            kind: 'docx_quote_batch',
            language: isRTL ? 'ar' : 'fr',
            fileName: file.name,
            sourceRows: plan.rows,
          }),
        },
      );
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.jobId) {
        console.error('[SmartDevis][docx-job] create', resp.status, body);
        throw new Error(body?.error || `HTTP ${resp.status}`);
      }
      try { localStorage.setItem(DOCX_JOB_KEY, body.jobId); } catch {}
      setDocxJobId(body.jobId);
      setDocxJobStatus(body.status || 'queued');
      setDocxProgress(0);
      toast({
        title: isRTL ? '⏳ جاري تحليل الوثيقة' : 'Analyse du document Word en cours',
        description: isRTL
          ? `${plan.rows.length} بند — ممكن تسيب الصفحة، الشغل مكمل`
          : `${plan.rows.length} ligne(s) détectée(s). Vous pouvez quitter la page, le traitement continue.`,
      });
    } catch (e: any) {
      console.error('[SmartDevis] docx error:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في تحليل الوثيقة' : 'Erreur d\'analyse',
        description: e?.message,
      });
    } finally {
      setScanning(false);
    }
  }, [toast, isRTL]);

  const handleScanFile = useCallback(async (file: File | null) => {
    if (!file) return;
    if (isDocxFile(file)) {
      await handleDocxFile(file);
      return;
    }
    let mimeType = normalizeScanMimeType(file);
    if (!mimeType) {
      toast({ variant: 'destructive', title: isRTL ? 'نوع الملف غير مدعوم' : 'Type de fichier non supporté' });
      return;
    }
    setScanning(true);
    try {
      let base64: string;
      if (mimeType.startsWith('image/')) {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
        const compressed = await compressImage(dataUrl);
        base64 = compressed.replace(/^data:[^;]+;base64,/, '');
        mimeType = 'image/jpeg';
      } else {
        // PDF
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(file);
        });
        base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error(isRTL ? 'الجلسة منتهية، سجّل الدخول من جديد' : 'Session expirée, reconnecte-toi');
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/scan-devis-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ fileData: base64, mimeType }),
      });

      let data: any = null;
      const rawText = await resp.text();
      try { data = rawText ? JSON.parse(rawText) : null; } catch { /* keep rawText */ }

      if (!resp.ok) {
        const msg = (data && (data.error || data.message)) || rawText || `HTTP ${resp.status}`;
        console.error('[SmartDevis] scan-devis-document HTTP', resp.status, msg);
        throw new Error(String(msg));
      }


      const items = Array.isArray(data?.items) ? data.items : [];
      const mapped: LineItem[] = items.map((it: any, idx: number) => ({
        id: `scan-${Date.now()}-${idx}`,
        designation_fr: String(it.designation_fr || '').trim(),
        designation_ar: String(it.designation_ar || '').trim(),
        // Aucune valeur artificielle : pas de quantité « 1 » ni d'unité « u » par défaut.
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : ('' as unknown as number),
        unit: typeof it.unit === 'string' ? it.unit.trim() : '',
        unitPrice: Number(it.unitPrice) > 0 ? Number(it.unitPrice) : 0,
        lot: typeof it.lot === 'string' && it.lot.trim() ? it.lot.trim() : undefined,
        sourceOrigin: typeof it.sourceOrigin === 'string' ? it.sourceOrigin : undefined,
        clientSupplied: it.clientSupplied === true ? true : undefined,
      }));

      if (mapped.length === 0) {
        toast({ variant: 'destructive', title: isRTL ? 'لم نتمكن من استخراج أي بند' : 'Aucun poste extrait' });
      } else {
        setLineItems(mapped);
        toast({ title: '✅ تم تحليل الوثيقة، راجع البنود وأضف الأسعار' });
      }
    } catch (e: any) {
      console.error('[SmartDevis] scan error:', e);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ في تحليل الوثيقة' : 'Erreur d\'analyse', description: e?.message });
    } finally {
      setScanning(false);
    }
  }, [toast, isRTL, handleDocxFile]);

  const handleAnalyze = async () => {
    const arabic = rawArabic.trim();
    const french = userText.trim();
    const combined = [arabic, french].filter(Boolean).join('\n');
    if (!combined && images.length === 0) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'اكتب وصف الشغل أو ارفع صورة' : 'Décris le travail ou ajoute une photo',
      });
      return;
    }

    // ── Voie locale : lignes déjà structurées (LOT : … / désignation | qté | unité)
    // Aucun appel IA, aucune reformulation, aucune invention.
    if (images.length === 0) {
      const structured = parseStructuredDevisText(combined);
      if (structured) {
        const mappedLocal: LineItem[] = structured.map((it, idx) => ({
          id: `struct-${Date.now()}-${idx}`,
          designation_fr: it.designation_fr,
          designation_ar: it.designation_fr,
          quantity: it.quantity !== null ? it.quantity : ('' as unknown as number),
          unit: it.unit,
          unitPrice: 0,
          lot: it.lot,
        }));
        setLineItems(mappedLocal);
        console.log('[SmartDevis] lignes structurées parsées localement (0 appel IA):', mappedLocal.length);
        return;
      }
    }

    setAnalyzing(true);
    try {
      const firstImg = images[0];
      const { data, error } = await supabase.functions.invoke('smart-devis-analyzer', {
        body: {
          action: 'analyze_image',
          userMessage: combined,
          imageData: firstImg?.data,
          mimeType: firstImg?.mimeType,
        },
      });
      if (error) throw error;

      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.suggestedItems) ? data.suggestedItems : []);
      console.log('[SmartDevis] items reçus:', items);

      const mapped: LineItem[] = items.map((it: any, idx: number) => ({
        id: `ai-${Date.now()}-${idx}`,
        designation_fr: String(it.designation_fr || '').trim(),
        designation_ar: String(it.designation_ar || it.designation_fr || '').trim(),
        // Aucune invention : ni quantité « 1 », ni unité « m² » par défaut.
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : ('' as unknown as number),
        unit: typeof it.unit === 'string' ? it.unit.trim() : '',
        unitPrice: Number(it.unitPrice) > 0 ? Number(it.unitPrice) : 0,
        lot: typeof it.lot === 'string' && it.lot.trim() ? it.lot.trim() : undefined,
        sourceOrigin: typeof it.sourceOrigin === 'string' ? it.sourceOrigin : undefined,
        clientSupplied: it.clientSupplied === true ? true : undefined,
      }));

      setLineItems(mapped);
      setSubjectFr(String(data?.devis_subject_fr || data?.subject || ''));

      if (mapped.length === 0) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'لم يتم إنشاء أي بند' : 'Aucune ligne générée',
        });
      }
    } catch (e: any) {
      console.error('[SmartDevis] analyze error:', e);
      let description = e?.message || String(e);
      try {
        const body = await e?.context?.json?.();
        if (body?.code === 'DEVIS_TOO_LONG' || String(body?.error || '').includes('DEVIS_TOO_LONG')) {
          description = isRTL
            ? 'الدوفي فيه بنود كتير أوي علشان يتحلل مرة واحدة.'
            : 'Le devis contient trop de prestations pour être analysé en une seule fois.';
        } else if (body?.error) {
          description = String(body.error);
        }
      } catch { /* corps illisible : on garde le message d'origine */ }
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في التحليل' : 'Erreur d\'analyse',
        description,
      });

    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setLineItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  /**
   * Saisie prix mobile : on conserve le texte brut saisi (virgule autorisée)
   * et on ne convertit en nombre que si la valeur est parsable.
   * Jamais de suppression silencieuse de la virgule.
   */
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const handlePriceInput = (id: string, raw: string) => {
    const cleaned = raw.replace(/[^\d.,]/g, '');
    setPriceDrafts(prev => ({ ...prev, [id]: cleaned }));
    const normalized = cleaned.replace(',', '.');
    const parsed = Number(normalized);
    if (cleaned === '' ) {
      updateItem(id, { unitPrice: 0 });
    } else if (Number.isFinite(parsed)) {
      updateItem(id, { unitPrice: parsed });
    }
  };

  const removeItem = (id: string) => setLineItems(prev => prev.filter(it => it.id !== id));
  const addItem = () => setLineItems(prev => [...prev, {
    id: generateId(),
    designation_fr: '',
    designation_ar: '',
    quantity: 1,
    unit: 'm²',
    unitPrice: 0,
  }]);

  const [translatingItemId, setTranslatingItemId] = useState<string | null>(null);
  const translateItemAr = async (item: LineItem) => {
    const ar = (item.designation_ar || '').trim();
    if (!ar) {
      toast({ variant: 'destructive', title: isRTL ? 'الوصف بالعربي فاضي' : 'Description arabe vide' });
      return;
    }
    setTranslatingItemId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('btp-translate', {
        body: { text: ar, sourceLang: 'ar', targetLang: 'fr' },
      });
      if (error) throw error;
      const fr = String(data?.translated || '').trim();
      if (fr) updateItem(item.id, { designation_fr: fr });
      else throw new Error('Empty translation');
    } catch (e: any) {
      console.error('[SmartDevis] translate item error:', e);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ في الترجمة' : 'Erreur traduction', description: e?.message });
    } finally {
      setTranslatingItemId(null);
    }
  };

  const grandTotal = lineItems.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);

  const handleCreateDevis = () => {
    if (lineItems.length === 0) {
      toast({ variant: 'destructive', title: isRTL ? 'لا توجد بنود' : 'Aucune ligne' });
      return;
    }
    try {
      const sitePhotos = images.map(i => ({ data: i.data, name: i.name }));
      const prefillData = {
        items: lineItems.map(item => ({
          ...item,
          id: generateId(),
          total: item.quantity * item.unitPrice,
          referenceUnitPrice: item.unitPrice,
          materialsIncluded: true,
        })),
        source: 'smart_devis',
        priceMode: 'reference_fixed',
        sitePhotos,
        descriptionChantier: subjectFr || 'Travaux de rénovation',
      };

      try {
        localStorage.removeItem('invoice_draft_v1');
        sessionStorage.removeItem('invoice_draft_v1');
        sessionStorage.setItem('quoteToInvoiceData', JSON.stringify(prefillData));
      } catch (e) {
        console.warn('[SmartDevis] storage error:', e);
      }

      navigate('/pro/invoice-creator?type=devis&prefill=smart');
    } catch (e: any) {
      console.error('[SmartDevis] handleCreateDevis error:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ تقني' : 'Erreur technique',
        description: e?.message || String(e),
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} aria-label="back">
            <Arrow className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">
              {isRTL ? 'الديڤي الذكي' : 'Devis intelligent'}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {showIntroTip && (
          <div className="relative rounded-md border border-accent/30 bg-accent/10 p-4 animate-in fade-in slide-in-from-top-2 duration-300" dir="rtl">
            <button
              type="button"
              onClick={dismissIntroTip}
              className="absolute top-2 left-2 h-6 w-6 rounded-full hover:bg-accent/20 flex items-center justify-center"
              aria-label="اقفل"
            >
              <X className="h-3 w-3" />
            </button>
            <div className={cn('pr-2', isRTL ? 'font-cairo text-right' : 'text-left')}>
              <div className="font-semibold text-foreground mb-2">{isRTL ? introTipTitleAr : introTipTitleFr}</div>
              <div className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed">{isRTL ? introTipTextAr : introTipTextFr}</div>
            </div>
          </div>
        )}
        {/* Step 1: Input */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">
                {isRTL ? 'وصف الشغل' : 'Description du travail'}
              </label>
              <Textarea
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                placeholder={isRTL
                  ? 'اكتب أو سجّل صوتياً : مثلاً "بنتيرة زرقا ساتيني للحيطان 25 متر بـ 18 يورو"'
                  : 'Décris le travail (arabe ou français)'}
                rows={4}
                dir={isRTL ? 'rtl' : 'ltr'}
                className="resize-none"
                enableVoice
                onVoiceDual={(r) => {
                  const raw = (r.raw || '').trim();
                  const fr = (r.text || '').trim();
                  if (raw) setRawArabic(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + raw);
                  if (fr) setUserText(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + fr);
                }}
              />
              {(rawArabic.trim() || userText.trim()) && (
                <div className="mt-3 space-y-2">
                  {lineItems.length > 0 ? (
                    <>
                      <div className="rounded-md border border-border bg-muted p-3" dir="rtl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-muted-foreground font-cairo">
                            ما قلته بالعربي (تقدر تعدّل) :
                          </div>
                          <VoiceInputButton
                            onResult={() => {}}
                            onDualResult={(r) => {
                              const raw = r.raw || '';
                              if (!raw) return;
                              setRawArabic(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + raw);
                            }}
                          />
                        </div>
                        <Textarea
                          value={rawArabic}
                          onChange={(e) => setRawArabic(e.target.value)}
                          rows={3}
                          dir="rtl"
                          className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0 font-cairo"
                        />
                      </div>
                      <div className="rounded-md border border-primary/30 bg-background p-3" dir="ltr" lang="fr">
                        <div className="text-xs text-muted-foreground mb-2">الترجمة للفرنسي / Traduction française :</div>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-foreground">
                          {lineItems.map((it, idx) => {
                            const label = (it.designation_fr || it.designation_ar || '').trim() || `Ligne ${idx + 1}`;
                            const qty = Number(it.quantity) || 0;
                            const pu = Number(it.unitPrice) || 0;
                            return (
                              <li key={it.id} className="leading-snug">
                                <span className="font-medium">{label}</span>
                                {(qty > 0 || pu > 0 || it.unit) && (
                                  <span className="text-muted-foreground">
                                    {' — '}{qty} {it.unit}{pu > 0 ? ` × ${pu.toFixed(2).replace('.', ',')} €` : ''}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </>
                  ) : (
                    <>
                      {rawArabic.trim() && (
                        <div className="rounded-md border border-border bg-muted p-3" dir="rtl">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-muted-foreground font-cairo">ما قلته بالعربي (تقدر تعدّل) :</div>
                            <VoiceInputButton
                              onResult={() => {}}
                              onDualResult={(r) => {
                                const raw = r.raw || '';
                                if (!raw) return;
                                setRawArabic(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + raw);
                              }}
                            />
                          </div>
                          <Textarea
                            value={rawArabic}
                            onChange={(e) => setRawArabic(e.target.value)}
                            rows={3}
                            dir="rtl"
                            className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0 font-cairo"
                          />
                        </div>
                      )}
                      {userText.trim() && (
                        <div className="rounded-md border border-primary/30 bg-background p-3" dir="ltr" lang="fr">
                          <div className="text-xs text-muted-foreground mb-1">الترجمة للفرنسي / Traduction française :</div>
                          <Textarea
                            value={userText}
                            onChange={(e) => setUserText(e.target.value)}
                            rows={3}
                            dir="ltr"
                            lang="fr"
                            className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
                          />
                        </div>
                      )}
                    </>
                  )}
                  {rawArabic.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="w-full font-cairo"
                    >
                      {analyzing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Languages className="h-4 w-4 mr-2" />
                      )}
                      ترجم ↓
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Smart document scanner (image or PDF) */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                className="hidden"
                onChange={(e) => { handleScanFile(e.target.files?.[0] || null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full font-cairo"
                disabled={scanning}
                dir="rtl"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isRTL ? 'جاري تحليل الوثيقة...' : 'Analyse du document...'}
                  </>
                ) : (
                  <>📎 {isRTL ? 'سكان أو حمّل وثيقة' : 'Scanner ou importer un document'}</>
                )}
              </Button>
              {(docxJobStatus === 'queued' || docxJobStatus === 'running') && (
                <p className="mt-2 text-sm text-muted-foreground text-center">
                  <Loader2 className="inline h-4 w-4 mr-1 animate-spin" />
                  {isRTL
                    ? `جاري استخراج بنود الوثيقة… ${docxProgress}%`
                    : `Extraction des lignes du document Word… ${docxProgress}%`}
                </p>
              )}
            </div>


            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full"
              size="lg"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isRTL ? 'جاري التحليل...' : 'Analyse en cours...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isRTL ? 'تحليل وإنشاء الديڤي' : 'Analyser et générer le devis'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Step 3: Editable items */}
        {lineItems.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  {isRTL ? 'البنود' : 'Lignes du devis'}
                </h2>
                <Button variant="ghost" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  {isRTL ? 'إضافة بند' : 'Ajouter'}
                </Button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item, idx) => (
                  <div key={item.id} className="border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} aria-label="remove">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <Input
                      value={item.designation_fr}
                      onChange={(e) => updateItem(item.id, { designation_fr: e.target.value })}
                      placeholder="Désignation (français)"
                      lang="fr"
                      dir="ltr"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={item.designation_ar}
                        onChange={(e) => updateItem(item.id, { designation_ar: e.target.value })}
                        placeholder="الوصف بالعربي"
                        dir="rtl"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => translateItemAr(item)}
                        disabled={translatingItemId === item.id || !item.designation_ar.trim()}
                        className="shrink-0 font-cairo"
                        aria-label="ترجم"
                      >
                        {translatingItemId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Languages className="h-3 w-3 mr-1" />
                            ترجم
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          {isRTL ? 'الكمية' : 'Qté'}
                        </label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                          lang="fr"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          {isRTL ? 'الوحدة' : 'Unité'}
                        </label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          {isRTL ? 'السعر €' : 'PU €'}
                        </label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={priceDrafts[item.id] ?? (item.unitPrice ? String(item.unitPrice).replace('.', ',') : '')}
                          onChange={(e) => handlePriceInput(item.id, e.target.value)}
                          placeholder="0,00"
                          lang="fr"
                          dir="ltr"
                        />

                      </div>
                    </div>

                    <div className="text-right text-sm font-medium">
                      {(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')} €
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="font-semibold">{isRTL ? 'الإجمالي HT' : 'Total HT'}</span>
                <span className="text-lg font-bold">
                  {grandTotal.toFixed(2).replace('.', ',')} €
                </span>
              </div>

              <Button onClick={handleCreateDevis} className="w-full" size="lg">
                <Send className="h-4 w-4 mr-2" />
                {isRTL ? 'إنشاء الديڤي' : 'Créer le devis'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SmartDevisPage;
