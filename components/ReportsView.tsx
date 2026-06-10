
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertTriangle, Activity, Droplet, Gauge, RefreshCw, CalendarRange, BarChart2, Loader2 } from 'lucide-react';
import { DICTIONARY } from '../constants';
import { Language } from '../types';
import { authFetch } from '../lib/auth';

interface ReportsViewProps {
  lang: Language;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

type PointOption = { id: string; label: string };

type FlowDisplayUnit = 'm3/h' | 'L/s';

type ReadingChannel = {
  key?: string;
  type?: string;
  label?: string;
  value?: string | number | null;
  unit?: string | null;
  unit_symbol?: string | null;
};

type ReportThresholdRange = { min?: number | null; max?: number | null };

type ReportAnomalyBucket = {
  high?: number;
  low?: number;
  normal?: number;
};

type ReportAnomalies = ReportAnomalyBucket & {
  flow?: ReportAnomalyBucket;
  pressure?: ReportAnomalyBucket;
};

type ReportRow = {
  id?: number | string;
  datetime: string;
  flow?: number | string | null;
  pressure?: number | string | null;
  totalizer?: number | string | null;
  unit_flow?: string | null;
  unit_pressure?: string | null;
  unit_totalizer?: string | null;
  channels?: ReadingChannel[];
};

type ReadingReport = {
  point?: {
    id: string | number;
    name?: string;
    code?: string;
    thresholds?: { flow?: ReportThresholdRange; pressure?: ReportThresholdRange };
  };
  date_from?: string;
  date_to?: string;
  summary?: {
    total_readings?: number;
    avg_pressure?: number;
    avg_flow?: number;
    totalizer_delta?: number;
    anomalies?: ReportAnomalies;
    thresholds?: { flow?: ReportThresholdRange; pressure?: ReportThresholdRange };
  };
  monthly_consumption?: { label: string; value: number }[];
  chart?: ReportRow[];
  table?: ReportRow[];
};

const FLOW_DISPLAY_UNITS: FlowDisplayUnit[] = ['m3/h', 'L/s'];

const toNumberOrNull = (value?: string | number | null): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeFlowUnit = (unit?: string | null): FlowDisplayUnit | null => {
  const normalized = String(unit || '')
    .trim()
    .toLowerCase()
    .replace('³', '3')
    .replace(/\s+/g, '');

  if (!normalized) return null;
  if (normalized.includes('l/s') || normalized.includes('lps') || normalized.includes('l/sec')) return 'L/s';
  if (normalized.includes('m3/h') || normalized.includes('m3h') || normalized.includes('m3/hour')) return 'm3/h';
  return null;
};

const inferFlowUnit = (...parts: Array<string | null | undefined>): FlowDisplayUnit | null => {
  const text = parts
    .filter(Boolean)
    .join('_')
    .toLowerCase()
    .replace('³', '3')
    .replace(/[\s-]+/g, '_');

  if (!text) return null;
  if (text.includes('l_s') || text.includes('_ls') || text.includes('lps') || text.includes('l_sec')) return 'L/s';
  if (text.includes('m3_h') || text.includes('m3h') || text.includes('m3_hour')) return 'm3/h';
  return normalizeFlowUnit(text);
};

const getChannelFlowUnit = (channel: ReadingChannel): FlowDisplayUnit | null => (
  normalizeFlowUnit(channel.unit_symbol || channel.unit) ||
  inferFlowUnit(channel.key, channel.label)
);

const convertFlowValue = (
  value: number | null,
  fromUnit: FlowDisplayUnit,
  toUnit: FlowDisplayUnit
): number | null => {
  if (value === null) return null;
  if (fromUnit === toUnit) return value;
  return toUnit === 'L/s' ? value / 3.6 : value * 3.6;
};

const getDisplayFlowValue = (row: ReportRow, displayUnit: FlowDisplayUnit): number | null => {
  const flowChannels = Array.isArray(row.channels)
    ? row.channels.filter(channel => String(channel?.type || '').toLowerCase() === 'flow')
    : [];
  const matchingChannel = flowChannels.find(channel => getChannelFlowUnit(channel) === displayUnit);
  const channelValue = toNumberOrNull(matchingChannel?.value);
  if (channelValue !== null) return channelValue;

  const rawFlow = toNumberOrNull(row.flow);
  if (rawFlow === null) return null;

  const sourceUnit = normalizeFlowUnit(row.unit_flow) || 'm3/h';
  return convertFlowValue(rawFlow, sourceUnit, displayUnit);
};

const localizeUnit = (unit?: string | null, lang: Language = 'en'): string => {
  const raw = String(unit || '').trim();
  const normalized = raw
    .toLowerCase()
    .replace('³', '3')
    .replace(/\s+/g, '');

  if (!normalized) return '';
  if (normalized === 'l/s' || normalized === 'lps' || normalized === 'l/sec') {
    return lang === 'ar' ? 'لتر/ث' : 'L/s';
  }
  if (normalized === 'm3/h' || normalized === 'm3h' || normalized === 'm3/hour') {
    return lang === 'ar' ? 'م³/س' : 'm3/h';
  }
  if (normalized === 'm3') return lang === 'ar' ? 'م³' : 'm3';
  if (normalized === 'bar') return lang === 'ar' ? 'بار' : 'bar';
  if (normalized === 'm') return lang === 'ar' ? 'م' : 'm';
  return raw;
};

const MetricHeader = ({ label, unit }: { label: string; unit?: string | null }) => (
  <span>
    {label}
    {unit ? (
      <>
        {' '}
        (<bdi dir="ltr">{unit}</bdi>)
      </>
    ) : null}
  </span>
);

const NumericText = ({ value }: { value: string }) => (
  <span dir="ltr" className="inline-block tabular-nums">
    {value}
  </span>
);

export const ReportsView: React.FC<ReportsViewProps> = ({ lang }) => {
  const t = DICTIONARY[lang];
  const isRTL = lang === 'ar';
  const [isDark, setIsDark] = useState(false);
  const [points, setPoints] = useState<PointOption[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [selectedPointType, setSelectedPointType] = useState<string[]>([]);
  const [isPointTypeLoading, setIsPointTypeLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [report, setReport] = useState<ReadingReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPoints, setIsFetchingPoints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [flowDisplayUnit, setFlowDisplayUnit] = useState<FlowDisplayUnit>('m3/h');
  const PAGE_SIZE = 15;

  const reportText = useMemo(() => (
    lang === 'ar'
      ? {
          flowUnit: 'وحدة التدفق',
          totalizer: 'التوتلايزر',
          anomalySource: 'يتم حساب الحالات الشاذة من حدود الحد الأدنى والحد الأقصى في النقطة.',
          flowAnomalies: 'حالات التدفق',
          pressureAnomalies: 'حالات الضغط',
          thresholds: 'الحدود',
          min: 'الأدنى',
          max: 'الأقصى',
          noThresholds: 'لم يتم ضبط حدود لهذه القراءة',
        }
      : {
          flowUnit: 'Flow unit',
          totalizer: 'Totalizer',
          anomalySource: 'Anomalies are calculated from the point min/max limits.',
          flowAnomalies: 'Flow anomalies',
          pressureAnomalies: 'Pressure anomalies',
          thresholds: 'Limits',
          min: 'Min',
          max: 'Max',
          noThresholds: 'No limits configured for this metric',
        }
  ), [lang]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const formatDateTime = useCallback(
    (value?: string) => {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },
    [lang]
  );

  const formatNumber = (value?: number | null, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return Number(value).toFixed(digits);
  };

  const normalizeDateParam = (value: string) => {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  };

  const loadPoints = useCallback(async () => {
    setIsFetchingPoints(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/core/points/?limit=200`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const mapped: PointOption[] = results.map((p: any) => ({
        id: String(p.id),
        label: p.name || p.code || `#${p.id}`
      }));
      setPoints(mapped);
      if (!selectedPointId && mapped[0]) {
        setSelectedPointId(mapped[0].id);
      }
    } catch (e) {
      console.error('Failed to load points', e);
      setError(t.pointsLoadFailed || 'Failed to load points');
    } finally {
      setIsFetchingPoints(false);
    }
  }, [lang, selectedPointId, t.pointsLoadFailed]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  useEffect(() => {
    if (!selectedPointId) {
      setSelectedPointType([]);
      setIsPointTypeLoading(false);
      return;
    }
    let cancelled = false;
    const loadPointType = async () => {
      setIsPointTypeLoading(true);
      try {
        const res = await authFetch(`${API_BASE_URL}/core/points/${selectedPointId}/`, {
          headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw = (data as any)?.point_type;
        const normalized: string[] = Array.isArray(raw)
          ? raw.map((x: any) => String(x || '').toLowerCase()).filter(Boolean)
          : typeof raw === 'string'
            ? raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
            : [];
        if (!cancelled) setSelectedPointType(normalized);
      } catch (e) {
        console.error('Failed to fetch point type', e);
        if (!cancelled) setSelectedPointType([]);
      } finally {
        if (!cancelled) setIsPointTypeLoading(false);
      }
    };
    loadPointType();
    return () => { cancelled = true; };
  }, [selectedPointId, lang]);

  const { showFlow, showPressure } = useMemo(() => {
    const types = selectedPointType.map(t => String(t || '').toLowerCase());
    if (!types.length) return { showFlow: true, showPressure: true };
    return {
      showFlow: types.includes('flow'),
      showPressure: types.includes('pressure'),
    };
  }, [selectedPointType]);

  const fetchReport = async () => {
    if (!selectedPointId) {
      setError(t.selectPointPrompt);
      return;
    }
    setIsLoading(true);
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const params = new URLSearchParams();
      const fromIso = normalizeDateParam(dateFrom);
      const toIso = normalizeDateParam(dateTo);
      if (fromIso) params.append('date_from', fromIso);
      if (toIso) params.append('date_to', toIso);
      const url = `${API_BASE_URL}/api/points/${selectedPointId}/reading-report/${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await authFetch(url, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) {
        throw new Error(json?.detail || text || 'Failed to fetch report');
      }
      setReport(json);
    } catch (e) {
      console.error('Failed to load report', e);
      const msg = e instanceof Error ? e.message : (t.noReportData || 'Failed to load report');
      setError(msg);
      setReport(null);
    } finally {
      setIsLoading(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const sourceFlowUnit = useMemo(() => {
    const rows = [...(report?.chart || []), ...(report?.table || [])];
    for (const row of rows) {
      const unit = normalizeFlowUnit(row.unit_flow);
      if (unit) return unit;
    }
    return 'm3/h';
  }, [report]);

  const flowUnit = flowDisplayUnit;
  const pressureUnit = useMemo(() => report?.chart?.[0]?.unit_pressure || 'bar', [report]);
  const totalizerUnit = useMemo(
    () => report?.chart?.find(row => row.unit_totalizer)?.unit_totalizer || report?.table?.find(row => row.unit_totalizer)?.unit_totalizer || '',
    [report]
  );
  const flowUnitLabel = useMemo(() => localizeUnit(flowUnit, lang), [flowUnit, lang]);
  const pressureUnitLabel = useMemo(() => localizeUnit(pressureUnit, lang), [pressureUnit, lang]);
  const totalizerUnitLabel = useMemo(() => localizeUnit(totalizerUnit, lang), [totalizerUnit, lang]);

  const chartData = useMemo(() => {
    const sorted = [...(report?.chart || [])]
      .filter(item => item?.datetime && !Number.isNaN(Date.parse(item.datetime)))
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    const limited = sorted.slice(-200); // avoid overloading the chart
    return limited.map(item => ({
      ...item,
      flow: getDisplayFlowValue(item, flowDisplayUnit) ?? undefined,
      pressure: toNumberOrNull(item.pressure) ?? undefined,
      totalizer: toNumberOrNull(item.totalizer) ?? undefined,
      datetimeLabel: formatDateTime(item.datetime)
    }));
  }, [report, flowDisplayUnit, formatDateTime]);

  const monthlyData = useMemo(
    () => (report?.monthly_consumption || []).map(m => ({ ...m, value: Number(m.value) || 0 })),
    [report]
  );
  const tableRows = useMemo(() => {
    const rows = (report?.table || [])
      .filter(r => r?.datetime)
      .map(row => ({
        ...row,
        displayFlow: getDisplayFlowValue(row, flowDisplayUnit),
        displayPressure: toNumberOrNull(row.pressure),
      }));
    rows.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    return rows.slice(0, 300); // cap to keep UI responsive
  }, [report, flowDisplayUnit]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return tableRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, tableRows, PAGE_SIZE]);

  useEffect(() => {
    setPage(1);
  }, [report, flowDisplayUnit]);

  const tooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
    borderRadius: '8px',
    color: isDark ? '#f8fafc' : '#0f172a',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  };
  const tableHeadCellClass = `p-3 text-slate-500 dark:text-slate-300 ${isRTL ? 'text-right' : 'text-left'}`;

  const summary = report?.summary || {};
  const anomalies = summary.anomalies || {};
  const thresholds = summary.thresholds || report?.point?.thresholds || {};
  const flowThreshold: ReportThresholdRange = thresholds.flow || {};
  const pressureThreshold: ReportThresholdRange = thresholds.pressure || {};
  const avgFlowValue = convertFlowValue(toNumberOrNull(summary.avg_flow), sourceFlowUnit, flowDisplayUnit);
  const avgPressureValue = toNumberOrNull(summary.avg_pressure);

  const displayedFlowThreshold = {
    min: convertFlowValue(toNumberOrNull(flowThreshold.min), sourceFlowUnit, flowDisplayUnit),
    max: convertFlowValue(toNumberOrNull(flowThreshold.max), sourceFlowUnit, flowDisplayUnit),
  };

  const formatThresholdRange = (range: ReportThresholdRange, unit: string) => {
    const parts = [];
    if (range.min !== null && range.min !== undefined) {
      parts.push(`${reportText.min}: ${formatNumber(range.min)} ${unit}`);
    }
    if (range.max !== null && range.max !== undefined) {
      parts.push(`${reportText.max}: ${formatNumber(range.max)} ${unit}`);
    }
    return parts.length ? parts.join(' | ') : reportText.noThresholds;
  };

  const anomalyRows = [
    showFlow
      ? {
          key: 'flow',
          label: reportText.flowAnomalies,
          unit: flowUnitLabel,
          counts: anomalies.flow || {},
          range: displayedFlowThreshold,
        }
      : null,
    showPressure
      ? {
          key: 'pressure',
          label: reportText.pressureAnomalies,
          unit: pressureUnitLabel,
          counts: anomalies.pressure || {},
          range: pressureThreshold,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    unit: string;
    counts: ReportAnomalyBucket;
    range: ReportThresholdRange;
  }>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t.readingReportTitle}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.readingReportSubtitle}</p>
        </div>
        <button
          onClick={fetchReport}
          disabled={!selectedPointId || isLoading || isPointTypeLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${isLoading ? 'bg-slate-400' : 'bg-water-600 hover:bg-water-700'} transition-colors shadow-lg shadow-water-500/20 disabled:cursor-not-allowed`}
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          <span>{t.loadReport}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 flex items-center gap-2">
            <Activity size={14} /> {t.selectPointLabel}
          </label>
          <select
            value={selectedPointId}
            onChange={(e) => {
              setSelectedPointId(e.target.value);
              setReport(null);
              setError(null);
            }}
            disabled={isFetchingPoints}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
          >
            <option value="">{isFetchingPoints ? (t.processing || 'Loading...') : t.selectPointPrompt}</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          {selectedPointId && isPointTypeLoading && (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.processing || 'Loading...'}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 flex items-center gap-2">
            <CalendarRange size={14} /> {t.dateFromLabel}
          </label>
          <input
            type="datetime-local"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 flex items-center gap-2">
            <CalendarRange size={14} /> {t.dateToLabel}
          </label>
          <input
            type="datetime-local"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 flex items-center gap-2">
            <Droplet size={14} /> {reportText.flowUnit}
          </label>
          <div className="grid grid-cols-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1">
            {FLOW_DISPLAY_UNITS.map(unit => (
              <button
                key={unit}
                type="button"
                onClick={() => setFlowDisplayUnit(unit)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  flowDisplayUnit === unit
                    ? 'bg-water-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end">
          <button
            onClick={loadPoints}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            {t.refresh}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {!report && !isLoading && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center text-slate-500 dark:text-slate-300">
          {t.selectPointPrompt}
        </div>
      )}

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'total', label: t.totalReadings, value: summary.total_readings ?? '—', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              ...(showPressure ? [{ key: 'pressure', label: t.averagePressure, value: `${formatNumber(avgPressureValue)} ${pressureUnitLabel}`, icon: Gauge, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' }] : []),
              ...(showFlow ? [{ key: 'flow', label: t.avgFlowMetric, value: `${formatNumber(avgFlowValue)} ${flowUnitLabel}`, icon: Droplet, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' }] : []),
              { key: 'totalizer', label: t.totalizerDelta, value: formatNumber(summary.totalizer_delta), icon: BarChart2, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            ].map((metric, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${metric.bg}`}>
                    <metric.icon className={`w-5 h-5 ${metric.color}`} />
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{metric.label}</p>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{metric.value}</h3>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t.chartFlowPressureTitle}</h3>
                {report?.point && (
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {report.point.name || report.point.code}
                  </span>
                )}
              </div>
              <div className="h-80">
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                      <XAxis dataKey="datetimeLabel" tick={{ fontSize: 11 }} />
                      {showFlow && showPressure ? (
                        <>
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} orientation={isRTL ? 'right' : 'left'} />
                          <YAxis yAxisId="right" orientation={isRTL ? 'left' : 'right'} tick={{ fontSize: 11 }} />
                        </>
                      ) : (
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} orientation={isRTL ? 'right' : 'left'} />
                      )}
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      {showFlow && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="flow"
                          name={`${t.flowRate} (${flowUnitLabel})`}
                          stroke="var(--color-primary-500)"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      )}
                      {showPressure && (
                        <Line
                          yAxisId={showFlow && showPressure ? 'right' : 'left'}
                          type="monotone"
                          dataKey="pressure"
                          name={`${t.pressure} (${pressureUnitLabel})`}
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                    {t.noReportData}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{t.monthlyConsumption}</h3>
                <div className="h-64">
                  {monthlyData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} orientation={isRTL ? 'right' : 'left'} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" fill="var(--color-primary-500)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                      {t.noReportData}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">{t.anomaliesTitle}</h4>
                </div>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  {reportText.anomalySource}
                </p>
                <div className="space-y-4 text-sm">
                  {anomalyRows.length ? anomalyRows.map(row => (
                    <div key={row.key} className="border-t border-slate-200 dark:border-slate-700 pt-3 first:border-t-0 first:pt-0">
                      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="font-semibold text-slate-700 dark:text-slate-200">{row.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 sm:text-end">
                          {reportText.thresholds}: {formatThresholdRange(row.range, row.unit)}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{t.highAnomalies}</div>
                          <div className="text-lg font-bold text-amber-600">{row.counts.high ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{t.lowAnomalies}</div>
                          <div className="text-lg font-bold text-blue-600">{row.counts.low ?? 0}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{t.normalAnomalies}</div>
                          <div className="text-lg font-bold text-emerald-600">{row.counts.normal ?? 0}</div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-slate-500 dark:text-slate-400">{t.noReportData}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t.latestReadings}</h3>
              {(report?.date_from || report?.date_to) && (
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CalendarRange size={14} />
                  <span>{report?.date_from ? formatDateTime(report.date_from) : '...'} → {report?.date_to ? formatDateTime(report.date_to) : '...'}</span>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50">
                    <th className={tableHeadCellClass}>{t.date}</th>
                    {showFlow && (
                      <th className={tableHeadCellClass}>
                        <MetricHeader label={t.flowRate} unit={flowUnitLabel} />
                      </th>
                    )}
                    {showPressure && (
                      <th className={tableHeadCellClass}>
                        <MetricHeader label={t.pressure} unit={pressureUnitLabel} />
                      </th>
                    )}
                    <th className={tableHeadCellClass}>
                      <MetricHeader label={reportText.totalizer} unit={totalizerUnitLabel} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length ? paginatedRows.map((row, idx) => (
                    <tr key={row.id || `${row.datetime}-${idx}`} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 text-slate-700 dark:text-slate-300">{formatDateTime(row.datetime)}</td>
                      {showFlow && (
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {row.displayFlow != null ? <NumericText value={formatNumber(row.displayFlow)} /> : '—'}
                        </td>
                      )}
                      {showPressure && (
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {row.displayPressure != null ? <NumericText value={formatNumber(row.displayPressure)} /> : '—'}
                        </td>
                      )}
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {row.totalizer != null
                          ? (Number.isFinite(Number(row.totalizer))
                            ? <NumericText value={Number(row.totalizer).toLocaleString()} />
                            : String(row.totalizer))
                          : '—'}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={1 + (showFlow ? 1 : 0) + (showPressure ? 1 : 0) + 1} className="p-4 text-center text-slate-500 dark:text-slate-400">{t.noReportData}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tableRows.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 text-sm text-slate-600 dark:text-slate-300">
                <div>
                  {lang === 'ar'
                    ? `عرض ${paginatedRows.length} من ${tableRows.length}`
                    : `Showing ${paginatedRows.length} of ${tableRows.length}`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'السابق' : 'Prev'}
                  </button>
                  <span className="text-xs">
                    {lang === 'ar'
                      ? `صفحة ${currentPage} من ${totalPages}`
                      : `Page ${currentPage} of ${totalPages}`}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
