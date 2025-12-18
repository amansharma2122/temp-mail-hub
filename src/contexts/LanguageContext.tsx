import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, languages } from '@/i18n/translations';
import { storage, STORAGE_KEYS } from '@/lib/storage';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
  languages: typeof languages;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return storage.get(STORAGE_KEYS.LANGUAGE, 'en') as Language;
  });

  const isRTL = languages.find(l => l.code === language)?.rtl || false;

  useEffect(() => {
    // Update document direction
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRTL]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    storage.set(STORAGE_KEYS.LANGUAGE, lang);
  };

  const t = (key: string): string => {
    const langTranslations = translations[language] || translations.en;
    return (langTranslations as any)[key] || (translations.en as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL, languages }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
