import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send, Loader2, PenLine, HelpCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import AuthModal from '@/components/auth/AuthModal';
import InvoiceDisplay, { InvoiceData } from '@/components/invoice/InvoiceDisplay';
import InvoiceActions from '@/components/invoice/InvoiceActions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  invoiceData?: InvoiceData;
}

const STORAGE_KEY = 'invoice-mentor-session';

// Parse invoice JSON from AI response
const parseInvoiceData = (content: string): InvoiceData | null => {
  const startMarker = '---INVOICE_START---';
  const endMarker = '---INVOICE_END---';
  
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) return null;
  
  try {
    const jsonStr = content.substring(startIndex + startMarker.length, endIndex).trim();
    return JSON.parse(jsonStr) as InvoiceData;
  } catch (error) {
    console.error('Failed to parse invoice data:', error);
    return null;
  }
};

// Get display content without the JSON block
const getDisplayContent = (content: string): string => {
  const startMarker = '---INVOICE_START---';
  const endMarker = '---INVOICE_END---';
  
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) return content;
  
  const beforeJson = content.substring(0, startIndex).trim();
  const afterJson = content.substring(endIndex + endMarker.length).trim();
  
  return `${beforeJson}\n\n${afterJson}`.trim();
};

const InvoiceCreatorPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const getInitialMessage = (): Message => ({
    role: 'assistant',
    content: isRTL 
      ? `أهلاً بيك! 👋 أنا مستشارك المهني للفواتير والتقديرات.

أنا مش مجرد أداة، أنا مدربك الشخصي! 🎯

✅ هسألك عن المصنعية (Main d'œuvre) - شغلك يستاهل فلوس!
✅ هسألك عن مصاريف التنقل (Frais de déplacement) - البنزين مش ببلاش!
✅ هفكرك بالمستهلكات (Fournitures) - المسامير والسليكون بفلوس!
✅ هظبط معاك الـ TVA حسب وضعك القانوني

عشان نبدأ، قولي:
1. 🏢 اسم شركتك ورقم SIRET
2. 👤 اسم العميل وعنوانه
3. 📋 عايز فاتورة (Facture) ولا تقدير (Devis)؟`
      : `Bonjour ! 👋 Je suis votre consultant professionnel pour factures et devis.

Je ne suis pas qu'un simple outil, je suis votre coach ! 🎯

✅ Je vérifie la main d'œuvre - votre travail mérite d'être payé !
✅ Je calcule les frais de déplacement - l'essence n'est pas gratuite !
✅ Je n'oublie pas les fournitures - vis, silicone, tout compte !
✅ Je configure la TVA selon votre statut juridique

Pour commencer, dites-moi :
1. 🏢 Nom de votre entreprise et SIRET
2. 👤 Nom et adresse du client
3. 📋 Facture ou Devis ?`
  });

  const [messages, setMessages] = useState<Message[]>([getInitialMessage()]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Message[] | null>(null);
  const [showArabic, setShowArabic] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Check for saved session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as Message[];
        if (parsed.length > 1) {
          setPendingMessages(parsed);
          setShowResumeModal(true);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleResumeSession = () => {
    if (pendingMessages) {
      setMessages(pendingMessages);
    }
    setShowResumeModal(false);
    setPendingMessages(null);
  };

  const handleNewSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([getInitialMessage()]);
    setShowResumeModal(false);
    setPendingMessages(null);
  };

  const handleClearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([getInitialMessage()]);
    setShowArabic(false);
    toast({
      title: isRTL ? "تم المسح" : "Effacé",
      description: isRTL ? "تم بدء محادثة جديدة" : "Nouvelle conversation démarrée",
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('invoice-mentor', {
        body: { 
          message: userMessage,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          variant: "destructive",
          title: isRTL ? "خطأ" : "Erreur",
          description: data.error,
        });
        return;
      }

      const responseContent = data.response;
      const invoiceData = parseInvoiceData(responseContent);
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: responseContent,
        invoiceData: invoiceData || undefined
      }]);
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "حدث خطأ أثناء المعالجة" : "Une erreur est survenue.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get the last message with invoice data
  const lastInvoiceMessage = [...messages].reverse().find(m => m.invoiceData);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <section className={cn(
        "flex items-center gap-4 py-4",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/pro')}
          className="shrink-0"
        >
          {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className={cn(
          "flex items-center gap-3 flex-1",
          isRTL && "flex-row-reverse"
        )}>
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <PenLine className="h-5 w-5 text-green-600" />
          </div>
          <div className={cn("flex-1", isRTL && "text-right")}>
            <h1 className={cn(
              "text-lg font-bold text-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'فواتيرك ودوفيهاتك معانا' : 'Vos Factures & Devis'}
            </h1>
            <p className={cn(
              "text-xs text-muted-foreground",
              isRTL && "font-cairo"
            )}>
              {isRTL ? 'المساعد الذكي للمستندات المهنية' : 'Assistant intelligent pour documents pro'}
            </p>
          </div>
        </div>
        
        {/* Clear Session Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClearSession}
          className="shrink-0"
          title={isRTL ? "مسح المحادثة" : "Effacer la conversation"}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        
        {/* Education Mode Button */}
        <button
          onClick={() => setShowEducationModal(true)}
          className={cn(
            "flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors",
            isRTL && "flex-row-reverse font-cairo"
          )}
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">{isRTL ? 'إيه الفرق بين الفاتورة والدوفي؟' : 'Facture vs Devis?'}</span>
        </button>
      </section>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((message, index) => {
          const displayContent = message.role === 'assistant' 
            ? getDisplayContent(message.content) 
            : message.content;
          const hasInvoice = message.invoiceData != null;
          
          return (
            <div key={index} className="space-y-3">
              {/* Message Bubble */}
              <div
                className={cn(
                  "flex",
                  message.role === 'user' 
                    ? (isRTL ? 'justify-start' : 'justify-end')
                    : (isRTL ? 'justify-end' : 'justify-start')
                )}
              >
                <Card className={cn(
                  "max-w-[85%]",
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}>
                  <CardContent className={cn(
                    "p-3 text-sm whitespace-pre-wrap",
                    isRTL && "font-cairo text-right"
                  )}>
                    {displayContent}
                  </CardContent>
                </Card>
              </div>

              {/* Invoice Display (if present) */}
              {hasInvoice && message.invoiceData && (
                <div className="space-y-4">
                  <InvoiceActions
                    invoiceData={message.invoiceData}
                    invoiceRef={invoiceRef}
                    showArabic={showArabic}
                    onToggleArabic={setShowArabic}
                  />
                  <div ref={invoiceRef}>
                    <InvoiceDisplay 
                      data={message.invoiceData} 
                      showArabic={showArabic} 
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {isLoading && (
          <div className={cn(
            "flex",
            isRTL ? 'justify-end' : 'justify-start'
          )}>
            <Card className="bg-muted">
              <CardContent className="p-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t pt-4 pb-2">
        <div className={cn(
          "flex items-end gap-2",
          isRTL && "flex-row-reverse"
        )}>
          <Textarea
            placeholder={isRTL ? 'اكتب رسالتك هنا... (Enter = سطر جديد)' : 'Écrivez votre message... (Entrée = nouvelle ligne)'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className={cn(
              "flex-1 min-h-[48px] max-h-[120px] resize-none",
              isRTL && "text-right font-cairo"
            )}
            rows={2}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className={cn("h-5 w-5", isRTL && "rotate-180")} />
            )}
          </Button>
        </div>
      </div>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      
      {/* Session Resume Modal */}
      <Dialog open={showResumeModal} onOpenChange={setShowResumeModal}>
        <DialogContent className={cn("max-w-md", isRTL && "font-cairo")}>
          <DialogHeader>
            <DialogTitle className={cn(isRTL && "text-right font-cairo")}>
              {isRTL ? '🔄 تكملة شغل ولا جديد؟' : '🔄 Reprendre ou nouveau?'}
            </DialogTitle>
            <DialogDescription className={cn(isRTL && "text-right font-cairo")}>
              {isRTL 
                ? 'أنا فاكر آخر مرة كنا شغالين على دوفي. تحب نكمل عليه ولا نبدأ واحد جديد؟'
                : 'J\'ai trouvé une session précédente. Voulez-vous la reprendre ou en commencer une nouvelle?'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={handleNewSession}>
              {isRTL ? '🆕 دوفي جديد' : '🆕 Nouveau devis'}
            </Button>
            <Button onClick={handleResumeSession}>
              {isRTL ? '▶️ نكمل القديم' : '▶️ Reprendre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Education Modal */}
      <Dialog open={showEducationModal} onOpenChange={setShowEducationModal}>
        <DialogContent className={cn("max-w-md", isRTL && "font-cairo")}>
          <DialogHeader>
            <DialogTitle className={cn(isRTL && "text-right font-cairo")}>
              {isRTL ? '📚 إيه الفرق بين الفاتورة والدوفي؟' : '📚 Différence entre Facture et Devis'}
            </DialogTitle>
          </DialogHeader>
          
          <div className={cn("space-y-4 text-sm", isRTL && "text-right")}>
            {/* Devis Section */}
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h3 className="font-bold text-amber-700 dark:text-amber-400 mb-2">
                {isRTL ? '📝 التقدير (Devis)' : '📝 Le Devis'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL 
                  ? 'ده عرض سعر قبل ما تبدأ الشغل. لما العميل يوقع عليه، بيبقى عقد ملزم للطرفين. يعني لازم تلتزم بالسعر اللي كتبته.'
                  : "C'est une proposition de prix avant les travaux. Une fois signé par le client, il devient un contrat engageant les deux parties."
                }
              </p>
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                {isRTL ? '⚠️ مهم: لما توقع، مفيش تغيير في السعر!' : '⚠️ Important: Une fois signé, le prix est fixe!'}
              </div>
            </div>

            {/* Facture Section */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <h3 className="font-bold text-primary mb-2">
                {isRTL ? '🧾 الفاتورة (Facture)' : '🧾 La Facture'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL 
                  ? 'دي بتتعمل بعد ما تخلص الشغل. بتطلب فيها الفلوس من العميل. لازم تحتوي على كل البيانات القانونية (SIRET، التاريخ، رقم الفاتورة، إلخ).'
                  : "Elle est émise après les travaux pour demander le paiement. Elle doit contenir toutes les mentions légales obligatoires."
                }
              </p>
              <div className="mt-2 text-xs text-primary">
                {isRTL ? '💰 العميل لازم يدفع خلال 30 يوم (عادةً)' : '💰 Le client doit payer sous 30 jours (généralement)'}
              </div>
            </div>

            {/* TVA Section */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <h3 className="font-bold text-blue-700 dark:text-blue-400 mb-2">
                {isRTL ? '💶 الضريبة (TVA)' : '💶 La TVA'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL 
                  ? 'لو Auto-entrepreneur: مفيش TVA (هتكتب: TVA non applicable). لو شركة: 10% للتجديد، 20% للبناء الجديد.'
                  : "Auto-entrepreneur: pas de TVA. Société: 10% rénovation, 20% construction neuve."
                }
              </p>
            </div>

            {/* Summary */}
            <div className="p-3 rounded-lg bg-muted text-center">
              <p className="text-muted-foreground text-xs">
                {isRTL 
                  ? '💡 باختصار: الدوفي = قبل الشغل | الفاتورة = بعد الشغل'
                  : '💡 En résumé: Devis = Avant | Facture = Après'
                }
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceCreatorPage;
