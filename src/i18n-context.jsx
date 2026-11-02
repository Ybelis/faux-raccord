import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { localeTag, readLanguage, saveLanguage, translate } from './i18n.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, updateLanguage] = useState(readLanguage);
  const value = useMemo(
    () => ({
      language,
      setLanguage: (next) => updateLanguage(saveLanguage(next)),
      t: (source, values) => translate(source, language, values),
      number: (value, options = {}) =>
        typeof value === 'number' ? value.toLocaleString(localeTag(language), options) : value,
      date: (value, options = {}) => new Date(value).toLocaleString(localeTag(language), options),
    }),
    [language],
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === 'en'
        ? 'Faux Raccord — Script continuity'
        : 'Faux Raccord — Continuité du scénario';
  }, [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required.');
  return context;
}
