import React, { useMemo, useState } from 'react';
import { Copy, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import MarkdownRenderer from './MarkdownRenderer';

interface DeepAnalysisReportProps {
  content: string;
  className?: string;
}

interface ReportSection {
  heading: string;
  body: string;
}

const TITLE_RE = /^##\s+Analyse technique approfondie\s*$/i;

const stripMd = (s: string) =>
  s
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}/g, '')
    .trim();

/** Découpe le rapport en sections à partir des titres Markdown, sans modifier le texte produit par l'IA. */
const parseReport = (content: string) => {
  const lines = content.split('\n');
  let title = '';
  const intro: string[] = [];
  const sections: ReportSection[] = [];
  let current: ReportSection | null = null;

  for (const line of lines) {
    if (TITLE_RE.test(line.trim())) {
      title = 'Analyse technique approfondie';
      continue;
    }
    const h = line.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (h) {
      if (current) sections.push(current);
      current = { heading: h[2], body: '' };
      continue;
    }
    if (current) current.body += line + '\n';
    else intro.push(line);
  }
  if (current) sections.push(current);

  return { title, intro: intro.join('\n').trim(), sections };
};

const DeepAnalysisReport = ({ content, className }: DeepAnalysisReportProps) => {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { title, intro, sections } = useMemo(() => parseReport(content), [content]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(stripMd(text));
      setCopiedKey(key);
      toast({ title: '✅ Copié !', description: 'Section prête à coller' });
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de copier' });
    }
  };

  const CopyBtn = ({ sectionKey, text }: { sectionKey: string; text: string }) => (
    <button
      type="button"
      onClick={() => copy(sectionKey, text)}
      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copier cette section"
      title="Copier cette section"
    >
      {copiedKey === sectionKey ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
      <span>{copiedKey === sectionKey ? 'Copié' : 'Copier'}</span>
    </button>
  );

  return (
    <div className={cn('flex flex-col gap-4', className)} dir="ltr">
      {/* Titre principal — encadré bleu */}
      {(title || sections.length > 0) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Search size={18} className="text-blue-700 dark:text-blue-300 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-blue-900 dark:text-blue-100 truncate">
              {title || 'Analyse technique approfondie'}
            </h3>
          </div>
          <CopyBtn sectionKey="__all__" text={content} />
        </div>
      )}

      {intro && (
        <MarkdownRenderer
          content={intro}
          isRTL={false}
          forceLTR
          className="!text-[15px] !leading-[1.6] text-foreground"
        />
      )}

      {sections.map((s, idx) => (
        <div key={idx} className="flex flex-col gap-2">
          {idx > 0 && <hr className="border-t border-border/70 mb-1" />}
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-[15px] font-bold text-foreground leading-snug">{s.heading}</h4>
            <CopyBtn sectionKey={`s-${idx}`} text={`${s.heading}\n${s.body}`} />
          </div>
          <MarkdownRenderer
            content={s.body}
            isRTL={false}
            forceLTR
            className="!text-[15px] !leading-[1.6] text-foreground"
          />
        </div>
      ))}
    </div>
  );
};

export default DeepAnalysisReport;
