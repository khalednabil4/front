import React, { useEffect, useState, useMemo } from 'react';
import { X, Activity, Clock, Droplets, AlertTriangle, TrendingUp } from 'lucide-react';
import { Sensor, Language } from '../types';
import { DICTIONARY } from '../constants';
import { Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SensorModalProps {
  sensor: Sensor | null;
  onClose: () => void;
  lang: Language;
  summary?: any | null;
}

type SensorModalInnerProps = Omit<SensorModalProps, 'sensor'> & { sensor: Sensor };

const numberOrNull = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const padDomain = (values: number[]) => {
  if (!values.length) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  } else {
    const pad = (max - min) * 0.1;
    min -= pad;
    max += pad;
  }
  return [min, max];
};

const safeTimeString = (value: any) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString();
};

const safeDateString = (value: any) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
};

const SensorModalInner: React.FC<SensorModalInnerProps> = ({ sensor, onClose, lang, summary }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
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

  const t = DICTIONARY[lang];
  const isRTL = lang === 'ar';

  const pointTypesRaw = Array.isArray(summary?.point?.point_type) ? summary.point.point_type : [];
  const pointTypes = pointTypesRaw.map((pt: any) =>
    typeof pt === 'string' ? pt.toLowerCase() : String(pt || '').toLowerCase()
  );
  const supportsFlow = pointTypes.length === 0 || pointTypes.includes('flow');
  const supportsLevel = pointTypes.includes('level') && !pointTypes.includes('flow');
  const supportsPressure = pointTypes.length === 0 || pointTypes.includes('pressure');

  const hasSummary = summary !== null && summary !== undefined;
  const liveConnection = summary?.live_connection || null;
  const liveStatus = String(liveConnection?.status || '').toLowerCase();
  const liveConnectionFailed = liveStatus === 'failed';
  const liveConnectionNotConfigured = liveStatus === 'not_configured';
  const liveConnectionOk = liveStatus === 'ok' || liveConnection?.is_live === true;
  const liveConnectionNeedsAttention = Boolean(liveConnection && !liveConnectionOk);
  const liveBadgeText = liveConnectionOk
    ? (lang === 'ar' ? 'قراءة مباشرة من مودباص' : 'Live Modbus')
    : liveConnectionFailed
      ? (lang === 'ar' ? 'فشل اتصال مودباص' : 'Live connection failed')
      : liveConnectionNotConfigured
        ? (lang === 'ar' ? 'لم يتم ضبط IP مودباص' : 'Modbus IP not configured')
        : (lang === 'ar' ? 'آخر قراءة محفوظة' : 'Last saved reading');
  const liveAlertTitle = liveConnectionNotConfigured
    ? (lang === 'ar' ? 'لم يتم ضبط اتصال مودباص لهذه النقطة' : 'Modbus connection is not configured for this point')
    : (lang === 'ar' ? 'فشل الاتصال المباشر بمودباص' : 'Live Modbus connection failed');
  const liveAlertText = liveConnectionNotConfigured
    ? (lang === 'ar'
        ? 'سيتم عرض آخر قراءة محفوظة. أضف DEVICE_IP للنقطة لتفعيل القراءة المباشرة.'
        : 'Showing the last saved reading. Add DEVICE_IP to the point to enable live readings.')
    : (lang === 'ar'
        ? `سيتم عرض آخر قراءة محفوظة. ${liveConnection?.message || ''}`
        : `Showing the last saved reading. ${liveConnection?.message || ''}`);

  const summaryReading = summary?.last_reading || {};
  const summaryChart = Array.isArray(summary?.chart_24h) ? summary.chart_24h : [];
  const modbusSettings = summary?.point?.modbus || null;
  const modbusRegisters = modbusSettings?.registers && typeof modbusSettings.registers === 'object'
    ? Object.entries(modbusSettings.registers as Record<string, number>)
    : [];
  const pointUnit =
    summary?.point?.unit ||
    summary?.point?.unit_flow_total ||
    summary?.point?.unit_pressure ||
    summary?.point?.unit_flow;

  const pressureValue = supportsPressure
    ? numberOrNull(hasSummary ? summaryReading.pressure : sensor.pressure)
    : null;
  const flowValue = supportsFlow ? numberOrNull(hasSummary ? summaryReading.flow : null) : null;
  const levelValue = supportsLevel ? numberOrNull(hasSummary ? summaryReading.level : null) : null;
  const consumptionValue = numberOrNull(summary?.consumption_24h ?? sensor.dailyConsumption ?? 0) ?? 0;
  const tutalizerValue = numberOrNull(summaryReading.tutalizer ?? summaryReading.totalizer);

  const pressureUnit = summaryReading.unit_pressure || summary?.point?.unit_pressure || pointUnit || t.bar;
  const flowUnit = summaryReading.unit_flow || summary?.point?.unit_flow || summary?.point?.unit_flow_total || pointUnit || 'm³';
  const levelUnit = summaryReading.unit_level || summary?.point?.unit_level || 'm';
  const consumptionUnit = flowUnit || 'm³';
  const tutalizerUnit =
    summaryReading.unit_tutalizer ||
    summaryReading.unit_totalizer ||
    summary?.point?.unit_tot ||
    summary?.point?.unit_totalizer ||
    flowUnit ||
    'm³';

  const lastReadingDate = (() => {
    const src = hasSummary ? summaryReading.datetime : (sensor.lastReadingCurrent ?? new Date());
    const time = safeTimeString(src);
    const date = safeDateString(src);
    return { time, date };
  })();

  const chartData = useMemo(() => {
    try {
      let data: any[] = [];
      if (summaryChart.length) {
        data = summaryChart.map((r: any) => ({
          time: safeTimeString(r?.datetime),
          flow: supportsFlow ? numberOrNull(r?.flow) : null,
          level: supportsLevel ? numberOrNull(r?.level) : null,
          pressure: supportsPressure ? numberOrNull(r?.pressure) : null,
        }));
      } else if (Array.isArray(sensor.history)) {
        data = sensor.history.map((h: any) => ({
          time: h.time,
          flow: supportsFlow ? numberOrNull(h.value) : null,
          level: supportsLevel ? numberOrNull(h.value) : null,
          pressure: supportsPressure ? numberOrNull(h.value) : null,
        }));
      }
      // Append last reading so it shows even if chart_24h is empty
      if ((supportsFlow && flowValue !== null) || (supportsLevel && levelValue !== null) || (supportsPressure && pressureValue !== null)) {
        data.push({
          time: lastReadingDate.time,
          flow: supportsFlow ? flowValue : null,
          level: supportsLevel ? levelValue : null,
          pressure: supportsPressure ? pressureValue : null,
        });
      }
      return data;
    } catch (e) {
      console.error('Chart data parse error', e);
      return [];
    }
  }, [summaryChart, sensor.history, flowValue, levelValue, pressureValue, lastReadingDate.time, supportsFlow, supportsLevel, supportsPressure]);

  const hasFlowData = supportsFlow && chartData.some(d => numberOrNull(d.flow) !== null);
  const hasLevelData = supportsLevel && chartData.some(d => numberOrNull(d.level) !== null);
  const hasPressureData = supportsPressure && chartData.some(d => numberOrNull(d.pressure) !== null);

  const yValues = chartData
    .map(d => [numberOrNull(d.flow), numberOrNull(d.level), numberOrNull(d.pressure)])
    .flat()
    .filter((v): v is number => v !== null);
  const [yMin, yMax] = padDomain(yValues);

  const summaryConsumption = consumptionValue;

  const showFlowCard = supportsFlow;
  const showLevelCard = supportsLevel;

  const flowLabel = t.flowRate || t.consumption24h || 'Flow';
  const levelLabel = lang === 'ar' ? 'المنسوب' : 'Level';
  const pressureLabel = t.pressure || 'Pressure';
  const noReadingText = lang === 'ar' ? 'لا يوجد قراءة' : 'No reading';
  const tutalizerLabel = lang === 'ar' ? 'توتاليزر' : 'Tutalizer';
  const primaryMetricKey = showFlowCard ? 'flow' : showLevelCard ? 'level' : 'pressure';
  const primaryMetricLabel = showFlowCard ? flowLabel : showLevelCard ? levelLabel : pressureLabel;
  const primaryMetricValue = showFlowCard ? flowValue : showLevelCard ? levelValue : pressureValue;
  const primaryMetricUnit = showFlowCard ? flowUnit : showLevelCard ? levelUnit : pressureUnit;
  const hasPrimaryData = primaryMetricKey === 'flow' ? hasFlowData : primaryMetricKey === 'level' ? hasLevelData : hasPressureData;
  const primarySeriesColor = primaryMetricKey === 'level' ? '#14b8a6' : '#0ea5e9';
  const primaryGradientId = primaryMetricKey === 'level' ? 'colorLevel' : 'colorFlow';

  const tooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    borderRadius: '8px',
    color: isDark ? '#f8fafc' : '#0f172a',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="bg-white dark:bg-slate-800 w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors"
      >
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X size={26} />
          </button>

          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div
              className={`p-3 rounded-2xl ${sensor.status === 'warning'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-water-100 dark:bg-water-900/30 text-water-600 dark:text-water-400'
              }`}
            >
              <Activity size={26} />
            </div>
            <div className={`${isRTL ? 'text-right' : 'text-left'}`}>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{sensor.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{sensor.lineName}</p>
              {liveConnectionNeedsAttention || liveConnectionOk ? (
                <div
                  className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold ${
                    liveConnectionNeedsAttention
                      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {liveBadgeText}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {liveConnectionNeedsAttention && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-red-800 dark:text-red-400 font-bold text-sm">{liveAlertTitle}</h4>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                  {liveAlertText}
                </p>
              </div>
            </div>
          )}

          {hasSummary && modbusSettings && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {lang === 'ar' ? 'إعدادات اتصال مودباص' : 'Modbus connection settings'}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? 'تستخدم هذه النقطة القراءة المباشرة كل دقيقة من إعدادات الاتصال الخاصة بها.' : 'This point uses its own connection settings for live one-minute reads.'}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                  modbusSettings.is_configured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {modbusSettings.is_configured
                    ? (lang === 'ar' ? 'مهيأ' : 'Configured')
                    : (lang === 'ar' ? 'غير مهيأ' : 'Not configured')}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Protocol</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{String(modbusSettings.protocol || 'modbus_tcp').toUpperCase()}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">IP</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{modbusSettings.device_ip || '--'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Port / Slave</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {modbusSettings.port || 502} / {modbusSettings.slave_id || 1}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {lang === 'ar' ? 'الفاصل' : 'Interval'}
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {modbusSettings.scheduled_mins ? `${modbusSettings.scheduled_mins} min` : '--'}
                  </div>
                </div>
              </div>

              {modbusRegisters.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {modbusRegisters.map(([registerKey, registerValue]) => (
                    <span
                      key={registerKey}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {registerKey}: {registerValue}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Last Reading */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-5 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Clock size={16} />
                <span className="text-sm font-medium">{t.lastReading}</span>
              </div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-200" dir="ltr">
                {lastReadingDate.time || noReadingText}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {lastReadingDate.date || noReadingText}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 space-y-1">
                {supportsPressure && (
                  <div>
                    {pressureLabel}: {pressureValue === null ? noReadingText : `${pressureValue} ${pressureUnit}`}
                  </div>
                )}
                {showFlowCard && (
                  <div>
                    {flowLabel}: {flowValue === null ? noReadingText : `${flowValue} ${flowUnit}`}
                  </div>
                )}
                {showLevelCard && (
                  <div>
                    {levelLabel}: {levelValue === null ? noReadingText : `${levelValue} ${levelUnit}`}
                  </div>
                )}
                <div>
                  {tutalizerLabel}:{' '}
                  {tutalizerValue === null ? noReadingText : `${tutalizerValue} ${tutalizerUnit}`}
                </div>
              </div>
            </div>

            {/* Primary Metric (Flow preferred) */}
            <div className="bg-gradient-to-br from-water-500 to-water-600 text-white p-6 rounded-2xl shadow-lg shadow-water-500/20 relative overflow-hidden flex flex-col justify-center min-h-[160px]">
              <div className="absolute -right-6 -bottom-6 text-white/10">
                <Droplets size={120} />
              </div>
              <p className="text-water-100 text-sm font-semibold mb-2">
                {primaryMetricLabel}
              </p>
              <div className="text-3xl font-extrabold flex items-end gap-2">
                {primaryMetricValue === null ? (
                  <span className="text-base font-semibold">{noReadingText}</span>
                ) : (
                  <>
                    {primaryMetricValue} <span className="text-base font-normal opacity-80">{primaryMetricUnit}</span>
                  </>
                )}
              </div>
              <div className="text-xs text-white/80 mt-3 flex items-center gap-1">
                <TrendingUp size={14} /> {t.lastReading}: {lastReadingDate.time}
              </div>
            </div>

            {/* Tutalizer Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-5 rounded-xl shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Droplets size={16} />
                <span className="text-sm font-medium">{tutalizerLabel}</span>
              </div>
              <div className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                {tutalizerValue === null ? (
                  <span className="text-base font-semibold">{noReadingText}</span>
                ) : (
                  <>
                    {tutalizerValue} <span className="text-base font-normal opacity-80">{tutalizerUnit}</span>
                  </>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {lastReadingDate.date} | {lastReadingDate.time}
              </div>
            </div>
          </div>

          {/* Chart Section */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-slate-700 dark:text-slate-200">
                  {hasPressureData && !hasFlowData && !hasLevelData
                    ? (lang === 'ar' ? 'سجل الضغوط (آخر 24 ساعة)' : 'Pressure log (last 24h)')
                    : t.historyGraph}
                </h4>
                <div className="flex items-center gap-3 text-xs">
                  {hasPressureData && (
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-water-500"></span> {pressureLabel}
                    </span>
                  )}
                  {hasFlowData && (
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span> {flowLabel}
                    </span>
                  )}
                  {hasLevelData && (
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-teal-500"></span> {levelLabel}
                    </span>
                  )}
                </div>
              </div>
              
              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                  {t.noRows || 'No data'}
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200}>
                    <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" vertical={false} opacity={0.2} />
                      <XAxis dataKey="time" fontSize={12} tickMargin={10} stroke="#94a3b8" />
                      <YAxis domain={[yMin, yMax]} fontSize={12} stroke="#94a3b8" orientation={isRTL ? "right" : "left"} />
                      <Tooltip 
                        contentStyle={tooltipStyle}
                        cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }}
                        formatter={(val, key) => [
                          val,
                          key === 'pressure'
                            ? `${pressureLabel} (${pressureUnit})`
                            : key === 'level'
                              ? `${levelLabel} (${levelUnit})`
                              : `${flowLabel} (${flowUnit})`,
                        ]}
                      />
                      {hasPressureData && (
                        <>
                          <Area type="monotone" dataKey="pressure" stroke="var(--color-primary-500)" fillOpacity={1} fill="url(#colorPressure)" connectNulls />
                          <Line type="monotone" dataKey="pressure" stroke="var(--color-primary-500)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-primary-500)" }} connectNulls />
                        </>
                      )}
                      {hasPrimaryData && primaryMetricKey !== 'pressure' && (
                        <>
                          <Area type="monotone" dataKey={primaryMetricKey} stroke={primarySeriesColor} fillOpacity={0.15} fill={`url(#${primaryGradientId})`} connectNulls />
                          <Line type="monotone" dataKey={primaryMetricKey} stroke={primarySeriesColor} strokeWidth={2} dot={{ r: 3, fill: primarySeriesColor }} connectNulls />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
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

class SensorModalBoundary extends React.Component<SensorModalInnerProps, { hasError: boolean }> {
  constructor(props: SensorModalInnerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('SensorModal render error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-md w-full text-center">
            <p className="text-lg font-bold text-red-600 mb-2">حدث خطأ في عرض النقطة</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">يرجى إعادة المحاولة أو تحديث الصفحة.</p>
            <button
              className="px-4 py-2 bg-water-500 text-white rounded-lg shadow-sm hover:bg-water-600 transition-colors"
              onClick={() => this.setState({ hasError: false })}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }
    return <SensorModalInner {...this.props} />;
  }
}

export const SensorModal: React.FC<SensorModalProps> = ({ sensor, ...rest }) => {
  if (!sensor) return null;
  return <SensorModalBoundary {...rest} sensor={sensor} />;
};

export default SensorModal;
