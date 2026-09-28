import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Image as ImageIcon, Plus, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { extractTextFromDocx } from '@/lib/docxExtractor';
import { ingestPdf, ingestImage } from '@/lib/pdfIngest';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';

// Parcours « Analyser mon projet » — étape 5 : branché sur btp-analysis-job
// (kind = project_docs_facts). Source de vérité : la ligne btp_analysis_jobs.

const MAX_DOCS = 20;
const JOB_STORAGE_KEY = 'anafypro_project_analysis_job';
const JOB_FIELDS = 'id, status, current_step, progress, step_results';
type Kind = 'pdf' | 'docx' | 'jpeg' | 'png';

const EXT_KIND: Record<string, Kind> = { pdf: 'pdf', docx: 'docx', jpg: 'jpeg', jpeg: 'jpeg', png: 'png' };
const MIME_KIND: Record<string, Kind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
};

function detectKind(file: File): Kind | null {
  const byMime = MIME_KIND[(file.type || '').toLowerCase()];
  if (byMime) return byMime;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXT_KIND[ext] ?? null;
}

interface Selected { id: string; file: File; kind: Kind }
type JobRow = { id: string; status: string; current_step: string | null; progress: number | null; step_results: Record<string, any> | null };
type ServerDoc = { fileName: string; kind: 'pdf' | 'docx' | 'image' | 'text'; text?: string; dataUrl?: string };

const formatSize = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;

const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** Prépare un document pour le serveur ; null si aucun contenu exploitable. */
async function toServerDoc(d: Selected): Promise<ServerDoc | null> {
  const fileName = d.file.name;
  if (d.kind === 'docx') {
    const text = (await extractTextFromDocx(d.file)).trim();
    return text ? { fileName, kind: 'docx', text } : null;
  }
  const dataUrl = await readDataUrl(d.file);
  if (d.kind === 'pdf') {
    const r = await ingestPdf(dataUrl);
    if (r.text.trim()) return { fileName, kind: 'pdf', text: r.text };
    // PDF scanné d'une seule page : on envoie l'image de la page (contenu complet).
    if (r.pageCount === 1 && r.pageImages[0]) return { fileName, kind: 'image', dataUrl: r.pageImages[0] };
    return null;
  }
  const img = await ingestImage(dataUrl);
  return { fileName, kind: 'image', dataUrl: img.dataUrl };
}

/** Étape affichée (1..5) dérivée UNIQUEMENT de l'état réel du job. */
function displayStage(job: JobRow): number {
  if (job.status === 'completed') return 5;
  const step = job.current_step || '';
  if (step.startsWith('doc:')) {
    const done = Object.keys(job.step_results || {}).filter(k => k.startsWith('doc:')).length;
    return done === 0 ? 1 : 2;
  }
  if (step === 'dossier') return 3;
  return 4; // global_analysis, finalize
}

const ProjectAnalysisPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Selected[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState<JobRow | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [startError, setStartError] = useState(false);

  const T = isRTL
    ? {
        title: 'حلّل مشروعك',
        intro: 'ارفع المخططات، دفتر الشروط، الصور والمستندات للحصول على تحليل منظم لمشروعك.',
        formats: 'الصيغ المقبولة: PDF، DOCX، JPEG، PNG — بحد أقصى 20 مستند',
        add: 'إضافة مستندات',
        addMore: 'ضيف مستندات تانية',
        count: (n: number) => `${n} / ${MAX_DOCS} مستند`,
        empty: 'لم يتم اختيار أي مستند بعد',
        run: 'تحليل مشروعي',
        preparing: 'بنجهّز مستنداتك…',
        rejected: (n: number) => `${n} ملف مش مقبول واتشال`,
        limit: 'وصلت للحد الأقصى: 20 مستند',
        remove: 'شيل',
        stages: ['بنقرا مستنداتك…', 'بنراجع المعلومات…', 'بننظّم مشروعك…', 'بنجهّز التحليل بتاعك…', 'التحليل خلص'],
        docsProgress: (d: number, n: number) => `${d} / ${n} مستند`,
        keepOpen: 'تقدر تقفل الصفحة، التحليل هيكمل لوحده.',
        incomplete: 'في مستندات ما قدرناش نقراها بالكامل. التحليل ده مبني على باقي المستندات بس:',
        tooBig: 'ملف مشروعك كبير جدًا على التحليل الشامل حاليًا. معلومات كل مستند اتحفظت، بس التحليل الشامل ما اتعملش.',
        failed: 'حصلت مشكلة وما قدرناش نكمل التحليل. جرّب تاني بعد شوية.',
        startFailed: 'ما قدرناش نبدأ التحليل. جرّب تاني.',
        nothing: 'ما قدرناش نقرا أي مستند من اللي اخترتهم.',
        newAnalysis: 'تحليل جديد',
        resultTitle: 'تحليل مشروعك',
      }
    : {
        title: 'Analyser mon projet',
        intro: 'Importez vos plans, cahier des charges, photos et documents pour obtenir une analyse structurée de votre projet.',
        formats: 'Formats acceptés : PDF, DOCX, JPEG, PNG — 20 documents maximum',
        add: 'Ajouter des documents',
        addMore: "Ajouter d'autres documents",
        count: (n: number) => `${n} / ${MAX_DOCS} documents`,
        empty: 'Aucun document sélectionné',
        run: 'Analyser mon projet',
        preparing: 'Préparation de vos documents…',
        rejected: (n: number) => `${n} fichier(s) non pris en charge ignoré(s)`,
        limit: 'Limite atteinte : 20 documents',
        remove: 'Retirer',
        stages: ['Lecture de vos documents…', 'Vérification des informations…', 'Organisation de votre projet…', 'Préparation de votre analyse…', 'Analyse terminée'],
        docsProgress: (d: number, n: number) => `${d} / ${n} documents`,
        keepOpen: "Vous pouvez quitter cette page, l'analyse continue.",
        incomplete: "Certains documents n'ont pas pu être entièrement exploités. L'analyse ci-dessous repose uniquement sur les autres documents :",
        tooBig: "Votre dossier est trop volumineux pour l'analyse globale actuelle. Les informations de chaque document ont été enregistrées, mais l'analyse globale n'a pas pu être réalisée.",
        failed: "Un problème est survenu et l'analyse n'a pas pu aboutir. Réessayez dans quelques instants.",
        startFailed: "L'analyse n'a pas pu démarrer. Réessayez.",
        nothing: "Aucun des documents sélectionnés n'a pu être lu.",
        newAnalysis: 'Nouvelle analyse',
        resultTitle: 'Analyse de votre projet',
      };

  // Reprise d'un job en cours (la page peut être quittée sans l'interrompre).
  useEffect(() => {
    const saved = sessionStorage.getItem(JOB_STORAGE_KEY);
    if (!saved) return;
    try {
      const { id, skipped: sk } = JSON.parse(saved);
      if (Array.isArray(sk)) setSkipped(sk);
      supabase.from('btp_analysis_jobs').select(JOB_FIELDS).eq('id', id).maybeSingle()
        .then(({ data }) => { if (data) setJob(data as JobRow); });
    } catch { sessionStorage.removeItem(JOB_STORAGE_KEY); }
  }, []);

  // Polling de l'état réel du job (3 s) tant qu'il n'est pas terminal.
  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return;
    const timer = setInterval(async () => {
      const { data, error } = await supabase.from('btp_analysis_jobs').select(JOB_FIELDS).eq('id', job.id).maybeSingle();
      if (error) { console.error('[ProjectAnalysis] poll', error.message); return; }
      if (data) setJob(data as JobRow);
    }, 3000);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    let rejected = 0;
    let overflow = false;
    setDocs(prev => {
      const next = [...prev];
      for (const file of files) {
        const kind = detectKind(file);
        if (!kind) { rejected++; continue; }
        if (next.some(d => d.file.name === file.name && d.file.size === file.size)) continue;
        if (next.length >= MAX_DOCS) { overflow = true; break; }
        next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, kind });
      }
      return next;
    });
    const msgs: string[] = [];
    if (rejected) msgs.push(T.rejected(rejected));
    if (overflow) msgs.push(T.limit);
    setNotice(msgs.length ? msgs.join(' · ') : null);
  };

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setStartError(false);
    setNotice(null);
    try {
      const prepared: ServerDoc[] = [];
      const unreadable: string[] = [];
      for (const d of docs) {
        try {
          const s = await toServerDoc(d);
          if (s) prepared.push(s); else unreadable.push(d.file.name);
        } catch (err) {
          console.error('[ProjectAnalysis] lecture locale', d.file.name, err);
          unreadable.push(d.file.name);
        }
      }
      if (prepared.length === 0) { setNotice(T.nothing); return; }
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { console.error('[ProjectAnalysis] session absente'); setStartError(true); return; }
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/btp-analysis-job?mode=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'create', kind: 'project_docs_facts', language: isRTL ? 'ar' : 'fr', documents: prepared }),
      });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.jobId) { console.error('[ProjectAnalysis] create', resp.status, body); setStartError(true); return; }
      setSkipped(unreadable);
      sessionStorage.setItem(JOB_STORAGE_KEY, JSON.stringify({ id: body.jobId, skipped: unreadable, count: prepared.length }));
      setJob({ id: body.jobId, status: body.status ?? 'queued', current_step: 'doc:0', progress: 0, step_results: {} });
    } finally {
      setStarting(false);
    }
  };

  const reset = () => {
    sessionStorage.removeItem(JOB_STORAGE_KEY);
    setJob(null); setDocs([]); setSkipped([]); setNotice(null); setStartError(false);
  };

  const remove = (id: string) => { setDocs(prev => prev.filter(d => d.id !== id)); setNotice(null); };
  const full = docs.length >= MAX_DOCS;
  const Back = isRTL ? ArrowRight : ArrowLeft;
  const dirProps = { className: cn('px-4 py-4 pb-40 space-y-4', isRTL && 'font-cairo'), dir: isRTL ? 'rtl' : 'ltr' } as const;
  const backBtn = (
    <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[15px] text-muted-foreground">
      <Back size={18} />
    </button>
  );

  // ------------------------------------------------------------ job en cours / terminé
  if (job) {
    const sr = job.step_results || {};
    const total = Array.isArray(sr.dossier?.data?.documents) ? sr.dossier.data.documents.length : undefined;
    const docEntries = Object.keys(sr).filter(k => k.startsWith('doc:')).map(k => sr[k]);
    const analysis = sr.global_analysis?.data as { status?: string; text?: string | null; complete?: boolean; missingDocuments?: { fileName?: string }[] } | undefined;
    const serverMissing = docEntries.filter((d: any) => d?.status && d.status !== 'completed').map((d: any) => d.fileName as string);
    const missing = [...new Set([...serverMissing, ...skipped])];

    if (job.status === 'failed') {
      return (
        <div {...dirProps}>
          {backBtn}
          <div className="rounded-xl border border-border bg-card p-4 flex gap-3 items-start">
            <AlertTriangle size={20} className="text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[15px] text-foreground">{T.failed}</p>
          </div>
          <button onClick={reset} className="w-full rounded-xl bg-primary py-3.5 text-[16px] font-bold text-primary-foreground">{T.newAnalysis}</button>
        </div>
      );
    }

    if (job.status === 'completed') {
      return (
        <div {...dirProps}>
          {backBtn}
          <div className="flex items-center gap-2">
            <CheckCircle2 size={22} className="text-primary" />
            <h1 className="text-[22px] font-bold text-foreground">{T.stages[4]}</h1>
          </div>
          {missing.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
              <p className="text-[15px] text-foreground">{T.incomplete}</p>
              <ul className="space-y-1" dir="ltr" lang="fr">
                {missing.map(n => <li key={n} className={cn('text-[14px] text-muted-foreground break-all', isRTL && 'text-right')}>• {n}</li>)}
              </ul>
            </div>
          )}
          {analysis?.status === 'needs_chunking' || !analysis?.text ? (
            <div className="rounded-xl border border-border bg-card p-4 flex gap-3 items-start">
              <AlertTriangle size={20} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[15px] text-foreground">{T.tooBig}</p>
            </div>
          ) : (
            <article className="rounded-2xl border border-border bg-card p-4 overflow-x-auto [&_table]:min-w-full [&_table]:text-[14px] [&_td]:align-top [&_p]:text-[15px] [&_li]:text-[15px] break-words">
              <h2 className="text-[18px] font-bold text-foreground mb-3">{T.resultTitle}</h2>
              <MarkdownRenderer content={analysis.text} isRTL={isRTL} />
            </article>
          )}
          <button onClick={reset} className="w-full rounded-xl border border-primary/40 bg-background py-3.5 text-[16px] font-bold text-primary">{T.newAnalysis}</button>
        </div>
      );
    }

    const stage = displayStage(job);
    const pct = Math.max(2, Math.min(100, job.progress ?? 0));
    const docCount = total ?? (JSON.parse(sessionStorage.getItem(JOB_STORAGE_KEY) || '{}').count as number | undefined);
    return (
      <div {...dirProps}>
        {backBtn}
        <h1 className="text-[22px] font-bold text-foreground">{T.title}</h1>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 size={22} className="text-primary animate-spin shrink-0" />
            <p className="text-[17px] font-bold text-foreground">{T.stages[stage - 1]}</p>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden" dir="ltr">
            <div className="h-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          {stage <= 2 && docCount ? (
            <p className="text-[14px] text-muted-foreground" dir="ltr" lang="fr">{T.docsProgress(docEntries.length, docCount)}</p>
          ) : null}
          <ol className="space-y-1.5">
            {T.stages.slice(0, 4).map((label, i) => (
              <li key={label} className={cn('flex items-center gap-2 text-[14px]', i + 1 < stage ? 'text-foreground' : i + 1 === stage ? 'text-foreground font-bold' : 'text-muted-foreground')}>
                {i + 1 < stage ? <CheckCircle2 size={16} className="text-primary" /> : <span className="w-4 h-4 rounded-full border border-border inline-block" />}
                {label.replace('…', '')}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-[14px] text-muted-foreground">{T.keepOpen}</p>
      </div>
    );
  }

  // ------------------------------------------------------------ sélection
  return (
    <div {...dirProps}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
        className="hidden"
        onChange={onPick}
      />

      {backBtn}

      <div>
        <h1 className="text-[22px] font-bold text-foreground">{T.title}</h1>
        <p className="text-[15px] text-muted-foreground mt-1 leading-snug">{T.intro}</p>
        <p className="text-[13px] text-muted-foreground mt-2">{T.formats}</p>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
        <span className="text-[16px] font-bold text-foreground" dir="ltr" lang="fr">{T.count(docs.length)}</span>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={full || starting}
          className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-background px-3 py-2 text-[14px] font-bold text-primary disabled:opacity-50"
        >
          <Plus size={16} /> {docs.length ? T.addMore : T.add}
        </button>
      </div>

      {notice && <p className="text-[14px] text-muted-foreground">{notice}</p>}
      {startError && <p className="text-[14px] text-muted-foreground">{T.startFailed}</p>}

      {docs.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed border-border py-10 text-[15px] text-muted-foreground"
        >
          {T.empty}
        </button>
      ) : (
        <ul className="space-y-2">
          {docs.map((d, i) => (
            <li key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              <span className="text-[13px] font-bold text-muted-foreground w-5 shrink-0" dir="ltr">{i + 1}</span>
              {d.kind === 'jpeg' || d.kind === 'png'
                ? <ImageIcon size={20} className="text-primary shrink-0" />
                : <FileText size={20} className="text-primary shrink-0" />}
              <div className="flex-1 min-w-0" dir="ltr" lang="fr">
                <div className={cn('text-[15px] text-foreground truncate', isRTL && 'text-right')}>{d.file.name}</div>
                <div className={cn('text-[12px] text-muted-foreground', isRTL && 'text-right')}>
                  {d.kind.toUpperCase()} · {formatSize(d.file.size)}
                </div>
              </div>
              <button onClick={() => remove(d.id)} disabled={starting} aria-label={T.remove} className="p-1.5 rounded-full hover:bg-muted shrink-0">
                <X size={18} className="text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {docs.length > 0 && (
        <button
          onClick={start}
          disabled={starting}
          className="w-full rounded-xl bg-primary py-3.5 text-[16px] font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {starting && <Loader2 size={18} className="animate-spin" />}
          {starting ? T.preparing : T.run}
        </button>
      )}
    </div>
  );
};

export default ProjectAnalysisPage;
