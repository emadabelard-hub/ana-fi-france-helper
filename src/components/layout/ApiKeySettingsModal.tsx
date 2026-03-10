import { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ApiKeySettingsModal = ({ open, onOpenChange }: Props) => {
  const { isRTL } = useLanguage();
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem('user_ai_api_key') || '';
      setKey(stored);
      setSaved(!!stored);
      setTestResult(null);
    }
  }, [open]);

  const handleSave = () => {
    if (key.trim()) {
      localStorage.setItem('user_ai_api_key', key.trim());
      setSaved(true);
    } else {
      localStorage.removeItem('user_ai_api_key');
      setSaved(false);
    }
  };

  const [errorDetail, setErrorDetail] = useState('');

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorDetail('');
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key.trim()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
          max_tokens: 5,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${response.status}`;
        if (response.status === 401) setErrorDetail(`Error 401: Invalid Key — ${msg}`);
        else if (response.status === 429) setErrorDetail(`Error 429: Quota — ${msg}`);
        else if (response.status === 404) setErrorDetail(`Error 404: Model Not Found — ${msg}`);
        else setErrorDetail(`Error ${response.status}: ${msg}`);
        setTestResult('fail');
        return;
      }

      const data = await response.json();
      setTestResult(data.choices?.[0]?.message?.content ? 'ok' : 'fail');
    } catch (e: any) {
      setErrorDetail(e?.message || 'Network error');
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2 text-base", isRTL && "flex-row-reverse font-cairo")}>
            <Key size={18} />
            {isRTL ? 'إعدادات مفتاح الذكاء الاصطناعي' : 'Clé API IA'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL 
              ? 'أدخل مفتاح الذكاء الاصطناعي المؤمن لتفعيل ميزة "اسأل المعلم".'
              : 'Entrez votre clé IA sécurisée pour activer "Demander au prof".'}
          </p>
          
          <input
            type="password"
            value={key}
            onChange={e => { setKey(e.target.value); setSaved(false); setTestResult(null); }}
            placeholder="sk-..."
            className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            dir="ltr"
          />

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={!key.trim()}>
              {saved ? (isRTL ? '✓ تم الحفظ' : '✓ Enregistré') : (isRTL ? 'حفظ' : 'Enregistrer')}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={!key.trim() || testing} className="flex-1">
              {testing ? <Loader2 size={16} className="animate-spin" /> : (isRTL ? 'اختبار الاتصال' : 'Tester')}
            </Button>
          </div>

          {testResult === 'ok' && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle size={16} /> {isRTL ? 'الاتصال ناجح ✓' : 'Connexion réussie ✓'}
            </div>
          )}
          {testResult === 'fail' && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                <XCircle size={16} /> {isRTL ? 'فشل الاتصال' : 'Échec de connexion'}
              </div>
              {errorDetail && (
                <p className="text-xs text-destructive/80 font-mono bg-destructive/5 rounded p-2 break-all" dir="ltr">
                  {errorDetail}
                </p>
              )}
            </div>
          )}

          {key.trim() && saved && (
            <button 
              onClick={() => { localStorage.removeItem('user_ai_api_key'); setKey(''); setSaved(false); setTestResult(null); }}
              className="text-xs text-destructive hover:underline"
            >
              {isRTL ? 'حذف المفتاح' : 'Supprimer la clé'}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApiKeySettingsModal;
