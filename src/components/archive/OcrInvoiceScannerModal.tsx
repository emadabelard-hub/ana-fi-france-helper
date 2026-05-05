import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, Loader2, ScanLine, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { archivePdf } from '@/lib/documentArchive';

interface OcrInvoiceScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRTL: boolean;
  userId: string;
  onSaved: () => void;
}

interface ExtractedData {
  fournisseur: string | null;
  date: string | null;
  montant_ht: number | null;
  taux_tva: number | null;
  montant_tva: number | null;
  montant_ttc: number | null;
  description: string | null;
  numero_facture: string | null;
}

const EMPTY: ExtractedData = {
  fournisseur: null, date: null, montant_ht: null, taux_tva: null,
  montant_tva: null, montant_ttc: null, description: null, numero_facture: null,
};

// DD/MM/YYYY -> YYYY-MM-DD
const toIsoDate = (s: string | null): string => {
  if (!s) return new Date().toISOString().slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // fallback: maybe already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
};

const OcrInvoiceScannerModal = ({ open, onOpenChange, isRTL, userId, onSaved }: OcrInvoiceScannerModalProps) => {
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [unreadable, setUnreadable] = useState(false);

  const reset = () => {
    setPhotoPreview(null); setPhotoFile(null); setExtracted(null);
    setUnreadable(false); setScanning(false); setSaving(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Reset input value so re-selecting the same file re-triggers onChange
    e.target.value = '';
    setPhotoFile(f);
    setExtracted(null);
    setUnreadable(false);
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      // For PDFs we cannot show as <img>; use a placeholder preview state but still send to OCR
      setPhotoPreview(isPdf ? null : b64);
      runScan(b64);
    };
    reader.readAsDataURL(f);
  };

  const runScan = async (b64: string) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('ocr-invoice-scan', {
        body: { imageBase64: b64 },
      });
      if (error) throw error;
      if (data?.error === 'unreadable' || data?.error) {
        setUnreadable(true);
        setExtracted({ ...EMPTY });
        return;
      }
      setExtracted({
        fournisseur: data.fournisseur ?? null,
        date: data.date ?? null,
        montant_ht: typeof data.montant_ht === 'number' ? data.montant_ht : null,
        taux_tva: typeof data.taux_tva === 'number' ? data.taux_tva : null,
        montant_tva: typeof data.montant_tva === 'number' ? data.montant_tva : null,
        montant_ttc: typeof data.montant_ttc === 'number' ? data.montant_ttc : null,
        description: data.description ?? null,
        numero_facture: data.numero_facture ?? null,
      });
    } catch (err) {
      console.error('[ocr-invoice-scan] failed:', err);
      setUnreadable(true);
      setExtracted({ ...EMPTY });
    } finally {
      setScanning(false);
    }
  };

  const updateField = <K extends keyof ExtractedData>(k: K, v: ExtractedData[K]) => {
    setExtracted((prev) => ({ ...(prev ?? EMPTY), [k]: v }));
  };

  const handleSave = async () => {
    if (!extracted || !photoFile) return;
    const ttc = extracted.montant_ttc ?? extracted.montant_ht ?? 0;
    if (!ttc || !extracted.fournisseur) {
      toast({
        variant: 'destructive',
        title: isRTL ? '⚠️ بيانات ناقصة' : 'Données manquantes',
        description: isRTL ? 'المورد والمبلغ مطلوبان' : 'Fournisseur et montant requis',
      });
      return;
    }
    setSaving(true);
    try {
      // 1. Upload original photo to notes-frais folder
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const safeName = `OCR_${Date.now()}.${ext}`;
      const photoPath = `${userId}/notes-frais/${safeName}`;
      await supabase.storage.from('documents').upload(photoPath, photoFile, {
        contentType: photoFile.type || 'image/jpeg',
        upsert: false,
      });

      const tva = extracted.montant_tva ?? 0;

      // 2. Insert expense row
      const { error: expError } = await (supabase.from('expenses') as any).insert({
        user_id: userId,
        title: extracted.description || extracted.fournisseur || 'Facture scannée',
        amount: ttc,
        tva_amount: tva,
        category: 'other',
        expense_date: toIsoDate(extracted.date),
        notes: [
          extracted.fournisseur && `Fournisseur : ${extracted.fournisseur}`,
          extracted.numero_facture && `N° facture : ${extracted.numero_facture}`,
          extracted.taux_tva != null && `TVA ${extracted.taux_tva}%`,
        ].filter(Boolean).join(' · '),
        receipt_url: photoPath,
      });
      if (expError) throw expError;

      // 3. Register in documents table with OCR_ prefix so MyDocuments shows badge
      // Convert image to a Blob for archive
      const blob = photoFile;
      await archivePdf({
        blob,
        type: 'note_frais',
        numero: extracted.numero_facture,
        fileName: `OCR_${extracted.fournisseur || 'facture'}_${toIsoDate(extracted.date)}.${ext}`,
        amount: ttc,
        status: 'ocr',
      }).catch((e) => console.warn('[ocr] archive failed', e));

      toast({ title: isRTL ? '✅ تم الحفظ' : '✅ Enregistré' });
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error('[ocr] save error:', err);
      toast({
        variant: 'destructive',
        title: isRTL ? '❌ خطأ' : 'Erreur',
        description: err?.message || 'unknown',
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (val: any) =>
    cn(
      'bg-background border-border',
      val != null && val !== '' ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-orange-500/60 bg-orange-500/5'
    );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className={cn('flex items-center gap-2 text-accent', isRTL && 'flex-row-reverse font-cairo')}>
            <ScanLine className="h-5 w-5" />
            {isRTL ? '📷 مسح فاتورة' : 'Scanner une facture'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />

          {!photoPreview ? (
            <Button
              variant="outline"
              className="w-full h-32 border-dashed border-accent/40 hover:border-accent hover:bg-accent/5 flex flex-col gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-8 w-8 text-accent/70" />
              <span className={cn('text-sm font-semibold', isRTL && 'font-cairo')}>
                {isRTL ? 'التقط صورة الفاتورة' : 'Photographier la facture'}
              </span>
              <span className={cn('text-xs text-muted-foreground flex items-center gap-1', isRTL && 'font-cairo')}>
                <Upload className="h-3 w-3" />
                {isRTL ? 'أو اختر من المعرض' : 'ou choisir depuis la galerie'}
              </span>
            </Button>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-border">
              <img src={photoPreview} alt="facture" className="w-full max-h-44 object-cover" />
              <Button
                size="sm" variant="secondary"
                className="absolute bottom-2 right-2 gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning || saving}
              >
                <Camera className="h-3.5 w-3.5" />
                {isRTL ? 'تغيير' : 'Changer'}
              </Button>
            </div>
          )}

          {scanning && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isRTL ? 'جاري قراءة الفاتورة...' : 'Lecture de la facture en cours...'}
            </div>
          )}

          {unreadable && !scanning && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className={cn('text-sm', isRTL && 'font-cairo text-right flex-1')}>
                <p className="font-semibold text-destructive">
                  {isRTL ? 'الصورة غير واضحة، حاول مرة أخرى' : 'Image floue, réessayez'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRTL ? 'يمكنك إكمال البيانات يدوياً أدناه' : 'Vous pouvez remplir les champs manuellement ci-dessous.'}
                </p>
              </div>
            </div>
          )}

          {extracted && !scanning && (
            <>
              <div className={cn(
                'rounded-lg p-2.5 text-xs flex items-center gap-2',
                unreadable ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                isRTL && 'flex-row-reverse font-cairo text-right'
              )}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{isRTL ? 'تحقق من المعلومات قبل الحفظ' : 'Vérifiez les informations avant de sauvegarder'}</span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className={cn('text-xs font-bold', isRTL && 'text-right block font-cairo')}>
                    {isRTL ? 'المورد' : 'Fournisseur'}
                  </Label>
                  <Input
                    value={extracted.fournisseur ?? ''}
                    onChange={(e) => updateField('fournisseur', e.target.value || null)}
                    className={fieldClass(extracted.fournisseur)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">Date</Label>
                    <Input
                      lang="fr" dir="ltr"
                      value={extracted.date ?? ''}
                      placeholder="DD/MM/YYYY"
                      onChange={(e) => updateField('date', e.target.value || null)}
                      className={fieldClass(extracted.date)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">N° facture</Label>
                    <Input
                      lang="fr" dir="ltr"
                      value={extracted.numero_facture ?? ''}
                      onChange={(e) => updateField('numero_facture', e.target.value || null)}
                      className={fieldClass(extracted.numero_facture)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">HT (€)</Label>
                    <Input
                      lang="fr" dir="ltr" type="number" step="0.01"
                      value={extracted.montant_ht ?? ''}
                      onChange={(e) => updateField('montant_ht', e.target.value ? parseFloat(e.target.value) : null)}
                      className={fieldClass(extracted.montant_ht)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">TVA %</Label>
                    <Input
                      lang="fr" dir="ltr" type="number" step="0.1"
                      value={extracted.taux_tva ?? ''}
                      onChange={(e) => updateField('taux_tva', e.target.value ? parseFloat(e.target.value) : null)}
                      className={fieldClass(extracted.taux_tva)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold">TVA (€)</Label>
                    <Input
                      lang="fr" dir="ltr" type="number" step="0.01"
                      value={extracted.montant_tva ?? ''}
                      onChange={(e) => updateField('montant_tva', e.target.value ? parseFloat(e.target.value) : null)}
                      className={fieldClass(extracted.montant_tva)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">TTC (€) *</Label>
                  <Input
                    lang="fr" dir="ltr" type="number" step="0.01"
                    value={extracted.montant_ttc ?? ''}
                    onChange={(e) => updateField('montant_ttc', e.target.value ? parseFloat(e.target.value) : null)}
                    className={cn(fieldClass(extracted.montant_ttc), 'font-bold')}
                  />
                </div>

                <div className="space-y-1">
                  <Label className={cn('text-xs font-bold', isRTL && 'text-right block font-cairo')}>
                    {isRTL ? 'الوصف' : 'Description'}
                  </Label>
                  <Textarea
                    value={extracted.description ?? ''}
                    onChange={(e) => updateField('description', e.target.value || null)}
                    className={cn(fieldClass(extracted.description), 'min-h-[60px]')}
                  />
                </div>
              </div>

              <Button
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold gap-2"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isRTL ? 'حفظ كنوت دو فري' : 'Enregistrer la note de frais'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OcrInvoiceScannerModal;
