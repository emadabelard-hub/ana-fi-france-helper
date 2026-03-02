import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import AuthModal from '@/components/auth/AuthModal';
import MarkdownRenderer from '@/components/assistant/MarkdownRenderer';
import {
  ArrowLeft, ArrowRight, Camera, Image as ImageIcon, FileText, Map,
  Send, Loader2, Trash2, Plus, Sparkles, CheckCircle2, Edit3, Download
} from 'lucide-react';

interface LineItem {
  id: string;
  designation_fr: string;
  designation_ar: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

type InputType = 'photo' | 'blueprint' | 'document' | null;
type Step = 'select_input' | 'upload' | 'chat' | 'review';

const SmartDevisPage = () => {
  const { isRTL, t } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('select_input');
  const [inputType, setInputType] = useState<InputType>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [materialQuality, setMaterialQuality] = useState<string>('standard');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [profitMarginPercent, setProfitMarginPercent] = useState<number>(15);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [preferencesCollected, setPreferencesCollected] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleInputTypeSelect = (type: InputType) => {
    if (!user) { setShowAuth(true); return; }
    setInputType(type);
    setStep('upload');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'الملف كبير أوي', description: 'الحد الأقصى 10 ميجا' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setUploadedFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!uploadedImage) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-devis-analyzer', {
        body: {
          action: 'analyze_image',
          imageData: uploadedImage,
          mimeType: uploadedImage.split(';')[0]?.split(':')[1] || 'image/jpeg',
          userMessage: inputType === 'blueprint'
            ? "Analyse ce plan/croquis et lis les dimensions exactes indiquées."
            : inputType === 'document'
            ? "Extrais les informations de ce document pour générer un devis."
            : "Analyse cette photo de chantier et estime les travaux nécessaires avec +10% de marge de sécurité.",
        },
      });
      if (error) throw error;
      setAnalysisData(data);
      // Start chat with analysis summary
      setChatMessages([{
        role: 'assistant',
        content: `✅ **تحليل الصورة:**\n\n${data.analysis || 'تم التحليل'}\n\n${data.estimatedArea ? `📐 المساحة المقدرة: **${data.estimatedArea}**` : ''}\n\n---\nدلوقتي عايز أسألك كام سؤال عشان نعمل الدوفي صح:\n\n1️⃣ **جودة المواد؟** (اقتصادي / عادي / فخم)\n2️⃣ **هل في خصم؟** (نسبة %)\n3️⃣ **نسبة الربح المطلوبة؟** (%)`
      }]);
      setStep('chat');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ في التحليل', description: err.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg: ChatMsg = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const streamUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-devis-analyzer`;
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      const resp = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'chat',
          conversationHistory: [...chatMessages, userMsg],
          userMessage: chatInput.trim(),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      let assistantSoFar = '';
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > 1 && prev[prev.length - 2]?.role === 'user') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { /* partial JSON */ }
        }
      }

      // Check if ready signal
      if (assistantSoFar.includes('✅') && assistantSoFar.includes('جاهز')) {
        setPreferencesCollected(true);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateItems = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-devis-analyzer', {
        body: {
          action: 'generate_items',
          analysisData,
          materialQuality,
          discountPercent,
          profitMarginPercent,
        },
      });
      if (error) throw error;

      const items: LineItem[] = (data.items || data.suggestedItems || []).map((item: any) => ({
        id: generateId(),
        designation_fr: item.designation_fr || '',
        designation_ar: item.designation_ar || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'u',
        unitPrice: item.unitPrice || 0,
        total: (item.quantity || 1) * (item.unitPrice || 0),
        category: item.category,
      }));

      setLineItems(items);
      setStep('review');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ في التوليد', description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = updated.quantity * updated.unitPrice;
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => setLineItems(prev => prev.filter(i => i.id !== id));

  const addItem = () => {
    setLineItems(prev => [...prev, {
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: 1,
      unit: 'u',
      unitPrice: 0,
      total: 0,
    }]);
  };

  const grandTotal = lineItems.reduce((sum, i) => sum + i.total, 0);

  const handleSendToInvoice = () => {
    // Store items in sessionStorage and redirect to invoice creator
    const prefillData = {
      items: lineItems.map(item => ({
        ...item,
        id: generateId(),
      })),
      source: 'smart_devis',
    };
    sessionStorage.setItem('smartDevisData', JSON.stringify(prefillData));
    navigate('/pro/invoice-creator?type=devis&prefill=smart');
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  const INPUT_TYPES = [
    { type: 'photo' as const, icon: Camera, emoji: '📸', title: 'صورة الشانتي', titleFr: 'Photo du chantier', desc: 'صوّر الشغل وأنا أقدّر', gradient: 'from-blue-500 to-blue-600' },
    { type: 'blueprint' as const, icon: Map, emoji: '🗺️', title: 'خريطة أو كروكي', titleFr: 'Plan ou croquis', desc: 'ارفع المخطط وأنا أقرأ المقاسات', gradient: 'from-emerald-500 to-emerald-600' },
    { type: 'document' as const, icon: FileText, emoji: '📄', title: 'مستند أو نص', titleFr: 'Document ou texte', desc: 'ارفع PDF أو الصق نص من إيميل', gradient: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div className="py-4 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
        <Button variant="ghost" size="icon" onClick={() => navigate('/pro')}>
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn("flex-1", isRTL && "text-right")}>
          <h1 className={cn("text-xl font-bold text-foreground", isRTL && "font-cairo")}>
            🏗️ {isRTL ? 'الدوفي الذكي' : 'Smart Devis IA'}
          </h1>
          <p className={cn("text-xs text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'حوّل الصور لدوفي احترافي بالذكاء الاصطناعي' : 'Transformez vos photos en devis professionnel'}
          </p>
        </div>
        <Badge variant="secondary" className="text-xs font-bold">14,99€</Badge>
      </div>

      {/* Step 1: Select Input Type */}
      {step === 'select_input' && (
        <div className="space-y-3">
          <p className={cn("text-sm font-medium text-center text-muted-foreground", isRTL && "font-cairo")}>
            {isRTL ? 'اختار نوع المدخل:' : 'Choisissez le type d\'entrée:'}
          </p>
          {INPUT_TYPES.map(({ type, emoji, title, titleFr, desc, gradient }) => (
            <Card
              key={type}
              className={cn("cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-none overflow-hidden", `bg-gradient-to-r ${gradient}`)}
              onClick={() => handleInputTypeSelect(type)}
            >
              <CardContent className="p-0">
                <div className={cn("flex items-center gap-4 p-5", isRTL && "flex-row-reverse")}>
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="text-2xl">{emoji}</span>
                  </div>
                  <div className={cn("flex-1", isRTL && "text-right")}>
                    <h3 className={cn("text-lg font-bold text-white", isRTL && "font-cairo")}>{title}</h3>
                    <p className="text-white/70 text-xs">{titleFr}</p>
                    <p className={cn("text-white/80 text-xs mt-1", isRTL && "font-cairo")}>{desc}</p>
                  </div>
                  <Arrow className="h-5 w-5 text-white/60" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className={cn("text-base", isRTL && "text-right font-cairo")}>
              {isRTL ? 'ارفع الملف' : 'Téléchargez le fichier'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept={inputType === 'document' ? 'image/*,application/pdf' : 'image/*'}
              className="hidden"
              onChange={handleFileUpload}
            />

            {!uploadedImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo")}>
                  {isRTL ? 'اضغط هنا لرفع الصورة أو الملف' : 'Cliquez pour télécharger'}
                </p>
                <p className={cn("text-xs text-muted-foreground/70 mt-3 leading-relaxed max-w-sm mx-auto", isRTL && "font-cairo")}>
                  {isRTL 
                    ? 'يمكنك تصوير موقع العمل، رفع مخطط هندسي، ملف PDF، أو حتى تصوير قائمة طلبات الزبون المكتوبة بخط اليد؛ وسيقوم الذكاء الاصطناعي بتحليل كل شيء فوراً.'
                    : 'Photo de chantier, plan, PDF ou liste manuscrite du client — l\'IA analyse tout instantanément.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border">
                  <img src={uploadedImage} alt="Preview" className="w-full max-h-64 object-contain bg-muted/30" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => { setUploadedImage(null); setUploadedFileName(''); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center truncate">{uploadedFileName}</p>
              </div>
            )}

            <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
              <Button variant="outline" onClick={() => { setStep('select_input'); setUploadedImage(null); }} className="flex-1">
                {isRTL ? 'رجوع' : 'Retour'}
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={!uploadedImage || isAnalyzing}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className={cn("mr-2", isRTL && "font-cairo")}>
                  {isAnalyzing ? (isRTL ? 'بحلل...' : 'Analyse...') : (isRTL ? 'حلل بالذكاء الاصطناعي' : 'Analyser avec l\'IA')}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: AI Chat */}
      {step === 'chat' && (
        <div className="space-y-3">
          {/* Uploaded image thumbnail */}
          {uploadedImage && (
            <div className="flex justify-center">
              <img src={uploadedImage} alt="Analyzed" className="h-20 rounded-lg border object-cover" />
            </div>
          )}

          {/* Chat messages */}
          <ScrollArea className="h-[45vh] rounded-xl border bg-muted/20 p-3">
            <div className="space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start'))}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border shadow-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} isRTL={isRTL} />
                    ) : (
                      <p className={cn(isRTL && "font-cairo text-right")} dir={isRTL ? 'rtl' : 'ltr'}>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                <div className={cn("flex", isRTL ? 'justify-end' : 'justify-start')}>
                  <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Preferences quick select */}
          <Card className="p-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>
                  {isRTL ? 'جودة المواد' : 'Qualité'}
                </label>
                <Select value={materialQuality} onValueChange={setMaterialQuality}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eco">🏷️ Éco</SelectItem>
                    <SelectItem value="standard">⭐ Standard</SelectItem>
                    <SelectItem value="luxe">💎 Luxe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>
                  {isRTL ? 'خصم %' : 'Remise %'}
                </label>
                <Input type="number" min={0} max={50} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div>
                <label className={cn("text-[10px] font-medium text-muted-foreground block mb-1", isRTL && "text-right font-cairo")}>
                  {isRTL ? 'ربح %' : 'Marge %'}
                </label>
                <Input type="number" min={0} max={100} value={profitMarginPercent} onChange={e => setProfitMarginPercent(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
          </Card>

          {/* Chat input */}
          <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
            <Textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={isRTL ? 'اكتب رسالتك...' : 'Votre message...'}
              className={cn("min-h-[44px] max-h-[100px] resize-none text-sm", isRTL && "text-right font-cairo")}
              dir={isRTL ? 'rtl' : 'ltr'}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); /* no send on enter */ } }}
            />
            <Button size="icon" onClick={handleChatSend} disabled={!chatInput.trim() || isChatLoading} className="shrink-0">
              {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {/* Generate button */}
          <Button
            className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-bold"
            onClick={handleGenerateItems}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            <span className={cn(isRTL && "font-cairo")}>
              {isRTL ? '🏗️ ولّد الدوفي الذكي' : '🏗️ Générer le Smart Devis'}
            </span>
          </Button>
        </div>
      )}

      {/* Step 4: Review & Edit */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
            <h2 className={cn("text-lg font-bold", isRTL && "font-cairo")}>
              {isRTL ? '📋 مراجعة وتعديل البنود' : '📋 Revue & Modification'}
            </h2>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              {isRTL ? 'أضف' : 'Ajouter'}
            </Button>
          </div>

          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <Card key={item.id} className="p-3">
                <div className="space-y-2">
                  <div className={cn("flex items-start gap-2", isRTL && "flex-row-reverse")}>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{idx + 1}</Badge>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={item.designation_fr}
                        onChange={e => updateItem(item.id, 'designation_fr', e.target.value)}
                        placeholder="Désignation FR"
                        className="text-xs h-8"
                      />
                      <Input
                        value={item.designation_ar}
                        onChange={e => updateItem(item.id, 'designation_ar', e.target.value)}
                        placeholder="الوصف بالعربي"
                        className={cn("text-xs h-8", isRTL && "text-right font-cairo")}
                        dir="rtl"
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <label className="text-[9px] text-muted-foreground">{isRTL ? 'كمية' : 'Qté'}</label>
                      <Input type="number" min={0} step={0.1} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="text-xs h-7" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">{isRTL ? 'وحدة' : 'Unité'}</label>
                      <Select value={item.unit} onValueChange={v => updateItem(item.id, 'unit', v)}>
                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="m²">m²</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="u">u</SelectItem>
                          <SelectItem value="h">h</SelectItem>
                          <SelectItem value="forfait">forfait</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">{isRTL ? 'سعر' : 'P.U.'}</label>
                      <Input type="number" min={0} step={0.01} value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} className="text-xs h-7" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Total</label>
                      <div className="h-7 flex items-center text-xs font-bold text-emerald-600">
                        {formatCurrency(item.total)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Grand Total */}
          <Card className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white">
            <CardContent className={cn("flex items-center justify-between p-4", isRTL && "flex-row-reverse")}>
              <span className={cn("font-bold text-lg", isRTL && "font-cairo")}>
                {isRTL ? 'المجموع الكلي HT' : 'Total HT'}
              </span>
              <span className="font-bold text-2xl">{formatCurrency(grandTotal)}</span>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold"
              onClick={handleSendToInvoice}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              <span className={cn(isRTL && "font-cairo")}>
                {isRTL ? '✅ أرسل للدوفي النهائي' : '✅ Envoyer vers le Devis final'}
              </span>
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setStep('chat')}>
              <Edit3 className="h-4 w-4 mr-2" />
              <span className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'رجوع للدردشة' : 'Retour au chat'}
              </span>
            </Button>
          </div>
        </div>
      )}

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </div>
  );
};

export default SmartDevisPage;
