import { useState, useEffect, useCallback } from 'react';
import { X, Volume2, VolumeX, Mic, Loader2, CheckCircle2, RefreshCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTTS, useSTT } from '@/hooks/useWebSpeech';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { ContentBlock, TextBlock } from '@/types/lessons';

interface LessonEngineProps {
  onClose: () => void;
}

interface LessonRow {
  id: string;
  title_fr: string;
  title_ar: string;
  content: ContentBlock[];
}

type FeedbackState = 'idle' | 'listening' | 'checking' | 'success' | 'retry';

const LessonEngine = ({ onClose }: LessonEngineProps) => {
  const { isRTL } = useLanguage();
  const tts = useTTS();
  const stt = useSTT();

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [loading, setLoading] = useState(true);

  // Fetch all published lessons
  useEffect(() => {
    const fetchLessons = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('lessons')
        .select('id, title_fr, title_ar, content')
        .eq('is_published', true)
        .order('display_order');
      setLessons((data as unknown as LessonRow[]) || []);
      setLoading(false);
    };
    fetchLessons();
  }, []);

  // Flatten all text blocks across lessons
  const allPhrases: { phrase: TextBlock; lessonTitle: string }[] = [];
  lessons.forEach((lesson) => {
    const texts = (lesson.content || []).filter((b): b is TextBlock => b.type === 'text');
    texts.forEach((t) => allPhrases.push({ phrase: t, lessonTitle: isRTL ? lesson.title_ar : lesson.title_fr }));
  });

  const totalSteps = allPhrases.length;
  const currentStep = phraseIdx;
  const progressPct = totalSteps > 0 ? Math.round(((currentStep) / totalSteps) * 100) : 0;
  const current = allPhrases[currentStep];

  // Handle microphone result
  useEffect(() => {
    if (stt.accuracy && feedback === 'listening') {
      setFeedback('checking');
      const timer = setTimeout(() => {
        setFeedback(stt.accuracy === 'high' || stt.accuracy === 'medium' ? 'success' : 'retry');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [stt.accuracy, feedback]);

  const handleMicPress = useCallback(() => {
    if (!current) return;
    stt.reset();
    setFeedback('listening');
    stt.listen(current.phrase.termFr);
  }, [current, stt]);

  const handleNext = useCallback(() => {
    stt.reset();
    setFeedback('idle');
    if (currentStep < totalSteps - 1) {
      setPhraseIdx((prev) => prev + 1);
    } else {
      onClose(); // completed all
    }
  }, [currentStep, totalSteps, onClose, stt]);

  const handleRetry = useCallback(() => {
    stt.reset();
    setFeedback('idle');
  }, [stt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1d23] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (totalSteps === 0) {
    return (
      <div className="min-h-screen bg-[#1a1d23] flex flex-col items-center justify-center text-slate-500 gap-4">
        <p className="text-sm">{isRTL ? 'لا توجد دروس متاحة بعد' : 'Aucune leçon disponible'}</p>
        <button onClick={onClose} className="text-[#a78bfa] text-sm font-bold">{isRTL ? 'رجوع' : 'Retour'}</button>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen bg-[#1a1d23] text-white select-none flex flex-col', isRTL && 'font-cairo')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ─── Top Navigation Bar ─── */}
      <header className="bg-[#22262e] px-4 pt-14 pb-4 border-b border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-bold">
            {currentStep + 1} / {totalSteps}
          </span>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors active:scale-90">
            <X size={22} />
          </button>
        </div>
        <Progress value={progressPct} className="h-2 bg-white/5" />
      </header>

      {/* ─── Middle: Phrase Bubble ─── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {/* Lesson context */}
        <p className="text-xs text-slate-500 font-bold text-center">{current?.lessonTitle}</p>

        {/* French phrase bubble */}
        <div className="relative w-full max-w-sm">
          <div className="bg-[#22262e] rounded-3xl p-8 border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)] text-center">
            <p className="text-xl font-black text-white leading-relaxed" dir="ltr">
              {current?.phrase.termFr}
            </p>
            <p className={cn('text-sm text-slate-400 mt-3 leading-relaxed', isRTL && 'font-cairo')} dir="rtl">
              {current?.phrase.textAr}
            </p>
          </div>

          {/* Sound button - floats top-right */}
          {tts.isSupported && (
            <button
              onClick={() => tts.isSpeaking ? tts.stop() : tts.speak(current?.phrase.termFr || '')}
              className={cn(
                'absolute -top-3 ltr:-right-3 rtl:-left-3 p-3 rounded-2xl border transition-all',
                tts.isSpeaking
                  ? 'bg-[#7c3aed]/25 border-[#7c3aed]/40 text-[#a78bfa] animate-pulse'
                  : 'bg-[#22262e] border-[#7c3aed]/20 text-[#a78bfa] active:scale-90'
              )}
              aria-label="Listen"
            >
              {tts.isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          )}
        </div>

        {/* ─── Feedback Area ─── */}
        <div className="h-16 flex items-center justify-center">
          {feedback === 'checking' && (
            <div className="flex items-center gap-2 text-slate-400 animate-pulse">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-bold">{isRTL ? 'جارٍ التحليل...' : 'Vérification...'}</span>
            </div>
          )}
          {feedback === 'success' && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={22} />
                <span className="text-sm font-black">{isRTL ? 'ممتاز! 🎉' : 'Bravo ! 🎉'}</span>
              </div>
              <button
                onClick={handleNext}
                className="mt-2 px-8 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm font-bold active:scale-95 transition-all"
              >
                {currentStep < totalSteps - 1 ? (isRTL ? 'التالي ←' : 'Suivant →') : (isRTL ? 'إنهاء 🏆' : 'Terminer 🏆')}
              </button>
            </div>
          )}
          {feedback === 'retry' && (
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-bold text-amber-400">{isRTL ? 'حاول مرة أخرى 💪' : 'Réessayez 💪'}</span>
              {stt.transcript && (
                <p className="text-xs text-slate-500" dir="ltr">« {stt.transcript} »</p>
              )}
              <button
                onClick={handleRetry}
                className="mt-1 flex items-center gap-1.5 px-5 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold active:scale-95 transition-all"
              >
                <RefreshCcw size={14} /> {isRTL ? 'إعادة' : 'Réessayer'}
              </button>
            </div>
          )}
          {feedback === 'listening' && !stt.accuracy && (
            <span className="text-sm text-red-400 animate-pulse font-bold">🎙️ {isRTL ? 'تكلم الآن...' : 'Parlez maintenant...'}</span>
          )}
        </div>
      </main>

      {/* ─── Bottom: Microphone Button ─── */}
      <div className="pb-12 pt-4 flex flex-col items-center gap-3">
        <button
          onClick={handleMicPress}
          disabled={feedback === 'checking' || feedback === 'success'}
          className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-300',
            feedback === 'listening'
              ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse scale-110'
              : feedback === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 opacity-50'
              : 'bg-[#22262e] border-white/10 text-[#a78bfa] active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)]'
          )}
          aria-label="Record"
        >
          <Mic size={32} />
        </button>
        <span className="text-xs text-slate-500 font-bold">
          {feedback === 'idle' && (isRTL ? 'اضغط وتكلم' : 'Appuyez et parlez')}
        </span>
      </div>
    </div>
  );
};

export default LessonEngine;
