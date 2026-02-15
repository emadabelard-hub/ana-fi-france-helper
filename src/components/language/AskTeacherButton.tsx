import { useState, useCallback } from 'react';
import { MessageCircleQuestion, X, Send, Loader2, Volume2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

    const userKey = localStorage.getItem('user_ai_api_key');
    const body = { question: question.trim(), currentPhrase, lessonTitle, userApiKey: userKey || undefined };

    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('ask-teacher', { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setAnswer(data?.answer || 'عذراً، لم أستطع الإجابة.');
        setIsLive(true);
        setLoading(false);
        return;
      } catch (e: any) {
        lastError = e;
        console.warn(`ask-teacher attempt ${attempt + 1} failed:`, e?.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }

    // All 3 attempts failed — friendly fallback
    console.error('Ask teacher all retries failed:', lastError);
    const msg = lastError?.message || '';
    if (msg.includes('Failed to send') || msg.includes('NetworkError') || msg.includes('fetch')) {
      setAnswer('⚡ جاري إعادة الاتصال بالسيرفر... حاول مرة أخرى بعد قليل.\n\n💡 نصيحة: تأكد من اتصالك بالإنترنت.');
    } else if (msg.includes('429') || msg.includes('مشغولة')) {
      setAnswer('⏳ الرصيد لم يتفعل بعد، انتظر 5 دقائق (Error 429)');
    } else if (msg.includes('402') || msg.includes('كافٍ')) {
      setAnswer('💳 الرصيد غير كافٍ — Error 402');
    } else if (msg.includes('401') || msg.includes('Incorrect') || msg.includes('invalid')) {
      setAnswer('🔑 المفتاح غير صحيح — تأكد من نسخه بدقة من OpenAI');
    } else {
      setAnswer('❌ حدث خطأ — حاول مرة أخرى أو تحقق من الإعدادات');
    }
    setLoading(false);
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
