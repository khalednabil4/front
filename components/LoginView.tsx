
import React, { useState } from 'react';
import { Droplet, Mail, Lock, ArrowRight } from 'lucide-react';
import { Language } from '../types';
import { DICTIONARY } from '../constants';
import { LanguageSwitcher } from './LanguageSwitcher';
import { AuthError, login } from '../lib/auth';

interface LoginViewProps {
  onLoginSuccess: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, lang, setLang }) => {
  const t = DICTIONARY[lang];
  
  // Pre-filled credentials
  const [email, setEmail] = useState('admin@hydromonitor.sa');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      onLoginSuccess();
    } catch (err: unknown) {
      if (err instanceof AuthError && err.code === 'INVALID_CREDENTIALS') {
        setError(t.invalidCredentials);
      } else {
        setError(t.loginServerError || t.invalidCredentials);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden z-0">
         <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800"></div>
         <div className="absolute -top-24 -right-24 w-96 h-96 bg-water-600/20 rounded-full blur-3xl animate-pulse"></div>
         <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-water-900/10 to-transparent"></div>
      </div>

      {/* Language Switcher Absolute */}
      <div className="absolute top-6 right-6 z-20 rtl:right-auto rtl:left-6">
        <LanguageSwitcher currentLang={lang} onToggle={setLang} isLoginPage={true} />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
         <div className="p-8 md:p-10">
            
            {/* Brand */}
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-2 font-bold text-2xl tracking-wide text-slate-800 dark:text-white">
                <div className="w-10 h-10 bg-water-500 rounded-xl flex items-center justify-center shadow-lg shadow-water-500/30">
                   <Droplet className="text-white fill-current" size={24} />
                </div>
                <span>HYDRO<span className="text-water-500">PRO</span></span>
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t.loginTitle}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loginSubtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block text-start">{t.email}</label>
                 <div className="relative">
                    <div className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-slate-400">
                       <Mail size={20} />
                    </div>
                    <input 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-3 px-10 outline-none focus:ring-2 focus:ring-water-500 transition-all dark:text-white text-sm font-medium"
                      placeholder="admin@example.com"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block text-start">{t.password}</label>
                 <div className="relative">
                    <div className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-slate-400">
                       <Lock size={20} />
                    </div>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-3 px-10 outline-none focus:ring-2 focus:ring-water-500 transition-all dark:text-white text-sm font-medium"
                      placeholder="••••••••"
                    />
                 </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center animate-in fade-in">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-water-600 hover:bg-water-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-water-500/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                   <>
                     {t.loginButton}
                     <ArrowRight size={18} className="rtl:rotate-180" />
                   </>
                )}
              </button>
            </form>

         </div>
         <div className="bg-slate-50 dark:bg-slate-900/50 p-4 text-center border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">© 2025 HydroPro Monitoring Systems</p>
         </div>
      </div>
    </div>
  );
};
