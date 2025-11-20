
import React, { useState } from 'react';
import { Language } from '../types';
import { DICTIONARY } from '../constants';
import { User, Mail, Phone, Briefcase, MapPin, Camera, Save, Shield } from 'lucide-react';

interface ProfileViewProps {
  lang: Language;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ lang }) => {
  const t = DICTIONARY[lang];
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      
      {/* Profile Header / Banner */}
      <div className="relative mb-20">
        <div className="h-48 bg-gradient-to-r from-water-600 to-slate-700 rounded-xl shadow-md"></div>
        <div className="absolute -bottom-12 left-8 flex items-end gap-6">
          <div className="relative group">
             <div className="w-32 h-32 rounded-full bg-white dark:bg-slate-800 p-1.5 shadow-xl">
                <div className="w-full h-full rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 overflow-hidden">
                   <User size={60} />
                </div>
             </div>
             <button className="absolute bottom-2 right-2 bg-water-500 text-white p-2 rounded-full shadow-lg hover:bg-water-600 transition-colors">
               <Camera size={16} />
             </button>
          </div>
          <div className="pb-2">
             <h1 className="text-3xl font-bold text-slate-800 dark:text-white drop-shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm px-3 py-1 rounded-lg inline-block mb-1">Admin User</h1>
             <p className="text-slate-600 dark:text-slate-300 font-medium bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm px-3 py-0.5 rounded-lg">System Administrator</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Stats/Info */}
        <div className="space-y-6">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                 <Shield size={18} className="text-water-500" />
                 {t.role}
              </h3>
              <div className="space-y-3">
                 <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <Briefcase size={16} className="text-slate-400" />
                    <span>Head of Operations</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <MapPin size={16} className="text-slate-400" />
                    <span>Riyadh, HQ</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Column: Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
              {t.personalInfo}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.name}</label>
                 <div className="relative">
                   <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={18} />
                   <input 
                      type="text" 
                      defaultValue="Admin User"
                      className="w-full pl-10 rtl:pr-10 rtl:pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-water-500 focus:border-water-500 outline-none transition-all dark:text-white"
                   />
                 </div>
               </div>
               
               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.email}</label>
                 <div className="relative">
                   <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={18} />
                   <input 
                      type="email" 
                      defaultValue="admin@hydromonitor.sa"
                      className="w-full pl-10 rtl:pr-10 rtl:pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-water-500 focus:border-water-500 outline-none transition-all dark:text-white"
                   />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.phone}</label>
                 <div className="relative">
                   <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={18} />
                   <input 
                      type="tel" 
                      defaultValue="+966 55 123 4567"
                      className="w-full pl-10 rtl:pr-10 rtl:pl-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-water-500 focus:border-water-500 outline-none transition-all dark:text-white"
                   />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.role}</label>
                 <div className="relative">
                   <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rtl:right-3 rtl:left-auto" size={18} />
                   <input 
                      type="text" 
                      defaultValue="System Manager"
                      disabled
                      className="w-full pl-10 rtl:pr-10 rtl:pl-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
                   />
                 </div>
               </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-water-600 text-white rounded-lg hover:bg-water-700 transition-colors font-medium shadow-lg shadow-water-500/20"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Save size={18} />
                )}
                {t.saveChanges}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
