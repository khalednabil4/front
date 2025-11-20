
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FileDown, AlertTriangle, TrendingUp, Activity, Printer } from 'lucide-react';
import { DICTIONARY } from '../constants';
import { Language } from '../types';

interface ReportsViewProps {
  lang: Language;
}

const COLORS = ['#0ea5e9', '#f43f5e', '#10b981', '#f59e0b'];

export const ReportsView: React.FC<ReportsViewProps> = ({ lang }) => {
  const t = DICTIONARY[lang];
  const isRTL = lang === 'ar';
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Mock Data
  const consumptionData = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 },
    { name: 'Jun', value: 900 },
  ];

  const pieData = [
    { name: t.normal, value: 75 },
    { name: t.alertHigh, value: 15 },
    { name: t.alertLow, value: 10 },
  ];

  const handleExportCSV = () => {
    const headers = "Month,Consumption\n";
    const rows = consumptionData.map(d => `${d.name},${d.value}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  // Tooltip Styles based on Theme to resolve contrast issues
  const tooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    borderRadius: '8px',
    color: isDark ? '#f8fafc' : '#0f172a',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t.systemOverview}</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <FileDown size={18} />
            {t.exportCSV}
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-water-600 text-white rounded-lg hover:bg-water-700 transition-colors text-sm font-medium shadow-lg shadow-water-500/20"
          >
            <Printer size={18} />
            {t.exportPDF}
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.averagePressure, value: '4.2 Bar', icon: Activity, color: 'text-blue-500', trend: '+2.4%' },
          { label: t.activeSensors, value: '124/128', icon: TrendingUp, color: 'text-green-500', trend: '98%' },
          { label: t.monthlyConsumption, value: '45k m³', icon: FileDown, color: 'text-purple-500', trend: '+12%' },
          { label: t.totalAlerts, value: '12', icon: AlertTriangle, color: 'text-red-500', trend: '-5%' },
        ].map((metric, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-opacity-10 ${metric.color.replace('text', 'bg')}`}>
                <metric.icon className={`w-6 h-6 ${metric.color}`} />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${metric.trend.startsWith('+') || metric.trend.startsWith('9') ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {metric.trend}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{metric.label}</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{metric.value}</h3>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly Consumption - Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t.monthlyConsumption}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumptionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" vertical={false} opacity={0.2} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} orientation={isRTL ? "right" : "left"} />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(56, 189, 248, 0.1)' }}
                />
                <Bar dataKey="value" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution - Pie Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t.pressureAnomalies}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
             <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3 rounded-lg flex items-start gap-3">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                <div className="text-xs">
                   <p className="font-bold text-red-800 dark:text-red-300 mb-0.5">{t.criticalAlerts}</p>
                   <p className="text-red-600 dark:text-red-400">{t.detectedPressureSpikes}</p>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};