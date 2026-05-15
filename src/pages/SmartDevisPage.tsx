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
import { ArrowLeft, ArrowRight, Camera, Loader2, Plus, Sparkles, Trash2, X, Send, Languages } from 'lucide-react';
import VoiceInputButton from '@/components/shared/VoiceInputButton';

const INTRO_TIP_KEY = 'smart_devis_intro_tip_v1';
const introTipTitle = '💡 كيف تستخدم الديڤي الذكي ؟';
const introTipText = `① اكتب أو اتكلم بالعربي وصف الشغل اللي عايزه
   مثال : 'دهان حيطان وسقف ٢٠٠ متر بنتيرة أزرق'
② ممكن تضيف الأسعار مباشرة
   مثال : 'دهان حيطان بـ ٢٢ يورو المتر'
③ ممكن تحدد الوحدة
   مثال : 'تركيب باركيه فورفيه' أو 'سباكة ٣ نقط'
④ بعد التحليل تقدر تعدل أي حاجة بإيدك
⑤ اضغط التالي لإنشاء الديڤي`;


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
  const [showIntroTip, setShowIntroTip] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(INTRO_TIP_KEY) !== 'true'; } catch { return true; }
  });
  const dismissIntroTip = () => {
    setShowIntroTip(false);
    try { localStorage.setItem(INTRO_TIP_KEY, 'true'); } catch {}
  };

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

  const [translatingItemId, setTranslatingItemId] = useState<string | null>(null);
  const translateItemAr = async (item: LineItem) => {
    const ar = (item.designation_ar || '').trim();
    if (!ar) {
      toast({ variant: 'destructive', title: isRTL ? 'الوصف بالعربي فاضي' : 'Description arabe vide' });
      return;
    }
    setTranslatingItemId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('btp-translate', {
        body: { text: ar, sourceLang: 'ar', targetLang: 'fr' },
      });
      if (error) throw error;
      const fr = String(data?.translated || '').trim();
      if (fr) updateItem(item.id, { designation_fr: fr });
      else throw new Error('Empty translation');
    } catch (e: any) {
      console.error('[SmartDevis] translate item error:', e);
      toast({ variant: 'destructive', title: isRTL ? 'خطأ في الترجمة' : 'Erreur traduction', description: e?.message });
    } finally {
      setTranslatingItemId(null);
    }
  };

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
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} aria-label="back">
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
        {showIntroTip && (
          <div className="relative rounded-md border border-accent/30 bg-accent/10 p-4 animate-in fade-in slide-in-from-top-2 duration-300" dir="rtl">
            <button
              type="button"
              onClick={dismissIntroTip}
              className="absolute top-2 left-2 h-6 w-6 rounded-full hover:bg-accent/20 flex items-center justify-center"
              aria-label="اقفل"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="font-cairo text-right pr-2">
              <div className="font-semibold text-foreground mb-2">{introTipTitle}</div>
              <div className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed">{introTipText}</div>
            </div>
          </div>
        )}
        {/* Step 1: Input */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  {isRTL ? 'وصف الشغل' : 'Description du travail'}
                </label>
                <VoiceInputButton
                  onResult={(t) => setUserText(t)}
                  onDualResult={(r) => {
                    setRawArabic(r.raw || '');
                    setUserText(r.text || r.raw || '');
                  }}
                />
              </div>
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
                  {lineItems.length > 0 ? (
                    <>
                      <div className="rounded-md border border-border bg-muted p-3" dir="rtl">
                        <div className="text-xs text-muted-foreground mb-2 font-cairo">
                          ما قلته بالعربي (تقدر تعدّل) :
                        </div>
                        <Textarea
                          value={rawArabic}
                          onChange={(e) => setRawArabic(e.target.value)}
                          rows={3}
                          dir="rtl"
                          className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0 font-cairo"
                        />
                      </div>
                      <div className="rounded-md border border-primary/30 bg-background p-3" dir="ltr" lang="fr">
                        <div className="text-xs text-muted-foreground mb-2">الترجمة للفرنسي / Traduction française :</div>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-foreground">
                          {lineItems.map((it, idx) => {
                            const label = (it.designation_fr || it.designation_ar || '').trim() || `Ligne ${idx + 1}`;
                            const qty = Number(it.quantity) || 0;
                            const pu = Number(it.unitPrice) || 0;
                            return (
                              <li key={it.id} className="leading-snug">
                                <span className="font-medium">{label}</span>
                                {(qty > 0 || pu > 0 || it.unit) && (
                                  <span className="text-muted-foreground">
                                    {' — '}{qty} {it.unit}{pu > 0 ? ` × ${pu.toFixed(2).replace('.', ',')} €` : ''}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                  {rawArabic.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="w-full font-cairo"
                    >
                      {analyzing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Languages className="h-4 w-4 mr-2" />
                      )}
                      ترجم ↓
                    </Button>
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
                    <div className="flex gap-2">
                      <Input
                        value={item.designation_ar}
                        onChange={(e) => updateItem(item.id, { designation_ar: e.target.value })}
                        placeholder="الوصف بالعربي"
                        dir="rtl"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => translateItemAr(item)}
                        disabled={translatingItemId === item.id || !item.designation_ar.trim()}
                        className="shrink-0 font-cairo"
                        aria-label="ترجم"
                      >
                        {translatingItemId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Languages className="h-3 w-3 mr-1" />
                            ترجم
                          </>
                        )}
                      </Button>
                    </div>

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
