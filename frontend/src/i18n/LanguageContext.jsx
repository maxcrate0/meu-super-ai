import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, detectLanguage, getTranslation } from './translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    // Primeiro verifica se há preferência salva
    const saved = localStorage.getItem('language');
    if (saved && translations[saved]) {
      return saved;
    }
    // Senão, detecta do navegador
    return detectLanguage();
  });

  // Função helper para obter traduções
  const t = (path) => getTranslation(lang, path);

  // Salva preferência quando muda
  const changeLang = (newLang) => {
    if (translations[newLang]) {
      setLang(newLang);
      localStorage.setItem('language', newLang);
    }
  };

  // Retorna as traduções completas do idioma atual
  const texts = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t, texts }}>
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

export default LanguageContext;
