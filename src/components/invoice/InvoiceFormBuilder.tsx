import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile, Profile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import { Plus, Trash2, FileText, Building2, User, MapPin, HardHat, Edit3, Truck, Wand2 } from 'lucide-react';
import InvoiceDisplay, { InvoiceData } from './InvoiceDisplay';
import InvoiceActions from './InvoiceActions';
import LineItemEditor, { LineItem } from './LineItemEditor';
import QuoteWizardModal from './QuoteWizardModal';

interface InvoiceFormBuilderProps {
  documentType: 'devis' | 'facture';
  onBack: () => void;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Generate document number
const generateDocNumber = (type: 'devis' | 'facture') => {
  const prefix = type === 'devis' ? 'DEV' : 'FAC';
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${year}${month}-${random}`;
};

const InvoiceFormBuilder = ({ documentType, onBack }: InvoiceFormBuilderProps) => {
  const { isRTL } = useLanguage();
  const { profile } = useProfile();
  const invoiceRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [workSiteSameAsClient, setWorkSiteSameAsClient] = useState(true);
  const [workSiteAddress, setWorkSiteAddress] = useState('');
  
  // Travel costs state
  const [includeTravelCosts, setIncludeTravelCosts] = useState(false);
  const [travelDescription, setTravelDescription] = useState('');
  const [travelPrice, setTravelPrice] = useState(30);
  
  // Line items
  const [items, setItems] = useState<LineItem[]>([
    {
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: 1,
      unit: 'm²',
      unitPrice: 0,
      total: 0,
    }
  ]);
  
  // Invoice preview state
  const [showPreview, setShowPreview] = useState(false);
  const [showArabic, setShowArabic] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  
  // Quote Wizard state
  const [showWizard, setShowWizard] = useState(false);
  
  // Handle wizard-generated items
  const handleWizardGenerate = (generatedItems: LineItem[]) => {
    // Replace existing items with generated ones (or merge if there are already valid items)
    const existingValidItems = items.filter(item => item.designation_fr.trim() && item.unitPrice > 0);
    if (existingValidItems.length > 0) {
      // Merge: append generated items to existing valid items
      setItems([...existingValidItems, ...generatedItems]);
    } else {
      // Replace: no valid items exist, just use generated ones
      setItems(generatedItems);
    }
  };
  
  // Build invoice data from form
  const buildInvoiceData = (): InvoiceData => {
    // Combine regular items with travel costs if enabled
    const allItems = [...items.filter(item => item.designation_fr.trim() && item.unitPrice > 0)];
    
    // Add travel costs as a line item if enabled
    if (includeTravelCosts && travelPrice > 0) {
      allItems.push({
        id: generateId(),
        designation_fr: travelDescription || 'Frais de déplacement',
        designation_ar: 'مصاريف النقل',
        quantity: 1,
        unit: 'forfait',
        unitPrice: travelPrice,
        total: travelPrice,
      });
    }
    
    const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);
    const tvaExempt = profile?.legal_status === 'auto-entrepreneur';
    const tvaRate = tvaExempt ? 0 : 10; // Default 10% for renovation
    const tvaAmount = tvaExempt ? 0 : Math.round(subtotal * (tvaRate / 100) * 100) / 100;
    const total = subtotal + tvaAmount;
    
    return {
      type: documentType === 'devis' ? 'DEVIS' : 'FACTURE',
      number: generateDocNumber(documentType),
      date: new Date().toLocaleDateString('fr-FR'),
      validUntil: documentType === 'devis' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')
        : undefined,
      emitter: {
        name: profile?.company_name || 'Votre Entreprise',
        siret: profile?.siret || '',
        address: profile?.company_address || '',
        phone: profile?.phone || '',
        email: profile?.email || '',
      },
      client: {
        name: clientName || 'Client',
        address: clientAddress || '',
      },
      workSite: {
        sameAsClient: workSiteSameAsClient,
        address: workSiteSameAsClient ? undefined : workSiteAddress,
      },
      items: allItems.map(item => ({
        designation_fr: item.designation_fr,
        designation_ar: item.designation_ar || item.designation_fr,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      subtotal: Math.round(subtotal * 100) / 100,
      tvaRate,
      tvaAmount,
      tvaExempt,
      total: Math.round(total * 100) / 100,
      paymentTerms: 'Paiement à réception de facture',
      legalMentions: tvaExempt 
        ? 'TVA non applicable, article 293 B du CGI'
        : undefined,
    };
  };
  
  const invoiceData = buildInvoiceData();
  
  // Check if form is valid
  const isFormValid = clientName.trim() && items.some(item => item.designation_fr.trim() && item.unitPrice > 0);
  
  // Handle item quantity/price change
  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // Recalculate total if quantity or unitPrice changed
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = Math.round(updated.quantity * updated.unitPrice * 100) / 100;
      }
      
      return updated;
    }));
  };
  
  // Add new line item
  const addLineItem = () => {
    setItems(prev => [...prev, {
      id: generateId(),
      designation_fr: '',
      designation_ar: '',
      quantity: 1,
      unit: 'u',
      unitPrice: 0,
      total: 0,
    }]);
  };
  
  // Remove line item
  const removeLineItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };
  
  // Update invoice data from SmartReviewModal
  const handleUpdateInvoice = (updatedData: InvoiceData) => {
    // Update items from the invoice data
    const newItems: LineItem[] = updatedData.items.map(item => ({
      id: generateId(),
      designation_fr: item.designation_fr,
      designation_ar: item.designation_ar,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.total,
    }));
    setItems(newItems);
  };

  return (
    <div className="space-y-6">
      {/* Company Info (Auto-filled) */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="p-4">
          <div className={cn(
            "flex items-center gap-2 mb-3",
            isRTL && "flex-row-reverse"
          )}>
            <Building2 className="h-5 w-5 text-green-600" />
            <h3 className={cn(
              "font-bold text-green-700 dark:text-green-400",
              isRTL && "font-cairo"
            )}>
              {isRTL ? '✅ بياناتك (محفوظة تلقائياً)' : '✅ Vos informations (pré-remplies)'}
            </h3>
          </div>
          
          <div className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm",
            isRTL && "text-right"
          )}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{isRTL ? 'الشركة:' : 'Entreprise:'}</span>
              <span className="font-medium">{profile?.company_name || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">SIRET:</span>
              <span className="font-medium font-mono">{profile?.siret || '—'}</span>
            </div>
            <div className="flex items-center gap-2 col-span-full">
              <span className="text-muted-foreground">{isRTL ? 'العنوان:' : 'Adresse:'}</span>
              <span className="font-medium">{profile?.company_address || '—'}</span>
            </div>
            {profile?.legal_status && (
              <div className="flex items-center gap-2 col-span-full">
                <span className="text-muted-foreground">{isRTL ? 'الوضع القانوني:' : 'Statut:'}</span>
                <span className={cn(
                  "font-medium px-2 py-0.5 rounded text-xs",
                  profile.legal_status === 'auto-entrepreneur' 
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-primary/10 text-primary'
                )}>
                  {profile.legal_status === 'auto-entrepreneur' 
                    ? 'Auto-entrepreneur (معفى من TVA)'
                    : 'Société (خاضع لـ TVA)'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Client Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse"
          )}>
            <User className="h-5 w-5 text-primary" />
            <h3 className={cn(
              "font-bold",
              isRTL && "font-cairo"
            )}>
              {isRTL ? '👤 بيانات العميل' : '👤 Informations client'}
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'اسم العميل' : 'Nom du client'} *
              </Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={isRTL ? 'مثال: السيد محمد أحمد' : 'Ex: M. Jean Dupont'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
            
            <div className="space-y-2">
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'عنوان الفاتورة' : 'Adresse de facturation'} *
              </Label>
              <Input
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder={isRTL ? '12 شارع باريس، 75001 باريس' : '12 rue de Paris, 75001 Paris'}
                className={cn(isRTL && "text-right font-cairo")}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Work Site Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse"
          )}>
            <HardHat className="h-5 w-5 text-orange-500" />
            <h3 className={cn(
              "font-bold",
              isRTL && "font-cairo"
            )}>
              {isRTL ? '📍 عنوان الشانتي' : '📍 Adresse du Chantier'}
            </h3>
          </div>
          
          <div className={cn(
            "flex items-center gap-3",
            isRTL && "flex-row-reverse"
          )}>
            <Checkbox
              id="same-address"
              checked={workSiteSameAsClient}
              onCheckedChange={(checked) => setWorkSiteSameAsClient(checked === true)}
            />
            <Label 
              htmlFor="same-address" 
              className={cn(
                "cursor-pointer text-sm",
                isRTL && "font-cairo"
              )}
            >
              {isRTL 
                ? 'عنوان الشانتي نفس عنوان العميل'
                : "L'adresse du chantier est identique à l'adresse du client"}
            </Label>
          </div>
          
          {!workSiteSameAsClient && (
            <div className="space-y-2 pt-2">
              <Label className={cn(isRTL && "font-cairo text-right block")}>
                {isRTL ? 'عنوان الشانتي / مكان الركن' : 'Adresse du Chantier / Stationnement'}
              </Label>
              <Input
                value={workSiteAddress}
                onChange={(e) => setWorkSiteAddress(e.target.value)}
                placeholder={isRTL ? '45 شارع ليون، 69001 ليون' : '45 avenue de Lyon, 69001 Lyon'}
                className={cn(isRTL && "text-right font-cairo")}
              />
              <p className={cn(
                "text-xs text-muted-foreground",
                isRTL && "font-cairo text-right"
              )}>
                {isRTL 
                  ? '⚠️ ده العنوان اللي الشاحنة هتركن فيه - مهم لحساب مصاريف الركن!'
                  : '⚠️ C\'est l\'adresse où le véhicule sera garé - important pour les frais de stationnement!'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* AI Quote Wizard Button */}
      <Button
        variant="outline"
        size="lg"
        onClick={() => setShowWizard(true)}
        className={cn(
          "w-full border-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary",
          "flex items-center justify-center gap-3 py-6",
          isRTL && "flex-row-reverse font-cairo"
        )}
      >
        <Wand2 className="h-6 w-6 text-primary" />
        <div className={cn("text-center", isRTL && "font-cairo")}>
          <div className="font-bold text-primary">
            {isRTL ? '🧙‍♂️ مساعد الديفي الذكي' : '🧙‍♂️ Assistant Devis Intelligent'}
          </div>
          <div className="text-xs text-muted-foreground">
            {isRTL ? 'ساعدني أحسب السعر!' : 'Aidez-moi à chiffrer!'}
          </div>
        </div>
      </Button>
      
      {/* Line Items Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className={cn(
            "flex items-center justify-between",
            isRTL && "flex-row-reverse"
          )}>
            <div className={cn(
              "flex items-center gap-2",
              isRTL && "flex-row-reverse"
            )}>
              <FileText className="h-5 w-5 text-primary" />
              <h3 className={cn(
                "font-bold",
                isRTL && "font-cairo"
              )}>
                {isRTL ? '📋 البنود والأسعار' : '📋 Lignes de prestation'}
              </h3>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className={cn(isRTL && "font-cairo")}
            >
              <Plus className="h-4 w-4 mr-1" />
              {isRTL ? 'سطر جديد' : 'Ajouter'}
            </Button>
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div 
                key={item.id}
                className="p-3 border rounded-lg bg-muted/30 space-y-3"
              >
                <div className={cn(
                  "flex items-center justify-between",
                  isRTL && "flex-row-reverse"
                )}>
                  <span className="text-xs text-muted-foreground font-mono">
                    #{index + 1}
                  </span>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {isRTL ? 'الوصف بالفرنسية' : 'Désignation (FR)'}
                    </Label>
                    <Input
                      value={item.designation_fr}
                      onChange={(e) => handleItemChange(item.id, 'designation_fr', e.target.value)}
                      placeholder="Peinture mur salon"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs", isRTL && "font-cairo")}>
                      {isRTL ? 'الوصف بالعربي (اختياري)' : 'Désignation (AR)'}
                    </Label>
                    <Input
                      value={item.designation_ar}
                      onChange={(e) => handleItemChange(item.id, 'designation_ar', e.target.value)}
                      placeholder="دهان حيطة الصالون"
                      className={cn("text-sm", isRTL && "text-right font-cairo")}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRTL ? 'الكمية' : 'Qté'}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRTL ? 'الوحدة' : 'Unité'}</Label>
                    <Input
                      value={item.unit}
                      onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                      placeholder="m², h, u"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRTL ? 'السعر (€)' : 'P.U. (€)'}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1.5 hidden sm:block">
                    <Label className="text-xs">{isRTL ? 'المجموع' : 'Total'}</Label>
                    <div className="h-10 flex items-center px-3 bg-primary/5 border rounded-md font-mono text-sm font-medium">
                      {item.total.toFixed(2)} €
                    </div>
                  </div>
                </div>
                
                {/* Mobile total */}
                <div className="sm:hidden flex justify-end">
                  <span className="text-sm font-medium font-mono bg-primary/10 px-3 py-1 rounded">
                    = {item.total.toFixed(2)} €
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Travel Costs Section */}
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardContent className="p-4 space-y-4">
              <div className={cn(
                "flex items-center justify-between",
                isRTL && "flex-row-reverse"
              )}>
                <div className={cn(
                  "flex items-center gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <Truck className="h-5 w-5 text-orange-600" />
                  <h4 className={cn(
                    "font-bold text-orange-700 dark:text-orange-400",
                    isRTL && "font-cairo"
                  )}>
                    {isRTL ? '🚚 مصاريف النقل' : '🚚 Frais de déplacement'}
                  </h4>
                </div>
                
                <div className={cn(
                  "flex items-center gap-2",
                  isRTL && "flex-row-reverse"
                )}>
                  <Label 
                    htmlFor="travel-toggle" 
                    className={cn("text-sm", isRTL && "font-cairo")}
                  >
                    {isRTL ? 'إضافة؟' : 'Ajouter?'}
                  </Label>
                  <Switch
                    id="travel-toggle"
                    checked={includeTravelCosts}
                    onCheckedChange={setIncludeTravelCosts}
                  />
                </div>
              </div>
              
              {includeTravelCosts && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs", isRTL && "font-cairo")}>
                      {isRTL ? 'الوصف' : 'Description'}
                    </Label>
                    <Input
                      value={travelDescription}
                      onChange={(e) => setTravelDescription(e.target.value)}
                      placeholder={isRTL ? 'مثال: Paris A/R' : 'Ex: Paris A/R'}
                      className={cn("text-sm", isRTL && "text-right font-cairo")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {isRTL ? 'المبلغ (€)' : 'Montant (€)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={travelPrice}
                      onChange={(e) => setTravelPrice(parseFloat(e.target.value) || 0)}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Totals Summary */}
          <div className="pt-4 border-t space-y-2">
            <div className={cn(
              "flex justify-between text-sm",
              isRTL && "flex-row-reverse"
            )}>
              <span className="text-muted-foreground">{isRTL ? 'المجموع الفرعي:' : 'Sous-total HT:'}</span>
              <span className="font-mono font-medium">{invoiceData.subtotal.toFixed(2)} €</span>
            </div>
            
            {!invoiceData.tvaExempt && (
              <div className={cn(
                "flex justify-between text-sm",
                isRTL && "flex-row-reverse"
              )}>
                <span className="text-muted-foreground">TVA ({invoiceData.tvaRate}%):</span>
                <span className="font-mono font-medium">{invoiceData.tvaAmount.toFixed(2)} €</span>
              </div>
            )}
            
            <div className={cn(
              "flex justify-between text-lg font-bold pt-2 border-t",
              isRTL && "flex-row-reverse"
            )}>
              <span>{isRTL ? 'المجموع الكلي:' : 'Total TTC:'}</span>
              <span className="font-mono text-primary">{invoiceData.total.toFixed(2)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Preview & Actions */}
      {showPreview ? (
        <div className="space-y-4">
          <div className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse"
          )}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(false)}
              className={cn(isRTL && "font-cairo")}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              {isRTL ? 'تعديل النموذج' : 'Modifier le formulaire'}
            </Button>
          </div>
          
          <InvoiceActions
            invoiceData={invoiceData}
            invoiceRef={invoiceRef}
            showArabic={showArabic}
            onToggleArabic={setShowArabic}
            onUpdateInvoice={handleUpdateInvoice}
          />
          
          <div ref={invoiceRef}>
            <InvoiceDisplay 
              data={invoiceData} 
              showArabic={showArabic} 
            />
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex gap-3",
          isRTL && "flex-row-reverse"
        )}>
          <Button
            variant="outline"
            onClick={onBack}
            className={cn(isRTL && "font-cairo")}
          >
            {isRTL ? 'رجوع' : 'Retour'}
          </Button>
          
          <Button
            onClick={() => setShowPreview(true)}
            disabled={!isFormValid}
            className={cn("flex-1", isRTL && "font-cairo")}
          >
            <FileText className="h-4 w-4 mr-2" />
            {isRTL ? 'معاينة وتحميل PDF' : 'Aperçu et Télécharger PDF'}
          </Button>
        </div>
      )}
      
      {/* Quote Wizard Modal */}
      <QuoteWizardModal
        open={showWizard}
        onOpenChange={setShowWizard}
        onGenerate={handleWizardGenerate}
      />
    </div>
  );
};

export default InvoiceFormBuilder;
