import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send, Loader2, PenLine, HelpCircle, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import AuthModal from '@/components/auth/AuthModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const InvoiceCreatorPage = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([
    {
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
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Allow anonymous/guest users - no auth check required
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
        
        {/* Education Mode Button */}
        <button
          onClick={() => setShowEducationModal(true)}
          className={cn(
            "flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors",
            isRTL && "flex-row-reverse font-cairo"
          )}
        >
          <HelpCircle className="h-4 w-4" />
          <span>{isRTL ? 'إيه الفرق بين الفاتورة والدوفي؟' : 'Quelle est la différence entre Facture et Devis?'}</span>
        </button>
      </section>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((message, index) => (
          <div
            key={index}
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
        ))}
        
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
            placeholder={isRTL ? 'اكتب رسالتك هنا...' : 'Écrivez votre message...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className={cn(
              "flex-1 min-h-[48px] max-h-[120px] resize-none",
              isRTL && "text-right font-cairo"
            )}
            rows={1}
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
