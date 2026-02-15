import { useState, useCallback } from 'react';
import { MessageCircleQuestion, X, Send, Loader2, Volume2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTTS } from '@/hooks/useWebSpeech';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AskTeacherButtonProps {
  currentPhrase?: string;
  lessonTitle?: string;
}

const AskTeacherButton = ({ currentPhrase, lessonTitle }: AskTeacherButtonProps) => {
  const { isRTL } = useLanguage();
  const tts = useTTS();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer('');
    setIsLive(false);

    const apiKey = localStorage.getItem('user_ai_api_key');
    if (!apiKey) {
      setAnswer('🔑 لم يتم العثور على مفتاح — اذهب إلى الإعدادات وأدخل مفتاح OpenAI الخاص بك');
      setLoading(false);
      return;
    }

    const systemPrompt = `أنت "معلم فرنسي" ودود وصبور. تشرح قواعد اللغة الفرنسية بالعربية الفصحى البسيطة.
السياق: الطالب يتعلم درس "${lessonTitle || 'فرنسي'}" والعبارة الحالية هي: "${currentPhrase || ''}".
- أجب بشكل مختصر (3-5 جمل كحد أقصى).
- استخدم أمثلة فرنسية مع الترجمة.
- إذا كان السؤال عن النطق، اكتب النطق بالحروف العربية.
- كن مشجعاً ولطيفاً.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question.trim() },
          ],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `HTTP ${response.status}`;
        if (response.status === 401) {
          setAnswer(`🔑 Error 401: ${errMsg}`);
        } else if (response.status === 429) {
          setAnswer(`⏳ Error 429: ${errMsg}`);
        } else if (response.status === 402) {
          setAnswer(`💳 Error 402: ${errMsg}`);
        } else {
          setAnswer(`❌ Error ${response.status}: ${errMsg}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setAnswer(data.choices?.[0]?.message?.content || 'عذراً، لم أستطع الإجابة.');
      setIsLive(true);
    } catch (e: any) {
      console.error('Direct OpenAI error:', e);
      setAnswer(`❌ ${e?.message || 'Network error — تحقق من اتصالك بالإنترنت'}`);
    } finally {
      setLoading(false);
    }
  }, [question, currentPhrase, lessonTitle, loading]);

  const handleClose = () => {
    setOpen(false);
    setAnswer('');
    setQuestion('');
    setIsLive(false);
    tts.stop();
  };

  return (
    <>
      {/* FAB — floating above nav */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[#F59E0B] border-2 border-[#D97706] text-white flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-90 transition-all"
        aria-label="Ask the teacher"
      >
        <MessageCircleQuestion size={26} />
      </button>

      {/* Centered Modal */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent className="bg-[#1a1d23] border-amber-500/20 text-white max-w-[92vw] sm:max-w-md top-[35%]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400 text-base">
              <MessageCircleQuestion size={18} />
              {isRTL ? 'اسأل المعلم 🧑‍🏫' : 'Demander au prof 🧑‍🏫'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Answer */}
            {answer && (
              <div className="bg-[#22262e] rounded-2xl p-4 border border-amber-500/10 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-sm text-amber-100/90 leading-relaxed font-cairo whitespace-pre-wrap" dir="rtl">{answer}</p>
                {isLive && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                    <Sparkles size={10} /> AI Live
                  </span>
                )}
                {tts.isSupported && (
                  <button
                    onClick={() => tts.isSpeaking ? tts.stop() : tts.speak(answer, 'ar-SA')}
                    className="flex items-center gap-1.5 text-[10px] text-amber-400/70 font-bold"
                  >
                    <Volume2 size={12} /> {tts.isSpeaking ? (isRTL ? 'إيقاف' : 'Stop') : (isRTL ? 'استمع للإجابة' : 'Écouter')}
                  </button>
                )}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                placeholder={isRTL ? 'اكتب سؤالك هنا...' : 'Posez votre question...'}
                className="flex-1 bg-[#22262e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/30 font-cairo"
                dir="rtl"
                disabled={loading}
                autoFocus
              />
              <button
                onClick={handleAsk}
                disabled={loading || !question.trim()}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0',
                  loading ? 'bg-amber-500/10 text-amber-400/50' : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 active:scale-90'
                )}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AskTeacherButton;
