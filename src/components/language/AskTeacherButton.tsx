import { useState, useCallback } from 'react';
import { MessageCircleQuestion, X, Send, Loader2, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTTS } from '@/hooks/useWebSpeech';
import { cn } from '@/lib/utils';

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

  const handleAsk = useCallback(async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer('');
    try {
      const { data, error } = await supabase.functions.invoke('ask-teacher', {
        body: { question: question.trim(), currentPhrase, lessonTitle },
      });
      if (error) throw error;
      setAnswer(data?.answer || 'عذراً، لم أستطع الإجابة.');
    } catch (e: any) {
      console.error('Ask teacher error:', e);
      setAnswer('حدث خطأ، حاول مرة أخرى 🙏');
    } finally {
      setLoading(false);
    }
  }, [question, currentPhrase, lessonTitle, loading]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-36 right-4 z-50 w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg active:scale-90 transition-all"
        aria-label="Ask the teacher"
      >
        <MessageCircleQuestion size={26} />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-[#1a1d23]/95 backdrop-blur-xl border-t border-amber-500/20 p-4 pb-8 space-y-3 animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion size={18} className="text-amber-400" />
          <span className="text-sm font-bold text-amber-400">
            {isRTL ? 'اسأل المعلم 🧑‍🏫' : 'Demander au prof 🧑‍🏫'}
          </span>
        </div>
        <button onClick={() => { setOpen(false); setAnswer(''); setQuestion(''); }} className="p-1.5 rounded-lg text-slate-500 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Answer */}
      {answer && (
        <div className="bg-[#22262e] rounded-2xl p-4 border border-amber-500/10 space-y-2">
          <p className="text-sm text-amber-100/90 leading-relaxed font-cairo whitespace-pre-wrap" dir="rtl">{answer}</p>
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
          placeholder={isRTL ? 'اكتب سؤالك هنا... (مثال: ليه H ما بتتنطق؟)' : 'Posez votre question...'}
          className="flex-1 bg-[#22262e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/30 font-cairo"
          dir="rtl"
          disabled={loading}
        />
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
            loading ? 'bg-amber-500/10 text-amber-400/50' : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 active:scale-90'
          )}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
};

export default AskTeacherButton;
