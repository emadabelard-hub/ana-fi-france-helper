import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Send, Sparkles, Mic, ScanLine, MessageSquarePlus, History, X, Trash2, Paperclip, FileText, Loader2, Copy, Check, ChevronDown, ChevronUp, Search, ClipboardList, Building, Layers, Ruler, Package, AlertTriangle, HelpCircle, Percent, Calculator } from 'lucide-react';
import { extractTextFromPDF } from '@/lib/pdfExtractor';
import { extractTextFromDocx } from '@/lib/docxExtractor';
import RoomScannerModal from '@/components/scanner/RoomScannerModal';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import DeepAnalysisReport from '@/components/assistant/DeepAnalysisReport';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { useAssistantDictation } from '@/hooks/useAssistantDictation';
import FullscreenVoiceModal from '@/components/assistant/FullscreenVoiceModal';
import MissingInfoForm from '@/components/assistant/MissingInfoForm';
import { validateBtpItemsForTransfer } from '@/lib/btpTransferValidator';
import { correctArtisanVocabulary } from '@/lib/artisanVocabulary';

type ConversationSummary = { id: string; title: string | null; updated_at: string };

type MsgAttachment =
  | { kind: 'image'; name: string; dataUrl: string }
  | { kind: 'pdf'; name: string; text: string }
  | { kind: 'docx'; name: string; text: string };

type ResultType = 'document_analysis' | 'btp_facts' | 'btp_control' | 'btp_deep_analysis';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  deepId?: string;
  // Type explicite du résultat (jamais déduit du texte affiché).
  resultType?: ResultType;
  // Message de test temporaire : affiché brut, sans aucune transformation.
  rawFacts?: boolean;
  // Message de test temporaire : contrôle documentaire, affiché brut.
  rawControl?: boolean;
  // Pièces jointes réellement utilisées pour CE message (mémoire de session
  // uniquement) + texte utilisateur d'origine, afin de rattacher chaque analyse
  // approfondie à son propre dossier.
  attachments?: MsgAttachment[];
  userText?: string;
  // Étape interne du pipeline automatique : masquée pour l'utilisateur final.
  internal?: boolean;
};

// État persistant d'une analyse « Analyser mon projet » (source : base de données).
type AnalysisJob = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  language: string;
  progress: number;
  current_step: string;
  final_report: string | null;
  error_message: string | null;
  user_text: string | null;
  documents: { name?: string; kind?: string }[] | null;
  docData?: any;
};

const ANALYSIS_JOB_KEY = 'anafypro_btp_analysis_job_id';

type CategoryKey = 'مهني' | 'اداري' | 'قانوني' | 'شخصي' | null;

const CATEGORIES: { key: CategoryKey; emoji: string; labelAr: string; labelFr: string }[] = [
  { key: 'مهني', emoji: '🔧', labelAr: 'مهني', labelFr: 'Pro' },
  { key: 'اداري', emoji: '🏛️', labelAr: 'اداري', labelFr: 'Admin' },
  { key: 'قانوني', emoji: '⚖️', labelAr: 'قانوني', labelFr: 'Juridique' },
  { key: 'شخصي', emoji: '💡', labelAr: 'شخصي', labelFr: 'Personnel' },
];

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const LETTER_MARKER = '===الرسالة_الرسمية===';
const CLIENT_BLOCK_MARKER = '--- À envoyer au client ---';
const ARABIC_BLOCK_MARKER = '--- بالعربي ---';

const splitLetter = (content: string): { preface: string; letter: string | null } => {
  const idx = content.indexOf(LETTER_MARKER);
  if (idx !== -1) {
    const preface = content.slice(0, idx).trim();
    let after = content.slice(idx + LETTER_MARKER.length);
    const next = after.match(/===[^=\n]+===/);
    if (next && typeof next.index === 'number') after = after.slice(0, next.index);
    return { preface, letter: after.trim() };
  }
  // Fallback: detect formal French letter without explicit marker
  const isFormal = /(Madame|Monsieur|Objet\s*:|Par la présente|Je soussign[ée])/i.test(content);
  if (isFormal) return { preface: '', letter: content.trim() };
  return { preface: content, letter: null };
};

const extractClientBlock = (content: string): { hasBlock: boolean; arabicText: string; frenchText: string } => {
  const idx = content.indexOf(CLIENT_BLOCK_MARKER);
  if (idx !== -1) {
    let before = content.slice(0, idx).trim();
    before = before.replace(ARABIC_BLOCK_MARKER, '').trim();
    const after = content.slice(idx + CLIENT_BLOCK_MARKER.length).trim();
    return { hasBlock: true, arabicText: before, frenchText: after };
  }
  return { hasBlock: false, arabicText: content, frenchText: '' };
};

const fillPlaceholders = (text: string, p: any): string => {
  const fullName = (p?.full_name || '').trim();
  const phone = (p?.phone || '').trim();
  const email = (p?.email || '').trim();
  const address = (p?.address || '').trim();
  const company = (p?.company_name || '').trim();
  const siret = (p?.siret || '').trim();
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const replacements: Array<[RegExp, string]> = [
    [/\[\s*Pr[ée]nom\s+Nom\s*\]/gi, fullName],
    [/\[\s*Nom\s+Pr[ée]nom\s*\]/gi, fullName],
    [/\[\s*Adresse\s*\]/gi, address],
    [/\[\s*Code\s*postal\s+Ville\s*\]/gi, ''],
    [/\[\s*T[ée]l[ée]phone\s*\]/gi, phone],
    [/\[\s*Email\s*\]/gi, email],
    [/\[\s*SIRET\s*\]/gi, siret],
    [/\[\s*Entreprise\s*\]/gi, company],
    [/\[\s*Ville\s*,?\s*le\s*JJ\s*mois\s*AAAA\s*\]/gi, today],
    [/\[\s*Date\s*\]/gi, today],
  ];
  let out = text;
  for (const [re, val] of replacements) out = out.replace(re, val);
  // Clean lines that became empty after substitution
  out = out.replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  return out;
};

const stripMarkdownForCopy = (text: string): string => {
  return text
    .replace(/===[^=\n]+===/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/^\s*={3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

interface UserInfo {
  name: string;
  gender: 'male' | 'female';
}

type MissingField = { key: string; label: string; placeholder: string; type?: string };

const detectMissingInfoForm = (content: string): { fields: MissingField[] } | null => {
  if (!content || !content.includes('missing_info_form')) return null;
  // Try fenced JSON code blocks first, then any raw JSON object containing the marker.
  const candidates: string[] = [];
  const fenced = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi);
  if (fenced) for (const f of fenced) {
    const m = f.match(/\{[\s\S]*\}/);
    if (m) candidates.push(m[0]);
  }
  // Also try to find a bare {...} containing "missing_info_form"
  const bareMatches = content.match(/\{[\s\S]*?"type"\s*:\s*"missing_info_form"[\s\S]*?\}/g);
  if (bareMatches) candidates.push(...bareMatches);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed?.type === 'missing_info_form' && Array.isArray(parsed.fields)) {
        const fields = parsed.fields
          .filter((f: any) => f && typeof f.key === 'string' && typeof f.label === 'string')
          .map((f: any) => ({
            key: String(f.key),
            label: String(f.label),
            placeholder: String(f.placeholder || ''),
            type: f.type ? String(f.type) : undefined,
          }));
        if (fields.length > 0) return { fields };
      }
    } catch {}
  }
  return null;
};

// ---- BTP Document Mode: parse structured block emitted by ai-assistant ----
const DOC_DATA_OPEN = '<ANAFYPRO_DOCUMENT_DATA>';
const DOC_DATA_CLOSE = '</ANAFYPRO_DOCUMENT_DATA>';

type BtpDocData = {
  documentMode: boolean;
  documentTypes?: string[];
  client?: { name?: string | null; address?: string | null } | null;
  project?: { title?: string | null; address?: string | null; deadline?: string | null } | null;
  documentTotalHT?: number | null;
  items?: Array<{
    description?: string;
    quantity?: number | null;
    unit?: string | null;
    unitPrice?: number | null;
    total?: number | null;
    priceSource?: string;
    requiresReview?: boolean;
  }>;
  vat?: {
    rate?: number | null;
    regime?: string | null;
    reason?: string;
    confidence?: string;
    requiresConfirmation?: boolean;
  } | null;
  constraints?: string[];
  missingInformation?: string[];
  copyText?: string;
  projectSeparationRequired?: boolean;
  projectSeparationReason?: string | null;
};

type ProjectSeparationChoice = 'same' | 'multiple' | 'unknown';

type BtpDocExtractStatus = 'none' | 'truncated' | 'invalid' | 'ok';

