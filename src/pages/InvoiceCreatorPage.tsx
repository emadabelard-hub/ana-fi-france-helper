import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send, Loader2, PenLine, HelpCircle, FileText, Image, Copy, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import AuthModal from '@/components/auth/AuthModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
}

const STORAGE_KEY = 'invoice-mentor-session';

const InvoiceCreatorPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const getInitialMessage = (): Message => ({
    role: 'assistant',
    content: isRTL 
      ? `أهلاً بيك! 👋 أنا مستشارك المهني للفواتير والتقديرات.

مش بس هساعدك تعمل المستندات، لأ أنا كمان:
✅ هراجع أسعارك وأنصحك لو قليلة
✅ هفكرك بالمصاريف اللي ممكن تنساها
✅ هتأكد إن كل البيانات القانونية موجودة

عشان نبدأ، قولي:
1. 🏢 اسم شركتك ورقم SIRET
2. 👤 اسم العميل وعنوانه
3. 📋 عايز فاتورة (Facture) ولا تقدير (Devis)؟`
      : `Bonjour ! 👋 Je suis votre consultant professionnel pour factures et devis.

Je ne fais pas que créer vos documents, je :
✅ Vérifie vos prix et vous conseille
✅ Vous rappelle les frais oubliés
✅ M'assure que toutes les mentions légales sont présentes

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
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

  // Check if the last message contains a finalized document (table format)
  const hasGeneratedDocument = messages.length > 0 && 
    messages[messages.length - 1].role === 'assistant' &&
    (messages[messages.length - 1].content.includes('TOTAL') || 
     messages[messages.length - 1].content.includes('━━━'));

  const handleExportPDF = async () => {
    if (!messagesContainerRef.current) return;
    
    try {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role !== 'assistant') return;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      pdf.setFont('helvetica');
      pdf.setFontSize(10);
      
      const lines = pdf.splitTextToSize(lastMessage.content, pageWidth - 20);
      let yPosition = 20;
      
      lines.forEach((line: string) => {
        if (yPosition > 280) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, 10, yPosition);
        yPosition += 5;
      });

      pdf.save(`devis-${Date.now()}.pdf`);
      
      toast({
        title: isRTL ? "تم التحميل" : "Téléchargé",
        description: isRTL ? "تم حفظ الملف PDF" : "Le fichier PDF a été enregistré",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في إنشاء PDF" : "Échec de la création du PDF",
      });
    }
  };

  const handleExportImage = async () => {
    const lastMessageEl = document.querySelector('[data-last-message="true"]');
    if (!lastMessageEl) return;

    try {
      const canvas = await html2canvas(lastMessageEl as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = `devis-${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();

      toast({
        title: isRTL ? "تم الحفظ" : "Enregistré",
        description: isRTL ? "تم حفظ الصورة" : "L'image a été enregistrée",
      });
    } catch (error) {
      console.error('Image export error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في إنشاء الصورة" : "Échec de la création de l'image",
      });
    }
  };

  const handleCopyText = async () => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    try {
      await navigator.clipboard.writeText(lastMessage.content);
      toast({
        title: isRTL ? "تم النسخ" : "Copié",
        description: isRTL ? "تم نسخ النص للحافظة" : "Le texte a été copié",
      });
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في النسخ" : "Échec de la copie",
      });
    }
  };

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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          return (
            <div
              key={index}
              data-last-message={isLastMessage && message.role === 'assistant' ? "true" : undefined}
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
                  {message.content}
                </CardContent>
              </Card>
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

      {/* Export Buttons - Show when document is generated */}
      {hasGeneratedDocument && !isLoading && (
        <div className={cn(
          "flex gap-2 pb-3 border-b",
          isRTL && "flex-row-reverse"
        )}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className={cn("flex-1", isRTL && "flex-row-reverse font-cairo")}
          >
            <FileText className="h-4 w-4 mr-2" />
            {isRTL ? '📄 تحميل PDF' : '📄 Télécharger PDF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportImage}
            className={cn("flex-1", isRTL && "flex-row-reverse font-cairo")}
          >
            <Image className="h-4 w-4 mr-2" />
            {isRTL ? '🖼️ حفظ كصورة' : '🖼️ Enregistrer image'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyText}
            className={cn("flex-1", isRTL && "flex-row-reverse font-cairo")}
          >
            <Copy className="h-4 w-4 mr-2" />
            {isRTL ? '📋 نسخ النص' : '📋 Copier texte'}
          </Button>
        </div>
      )}

      {/* Input Area - Enter key creates new line, send via button only */}
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
