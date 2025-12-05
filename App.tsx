
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  MousePointer,
  MapPin,
  Building2,
  Landmark,
  Home,
  Cpu,
  Gauge,
  ClipboardList,
  Network,
  Hash,
  Plug,
  Share2
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
import { NewPage } from './components/NewPage';
import { LoadingSpinner } from './components/LoadingSpinner';
import ScrollToTopButton from './components/ScrollToTopButton';

import { DynamicTableView } from './components/DynamicTableView';
import { DynamicCreateView } from './components/DynamicCreateView';
import PagePath from './components/PagePath';
import { clearAuthToken, getAuthToken, authFetch } from './lib/auth';
import { MetaListView } from './components/MetaListView';

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

const LANGUAGE_STORAGE_KEY = 'hydromonitor:lang';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://8de77a78ce9b.ngrok-free.app').replace(/\/$/, '');

const getStoredLanguage = (): Language => {
  if (typeof window === 'undefined') return 'ar';
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'en' || stored === 'ar' ? stored : 'ar';
  } catch {
    return 'ar';
  }
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasHydratedAuth, setHasHydratedAuth] = useState(false);

  const [lang, setLang] = useState<Language>(getStoredLanguage);
  const [theme, setTheme] = useState<Theme>('light');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('blue');
  const [cursorStyle, setCursorStyle] = useState<CursorStyle>('default');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [remoteStations, setRemoteStations] = useState<typeof MOCK_STATIONS>([]);
  const [pointSummary, setPointSummary] = useState<any | null>(null);

  useEffect(() => {
    // Restore persisted token on first render
    setIsLoggedIn(Boolean(getAuthToken()));
    setHasHydratedAuth(true);
  }, []);

  useEffect(() => {
    const onForcedLogout = () => setIsLoggedIn(false);
    if (typeof window !== 'undefined') {
      window.addEventListener('auth:logout', onForcedLogout);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:logout', onForcedLogout);
      }
    };
  }, []);

  const t = DICTIONARY[lang];

  const entityPages = [
    { id: 'companies', label: t.companies || 'Companies', endpoint: '/core/companies/', modelName: 'core.company', icon: Building2 },
    { id: 'dm', label: t.dm || 'DM', endpoint: '/core/dm/', modelName: 'core.dm', icon: MapPin },
    { id: 'provinces', label: t.provinces || 'Provinces', endpoint: '/core/provinces/', modelName: 'core.province', icon: Landmark },
    { id: 'centers', label: t.centers || 'Centers', endpoint: '/core/centers/', modelName: 'core.center', icon: Landmark },
    { id: 'villages', label: t.villages || 'Villages', endpoint: '/core/villages/', modelName: 'core.village', icon: Home },
    { id: 'device-types', label: t.deviceTypes || 'Device Types', endpoint: '/core/device-types/', modelName: 'core.device_type', icon: Cpu },
    { id: 'measure-types', label: t.measureTypes || 'Measure Types', endpoint: '/core/measure-types/', modelName: 'core.measure_type', icon: Gauge },
    { id: 'measure-devices', label: t.measureDevices || 'Measure Devices', endpoint: '/core/measure-devices/', modelName: 'core.measure_device', icon: Share2 },
    { id: 'points', label: t.points || 'Points', endpoint: '/core/points/', modelName: 'core.point', icon: MapPin },
    { id: 'readings', label: t.readings || 'Readings', endpoint: '/core/readings/', modelName: 'core.reading', icon: Activity },
    { id: 'dma-field-surveys', label: t.dmaFieldSurveys || 'DMA Field Surveys', endpoint: '/core/dma-field-surveys/', modelName: 'core.dma_field_survey', icon: ClipboardList },
    { id: 'dmz-network-data', label: t.dmzNetworkData || 'DM Network Data', endpoint: '/core/dmz-network-data/', modelName: 'core.dmz_network_data', icon: Network },
    { id: 'units', label: t.units || 'Units', endpoint: '/core/units/', modelName: 'core.unit', icon: Hash },
    { id: 'connection-types', label: t.connectionTypes || 'Connection Types', endpoint: '/core/connection-types/', modelName: 'core.connection_type', icon: Plug },
  ];

  // Map URL path to current view
  const getCurrentViewFromPath = (): View => {
    const path = location.pathname.toLowerCase();
    const matchedEntity = entityPages.find(p => path.includes(`/${p.id}`));
    if (matchedEntity) return matchedEntity.id as View;
    if (path.includes('/areas')) return 'areas';
    if (path.includes('/stations')) return 'stations';
    if (path.includes('/reports')) return 'reports';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/newpage')) return 'newpage';
    if (path.includes('/dynamic-create')) return 'dynamic-create';
    if (path.includes('/dynamic-table')) return 'dynamic-table';
    return 'dashboard';
  };

  const currentView = getCurrentViewFromPath();

  // Global loading event handling: components can dispatch 'app:loading:start' and 'app:loading:stop'
  React.useEffect(() => {
    let count = 0;
    let fallbackTimer: any = null;
    const start = () => {
      count += 1;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      setIsLoading(true);
    };
    const stop = () => {
      count = Math.max(0, count - 1);
      if (count === 0) {
        // small debounce to avoid flicker
        fallbackTimer = setTimeout(() => setIsLoading(false), 80);
      }
    };

    const onStart = () => start();
    const onStop = () => stop();
    window.addEventListener('app:loading:start', onStart as EventListener);
    window.addEventListener('app:loading:stop', onStop as EventListener);

    // Also show loader immediately on view change; it will hide when components stop loading
    const unlistenView = () => { /* placeholder for cleanup if needed */ };

    return () => {
      window.removeEventListener('app:loading:start', onStart as EventListener);
      window.removeEventListener('app:loading:stop', onStop as EventListener);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      unlistenView();
    };
  }, []);

  // Ensure spinner appears immediately when view changes; it will be dismissed by components that dispatch stop
  useEffect(() => {
    setIsLoading(true);
    // safety: if no component signals completion, hide after 12s
    const safety = setTimeout(() => setIsLoading(false), 6000);
    return () => clearTimeout(safety);
  }, [currentView]);

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

  const handleLogout = () => {
    clearAuthToken();
    setIsLoggedIn(false);
  };

  const createSensorFromPoint = (pt: any, idx: number, areaInactive: boolean): Sensor => {
    const statusValue = (pt?.status || '').toString().toLowerCase();
    const isWarningPoint = statusValue.includes('معطل') || statusValue.includes('inactive') || statusValue.includes('disabled') || statusValue.includes('not active');
    const pointTypes: string[] = Array.isArray(pt?.point_type) ? pt.point_type : typeof pt?.point_type === 'string' ? [pt.point_type] : [];
    const hasPressure = pointTypes.some(t => t.toLowerCase().includes('pressur'));
    const hasFlow = pointTypes.some(t => t.toLowerCase().includes('flow'));
    const readingValue = hasFlow ? (pt?.flow ?? pt?.flow_rate ?? 0) : (pt?.pressure ?? 0);
    return {
      id: String(pt?.id ?? `point-${idx}`),
      name: pt?.name || pt?.code || `${t.points} ${idx + 1}`,
      lineName: pt?.point_from ? `${pt.point_from} -> ${pt.point_to || ''}`.trim() : 'Point',
      pressure: typeof readingValue === 'number' ? readingValue : parseFloat(readingValue) || 0,
      status: areaInactive || isWarningPoint ? 'warning' : 'normal',
      lastReadingCurrent: new Date().toISOString(),
      lastReadingPrevious: new Date(Date.now() - 3600_000).toISOString(),
      total3MCurrent: 0,
      total3MPrevious: 0,
      dailyConsumption: 0,
      history: [],
    };
  };

  const mapAreaToStation = (area: any): typeof MOCK_STATIONS[number] => {
    const areaStatus = (area?.status || '').toString().toLowerCase();
    const areaInactive = !areaStatus || areaStatus.includes('inactive') || areaStatus.includes('disabled') || areaStatus.includes('معطل') ? true : areaStatus.includes('active') ? false : false;
    const points = Array.isArray(area?.points) ? area.points : [];
    const sensors = points.map((pt: any, idx: number) => createSensorFromPoint(pt, idx, areaInactive));
    const hasWarning = areaInactive || sensors.some(s => s.status === 'warning');
    const pipes = [
      {
        id: `pipe-${area?.id ?? Math.random()}`,
        name: area?.name || area?.code || t.points,
        sensors,
      },
    ];
    return {
      id: String(area?.id ?? `area-${Math.random()}`),
      name: area?.name || area?.code || t.areas,
      areaId: String(area?.id ?? ''),
      pipes,
      status: hasWarning ? 'maintenance' : 'active',
    };
  };

  const fetchStations = React.useCallback(async () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(`${API_BASE_URL}/core/area-management/`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const data = await res.json();
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const mapped = items.map(mapAreaToStation);
      setRemoteStations(mapped);
    } catch (e) {
      console.error('Failed to load stations', e);
    } finally {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  }, [lang, t.areas, t.points]);

  const fetchPointSummary = async (pointId: string | number) => {
    if (!pointId) return;
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
      const res = await authFetch(`${API_BASE_URL}/core/summary-point/${pointId}/`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      setPointSummary(data);
    } catch (e) {
      console.error('Failed to load point summary', e);
      setPointSummary(null);
    } finally {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  React.useEffect(() => {
    if (currentView === 'stations' || currentView === 'dashboard') {
      fetchStations();
    }
  }, [currentView, fetchStations]);

  const handleLanguageChange = (nextLang: Language) => {
    setLang(nextLang);
    try {
      window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage errors to keep the language toggle responsive
    }
    window.location.reload();
  };

  // Wait for token hydration before deciding what to render
  if (!hasHydratedAuth) {
    const message = lang === 'ar' ? 'جارٍ التحقق من الجلسة...' : 'Checking session...';
    return <LoadingSpinner isVisible={true} message={message} />;
  }

  // If not authenticated, show LoginView
  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} lang={lang} setLang={handleLanguageChange} />;
  }

  // Navigation Items - Removed Sensors
  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'areas', label: t.areas, icon: Map },
    { id: 'stations', label: t.stations, icon: Droplet },
    ...entityPages,
    { id: 'reports', label: t.reports, icon: FileText },
    { id: 'newpage', label: t.newPage, icon: MousePointer },
    { id: 'dynamic-table', label: lang === 'ar' ? 'جدول ديناميكي' : 'Dynamic Table', icon: Activity },
  ];

  return (
    <>
      <LoadingSpinner isVisible={isLoading} />
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
                onClick={() => navigate(`/${item.id}`)}
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
              <LanguageSwitcher currentLang={lang} onToggle={handleLanguageChange} />

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
                        onClick={() => { navigate('/profile'); setIsProfileOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-800 dark:text-white text-sm font-bold"
                      >
                        <User size={18} />
                        {t.profile}
                      </button>
                      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                      <button
                        onClick={() => { handleLogout(); setIsProfileOpen(false); }}
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

            {/* Page Path Display */}
            <PagePath currentView={currentView} lang={lang} />

            {/* View: Areas (Manual & Excel Import) */}
            {currentView === 'areas' && <AreaForm lang={lang} />}

            {/* View: Profile */}
            {currentView === 'profile' && <ProfileView lang={lang} />}

            {/* Entity Views */}
            {(() => {
              const activeEntity = entityPages.find(e => e.id === currentView);
              if (!activeEntity) return null;
              return (
                <MetaListView
                  key={activeEntity.id}
                  lang={lang}
                  title={activeEntity.label}
                  endpoint={activeEntity.endpoint}
                  modelName={activeEntity.modelName}
                  description={lang === 'ar' ? 'عرض البيانات ديناميكياً' : 'Dynamic data view'}
                  detailTitle={activeEntity.label}
                />
              );
            })()}

            {/* View: Dashboard / Stations */}
            {(currentView === 'dashboard' || currentView === 'stations') && (
              <div className="space-y-8 max-w-7xl mx-auto">
                {/* Stations Loop */}
                {(remoteStations.length ? remoteStations : MOCK_STATIONS).map(station => (
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
                          onSensorClick={(sensor) => {
                            setPointSummary(null);
                            setSelectedSensor(sensor);
                            fetchPointSummary(sensor.id);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View: Reports (Real Charts) */}
            {currentView === 'reports' && <ReportsView lang={lang} />}

            {/* View: New Page (example new component) */}
            {currentView === 'newpage' && <NewPage lang={lang} />}

            {/* View: Dynamic Table */}
            {currentView === 'dynamic-table' && (
              <DynamicTableView
                lang={lang}
                onCreateClick={() => navigate('/dynamic-create')}
              />
            )}

            {/* View: Dynamic Create */}
            {currentView === 'dynamic-create' && (
              <DynamicCreateView
                lang={lang}
                onBack={() => navigate('/dynamic-table')}
              />
            )}

            {/* Social Media Icons - Footer */}
            <div className="flex items-center justify-center gap-4 mt-16 pb-8 border-t border-slate-200 dark:border-slate-700 pt-6">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Facebook"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-sky-900/30 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                title="Twitter"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 002.856-3.915 10 10 0 01-2.856.974 4.958 4.958 0 00-8.86 4.53c-4.113-.645-7.81-2.433-10.288-5.093a4.929 4.929 0 001.523 6.574 4.903 4.903 0 01-2.25-.616c-.054 2.281 1.581 4.415 3.949 4.89a4.935 4.935 0 01-2.224.084 4.928 4.928 0 004.6 3.419A9.9 9.9 0 010 19.54a13.994 13.994 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                title="LinkedIn"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.475-2.236-1.986-2.236-1.081 0-1.722.731-2.004 1.438-.103.25-.129.599-.129.949v5.418h-3.554s.05-8.736 0-9.646h3.554v1.364c.43-.664 1.199-1.608 2.928-1.608 2.136 0 3.745 1.398 3.745 4.402v5.488zM5.337 9.433c-1.144 0-1.915-.758-1.915-1.71 0-.961.769-1.71 1.959-1.71 1.18 0 1.914.749 1.939 1.71 0 .952-.759 1.71-1.983 1.71zm1.946 11.019H3.391V9.806h3.892v10.646zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" /></svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-pink-100 dark:hover:bg-pink-900/30 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                title="Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m5.521 17.92c-3.834 5.768-11.769 7.384-17.537 3.55-5.768-3.834-7.384-11.769-3.55-17.537 3.834-5.768 11.769-7.384 17.537-3.55 5.768 3.834 7.384 11.769 3.55 17.537M12 3a9 9 0 110 18 9 9 0 010-18m0 4a5 5 0 110 10 5 5 0 010-10m3-1a1 1 0 110-2 1 1 0 010 2" /></svg>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-slate-700 hover:text-white transition-colors"
                title="GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              </a>
            </div>

          </div>

        </main>

        {/* Modals */}
        {selectedSensor && (
          <SensorModal
            sensor={selectedSensor}
            onClose={() => {
              setSelectedSensor(null);
              setPointSummary(null);
            }}
            lang={lang}
            summary={pointSummary}
          />
        )}
      </div>
      <ScrollToTopButton />
    </>
  );
};

export default App;
