
import React, { useState, useRef, useEffect } from 'react';
import { Language } from '../types';
import { ChevronDown } from 'lucide-react';

interface LanguageSwitcherProps {
  currentLang: Language;
  onToggle: (lang: Language) => void;
  isLoginPage?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ currentLang, onToggle, isLoginPage = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (lang: Language) => {
    onToggle(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
      >
        <span className="text-xl shadow-sm rounded-full overflow-hidden">{currentLang === 'ar' ? '🇸🇦' : '🇺🇸'}</span>
        <span className={`text-sm font-extrabold hidden md:block ${isLoginPage ? 'text-white' : 'text-slate-950 dark:text-white'}`}>
          {currentLang === 'ar' ? 'العربية' : 'English'}
        </span>
        <ChevronDown size={14} className={`text-slate-700 dark:text-slate-200 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 ltr:right-0 rtl:left-0 animate-in fade-in slide-in-from-top-2 duration-200">
          <button 
            onClick={() => handleSelect('ar')}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-right
              ${currentLang === 'ar' ? 'bg-slate-50 dark:bg-slate-700/50' : ''}
            `}
          >
            <span className="text-xl">🇸🇦</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">العربية</span>
          </button>
          <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2"></div>
          <button 
            onClick={() => handleSelect('en')}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left
              ${currentLang === 'en' ? 'bg-slate-50 dark:bg-slate-700/50' : ''}
            `}
          >
            <span className="text-xl">🇺🇸</span>
            <span className="text-sm font-bold text-slate-900 dark:text-white">English</span>
          </button>
        </div>
      )}
    </div>
  );
};
