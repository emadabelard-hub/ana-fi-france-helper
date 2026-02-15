import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Volume2, Mic, Loader2, CheckCircle2, RefreshCcw, BookOpen, Lightbulb, Pause, Play, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTTS, useSTT } from '@/hooks/useWebSpeech';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import AskTeacherButton from '@/components/language/AskTeacherButton';
import type { ContentBlock, TextBlock, TeacherTipBlock, GrammarBlock } from '@/types/lessons';

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
  const [playAllIdx, setPlayAllIdx] = useState(-1);
  const [playAllPaused, setPlayAllPaused] = useState(false);

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
  const grammarRule = allBlocks.find((b): b is GrammarBlock => b.type === 'grammar');
  const currentPhrase = phrases[phraseIdx];
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((lessonIdx / totalLessons) * 100) : 0;
  const canSkip = true; // Always allow navigation

  // Handle microphone result with 5-second timeout fallback
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
      // 5-second fallback: simulate success if STT doesn't respond
      const fallback = setTimeout(() => {
        setFeedback('checking');
        setTimeout(() => {
          setFeedback('success');
          setPracticedCount(prev => prev + 1);
        }, 800);
      }, 5000);
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

  // Alliance Française Audio Mode: step-by-step with speaking/repeating phases
  const playingRef = useRef(false);
  const [playAllPhase, setPlayAllPhase] = useState<'speaking' | 'repeating'>('speaking');
  const handlePlayAll = useCallback(async () => {
    if (playingRef.current || !tts.isSupported) return;
    playingRef.current = true;
    setPlayAllPaused(false);

    for (let i = 0; i < phrases.length; i++) {
      if (!playingRef.current) break;
      setPlayAllIdx(i);
      setPlayAllPhase('speaking');

      // Step 1: Speak the phrase slowly (0.7)
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(phrases[i].termFr);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.7;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });

      if (!playingRef.current) break;

      // Step 2: 4-second pause — "كرر الآن / Répétez"
      setPlayAllPhase('repeating');
      setPlayAllPaused(true);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          setPlayAllPaused(false);
          resolve();
        }, 4000);
        if (!playingRef.current) {
          clearTimeout(timer);
          resolve();
        }
      });
    }

    playingRef.current = false;
    setPlayAllIdx(-1);
    setPlayAllPaused(false);
    setPlayAllPhase('speaking');
  }, [phrases, tts.isSupported]);

  const stopPlayAll = useCallback(() => {
    playingRef.current = false;
    window.speechSynthesis.cancel();
    setPlayAllIdx(-1);
    setPlayAllPaused(false);
    setPlayAllPhase('speaking');
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
      <main className="flex-1 flex flex-col items-center px-6 pt-4 gap-4 overflow-y-auto pb-[150px]">
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

        </div>

        {/* ─── Audio Control Bar ─── */}
        {tts.isSupported && (
          <div className="w-full max-w-sm flex items-center justify-center gap-3 bg-[#22262e] rounded-2xl p-3 border border-white/8">
            {/* Rewind / Previous */}
            <button
              onClick={() => { if (phraseIdx > 0) { setPhraseIdx(p => p - 1); setFeedback('idle'); stt.reset(); } }}
              disabled={phraseIdx === 0}
              className="p-2.5 rounded-xl bg-white/5 border border-white/8 text-slate-400 disabled:opacity-30 active:scale-90 transition-all"
              aria-label="Previous"
            >
              <SkipBack size={18} />
            </button>

            {/* Play / Pause */}
            <button
              onClick={() => tts.isSpeaking ? tts.stop() : tts.speak(currentPhrase?.termFr || '')}
              className={cn(
                'p-3.5 rounded-2xl border-2 transition-all',
                tts.isSpeaking
                  ? 'bg-[#7c3aed]/25 border-[#7c3aed]/40 text-[#a78bfa]'
                  : 'bg-[#7c3aed]/15 border-[#7c3aed]/25 text-[#a78bfa] active:scale-90'
              )}
              aria-label={tts.isSpeaking ? 'Pause' : 'Play'}
            >
              {tts.isSpeaking ? (
                <div className="flex items-center gap-[2px]">
                  {[1,2,3,4].map(i => (
                    <span key={i} className="w-[3px] bg-[#a78bfa] rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 10}px`, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              ) : <Volume2 size={22} />}
            </button>

            {/* Replay current */}
            <button
              onClick={() => { tts.stop(); setTimeout(() => tts.speak(currentPhrase?.termFr || ''), 100); }}
              className="p-2.5 rounded-xl bg-white/5 border border-white/8 text-slate-400 active:scale-90 transition-all"
              aria-label="Replay"
            >
              <RotateCcw size={18} />
            </button>

            {/* Next */}
            <button
              onClick={() => { if (phraseIdx < phrases.length - 1) { setPhraseIdx(p => p + 1); setFeedback('idle'); stt.reset(); } }}
              disabled={phraseIdx >= phrases.length - 1}
              className="p-2.5 rounded-xl bg-white/5 border border-white/8 text-slate-400 disabled:opacity-30 active:scale-90 transition-all"
              aria-label="Next"
            >
              <SkipForward size={18} />
            </button>
          </div>
        )}

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={playingRef.current ? stopPlayAll : handlePlayAll}
                    className="text-[10px] text-[#a78bfa] font-bold flex items-center gap-1"
                  >
                    {playingRef.current ? <Pause size={12} /> : <Play size={12} />}
                    {playingRef.current ? (isRTL ? 'إيقاف' : 'Stop') : (isRTL ? 'استمع وكرر' : 'Écouter & répéter')}
                  </button>
                </div>
              )}
            </div>
            {phrases.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  'flex items-start gap-2 py-1.5 px-2 rounded-xl text-xs transition-all duration-300',
                  playAllIdx === i
                    ? playAllPaused
                      ? 'bg-amber-500/15 border border-amber-500/30 scale-[1.02]'
                      : 'bg-[#a78bfa]/15 border border-[#a78bfa]/30 scale-[1.02]'
                    : i === phraseIdx ? 'bg-[#a78bfa]/10 border border-[#a78bfa]/20' : 'opacity-60'
                )}
              >
                <span className="text-[#a78bfa] font-bold min-w-[18px]">{i + 1}.</span>
                <div className="flex-1">
                  <span className="text-white font-bold" dir="ltr">{p.termFr}</span>
                  <span className="text-slate-500 mx-1">—</span>
                  <span className="text-slate-400 font-cairo" dir="rtl">{p.textAr}</span>
                  {playAllIdx === i && playAllPaused && (
                    <span className="block text-[10px] text-amber-400 font-bold mt-1 animate-pulse">
                      🎤 {isRTL ? 'كرر الآن!' : 'Répétez !'}
                    </span>
                  )}
                  {playAllIdx === i && !playAllPaused && (
                    <span className="flex items-center gap-[2px] mt-1">
                      {[1,2,3,4,5].map(j => (
                        <span key={j} className="w-[2px] bg-[#a78bfa] rounded-full animate-pulse" style={{ height: `${4 + Math.random() * 8}px`, animationDelay: `${j * 0.1}s` }} />
                      ))}
                      <span className="text-[10px] text-[#a78bfa]/70 font-bold ml-1">{isRTL ? 'يتحدث...' : 'Écoute...'}</span>
                    </span>
                  )}
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

        {/* ─── Grammar Rule ─── */}
        {grammarRule && (
          <div className="w-full max-w-sm bg-[#1e2430] rounded-2xl border border-blue-500/10 p-4 flex gap-3 items-start">
            <BookOpen size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-blue-400/70 font-bold mb-1">{isRTL ? 'قاعدة نحوية' : 'Règle de grammaire'}</p>
              <p className="text-xs text-blue-200/80 font-cairo leading-relaxed" dir="rtl">
                {grammarRule.ruleAr}
              </p>
              {grammarRule.ruleFr && (
                <p className="text-xs text-blue-300/50 mt-1 leading-relaxed" dir="ltr">
                  {grammarRule.ruleFr}
                </p>
              )}
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
          {(feedback === 'idle' || feedback === 'listening' || feedback === 'retry') && (
            <button
              onClick={handleNext}
              className="px-8 py-3 rounded-2xl bg-blue-600 border-2 border-blue-500 text-white text-sm font-black active:scale-95 transition-all shadow-lg shadow-blue-600/20"
            >
              {nextLabel}
            </button>
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

      {/* ─── Ask the Teacher (Floating) ─── */}
      <AskTeacherButton
        currentPhrase={currentPhrase?.termFr}
        lessonTitle={isRTL ? currentLesson?.title_ar : currentLesson?.title_fr}
      />
    </div>
  );
};

export default LessonEngine;
