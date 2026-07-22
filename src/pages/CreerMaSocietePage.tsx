import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, LogIn, Sparkles, FileText, BarChart3, Package, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import anafyProLogo from '@/assets/anafy-pro-logo.png';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';

type Msg = { role: 'bot' | 'user'; content: string };

// Options : `value` = valeur canonique arabe envoyée à l'Edge Function (logique métier inchangée)
// `label` = libellé affiché dans la langue active.
type OptionItem = { value: string; label: string };
type Question = {
  key: string;
  text: string;
  placeholder?: string;
  options?: OptionItem[];
};

const hasArabicOrLatinLetter = (s: string) => /[A-Za-z\u0600-\u06FF]/.test(s);
const VTC_REGEX = /(uber|vtc|taxi|توصيل|سواق)/i;
const RESIDENCE_BLOCK_REGEX = /لا،?\s*ولا واحدة|ولا واحدة منهم|❌/;


const CreerMaSocietePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t, isRTL, language } = useLanguage();

  const QUESTIONS: Question[] = useMemo(() => [
    {
      key: 'activite',
      text: t('createCompany.q.activite.text'),
      placeholder: t('createCompany.q.activite.placeholder'),
    },
    {
      key: 'associes',
      text: t('createCompany.q.associes.text'),
      options: [
        { value: 'لوحدي 👤', label: t('createCompany.q.associes.opt1') },
        { value: 'معايا شركاء 👥', label: t('createCompany.q.associes.opt2') },
      ],
    },
    {
      key: 'revenus',
      text: t('createCompany.q.revenus.text'),
      options: [
        { value: 'أقل من €77,700', label: t('createCompany.q.revenus.opt1') },
        { value: 'بين €77,700 و €200,000', label: t('createCompany.q.revenus.opt2') },
        { value: 'أكتر من €200,000', label: t('createCompany.q.revenus.opt3') },
      ],
    },
    {
      key: 'residence',
      text: t('createCompany.q.residence.text'),
      options: [
        { value: 'جنسية فرنسية 🇫🇷', label: t('createCompany.q.residence.opt1') },
        { value: 'إقامة فرنسية سارية 🪪', label: t('createCompany.q.residence.opt2') },
        { value: 'جنسية دولة من الاتحاد الأوروبي 🇪🇺', label: t('createCompany.q.residence.opt3') },
        { value: 'لا، ولا واحدة منهم ❌', label: t('createCompany.q.residence.opt4') },
      ],
    },
    {
      key: 'capital',
      text: t('createCompany.q.capital.text'),
      placeholder: t('createCompany.q.capital.placeholder'),
    },
  ], [t]);

  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [errorFallback, setErrorFallback] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialise / met à jour le premier message quand la langue change avant le début.
  useEffect(() => {
    if (step === 0 && messages.length <= 1 && !recommendation && !analyzing) {
      setMessages([{ role: 'bot', content: QUESTIONS[0].text }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [QUESTIONS[0].text]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, recommendation, analyzing, errorFallback, blockedMessage]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const runAnalysis = async (finalAnswers: Record<string, string>) => {
    setAnalyzing(true);
    setErrorFallback(false);
    try {
      const { data, error } = await supabase.functions.invoke('wizard-societe', {
        body: { answers: finalAnswers },
      });
      if (error) throw error;
      const content = data?.content || data?.message;
      if (!content) throw new Error('empty response');
      const truncated = data?.truncated === true || data?.finish_reason === 'length' || data?.finish_reason === 'MAX_TOKENS';
      setRecommendation(truncated ? `${content}\n\n${t('createCompany.analysis.truncated')}` : content);
    } catch (e) {
      console.error('wizard analysis error', e);
      toast.error(t('createCompany.error.generic'));
      setErrorFallback(true);
    } finally {
      setAnalyzing(false);
    }
  };

  const submitAnswer = (opt: OptionItem | string) => {
    if (analyzing || recommendation) return;
    const current = QUESTIONS[step];
    const canonicalValue = typeof opt === 'string' ? opt : opt.value;
    const displayValue = typeof opt === 'string' ? opt : opt.label;
    const newAnswers = { ...answers, [current.key]: canonicalValue };
    setAnswers(newAnswers);
    setMessages((m) => [...m, { role: 'user', content: displayValue }]);
    setInput('');

    if (current.key === 'activite' && VTC_REGEX.test(canonicalValue)) {
      setTimeout(() => setBlockedMessage(t('createCompany.blocked.vtc')), 400);
      return;
    }

    if (current.key === 'residence' && RESIDENCE_BLOCK_REGEX.test(canonicalValue)) {
      setTimeout(() => setBlockedMessage(t('createCompany.blocked.residence')), 400);
      return;
    }


    const next = step + 1;
    if (next < QUESTIONS.length) {
      setTimeout(() => {
        setMessages((m) => [...m, { role: 'bot', content: QUESTIONS[next].text }]);
        setStep(next);
      }, 400);
    } else {
      setTimeout(() => {
        setMessages((m) => [...m, { role: 'bot', content: t('createCompany.analyzing.msg') }]);
        runAnalysis(newAnswers);
      }, 400);
    }
  };

  const handleSend = () => {
    const value = input.trim();
    if (!value) return;
    const current = QUESTIONS[step];
    if (current.key === 'activite') {
      if (value.length < 3 || !hasArabicOrLatinLetter(value)) {
        toast.info(t('createCompany.validate.tooShort'));
        return;
      }
    }
    submitAnswer(value);
  };

  const handleCtaClick = () => {
    navigate(isAuthenticated ? '/paiement-creation' : '/login');
  };

  const currentQuestion = QUESTIONS[step];
  const showOptions = !showChecklist && !recommendation && !analyzing && !errorFallback && !blockedMessage && currentQuestion?.options;
  const showInput = !showChecklist && !recommendation && !analyzing && !errorFallback && !blockedMessage && !currentQuestion?.options;

  const userAlign = isRTL ? 'justify-start' : 'justify-end';
  const botAlign = isRTL ? 'justify-end' : 'justify-start';
  const userCorner = isRTL ? 'rounded-bl-none' : 'rounded-br-none';
  const botCorner = isRTL ? 'rounded-br-none' : 'rounded-bl-none';
  const textAlignCls = isRTL ? 'text-right' : 'text-left';

  return (
    <div className="min-h-screen bg-background font-cairo" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 text-white" style={{ backgroundColor: '#1E3A8A' }}>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate('/')}>
            <img src={anafyProLogo} alt="Anafy Pro" className="h-9 w-auto object-contain" />
            <h1 className="text-base font-bold">Anafy Pro</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/login')}
            className="rounded-full h-8 px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold gap-1"
          >
            <LogIn className="h-4 w-4" />
            {t('createCompany.header.login')}
          </Button>
        </div>
      </header>

      <main className="pt-14 pb-40 px-3 max-w-2xl mx-auto">
        {showChecklist && (
          <div className="my-6 rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h2 className={cn('text-lg font-bold text-card-foreground', textAlignCls)}>
              {t('createCompany.checklist.title')}
            </h2>
            <ul className={cn('space-y-2 text-sm text-card-foreground', textAlignCls)}>
              <li>• {t('createCompany.checklist.item1')}</li>
              <li>• {t('createCompany.checklist.item2')}</li>
              <li>• {t('createCompany.checklist.item3')}</li>
              <li>• {t('createCompany.checklist.item4')}</li>
              <li>• {t('createCompany.checklist.item5')}</li>
            </ul>
            <div className={cn('text-sm text-muted-foreground', textAlignCls)}>
              {t('createCompany.checklist.help')}
            </div>
            <div className="flex flex-col gap-3">
              <Button variant="outline" className="w-full font-bold" onClick={() => navigate('/ai-assistant')}>
                {t('createCompany.checklist.askAI')}
              </Button>
              <Button className="w-full font-bold" onClick={() => setShowChecklist(false)}>
                {t('createCompany.checklist.eligible')}
              </Button>
            </div>
          </div>
        )}

        {!showChecklist && (
          <div ref={scrollRef} className="space-y-3 py-4">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? userAlign : botAlign)}>
                <div
                  className={cn(
                    'max-w-[85%] p-3.5 rounded-2xl shadow-sm whitespace-pre-wrap text-sm leading-relaxed',
                    m.role === 'user'
                      ? cn('bg-primary text-primary-foreground', userCorner)
                      : cn('bg-card text-card-foreground border border-border', botCorner)
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {analyzing && (
              <div className={cn('flex', botAlign)}>
                <div className={cn('bg-card border border-border rounded-2xl p-3 flex items-center gap-2', botCorner)}>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">{t('createCompany.analyzing.badge')}</span>
                </div>
              </div>
            )}

            {errorFallback && (
              <div className={cn('flex', botAlign)}>
                <div className={cn('max-w-[95%] bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3', botCorner)}>
                  <p className={cn('text-sm text-card-foreground leading-relaxed', textAlignCls)}>
                    {t('createCompany.error.title')}
                  </p>
                  <Button className="w-full font-bold gap-2" onClick={() => navigate('/ai-assistant')}>
                    <MessageCircle className="h-4 w-4" />
                    {t('createCompany.error.askAI')}
                  </Button>
                </div>
              </div>
            )}

            {blockedMessage && (
              <div className={cn('flex', botAlign)}>
                <div className={cn('max-w-[95%] bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3', botCorner)}>
                  <p className={cn('text-sm text-card-foreground leading-relaxed', textAlignCls)}>
                    {blockedMessage}
                  </p>
                  <Button className="w-full font-bold gap-2" onClick={() => navigate('/ai-assistant')}>
                    <MessageCircle className="h-4 w-4" />
                    {t('createCompany.error.askAI')}
                  </Button>
                </div>
              </div>
            )}

            {recommendation && (
              <>
                <div className={cn('flex', botAlign)}>
                  <div className={cn('max-w-[95%] bg-card border border-border rounded-2xl p-4 shadow-sm', botCorner)}>
                    <MarkdownRenderer content={recommendation} isRTL={isRTL} />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl p-5 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-bold text-primary">{t('createCompany.cta.title')}</h3>
                  </div>

                  <div className="grid gap-3">
                    <button
                      onClick={handleCtaClick}
                      className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between hover:border-primary transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="text-sm font-bold">{t('createCompany.cta.statuts')}</span>
                      </div>
                      <span className="text-lg font-bold text-primary" dir="ltr">49€</span>
                    </button>

                    <button
                      onClick={handleCtaClick}
                      className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between hover:border-primary transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        <span className="text-sm font-bold">{t('createCompany.cta.previsionnel')}</span>
                      </div>
                      <span className="text-lg font-bold text-primary" dir="ltr">29€</span>
                    </button>

                    <button
                      onClick={handleCtaClick}
                      className="w-full p-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-between shadow-md active:scale-[0.98] border-2 border-primary"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5" />
                        <span className="text-sm font-bold">{t('createCompany.cta.package')}</span>
                      </div>
                      <span className="text-lg font-bold" dir="ltr">89€</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {showOptions && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">
            {currentQuestion.options!.map((opt) => (
              <Button
                key={opt.value}
                onClick={() => submitAnswer(opt)}
                variant="outline"
                className="w-full font-bold text-base py-6 justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {showInput && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={currentQuestion?.placeholder}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={cn('flex-1 font-cairo text-base', isRTL ? 'text-right' : 'text-left')}
              style={{ fontSize: '16px' }}
            />
            <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreerMaSocietePage;
