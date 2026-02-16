import { useState, useCallback, useRef } from 'react';
import { MessageCircleQuestion, Send, Loader2, Volume2, Sparkles, Paperclip, X, FileText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTTS } from '@/hooks/useWebSpeech';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
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

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-teacher`;

const AskTeacherButton = ({ currentPhrase, lessonTitle }: AskTeacherButtonProps) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const tts = useTTS();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [attachment, setAttachment] = useState<{ data: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setAnswer('❌ الملف كبير جداً (الحد الأقصى 5 ميجا)');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      setAnswer('❌ يرجى رفع صورة (JPG/PNG) أو ملف PDF فقط');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setAttachment({
          data: ev.target.result as string,
          name: file.name,
          type: isImage ? 'image' : 'pdf',
        });
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Primary: Edge Function call via fetch (not supabase.functions.invoke)
  const callEdgeFunction = async (body: any): Promise<{ answer?: string; error?: string }> => {
    const session = (await supabase.auth.getSession()).data.session;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { error: data?.error || `HTTP ${resp.status}` };
    }
    return data;
  };


  const handleAsk = useCallback(async () => {
    if ((!question.trim() && !attachment) || loading) return;
    setLoading(true);
    setAnswer('');
    setIsLive(false);

    const body = {
      question: question.trim() || (attachment ? 'ما هذا؟ اشرح لي.' : ''),
      currentPhrase,
      lessonTitle,
      imageData: attachment?.type === 'image' ? attachment.data : undefined,
    };

    try {
      const result = await callEdgeFunction(body);

      if (result.answer) {
        setAnswer(result.answer);
        setIsLive(true);
        setAttachment(null);
        return;
      }

      setAnswer(result.error || 'حدث خطأ — حاول مرة أخرى');
    } catch (e: any) {
      console.error('Ask teacher error:', e);
      setAnswer('خطأ في الاتصال — تحقق من الإنترنت وحاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  }, [question, currentPhrase, lessonTitle, loading, attachment]);

  const handleClose = () => {
    setOpen(false);
    setAnswer('');
    setQuestion('');
    setIsLive(false);
    setAttachment(null);
    tts.stop();
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".jpg,.jpeg,.png,.pdf"
        className="hidden"
      />

      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[#F59E0B] border-2 border-[#D97706] text-white flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-90 transition-all"
        aria-label="Ask the teacher"
      >
        <MessageCircleQuestion size={26} />
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent className="bg-[#1a1d23] border-amber-500/20 text-white max-w-[92vw] sm:max-w-md top-[35%]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400 text-base">
              <MessageCircleQuestion size={18} />
              {isRTL ? 'اسأل المعلم 🧑‍🏫' : 'Demander au prof 🧑‍🏫'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {answer && (
              <div className="bg-[#22262e] rounded-2xl p-4 border border-amber-500/10 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-sm text-amber-100/90 leading-relaxed font-cairo whitespace-pre-wrap" dir="rtl">{answer}</p>
                {isLive && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
                    <Sparkles size={10} /> AI Live
                  </span>
                )}
                {tts.isSupported && answer && (
                  <button
                    onClick={() => tts.isSpeaking ? tts.stop() : tts.speak(answer)}
                    className="flex items-center gap-1.5 text-[10px] text-amber-400/70 font-bold"
                  >
                    <Volume2 size={12} /> {tts.isSpeaking ? (isRTL ? 'إيقاف' : 'Stop') : (isRTL ? 'استمع للإجابة' : 'Écouter')}
                  </button>
                )}
              </div>
            )}

            {attachment && (
              <div className="flex items-center gap-2 bg-[#22262e] rounded-xl p-2 border border-amber-500/10">
                {attachment.type === 'image' ? (
                  <img src={attachment.data} alt="upload" className="h-10 w-10 object-cover rounded" />
                ) : (
                  <div className="h-10 w-10 flex items-center justify-center bg-red-500/10 rounded">
                    <FileText size={18} className="text-red-400" />
                  </div>
                )}
                <span className="flex-1 text-xs text-slate-400 truncate">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="text-slate-500 hover:text-red-400">
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 active:scale-90 transition-all"
              >
                <Paperclip size={18} />
              </button>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder={isRTL ? 'اكتب سؤالك أو أرسل صورة...' : 'Posez votre question...'}
                className="flex-1 bg-[#22262e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/30 font-cairo resize-none min-h-[48px] max-h-[120px]"
                dir="rtl"
                disabled={loading}
                autoFocus
                rows={1}
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
              />
              <button
                onClick={handleAsk}
                disabled={loading || (!question.trim() && !attachment)}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0',
                  loading ? 'bg-amber-500/10 text-amber-400/50' : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 active:scale-90'
                )}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>

            {!user && (
              <p className="text-[10px] text-slate-600 text-center font-cairo" dir="rtl">
                سجّل دخولك للحصول على 5 أسئلة مجانية يومياً
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AskTeacherButton;
