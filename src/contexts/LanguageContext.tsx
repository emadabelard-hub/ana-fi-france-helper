import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'fr' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Navigation
    'nav.dashboard': 'Accueil',
    'nav.radio': 'Radio',
    'nav.assistant': 'Consultations',
    'nav.profile': 'Mon Profil',
    
    // Dashboard
    'dashboard.welcome': 'Bienvenue sur Ana Fi France',
    'dashboard.subtitle': 'Votre assistant administratif intelligent',
    'dashboard.quickAccess': 'Accès Rapide',
    'dashboard.radioCard': 'Radio Égyptienne',
    'dashboard.radioDesc': 'Écoutez vos stations préférées',
    'dashboard.assistantCard': 'Assistant IA',
    'dashboard.assistantDesc': 'Rédigez vos courriers administratifs',
    
    // Radio
    'radio.title': 'Radio',
    'radio.nowPlaying': 'En cours de lecture',
    'radio.selectStation': 'Sélectionnez une station',
    'radio.searchPlaceholder': 'Rechercher une station...',
    'radio.categoryEgypt': 'Radios Égyptiennes (Musique & News)',
    'radio.categoryMaghreb': 'Radios Maghreb & France',
    'radio.noResults': 'Aucune station trouvée',
    
    // Assistant
    'assistant.title': 'Consultations',
    'assistant.subtitle': 'Décrivez votre situation et recevez une lettre professionnelle',
    'assistant.textPlaceholder': 'Décrivez votre situation en détail (en français ou en arabe)...',
    'assistant.recordVoice': 'Enregistrer',
    'assistant.uploadDocument': 'Télécharger un document',
    'assistant.analyze': 'Analyser',
    'assistant.formalLetter': 'Lettre Officielle',
    'assistant.legalNote': 'Note Juridique',
    'assistant.actionPlan': 'Plan d\'Action',
    'assistant.copy': 'Copier',
    'assistant.download': 'Télécharger PDF',
    
    // Profile
    'profile.title': 'Mon Profil',
    'profile.fullName': 'Nom Complet',
    'profile.address': 'Adresse',
    'profile.phone': 'Téléphone',
    'profile.cafNumber': 'Numéro CAF',
    'profile.foreignerNumber': 'Numéro Étranger',
    'profile.socialSecurity': 'N° Sécu (Carte Vitale)',
    'profile.save': 'Enregistrer',
    'profile.optional': '(optionnel)',
    
    // Common
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.success': 'Succès',
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
  },
  ar: {
    // Navigation
    'nav.dashboard': 'الرئيسية',
    'nav.radio': 'الراديو',
    'nav.assistant': 'استشارات',
    'nav.profile': 'بياناتي',
    
    // Dashboard
    'dashboard.welcome': 'أهلاً بيك في أنا في فرنسا',
    'dashboard.subtitle': 'مساعدك الشخصي لكل حاجة إدارية',
    'dashboard.quickAccess': 'دخول سريع',
    'dashboard.radioCard': 'الراديو المصري',
    'dashboard.radioDesc': 'اسمع محطاتك المفضلة',
    'dashboard.assistantCard': 'المساعد الذكي',
    'dashboard.assistantDesc': 'هاعملك خطاباتك الرسمية',
    
    // Radio
    'radio.title': 'الراديو',
    'radio.nowPlaying': 'بيشتغل دلوقتي',
    'radio.selectStation': 'اختار محطة',
    'radio.searchPlaceholder': 'دور على محطة...',
    'radio.categoryEgypt': 'إذاعات مصرية (موسيقى وأخبار)',
    'radio.categoryMaghreb': 'إذاعات المغرب وفرنسا',
    'radio.noResults': 'مافيش نتايج',
    
    // Assistant - Consultations
    'assistant.title': 'استشارات',
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
    
    // Profile
    'profile.title': 'بياناتي',
    'profile.fullName': 'الاسم الكامل',
    'profile.address': 'العنوان',
    'profile.phone': 'التليفون',
    'profile.cafNumber': 'رقم الـ CAF',
    'profile.foreignerNumber': 'رقم الأجانب',
    'profile.socialSecurity': 'رقم السيكو (Sécu)',
    'profile.save': 'احفظ',
    'profile.optional': '(اختياري)',
    
    // Common
    'common.loading': 'استنى شوية...',
    'common.error': 'حصل مشكلة',
    'common.success': 'تمام',
    'common.cancel': 'إلغاء',
    'common.confirm': 'تأكيد',
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
