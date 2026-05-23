import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Send, Sparkles, Mic, ScanLine, MessageSquarePlus, History, X, Trash2, Paperclip, FileText, Loader2, Copy, Check } from 'lucide-react';
import { extractTextFromPDF } from '@/lib/pdfExtractor';
import RoomScannerModal from '@/components/scanner/RoomScannerModal';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { useAssistantDictation } from '@/hooks/useAssistantDictation';
import FullscreenVoiceModal from '@/components/assistant/FullscreenVoiceModal';
import MissingInfoForm from '@/components/assistant/MissingInfoForm';

type ConversationSummary = { id: string; title: string | null; updated_at: string };

type Msg = { role: 'user' | 'assistant'; content: string };
type CategoryKey = 'مهني' | 'اداري' | 'قانوني' | 'شخصي' | null;

const CATEGORIES: { key: CategoryKey; emoji: string; labelAr: string; labelFr: string }[] = [
  { key: 'مهني', emoji: '🔧', labelAr: 'مهني', labelFr: 'Pro' },
  { key: 'اداري', emoji: '🏛️', labelAr: 'اداري', labelFr: 'Admin' },
  { key: 'قانوني', emoji: '⚖️', labelAr: 'قانوني', labelFr: 'Juridique' },
  { key: 'شخصي', emoji: '💡', labelAr: 'شخصي', labelFr: 'Personnel' },
];

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const LETTER_MARKER = '===الرسالة_الرسمية===';

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


