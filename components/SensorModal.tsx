
import React, { useEffect, useState } from 'react';
import { X, Activity, Clock, Droplets, AlertTriangle } from 'lucide-react';
import { Sensor, Language } from '../types';
import { DICTIONARY } from '../constants';
import { Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SensorModalProps {
  sensor: Sensor | null;
  onClose: () => void;
  lang: Language;
}

export const SensorModal: React.FC<SensorModalProps> = ({ sensor, onClose, lang }) => {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    // Check initial theme
    setIsDark(document.documentElement.classList.contains('dark'));
    
    // Observer for class changes on html element to update tooltip theme dynamically
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  if (!sensor) return null;
  
  const t = DICTIONARY[lang];
  const isRTL = lang === 'ar';

  // Tooltip Styles based on Theme
  const tooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    borderRadius: '8px',
    color: isDark ? '#f8fafc' : '#0f172a',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg ${sensor.status === 'warning' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-water-100 dark:bg-water-900/30 text-water-600 dark:text-water-400'}`}>
               <Activity size={24} />
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800 dark:text-white">{sensor.name}</h3>
               <p className="text-sm text-slate-500 dark:text-slate-400">{sensor.lineName}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
             <div className="bg-gradient-to-br from-water-500 to-water-600 text-white p-5 rounded-xl shadow-lg shadow-water-500/20 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 text-white/10">
                  <Activity size={80} />
                </div>
                <p className="text-water-100 text-sm font-medium mb-1">{t.pressure}</p>
                <div className="text-3xl font-bold flex items-end gap-1">
                   {sensor.pressure} <span className="text-base font-normal opacity-80">{t.bar}</span>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-5 rounded-xl shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                   <Clock size={16} />
                   <span className="text-sm font-medium">{t.lastReading}</span>
                </div>
                <div className="text-lg font-semibold text-slate-800 dark:text-slate-200" dir="ltr">
                   {sensor.lastReadingCurrent.split(',')[1]}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                   {sensor.lastReadingCurrent.split(',')[0]}
                </div>
             </div>

             <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-5 rounded-xl shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                   <Droplets size={16} />
                   <span className="text-sm font-medium">{t.consumption24h}</span>
                </div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
                   {sensor.dailyConsumption} m³
                </div>
             </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-700 dark:text-slate-200">{t.historyGraph}</h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-water-500"></span> {t.normal}</span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500"></span> {t.alertHigh}</span>
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={sensor.history}>
                  <defs>
                    <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" vertical={false} opacity={0.2} />
                  <XAxis dataKey="time" fontSize={12} tickMargin={10} stroke="#94a3b8" />
                  <YAxis domain={[0, 10]} fontSize={12} stroke="#94a3b8" orientation={isRTL ? "right" : "left"} />
                  <Tooltip 
                    contentStyle={tooltipStyle}
                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--color-primary-500)" fillOpacity={1} fill="url(#colorPressure)" />
                  <Line type="monotone" dataKey="value" stroke="var(--color-primary-500)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-primary-500)" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alert Box if Critical */}
          {sensor.status === 'warning' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-red-800 dark:text-red-400 font-bold text-sm">{t.alertHigh}</h4>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">{t.detectedPressureSpikes}</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};