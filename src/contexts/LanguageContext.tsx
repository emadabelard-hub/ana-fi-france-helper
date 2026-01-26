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
    'nav.assistant': 'Assistant',
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
    'assistant.title': 'Assistant Administratif',
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
    'profile.socialSecurity': 'Sécurité Sociale',
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
    'nav.assistant': 'المساعد',
    'nav.profile': 'ملفي الشخصي',
    
    // Dashboard
    'dashboard.welcome': 'مرحباً بك في أنا في فرنسا',
    'dashboard.subtitle': 'مساعدك الإداري الذكي',
    'dashboard.quickAccess': 'وصول سريع',
    'dashboard.radioCard': 'الراديو المصري',
    'dashboard.radioDesc': 'استمع إلى محطاتك المفضلة',
    'dashboard.assistantCard': 'المساعد الذكي',
    'dashboard.assistantDesc': 'اكتب رسائلك الإدارية',
    
    // Radio
    'radio.title': 'الراديو',
    'radio.nowPlaying': 'يتم التشغيل الآن',
    'radio.selectStation': 'اختر محطة',
    'radio.searchPlaceholder': 'ابحث عن محطة...',
    'radio.categoryEgypt': 'إذاعات مصرية (موسيقى وأخبار)',
    'radio.categoryMaghreb': 'إذاعات المغرب وفرنسا',
    'radio.noResults': 'لم يتم العثور على محطة',
    
    // Assistant
    'assistant.title': 'المساعد الإداري',
    'assistant.subtitle': 'صف وضعك واحصل على رسالة رسمية احترافية',
    'assistant.textPlaceholder': 'صف وضعك بالتفصيل (بالفرنسية أو بالعربية)...',
    'assistant.recordVoice': 'تسجيل',
    'assistant.uploadDocument': 'رفع مستند',
    'assistant.analyze': 'تحليل',
    'assistant.formalLetter': 'الرسالة الرسمية',
    'assistant.legalNote': 'الملاحظة القانونية',
    'assistant.actionPlan': 'خطة العمل',
    'assistant.copy': 'نسخ',
    'assistant.download': 'تحميل PDF',
    
    // Profile
    'profile.title': 'ملفي الشخصي',
    'profile.fullName': 'الاسم الكامل',
    'profile.address': 'العنوان',
    'profile.phone': 'الهاتف',
    'profile.cafNumber': 'رقم CAF',
    'profile.foreignerNumber': 'رقم الأجانب',
    'profile.socialSecurity': 'الضمان الاجتماعي',
    'profile.save': 'حفظ',
    'profile.optional': '(اختياري)',
    
    // Common
    'common.loading': 'جار التحميل...',
    'common.error': 'خطأ',
    'common.success': 'نجاح',
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