const AIAssistantPage = () => {
  const { language, isRTL } = useLanguage();
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
  type Attachment =
    | { kind: 'image'; name: string; dataUrl: string }
    | { kind: 'pdf'; name: string; text: string };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
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
      toast({ variant: 'destructive', title: isRTL ? 'غير مدعوم' : 'Non supporté' });
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
      if (!isImage && !isPdf) {
        toast({ variant: 'destructive', title: isRTL ? 'نوع الملف غير مدعوم' : 'Format non supporté', description: file.name });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ variant: 'destructive', title: isRTL ? 'الملف كبير أوي' : 'Fichier trop volumineux', description: file.name });
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (isImage) {
          added.push({ kind: 'image', name: file.name, dataUrl });
        } else {
          const text = await extractTextFromPDF(dataUrl);
          added.push({ kind: 'pdf', name: file.name, text: text.slice(0, 50000) });
        }
      } catch (err) {
        console.error('File processing error:', err);
        toast({ variant: 'destructive', title: isRTL ? 'حصل مشكلة في الملف' : 'Erreur de lecture', description: file.name });
      }
    }
    if (added.length > 0) setAttachments(prev => [...prev, ...added]);
    setIsProcessingFile(false);
  };

  const send = async (overrideText?: string) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim();
    if ((!text && attachments.length === 0) || isLoading) return;

    const currentAttachments = attachments;
    const displayText = text || (currentAttachments.length > 0
      ? `📎 ${currentAttachments.map(a => a.name).join(', ')}`
      : '');

    const userMsg: Msg = { role: 'user', content: displayText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setUserHasEdited(false);
    setIsInputFocused(false);
    resetTextareaHeight();
    if (textareaRef.current) textareaRef.current.blur();
    setIsLoading(true);

    // Intercept: agent comptable
    if (currentAttachments.length === 0 && isAccountingCommand(text)) {
      const report = await generateAccountingReport();
      setMessages(prev => [...prev, { role: 'assistant', content: report }]);
      setIsLoading(false);
      return;
    }

    let assistantSoFar = '';

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Bug 3: Always fetch latest profile inline if not loaded yet
      let liveProfile: any = profile;
      if (!liveProfile && user?.id) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('full_name, address, phone, email, company_name, siret, company_address')
            .eq('user_id', user.id)
            .maybeSingle();
          if (data) liveProfile = data;
        } catch (e) { console.warn('inline profile fetch failed', e); }
      }

      const userProfilePayload = liveProfile || user ? {
        full_name: liveProfile?.full_name || null,
        address: liveProfile?.address || null,
        phone: liveProfile?.phone || null,
        email: liveProfile?.email || user?.email || null,
        company_name: liveProfile?.company_name || null,
        siret: liveProfile?.siret || null,
        company_address: liveProfile?.company_address || null,
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
              : { kind: 'pdf', name: currentAttachments[0].name, text: currentAttachments[0].text }
            : null,
          attachments: currentAttachments.map(a =>
            a.kind === 'image'
              ? { kind: 'image', name: a.name, dataUrl: a.dataUrl }
              : { kind: 'pdf', name: a.name, text: a.text }
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
        let errorMsg = language === 'ar' 
          ? 'عذراً، نظام الذكاء الاصطناعي يواجه ضغطاً، حاول مجدداً 🔄' 
          : 'Service IA temporairement indisponible, réessayez 🔄';
        try {
          const errData = await resp.json();
          if (errData?.error) errorMsg = errData.error;
        } catch {}
        console.error('AI Assistant error:', resp.status);
        upsert(errorMsg);
        setIsLoading(false);
        return;
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
    } catch {
      upsert(language === 'ar' ? 'حصل مشكلة، جرب تاني 🔄' : 'Erreur réseau, réessayez.');
      setIsLoading(false);
    }
    setIsLoading(false);
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
              {isRTL ? 'المساعد الذكي' : 'Assistant IA'}
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
                {isRTL ? 'قبل ما نبدأ يا فندم 🧞' : 'Avant de commencer 🧞'}
              </h2>
              <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
                {isRTL ? 'عشان أقدر أساعدك بشكل أفضل' : 'Pour mieux vous aider'}
              </p>
            </div>

            <div className="space-y-4" style={{ animation: 'fade-in 0.5s ease-out 0.2s both' }}>
              <div>
                <label className={cn("block text-sm font-bold text-foreground mb-1.5", isRTL && "font-cairo text-right")}>
                  {isRTL ? 'اسمك الأول' : 'Votre prénom'}
                </label>
                <input
                  type="text"
                  value={onboardingName}
                  onChange={e => setOnboardingName(e.target.value)}
                  placeholder={isRTL ? 'مثلاً: أحمد' : 'Ex: Ahmed'}
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
                  {isRTL ? 'النوع' : 'Genre'}
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
                {isRTL ? 'يلا نبدأ! 🚀' : 'C\'est parti ! 🚀'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[calc(100dvh-3.5rem-3.5rem)] bg-background">
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
            {isRTL ? 'المساعد الذكي' : 'Assistant IA'}
          </h1>
        </div>
        <button
          onClick={() => setShowConversationList(v => !v)}
          className={cn(
            "p-2 rounded-full hover:bg-muted transition-colors",
            showConversationList && "bg-muted"
          )}
          aria-label={isRTL ? 'المحادثات' : 'Conversations'}
          title={isRTL ? 'المحادثات' : 'Conversations'}
        >
          <History size={18} className="text-foreground" />
        </button>
        <button
          onClick={handleNewConversation}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label={isRTL ? 'محادثة جديدة' : 'Nouvelle conversation'}
          title={isRTL ? 'محادثة جديدة' : 'Nouvelle conversation'}
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
                {isRTL ? 'المحادثات' : 'Conversations'}
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
              {isRTL ? 'محادثة جديدة' : 'Nouvelle conversation'}
            </button>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {conversations.length === 0 ? (
                <p className={cn("text-center text-sm text-muted-foreground py-6", isRTL && "font-cairo")}>
                  {isRTL ? 'مفيش محادثات لسه' : 'Aucune conversation'}
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
                              {c.title || (isRTL ? 'محادثة جديدة' : 'Nouvelle conversation')}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{dateStr}</p>
                          </div>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => handleDeleteConversation(c.id, e)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDeleteConversation(c.id, e as any); }}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                            aria-label={isRTL ? 'حذف' : 'Supprimer'}
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
              {isRTL ? 'المحادثات بتتمسح أوتوماتيكي بعد 30 يوم' : 'Suppression auto après 30 jours'}
            </p>
          </div>
        </div>
      )}


      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <Sparkles size={40} className="text-primary mb-4" />
            <p className={cn("text-muted-foreground text-lg font-bold", isRTL && "font-cairo")}>
              {isRTL ? `أهلاً يا ${userInfo?.name || 'فندم'}، اسأل وأنا أجاوب! 🧞` : `Bonjour ${userInfo?.name || ''}, posez votre question ! 🧞`}
            </p>
            <p className={cn("text-muted-foreground text-sm mt-2 mb-4", isRTL && "font-cairo")}>
              {isRTL ? 'اسألني أي حاجة' : 'Posez vos questions'}
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
                  {cat.emoji} {isRTL ? cat.labelAr : cat.labelFr}
                </button>
              ))}
            </div>
            {/* Room Scanner Button */}
            <button
              onClick={() => setShowScanner(true)}
              className="px-5 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-sm flex items-center gap-2 hover:bg-primary/20 active:scale-95 transition-all"
            >
              <ScanLine size={18} />
              {isRTL ? '📐 سكانير الغرفة' : '📐 Scanner la pièce'}
            </button>
          </div>
        )}

        {messages.map((msg, i) => {
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
          // Strip the JSON block from the visible content if it was a form payload
          const visibleContent = missingForm
            ? msg.content
                .replace(/```(?:json)?\s*\{[\s\S]*?"missing_info_form"[\s\S]*?\}\s*```/gi, '')
                .replace(/\{[\s\S]*?"type"\s*:\s*"missing_info_form"[\s\S]*?\}/g, '')
                .trim()
            : msg.content;
          const { preface, letter: rawLetter } = splitLetter(visibleContent);
          const letter = rawLetter ? fillPlaceholders(rawLetter, profile) : null;
          const isFormalFrench = !!letter;
          const copyText = letter ? stripMarkdownForCopy(letter) : visibleContent;
          const isLastAssistant = i === messages.length - 1;
          return (
            <div key={i} className="w-full relative">
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

              {/* Optional Arabic preface (only when letter present) */}
              {letter && preface && (
                <MarkdownRenderer
                  content={preface}
                  isRTL={isArabic(preface)}
                  className="!text-[15px] !leading-[1.6] text-foreground mb-3"
                />
              )}

              {/* Either the formal French letter, or the regular response */}
              {visibleContent && (
                <div {...(isFormalFrench ? { dir: 'ltr' as const } : {})}>
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
                        idx === i ? { ...m, content: visibleContent || (isRTL ? '(تم الإلغاء)' : '(annulé)') } : m
                      ));
                    }}
                    onSubmit={(data) => {
                      const summary = Object.entries(data)
                        .map(([k, v]) => `- ${k}: ${v}`)
                        .join('\n');
                      const reply = (isRTL
                        ? 'هاكي البيانات الناقصة:\n'
                        : 'Voici les informations manquantes :\n') + summary;
                      void send(reply);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>{isRTL ? 'يكتب' : 'écrit'}</span>
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
                  {isRTL ? 'جاري قراءة الملفات...' : 'Lecture des fichiers...'}
                </span>
              </div>
            )}
            {attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-muted/60 border border-border rounded-xl p-2">
                {att.kind === 'image' ? (
                  <img src={att.dataUrl} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-primary" />
                  </div>
                )}
                <span className={cn("text-xs font-medium text-foreground flex-1 truncate", isRTL && "font-cairo text-right")}>
                  {att.name}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  className="p-1 rounded-full hover:bg-muted text-muted-foreground shrink-0"
                  aria-label={isRTL ? 'حذف' : 'Retirer'}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
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
            aria-label={isRTL ? 'إرفاق ملف' : 'Joindre un fichier'}
            title={isRTL ? 'إرفاق صورة أو PDF' : 'Joindre une image ou un PDF'}
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
            placeholder={isRTL ? 'اكتب سؤالك هنا...' : 'Écrivez votre question...'}
            disabled={isLoading}
            className={cn(
              "flex-1 text-[15px] font-medium px-2 py-2.5 outline-none text-foreground placeholder:text-muted-foreground resize-none leading-[1.5] rounded-lg transition-[height,background-color] duration-200 overflow-y-auto",
              isInputFocused ? "bg-muted/40" : "bg-transparent",
              isRTL && "font-cairo text-right"
            )}
            style={{
              minHeight: isInputFocused ? (typeof window !== 'undefined' && window.innerWidth < 768 ? '40vh' : '120px') : '44px',
              maxHeight: '200px',
              transition: 'height 0.2s ease, min-height 0.2s ease, background-color 0.2s ease',
            }}
            dir="auto"
            rows={1}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }}
            onKeyDown={(e) => {
              // Bug 5: Enter alone = newline (default behavior). Shift+Enter = send.
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if ((input.trim() || attachment) && !isLoading) send();
              }
            }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={(!input.trim() && !attachment) || isLoading}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5",
              (input.trim() || attachment) && !isLoading
                ? "bg-primary text-primary-foreground shadow-md active:scale-90"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send size={18} />
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
