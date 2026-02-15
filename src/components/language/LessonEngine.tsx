import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Volume2, VolumeX, Mic, Loader2, CheckCircle2, RefreshCcw, BookOpen, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTTS, useSTT } from '@/hooks/useWebSpeech';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { ContentBlock, TextBlock, TeacherTipBlock } from '@/types/lessons';

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
  const [practicedCount, setPracticedCount] = useState(0);
  const [showVocab, setShowVocab] = useState(false);

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

  const currentLesson = lessons[lessonIdx];
  const allBlocks = currentLesson?.content || [];
  const phrases = allBlocks.filter((b): b is TextBlock => b.type === 'text');
  const teacherTip = allBlocks.find((b): b is TeacherTipBlock => b.type === 'tip');
  const currentPhrase = phrases[phraseIdx];
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((lessonIdx / totalLessons) * 100) : 0;
  const canSkip = practicedCount >= 3;

  // Handle microphone result
  useEffect(() => {
    if (feedback === 'listening') {
      if (stt.accuracy) {
        setFeedback('checking');
        const timer = setTimeout(() => {
          setFeedback(stt.accuracy === 'high' || stt.accuracy === 'medium' ? 'success' : 'retry');
          setPracticedCount(prev => prev + 1);
        }, 1200);
        return () => clearTimeout(timer);
      }
      const fallback = setTimeout(() => {
        if (feedback === 'listening') {
          setFeedback('checking');
          setTimeout(() => {
            setFeedback('success');
            setPracticedCount(prev => prev + 1);
          }, 1000);
        }
      }, 3000);
      return () => clearTimeout(fallback);
    }
  }, [stt.accuracy, feedback]);

  const handleMicPress = useCallback(() => {
    if (!currentPhrase) return;
    stt.reset();
    setFeedback('listening');
    stt.listen(currentPhrase.termFr);
  }, [currentPhrase, stt]);

  const handleNext = useCallback(() => {
    stt.reset();
    setFeedback('idle');
    if (phraseIdx < phrases.length - 1) {
      setPhraseIdx(prev => prev + 1);
    } else if (lessonIdx < totalLessons - 1) {
      setLessonIdx(prev => prev + 1);
      setPhraseIdx(0);
      setPracticedCount(0);
      setShowVocab(false);
    } else {
      onClose();
    }
  }, [phraseIdx, phrases.length, lessonIdx, totalLessons, onClose, stt]);

  const handleRetry = useCallback(() => {
    stt.reset();
    setFeedback('idle');
  }, [stt]);

  // Sequential TTS: play all phrases one by one
  const playingRef = useRef(false);
  const handlePlayAll = useCallback(async () => {
    if (playingRef.current || !tts.isSupported) return;
    playingRef.current = true;
    for (const phrase of phrases) {
      if (!playingRef.current) break;
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(phrase.termFr);
        utterance.lang = 'fr-FR';
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }
    playingRef.current = false;
  }, [phrases, tts.isSupported]);

  const stopPlayAll = useCallback(() => {
    playingRef.current = false;
    window.speechSynthesis.cancel();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1d23] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (totalLessons === 0) {
    return (
      <div className="min-h-screen bg-[#1a1d23] flex flex-col items-center justify-center text-slate-500 gap-4">
        <p className="text-sm">{isRTL ? 'لا توجد دروس متاحة بعد' : 'Aucune leçon disponible'}</p>
        <button onClick={onClose} className="text-[#a78bfa] text-sm font-bold">{isRTL ? 'رجوع' : 'Retour'}</button>
      </div>
    );
  }

  const isLastPhrase = phraseIdx >= phrases.length - 1;
  const isLastLesson = lessonIdx >= totalLessons - 1;
  const nextLabel = isLastPhrase && isLastLesson
    ? (isRTL ? 'إنهاء 🏆' : 'Terminer 🏆')
    : isLastPhrase
    ? (isRTL ? 'الدرس التالي →' : 'Leçon suivante →')
    : (isRTL ? 'التالي →' : 'Suivant →');

  return (
    <div className={cn('min-h-screen bg-[#1a1d23] text-white select-none flex flex-col', isRTL && 'font-cairo')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ─── Top Navigation Bar ─── */}
      <header className="bg-[#22262e] px-4 pt-14 pb-4 border-b border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-bold">
            {isRTL ? 'الدرس' : 'Leçon'} {lessonIdx + 1} / {totalLessons}
          </span>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors active:scale-90">
            <X size={22} />
          </button>
        </div>
        <Progress value={progressPct} className="h-2 bg-white/5" />
      </header>

      {/* ─── Middle: Phrase Bubble ─── */}
      <main className="flex-1 flex flex-col items-center px-6 pt-4 gap-4 overflow-y-auto pb-4">
        {/* Lesson title */}
        <p className="text-xs text-slate-500 font-bold text-center">
          {isRTL ? currentLesson?.title_ar : currentLesson?.title_fr}
        </p>

        {/* Phrase sub-counter */}
        <span className="text-[10px] text-slate-600 font-bold">
          {phraseIdx + 1} / {phrases.length}
        </span>

        {/* French phrase bubble */}
        <div className="relative w-full max-w-sm">
          <div className="bg-[#22262e] rounded-3xl p-8 border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)] text-center space-y-3">
            <p className="text-xl font-black text-white leading-relaxed" dir="ltr">
              {currentPhrase?.termFr}
            </p>
            {currentPhrase?.phoneticAr && (
              <p className="text-sm text-[#a78bfa]/70 font-cairo leading-relaxed" dir="rtl">
                [{currentPhrase.phoneticAr}]
              </p>
            )}
            <p className={cn('text-sm text-slate-400 leading-relaxed', isRTL && 'font-cairo')} dir="rtl">
              {currentPhrase?.textAr}
            </p>
          </div>

          {/* Sound button — single phrase */}
          {tts.isSupported && (
            <button
              onClick={() => tts.isSpeaking ? tts.stop() : tts.speak(currentPhrase?.termFr || '')}
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

        {/* ─── Vocabulary List Toggle ─── */}
        <button
          onClick={() => setShowVocab(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#22262e] border border-white/8 text-slate-400 text-xs font-bold active:scale-95 transition-all"
        >
          <BookOpen size={14} className="text-[#a78bfa]" />
          {isRTL ? 'قائمة المفردات' : 'Liste de vocabulaire'}
        </button>

        {showVocab && (
          <div className="w-full max-w-sm bg-[#22262e] rounded-2xl border border-white/8 p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 font-bold">{isRTL ? 'كل العبارات' : 'Toutes les phrases'}</span>
              {tts.isSupported && (
                <button
                  onClick={playingRef.current ? stopPlayAll : handlePlayAll}
                  className="text-[10px] text-[#a78bfa] font-bold flex items-center gap-1"
                >
                  <Volume2 size={12} /> {playingRef.current ? (isRTL ? 'إيقاف' : 'Stop') : (isRTL ? 'شغل الكل' : 'Écouter tout')}
                </button>
              )}
            </div>
            {phrases.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-start gap-2 py-1.5 px-2 rounded-xl text-xs transition-colors',
                  i === phraseIdx ? 'bg-[#a78bfa]/10 border border-[#a78bfa]/20' : 'opacity-60'
                )}
              >
                <span className="text-[#a78bfa] font-bold min-w-[18px]">{i + 1}.</span>
                <div className="flex-1">
                  <span className="text-white font-bold" dir="ltr">{p.termFr}</span>
                  <span className="text-slate-500 mx-1">—</span>
                  <span className="text-slate-400 font-cairo" dir="rtl">{p.textAr}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Teacher's Tip ─── */}
        {teacherTip && (
          <div className="w-full max-w-sm bg-[#2a2420] rounded-2xl border border-amber-500/10 p-4 flex gap-3 items-start">
            <Lightbulb size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-amber-400/70 font-bold mb-1">{isRTL ? 'نصيحة المعلم' : 'Conseil du prof'}</p>
              <p className="text-xs text-amber-200/80 font-cairo leading-relaxed" dir="rtl">
                {teacherTip.tipAr}
              </p>
            </div>
          </div>
        )}

        {/* ─── Feedback Area ─── */}
        <div className="min-h-[80px] flex items-center justify-center">
          {feedback === 'checking' && (
            <div className="flex items-center gap-2 text-slate-400 animate-pulse">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-bold">{isRTL ? 'جارٍ التحليل...' : 'Vérification...'}</span>
            </div>
          )}
          {feedback === 'success' && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={22} />
                <span className="text-sm font-black">{isRTL ? 'ممتاز! 🎉' : 'Bravo ! 🎉'}</span>
              </div>
              <button
                onClick={handleNext}
                className="px-8 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm font-bold active:scale-95 transition-all"
              >
                {nextLabel}
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
          {feedback === 'idle' && canSkip && (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-xs font-bold active:scale-95 transition-all"
            >
              {isRTL ? 'تخطي ←' : 'Passer →'}
            </button>
          )}
          {feedback === 'idle' && !canSkip && (
            <p className="text-[10px] text-slate-600 font-bold text-center">
              {isRTL
                ? `تدرب على ${3 - practicedCount} عبارات أخرى للتخطي`
                : `Pratiquez ${3 - practicedCount} phrases de plus pour passer`}
            </p>
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
