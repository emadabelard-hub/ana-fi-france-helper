import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, Sparkles, Loader2, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AddExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRTL: boolean;
  userId: string;
  onExpenseAdded: () => void;
  preselectedDocumentId?: string | null;
}

const categories = [
  { value: 'materials', labelFr: 'Matériaux', labelAr: 'مواد' },
  { value: 'tools', labelFr: 'Outils', labelAr: 'أدوات' },
  { value: 'transport', labelFr: 'Transport', labelAr: 'نقل' },
  { value: 'food', labelFr: 'Repas', labelAr: 'وجبات' },
  { value: 'office', labelFr: 'Fournitures', labelAr: 'لوازم مكتبية' },
  { value: 'insurance', labelFr: 'Assurance', labelAr: 'تأمين' },
  { value: 'telecom', labelFr: 'Télécom', labelAr: 'اتصالات' },
  { value: 'other', labelFr: 'Autre', labelAr: 'أخرى' },
];

const AddExpenseModal = ({ open, onOpenChange, isRTL, userId, onExpenseAdded, preselectedDocumentId }: AddExpenseModalProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<{ id: string; label: string }[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(preselectedDocumentId || '');

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [tvaAmount, setTvaAmount] = useState('0');
  const [category, setCategory] = useState('other');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Load user devis/factures for linking
  useEffect(() => {
    if (!open || !userId) return;
    supabase.from('documents_comptables')
      .select('id, document_number, client_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setDocuments((data || []).map((d: any) => ({
          id: d.id,
          label: `${d.document_number} — ${d.client_name}`,
        })));
      });
  }, [open, userId]);

  const resetForm = () => {
    setTitle(''); setAmount(''); setTvaAmount('0'); setCategory('other');
    setExpenseDate(new Date().toISOString().slice(0, 10)); setNotes('');
    setReceiptPreview(null); setReceiptFile(null); setSelectedDocId(preselectedDocumentId || '');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setReceiptPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAIAnalyze = async () => {
    if (!receiptPreview) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-receipt', {
        body: { imageBase64: receiptPreview },
      });

      if (error) throw error;

      if (data.title) setTitle(data.title);
      if (data.amount) setAmount(String(data.amount));
      if (data.tva_amount) setTvaAmount(String(data.tva_amount));
      if (data.category) setCategory(data.category);
      if (data.date) setExpenseDate(data.date);
      if (data.notes) setNotes(data.notes);

      toast({ title: isRTL ? '✅ تم التحليل بنجاح' : '✅ Analyse réussie' });
    } catch (err: any) {
      console.error('AI analysis error:', err);
      toast({
        title: isRTL ? '⚠️ خطأ في التحليل' : '⚠️ Erreur d\'analyse',
        description: isRTL ? 'حاول مرة أخرى أو أدخل البيانات يدوياً' : 'Réessayez ou saisissez manuellement',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !amount) {
      toast({
        title: isRTL ? '⚠️ بيانات ناقصة' : '⚠️ Données manquantes',
        description: isRTL ? 'أدخل العنوان والمبلغ على الأقل' : 'Saisissez au moins le titre et le montant',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let receiptUrl: string | null = null;

      // Upload receipt if exists
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(path, receiptFile);
        if (!uploadError) {
          receiptUrl = path;
        }
      }

      const { error } = await (supabase.from('expenses') as any).insert({
        user_id: userId,
        title: title.trim(),
        amount: parseFloat(amount),
        tva_amount: parseFloat(tvaAmount) || 0,
        category,
        expense_date: expenseDate,
        notes: notes.trim() || null,
        receipt_url: receiptUrl,
      });

      if (error) throw error;

      toast({ title: isRTL ? '✅ تمت إضافة المصروف' : '✅ Dépense ajoutée' });
      resetForm();
      onOpenChange(false);
      onExpenseAdded();
    } catch (err: any) {
      console.error('Save expense error:', err);
      toast({
        title: isRTL ? '❌ خطأ' : '❌ Erreur',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className={cn('flex items-center gap-2 text-accent', isRTL && 'flex-row-reverse font-cairo')}>
            <Receipt className="h-5 w-5" />
            {isRTL ? 'إضافة مصروف جديد' : 'Ajouter une dépense'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label className={cn('text-sm font-bold text-muted-foreground', isRTL && 'text-right block font-cairo')}>
              {isRTL ? 'صورة الإيصال' : 'Photo du reçu'}
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            {receiptPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={receiptPreview} alt="Receipt" className="w-full max-h-48 object-cover" />
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {isRTL ? 'تغيير' : 'Changer'}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleAIAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {isRTL ? 'تحليل ذكي' : 'Analyser'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-24 border-dashed border-accent/30 hover:border-accent/60 hover:bg-accent/5 flex flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-accent/60" />
                <span className={cn('text-xs text-muted-foreground', isRTL && 'font-cairo')}>
                  {isRTL ? 'التقط صورة أو اختر ملف' : 'Prendre une photo ou choisir un fichier'}
                </span>
              </Button>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className={cn('text-xs font-bold text-muted-foreground', isRTL && 'text-right block font-cairo')}>
              {isRTL ? 'العنوان *' : 'Titre *'}
            </Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isRTL ? 'مثال: شراء دهان' : 'Ex: Achat peinture'}
              className={cn('bg-background border-border', isRTL && 'text-right font-cairo')}
            />
          </div>

          {/* Amount + TVA row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={cn('text-xs font-bold text-muted-foreground', isRTL && 'text-right block font-cairo')}>
                {isRTL ? 'المبلغ (€) *' : 'Montant (€) *'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={cn('text-xs font-bold text-muted-foreground', isRTL && 'text-right block font-cairo')}>
                {isRTL ? 'TVA (€)' : 'TVA (€)'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={tvaAmount}
                onChange={e => setTvaAmount(e.target.value)}
                placeholder="0.00"
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Category + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={cn('text-xs font-bold text-muted-foreground', isRTL && 'text-right block font-cairo')}>
                {isRTL ? 'الفئة' : 'Catégorie'}
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {isRTL ? c.labelAr : c.labelFr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className={cn('text-xs font-bold text-muted-foreground', isRTL && 'text-right block font-cairo')}>
                {isRTL ? 'التاريخ' : 'Date'}
              </Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className={cn('text-xs font-bold text-muted-foreground', isRTL && 'text-right block font-cairo')}>
              {isRTL ? 'ملاحظات' : 'Notes'}
            </Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isRTL ? 'ملاحظات إضافية...' : 'Notes supplémentaires...'}
              className={cn('bg-background border-border min-h-[60px]', isRTL && 'text-right font-cairo')}
            />
          </div>

          {/* Save */}
          <Button
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {isRTL ? 'حفظ المصروف' : 'Enregistrer la dépense'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddExpenseModal;
