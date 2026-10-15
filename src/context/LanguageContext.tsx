import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { translations, languages, type Language } from '../locales';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (path: string, defaultValue?: string) => string;
  getMonthName: (monthIndex: number) => string;
  monthNames: string[];
  languages: typeof languages;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'app_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ta' || saved === 'en') return saved;
    } catch {
      // Ignore localStorage read errors
    }
    return 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    } catch {
      // Ignore localStorage write errors
    }
  }, [language]);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'en' ? 'ta' : 'en'));
  }, []);

  // Safe nested property lookup, e.g. "nav.dashboard" -> translations[lang].nav.dashboard
  const t = useCallback(
    (path: string, defaultValue?: string): string => {
      const keys = path.split('.');
      
      // Try active language first
      let current: any = translations[language];
      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          current = undefined;
          break;
        }
      }

      if (typeof current === 'string') return current;

      // Fallback to English
      let fallback: any = translations.en;
      for (const key of keys) {
        if (fallback && typeof fallback === 'object' && key in fallback) {
          fallback = fallback[key];
        } else {
          fallback = undefined;
          break;
        }
      }

      if (typeof fallback === 'string') return fallback;

      return defaultValue || path;
    },
    [language]
  );

  const monthNames: string[] = (translations[language]?.salary?.months || translations.en.salary.months);

  const getMonthName = useCallback(
    (monthIndex: number): string => {
      const list = translations[language]?.salary?.months || translations.en.salary.months;
      if (monthIndex >= 1 && monthIndex <= 12) {
        return list[monthIndex - 1] || '';
      }
      if (monthIndex >= 0 && monthIndex < 12) {
        return list[monthIndex] || '';
      }
      return '';
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, getMonthName, monthNames, languages }}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
