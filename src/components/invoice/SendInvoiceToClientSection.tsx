import { useEffect, useState } from 'react';
import { Loader2, Mail, Copy, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface Props {
  documentId: string;
  defaultEmail?: string;
}

interface TokenRow {
  id: string;
  token: string;
  client_email: string;
  created_at: string;
  expires_at: string;
  status: string;
  viewed_at: string | null;
  downloaded_at: string | null;
}

const PUBLIC_BASE = 'https://anafypro.com';

export default function SendInvoiceToClientSection({ documentId, defaultEmail }: Props) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail || '');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from('invoice_tokens')
      .select('id, token, client_email, created_at, expires_at, status, viewed_at, downloaded_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });
    if (!error && data) setHistory(data as TokenRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: isRTL ? 'بريد غير صحيح' : 'Email invalide', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invoice-to-client', {
        body: { document_id: documentId, client_email: trimmed },
      });
      if (error) throw error;
      toast({
        title: isRTL ? 'تم إرسال الرابط' : 'Lien envoyé',
        description: isRTL
          ? `تم الإرسال إلى ${trimmed}. ينتهي الرابط خلال 48 ساعة.`
          : `Email envoyé à ${trimmed}. Lien expire dans 48h.`,
      });
      await loadHistory();
    } catch (e) {
      console.error(e);
      toast({
        title: isRTL ? 'فشل الإرسال' : 'Échec de l\'envoi',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const copyLink = async (token: string) => {
    const url = `${PUBLIC_BASE}/invoice/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: isRTL ? 'تم النسخ' : 'Lien copié' });
    } catch {
      toast({ title: url });
    }
  };

  const statusLabel = (row: TokenRow) => {
    if (row.downloaded_at) return isRTL ? 'تم التحميل' : 'downloaded';
    if (row.viewed_at) return isRTL ? 'تمت المشاهدة' : 'viewed';
    return isRTL ? 'تم الإرسال' : 'sent';
  };

  return (
    <div className={cn('pt-4 mt-4 border-t border-border space-y-3', isRTL && 'text-right')}>
      <h3 className={cn('text-sm font-bold flex items-center gap-2', isRTL && 'flex-row-reverse')}>
        <Mail className="h-4 w-4" />
        {isRTL ? 'إرسال للعميل' : 'Envoi au client'}
      </h3>

      <div className={cn('flex gap-2', isRTL && 'flex-row-reverse')}>
        <Input
          type="email"
          lang="fr"
          dir="ltr"
          placeholder={isRTL ? 'بريد العميل' : 'Email du client'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={sending || !email.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isRTL ? 'إرسال' : 'Envoyer'}
        </Button>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">
          {isRTL ? 'سجل الإرسال' : 'Historique d\'envoi'}
        </p>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {isRTL ? 'لا شيء بعد' : 'Aucun envoi.'}
          </p>
        ) : (
          <div className="border border-border rounded-md divide-y divide-border overflow-hidden">
            {history.map((row) => (
              <div
                key={row.id}
                className={cn('flex items-center justify-between gap-2 px-3 py-2 text-xs', isRTL && 'flex-row-reverse')}
              >
                <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                  <p className="font-medium truncate" dir="ltr">{row.client_email}</p>
                  <p className="text-muted-foreground">
                    {new Date(row.created_at).toLocaleString('fr-FR')} — {statusLabel(row)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyLink(row.token)}
                  className="gap-1 shrink-0"
                >
                  <Copy className="h-3 w-3" />
                  {isRTL ? 'نسخ' : 'Copier'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
