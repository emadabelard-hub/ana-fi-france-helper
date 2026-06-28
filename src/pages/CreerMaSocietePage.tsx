import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, LogIn, Sparkles, FileText, BarChart3, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import anafyProLogo from '@/assets/anafy-pro-logo.png';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';

type Msg = { role: 'bot' | 'user'; content: string };

const QUESTIONS = [
  {
    key: 'activite',
    text: 'أهلاً! أنا هساعدك تفتح شركتك في فرنسا خطوة بخطوة 🇫🇷\n\nالأول قولي، هتشتغل في إيه بالظبط؟ (دهانات، بلاط، سباكة، كهرباء، بناء، أو غيره؟)',
    placeholder: 'مثلاً: دهانات',
  },
  {
    key: 'associes',
    text: 'تمام 👍\n\nهتشتغل لوحدك ولا معاك شركاء؟',
    placeholder: 'لوحدي / مع شركاء',
  },
  {
    key: 'revenus',
    text: 'متوقع دخلك السنوي كام تقريباً؟\n\n(أقل من 77,700€ / بين 77,700€ و 200,000€ / أكتر من 200,000€)',
    placeholder: 'مثلاً: أقل من 77,700€',
  },
  {
    key: 'residence',
    text: 'عندك إقامة فرنسية سارية أو جنسية فرنسية؟',
    placeholder: 'أيوة / لأ',
  },
  {
    key: 'capital',
    text: 'تمام 🙏\n\nعندك رأس مال عايز تبدأ بيه؟ وكام تقريباً؟',
    placeholder: 'مثلاً: 5000€ أو لأ',
  },
] as const;

const CreerMaSocietePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'bot', content: QUESTIONS[0].text }]);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, recommendation, analyzing]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const runAnalysis = async (finalAnswers: Record<string, string>) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('wizard-societe', {
        body: {
          answers: finalAnswers,
          conversationHistory: messages.slice(0, -1).map(m => ({
            role: m.role === 'bot' ? 'assistant' : 'user',
            content: m.content,
          })),
        },
      });
      if (error) throw error;
      setRecommendation(data?.content || 'حصل خطأ في التحليل. حاول تاني.');
    } catch (e) {
      console.error('wizard analysis error', e);
      // Fallback déterministe
      const seul = /لوحد|وحدي|alone|seul/i.test(finalAnswers.associes || '');
      const lowRev = /77|أقل|moins/i.test(finalAnswers.revenus || '');
      let type = 'SARL';
      let why = 'عشان فيه شركاء، الـ SARL هي الأنسب.';
      if (seul) {
        if (lowRev) {
          type = 'Auto-entrepreneur';
          why = 'عشان لوحدك ودخلك تحت 77,700€، الـ Auto-entrepreneur أبسط وأسرع حاجة.';
        } else {
          type = 'SASU';
          why = 'عشان لوحدك بس الدخل أعلى أو محتاج assurance décennale، الـ SASU بتحميك أكتر.';
        }
      }
      setRecommendation(`## التوصية\n**${type}** — ${why}\n\n## الخطوات المطلوبة\n1. تجهيز الوثائق (إقامة + إثبات عنوان)\n2. اختيار اسم الشركة\n3. التسجيل في URSSAF / Greffe\n4. فتح حساب بنكي مهني\n5. الاشتراك في التأمينات اللازمة`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSend = () => {
    const value = input.trim();
    if (!value || analyzing || recommendation) return;
    const current = QUESTIONS[step];
    const newAnswers = { ...answers, [current.key]: value };
    setAnswers(newAnswers);
    setMessages((m) => [...m, { role: 'user', content: value }]);
    setInput('');

    const next = step + 1;
    if (next < QUESTIONS.length) {
      setTimeout(() => {
        setMessages((m) => [...m, { role: 'bot', content: QUESTIONS[next].text }]);
        setStep(next);
      }, 400);
    } else {
      setTimeout(() => {
        setMessages((m) => [...m, { role: 'bot', content: 'تمام، خليني أحلل إجاباتك دلوقتي... ⏳' }]);
        runAnalysis(newAnswers);
      }, 400);
    }
  };

  const handleCtaClick = () => {
    if (isAuthenticated) {
      navigate('/paiement-creation');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-background font-cairo" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 text-white" style={{ backgroundColor: '#1E3A8A' }}>
        <div className="flex items-center justify-between px-3 py-2 flex-row-reverse">
          <div className="flex items-center gap-1.5 flex-row-reverse cursor-pointer" onClick={() => navigate('/')}>
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
            تسجيل الدخول
          </Button>
        </div>
      </header>

      {/* Chat area */}
      <main className="pt-14 pb-24 px-3 max-w-2xl mx-auto">
        {showChecklist && (
          <div className="my-6 rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <h2 className="text-right text-lg font-bold text-card-foreground">✅ شروط فتح شركة في فرنسا</h2>
            <ul className="space-y-2 text-right text-sm text-card-foreground" dir="rtl">
              <li>• مواطن فرنسي أو إقامة فرنسية سارية</li>
              <li>• أو مواطن دولة الاتحاد الأوروبي (برتغال، إيطاليا، إسبانيا...)</li>
              <li>• أو وضع لاجئ / حماية دولية معترف بيه في فرنسا</li>
              <li>• عمر 18 سنة أو أكتر</li>
              <li>• مش محكوم عليك بحكم يمنعك من الإدارة</li>
            </ul>
            <div className="text-right text-sm text-muted-foreground" dir="rtl">
              ❓ مش متأكد من وضعك؟
            </div>
            <div className="flex flex-col gap-3">
              <Button variant="outline" className="w-full font-bold" onClick={() => navigate('/assistant')}>
                اسأل شبيك لبيك
              </Button>
              <Button className="w-full font-bold" onClick={() => setShowChecklist(false)}>
                ✅ أنا مؤهل — هبدأ دلوقتي
              </Button>
            </div>
          </div>
        )}

        {!showChecklist && (
          <div ref={scrollRef} className="space-y-3 py-4">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
              <div
                className={cn(
                  'max-w-[85%] p-3.5 rounded-2xl shadow-sm whitespace-pre-wrap text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-card text-card-foreground border border-border rounded-bl-none'
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {analyzing && (
            <div className="flex justify-end">
              <div className="bg-card border border-border rounded-2xl rounded-bl-none p-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">بحلل إجاباتك...</span>
              </div>
            </div>
          )}

          {recommendation && (
            <>
              <div className="flex justify-end">
                <div className="max-w-[95%] bg-card border border-border rounded-2xl rounded-bl-none p-4 shadow-sm">
                  <MarkdownRenderer content={recommendation} isRTL={true} />
                </div>
              </div>

              {/* CTA banner */}
              <div className="mt-6 rounded-2xl p-5 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 space-y-4">
                <div className="flex items-center gap-2 justify-end">
                  <h3 className="text-lg font-bold text-primary">جهز وثايقك الرسمية مع Anafy Pro</h3>
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>

                <div className="grid gap-3">
                  <button
                    onClick={handleCtaClick}
                    className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between hover:border-primary transition-all active:scale-[0.98]"
                  >
                    <span className="text-lg font-bold text-primary">49€</span>
                    <div className="flex items-center gap-3 flex-row-reverse">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm font-bold">📄 عقد التأسيس PDF</span>
                    </div>
                  </button>

                  <button
                    onClick={handleCtaClick}
                    className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between hover:border-primary transition-all active:scale-[0.98]"
                  >
                    <span className="text-lg font-bold text-primary">29€</span>
                    <div className="flex items-center gap-3 flex-row-reverse">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      <span className="text-sm font-bold">📊 الدراسة المالية PDF</span>
                    </div>
                  </button>

                  <button
                    onClick={handleCtaClick}
                    className="w-full p-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-between shadow-md active:scale-[0.98] border-2 border-primary"
                  >
                    <span className="text-lg font-bold">89€</span>
                    <div className="flex items-center gap-3 flex-row-reverse">
                      <Package className="h-5 w-5" />
                      <span className="text-sm font-bold">📦 الباكدج الكامل</span>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      </main>

      {/* Input bar */}
      {!showChecklist && !recommendation && !analyzing && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3">
          <div className="max-w-2xl mx-auto flex gap-2 flex-row-reverse">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={QUESTIONS[step]?.placeholder}
              dir="rtl"
              className="flex-1 text-right font-cairo text-base"
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