const extractBtpDocData = (
  content: string,
): { visible: string; data: BtpDocData | null; status: BtpDocExtractStatus } => {
  // Server-side sentinel: response was cut by max_tokens/length upstream.
  const serverTruncated = content.includes('<ANAFYPRO_TRUNCATED/>');
  const cleanedContent = serverTruncated
    ? content.replace(/<ANAFYPRO_TRUNCATED\/>/g, '').trim()
    : content;

  const open = cleanedContent.indexOf(DOC_DATA_OPEN);
  if (open === -1) {
    // No opening tag at all.
    // If the server flagged truncation, treat as truncated (block never emitted).
    return {
      visible: cleanedContent,
      data: null,
      status: serverTruncated ? 'truncated' : 'none',
    };
  }
  const close = cleanedContent.indexOf(DOC_DATA_CLOSE, open);
  if (close === -1) {
    // Opening tag present but closing tag missing → truncated block.
    // NEVER attempt to balance braces or recover partial items.
    const visible = cleanedContent.slice(0, open).trim();
    return { visible, data: null, status: 'truncated' };
  }
  const endTag = close + DOC_DATA_CLOSE.length;
  const jsonRaw = cleanedContent.slice(open + DOC_DATA_OPEN.length, close).trim();
  const visible = (cleanedContent.slice(0, open) + cleanedContent.slice(endTag)).trim();
  if (!jsonRaw) return { visible, data: null, status: 'invalid' };
  try {
    // Tolerate ```json fences around the JSON
    const cleaned = jsonRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed || parsed.documentMode !== true) {
      return { visible, data: null, status: 'invalid' };
    }
    // If the server flagged truncation but the block is complete + valid,
    // trust the block — the narrative may be cut but the JSON is exploitable.
    return { visible, data: parsed as BtpDocData, status: 'ok' };
  } catch (e) {
    console.warn('[AIAssistant] BTP doc block invalid JSON, blocking transfer', e);
    return { visible, data: null, status: 'invalid' };
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// PRÉSENTATION DES RÉSULTATS (affichage uniquement — aucune logique métier)
// ─────────────────────────────────────────────────────────────────────────────

/** Extrait le JSON contenu dans un bloc <TAG> … </TAG> (ou une fence ```json). */
const extractTaggedJson = (content: string, tag: string): any | null => {
  if (!content) return null;
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = content.match(re);
  let raw = m ? m[1] : null;
  if (!raw) {
    const first = content.indexOf('{');
    const last = content.lastIndexOf('}');
    if (first === -1 || last <= first) return null;
    raw = content.slice(first, last + 1);
  }
  raw = raw.replace(/```(?:json)?/gi, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
};

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

const asLabel = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const cand = o.label ?? o.designation ?? o.description ?? o.item ?? o.name ?? o.info ?? o.text ?? o.value ?? o.fact;
    if (typeof cand === 'string') return cand;
  }
  return '';
};

/** Zone technique repliée : JSON complet, masqué par défaut. */
const TechnicalJsonPanel = ({ raw, isRTL = false }: { raw: string; isRTL?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3" dir={isRTL ? 'rtl' : 'ltr'}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors',
          isRTL && 'font-cairo flex-row-reverse',
        )}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {isRTL ? 'عرض البيانات التقنية' : 'Voir les données techniques'}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-muted/40">
          <div className={cn('flex p-1.5', isRTL ? 'justify-start' : 'justify-end')}>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(raw);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch { /* silent */ }
              }}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted',
                isRTL && 'font-cairo flex-row-reverse',
              )}
            >
              {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
              {isRTL ? 'نسخ' : 'Copier'}
            </button>
          </div>
          <pre className="max-h-[45vh] overflow-auto px-3 pb-3 text-[11px] leading-[1.5] font-mono text-foreground whitespace-pre" dir="ltr">
            {raw}
          </pre>
        </div>
      )}
    </div>
  );
};


/** Carte de résultat : titre, icône, bordure dédiée, copier, réduire/développer. */
const ResultCard = ({
  title,
  icon: Icon,
  tone = 'neutral',
  copyText,
  isRTL = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  tone?: 'neutral' | 'facts' | 'control' | 'deep';
  copyText: string;
  isRTL?: boolean;
  children: React.ReactNode;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const toneCls =
    tone === 'facts'
      ? 'border-primary/30 bg-primary/[0.04]'
      : tone === 'control'
      ? 'border-accent/40 bg-accent/[0.06]'
      : tone === 'deep'
      ? 'border-secondary/50 bg-secondary/20'
      : 'border-border bg-card';
  const copyLabel = isRTL ? 'نسخ' : 'Copier';
  return (
    <div className={cn('w-full rounded-xl border overflow-hidden', toneCls)} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/70">
        <span className="shrink-0 w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon size={15} />
        </span>
        <h3 className={cn('flex-1 min-w-0 text-sm font-bold text-foreground truncate', isRTL && 'font-cairo text-right')}>{title}</h3>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(copyText);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch { /* silent */ }
          }}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={copyLabel}
          title={copyLabel}
        >
          {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={collapsed ? (isRTL ? 'عرض' : 'Développer') : (isRTL ? 'إخفاء' : 'Réduire')}
          title={collapsed ? (isRTL ? 'عرض' : 'Développer') : (isRTL ? 'إخفاء' : 'Réduire')}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!collapsed && <div className="px-3 py-3 min-w-0 break-words">{children}</div>}
    </div>
  );
};

const ReportSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="py-2 border-t border-border/60 first:border-t-0 first:pt-0">
    <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase mb-1.5">{title}</div>
    {children}
  </div>
);

const StatLine = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 text-[14px] py-0.5">
    <span className="text-muted-foreground min-w-0">{label}</span>
    <span className="font-semibold text-foreground shrink-0">{value}</span>
  </div>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="list-disc ps-5 space-y-1 text-[14px] text-foreground">
    {items.map((it, idx) => (
      <li key={idx} className="break-words">{it}</li>
    ))}
  </ul>
);

/** Rapport lisible de l'extraction factuelle (lecture seule du JSON). */
const FactsReportView = ({ data }: { data: any }) => {
  const documents = asArray(data?.documents);
  const facts = asArray(data?.facts);
  const constraints = asArray(data?.constraints);
  const missing = asArray(data?.missingInformation);
  const qualityOf = (d: any): string => String(d?.quality ?? d?.readability ?? d?.status ?? '').toLowerCase();
  const full = documents.filter((d) => /certain|exploitable_total|complete|bonne|good/.test(qualityOf(d)) && !/partiel|partial/.test(qualityOf(d))).length;
  const partial = documents.filter((d) => /partiel|partial/.test(qualityOf(d))).length;
  const unusable = documents.filter((d) => /illisible|non_exploitable|unreadable|absent/.test(qualityOf(d))).length;
  const missingLabels = missing.map(asLabel).filter(Boolean);

  return (
    <div className="space-y-1">
      {documents.length > 0 && (
        <ReportSection title="Documents">
          <StatLine label="Documents analysés" value={documents.length} />
          <StatLine label="Parfaitement exploitables" value={full} />
          <StatLine label="Partiellement exploitables" value={partial} />
          <StatLine label="Non exploitables" value={unusable} />
        </ReportSection>
      )}
      <ReportSection title="Extraction">
        <StatLine label="Faits extraits" value={facts.length} />
        <StatLine label="Contraintes" value={constraints.length} />
        <StatLine label="Informations manquantes" value={missing.length} />
      </ReportSection>
      {missingLabels.length > 0 && (
        <ReportSection title="Points à compléter">
          <BulletList items={missingLabels.slice(0, 30)} />
        </ReportSection>
      )}
    </div>
  );
};

/** Rapport lisible du contrôle documentaire (lecture seule du JSON). */
const ControlReportView = ({ data }: { data: any }) => {
  const rows = asArray(data?.controls ?? data?.results ?? data?.facts ?? data?.comparisons);
  const statusOf = (r: any) => String(r?.status ?? r?.controlStatus ?? '').toLowerCase();
  const count = (re: RegExp) => rows.filter((r) => re.test(statusOf(r))).length;
  const confirmed = count(/confirmed/);
  const single = count(/single_source/);
  const conflicts = count(/conflict/);
  const unreadable = count(/unreadable/);
  const missing = count(/missing/);
  const notComparable = count(/not_comparable/);
  const possibleRaw = data?.deepAnalysisPossible ?? data?.technicalAnalysisPossible ?? data?.analysisPossible;
  const blocking = asArray(data?.blockingPoints ?? data?.missingInformation).map(asLabel).filter(Boolean);

  return (
    <div className="space-y-1">
      <ReportSection title="Contrôle">
        <StatLine label="Faits confirmés" value={confirmed} />
        <StatLine label="Faits d'une seule source" value={single} />
        <StatLine label="Conflits" value={conflicts} />
        {unreadable > 0 && <StatLine label="Illisibles" value={unreadable} />}
        {missing > 0 && <StatLine label="Manquants" value={missing} />}
        {notComparable > 0 && <StatLine label="Non comparables" value={notComparable} />}
        {typeof possibleRaw === 'boolean' && (
          <StatLine label="Analyse technique possible" value={possibleRaw ? 'Oui' : 'Non'} />
        )}
      </ReportSection>
      {blocking.length > 0 && (
        <ReportSection title="Points à compléter">
          <BulletList items={blocking.slice(0, 30)} />
        </ReportSection>
      )}
    </div>
  );
};

const AIAssistantPage = () => {

  const { language, setLanguage, isRTL, t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };
  const autoResizeTextarea = () => {
    const t = textareaRef.current;
    if (!t) return;
    // Defer to next frame so the new value is in the DOM before measuring
    requestAnimationFrame(() => {
      t.style.height = 'auto';
      t.style.height = Math.min(t.scrollHeight, 200) + 'px';
    });
  };
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingGender, setOnboardingGender] = useState<'male' | 'female'>('male');
  const [showScanner, setShowScanner] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [userHasEdited, setUserHasEdited] = useState(false);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  type Attachment = MsgAttachment;
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showAttachmentsList, setShowAttachmentsList] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [projectSeparationChoice, setProjectSeparationChoice] = useState<Record<number, ProjectSeparationChoice>>({});
  const [isPreparingTransfer, setIsPreparingTransfer] = useState(false);
  const [selectedAnalysisOption, setSelectedAnalysisOption] = useState<string | null>(null);
  const [deepAnalysisLoadingIndex, setDeepAnalysisLoadingIndex] = useState<number | null>(null);
  const [deepAnalysisStreaming, setDeepAnalysisStreaming] = useState(false);
  const deepAnalysisAbortRef = useRef<AbortController | null>(null);
  const deepAnalysisClearIdleRef = useRef<(() => void) | null>(null);
  // Verrou synchrone anti-double-lancement de l'analyse approfondie
  const deepRunningRef = useRef(false);
  // TEMPORAIRE : test de l'extraction factuelle BTP
  const [factualLoading, setFactualLoading] = useState(false);
  const factualRunningRef = useRef(false);
  const factualAbortRef = useRef<AbortController | null>(null);
  // TEMPORAIRE : test du contrôle documentaire BTP
  const [controlLoading, setControlLoading] = useState(false);
  const controlRunningRef = useRef(false);
  const controlAbortRef = useRef<AbortController | null>(null);

  // ── Parcours unifié « Analyser mon projet » ──────────────────────────────
  // Le pipeline complet (analyse → faits → contrôle → rapport) est exécuté
  // automatiquement ; ses étapes intermédiaires restent invisibles.
  const [pipelineStep, setPipelineStep] = useState<null | 'analyze' | 'facts' | 'control' | 'report'>(null);
  const pipelineRunningRef = useRef(false);
  // Mode test / administration : réactive les outils techniques et le JSON brut.
  const [techMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('anafypro_btp_tech_mode') === 'true'; } catch { return false; }
  });

  // ── Analyse persistante côté serveur ────────────────────────────────────
  // L'état de référence est enregistré en base (public.btp_analysis_jobs) :
  // l'écran ne fait que le lire. Le traitement continue donc si l'utilisateur
  // change de page, met le téléphone en veille, actualise ou ferme l'app.
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [startingJob, setStartingJob] = useState(false);
  const renderedJobRef = useRef<string | null>(null);
  const jobActive = !!job && (job.status === 'queued' || job.status === 'processing');

  // Libellés du parcours (FR / AR) — le rapport final suit la même langue.
  const L = isRTL
    ? {
        analyzeProject: 'حلّل مشروعي',
        analyzing: 'جاري تحليل المشروع…',
        stepAnalyze: 'قراءة المستندات…',
        stepFacts: 'استخراج المعطيات…',
        stepControl: 'التحقق من التوافق…',
        stepReport: 'تحضير التقرير…',
        nextStep: 'الخطوة التالية',
        actionQuote: 'تحضير الدوفي',
        actionEstimate: 'الحصول على تقدير للأسعار',
        actionClientReport: 'تحضير تقرير للعميل / المهندس',
        soon: 'هذه الخدمة متاحة قريبًا.',
        runningTitle: 'جاري تحليل مشروعك',
        runningText: 'يمكنك الخروج من الصفحة. التحليل هيكمل لوحده والتقرير هيكون متاح هنا أول ما يجهز.',
        progPrep: 'تحضير التحليل',
        progDocs: 'تحليل مستنداتك',
        progReport: 'تحضير تقريرك',
        progDone: 'التقرير جاهز',
        failedTitle: 'التحليل ما اكتملش',
        retry: 'إعادة المحاولة',
      }
    : {
        analyzeProject: 'Analyser mon projet',
        analyzing: 'Analyse du projet en cours…',
        stepAnalyze: 'Lecture des documents…',
        stepFacts: 'Extraction des données…',
        stepControl: 'Vérification de cohérence…',
        stepReport: 'Préparation du rapport…',
        nextStep: 'Prochaine étape',
        actionQuote: 'Préparer le devis',
        actionEstimate: 'Obtenir une estimation de prix',
        actionClientReport: 'Préparer un rapport client / architecte',
        soon: 'Cette fonctionnalité sera disponible prochainement.',
        runningTitle: 'Analyse de votre projet en cours',
        runningText: 'Vous pouvez quitter cette page. L’analyse continuera automatiquement et votre rapport sera disponible ici dès qu’il sera prêt.',
        progPrep: 'Préparation de l’analyse',
        progDocs: 'Analyse de vos documents',
        progReport: 'Préparation de votre rapport',
        progDone: 'Rapport terminé',
        failedTitle: 'L’analyse n’a pas pu être finalisée',
        retry: 'Relancer l’analyse',
      };
  const pipelineLabel = pipelineStep === 'analyze' ? L.stepAnalyze
    : pipelineStep === 'facts' ? L.stepFacts
    : pipelineStep === 'control' ? L.stepControl
    : pipelineStep === 'report' ? L.stepReport
    : '';
  // Progression consolidée : une seule valeur, issue de l'état serveur.
  const jobProgressLabel = !job
    ? ''
    : job.status === 'completed'
      ? L.progDone
      : job.current_step === 'report'
        ? L.progReport
        : job.current_step === 'analyze' || job.current_step === 'facts'
          ? L.progDocs
          : L.progPrep;
  const jobProgressValue = Math.max(5, Math.min(100, job?.progress ?? 0));
  useEffect(() => () => {
    deepAnalysisClearIdleRef.current?.();
    try { deepAnalysisAbortRef.current?.abort(); } catch { /* noop */ }
  }, []);
  const { toast } = useToast();
  const dictation = useAssistantDictation(isRTL ? 'ar-EG' : 'fr-FR');

  // Auto-fill from profile if available
  useEffect(() => {
    if (profile?.full_name) {
      const firstName = profile.full_name.split(' ')[0];
      setOnboardingName(firstName);
    }
  }, [profile]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Live-sync dictation transcript into input field during recording
  // (only if user hasn't started typing manually — keyboard always wins)
  useEffect(() => {
    if (dictation.isRecording && dictation.transcript && !userHasEdited) {
      setInput(dictation.transcript);
      autoResizeTextarea();
    }
  }, [dictation.transcript, dictation.isRecording, userHasEdited]);

  // Load conversation list from Supabase on mount, purge >30d, open most recent
  const refreshConversations = useCallback(async (): Promise<ConversationSummary[]> => {
    if (!user) return [];
    // Auto-delete conversations older than 30 days (based on updated_at)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('assistant_conversations')
      .delete()
      .eq('user_id', user.id)
      .lt('updated_at', cutoff);

    const { data, error } = await supabase
      .from('assistant_conversations')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('List conversations error:', error);
      return [];
    }
    const list = (data || []) as ConversationSummary[];
    setConversations(list);
    return list;
  }, [user]);

  useEffect(() => {
    if (!user || conversationLoaded) return;
    (async () => {
      try {
        // Bug 1 fix: only load the list, NEVER auto-open the most recent.
        // Each new page visit starts with an empty context.
        await refreshConversations();
        setCurrentConversationId(null);
        setMessages([]);
      } catch (err) {
        console.error('Load conversation error:', err);
      } finally {
        setConversationLoaded(true);
      }
    })();
  }, [user, conversationLoaded, refreshConversations]);

  // Persist current conversation on every change (after initial load)
  useEffect(() => {
    if (!user || !conversationLoaded || messages.length === 0) return;
    const timeout = setTimeout(async () => {
      try {
        const firstUserMsg = messages.find(m => m.role === 'user')?.content || '';
        const autoTitle = firstUserMsg.trim().slice(0, 60) || null;

        if (currentConversationId) {
          const { error } = await supabase
            .from('assistant_conversations')
            .update({
              messages: messages as any,
              title: autoTitle,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentConversationId)
            .eq('user_id', user.id);
          if (error) console.error('Persist conversation error:', error);
        } else {
          const { data, error } = await supabase
            .from('assistant_conversations')
            .insert({
              user_id: user.id,
              messages: messages as any,
              title: autoTitle,
            })
            .select('id')
            .single();
          if (error) {
            console.error('Create conversation error:', error);
          } else if (data?.id) {
            setCurrentConversationId(data.id);
          }
        }
        // Refresh list (titles / order)
        void refreshConversations();
      } catch (err) {
        console.error('Persist conversation error:', err);
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [messages, user, conversationLoaded, currentConversationId, refreshConversations]);

  const handleNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    setActiveCategory(null);
    setShowConversationList(false);
  }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    if (!user || id === currentConversationId) {
      setShowConversationList(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('assistant_conversations')
        .select('messages')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      setCurrentConversationId(id);
      setMessages((data?.messages as Msg[]) || []);
      setShowConversationList(false);
    } catch (err) {
      console.error('Open conversation error:', err);
    }
  }, [user, currentConversationId]);

  const handleDeleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await supabase
        .from('assistant_conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (id === currentConversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      void refreshConversations();
    } catch (err) {
      console.error('Delete conversation error:', err);
    }
  }, [user, currentConversationId, refreshConversations]);


  const handleOnboardingSubmit = () => {
    const name = onboardingName.trim();
    if (!name) return;
    setUserInfo({ name, gender: onboardingGender });
    setShowOnboarding(false);
  };

  // ── Voice: dictation dedicated to this page ──
  const handleVoiceSend = useCallback(async () => {
    // Stop recording first to flush any in-flight result
    let cleaned = '';
    if (dictation.isRecording) {
      cleaned = await dictation.stopRecording();
    } else {
      cleaned = dictation.getCleanedText();
    }
    if (cleaned) {
      setInput(prev => (prev ? prev + ' ' + cleaned : cleaned));
      setUserHasEdited(false);
      autoResizeTextarea();
    }
    dictation.cancel();
    setVoiceModalOpen(false);
  }, [dictation]);

  const handleVoiceStop = useCallback(() => {
    // Pause recording but KEEP transcript visible so user can review
    void dictation.stopRecording();
  }, [dictation]);

  const handleVoiceCancel = useCallback(() => {
    dictation.cancel();
    setVoiceModalOpen(false);
  }, [dictation]);

  const handleVoiceMicPress = useCallback(() => {
    if (!dictation.isSupported) {
      toast({ variant: 'destructive', title: t('aiAssistant.voice.notSupported') });
      return;
    }
    setVoiceModalOpen(true);
    console.log('Modal opened, recording:', dictation.isRecording);
    if (!dictation.isRecording) {
      dictation.start();
    }
  }, [dictation, isRTL, toast]);

  // ── Agent comptable : détection commandes arabes ──
  const isAccountingCommand = (text: string): boolean => {
    const t = text.trim().toLowerCase();
    const triggers = [
      'كام كسبت الشهر',
      'عمل تقرير',
      'اعمل تقرير',
      'إيه أخبار حساباتي',
      'ايه اخبار حساباتي',
      'تقرير الشهر',
      'تقرير شهري',
      'حسابات الشهر',
    ];
    return triggers.some(k => t.includes(k.toLowerCase()));
  };

  const formatEUR = (n: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €';

  const generateAccountingReport = async (): Promise<string> => {
    if (!user) {
      return 'لازم تكون مسجل دخول عشان أعرف أعمل لك التقرير يا فندم 🙏';
    }
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const monthStart = new Date(year, monthIndex, 1).toISOString();
    const nextMonth = new Date(year, monthIndex + 1, 1).toISOString();
    const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const monthName = monthsAr[monthIndex];

    // Mois précédent (pour comparaison)
    const prevStart = new Date(year, monthIndex - 1, 1).toISOString();
    const prevEnd = monthStart;

    try {
      // Factures payées du mois en cours (CA encaissé) — comptabilité 100% encaissement
      const { data: paidDocs } = await supabase
        .from('documents_comptables')
        .select('total_ttc, subtotal_ht, tva_amount, created_at')
        .eq('user_id', user.id)
        .eq('document_type', 'facture')
        .eq('payment_status', 'paid')
        .gte('created_at', monthStart)
        .lt('created_at', nextMonth);

      // Factures payées du mois précédent
      const { data: prevPaidDocs } = await supabase
        .from('documents_comptables')
        .select('total_ttc')
        .eq('user_id', user.id)
        .eq('document_type', 'facture')
        .eq('payment_status', 'paid')
        .gte('created_at', prevStart)
        .lt('created_at', prevEnd);

      // Factures payées depuis le début de l'année (seuil micro)
      const yearStart = new Date(year, 0, 1).toISOString();
      const { data: yearDocs } = await supabase
        .from('documents_comptables')
        .select('total_ttc')
        .eq('user_id', user.id)
        .eq('document_type', 'facture')
        .eq('payment_status', 'paid')
        .gte('created_at', yearStart);

      // Dépenses du mois
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, tva_amount')
        .eq('user_id', user.id)
        .gte('expense_date', monthStart.slice(0, 10))
        .lt('expense_date', nextMonth.slice(0, 10));

      const revenusTTC = (paidDocs || []).reduce((s, d) => s + Number(d.total_ttc || 0), 0);
      const revenusHT = (paidDocs || []).reduce((s, d) => s + Number(d.subtotal_ht || 0), 0);
      const tvaCollectee = (paidDocs || []).reduce((s, d) => s + Number(d.tva_amount || 0), 0);

      const depensesTTC = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
      const tvaDepenses = (expenses || []).reduce((s, e) => s + Number(e.tva_amount || 0), 0);
      const depensesHT = depensesTTC - tvaDepenses;

      const tvaNette = Math.max(0, tvaCollectee - tvaDepenses);

      // Bénéfice brut HT (base URSSAF)
      const beneficeBrutHT = Math.max(0, revenusHT - depensesHT);
      const urssafRate = (profile?.urssaf_rate ?? 22) / 100;
      const urssaf = beneficeBrutHT * urssafRate;

      const beneficeNet = revenusTTC - depensesTTC - urssaf - tvaNette;

      // Comparaison mois précédent
      const revenusPrev = (prevPaidDocs || []).reduce((s, d) => s + Number(d.total_ttc || 0), 0);
      const totalAnnuel = (yearDocs || []).reduce((s, d) => s + Number(d.total_ttc || 0), 0);
      const seuilMicro = 77700;
      const pctSeuil = (totalAnnuel / seuilMicro) * 100;

      // Conseil personnalisé
      let conseil = '';
      if (pctSeuil >= 80) {
        conseil = `تنبيه — وصلت لـ ${pctSeuil.toFixed(0)}% من الحد السنوي 77700€، خد بالك متعديش`;
      } else if (tvaNette > 500) {
        conseil = 'خد بالك — عندك TVA كبيرة الشهر ده، حط فلوسها جنب من دلوقتي';
      } else if (depensesTTC > revenusTTC * 0.5 && revenusTTC > 0) {
        conseil = 'مصاريفك عالية الشهر ده — راجعها كويس وشوف اللي ينفع تقلله';
      } else if (revenusTTC > revenusPrev && revenusPrev > 0) {
        const diff = revenusTTC - revenusPrev;
        conseil = `ماشي كويس — دخلك زاد بـ ${formatEUR(diff)} عن الشهر اللي فات 👏`;
      } else if (revenusTTC === 0) {
        conseil = 'لسه مفيش فواتير مدفوعة الشهر ده — يلا نشتغل ونحصّل 💪';
      } else {
        conseil = 'الوضع متوازن، كمل على نفس النهج وحط فلوس الضرايب جنب 👍';
      }

      return `📊 تقرير ${monthName} ${year}

💰 دخلك : ${formatEUR(revenusTTC)}

💸 مصاريفك : ${formatEUR(depensesTTC)}

📈 ربحك قبل الضرايب : ${formatEUR(revenusTTC - depensesTTC)}

🏛️ URSSAF المقدرة : ${formatEUR(urssaf)}

💳 TVA اللي هتدفعها : ${formatEUR(tvaNette)}

✅ صافي ربحك : ${formatEUR(beneficeNet)}

💡 ${conseil}`;
    } catch (err) {
      console.error('Accounting report error:', err);
      return 'حصل مشكلة في جلب البيانات، جرب تاني بعد شوية 🔄';
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsProcessingFile(true);
    const added: Attachment[] = [];
    for (const file of files) {
      const isImage = /^image\/(jpe?g|png)$/i.test(file.type);
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const isDocx =
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        /\.docx$/i.test(file.name);
      if (!isImage && !isPdf && !isDocx) {
        toast({ variant: 'destructive', title: t('aiAssistant.file.unsupported'), description: file.name });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ variant: 'destructive', title: t('aiAssistant.file.tooLarge'), description: file.name });
        continue;
      }
      try {
        if (isImage) {
          const dataUrl = await readFileAsDataUrl(file);
          added.push({ kind: 'image', name: file.name, dataUrl });
        } else if (isDocx) {
          const text = await extractTextFromDocx(file);
          added.push({ kind: 'docx', name: file.name, text: text.slice(0, 50000) });
        } else {
          const dataUrl = await readFileAsDataUrl(file);
          const text = await extractTextFromPDF(dataUrl);
          added.push({ kind: 'pdf', name: file.name, text: text.slice(0, 50000) });
        }
      } catch (err) {
        console.error('File processing error:', err);
        toast({ variant: 'destructive', title: t('aiAssistant.file.readError'), description: file.name });
      }
    }
    if (added.length > 0) setAttachments(prev => [...prev, ...added]);
    setIsProcessingFile(false);
  };

  const send = async (overrideText?: string, opts?: { internal?: boolean }): Promise<string> => {
    const internal = opts?.internal === true;
    const text = (typeof overrideText === 'string' ? overrideText : input).trim();
    if ((!text && attachments.length === 0) || isLoading) return '';

    const currentAttachments = attachments;
    const displayText = text || (currentAttachments.length > 0
      ? `📎 ${currentAttachments.map(a => a.name).join(', ')}`
      : '');

    const userMsg: Msg = {
      role: 'user',
      content: displayText,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      userText: text || undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setUserHasEdited(false);
    setIsInputFocused(false);
    resetTextareaHeight();
    if (textareaRef.current) textareaRef.current.blur();
    setSelectedAnalysisOption(null);
    setIsLoading(true);

    // Intercept: agent comptable
    if (currentAttachments.length === 0 && isAccountingCommand(text)) {
      const report = await generateAccountingReport();
      setMessages(prev => [...prev, { role: 'assistant', content: report }]);
      setIsLoading(false);
      return report;
    }

    let assistantSoFar = '';

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar, resultType: 'document_analysis' as ResultType, internal }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Always fetch latest profile fresh from Supabase on every message send
      let liveProfile: any = null;
      if (user?.id) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('full_name, address, phone, email, company_name, siret, company_address, dialect')
            .eq('user_id', user.id)
            .maybeSingle();
          if (data) liveProfile = data;
        } catch (e) { console.warn('inline profile fetch failed', e); }
      }
      if (!liveProfile) liveProfile = profile;

      const userProfilePayload = liveProfile || user ? {
        full_name: liveProfile?.full_name || null,
        address: liveProfile?.address || null,
        phone: liveProfile?.phone || null,
        email: liveProfile?.email || user?.email || null,
        company_name: liveProfile?.company_name || null,
        siret: liveProfile?.siret || null,
        company_address: liveProfile?.company_address || null,
        dialect: (liveProfile as any)?.dialect || null,
      } : null;

      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          attachment: currentAttachments[0]
            ? currentAttachments[0].kind === 'image'
              ? { kind: 'image', name: currentAttachments[0].name, dataUrl: currentAttachments[0].dataUrl }
              : { kind: currentAttachments[0].kind, name: currentAttachments[0].name, text: currentAttachments[0].text }
            : null,
          attachments: currentAttachments.map(a =>
            a.kind === 'image'
              ? { kind: 'image', name: a.name, dataUrl: a.dataUrl }
              : { kind: a.kind, name: a.name, text: a.text }
          ),
          userQuestion: text || null,
          language: language === 'ar' ? 'ar' : 'fr',
          userName: (liveProfile?.full_name?.trim().split(/\s+/)[0]) || userInfo?.name || null,
          userGender: userInfo?.gender || null,
          userProfile: userProfilePayload,
          category: activeCategory,
        }),
      });


      if (!resp.ok || !resp.body) {
        const errorMsg = t('aiAssistant.error.generic');
        try {
          const errData = await resp.json();
          if (errData?.error) console.error('AI Assistant server error detail:', errData.error);
        } catch {}
        console.error('AI Assistant error:', resp.status);
        upsert(errorMsg);
        setIsLoading(false);
        return '';
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }
    } catch (err) {
      console.error('AI Assistant network error:', err);
      upsert(t('aiAssistant.error.network'));
      setIsLoading(false);
    }
    setIsLoading(false);
    return assistantSoFar;
  };

  // Analyse technique approfondie : relance une analyse dédiée à partir des
  // données documentaires déjà extraites dans le dernier message assistant réussi.
  const runDeepAnalysis = async (
    sourceMsgIndex: number,
    btpDocData: any,
    preset?: { attachments: MsgAttachment[]; userText: string | null },
  ) => {
    // Garde synchrone : bloque tout double appel (double clic très rapide)
    // avant la moindre opération asynchrone.
    if (deepRunningRef.current) return;
    deepRunningRef.current = true;
    if (deepAnalysisLoadingIndex !== null) { deepRunningRef.current = false; return; }
    setDeepAnalysisLoadingIndex(sourceMsgIndex);
    setSelectedAnalysisOption(null);

    // Rattachement STRICT des pièces originales à l'analyse d'origine :
    // on remonte depuis le message assistant analysé jusqu'au premier message
    // utilisateur portant ses propres pièces jointes (jamais l'état global
    // courant, jamais un dossier plus récent ou plus ancien).
    let sourceAttachments: MsgAttachment[] = preset?.attachments ?? [];
    let sourceUserText: string | null = preset?.userText ?? null;
    if (!preset) {
      for (let i = Math.min(sourceMsgIndex, messages.length - 1); i >= 0; i--) {
        const m = messages[i];
        if (m.role !== 'user') continue;
        if (m.attachments && m.attachments.length > 0) {
          sourceAttachments = m.attachments;
          sourceUserText = m.userText || null;
        }
        break;
      }
    }
    const originalsAvailable = sourceAttachments.length > 0;

    // Nouveau message assistant, préfixé du titre demandé et identifié de façon
    // unique : chaque flux ne met à jour QUE son propre message.
    const titlePrefix = (isRTL ? '## التحليل الفني المتقدم' : '## Analyse technique approfondie') + '\n\n';
    const deepId = `deep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let assistantSoFar = titlePrefix;
    setMessages(prev => [...prev, { role: 'assistant', content: assistantSoFar, deepId, resultType: 'btp_deep_analysis' }]);
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => prev.map(m => m.deepId === deepId ? { ...m, content: assistantSoFar } : m));
    };
    // Retire le message si aucun rapport exploitable n'a été produit.
    const dropOwnMessage = () => {
      setMessages(prev => prev.filter(m => m.deepId !== deepId));
    };
    // Remplace un rapport partiel par un message d'interruption explicite.
    const markInterrupted = () => {
      const INTERRUPTED = 'L’analyse technique approfondie a été interrompue. Aucun rapport complet n’a été produit.';
      setMessages(prev => prev.map(m => m.deepId === deepId ? { ...m, content: INTERRUPTED } : m));
    };

    // Watchdog d'inactivité : 90 s SANS aucun chunk reçu (réarmé à chaque chunk).
    // Ne limite pas la durée totale de l'analyse.
    const abortController = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let idleTimedOut = false;
    // Garde-fou absolu : quoi qu'il arrive, la requête est avortée au bout de
    // 5 minutes → le spinner ne peut jamais rester bloqué indéfiniment.
    let hardTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      idleTimedOut = true;
      try { abortController.abort(); } catch { /* noop */ }
    }, 300000);
    const clearIdle = () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (hardTimer) { clearTimeout(hardTimer); hardTimer = null; }
    };
    const armIdle = () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      idleTimer = setTimeout(() => {
        idleTimedOut = true;
        try { abortController.abort(); } catch { /* noop */ }
      }, 90000);
    };
    deepAnalysisAbortRef.current = abortController;
    deepAnalysisClearIdleRef.current = clearIdle;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      armIdle();
      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        signal: abortController.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'btp_deep_technical_analysis',
          btpDocData,
          // Pièces originales du dossier ayant produit CETTE analyse basique
          // (mêmes limites de taille/nombre que l'analyse basique : elles sont
          // réutilisées telles quelles, sans nouvel upload).
          attachments: sourceAttachments.map(a =>
            a.kind === 'image'
              ? { kind: 'image', name: a.name, dataUrl: a.dataUrl }
              : { kind: a.kind, name: a.name, text: a.text }
          ),
          originalsAvailable,
          userQuestion: sourceUserText,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          language: language === 'ar' ? 'ar' : 'fr',
          category: activeCategory,
        }),
      });

      if (!resp.ok || !resp.body) {
        clearIdle();
        // Retire le message vide et notifie
        dropOwnMessage();
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: "L'analyse technique approfondie n'a pas pu être générée. Veuillez réessayer.",
        });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let streamDone = false;
      readStream: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdle(); // chunk reçu → réarmement du délai d'inactivité
        setDeepAnalysisStreaming(true);
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') {
            streamDone = true;
            clearIdle();
            break readStream;
          }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }
      clearIdle();

      // Flux sans marqueur [DONE] : rapport considéré comme incomplet.
      if (!streamDone) {
        if (assistantSoFar === titlePrefix) {
          dropOwnMessage();
        } else {
          markInterrupted();
        }
        toast({
          variant: 'destructive',
          title: 'Analyse interrompue',
          description: "L’analyse technique approfondie a été interrompue. Aucun rapport complet n’a été produit.",
        });
        return;
      }

      // Si rien n'a été streamé au-delà du titre, considérer comme échec.
      if (assistantSoFar === titlePrefix) {
        dropOwnMessage();
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: "L'analyse technique approfondie n'a pas pu être générée. Veuillez réessayer.",
        });
      }
    } catch (err) {
      clearIdle();
      const aborted = idleTimedOut || (err as any)?.name === 'AbortError';
      if (aborted) {
        console.warn('[AIAssistant] deep analysis aborted (inactivité / déconnexion)');
      } else {
        console.error('[AIAssistant] deep analysis failed', err);
      }
      // Jamais de rapport partiel conservé comme s'il était terminé.
      if (assistantSoFar === titlePrefix) {
        dropOwnMessage();
      } else {
        markInterrupted();
      }
      toast({
        variant: 'destructive',
        title: aborted ? 'Analyse interrompue' : 'Erreur',
        description: "L’analyse technique approfondie a été interrompue. Aucun rapport complet n’a été produit.",
      });
    } finally {
      clearIdle();
      deepAnalysisAbortRef.current = null;
      deepAnalysisClearIdleRef.current = null;
      setDeepAnalysisStreaming(false);
      setDeepAnalysisLoadingIndex(null);
      deepRunningRef.current = false;
    }
  };

  // ── TEMPORAIRE : test de l'extraction factuelle BTP (action serveur dédiée) ──
  // Affiche la réponse brute, sans aucune transformation ni interprétation.
  const runFactualExtraction = async (
    sourceMsgIndex: number,
    btpDocData: any,
    preset?: { attachments: MsgAttachment[]; userText: string | null; internal?: boolean },
  ): Promise<string> => {
    // Garde synchrone anti-double-clic (même mécanisme que l'analyse approfondie)
    if (factualRunningRef.current) return '';
    factualRunningRef.current = true;
    if (factualLoading) { factualRunningRef.current = false; return ''; }
    setFactualLoading(true);
    setSelectedAnalysisOption(null);

    // Mêmes pièces originales que celles rattachées à CE dossier analysé.
    let sourceAttachments: MsgAttachment[] = preset?.attachments ?? [];
    let sourceUserText: string | null = preset?.userText ?? null;
    if (!preset) {
      for (let i = Math.min(sourceMsgIndex, messages.length - 1); i >= 0; i--) {
        const m = messages[i];
        if (m.role !== 'user') continue;
        if (m.attachments && m.attachments.length > 0) {
          sourceAttachments = m.attachments;
          sourceUserText = m.userText || null;
        }
        break;
      }
    }
    const originalsAvailable = sourceAttachments.length > 0;

    const factsId = `facts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let soFar = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '', deepId: factsId, rawFacts: true, resultType: 'btp_facts', internal: preset?.internal === true }]);
    const upsert = (chunk: string) => {
      soFar += chunk;
      setMessages(prev => prev.map(m => m.deepId === factsId ? { ...m, content: soFar } : m));
    };
    const dropOwnMessage = () => setMessages(prev => prev.filter(m => m.deepId !== factsId));

    const abortController = new AbortController();
    factualAbortRef.current = abortController;
    const hardTimer = setTimeout(() => { try { abortController.abort(); } catch { /* noop */ } }, 300000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        signal: abortController.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'btp_factual_extraction',
          btpDocData,
          attachments: sourceAttachments.map(a =>
            a.kind === 'image'
              ? { kind: 'image', name: a.name, dataUrl: a.dataUrl }
              : { kind: a.kind, name: a.name, text: a.text }
          ),
          originalsAvailable,
          userQuestion: sourceUserText,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          language: 'fr',
          category: activeCategory,
        }),
      });

      if (!resp.ok || !resp.body) {
        dropOwnMessage();
        toast({ variant: 'destructive', title: 'Erreur', description: "L'extraction factuelle n'a pas pu être générée. Veuillez réessayer." });
        return '';
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let streamDone = false;
      readStream: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { streamDone = true; break readStream; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }

      // Jamais de JSON partiel conservé comme résultat complet.
      if (!streamDone || !soFar.trim()) {
        dropOwnMessage();
        toast({ variant: 'destructive', title: 'Extraction interrompue', description: "L’extraction factuelle a été interrompue. Aucun résultat complet n’a été produit." });
        return '';
      }
      return soFar;
    } catch (err) {
      console.error('[AIAssistant] factual extraction failed', err);
      dropOwnMessage();
      toast({ variant: 'destructive', title: 'Erreur', description: "L’extraction factuelle a échoué. Aucun résultat complet n’a été produit." });
      return '';
    } finally {
      clearTimeout(hardTimer);
      factualAbortRef.current = null;
      setFactualLoading(false);
      factualRunningRef.current = false;
    }
  };

  // ── TEMPORAIRE : test du contrôle documentaire BTP (action serveur dédiée) ──
  // Compare les faits du bloc <ANAFYPRO_BTP_FACTS> du même dossier.
  // Les pièces originales sont transmises afin que le modèle puisse lister
  // les documents analysés dans le JSON de contrôle.
  const runDocumentControl = async (
    sourceMsgIndex: number,
    factsBlock: string,
    preset?: { attachments: MsgAttachment[]; userText: string | null; internal?: boolean },
  ) => {
    if (controlRunningRef.current) return;
    controlRunningRef.current = true;
    if (controlLoading) { controlRunningRef.current = false; return; }
    setControlLoading(true);

    // Rattachement strict des pièces originales au dossier analysé.
    let sourceAttachments: MsgAttachment[] = preset?.attachments ?? [];
    let sourceUserText: string | null = preset?.userText ?? null;
    if (!preset) {
      for (let i = Math.min(sourceMsgIndex, messages.length - 1); i >= 0; i--) {
        const m = messages[i];
        if (m.role !== 'user') continue;
        if (m.attachments && m.attachments.length > 0) {
          sourceAttachments = m.attachments;
          sourceUserText = m.userText || null;
        }
        break;
      }
    }
    const originalsAvailable = sourceAttachments.length > 0;

    const controlId = `control-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let soFar = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '', deepId: controlId, rawControl: true, resultType: 'btp_control', internal: preset?.internal === true }]);
    const upsert = (chunk: string) => {
      soFar += chunk;
      setMessages(prev => prev.map(m => m.deepId === controlId ? { ...m, content: soFar } : m));
    };
    const dropOwnMessage = () => setMessages(prev => prev.filter(m => m.deepId !== controlId));

    const abortController = new AbortController();
    controlAbortRef.current = abortController;
    const hardTimer = setTimeout(() => { try { abortController.abort(); } catch { /* noop */ } }, 300000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        signal: abortController.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'btp_document_control',
          btpFacts: factsBlock,
          attachments: sourceAttachments.map(a =>
            a.kind === 'image'
              ? { kind: 'image', name: a.name, dataUrl: a.dataUrl }
              : { kind: a.kind, name: a.name, text: a.text }
          ),
          originalsAvailable,
          userQuestion: sourceUserText,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          language: 'fr',
        }),
      });

      if (!resp.ok || !resp.body) {
        dropOwnMessage();
        toast({ variant: 'destructive', title: 'Erreur', description: "Le contrôle documentaire n'a pas pu être généré. Veuillez réessayer." });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let streamDone = false;
      readStream: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { streamDone = true; break readStream; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }

      if (!streamDone || !soFar.trim()) {
        dropOwnMessage();
        toast({ variant: 'destructive', title: 'Contrôle interrompu', description: "Le contrôle documentaire a été interrompu. Aucun résultat complet n’a été produit." });
      }
    } catch (err) {
      console.error('[AIAssistant] document control failed', err);
      dropOwnMessage();
      toast({ variant: 'destructive', title: 'Erreur', description: "Le contrôle documentaire a échoué. Aucun résultat complet n’a été produit." });
    } finally {
      clearTimeout(hardTimer);
      controlAbortRef.current = null;
      setControlLoading(false);
      controlRunningRef.current = false;
    }
  };

  // ── Transfert vers le Devis intelligent ─────────────────────────────────
  // Les désignations sont toujours reformulées/traduites en français technique
  // avant transfert : le document final reste strictement français.
  const transferToSmartDevis = async (btpDocData: any) => {
    if (isPreparingTransfer) return;
    setIsPreparingTransfer(true);
    try {
      const rawItems = Array.isArray(btpDocData?.items) ? btpDocData.items : [];
      const documentTotalHT = btpDocData?.documentTotalHT;
      const { lines: items, meta } = validateBtpItemsForTransfer(rawItems, documentTotalHT);

      if (items.length === 0) {
        console.warn('[AIAssistant] BTP transfer: no exploitable items', btpDocData);
        toast({
          variant: 'destructive',
          title: 'Aucune prestation exploitable',
          description:
            "L'analyse n'a pas produit de lignes valides. Relancez l'analyse en demandant explicitement le détail par prestation.",
        });
        return;
      }

      const ACTION_PREFIXES = [
        'fourniture et pose', 'fourniture et application', 'fourniture seule',
        'pose de', 'dépose de', 'démolition de', 'installation de',
        'réalisation de', 'création de', 'travaux de', 'préparation de',
        'protection de', 'mise en œuvre de', 'évacuation et mise en décharge',
        'nettoyage de', 'réfection de', 'remplacement de', 'rénovation de',
        'application de',
      ];
      const startsWithAction = (s: string) => {
        const low = s.trim().toLowerCase();
        return ACTION_PREFIXES.some((p) => low.startsWith(p));
      };
      const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
      const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
      const isLatinNonEmpty = (s: unknown): s is string =>
        typeof s === 'string' && s.trim().length > 0 && !/[\u0600-\u06FF\u0400-\u04FF]/.test(s) && /[A-Za-zÀ-ÿ]/.test(s);

      type Candidate = { itemIdx: number; id: string; text: string; context: Record<string, unknown> };
      const candidates: Candidate[] = [];
      for (let idx = 0; idx < items.length; idx++) {
        const ln = items[idx];
        const mt = meta[idx];
        const raw = typeof mt?.index === 'number' ? (rawItems[mt.index] as Record<string, unknown> | undefined) : undefined;
        const des = (ln.designation_fr || '').trim();
        if (!des) continue;
        const needsTranslation = hasArabic(des);
        if (!needsTranslation) {
          if (mt?.requiresReview === true) continue;
          if (startsWithAction(des) && wordCount(des) >= 8) continue;
        }
        candidates.push({
          itemIdx: idx,
          id: `L${idx}`,
          text: des,
          context: {
            lot: ln.lot ?? null,
            unit: ln.unit ?? null,
            quantity: ln.quantity ?? null,
            sourceFile: (raw && (raw.sourceFile as string)) || null,
            translateToFrench: needsTranslation,
          },
        });
        if (candidates.length >= 25) break;
      }

      if (candidates.length > 0) {
        try {
          const { data, error } = await supabase.functions.invoke('invoice-mentor', {
            body: {
              action: 'reformulate_btp_batch',
              items: candidates.map((c) => ({ id: c.id, text: c.text, context: c.context })),
            },
          });
          if (!error && data && Array.isArray((data as any).reformulations)) {
            const map = new Map<string, string>();
            for (const r of (data as any).reformulations as Array<{ id?: unknown; reformulation?: unknown }>) {
              if (typeof r?.id === 'string' && isLatinNonEmpty(r?.reformulation)) {
                map.set(r.id, (r.reformulation as string).trim());
              }
            }
            for (const c of candidates) {
              const reworded = map.get(c.id);
              if (reworded) items[c.itemIdx].designation_fr = reworded;
            }
          } else if (error) {
            console.warn('[AIAssistant] reformulate_btp_batch error, keeping originals', error);
          }
        } catch (reformErr) {
          console.warn('[AIAssistant] reformulate_btp_batch failed, keeping originals', reformErr);
        }
      }

      // Sécurité linguistique : aucune désignation arabe ne part vers le devis.
      const stillArabic = items.filter((ln) => hasArabic(ln.designation_fr || ''));
      if (stillArabic.length > 0) {
        for (const ln of stillArabic) {
          ln.designation_ar = ln.designation_ar || ln.designation_fr;
          ln.designation_fr = correctArtisanVocabulary(ln.designation_fr || '');
        }
      }

      const priceBlocked = meta.filter((m) => !m.priceAccepted).length;
      const qtyBlocked = meta.filter((m) => !m.quantityAccepted).length;

      const subject =
        (btpDocData?.project?.title && String(btpDocData.project.title).trim()) ||
        (btpDocData?.client?.name ? `Devis — ${String(btpDocData.client.name).trim()}` : '');

      sessionStorage.removeItem('smart_devis_prefill_v1');

      const payload = {
        subject,
        items,
        client: btpDocData?.client || null,
        project: btpDocData?.project || null,
        vat: btpDocData?.vat || null,
        constraints: btpDocData?.constraints || [],
        missingInformation: btpDocData?.missingInformation || [],
        copyText: btpDocData?.copyText || '',
        _validation: { totalItems: items.length, priceBlocked, quantityBlocked: qtyBlocked, meta },
      };

      if (priceBlocked > 0 || qtyBlocked > 0) {
        toast({
          title: 'Transfert sécurisé',
          description: `${priceBlocked} prix et ${qtyBlocked} quantité(s) laissés à compléter — données non fiables non transférées.`,
        });
      }

      sessionStorage.setItem('smart_devis_prefill_v1', JSON.stringify(payload));
      navigate('/pro/smart-devis');
    } catch (err) {
      console.error('[AIAssistant] BTP transfer failed', err);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Transfert impossible' });
    } finally {
      setIsPreparingTransfer(false);
    }
  };

  // ── Analyse persistante : appel direct (fetch) du worker ────────────────
  // Note mobile : supabase.functions.invoke échoue sur les envois volumineux
  // (images en base64) — un fetch direct est utilisé, comme pour Smart Devis.
  const callWorker = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/btp-analysis-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* réponse non JSON */ }
    if (!resp.ok) {
      throw new Error(parsed?.error || `worker_http_${resp.status}`);
    }
    return parsed;
  }, []);

  const fetchJobStatus = useCallback(async (jobId?: string | null): Promise<AnalysisJob | null> => {
    if (!user) return null;
    try {
      const data = await callWorker({ action: 'status', jobId: jobId || undefined });
      const row = (data as any)?.job ?? null;
      if (row) setJob(row as AnalysisJob);
      return row as AnalysisJob | null;
    } catch (e) {
      console.warn('[AIAssistant] job status failed', e);
      return null;
    }
  }, [user, callWorker]);


  // Reprise automatique de l'affichage : au montage / retour sur la page,
  // l'analyse est retrouvée par son identifiant enregistré (jamais par l'état
  // local du composant).
  useEffect(() => {
    if (!user) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem(ANALYSIS_JOB_KEY); } catch { /* noop */ }
    void fetchJobStatus(stored);
  }, [user, fetchJobStatus]);

  // Interrogation périodique tant que l'analyse n'est pas terminée
  // (+ rafraîchissement immédiat au retour d'arrière-plan / de veille).
  useEffect(() => {
    if (!user || !jobActive) return;
    const jobId = job?.id ?? null;
    const timer = setInterval(() => { void fetchJobStatus(jobId); }, 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchJobStatus(jobId); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [user, jobActive, job?.id, fetchJobStatus]);

  // Affichage du rapport dès qu'il est disponible (aucun doublon possible).
  useEffect(() => {
    if (!job || job.status !== 'completed' || !job.final_report) return;
    const deepId = `job-${job.id}`;
    if (renderedJobRef.current === deepId) return;
    renderedJobRef.current = deepId;
    const names = (job.documents || []).map(d => d?.name).filter(Boolean) as string[];
    const display = job.user_text || (names.length ? `📎 ${names.join(', ')}` : '');
    setMessages(prev => {
      if (prev.some(m => m.deepId === deepId)) return prev;
      const next: Msg[] = [];
      if (display) next.push({ role: 'user', content: display });
      if (job.docData) {
        // Synthèse structurée conservée hors affichage : elle alimente les
        // actions finales (transfert vers le Devis intelligent).
        next.push({
          role: 'assistant',
          content: `<ANAFYPRO_DOCUMENT_DATA>${JSON.stringify(job.docData)}</ANAFYPRO_DOCUMENT_DATA>`,
          resultType: 'document_analysis',
          internal: true,
        });
      }
      next.push({ role: 'assistant', content: job.final_report as string, resultType: 'btp_deep_analysis', deepId });
      return [...prev, ...next];
    });
    toast({ title: L.progDone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, job?.final_report]);

  // ── Lancement : crée l'analyse persistante puis rend la main ────────────
  const startPersistentAnalysis = async () => {
    if (startingJob || jobActive) return;
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    setStartingJob(true);
    try {
      const payloadAttachments = attachments.map(a =>
        a.kind === 'image'
          ? { kind: 'image', name: a.name, dataUrl: a.dataUrl }
          : { kind: a.kind, name: a.name, text: a.text }
      );
      const data = await callWorker({
        action: 'start',
        attachments: payloadAttachments,
        userText: text,
        language: language === 'ar' ? 'ar' : 'fr',
        userName: profile?.full_name?.trim().split(/\s+/)[0] || userInfo?.name || null,
        userProfile: profile
          ? {
              full_name: profile.full_name || null,
              company_name: (profile as any).company_name || null,
              siret: (profile as any).siret || null,
              dialect: (profile as any).dialect || null,
            }
          : null,
      });
      const row = (data as any)?.job ?? null;
      if (!row) throw new Error('start_failed');
      try { localStorage.setItem(ANALYSIS_JOB_KEY, row.id); } catch { /* noop */ }
      renderedJobRef.current = null;
      setJob(row as AnalysisJob);
      setInput('');
      setAttachments([]);
      setUserHasEdited(false);
      resetTextareaHeight();
      void fetchJobStatus(row.id);
    } catch (e) {
      console.error('[AIAssistant] start analysis failed', e);
      toast({ variant: 'destructive', title: 'Erreur', description: "L'analyse du projet n'a pas pu être lancée." });
    } finally {
      setStartingJob(false);
    }
  };

  const retryPersistentAnalysis = async () => {
    if (!job) return;
    try {
      await callWorker({ action: 'retry', jobId: job.id });
      renderedJobRef.current = null;
      void fetchJobStatus(job.id);
    } catch (e) {
      console.error('[AIAssistant] retry failed', e);
    }
  };



  // ── Point d'entrée unique : « Analyser mon projet » ──────────────────────
  // Enchaîne automatiquement les étapes internes puis n'affiche qu'un rapport.
  const runFullProjectAnalysis = async () => {
    if (pipelineRunningRef.current) return;
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    pipelineRunningRef.current = true;

    // Les pièces originales sont mémorisées avant l'envoi (l'état est vidé).
    const originals = attachments;
    const userText = text || null;

    try {
      setPipelineStep('analyze');
      const analysis = await send(text, { internal: true });
      if (!analysis || !analysis.trim()) return;

      const { data: docData, status } = extractBtpDocData(analysis);
      if (status !== 'ok' || !docData) {
        // Analyse non structurée : on rend la réponse visible telle quelle.
        setMessages(prev => prev.map(m => (m.internal ? { ...m, internal: false } : m)));
        return;
      }

      setPipelineStep('facts');
      await runFactualExtraction(0, docData, { attachments: originals, userText, internal: true });

      setPipelineStep('report');
      await runDeepAnalysis(0, docData, { attachments: originals, userText });
    } catch (err) {
      console.error('[AIAssistant] full project analysis failed', err);
      toast({ variant: 'destructive', title: 'Erreur', description: "L'analyse du projet n'a pas pu être finalisée." });
    } finally {
      setPipelineStep(null);
      pipelineRunningRef.current = false;
    }
  };

  const isArabic = (t: string) => /[\u0600-\u06FF]/.test(t);


  // Onboarding screen to collect name & gender
  if (showOnboarding) {
    return (
      <div className="flex flex-col h-[calc(100dvh-3.5rem-3.5rem)] bg-background">
        <header className="flex items-center gap-3 p-4 border-b border-border bg-card shrink-0">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft size={20} className={cn("text-foreground", isRTL && "rotate-180")} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <h1 className={cn("font-bold text-foreground text-lg", isRTL && "font-cairo")}>
              {t('aiAssistant.header.title')}
            </h1>
          </div>
        </header>

        <div className="flex justify-center p-6">
          <div className="w-full max-w-sm space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2 animate-[scale-in_0.5s_ease-out]">
                <Sparkles size={32} className="text-primary" />
              </div>
              <h2 className={cn("text-xl font-bold text-foreground", isRTL && "font-cairo")}>
                {t('aiAssistant.onboarding.title')}
              </h2>
              <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
                {t('aiAssistant.onboarding.subtitle')}
              </p>
            </div>

            <div className="space-y-4" style={{ animation: 'fade-in 0.5s ease-out 0.2s both' }}>
              <div>
                <label className={cn("block text-sm font-bold text-foreground mb-1.5", isRTL && "font-cairo text-right")}>
                  {t('aiAssistant.onboarding.firstName')}
                </label>
                <input
                  type="text"
                  value={onboardingName}
                  onChange={e => setOnboardingName(e.target.value)}
                  placeholder={t('aiAssistant.onboarding.firstNamePlaceholder')}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/10",
                    isRTL && "font-cairo text-right"
                  )}
                  dir="auto"
                  onKeyDown={e => e.key === 'Enter' && handleOnboardingSubmit()}
                />
              </div>

              <div>
                <label className={cn("block text-sm font-bold text-foreground mb-1.5", isRTL && "font-cairo text-right")}>
                  {t('aiAssistant.onboarding.gender')}
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setOnboardingGender('male')}
                    className={cn(
                      "flex-1 py-3 rounded-xl border-2 text-2xl transition-all flex items-center justify-center",
                      onboardingGender === 'male'
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/30"
                    )}
                  >
                    👦
                  </button>
                  <button
                    onClick={() => setOnboardingGender('female')}
                    className={cn(
                      "flex-1 py-3 rounded-xl border-2 text-2xl transition-all flex items-center justify-center",
                      onboardingGender === 'female'
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/30"
                    )}
                  >
                    👩
                  </button>
                </div>
              </div>

              <button
                onClick={handleOnboardingSubmit}
                disabled={!onboardingName.trim()}
                className={cn(
                  "w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-md",
                  onboardingName.trim()
                    ? "bg-primary text-primary-foreground active:scale-95"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {t('aiAssistant.onboarding.start')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[calc(100dvh-3.5rem-3.5rem-env(safe-area-inset-bottom))] bg-background">
      {/* Header */}
      <header className="flex items-center gap-2 p-4 border-b border-border bg-card shrink-0">
        <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-muted">
          <ArrowLeft size={20} className={cn("text-foreground", isRTL && "rotate-180")} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-primary" />
          </div>
          <h1 className={cn("font-bold text-foreground text-lg truncate", isRTL && "font-cairo")}>
            {t('aiAssistant.header.title')}
          </h1>
        </div>
        {/* Choix de langue du parcours et du rapport (sans drapeau) */}
        <div className="flex items-center rounded-full border border-border overflow-hidden shrink-0" dir="ltr">
          {(['fr', 'ar'] as const).map((lg) => (
            <button
              key={lg}
              type="button"
              onClick={() => setLanguage(lg)}
              aria-pressed={language === lg}
              className={cn(
                "px-2.5 py-1 text-xs font-bold transition-colors",
                language === lg ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {lg === 'fr' ? 'FR' : 'AR'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowConversationList(v => !v)}
          className={cn(
            "p-2 rounded-full hover:bg-muted transition-colors",
            showConversationList && "bg-muted"
          )}
          aria-label={t('aiAssistant.header.conversations')}
          title={t('aiAssistant.header.conversations')}
        >
          <History size={18} className="text-foreground" />
        </button>
        <button
          onClick={handleNewConversation}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label={t('aiAssistant.header.newConversation')}
          title={t('aiAssistant.header.newConversation')}
        >
          <MessageSquarePlus size={18} className="text-primary" />
        </button>
      </header>

      {/* Conversation list dropdown */}
      {showConversationList && (
        <div className="absolute inset-0 z-40 bg-black/30 animate-fade-in" onClick={() => setShowConversationList(false)}>
          <div
            className={cn(
              "absolute top-0 right-0 h-full w-[85%] max-w-sm bg-card border-l border-border shadow-xl flex flex-col",
              isRTL && "left-0 right-auto border-l-0 border-r"
            )}
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className={cn("font-bold text-foreground", isRTL && "font-cairo")}>
                {t('aiAssistant.header.conversations')}
              </h2>
              <button onClick={() => setShowConversationList(false)} className="p-1 rounded-full hover:bg-muted">
                <X size={18} className="text-foreground" />
              </button>
            </div>
            <button
              onClick={handleNewConversation}
              className={cn(
                "flex items-center gap-2 mx-3 my-3 px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors",
                isRTL && "font-cairo flex-row-reverse text-right"
              )}
            >
              <MessageSquarePlus size={16} />
              {t('aiAssistant.header.newConversation')}
            </button>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {conversations.length === 0 ? (
                <p className={cn("text-center text-sm text-muted-foreground py-6", isRTL && "font-cairo")}>
                  {t('aiAssistant.conversations.empty')}
                </p>
              ) : (
                <ul className="space-y-1">
                  {conversations.map(c => {
                    const isActive = c.id === currentConversationId;
                    const titleAr = c.title ? isArabic(c.title) : isRTL;
                    const dateStr = new Date(c.updated_at).toLocaleDateString(isRTL ? 'ar-EG' : 'fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => handleSelectConversation(c.id)}
                          className={cn(
                            "w-full group flex items-start gap-2 px-3 py-2.5 rounded-lg transition-colors text-left",
                            isActive ? "bg-primary/10" : "hover:bg-muted"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium text-foreground truncate",
                                titleAr && "font-cairo text-right",
                              )}
                              dir={titleAr ? 'rtl' : 'ltr'}
                            >
                              {c.title || t('aiAssistant.header.newConversation')}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{dateStr}</p>
                          </div>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => handleDeleteConversation(c.id, e)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDeleteConversation(c.id, e as any); }}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                            aria-label={t('aiAssistant.conversations.delete')}
                          >
                            <Trash2 size={14} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className={cn("px-4 py-2 text-[10px] text-muted-foreground text-center border-t border-border", isRTL && "font-cairo")}>
              {t('aiAssistant.conversations.autoDelete')}
            </p>
          </div>
        </div>
      )}

      {/* Hero banner + entry point: only on welcome screen (no active conversation) */}
      {messages.length === 0 && (
        <>
          <div
            className="mx-4 mb-6 mt-4 shrink-0 rounded-[16px] text-white flex flex-col items-center justify-center gap-1.5 min-h-[140px] px-4 text-center"
            style={{ background: 'linear-gradient(90deg, #1E3A8A, #2563EB)' }}
          >
            <div className="text-[32px] leading-none">🏗️</div>
            <h2 className={cn("text-[20px] font-bold leading-tight", isRTL && "font-cairo")}>
              {isRTL ? t('aiAssistant.welcome.companyBanner.titleAr') : t('aiAssistant.welcome.companyBanner.title')}
            </h2>
            <p className={cn("text-[14px] font-medium text-white/80 leading-tight", isRTL && "font-cairo")}>
              {isRTL ? t('aiAssistant.welcome.companyBanner.subtitleAr') : t('aiAssistant.welcome.companyBanner.subtitle')}
            </p>
            <button
              onClick={() => navigate('/creer-ma-societe')}
              className={cn("mt-2 bg-white font-bold text-[#1E3A8A] rounded-[25px] px-8 py-3 text-[16px] shadow-lg hover:bg-white/90 transition-colors", isRTL && "font-cairo")}
            >
              {isRTL ? t('aiAssistant.welcome.companyBanner.buttonAr') : t('aiAssistant.welcome.companyBanner.button')}
            </button>
          </div>

          {isRTL && (
            /* Entry point: anafypro ترجمة */
            <button
              onClick={() => navigate('/anafy-translate')}
              className="mx-4 mb-4 shrink-0 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-[0.99] transition-all p-4 text-right font-cairo"
              dir="rtl"
            >
              <div className="flex items-center gap-3 flex-row-reverse">
                <div className="text-2xl leading-none shrink-0">🌍</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-foreground">{t('aiAssistant.welcome.translationCard.title')}</div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">{t('aiAssistant.welcome.translationCard.subtitle')}</div>
                </div>
              </div>
            </button>
          )}
        </>
      )}


      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <Sparkles size={40} className="text-primary mb-4" />
            <p className={cn("text-muted-foreground text-lg font-bold", isRTL && "font-cairo")}>
              {t('aiAssistant.welcome.greeting').replace('{name}', userInfo?.name || (isRTL ? 'فندم' : ''))}
            </p>
            <p className={cn("text-muted-foreground text-sm mt-2 mb-4", isRTL && "font-cairo")}>
              {t('aiAssistant.welcome.subtitle')}
            </p>
            {/* Category Tags */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(prev => prev === cat.key ? null : cat.key)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 border",
                    activeCategory === cat.key
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-card text-foreground border-border hover:border-primary/40",
                    isRTL && "font-cairo"
                  )}
                >
                  {cat.emoji} {t(
                    cat.key === 'مهني' ? 'aiAssistant.categories.pro'
                    : cat.key === 'اداري' ? 'aiAssistant.categories.admin'
                    : cat.key === 'قانوني' ? 'aiAssistant.categories.legal'
                    : 'aiAssistant.categories.personal'
                  )}
                </button>
              ))}
            </div>
            {/* Room Scanner Button */}
            <button
              onClick={() => setShowScanner(true)}
              className="px-5 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-sm flex items-center gap-2 hover:bg-primary/20 active:scale-95 transition-all"
            >
              <ScanLine size={18} />
              {t('aiAssistant.roomScanner')}
            </button>
          </div>
        )}

        {(() => {
          // Précalcule le dernier btpDocData valide connu à chaque position,
          // afin que le panneau d'options reste affiché sous le message
          // d'analyse technique approfondie (qui ne contient plus le bloc).
          const panelDataAt: (any | null)[] = [];
          let lastPanel: any = null;
          for (const m of messages) {
            if (m.role === 'assistant') {
              const { data, status } = extractBtpDocData(m.content);
              if (status === 'ok' && data) lastPanel = data;
            }
            panelDataAt.push(lastPanel);
          }

          return messages.map((msg, i) => {
          // Étapes techniques intermédiaires : jamais visibles hors mode test.
          if (msg.internal && !techMode) return null;
          const isUser = msg.role === 'user';
          const textAr = isArabic(msg.content);
          if (isUser) {
            return (
              <div key={i} className="flex justify-end">
                <div
                  className={cn(
                    "max-w-[85%] px-3 py-3 rounded-2xl rounded-br-sm whitespace-pre-wrap text-[15px] leading-[1.6]",
                    textAr ? "font-cairo text-right" : "text-left"
                  )}
                  style={{ backgroundColor: '#C9A227', color: '#000' }}
                  dir={textAr ? "rtl" : "ltr"}
                >
                  {msg.content}
                </div>
              </div>
            );
          }
          const missingForm = detectMissingInfoForm(msg.content);
          // First, extract the optional BTP document-mode structured block
          const { visible: contentWithoutBtp, data: btpDocData, status: btpDocStatus } = extractBtpDocData(msg.content);
          // Strip the JSON block from the visible content if it was a form payload
          const visibleContent = missingForm
            ? contentWithoutBtp
                .replace(/```(?:json)?\s*\{[\s\S]*?"missing_info_form"[\s\S]*?\}\s*```/gi, '')
                .replace(/\{[\s\S]*?"type"\s*:\s*"missing_info_form"[\s\S]*?\}/g, '')
                .trim()
            : contentWithoutBtp;
          const { preface, letter: rawLetter } = splitLetter(visibleContent);
          const letter = rawLetter ? fillPlaceholders(rawLetter, profile) : null;
          const isFormalFrench = !!letter;
          const copyText = letter ? stripMarkdownForCopy(letter) : visibleContent;
          const clientBlock = !letter ? extractClientBlock(visibleContent) : { hasBlock: false, arabicText: visibleContent, frenchText: '' };
          const isLastAssistant = i === messages.length - 1;
          // Type de résultat explicite (jamais déduit du texte).
          const resultType: ResultType | undefined =
            msg.resultType ?? (msg.rawFacts ? 'btp_facts' : msg.rawControl ? 'btp_control' : undefined);
          const isFactsResult = resultType === 'btp_facts';
          const isControlResult = resultType === 'btp_control';
          const isDeepResult =
            resultType === 'btp_deep_analysis' ||
            /^##\s+Analyse technique approfondie/i.test((letter ?? visibleContent).trim());
          const isDocAnalysisCard = !isFactsResult && !isControlResult && !isDeepResult && btpDocStatus === 'ok';

          // ── Cartes dédiées : extraction factuelle / contrôle documentaire ──
          if (isFactsResult || isControlResult) {
            const parsed = extractTaggedJson(
              msg.content,
              isFactsResult ? 'ANAFYPRO_BTP_FACTS' : 'ANAFYPRO_BTP_CONTROL',
            );
            const pretty = parsed ? JSON.stringify(parsed, null, 2) : msg.content;
            return (
              <div key={i} className="w-full min-w-0">
                <ResultCard
                  title={isFactsResult ? 'Extraction factuelle' : 'Contrôle documentaire'}
                  icon={isFactsResult ? ClipboardList : AlertTriangle}
                  tone={isFactsResult ? 'facts' : 'control'}
                  copyText={pretty}
                >
                  {!msg.content.trim() ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      Traitement en cours…
                    </div>
                  ) : parsed ? (
                    <>
                      {isFactsResult ? <FactsReportView data={parsed} /> : <ControlReportView data={parsed} />}
                      <TechnicalJsonPanel raw={pretty} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun résultat exploitable n'a pu être présenté.
                    </p>
                  )}
                </ResultCard>
                {techMode && isLastAssistant && isFactsResult && msg.content.includes('ANAFYPRO_BTP_FACTS') && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => runDocumentControl(i, msg.content)}
                      disabled={controlLoading}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-[13px] font-semibold text-foreground disabled:opacity-60"
                    >
                      {controlLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                      Tester le contrôle documentaire
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={i} className="w-full min-w-0 relative">
              {!isDeepResult && !isDocAnalysisCard && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(copyText);
                      setCopiedIndex(i);
                      toast({ title: '✅ Copié !', description: 'Texte prêt à coller' });
                      setTimeout(() => setCopiedIndex(null), 2000);
                    } catch {
                      toast({ title: 'Erreur', description: 'Impossible de copier', variant: 'destructive' });
                    }
                  }}
                  className="absolute top-2 end-2 z-10 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Copier"
                  title="Copier"
                >
                  {copiedIndex === i ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                </button>
              )}

              {/* Optional Arabic preface (only when letter present) */}
              {letter && preface && (
                <MarkdownRenderer
                  content={preface}
                  isRTL={isArabic(preface)}
                  className="!text-[15px] !leading-[1.6] text-foreground mb-3"
                />
              )}

              {/* Either the formal French letter, the commercial client block, or the regular response */}
              {visibleContent && (
                <div {...(isFormalFrench || clientBlock.hasBlock ? { dir: 'ltr' as const } : {})}>
                  {clientBlock.hasBlock ? (
                    <>
                      <MarkdownRenderer
                        content={clientBlock.arabicText}
                        isRTL={true}
                        className="!text-[15px] !leading-[1.6] text-foreground mb-3"
                      />
                      <MarkdownRenderer
                        content={clientBlock.frenchText}
                        isRTL={false}
                        forceLTR={true}
                        className="!text-[15px] !leading-[1.6] text-foreground"
                        onSmartLinkClick={(type) => {
                          if (type === 'cv') navigate('/pro/cv-generator');
                          else if (type === 'pro') navigate('/pro/invoice-creator');
                          else if (type === 'solutions') navigate('/premium-consultation');
                        }}
                      />
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(stripMarkdownForCopy(clientBlock.frenchText));
                            setCopiedBlock(i);
                            setTimeout(() => setCopiedBlock(null), 2000);
                          } catch {
                            // silent
                          }
                        }}
                        className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                      >
                        {copiedBlock === i ? (
                          <>
                            <Check size={14} className="text-green-500" />
                            <span className="font-cairo">تم النسخ ✓</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span className="font-cairo">نسخ الرسالة</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : isDeepResult ? (
                    <ResultCard
                      title="Analyse technique approfondie"
                      icon={Search}
                      tone="deep"
                      copyText={stripMarkdownForCopy(letter ?? visibleContent)}
                    >
                      <DeepAnalysisReport content={letter ?? visibleContent} />
                    </ResultCard>
                  ) : isDocAnalysisCard ? (
                    <ResultCard
                      title="Analyse documentaire"
                      icon={FileText}
                      tone="neutral"
                      copyText={stripMarkdownForCopy(letter ?? visibleContent)}
                    >
                      <MarkdownRenderer
                        content={letter ?? visibleContent}
                        isRTL={isFormalFrench ? false : textAr}
                        forceLTR={isFormalFrench}
                        className="!text-[15px] !leading-[1.6] text-foreground"
                      />
                      {btpDocData && <TechnicalJsonPanel raw={JSON.stringify(btpDocData, null, 2)} />}
                    </ResultCard>
                  ) : (
                    <MarkdownRenderer
                      content={letter ?? visibleContent}
                      isRTL={isFormalFrench ? false : textAr}
                      forceLTR={isFormalFrench}
                      className="!text-[15px] !leading-[1.6] text-foreground"
                      onSmartLinkClick={(type) => {
                        if (type === 'cv') navigate('/pro/cv-generator');
                        else if (type === 'pro') navigate('/pro/invoice-creator');
                        else if (type === 'solutions') navigate('/premium-consultation');
                      }}
                    />
                  )}
                </div>
              )}


              {/* Bug 4: Inline missing info form */}
              {missingForm && isLastAssistant && !isLoading && (
                <div className="mt-3">
                  <MissingInfoForm
                    fields={missingForm.fields}
                    isRTL={isRTL}
                    onCancel={() => {
                      setMessages(prev => prev.map((m, idx) =>
                        idx === i ? { ...m, content: visibleContent || t('aiAssistant.cancelled') } : m
                      ));
                    }}
                    onSubmit={(data) => {
                      const summary = Object.entries(data)
                        .map(([k, v]) => `- ${k}: ${v}`)
                        .join('\n');
                      const reply = t('aiAssistant.missingInfo.reply') + '\n' + summary;
                      void send(reply);
                    }}
                  />
                </div>
              )}
              {/* BTP Document Mode: transfer to Smart Devis */}
              {(() => {
                // Documentary BTP mode is active when the mandatory inventory section
                // "Documents effectivement analysés" is present in the visible response,
                // OR when the strict parser detected an opening tag (even if truncated).
                const isBtpDocMode =
                  /Documents\s+effectivement\s+analys/i.test(visibleContent || '') ||
                  btpDocStatus === 'truncated' ||
                  btpDocStatus === 'invalid';
                const hasValidBlock = btpDocStatus === 'ok' && !!btpDocData;

                if (!isLastAssistant || isLoading) return null;

                // CAS B — opening tag present but closing tag missing (truncation).
                // The strict parser never returns partial data; transfer stays disabled.
                if (btpDocStatus === 'truncated') {
                  return (
                    <div className="mt-4 border-t border-border pt-3" dir="ltr">
                      <p className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        La réponse de l'assistant a été interrompue avant la fin de l'analyse. Merci de relancer l'analyse avec moins de documents ou des fichiers séparés.
                      </p>
                    </div>
                  );
                }

                // CAS C — block complete but JSON invalid.
                if (btpDocStatus === 'invalid') {
                  return (
                    <div className="mt-4 border-t border-border pt-3" dir="ltr">
                      <p className="text-sm text-foreground bg-muted/60 border border-border rounded-lg p-3">
                        Les données structurées produites sont invalides. Aucun transfert n'a été effectué.
                      </p>
                    </div>
                  );
                }

                // CAS A — no opening tag at all, but doc mode was expected.
                if (isBtpDocMode && !hasValidBlock) {
                  return (
                    <div className="mt-4 border-t border-border pt-3" dir="ltr">
                      <p className="text-sm text-foreground bg-muted/60 border border-border rounded-lg p-3">
                        Aucune donnée structurée n'a été produite pour préparer le devis.
                      </p>
                    </div>
                  );
                }

                if (!hasValidBlock) return null;

                // Multi-project detection — block transfer until user confirms.
                const separationRequired = btpDocData?.projectSeparationRequired === true;
                const userChoice = projectSeparationChoice[i];
                if (separationRequired && userChoice !== 'same') {
                  return (
                    <div className="mt-4 border-t border-border pt-3 flex flex-col gap-3" dir="ltr">
                      <p className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        Plusieurs projets semblent être présents dans les documents. Confirmez d'abord s'il s'agit du même chantier ou de plusieurs chantiers.
                      </p>
                      {btpDocData?.projectSeparationReason && (
                        <p className="text-xs text-muted-foreground">
                          {btpDocData.projectSeparationReason}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setProjectSeparationChoice(prev => ({ ...prev, [i]: 'same' }))}
                          className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted"
                        >
                          Même chantier
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectSeparationChoice(prev => ({ ...prev, [i]: 'multiple' }))}
                          className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted"
                        >
                          Plusieurs chantiers
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectSeparationChoice(prev => ({ ...prev, [i]: 'unknown' }))}
                          className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted"
                        >
                          Je ne sais pas
                        </button>
                      </div>
                      {userChoice === 'multiple' && (
                        <p className="text-sm text-foreground bg-muted/60 border border-border rounded-lg p-3">
                          Analyse séparée nécessaire pour chaque chantier.
                        </p>
                      )}
                      {userChoice === 'unknown' && (
                        <p className="text-xs text-muted-foreground">
                          Transfert bloqué tant que le regroupement des documents n'est pas confirmé.
                        </p>
                      )}
                    </div>
                  );
                }


                return (
                  <div className="mt-4 border-t border-border pt-3 flex flex-col gap-2" dir="ltr">
                    {separationRequired && userChoice === 'same' && (
                      <p className="text-sm text-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        Vous avez confirmé qu'il s'agit d'un même chantier. Vérifiez soigneusement les écarts entre documents avant d'utiliser le devis.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Analyse documentaire BTP prête. Les prix absents ne sont pas inventés — complétez-les dans le Devis intelligent.
                    </p>
                    <button
                      type="button"
                      disabled={isPreparingTransfer}
                      onClick={() => { void transferToSmartDevis(btpDocData); }}
                      className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isPreparingTransfer ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {isPreparingTransfer ? 'Préparation des désignations professionnelles…' : 'Préparer dans le Devis intelligent'}
                    </button>
                  </div>
                );
              })()}

              {/* Post-analysis options panel */}
              {(() => {
                const effectiveBtpDocData = (btpDocStatus === 'ok' && btpDocData) ? btpDocData : panelDataAt[i];
                if (!(isLastAssistant && !isLoading && effectiveBtpDocData)) return null;
                if (pipelineStep) return null;
                const isDeepLoading = deepAnalysisLoadingIndex !== null;

                // ── Utilisateur final : uniquement les trois actions demandées,
                // affichées sous le rapport unique de compréhension du projet.
                if (!techMode) {
                  if (!isDeepResult) return null;
                  const finalActions = [
                    { key: 'quote', icon: Calculator, label: L.actionQuote },
                    { key: 'estimate', icon: Percent, label: L.actionEstimate },
                    { key: 'client-report', icon: Building, label: L.actionClientReport },
                  ];
                  return (
                    <div className="mt-4 border-t border-border pt-3" dir={isRTL ? 'rtl' : 'ltr'}>
                      <h3 className={cn("text-sm font-semibold text-foreground mb-3", isRTL && "font-cairo text-right")}>
                        {L.nextStep}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {finalActions.map((a) => {
                          const Icon = a.icon;
                          const busy = a.key === 'quote' && isPreparingTransfer;
                          return (
                            <button
                              key={a.key}
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (a.key === 'quote') void transferToSmartDevis(effectiveBtpDocData);
                                else setSelectedAnalysisOption(a.key);
                              }}
                              className={cn(
                                "flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
                                isRTL ? "flex-row-reverse text-right font-cairo" : "text-left"
                              )}
                            >
                              {busy
                                ? <Loader2 size={16} className="animate-spin text-primary shrink-0" />
                                : <Icon size={16} className="text-primary shrink-0" />}
                              <span className="text-sm font-semibold text-foreground min-w-0 break-words">{a.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedAnalysisOption && selectedAnalysisOption !== 'quote' && (
                        <p className={cn(
                          "mt-3 text-sm text-muted-foreground bg-muted/60 border border-border rounded-lg p-3",
                          isRTL && "font-cairo text-right"
                        )}>
                          {L.soon}
                        </p>
                      )}
                    </div>
                  );
                }

                // ── Mode test / administration : outils techniques conservés ──
                return (
                <div className="mt-4 border-t border-border pt-3" dir="ltr">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Que souhaitez-vous faire maintenant ?
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: 'deep-analysis', icon: Search, label: 'Analyse technique approfondie', help: 'Vérifier la compréhension du projet, les lots, les quantités et les points techniques.' },
                      { key: 'internal-report', icon: ClipboardList, label: 'Rapport interne artisan', help: 'Préparer les points de vigilance, les contrôles et les questions avant le devis.' },
                      { key: 'client-report', icon: Building, label: 'Rapport client / architecte', help: 'Générer une note professionnelle, neutre et prête à être transmise.' },
                      { key: 'lots', icon: Layers, label: 'Préparer les lots du devis', help: "Organiser automatiquement les prestations par corps d'état." },
                      { key: 'quantities', icon: Ruler, label: 'Vérifier les quantités', help: 'Contrôler les quantités extraites et identifier celles qui restent à confirmer.' },
                      { key: 'supplies', icon: Package, label: 'Fournitures client / entreprise', help: "Séparer les éléments fournis par le client de ceux à fournir par l'entreprise." },
                      { key: 'omissions', icon: AlertTriangle, label: 'Vérifier les oublis et incohérences', help: 'Rechercher les prestations manquantes, les doublons et les contradictions.' },
                      { key: 'questions', icon: HelpCircle, label: 'Préparer les questions à poser', help: "Créer la liste des informations à demander au client ou à l'architecte." },
                      { key: 'vat', icon: Percent, label: 'Vérifier les taux de TVA', help: 'Examiner les taux possibles selon les différentes prestations.' },
                      { key: 'quote', icon: Calculator, label: 'Préparer le devis', help: "Transformer l'analyse validée en projet de devis structuré, sans prix inventé." },
                    ].map((option) => {
                      const Icon = option.icon;
                      const isDeep = option.key === 'deep-analysis';
                      const isThisLoading = isDeep && isDeepLoading;
                      const disabled = isDeep && isDeepLoading;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (isDeep) {
                              runDeepAnalysis(i, effectiveBtpDocData);
                            } else {
                              setSelectedAnalysisOption(option.key);
                            }
                          }}
                          className="flex items-start gap-3 text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            {isThisLoading ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">
                              {isThisLoading ? 'Analyse technique approfondie en cours…' : option.label}
                            </div>
                            {isThisLoading ? (
                              <>
                                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                  Analyse approfondie en cours. Cette opération peut durer plusieurs minutes.
                                </div>
                                {deepAnalysisStreaming && (
                                  <div className="text-xs text-primary mt-1 leading-relaxed">
                                    Réponse en cours de génération…
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{option.help}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {/* TEMPORAIRE : test de l'extraction factuelle BTP */}
                  <button
                    type="button"
                    disabled={factualLoading}
                    onClick={() => runFactualExtraction(i, effectiveBtpDocData)}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary/50 bg-card text-foreground font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {factualLoading ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
                    {factualLoading ? 'Extraction factuelle en cours…' : 'Tester l’extraction factuelle'}
                  </button>
                  {selectedAnalysisOption && selectedAnalysisOption !== 'deep-analysis' && (
                    <p className="mt-3 text-sm text-muted-foreground bg-muted/60 border border-border rounded-lg p-3">
                      Cette fonction sera disponible prochainement.
                    </p>
                  )}
                </div>
                );
              })()}
            </div>
          );
          });
        })()}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>{t('aiAssistant.typing')}</span>
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input - positioned above bottom nav */}
      <div className="px-3 pt-3 border-t border-border bg-card/50 shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {/* Attachments preview */}
        {(attachments.length > 0 || isProcessingFile) && (
          <div className="mb-2 space-y-1.5">
            {isProcessingFile && (
              <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-xl p-2">
                <Loader2 size={16} className="animate-spin text-muted-foreground shrink-0" />
                <span className={cn("text-xs text-muted-foreground flex-1 truncate", isRTL && "font-cairo text-right")}>
                  {t('aiAssistant.file.reading')}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between bg-muted/60 border border-border rounded-xl p-2">
              <span className={cn("text-xs font-medium text-foreground", isRTL && "font-cairo text-right")}>
                {t('aiAssistant.files.selected').replace('{count}', String(attachments.length))}
              </span>
              <button
                type="button"
                onClick={() => setShowAttachmentsList(v => !v)}
                className={cn(
                  "text-xs font-medium text-primary flex items-center gap-1 shrink-0",
                  isRTL && "font-cairo flex-row-reverse"
                )}
                aria-label={showAttachmentsList ? t('aiAssistant.files.hide') : t('aiAssistant.files.show')}
              >
                {showAttachmentsList ? (
                  <>
                    {t('aiAssistant.files.hide')} <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    {t('aiAssistant.files.show')} <ChevronDown size={14} />
                  </>
                )}
              </button>
            </div>
            {showAttachmentsList && (
              <div className="max-h-[25vh] overflow-y-auto space-y-1.5 pr-1">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/60 border border-border rounded-xl p-2">
                    {att.kind === 'image' ? (
                      <img src={att.dataUrl} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-primary" />
                      </div>
                    )}
                    <span className={cn("text-xs font-medium text-foreground flex-1 truncate", isRTL && "font-cairo text-right")} dir="ltr">
                      {att.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 rounded-full hover:bg-muted text-muted-foreground shrink-0"
                      aria-label={t('aiAssistant.input.remove')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.jpg,.jpeg,.png,.pdf,.docx"
          multiple
          className="hidden"
          onChange={handleFileSelected}
        />

        <div className="relative flex items-end gap-2 bg-background p-1.5 rounded-3xl border border-border focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          {/* Mic button */}
          <button
            type="button"
            onClick={handleVoiceMicPress}
            disabled={isLoading}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all",
              dictation.isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
            )}
          >
            <Mic size={20} />
          </button>
          {/* File attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isProcessingFile}
            aria-label={t('aiAssistant.input.attach')}
            title={t('aiAssistant.input.attachTitle')}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-muted-foreground hover:bg-muted transition-all disabled:opacity-50"
          >
            <Paperclip size={20} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); setUserHasEdited(true); }}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => { if (!input.trim()) { setIsInputFocused(false); resetTextareaHeight(); } }}
            placeholder={t('aiAssistant.input.placeholder')}
            disabled={isLoading}
            className={cn(
              "flex-1 text-[15px] font-medium px-2 py-2.5 outline-none text-foreground placeholder:text-muted-foreground resize-none leading-[1.5] rounded-lg transition-[height,background-color] duration-200 overflow-y-auto",
              isInputFocused ? "bg-muted/40" : "bg-transparent",
              isRTL && "font-cairo text-right"
            )}
            style={{
              minHeight: '44px',
              maxHeight: '200px',
              transition: 'height 0.2s ease, min-height 0.2s ease, background-color 0.2s ease',
            }}
            dir="auto"
            rows={1}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }}
            onKeyDown={(e) => {
              // Bug 4: Enter SEUL = saut de ligne. Shift+Entrée = envoyer.
              if (e.key === 'Enter' && !e.shiftKey) {
                // Bloque tout listener parent qui pourrait envoyer, laisse le default newline.
                e.stopPropagation();
                return;
              }
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if ((input.trim() || attachments.length > 0) && !isLoading) send();
              }
            }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={(!input.trim() && attachments.length === 0) || isLoading}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5",
              (input.trim() || attachments.length > 0) && !isLoading
                ? "bg-primary text-primary-foreground shadow-md active:scale-90"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send size={18} />
          </button>

        </div>

        {/* Analyse en cours : un seul écran, une seule barre de progression */}
        {jobActive && (
          <div className="px-3 pb-3" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <Loader2 size={16} className="animate-spin text-primary shrink-0" />
                <h3 className={cn("text-sm font-bold text-foreground", isRTL && "font-cairo text-right")}>
                  {L.runningTitle}
                </h3>
              </div>
              <p className={cn("text-xs text-muted-foreground leading-relaxed", isRTL && "font-cairo text-right")}>
                {L.runningText}
              </p>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${jobProgressValue}%` }}
                />
              </div>
              <p className={cn("text-xs font-semibold text-foreground", isRTL && "font-cairo text-right")}>
                {jobProgressLabel}
              </p>
              {techMode && (
                <p className="text-[11px] text-muted-foreground font-mono break-all">
                  {job?.id} · {job?.status} · {job?.current_step} · {job?.progress}%
                  {job?.error_message ? ` · ${job.error_message}` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Échec confirmé : relance explicite */}
        {job?.status === 'failed' && (
          <div className="px-3 pb-3" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className={cn("text-sm font-semibold text-foreground", isRTL && "font-cairo text-right")}>
                {L.failedTitle}
              </p>
              <button
                type="button"
                onClick={() => { void retryPersistentAnalysis(); }}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-transform",
                  isRTL && "font-cairo"
                )}
              >
                <Sparkles size={16} />
                {L.retry}
              </button>
              {techMode && job.error_message && (
                <p className="text-[11px] text-muted-foreground font-mono break-all">{job.error_message}</p>
              )}
            </div>
          </div>
        )}

        {/* Point d'entrée unique : lance tout le parcours d'analyse */}
        <div className="px-3 pb-3" dir={isRTL ? 'rtl' : 'ltr'}>
          <button
            type="button"
            onClick={() => {
              // Mode test : pipeline visible dans le navigateur (étapes détaillées).
              if (techMode) { void runFullProjectAnalysis(); return; }
              void startPersistentAnalysis();
            }}
            disabled={(!input.trim() && attachments.length === 0) || isLoading || pipelineStep !== null || startingJob || jobActive}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed bg-primary text-primary-foreground",
              isRTL && "font-cairo"
            )}
          >
            {(pipelineStep || startingJob || jobActive) ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {pipelineStep ? (pipelineLabel || L.analyzing) : (startingJob || jobActive) ? L.analyzing : L.analyzeProject}
          </button>
        </div>

      </div>

      {/* Room Scanner Modal */}
      <RoomScannerModal open={showScanner} onClose={() => setShowScanner(false)} isRTL={isRTL} />

      {/* Fullscreen Voice Dictation Modal */}
      <FullscreenVoiceModal
        open={voiceModalOpen}
        isRecording={dictation.isRecording}
        transcript={dictation.transcript}
        duration={dictation.duration}
        onStop={handleVoiceStop}
        onSend={handleVoiceSend}
        onCancel={handleVoiceCancel}
        isRTL={isRTL}
      />
    </div>
  );
};

export default AIAssistantPage;
