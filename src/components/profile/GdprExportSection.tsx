import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const GdprExportSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [profile, documents, comptables, translations, expenses, clients, chantiers] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('documents').select('*').eq('user_id', user.id),
          supabase.from('documents_comptables').select('*').eq('user_id', user.id),
          supabase.from('translation_history').select('*').eq('user_id', user.id),
          supabase.from('expenses').select('*').eq('user_id', user.id),
          supabase.from('clients').select('*').eq('user_id', user.id),
          supabase.from('chantiers').select('*').eq('user_id', user.id),
        ]);

      const payload = {
        export_metadata: {
          generated_at: new Date().toISOString(),
          user_id: user.id,
          email: user.email,
          format_version: '1.0',
          rights: 'RGPD Article 20 - Droit à la portabilité',
        },
        profile: profile.data ?? null,
        clients: clients.data ?? [],
        chantiers: chantiers.data ?? [],
        documents: documents.data ?? [],
        documents_comptables: comptables.data ?? [],
        expenses: expenses.data ?? [],
        translation_history: translations.data ?? [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anafy-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'تم التصدير',
        description: 'تم تنزيل ملف بياناتك بنجاح.',
      });
    } catch (error) {
      console.error('GDPR export error:', error);
      toast({
        title: 'خطأ',
        description: 'تعذر تصدير البيانات. حاول مرة تانية.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={loading}
      className="w-full gap-2 h-12 rounded-2xl border-primary/20 text-primary hover:bg-primary/5 font-semibold font-cairo"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      تصدير بياناتي الشخصية
    </Button>
  );
};

export default GdprExportSection;
