import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'fr' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

/**
 * PROTECTED TRANSLATIONS DICTIONARY
 * 
 * ⚠️ RÈGLES STRICTES:
 * 1. FRANÇAIS: Professionnel, précis, jargon administratif français
 * 2. ARABE: Mélange de Darija et arabe clair - PAS de traduction mot-à-mot
 * 3. TERMES PROTÉGÉS (ne JAMAIS modifier):
 *    - عرض سعر (دوفي)
 *    - فاتورة (فاكتير)
 *    - عشان ما تتلخبطش حول الدوفي لفاكتير
 */
const translations: Record<Language, Record<string, string>> = {
  fr: {
    // ===== NAVIGATION =====
    'nav.dashboard': 'Accueil',
    'nav.radio': 'Radio',
    'nav.assistant': 'Conseils',
    'nav.profile': 'Mon Profil',
    'nav.pro': 'Outils',
    'nav.admin': 'Admin',

    // ===== HEADER =====
    'header.appName': 'Ana Fi France',
    'header.consultations': 'Consultations',
    'header.proTools': 'Outils Pro',
    
    // ===== DASHBOARD =====
    'dashboard.welcome': 'Bienvenue sur Ana Fi France',
    'dashboard.subtitle': 'Votre assistant administratif intelligent',
    'dashboard.quickAccess': 'Accès Rapide',
    'dashboard.radioCard': 'Radio Égyptienne',
    'dashboard.radioDesc': 'Écoutez vos stations préférées',
    'dashboard.assistantCard': 'Assistant IA',
    'dashboard.assistantDesc': 'Rédigez vos courriers administratifs',
    'dashboard.aiBanner': 'Posez-moi vos questions',
    'dashboard.aiBannerSub': 'En français et en arabe',
    'dashboard.cvCard': 'Mon CV Pro',
    'dashboard.cvCardSub': 'Mon CV Pro',
    'dashboard.invoiceCard': 'Factures & Devis',
    'dashboard.invoiceCardSub': 'Factures',
    'dashboard.codeRoute': 'Code de la Route',
    'dashboard.codeRouteSub': 'Cours et tests en français',
    
    // ===== CHAT QUICK ACTIONS =====
    'chat.action.cv': 'Faire un CV',
    'chat.action.invoice': 'Faire une Facture',
    'chat.action.mail': 'Répondre Courrier',
    'chat.title': 'Assistant Admin',
    'chat.subtitle': 'Posez vos questions',
    'chat.placeholder': 'Écrivez votre message...',
    'chat.thinking': 'Réflexion...',
    'chat.welcomeTitle': 'Bonjour ! Je suis votre assistant intelligent',
    'chat.welcomeMessage': 'Décrivez votre situation ou téléchargez un document.',
    
    // ===== RADIO =====
    'radio.title': 'Radio',
    'radio.nowPlaying': 'En cours de lecture',
    'radio.selectStation': 'Sélectionnez une station',
    'radio.searchPlaceholder': 'Rechercher une station...',
    'radio.categoryEgypt': 'Radios Égyptiennes (Musique & News)',
    'radio.categoryMaghreb': 'Radios Maghreb & France',
    'radio.noResults': 'Aucune station trouvée',
    
    // ===== ASSISTANT / CONSULTATIONS =====
    'assistant.title': 'Discussion',
    'assistant.subtitle': 'Décrivez votre situation et recevez une lettre professionnelle',
    'assistant.textPlaceholder': 'Décrivez votre situation en détail...',
    'assistant.recordVoice': 'Enregistrer',
    'assistant.uploadDocument': 'Télécharger un document',
    'assistant.analyze': 'Analyser',
    'assistant.formalLetter': 'Lettre Officielle',
    'assistant.legalNote': 'Note Juridique',
    'assistant.actionPlan': 'Plan d\'Action',
    'assistant.copy': 'Copier',
    'assistant.download': 'Télécharger PDF',
    'assistant.newTopic': 'Nouveau sujet',
    'assistant.continueSession': 'Reprendre',
    'assistant.startNew': 'Nouveau sujet',
    'assistant.sessionDialog.title': 'Conversation précédente',
    'assistant.sessionDialog.description': 'Voulez-vous reprendre votre conversation précédente ou commencer un nouveau sujet ?',
    'assistant.clearConfirm.title': 'Effacer la conversation ?',
    'assistant.clearConfirm.description': 'Cette action effacera tout l\'historique de la conversation.',
    'assistant.dailyLimit': 'Limite quotidienne atteinte',
    'assistant.dailyLimitDesc': 'Limite quotidienne atteinte (30 messages). À demain !',
    'assistant.analyzing': 'Analyse en cours...',
    'assistant.documentReady': 'Document prêt',
    'assistant.viewDocument': 'Voir le document',
    'assistant.generateLetter': 'Générer une lettre',
    'assistant.generating': 'Génération...',
    
    // ===== PROFILE =====
    'profile.title': 'Mon Profil',
    'profile.fullName': 'Nom Complet',
    'profile.firstName': 'Prénom',
    'profile.lastName': 'Nom',
    'profile.address': 'Adresse',
    'profile.phone': 'Téléphone',
    'profile.cafNumber': 'Numéro CAF',
    'profile.foreignerNumber': 'Numéro Étranger',
    'profile.socialSecurity': 'N° Sécurité Sociale (Carte Vitale)',
    'profile.save': 'Enregistrer',
    'profile.optional': '(optionnel)',
    'profile.saved': 'Profil enregistré',
    'profile.savedDesc': 'Vos informations ont été sauvegardées.',
    
    // ===== PRO TOOLS =====
    'pro.title': 'Votre Bras Droit',
    'pro.subtitle': 'Outils pour artisans et indépendants',
    'pro.invoices': 'Devis & Factures',
    'pro.invoicesDesc': 'Créez vos devis et factures facilement',
    'pro.quoteToInvoice': 'Devis → Facture',
    'pro.quoteToInvoiceDesc': 'L\'IA remplit votre facture automatiquement',
    'pro.legal': 'Guide Juridique',
    'pro.legalDesc': 'Comprendre le droit du travail et les impôts',
    'pro.cvGenerator': 'Générateur de CV',
    'pro.cvGeneratorDesc': 'Écrivez en arabe, l\'IA traduit en français',
    'pro.settings': 'Mon identité pro',
    'pro.settingsDesc': 'Infos entreprise et logo',
    'pro.toolsNotice': 'Outils dédiés aux artisans en France',
    
    // ===== INVOICE CREATOR =====
    'invoice.quote': 'Devis',
    'invoice.invoice': 'Facture',
    'invoice.client': 'Client',
    'invoice.clientName': 'Nom du client',
    'invoice.clientAddress': 'Adresse du client',
    'invoice.worksite': 'Adresse du chantier',
    'invoice.description': 'Description',
    'invoice.quantity': 'Quantité',
    'invoice.unit': 'Unité',
    'invoice.unitPrice': 'Prix unitaire',
    'invoice.total': 'Total',
    'invoice.subtotal': 'Sous-total HT',
    'invoice.tva': 'TVA',
    'invoice.totalTTC': 'Total TTC',
    'invoice.addLine': 'Ajouter une ligne',
    'invoice.preview': 'Aperçu & Télécharger PDF',
    'invoice.signature': 'Signature',
    'invoice.clientSignature': 'Signature du client',
    'invoice.artisanSignature': 'Signature du prestataire',
    'invoice.bonPourAccord': 'Bon pour accord',
    'invoice.validUntil': 'Devis valable jusqu\'au',
    'invoice.paymentTerms': 'Conditions de paiement',
    
    // ===== CV GENERATOR =====
    'cv.title': 'Mon CV',
    'cv.subtitle': 'Rédigez en arabe, l\'IA traduit en français professionnel',
    'cv.personalInfo': 'Informations personnelles',
    'cv.fullName': 'Nom complet',
    'cv.firstName': 'Prénom',
    'cv.lastName': 'Nom',
    'cv.profession': 'Métier / Poste souhaité',
    'cv.email': 'Email',
    'cv.phone': 'Téléphone',
    'cv.address': 'Adresse',
    'cv.summary': 'Résumé professionnel',
    'cv.experience': 'Expérience professionnelle',
    'cv.education': 'Formation',
    'cv.skills': 'Compétences',
    'cv.languages': 'Langues',
    'cv.translate': 'Traduire en français',
    'cv.translating': 'Traduction en cours...',
    'cv.downloadPdf': 'Télécharger PDF',
    'cv.preview': 'Aperçu',
    'cv.edit': 'Éditer',
    'cv.drivingLicense': 'Permis de conduire',
    'cv.interests': 'Centres d\'intérêt',
    
    // ===== COMMON =====
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
    'common.save': 'Enregistrer',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.close': 'Fermer',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.previous': 'Précédent',
    'common.yes': 'Oui',
    'common.no': 'Non',
    'common.or': 'ou',
    'common.and': 'et',
    'common.send': 'Envoyer',
    
    // ===== ERRORS =====
    'error.network': 'Erreur de connexion. Veuillez réessayer.',
    'error.timeout': 'La requête a pris trop de temps. Veuillez réessayer.',
    'error.generic': 'Une erreur est survenue. Veuillez réessayer.',
    'error.invalidAlphabet': 'Caractères non autorisés détectés. Utilisez uniquement le français ou l\'arabe.',
    
    // ===== AUTH =====
    'auth.login': 'Se connecter',
    'auth.signup': 'S\'inscrire',
    'auth.logout': 'Se déconnecter',
    'auth.email': 'Email',
    'auth.password': 'Mot de passe',
    'auth.forgotPassword': 'Mot de passe oublié ?',
  },
  ar: {
    // ===== NAVIGATION =====
    'nav.dashboard': 'الرئيسية',
    'nav.radio': 'الراديو',
    'nav.assistant': 'استشارات',
    'nav.profile': 'حسابي',
    'nav.pro': 'أدوات',
    'nav.admin': 'الإدارة',

    // ===== HEADER =====
    'header.appName': 'أنا في فرنسا',
    'header.consultations': 'استشارات',
    'header.proTools': 'دراعك اليمين',
    
    // ===== DASHBOARD =====
    'dashboard.welcome': 'أهلاً بيك في أنا في فرنسا',
    'dashboard.subtitle': 'مساعدك الشخصي لكل حاجة إدارية',
    'dashboard.quickAccess': 'دخول سريع',
    'dashboard.radioCard': 'الراديو المصري',
    'dashboard.radioDesc': 'اسمع محطاتك المفضلة',
    'dashboard.assistantCard': 'المساعد الذكي',
    'dashboard.assistantDesc': 'هاعملك خطاباتك الرسمية',
    'dashboard.aiBanner': 'اسأل وأنا أجاوبك',
    'dashboard.aiBannerSub': 'بالعربي والفرنساوي',
    'dashboard.cvCard': 'سيرتي الذكية (سي في)',
    'dashboard.cvCardSub': 'Mon CV Pro',
    'dashboard.invoiceCard': 'فواتير ودوفي',
    'dashboard.invoiceCardSub': 'Factures',
    'dashboard.codeRoute': 'كود دو لاروت',
    'dashboard.codeRouteSub': 'دروس وامتحانات بالمصري',
    
    // ===== CHAT QUICK ACTIONS =====
    'chat.action.cv': '👤 عايز تعمل سي في',
    'chat.action.invoice': '📄 عايز تكتب فاتورة',
    'chat.action.mail': '✉️ الرد على خطاب',
    'chat.title': 'شبيك لبيك 🧞‍♂️',
    'chat.subtitle': 'اسأل وانا اجاوب',
    'chat.placeholder': 'اكتب رسالتك...',
    'chat.thinking': 'يفكر...',
    'chat.welcomeTitle': 'أهلا! أنا مساعدك الذكي 🧞‍♂️',
    'chat.welcomeMessage': 'اكتب سؤالك أو ارفع صورة مستند وأنا هساعدك.',
    
    // ===== RADIO =====
    'radio.title': 'الراديو',
    'radio.nowPlaying': 'بيشتغل دلوقتي',
    'radio.selectStation': 'اختار محطة',
    'radio.searchPlaceholder': 'دور على محطة...',
    'radio.categoryEgypt': 'إذاعات مصرية (موسيقى وأخبار)',
    'radio.categoryMaghreb': 'إذاعات المغرب وفرنسا',
    'radio.noResults': 'مافيش نتايج',
    
    // ===== ASSISTANT / CONSULTATIONS =====
    'assistant.title': 'محادثة',
    'assistant.subtitle': 'احكيلي موضوعك وأنا هاساعدك',
    'assistant.textPlaceholder': 'احكيلي إيه المشكلة... (بالعربي أو بالفرنساوي)',
    'assistant.recordVoice': 'سجّل صوتك',
    'assistant.uploadDocument': 'ارفع صورة أو PDF',
    'assistant.analyze': 'حلل',
    'assistant.formalLetter': 'الخطاب الرسمي',
    'assistant.legalNote': 'ملاحظات قانونية',
    'assistant.actionPlan': 'خطة العمل',
    'assistant.copy': 'نسخ',
    'assistant.download': 'حمّل PDF',
    'assistant.newTopic': 'موضوع جديد',
    'assistant.continueSession': 'نكمل',
    'assistant.startNew': 'موضوع جديد',
    'assistant.sessionDialog.title': 'في محادثة قديمة',
    'assistant.sessionDialog.description': 'نكمل الكلام في الموضوع القديم؟',
    'assistant.clearConfirm.title': 'امسح المحادثة؟',
    'assistant.clearConfirm.description': 'كده هتمسح كل الكلام اللي فات.',
    'assistant.dailyLimit': 'الحد اليومي',
    'assistant.dailyLimitDesc': 'وصلت للحد اليومي (30 رسالة). ارجع بكره!',
    'assistant.analyzing': 'بحلل...',
    'assistant.documentReady': 'الخطاب جاهز',
    'assistant.viewDocument': 'شوف الخطاب',
    'assistant.generateLetter': 'اكتبلي خطاب',
    'assistant.generating': 'بكتب...',
    
    // ===== PROFILE =====
    'profile.title': 'بياناتي',
    'profile.fullName': 'الاسم الكامل',
    'profile.firstName': 'الاسم الأول',
    'profile.lastName': 'اللقب',
    'profile.address': 'العنوان',
    'profile.phone': 'التليفون',
    'profile.cafNumber': 'رقم الـ CAF',
    'profile.foreignerNumber': 'رقم الأجانب',
    'profile.socialSecurity': 'رقم السيكوريتيه (Sécu)',
    'profile.save': 'احفظ',
    'profile.optional': '(اختياري)',
    'profile.saved': 'تم الحفظ',
    'profile.savedDesc': 'بياناتك اتحفظت.',
    
    // ===== PRO TOOLS =====
    // ⚠️ TERMES PROTÉGÉS - NE PAS MODIFIER
    'pro.title': 'دراعك اليمين 💪',
    'pro.subtitle': 'كل اللي يحتاجه الصنايعي والحرفي في فرنسا',
    'pro.invoices': 'فواتير ودوفيهات',
    'pro.invoicesDesc': 'اعمل الفاكتير والدوفي بتوعك بسهولة',
    'pro.quoteToInvoice': 'حوّل الدوفي لفاكتير',
    'pro.quoteToInvoiceDesc': 'ارفع الدوفي وأنا أملّي الفاكتير تلقائي!',
    'pro.legal': 'قوانين الشغل والضرايب',
    'pro.legalDesc': 'اعرف حقوقك وواجباتك',
    'pro.cvGenerator': 'مُولّد CV Pro',
    'pro.cvGeneratorDesc': 'اكتب بالعربي والذكاء الاصطناعي يترجم للفرنسية',
    'pro.settings': 'بيانات شركتي',
    'pro.settingsDesc': 'الاسم واللوجو والـ SIRET',
    'pro.toolsNotice': 'أدوات مخصصة للصنايعية والحرفيين في فرنسا',
    
    // ===== INVOICE CREATOR =====
    // ⚠️ TERMES PROTÉGÉS
    'invoice.quote': 'عرض سعر (دوفي)',
    'invoice.invoice': 'فاتورة (فاكتير)',
    'invoice.client': 'الزبون',
    'invoice.clientName': 'اسم الزبون',
    'invoice.clientAddress': 'عنوان الزبون',
    'invoice.worksite': 'عنوان الشانتييه',
    'invoice.description': 'الوصف',
    'invoice.quantity': 'الكمية',
    'invoice.unit': 'الوحدة',
    'invoice.unitPrice': 'سعر الوحدة',
    'invoice.total': 'المجموع',
    'invoice.subtotal': 'المجموع قبل الضريبة',
    'invoice.tva': 'TVA',
    'invoice.totalTTC': 'المجموع الكلي TTC',
    'invoice.addLine': 'أضف سطر',
    'invoice.preview': 'معاينة وتحميل PDF',
    'invoice.signature': 'التوقيع',
    'invoice.clientSignature': 'توقيع الزبون',
    'invoice.artisanSignature': 'توقيع الحرفي',
    'invoice.bonPourAccord': 'موافق على العرض',
    'invoice.validUntil': 'الدوفي صالح لغاية',
    'invoice.paymentTerms': 'شروط الدفع',
    
    // ===== CV GENERATOR =====
    'cv.title': 'سيرتي الذاتية',
    'cv.subtitle': 'اكتب بالعربي والذكاء الاصطناعي يترجم للفرنسية',
    'cv.personalInfo': 'البيانات الشخصية',
    'cv.fullName': 'الاسم الكامل',
    'cv.firstName': 'الاسم الأول',
    'cv.lastName': 'اللقب',
    'cv.profession': 'المهنة / الوظيفة المطلوبة',
    'cv.email': 'الإيميل',
    'cv.phone': 'التليفون',
    'cv.address': 'العنوان',
    'cv.summary': 'ملخص مهني',
    'cv.experience': 'الخبرة المهنية',
    'cv.education': 'التعليم',
    'cv.skills': 'المهارات',
    'cv.languages': 'اللغات',
    'cv.translate': 'ترجم للفرنسية',
    'cv.translating': 'بترجم...',
    'cv.downloadPdf': 'حمّل PDF',
    'cv.preview': 'معاينة',
    'cv.edit': 'تعديل',
    'cv.drivingLicense': 'رخصة القيادة',
    'cv.interests': 'الهوايات',
    
    // ===== COMMON =====
    'common.loading': 'استنى شوية...',
    'common.error': 'حصل مشكلة',
    'common.success': 'تمام',
    'common.cancel': 'إلغاء',
    'common.confirm': 'تأكيد',
    'common.save': 'احفظ',
    'common.delete': 'امسح',
    'common.edit': 'عدّل',
    'common.close': 'اقفل',
    'common.back': 'رجوع',
    'common.next': 'التالي',
    'common.previous': 'السابق',
    'common.yes': 'أيوه',
    'common.no': 'لأ',
    'common.or': 'أو',
    'common.and': 'و',
    'common.send': 'ارسل',
    
    // ===== ERRORS =====
    'error.network': 'مشكلة في الاتصال. جرب تاني.',
    'error.timeout': 'الطلب أخد وقت طويل. جرب تاني.',
    'error.generic': 'حصل مشكلة. جرب تاني.',
    'error.invalidAlphabet': 'في حروف مش مسموحة. استخدم عربي أو فرنسي بس.',
    
    // ===== AUTH =====
    'auth.login': 'دخول',
    'auth.signup': 'تسجيل',
    'auth.logout': 'خروج',
    'auth.email': 'الإيميل',
    'auth.password': 'الباسورد',
    'auth.forgotPassword': 'نسيت الباسورد؟',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('ana-fi-france-lang');
    return (saved as Language) || 'fr';
  });

  const isRTL = language === 'ar';

  useEffect(() => {
    localStorage.setItem('ana-fi-france-lang', language);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRTL]);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
