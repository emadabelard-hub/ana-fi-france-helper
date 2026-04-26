import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Mic, Square, Loader2, Volume2, Copy, Check, Trash2, History, MessageCircle, ArrowLeft, Keyboard, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type Lang = 'ar' | 'fr';

interface HistoryItem {
  id: string;
  source_lang: string;
  target_lang: string;
  source_text: string;
  translated_text: string;
  created_at: string;
}

// ─── iOS detection (Safari blocks autoplay TTS) ───
const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
};

// ─── Mic / SpeechRecognition support detection ───
const hasSpeechRecognition = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
};

const hasMediaRecorder = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof (window as any).MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
};

const TranslatorPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [sourceLang, setSourceLang] = useState<Lang>('ar');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Text input mode (alternative to voice — available everywhere)
  const [textMode, setTextMode] = useState(false);
  const [typedText, setTypedText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const targetLang: Lang = sourceLang === 'ar' ? 'fr' : 'ar';

  const ios = useMemo(() => isIOS(), []);
  const voiceAvailable = useMemo(
    () => hasMediaRecorder() || hasSpeechRecognition(),
    [],
  );

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('translation_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setHistory(data as HistoryItem[]);
  }, [user]);

  // ─── Native Web Speech TTS — male voice + retry on failure ───
  const ttsFailCountRef = useRef(0);
  const ttsRunIdRef = useRef(0);

  const pickMaleVoice = useCallback((lang: Lang): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const langPrefix = lang === 'ar' ? 'ar' : 'fr';
    const targetLang = lang === 'ar' ? 'ar-eg' : 'fr-fr';

    // Male voice name patterns
    const malePatterns = lang === 'ar'
      ? [/majed/i, /tarik/i, /hamed/i, /maged/i]
      : [/thomas/i, /paul/i, /google français/i, /google french/i, /henri/i, /nicolas/i];

    const inLang = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));

    // 1. Exact lang + male name
    for (const pattern of malePatterns) {
      const found = inLang.find((v) => pattern.test(v.name) && v.lang.toLowerCase().startsWith(targetLang));
      if (found) return found;
    }
    // 2. Any lang variant + male name
    for (const pattern of malePatterns) {
      const found = inLang.find((v) => pattern.test(v.name));
      if (found) return found;
    }
    // 3. Heuristic: explicit "male" / "homme" hint in name
    const heuristic = inLang.find((v) => /male|homme|man\b/i.test(v.name));
    if (heuristic) return heuristic;

    // 4. First voice in correct exact locale
    const exact = inLang.find((v) => v.lang.toLowerCase().startsWith(targetLang));
    if (exact) return exact;

    // 5. Fallback: first voice in language family
    return inLang[0] || null;
  }, []);

  const speak = useCallback((text: string, lang: Lang) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis not supported');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;

    const runId = ttsRunIdRef.current + 1;
    ttsRunIdRef.current = runId;

    const doSpeak = (attempt: number) => {
      try {
        if (runId !== ttsRunIdRef.current) return;

        window.speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(trimmed);
        utter.lang = lang === 'ar' ? 'ar-EG' : 'fr-FR';
        utter.rate = 0.95;
        utter.pitch = 0.92; // slightly lower → more masculine
        utter.volume = 1;

        const voice = pickMaleVoice(lang);
        if (voice) utter.voice = voice;

        utter.onstart = () => {
          if (runId !== ttsRunIdRef.current) return;
          ttsFailCountRef.current = 0;
          setIsPlaying(true);
        };
        utter.onend = () => {
          if (runId === ttsRunIdRef.current) setIsPlaying(false);
        };
        utter.onerror = (ev) => {
          if (runId !== ttsRunIdRef.current) return;
          const error = String(ev.error || '');
          if (error === 'canceled' || error === 'interrupted') return;
          console.warn('TTS error event:', ev);
          setIsPlaying(false);
          if (attempt < 1) {
            setTimeout(() => doSpeak(attempt + 1), 250);
          } else {
            ttsFailCountRef.current += 1;
            if (ttsFailCountRef.current >= 2) {
              toast({
                title: 'اضغط مرة تانية على 🔊',
                variant: 'destructive',
              });
              ttsFailCountRef.current = 0;
            }
          }
        };

        window.speechSynthesis.resume?.();
        window.speechSynthesis.speak(utter);
      } catch (err) {
        console.error('TTS error:', err);
        setIsPlaying(false);
        if (attempt < 1) {
          setTimeout(() => doSpeak(attempt + 1), 250);
        } else {
          toast({ title: 'اضغط مرة تانية على 🔊', variant: 'destructive' });
        }
      }
    };

    doSpeak(0);
  }, [pickMaleVoice, toast]);

  const stopSpeak = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const handler = () => window.speechSynthesis.getVoices();
    handler();
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
  }, []);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  useEffect(() => {
    return () => {
      stopSpeak();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopSpeak]);

  const startRecording = async () => {
    try {
      stopSpeak();

      // Stability: fully reset previous instance before starting a new one
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch {
          /* noop */
        }
        mediaRecorderRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      audioChunksRef.current = [];

      // 300ms guard delay to avoid mic conflicts on rapid restart
      await new Promise((r) => setTimeout(r, 300));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        // Fire translation immediately, no delay
        void handleTranscribeAndTranslate(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setOriginalText('');
      setTranslatedText('');
    } catch (err) {
      console.error('Mic error:', err);
      toast({
        title: '❌ خطأ في الميكروفون',
        description: 'لازم تسمح للتطبيق يستخدم الميكروفون',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  // ─── Streaming translate (token-by-token) ───
  const streamTranslation = useCallback(
    async (text: string): Promise<string> => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/btp-translate`;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, sourceLang, targetLang, stream: true }),
      });

      if (!resp.ok || !resp.body) {
        // Fallback to non-stream JSON error parse
        let msg = 'Translation failed';
        try {
          const j = await resp.json();
          if (j?.error) msg = j.error;
        } catch { /* noop */ }
        throw new Error(msg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assembled = '';
      let streamDone = false;

      setTranslatedText('');

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assembled += delta;
              setTranslatedText(assembled);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      return assembled.trim();
    },
    [sourceLang, targetLang],
  );

  const performTranslation = async (transcribed: string) => {
    if (!transcribed) {
      setIsProcessing(false);
      return;
    }
    setOriginalText(transcribed);

    try {
      const translated = await streamTranslation(transcribed);
      if (!translated) throw new Error('Empty translation');

      // Save history
      if (user) {
        await supabase.from('translation_history').insert({
          user_id: user.id,
          source_lang: sourceLang,
          target_lang: targetLang,
          source_text: transcribed,
          translated_text: translated,
        });
      }

      // iOS Safari blocks autoplay TTS — only manual playback via 🔊 button
      if (!ios) {
        speak(translated, targetLang);
      }
    } catch (err) {
      console.error('Translate error:', err);
      toast({
        title: '❌ خطأ في الترجمة',
        description: 'حاول تاني بعد شوية',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranscribeAndTranslate = async (audioBlob: Blob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const audioBase64 = btoa(binary);

      const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke(
        'voice-field-input',
        {
          body: {
            audioBase64,
            mimeType: 'audio/webm',
            dualMode: sourceLang === 'ar',
          },
        },
      );

      if (transcribeError) throw transcribeError;

      const transcribed =
        sourceLang === 'ar'
          ? (transcribeData?.raw || transcribeData?.text || '').trim()
          : (transcribeData?.text || transcribeData?.raw || '').trim();

      if (!transcribed) {
        toast({
          title: '🤷 ما سمعتش حاجة',
          description: 'حاول تاني وتكلم أوضح',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      await performTranslation(transcribed);
    } catch (err) {
      console.error('Transcribe error:', err);
      toast({
        title: '❌ خطأ في الترجمة',
        description: 'حاول تاني بعد شوية',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  const handleSubmitTyped = async () => {
    const value = typedText.trim();
    if (!value || isProcessing) return;
    stopSpeak();
    setOriginalText('');
    setTranslatedText('');
    setIsProcessing(true);
    await performTranslation(value);
    setTypedText('');
  };

  const playTranslation = (text?: string) => {
    const value = (text ?? translatedText).trim();
    if (!value) return;
    speak(value, targetLang);
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      toast({ title: '✅ اتنسخ', description: 'النص جاهز للصق' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: '❌ مقدرش انسخ', variant: 'destructive' });
    }
  };

  const handleWhatsApp = () => {
    if (!translatedText) return;
    const message = originalText
      ? `${originalText}\n\n${translatedText}`
      : translatedText;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleClear = () => {
    stopSpeak();
    setOriginalText('');
    setTranslatedText('');
  };

  const handleDeleteHistoryItem = async (id: string) => {
    await supabase.from('translation_history').delete().eq('id', id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          aria-label="رجوع"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </Button>
        <div className="text-center">
          <h1 className="text-lg font-bold font-cairo">🗣️ مترجم فوري</h1>
          <p className="text-xs text-muted-foreground">Traducteur instantané BTP</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowHistory((s) => !s)}
          aria-label="السجل"
        >
          <History className="h-5 w-5" />
        </Button>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-5">
        {/* Language selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSourceLang('ar')}
            className={cn(
              'rounded-2xl py-4 px-3 font-bold font-cairo border-2 transition-all',
              sourceLang === 'ar'
                ? 'bg-blue-500 text-white border-blue-600 shadow-lg scale-[1.02]'
                : 'bg-card text-foreground border-border hover:border-blue-300',
            )}
          >
            <div className="text-2xl mb-1">🇪🇬</div>
            <div className="text-sm">اتكلم بالعربي</div>
          </button>
          <button
            onClick={() => setSourceLang('fr')}
            className={cn(
              'rounded-2xl py-4 px-3 font-bold border-2 transition-all',
              sourceLang === 'fr'
                ? 'bg-blue-500 text-white border-blue-600 shadow-lg scale-[1.02]'
                : 'bg-card text-foreground border-border hover:border-blue-300',
            )}
          >
            <div className="text-2xl mb-1">🇫🇷</div>
            <div className="text-sm">Parler en français</div>
          </button>
        </div>

        {/* Voice input — hidden when text mode is active */}
        {!textMode && (
          <div className="flex flex-col items-center py-6">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing || !voiceAvailable}
              className={cn(
                'relative w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-2xl',
                isRecording
                  ? 'bg-red-500 scale-110 animate-pulse'
                  : 'bg-blue-500 hover:bg-blue-600 active:scale-95',
                (isProcessing || !voiceAvailable) && 'opacity-50 cursor-not-allowed',
              )}
              aria-label={isRecording ? 'وقف' : 'ابدأ الكلام'}
            >
              {isProcessing ? (
                <Loader2 className="h-12 w-12 text-white animate-spin" />
              ) : isRecording ? (
                <Square className="h-12 w-12 text-white fill-white" />
              ) : (
                <Mic className="h-14 w-14 text-white" />
              )}
              {isRecording && (
                <span className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
              )}
            </button>
            <p className="mt-4 text-sm font-cairo text-muted-foreground text-center">
              {isProcessing
                ? 'جاري الترجمة...'
                : isRecording
                ? 'بتسجل... اضغط لما تخلص'
                : sourceLang === 'ar'
                ? 'اضغط واتكلم بالعربي'
                : 'Appuyez et parlez en français'}
            </p>

            {/* Guide message when voice unavailable (iOS Safari, etc.) */}
            {!voiceAvailable && (
              <p className="mt-3 text-xs font-cairo text-center text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2">
                للاستماع للترجمة اضغط على 🔊 — للكتابة اضغط على ⌨️
              </p>
            )}
          </div>
        )}

        {/* Text input mode toggle (works on all devices: iOS + Android) */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTextMode((m) => !m);
              if (isRecording) stopRecording();
            }}
            className="gap-2 font-cairo border-2"
          >
            <Keyboard className="h-4 w-4" />
            {textMode ? 'ارجع للميكروفون 🎙️' : '⌨️ اكتب بدل ما تتكلم'}
          </Button>
        </div>

        {/* Text input area */}
        {textMode && (
          <Card className="p-4 border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <Textarea
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={
                sourceLang === 'ar' ? 'اكتب جملتك هنا...' : 'Tapez votre phrase ici...'
              }
              dir={sourceLang === 'ar' ? 'rtl' : 'ltr'}
              lang={sourceLang === 'ar' ? 'ar-EG' : 'fr-FR'}
              className={cn(
                'min-h-[100px] text-base resize-none',
                sourceLang === 'ar' && 'font-cairo text-right',
              )}
              disabled={isProcessing}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void handleSubmitTyped();
                }
              }}
            />
            <Button
              onClick={() => void handleSubmitTyped()}
              disabled={!typedText.trim() || isProcessing}
              className="w-full mt-3 gap-2 bg-blue-500 hover:bg-blue-600 text-white font-cairo"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              ترجم دلوقتي
            </Button>
          </Card>
        )}

        {/* Animated translation loading indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 py-2" aria-live="polite">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-bounce" />
            <span className="ms-2 text-xs font-cairo text-blue-700 dark:text-blue-300">
              جاري الترجمة...
            </span>
          </div>
        )}

        {/* Original text */}
        {originalText && (
          <Card className="p-4 bg-muted/50 border-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {sourceLang === 'ar' ? '🇪🇬 اللي قلته' : '🇫🇷 Original'}
              </span>
              <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 px-2">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p
              className={cn('text-base leading-relaxed', sourceLang === 'ar' && 'font-cairo text-right')}
              dir={sourceLang === 'ar' ? 'rtl' : 'ltr'}
            >
              {originalText}
            </p>
          </Card>
        )}

        {/* Translated text (streamed token-by-token) */}
        {translatedText && (
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">
                {targetLang === 'ar' ? '🇪🇬 الترجمة' : '🇫🇷 Traduction'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => playTranslation()}
                disabled={isPlaying}
                className="h-7 px-2 text-blue-700 dark:text-blue-300"
                aria-label="استمع"
              >
                {isPlaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>
            <p
              className={cn(
                'text-lg leading-relaxed font-medium text-blue-950 dark:text-blue-100',
                targetLang === 'ar' && 'font-cairo text-right',
              )}
              dir={targetLang === 'ar' ? 'rtl' : 'ltr'}
            >
              {translatedText}
              {isProcessing && <span className="inline-block w-1.5 h-4 ms-1 bg-blue-500 animate-pulse align-middle" />}
            </p>

            {!isProcessing && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button onClick={handleCopy} variant="outline" className="gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="font-cairo">{copied ? 'اتنسخ' : 'انسخ'}</span>
                </Button>
                <Button
                  onClick={handleWhatsApp}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="font-cairo">واتساب</span>
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* History */}
        {showHistory && (
          <Card className="p-4 mt-6">
            <h2 className="text-base font-bold font-cairo mb-3 flex items-center gap-2">
              <History className="h-4 w-4" />
              سجل الترجمات
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground font-cairo text-center py-4">
                لسه مفيش ترجمات
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="border border-border rounded-lg p-3 bg-muted/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(h.created_at)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteHistoryItem(h.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p
                      className={cn(
                        'text-xs text-muted-foreground mb-1',
                        h.source_lang === 'ar' && 'font-cairo text-right',
                      )}
                      dir={h.source_lang === 'ar' ? 'rtl' : 'ltr'}
                    >
                      {h.source_text}
                    </p>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        h.target_lang === 'ar' && 'font-cairo text-right',
                      )}
                      dir={h.target_lang === 'ar' ? 'rtl' : 'ltr'}
                    >
                      {h.translated_text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
};

export default TranslatorPage;
