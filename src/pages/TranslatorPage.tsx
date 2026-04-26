import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2, Volume2, Copy, Check, Trash2, History, MessageCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const targetLang: Lang = sourceLang === 'ar' ? 'fr' : 'ar';

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('translation_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setHistory(data as HistoryItem[]);
  }, [user]);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  useEffect(() => {
    return () => {
      stopGlobalAudio();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async () => {
    try {
      stopGlobalAudio();
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

  const handleTranscribeAndTranslate = async (audioBlob: Blob) => {
    try {
      // 1. Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const audioBase64 = btoa(binary);

      // 2. Transcribe via existing voice-field-input edge function
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

      // For Arabic source, prefer raw Arabic transcript; for French, use cleaned text
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

      setOriginalText(transcribed);

      // 3. Translate
      const { data: translateData, error: translateError } = await supabase.functions.invoke(
        'btp-translate',
        {
          body: { text: transcribed, sourceLang, targetLang },
        },
      );

      if (translateError) throw translateError;

      const translated = (translateData?.translated || '').trim();
      if (!translated) throw new Error('Empty translation');

      setTranslatedText(translated);

      // 4. Save history
      if (user) {
        await supabase.from('translation_history').insert({
          user_id: user.id,
          source_lang: sourceLang,
          target_lang: targetLang,
          source_text: transcribed,
          translated_text: translated,
        });
      }

      // 5. Auto play TTS
      void playTranslation(translated);
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

  const playTranslation = async (text?: string) => {
    const value = (text ?? translatedText).trim();
    if (!value) return;
    try {
      setIsPlaying(true);
      await playTTS(value, 'nova');
    } catch (err) {
      console.error('TTS error:', err);
    } finally {
      setIsPlaying(false);
    }
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
    stopGlobalAudio();
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

        {/* Mic button */}
        <div className="flex flex-col items-center py-6">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={cn(
              'relative w-32 h-32 rounded-full flex items-center justify-center transition-all shadow-2xl',
              isRecording
                ? 'bg-red-500 scale-110 animate-pulse'
                : 'bg-blue-500 hover:bg-blue-600 active:scale-95',
              isProcessing && 'opacity-50 cursor-not-allowed',
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
        </div>

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

        {/* Translated text */}
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
            </p>

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
