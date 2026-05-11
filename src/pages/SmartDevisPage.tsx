// SmartDevisPage - v4.0 Simple Flow
// Step 1: Saisie texte arabe + photo optionnelle
// Step 2: 1 appel analyze_image
// Step 3: Affichage direct des items dans formulaire éditable
// Step 4: Bouton final → /pro/invoice-creator
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Camera, Loader2, Plus, Sparkles, Trash2, X, Send } from 'lucide-react';
import DismissibleTip from '@/components/shared/DismissibleTip';

interface UploadedImage {
  id: string;
  data: string; // base64 (no prefix)
  name: string;
  preview: string; // data URL for thumbnail
  mimeType: string;
}

interface LineItem {
  id: string;
  designation_fr: string;
  designation_ar: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const SmartDevisPage = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userText, setUserText] = useState('');
  const [rawArabic, setRawArabic] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [subjectFr, setSubjectFr] = useState('');

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(f);
        });
        const compressedDataUrl = await compressImage(dataUrl);
        const base64 = compressedDataUrl.replace(/^data:[^;]+;base64,/, '');
        setImages(prev => [...prev, {
          id: generateId(),
          data: base64,
          name: f.name,
          preview: compressedDataUrl,
          mimeType: 'image/jpeg',
        }]);
      } catch (e) {
        console.error('[SmartDevis] image error:', e);
      }
    }
  }, []);

  const removeImage = (id: string) => setImages(prev => prev.filter(i => i.id !== id));

  const handleAnalyze = async () => {
    const arabic = rawArabic.trim();
    const french = userText.trim();
    const combined = [arabic, french].filter(Boolean).join('\n');
    if (!combined && images.length === 0) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'اكتب وصف الشغل أو ارفع صورة' : 'Décris le travail ou ajoute une photo',
      });
      return;
    }

    setAnalyzing(true);
    try {
      const firstImg = images[0];
      const { data, error } = await supabase.functions.invoke('smart-devis-analyzer', {
        body: {
          action: 'analyze_image',
          userMessage: combined,
          imageData: firstImg?.data,
          mimeType: firstImg?.mimeType,
        },
      });
      if (error) throw error;
      const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.suggestedItems) ? data.suggestedItems : []);
      console.log('[SmartDevis] items reçus:', items);

      const mapped: LineItem[] = items.map((it: any, idx: number) => ({
        id: `ai-${Date.now()}-${idx}`,
        designation_fr: String(it.designation_fr || '').trim(),
        designation_ar: String(it.designation_ar || it.designation_fr || '').trim(),
        quantity: Number(it.quantity) || 1,
        unit: String(it.unit || 'm²'),
        unitPrice: Number(it.unitPrice) || 0,
      }));

      setLineItems(mapped);
      setSubjectFr(String(data?.devis_subject_fr || data?.subject || ''));

      if (mapped.length === 0) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'لم يتم إنشاء أي بند' : 'Aucune ligne générée',
        });
      }
    } catch (e: any) {
      console.error('[SmartDevis] analyze error:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ في التحليل' : 'Erreur d\'analyse',
        description: e?.message || String(e),
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setLineItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };
  const removeItem = (id: string) => setLineItems(prev => prev.filter(it => it.id !== id));
  const addItem = () => setLineItems(prev => [...prev, {
    id: generateId(),
    designation_fr: '',
    designation_ar: '',
    quantity: 1,
    unit: 'm²',
    unitPrice: 0,
  }]);

  const grandTotal = lineItems.reduce((s, it) => s + (it.quantity * it.unitPrice), 0);

  const handleCreateDevis = () => {
    if (lineItems.length === 0) {
      toast({ variant: 'destructive', title: isRTL ? 'لا توجد بنود' : 'Aucune ligne' });
      return;
    }
    try {
      const sitePhotos = images.map(i => ({ data: i.data, name: i.name }));
      const prefillData = {
        items: lineItems.map(item => ({
          ...item,
          id: generateId(),
          total: item.quantity * item.unitPrice,
          referenceUnitPrice: item.unitPrice,
          materialsIncluded: true,
        })),
        source: 'smart_devis',
        priceMode: 'reference_fixed',
        sitePhotos,
        descriptionChantier: subjectFr || 'Travaux de rénovation',
      };

      try {
        localStorage.removeItem('invoice_draft_v1');
        sessionStorage.removeItem('invoice_draft_v1');
        sessionStorage.setItem('quoteToInvoiceData', JSON.stringify(prefillData));
      } catch (e) {
        console.warn('[SmartDevis] storage error:', e);
      }

      navigate('/pro/invoice-creator?type=devis&prefill=smart');
    } catch (e: any) {
      console.error('[SmartDevis] handleCreateDevis error:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ تقني' : 'Erreur technique',
        description: e?.message || String(e),
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pro')} aria-label="back">
            <Arrow className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">
              {isRTL ? 'الديڤي الذكي' : 'Devis intelligent'}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Step 1: Input */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {isRTL ? 'وصف الشغل' : 'Description du travail'}
              </label>
              <Textarea
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                onVoiceDual={(r) => {
                  setRawArabic(r.raw || '');
                  setUserText(r.text || r.raw || '');
                }}
                placeholder={isRTL
                  ? 'اكتب أو سجّل صوتياً : مثلاً "بنتيرة زرقا ساتيني للحيطان 25 متر بـ 18 يورو"'
                  : 'Décris le travail (arabe ou français)'}
                rows={4}
                enableVoice
                dir={isRTL ? 'rtl' : 'ltr'}
                className="resize-none"
              />
              {(rawArabic.trim() || userText.trim()) && (
                <div className="mt-3 space-y-2">
                  {rawArabic.trim() && (
                    <div className="rounded-md border border-border bg-muted p-3" dir="rtl">
                      <div className="text-xs text-muted-foreground mb-1 font-cairo">ما قلته بالعربي (تقدر تعدّل) :</div>
                      <Textarea
                        value={rawArabic}
                        onChange={(e) => setRawArabic(e.target.value)}
                        rows={3}
                        dir="rtl"
                        className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0 font-cairo"
                      />
                    </div>
                  )}
                  {userText.trim() && (
                    <div className="rounded-md border border-primary/30 bg-background p-3" dir="ltr" lang="fr">
                      <div className="text-xs text-muted-foreground mb-1">الترجمة للفرنسي / Traduction française :</div>
                      <Textarea
                        value={userText}
                        onChange={(e) => setUserText(e.target.value)}
                        rows={3}
                        dir="ltr"
                        lang="fr"
                        className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photo */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                {isRTL ? 'إضافة صورة (اختياري)' : 'Ajouter une photo (optionnel)'}
              </Button>

              {images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {images.map(img => (
                    <div key={img.id} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                      <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        aria-label="remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full"
              size="lg"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isRTL ? 'جاري التحليل...' : 'Analyse en cours...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isRTL ? 'تحليل وإنشاء الديڤي' : 'Analyser et générer le devis'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Step 3: Editable items */}
        {lineItems.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  {isRTL ? 'البنود' : 'Lignes du devis'}
                </h2>
                <Button variant="ghost" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  {isRTL ? 'إضافة بند' : 'Ajouter'}
                </Button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item, idx) => (
                  <div key={item.id} className="border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} aria-label="remove">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <Input
                      value={item.designation_fr}
                      onChange={(e) => updateItem(item.id, { designation_fr: e.target.value })}
                      placeholder="Désignation (français)"
                      lang="fr"
                      dir="ltr"
                    />
                    <Input
                      value={item.designation_ar}
                      onChange={(e) => updateItem(item.id, { designation_ar: e.target.value })}
                      placeholder="الوصف بالعربي"
                      dir="rtl"
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          {isRTL ? 'الكمية' : 'Qté'}
                        </label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                          lang="fr"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          {isRTL ? 'الوحدة' : 'Unité'}
                        </label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          {isRTL ? 'السعر €' : 'PU €'}
                        </label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) || 0 })}
                          lang="fr"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="text-right text-sm font-medium">
                      {(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')} €
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-border">
                <span className="font-semibold">{isRTL ? 'الإجمالي HT' : 'Total HT'}</span>
                <span className="text-lg font-bold">
                  {grandTotal.toFixed(2).replace('.', ',')} €
                </span>
              </div>

              <Button onClick={handleCreateDevis} className="w-full" size="lg">
                <Send className="h-4 w-4 mr-2" />
                {isRTL ? 'إنشاء الديڤي' : 'Créer le devis'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SmartDevisPage;
