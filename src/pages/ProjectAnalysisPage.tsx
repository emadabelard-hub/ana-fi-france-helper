import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Image as ImageIcon, Plus, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// Parcours « Analyser mon projet » — étape 4 : sélection des documents uniquement.
// Le bouton final n'est PAS encore branché au job backend (project_docs_facts).

const MAX_DOCS = 20;
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

const formatSize = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;

const ProjectAnalysisPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Selected[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const T = isRTL
    ? {
        title: 'حلّل مشروعك',
        intro: 'ارفع المخططات، دفتر الشروط، الصور والمستندات للحصول على تحليل منظم لمشروعك.',
        formats: 'الصيغ المقبولة: PDF، DOCX، JPEG، PNG — بحد أقصى 20 مستند',
        add: 'ضيف مستندات',
        addMore: 'ضيف مستندات تانية',
        count: (n: number) => `${n} / ${MAX_DOCS} مستند`,
        empty: 'لسه ما اخترتش أي مستند',
        run: 'تحليل مشروعي',
        pending: 'التحليل هيتفعّل في المرحلة الجاية',
        rejected: (n: number) => `${n} ملف مش مقبول واتشال`,
        limit: 'وصلت للحد الأقصى: 20 مستند',
        remove: 'شيل',
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
        pending: "L'analyse sera activée à l'étape suivante",
        rejected: (n: number) => `${n} fichier(s) non pris en charge ignoré(s)`,
        limit: 'Limite atteinte : 20 documents',
        remove: 'Retirer',
      };

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

  const remove = (id: string) => { setDocs(prev => prev.filter(d => d.id !== id)); setNotice(null); };
  const full = docs.length >= MAX_DOCS;
  const Back = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className={cn('px-4 py-4 pb-40 space-y-4', isRTL && 'font-cairo')} dir={isRTL ? 'rtl' : 'ltr'}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
        className="hidden"
        onChange={onPick}
      />

      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[15px] text-muted-foreground">
        <Back size={18} />
      </button>

      <div>
        <h1 className="text-[22px] font-bold text-foreground">{T.title}</h1>
        <p className="text-[15px] text-muted-foreground mt-1 leading-snug">{T.intro}</p>
        <p className="text-[13px] text-muted-foreground mt-2">{T.formats}</p>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
        <span className="text-[16px] font-bold text-foreground" dir="ltr" lang="fr">{T.count(docs.length)}</span>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={full}
          className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-background px-3 py-2 text-[14px] font-bold text-primary disabled:opacity-50"
        >
          <Plus size={16} /> {docs.length ? T.addMore : T.add}
        </button>
      </div>

      {notice && <p className="text-[14px] text-muted-foreground">{notice}</p>}

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
              <button onClick={() => remove(d.id)} aria-label={T.remove} className="p-1.5 rounded-full hover:bg-muted shrink-0">
                <X size={18} className="text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {docs.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={() => { console.info('[ProjectAnalysis] lancement non branché (étape 4)', docs.length); setNotice(T.pending); }}
            className="w-full rounded-xl bg-primary py-3.5 text-[16px] font-bold text-primary-foreground active:scale-[0.99]"
          >
            {T.run}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectAnalysisPage;
