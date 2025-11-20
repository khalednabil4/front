
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Map,
  Activity,
  FileText,
  Bell,
  Menu,
  Droplet,
  Moon,
  Sun,
  LogOut,
  User,
  ChevronDown,
  Settings,
  Palette,
  MousePointer
} from 'lucide-react';
import { Language, View, Theme, Sensor, ColorTheme, CursorStyle } from './types';
import { DICTIONARY, MOCK_STATIONS, MOCK_NOTIFICATIONS } from './constants';
import { AreaForm } from './components/AreaForm';
import { PipeSystem } from './components/PipeSystem';
import { SensorModal } from './components/SensorModal';
import { ReportsView } from './components/ReportsView';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ProfileView } from './components/ProfileView';
import { LoginView } from './components/LoginView';

import { DynamicTableView } from './components/DynamicTableView';
import { DynamicCreateView } from './components/DynamicCreateView';

// Define color palettes for CSS variables
const THEMES: Record<ColorTheme, Record<string, string>> = {
  blue: {
    '50': '#f0f9ff', '100': '#e0f2fe', '200': '#bae6fd', '400': '#38bdf8',
    '500': '#0ea5e9', '600': '#0284c7', '700': '#0369a1', '900': '#0c4a6e'
  },
  emerald: {
    '50': '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0', '400': '#34d399',
    '500': '#10b981', '600': '#059669', '700': '#047857', '900': '#064e3b'
  },
  violet: {
    '50': '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe', '400': '#a78bfa',
    '500': '#8b5cf6', '600': '#7c3aed', '700': '#6d28d9', '900': '#4c1d95'
  },
  amber: {
    '50': '#fffbeb', '100': '#fef3c7', '200': '#fde68a', '400': '#fbbf24',
    '500': '#f59e0b', '600': '#d97706', '700': '#b45309', '900': '#78350f'
  }
};

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [lang, setLang] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('light');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('blue');
  const [cursorStyle, setCursorStyle] = useState<CursorStyle>('default');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // RTL Effect
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Theme Effect (Dark/Light)
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Color Theme Effect (CSS Variables)
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEMES[colorTheme];
    Object.entries(colors).forEach(([shade, value]) => {
      root.style.setProperty(`--color-primary-${shade}`, value as string);
    });
  }, [colorTheme]);

  // Cursor Effect
  useEffect(() => {
    document.body.className = document.body.className.replace(/cursor-theme-\w+/g, '').trim();
    document.body.classList.add(`cursor-theme-${cursorStyle}`);
    // Preserve other body classes
    if (!document.body.classList.contains('bg-slate-50')) document.body.classList.add('bg-slate-50');
    if (!document.body.classList.contains('text-slate-900')) document.body.classList.add('text-slate-900');
  }, [cursorStyle]);

  const t = DICTIONARY[lang];

  // If not authenticated, show LoginView
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => setIsAuthenticated(true)} lang={lang} setLang={setLang} />;
  }

  // Navigation Items - Removed Sensors
  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'areas', label: t.areas, icon: Map },
    { id: 'stations', label: t.stations, icon: Droplet },
    { id: 'reports', label: t.reports, icon: FileText },
    { id: 'dynamic-table', label: lang === 'ar' ? 'جدول ديناميكي' : 'Dynamic Table', icon: Activity },
  ];

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${lang === 'ar' ? 'font-cairo' : 'font-sans'}`}>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 z-40 
        bg-slate-900 dark:bg-slate-950 text-white transition-all duration-300 ease-in-out shadow-xl
        ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'}
      `}>
        <div className="h-20 flex items-center justify-center border-b border-slate-800 dark:border-slate-900">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 font-bold text-xl tracking-wide text-water-400">
              <Droplet className="fill-current" size={28} />
              <span>HYDRO<span className="text-white">PRO</span></span>
            </div>
          ) : (
            <Droplet className="text-water-400 fill-current" size={28} />
          )}
        </div>

        <nav className="p-4 space-y-2 mt-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as View)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${currentView === item.id
                  ? 'bg-water-600 text-white shadow-lg shadow-water-900/40 transform scale-[1.02]'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                ${!isSidebarOpen && 'justify-center px-0'}
              `}
            >
              <item.icon size={22} />
              <span className={`${!isSidebarOpen && 'hidden lg:hidden'} whitespace-nowrap font-medium`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">

        {/* Header */}
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shadow-sm z-30 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white hidden md:block transition-colors">
              {navItems.find(n => n.id === currentView)?.label || t.profile}
            </h1>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {/* Language Switcher */}
            <LanguageSwitcher currentLang={lang} onToggle={setLang} />

            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-2.5 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={t.appearance}
              >
                <Settings size={20} />
              </button>

              {isSettingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)}></div>
                  <div className="absolute top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 ltr:right-0 rtl:left-0 p-4 animate-in fade-in slide-in-from-top-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">{t.appearance}</h3>

                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                        {theme === 'light' ? t.themeLight : t.themeDark}
                      </span>
                      <button
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-water-600' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${theme === 'dark' ? 'ltr:left-6 rtl:right-6' : 'ltr:left-1 rtl:right-1'}`}></div>
                      </button>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-3"></div>

                    {/* Color Theme */}
                    <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block flex items-center gap-1">
                        <Palette size={12} />
                        {t.colorTheme}
                      </label>
                      <div className="flex gap-2">
                        {(['blue', 'emerald', 'violet', 'amber'] as ColorTheme[]).map(c => (
                          <button
                            key={c}
                            onClick={() => setColorTheme(c)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${colorTheme === c ? 'border-slate-400 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: THEMES[c]['500'] }}
                          ></button>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-3"></div>

                    {/* Cursor Style */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block flex items-center gap-1">
                        <MousePointer size={12} />
                        {t.cursorStyle}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['default', 'big', 'focus'] as CursorStyle[]).map(c => (
                          <button
                            key={c}
                            onClick={() => setCursorStyle(c)}
                            className={`text-xs py-1.5 rounded border transition-all ${cursorStyle === c ? 'bg-water-50 border-water-200 text-water-700 dark:bg-water-900/30 dark:border-water-700 dark:text-water-300' : 'border-slate-200 dark:border-slate-600 text-slate-500'}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative cursor-pointer p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell size={20} className="text-slate-500 dark:text-slate-300" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)}></div>
                  <div className="absolute top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 ltr:right-0 rtl:left-0 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 dark:text-white">{t.notifications}</h3>
                      <button className="text-xs text-water-600 hover:text-water-700 font-medium">{t.markAllRead}</button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {MOCK_NOTIFICATIONS.map(notif => (
                        <div key={notif.id} className={`p-4 border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                          <div className="flex gap-3">
                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notif.type === 'alert' ? 'bg-red-500' : notif.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-white mb-0.5">{notif.title}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-300 mb-2">{notif.message}</p>
                              <p className="text-[10px] text-slate-400">{notif.time}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-sm shadow-inner border border-slate-300 dark:border-slate-600">
                  <User size={18} />
                </div>
                <div className="hidden md:block text-start">
                  <p className="text-sm font-extrabold text-slate-950 dark:text-white leading-none">Admin User</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-none">System Manager</p>
                </div>
                <ChevronDown size={16} className="text-slate-400 dark:text-slate-300 hidden md:block" />
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 ltr:right-0 rtl:left-0 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => { setCurrentView('profile'); setIsProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-800 dark:text-white text-sm font-bold"
                    >
                      <User size={18} />
                      {t.profile}
                    </button>
                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                    <button
                      onClick={() => { setIsAuthenticated(false); setIsProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 text-sm font-bold"
                    >
                      <LogOut size={18} />
                      {t.logout}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 relative scroll-smooth">

          {/* View: Areas (Manual & Excel Import) */}
          {currentView === 'areas' && <AreaForm lang={lang} />}

          {/* View: Profile */}
          {currentView === 'profile' && <ProfileView lang={lang} />}

          {/* View: Dashboard / Stations */}
          {(currentView === 'dashboard' || currentView === 'stations') && (
            <div className="space-y-8 max-w-7xl mx-auto">
              {/* Stations Loop */}
              {MOCK_STATIONS.map(station => (
                <div key={station.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 duration-500 transition-colors">
                  <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full animate-pulse ${station.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">{station.name}</h3>
                    </div>
                    <span className="text-xs font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded uppercase tracking-wider">
                      {station.id}
                    </span>
                  </div>

                  <div className="p-6 space-y-4">
                    {station.pipes.map(pipe => (
                      <PipeSystem
                        key={pipe.id}
                        pipe={pipe}
                        onSensorClick={setSelectedSensor}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* View: Reports (Real Charts) */}
          {currentView === 'reports' && <ReportsView lang={lang} />}

          {/* View: Dynamic Table */}
          {currentView === 'dynamic-table' && (
            <DynamicTableView
              lang={lang}
              onCreateClick={() => setCurrentView('dynamic-create')}
            />
          )}

          {/* View: Dynamic Create */}
          {currentView === 'dynamic-create' && (
            <DynamicCreateView
              lang={lang}
              onBack={() => setCurrentView('dynamic-table')}
            />
          )}

        </div>
      </main>

      {/* Modals */}
      <SensorModal
        sensor={selectedSensor}
        onClose={() => setSelectedSensor(null)}
        lang={lang}
      />
    </div>
  );
};

export default App;
