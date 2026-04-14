import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Hash, Save } from 'lucide-react';

const NumberingSettingsSection = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [lastDevis, setLastDevis] = useState('');
  const [lastFacture, setLastFacture] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('document_counters')
        .select('document_type, last_number')
        .eq('user_id', user.id)
        .eq('year', year);

      if (data) {
        for (const row of data) {
          if (row.document_type === 'devis') setLastDevis(String(row.last_number));
          if (row.document_type === 'facture') setLastFacture(String(row.last_number));
        }
      }
      setLoading(false);
    };
    load();
  }, [user, year]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const devisNum = lastDevis.trim() ? parseInt(lastDevis.trim(), 10) : 0;
      const factureNum = lastFacture.trim() ? parseInt(lastFacture.trim(), 10) : 0;

      if (lastDevis.trim() && (isNaN(devisNum) || devisNum < 0 || devisNum > 9999)) {
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'رقم غير صالح' : 'Numéro invalide' });
        setSaving(false);
        return;
      }
      if (lastFacture.trim() && (isNaN(factureNum) || factureNum < 0 || factureNum > 9999)) {
        toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'رقم غير صالح' : 'Numéro invalide' });
        setSaving(false);
        return;
      }

      await Promise.all([
        supabase.from('document_counters').upsert({
          user_id: user.id,
          document_type: 'devis',
          year,
          last_number: devisNum,
        }, { onConflict: 'user_id,document_type,year' }),
        supabase.from('document_counters').upsert({
          user_id: user.id,
          document_type: 'facture',
          year,
          last_number: factureNum,
        }, { onConflict: 'user_id,document_type,year' }),
      ]);

      toast({
        title: isRTL ? 'تم الحفظ ✓' : 'Enregistré ✓',
        description: isRTL
          ? `الدوفي التالي: D-${year}-${String(devisNum + 1).padStart(3, '0')} | الفاتورة التالية: F-${year}-${String(factureNum + 1).padStart(3, '0')}`
          : `Prochain devis : D-${year}-${String(devisNum + 1).padStart(3, '0')} | Prochaine facture : F-${year}-${String(factureNum + 1).padStart(3, '0')}`,
      });
    } catch (err) {
      console.error('[numbering-settings]', err);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ' : 'Erreur', description: isRTL ? 'فشل الحفظ' : 'Échec' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={cn("text-base font-bold flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
          <Hash className="h-4 w-4" />
          {isRTL ? 'إعداد الترقيم' : 'Numérotation des documents'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className={cn("text-xs text-muted-foreground", isRTL && "text-right font-cairo")}>
          {isRTL
            ? 'حدد آخر رقم مستخدم. المستند التالي سيحصل على الرقم + 1.'
            : 'Indiquez le dernier numéro utilisé. Le prochain document prendra le numéro suivant.'}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className={cn("text-xs font-bold", isRTL && "font-cairo")}>
              {isRTL ? 'آخر دوفي' : 'Dernier devis'}
            </Label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground font-mono">D-{year}-</span>
              <Input
                value={lastDevis}
                onChange={(e) => setLastDevis(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0"
                className="font-mono text-left w-16 h-8 text-sm"
                dir="ltr"
                type="text"
                enableVoice={false}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={cn("text-xs font-bold", isRTL && "font-cairo")}>
              {isRTL ? 'آخر فاتورة' : 'Dernière facture'}
            </Label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground font-mono">F-{year}-</span>
              <Input
                value={lastFacture}
                onChange={(e) => setLastFacture(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0"
                className="font-mono text-left w-16 h-8 text-sm"
                dir="ltr"
                type="text"
                enableVoice={false}
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm" className={cn("w-full font-bold", isRTL && "font-cairo")}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? (isRTL ? 'جاري الحفظ...' : 'Enregistrement...') : (isRTL ? 'حفظ الترقيم' : 'Enregistrer')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default NumberingSettingsSection;
