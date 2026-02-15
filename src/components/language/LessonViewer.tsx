import { useState, useEffect } from 'react';
import { ArrowRight, Volume2, VolumeX, Mic, MicOff, RotateCcw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTTS, useSTT, type AccuracyLevel } from '@/hooks/useWebSpeech';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ContentBlock, TextBlock } from '@/types/lessons';

interface LessonViewerProps {
  category?: string;
  onBack: () => void;
}

interface LessonRow {
  id: string;
  title_fr: string;
  title_ar: string;
  content: ContentBlock[];
}

const AccuracyBadge = ({ level }: { level: AccuracyLevel }) => {
  if (!level) return null;
  const cfg = {
    high:   { icon: CheckCircle2, label: 'ممتاز', labelFr: 'Excellent',  cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
    medium: { icon: AlertCircle,  label: 'جيد',   labelFr: 'Bien',       cls: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    low:    { icon: XCircle,      label: 'حاول مجدداً', labelFr: 'Réessayez', cls: 'text-red-400 bg-red-400/10 border-red-400/20' },
  }[level];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border', cfg.cls)}>
      <Icon size={14} /> {cfg.label}
    </span>
  );
};

/** Build a natural TTS prompt so OpenAI Nova pronounces letters correctly */
function buildTTSText(termFr: string): string {
  // Detect alphabet-style entries like "A (Ah)" or "R (Èrre)"
  const match = termFr.match(/^([A-Z])\s*\(([^)]+)\)$/i);
  if (match) {
    // Send the full letter name for clear pronunciation
    return match[2]; // e.g. "Ah", "Bé", "Èrre"
  }
  return termFr;
}

const PhraseCard = ({ block }: { block: TextBlock }) => {
  const { isRTL } = useLanguage();
  const tts = useTTS();
  const stt = useSTT();

  const ttsText = buildTTSText(block.termFr);

  return (
    <div className="bg-[#22262e] rounded-2xl p-5 border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-1px_2px_rgba(0,0,0,0.3)] space-y-4">
      {/* French term */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-slate-200 flex-1" dir="ltr">{block.termFr}</p>
        {tts.isSupported && (
          <button
            onClick={() => (tts.isSpeaking || tts.isLoading) ? tts.stop() : tts.speak(ttsText)}
            disabled={tts.isLoading}
            className={cn(
              'p-2.5 rounded-xl border transition-all',
              tts.isLoading
                ? 'bg-[#7c3aed]/20 border-[#7c3aed]/30 text-[#a78bfa]'
                : tts.isSpeaking
                  ? 'bg-[#7c3aed]/20 border-[#7c3aed]/30 text-[#a78bfa] animate-pulse'
                  : 'bg-[#7c3aed]/10 border-[#7c3aed]/20 text-[#a78bfa] active:scale-90'
            )}
            aria-label="Listen"
          >
            {tts.isLoading ? (
              <div className="w-[18px] h-[18px] border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
            ) : tts.isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
      </div>

      {/* Arabic translation */}
      <p className={cn('text-sm text-slate-400 leading-relaxed', isRTL && 'font-cairo')} dir="rtl">
        {block.textAr}
      </p>

      {/* Practice Mode (STT) */}
      {stt.isSupported && (
        <div className="pt-3 border-t border-white/5 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => stt.isListening ? stt.stopListening() : stt.listen(block.termFr)}
              className={cn(
                'p-3 rounded-xl border transition-all',
                stt.isListening
                  ? 'bg-red-500/20 border-red-500/30 text-red-400 animate-pulse'
                  : 'bg-[#4a9a8a]/10 border-[#4a9a8a]/20 text-[#4a9a8a] active:scale-90'
              )}
              aria-label="Practice speaking"
            >
              {stt.isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <span className="text-xs text-slate-500">
              {stt.isListening
                ? (isRTL ? '🎙️ تكلم الآن...' : '🎙️ Parlez maintenant...')
                : (isRTL ? 'تدرّب على النطق' : 'Pratiquez la prononciation')}
            </span>
            {stt.accuracy && (
              <button onClick={stt.reset} className="p-1.5 text-slate-500 hover:text-slate-300">
                <RotateCcw size={14} />
              </button>
            )}
          </div>

          {stt.transcript && (
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-300" dir="ltr">« {stt.transcript} »</p>
              <AccuracyBadge level={stt.accuracy} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LessonViewer = ({ category, onBack }: LessonViewerProps) => {
  const { isRTL } = useLanguage();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let query = supabase
        .from('lessons')
        .select('id, title_fr, title_ar, content')
        .eq('is_published', true)
        .order('display_order');

      if (category) query = query.eq('category', category as any);

      const { data } = await query;
      setLessons((data as unknown as LessonRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, [category]);

  const lesson = lessons[selectedIdx];
  const textBlocks = (lesson?.content || []).filter((b): b is TextBlock => b.type === 'text');

  return (
    <div className={cn('min-h-screen bg-[#1a1d23] text-white select-none', isRTL && 'font-cairo')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-[#22262e] p-4 pt-14 flex items-center gap-3 border-b border-white/5">
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
          <ArrowRight size={24} className={cn(!isRTL && 'rotate-180')} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-white truncate">
            {lesson ? (isRTL ? lesson.title_ar : lesson.title_fr) : (isRTL ? 'الدروس' : 'Leçons')}
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
          <p className="text-sm">{isRTL ? 'لا توجد دروس متاحة بعد' : 'Aucune leçon disponible pour le moment'}</p>
          <Button variant="outline" size="sm" onClick={onBack}>
            {isRTL ? 'رجوع' : 'Retour'}
          </Button>
        </div>
      ) : (
        <main className="px-4 pt-6 pb-32 space-y-6">
          {/* Lesson picker if multiple */}
          {lessons.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {lessons.map((l, i) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedIdx(i)}
                  className={cn(
                    'whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold border transition-all shrink-0',
                    i === selectedIdx
                      ? 'bg-[#7c3aed]/20 border-[#7c3aed]/30 text-[#a78bfa]'
                      : 'bg-[#22262e] border-white/8 text-slate-400 active:scale-95'
                  )}
                >
                  {isRTL ? l.title_ar : l.title_fr}
                </button>
              ))}
            </div>
          )}

          {/* Image blocks */}
          {lesson?.content?.filter(b => b.type === 'image').map((b: any) => (
            <div key={b.id} className="rounded-2xl overflow-hidden border border-white/8">
              <img src={b.imageUrl} alt={b.caption || ''} className="w-full object-contain bg-white/5" />
              {b.caption && <p className="text-xs text-slate-500 text-center py-2">{b.caption}</p>}
            </div>
          ))}

          {/* Text/Phrase cards with TTS + STT */}
          {textBlocks.map(block => (
            <PhraseCard key={block.id} block={block} />
          ))}
        </main>
      )}
    </div>
  );
};

export default LessonViewer;
