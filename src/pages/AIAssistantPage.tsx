import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ArrowLeft, Send, Sparkles, Mic, ScanLine } from 'lucide-react';
import RoomScannerModal from '@/components/scanner/RoomScannerModal';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { useAssistantDictation } from '@/hooks/useAssistantDictation';
import FullscreenVoiceModal from '@/components/assistant/FullscreenVoiceModal';

type Msg = { role: 'user' | 'assistant'; content: string };
type CategoryKey = 'مهني' | 'اداري' | 'قانوني' | 'شخصي' | null;

const CATEGORIES: { key: CategoryKey; emoji: string; labelAr: string; labelFr: string }[] = [
  { key: 'مهني', emoji: '🔧', labelAr: 'مهني', labelFr: 'Pro' },
  { key: 'اداري', emoji: '🏛️', labelAr: 'اداري', labelFr: 'Admin' },
  { key: 'قانوني', emoji: '⚖️', labelAr: 'قانوني', labelFr: 'Juridique' },
  { key: 'شخصي', emoji: '💡', labelAr: 'شخصي', labelFr: 'Personnel' },
];

const STREAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

interface UserInfo {
  name: string;
  gender: 'male' | 'female';
}

const AIAssistantPage = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingGender, setOnboardingGender] = useState<'male' | 'female'>('male');
  const [showScanner, setShowScanner] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
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

  const handleOnboardingSubmit = () => {
    const name = onboardingName.trim();
    if (!name) return;
    setUserInfo({ name, gender: onboardingGender });
    setShowOnboarding(false);
  };

  // ── Voice: dictation dedicated to this page ──
  const handleVoiceSend = useCallback(() => {
    // Stop recording first to flush any in-flight result
    if (dictation.isRecording) dictation.stopRecording();
    const cleaned = dictation.getCleanedText();
    if (cleaned) {
      setInput(prev => (prev ? prev + ' ' + cleaned : cleaned));
    }
    dictation.cancel();
    setVoiceModalOpen(false);
  }, [dictation]);

  const handleVoiceStop = useCallback(() => {
    // Pause recording but KEEP transcript visible so user can review
    dictation.stopRecording();
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

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Intercept: agent comptable
    if (isAccountingCommand(text)) {
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

      const resp = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          language: language === 'ar' ? 'ar' : 'fr',
          userName: userInfo?.name || null,
          userGender: userInfo?.gender || null,
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

        <div className="flex-1 flex items-center justify-center p-6">
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
    <div className="flex flex-col h-[calc(100dvh-3.5rem-3.5rem)] bg-background">
      {/* Header */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          return (
            <div key={i} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-1">
                  <Sparkles size={14} className="text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] p-3.5 rounded-2xl shadow-sm",
                  isUser
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-card text-card-foreground border border-border rounded-bl-none",
                )}
              >
                {isUser ? (
                  <span className={cn("text-[13px] leading-relaxed whitespace-pre-wrap", textAr ? "font-cairo text-right" : "text-left")} dir={textAr ? "rtl" : "ltr"}>
                    {msg.content}
                  </span>
                ) : (
                  <MarkdownRenderer content={msg.content} isRTL={textAr} onSmartLinkClick={(type) => {
                    if (type === 'cv') navigate('/pro/cv-generator');
                    else if (type === 'pro') navigate('/pro/invoice-creator');
                    else if (type === 'solutions') navigate('/premium-consultation');
                  }} />
                )}
              </div>
            </div>
          );
        })}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-1">
              <Sparkles size={14} className="text-primary" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-none p-3.5 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input - positioned above bottom nav */}
      <div className="p-3 border-t border-border bg-background shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="relative flex items-center gap-2 bg-muted p-1.5 rounded-[2rem] border border-border focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          {/* Mic button — opens fullscreen voice modal */}
          <button
            type="button"
            onClick={handleVoiceMicPress}
            disabled={isLoading}
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
          >
            <Mic size={22} />
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isRTL ? 'اكتب سؤالك هنا...' : 'Écrivez votre question...'}
            disabled={isLoading}
            className={cn(
              "flex-1 bg-transparent text-sm font-medium px-3 py-2 outline-none text-foreground placeholder:text-muted-foreground resize-none min-h-[36px] max-h-[120px]",
              isRTL && "font-cairo text-right"
            )}
            dir="auto"
            rows={1}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); } }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || isLoading}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all shrink-0",
              input.trim() && !isLoading
                ? "bg-primary text-primary-foreground"
                : "bg-muted-foreground/20 text-muted-foreground"
            )}
          >
            <Send size={18} />
          </button>
        </div>

        {/* Subtitle */}
        <div className="pt-2 pb-1 text-center">
          <p className="text-xs font-bold text-foreground font-cairo" dir="rtl">
            اسألني أي حاجة
          </p>
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
