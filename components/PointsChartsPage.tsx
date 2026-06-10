import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Droplet,
  Gauge,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Language } from '../types';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

type PointGroupApiItem = {
  id?: number | string;
  point_name?: string;
  name?: string;
  type?: string[] | string;
  point_type?: string[] | string;
};

type PointGroup = {
  id: string;
  name: string;
  types: string[];
};

type ReadingApiItem = {
  id?: number | string;
  datetime?: string;
  flow?: string | number;
  pressure?: string | number;
  level?: string | number;
  totalizer?: string | number;
  unit?: string;
};

type SeriesReading = {
  datetime: string;
  value: number;
};

type ChartSeries = {
  id: string;
  pointId: string;
  pointName: string;
  type: string;
  color: string;
  unit: string;
  visible: boolean;
  loading: boolean;
  error: string | null;
  readings: SeriesReading[];
};

const SERIES_COLORS = [
  '#0ea5e9',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

const normalizeTypeList = (value: PointGroupApiItem['type']) => {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  }
  return [];
};

const getTypeMeta = (lang: Language, type: string) => {
  const normalized = String(type || '').trim().toLowerCase();

  if (normalized === 'flow') {
    return {
      label: lang === 'ar' ? 'التدفق' : 'Flow',
      Icon: Droplet,
      unit: 'm3/h',
      chipClass: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300',
      accentClass: 'from-cyan-500/20 to-sky-500/5',
    };
  }

  if (normalized === 'pressure') {
    return {
      label: lang === 'ar' ? 'الضغط' : 'Pressure',
      Icon: Gauge,
      unit: 'bar',
      chipClass: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      accentClass: 'from-amber-500/20 to-orange-500/5',
    };
  }

  if (normalized === 'level') {
    return {
      label: 'Level',
      Icon: Activity,
      unit: 'm',
      chipClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      accentClass: 'from-emerald-500/20 to-teal-500/5',
    };
  }

  if (normalized === 'totalizer') {
    return {
      label: 'Totalizer',
      Icon: Activity,
      unit: 'm3',
      chipClass: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
      accentClass: 'from-slate-400/20 to-slate-500/5',
    };
  }

  return {
    label: normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : (lang === 'ar' ? 'النوع' : 'Type'),
    Icon: Activity,
    unit: '',
    chipClass: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    accentClass: 'from-slate-400/20 to-slate-500/5',
  };
};

const formatDateInputValue = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: formatDateInputValue(firstDay),
    to: formatDateInputValue(lastDay),
  };
};

const getSeriesKey = (pointId: string, type: string) => `${pointId}:${type.toLowerCase()}`;

interface PointsChartsPageProps {
  lang: Language;
}

export const PointsChartsPage: React.FC<PointsChartsPageProps> = ({ lang }) => {
  const isRTL = lang === 'ar';
  const text = {
    explorerTitle: isRTL ? 'مستكشف النقاط' : 'Points Explorer',
    workspaceTitle: isRTL ? 'لوحة الرسم التفاعلية' : 'Interactive Chart Board',
    workspaceHint: isRTL
      ? 'اسحب النوع من مستكشف النقاط وأفلته داخل مساحة الرسم لإضافة منحنى جديد.'
      : 'Drag a point type from the explorer and drop it into the chart area to add a new trend.',
    refresh: isRTL ? 'تحديث' : 'Refresh',
    loading: isRTL ? 'جارٍ تحميل مجموعات النقاط...' : 'Loading point groups...',
    loadFailed: isRTL ? 'تعذر تحميل مجموعات النقاط.' : 'Failed to load point groups.',
    noPoints: isRTL ? 'لا توجد نقاط متاحة حالياً.' : 'No points available right now.',
    pointCount: isRTL ? 'عدد النقاط' : 'Points',
    streamReady: isRTL ? 'اسحب للإضافة' : 'Drag to chart',
    singleType: isRTL ? 'نوع' : 'type',
    multiType: isRTL ? 'أنواع' : 'types',
    dropHere: isRTL ? 'أفلت هنا لإضافة الرسم' : 'Drop here to add chart',
    emptyBoard: isRTL ? 'لم تتم إضافة أي منحنيات بعد.' : 'No chart traces added yet.',
    dateFromLabel: isRTL ? 'من تاريخ' : 'From',
    dateToLabel: isRTL ? 'إلى تاريخ' : 'To',
    invalidRange: isRTL ? 'تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.' : 'From date must be before or equal to To date.',
    activeTraces: isRTL ? 'المنحنيات النشطة' : 'Active Traces',
    clearAll: isRTL ? 'مسح الكل' : 'Clear All',
    flowAxis: isRTL ? 'محور التدفق' : 'Flow axis',
    pressureAxis: isRTL ? 'محور الضغط' : 'Pressure axis',
    chartError: isRTL ? 'تعذر تحميل الرسم.' : 'Failed to load chart.',
    duplicateTrace: isRTL ? 'هذا المنحنى موجود بالفعل.' : 'This trace is already added.',
    dragFromExplorer: isRTL ? 'اسحب من القائمة اليسرى لبدء الرسم.' : 'Drag from the left explorer to start charting.',
    noData: isRTL ? 'لا توجد قراءات لهذا الاختيار.' : 'No readings returned for this selection.',
    visible: isRTL ? 'إظهار' : 'Visible',
    hide: isRTL ? 'إخفاء' : 'Hide',
    remove: isRTL ? 'حذف' : 'Remove',
  };

  const [groups, setGroups] = useState<PointGroup[]>([]);
  const [expandedPointIds, setExpandedPointIds] = useState<string[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [dateFromValue, setDateFromValue] = useState<string>(() => getCurrentMonthRange().from);
  const [dateToValue, setDateToValue] = useState<string>(() => getCurrentMonthRange().to);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<ChartSeries[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);

  const tooltipStyle = {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '12px',
    color: '#e2e8f0',
    boxShadow: '0 10px 35px rgba(15, 23, 42, 0.26)',
  };
  const hasInvalidDateRange = Boolean(dateFromValue && dateToValue && dateFromValue > dateToValue);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));

    try {
      const res = await authFetch(`${API_BASE_URL}/api/Point_Group/`, {
        headers: { 'Accept-Language': isRTL ? 'ar' : 'en' },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const mergedGroups = new Map<string, PointGroup>();

      results.forEach((item: PointGroupApiItem, index: number) => {
        const fallbackName = isRTL ? `نقطة ${index + 1}` : `Point ${index + 1}`;
        const name = String(item?.point_name || item?.name || fallbackName).trim();
        const id = String(item?.id ?? name ?? `point-${index}`);
        const rawTypes = [...normalizeTypeList(item?.type), ...normalizeTypeList(item?.point_type)];
        const uniqueTypes = Array.from(new Set(rawTypes));
        const existing = mergedGroups.get(id);

        if (existing) {
          existing.types = Array.from(new Set([...existing.types, ...uniqueTypes]));
          return;
        }

        mergedGroups.set(id, {
          id,
          name,
          types: uniqueTypes,
        });
      });

      const nextGroups = Array.from(mergedGroups.values()).sort((a, b) => a.name.localeCompare(b.name));
      setGroups(nextGroups);

      if (!nextGroups.length) {
        setExpandedPointIds([]);
        setSelectedPointId('');
        setSelectedType('');
        return;
      }

      const stillExists = nextGroups.find(group => group.id === selectedPointId) || nextGroups[0];
      const nextType = stillExists.types.includes(selectedType) ? selectedType : (stillExists.types[0] || '');

      setSelectedPointId(stillExists.id);
      setSelectedType(nextType);
      setExpandedPointIds(prev => Array.from(new Set([...prev.filter(id => nextGroups.some(group => group.id === id)), stillExists.id])));
    } catch (err) {
      console.error('Failed to load point groups', err);
      setError(text.loadFailed);
      setGroups([]);
    } finally {
      setIsLoading(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const fetchSeriesData = async (pointId: string, pointName: string, type: string, keepColor?: string) => {
    const seriesId = getSeriesKey(pointId, type);
    const typeMeta = getTypeMeta(lang, type);

    if (hasInvalidDateRange) {
      setBoardMessage(text.invalidRange);
      return;
    }

    setSeries(current => {
      const existing = current.find(item => item.id === seriesId);
      const color = keepColor || existing?.color || SERIES_COLORS[current.length % SERIES_COLORS.length];

      if (existing) {
        return current.map(item =>
          item.id === seriesId
            ? { ...item, loading: true, error: null, visible: true }
            : item
        );
      }

      return [
        ...current,
        {
          id: seriesId,
          pointId,
          pointName,
          type,
          color,
          unit: typeMeta.unit,
          visible: true,
          loading: true,
          error: null,
          readings: [],
        },
      ];
    });

    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));

    try {
      const params = new URLSearchParams({
        point_id: pointId,
        type,
      });

      if (dateFromValue) {
        params.set('date_from', dateFromValue);
      }
      if (dateToValue) {
        params.set('date_to', dateToValue);
      }

      const res = await authFetch(`${API_BASE_URL}/api/Point_Group/?${params.toString()}`, {
        headers: { 'Accept-Language': isRTL ? 'ar' : 'en' },
      });

      const body = await res.text();
      const payload = body ? JSON.parse(body) : null;

      if (!res.ok) {
        throw new Error(payload?.detail || `HTTP ${res.status}`);
      }

      const rows = Array.isArray(payload?.readings) ? payload.readings : [];
      const readings = rows
        .map((item: ReadingApiItem) => {
          const rawValue =
            type === 'pressure'
              ? item?.pressure
              : type === 'level'
                ? item?.level
                : type === 'totalizer'
                  ? item?.totalizer
                  : item?.flow;
          const numericValue = Number(rawValue);
          if (!item?.datetime || Number.isNaN(numericValue)) return null;
          return {
            datetime: item.datetime,
            value: numericValue,
          };
        })
        .filter((item): item is SeriesReading => Boolean(item))
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

      setSeries(current =>
        current.map(item =>
          item.id === seriesId
            ? {
                ...item,
                loading: false,
                error: readings.length ? null : text.noData,
                readings,
                unit: rows.find((row: ReadingApiItem) => row?.unit)?.unit || typeMeta.unit,
              }
            : item
        )
      );
      setBoardMessage(null);
    } catch (err) {
      console.error('Failed to load chart series', err);
      const message = err instanceof Error ? err.message : text.chartError;
      setSeries(current =>
        current.map(item =>
          item.id === seriesId
            ? { ...item, loading: false, error: message, readings: [] }
            : item
        )
      );
    } finally {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  useEffect(() => {
    loadGroups();
  }, [lang]);

  useEffect(() => {
    if (!series.length) return;
    if (hasInvalidDateRange) {
      setBoardMessage(text.invalidRange);
      return;
    }
    series.forEach(item => {
      fetchSeriesData(item.pointId, item.pointName, item.type, item.color);
    });
  }, [dateFromValue, dateToValue]);

  const togglePoint = (group: PointGroup) => {
    setSelectedPointId(group.id);
    setSelectedType(current => (group.types.includes(current) ? current : (group.types[0] || '')));
    setExpandedPointIds(current =>
      current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id]
    );
  };

  const selectType = (group: PointGroup, type: string) => {
    setSelectedPointId(group.id);
    setSelectedType(type);
    setExpandedPointIds(current => (current.includes(group.id) ? current : [...current, group.id]));
  };

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, group: PointGroup, type: string) => {
    event.dataTransfer.setData('application/json', JSON.stringify({
      pointId: group.id,
      pointName: group.name,
      type,
    }));
    event.dataTransfer.effectAllowed = 'copy';
    setSelectedPointId(group.id);
    setSelectedType(type);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropActive(false);

    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as { pointId: string; pointName: string; type: string };
      const seriesId = getSeriesKey(payload.pointId, payload.type);
      const exists = series.some(item => item.id === seriesId);

      if (exists) {
        setBoardMessage(text.duplicateTrace);
        setSeries(current => current.map(item => item.id === seriesId ? { ...item, visible: true } : item));
        return;
      }

      await fetchSeriesData(payload.pointId, payload.pointName, payload.type);
    } catch (err) {
      console.error('Invalid drag payload', err);
    }
  };

  const toggleSeriesVisibility = (seriesId: string) => {
    setSeries(current => current.map(item => item.id === seriesId ? { ...item, visible: !item.visible } : item));
  };

  const removeSeries = (seriesId: string) => {
    setSeries(current => current.filter(item => item.id !== seriesId));
  };

  const mergedChartData = useMemo(() => {
    const merged = new Map<string, Record<string, string | number>>();

    series
      .filter(item => item.visible)
      .forEach(item => {
        item.readings.forEach(reading => {
          const row = merged.get(reading.datetime) || { datetime: reading.datetime };
          row[item.id] = reading.value;
          merged.set(reading.datetime, row);
        });
      });

    return Array.from(merged.values())
      .sort((a, b) => new Date(String(a.datetime)).getTime() - new Date(String(b.datetime)).getTime())
      .map(item => ({
        ...item,
        label: new Date(String(item.datetime)).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }));
  }, [lang, series]);

  const visibleSeries = series.filter(item => item.visible);
  const hasFlowSeries = visibleSeries.some(item => item.type === 'flow');
  const hasPressureSeries = visibleSeries.some(item => item.type === 'pressure');

  return (
    <div className="grid gap-6 xl:grid-cols-[340px,minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{text.explorerTitle}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{groups.length} {text.pointCount}</p>
          </div>
          <button
            type="button"
            onClick={loadGroups}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            {text.refresh}
          </button>
        </div>

        <div className="max-h-[78vh] space-y-3 overflow-auto p-4">
          {isLoading && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {text.loading}
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {!isLoading && !error && !groups.length && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {text.noPoints}
            </div>
          )}

          {!isLoading && !error && groups.map(group => {
            const isExpanded = expandedPointIds.includes(group.id);
            const isActiveGroup = selectedPointId === group.id;

            return (
              <div
                key={group.id}
                className={`overflow-hidden rounded-2xl border transition ${
                  isActiveGroup
                    ? 'border-cyan-300 bg-cyan-50/70 shadow-[0_16px_35px_rgba(8,145,178,0.12)] dark:border-cyan-800 dark:bg-cyan-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
                }`}
              >
                <button
                  type="button"
                  onClick={() => togglePoint(group)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-800">
                    <Activity size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{group.name}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {group.types.length} {group.types.length === 1 ? text.singleType : text.multiType}
                    </div>
                  </div>

                  <div className="text-slate-400">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-2 px-3 pb-3">
                    {group.types.map(type => {
                      const meta = getTypeMeta(lang, type);
                      const isActiveType = isActiveGroup && selectedType === type;

                      return (
                        <button
                          key={`${group.id}-${type}`}
                          type="button"
                          draggable
                          onDragStart={(event) => handleDragStart(event, group, type)}
                          onClick={() => selectType(group, type)}
                          className={`w-full cursor-grab rounded-2xl border bg-gradient-to-r px-3 py-3 text-left transition active:cursor-grabbing ${
                            isActiveType
                              ? `${meta.accentClass} border-slate-900/10 shadow-sm dark:border-white/10`
                              : 'border-slate-200 from-white to-slate-50 hover:border-slate-300 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${meta.chipClass}`}>
                              <meta.Icon size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">{meta.label}</div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{text.streamReady}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <section className="space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{text.workspaceTitle}</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{text.workspaceTitle}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{text.workspaceHint}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex min-w-[155px] flex-col gap-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                <span className="flex items-center gap-2">
                  <CalendarRange size={14} />
                  {text.dateFromLabel}
                </span>
                <input
                  type="date"
                  value={dateFromValue}
                  onChange={(event) => setDateFromValue(event.target.value)}
                  max={dateToValue || undefined}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex min-w-[155px] flex-col gap-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                <span className="flex items-center gap-2">
                  <CalendarRange size={14} />
                  {text.dateToLabel}
                </span>
                <input
                  type="date"
                  value={dateToValue}
                  onChange={(event) => setDateToValue(event.target.value)}
                  min={dateFromValue || undefined}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>

              <button
                type="button"
                onClick={() => setSeries([])}
                disabled={!series.length}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-red-950/30 dark:hover:text-red-300"
              >
                <Trash2 size={16} />
                {text.clearAll}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{text.activeTraces}</div>
              {boardMessage && <div className="text-xs font-semibold text-amber-600 dark:text-amber-300">{boardMessage}</div>}
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {series.length ? series.map(item => {
                const meta = getTypeMeta(lang, item.type);
                return (
                  <div
                    key={item.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span>{item.pointName}</span>
                    <span className={`rounded-full border px-2 py-0.5 ${meta.chipClass}`}>{meta.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleSeriesVisibility(item.id)}
                      className="rounded-full border border-transparent px-2 py-0.5 text-slate-500 transition hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    >
                      {item.visible ? text.hide : text.visible}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSeries(item.id)}
                      className="rounded-full border border-transparent p-1 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                      title={text.remove}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              }) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">{text.dragFromExplorer}</div>
              )}
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={handleDrop}
              className={`rounded-[28px] border-2 border-dashed p-5 transition ${
                dropActive
                  ? 'border-cyan-400 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-950/20'
                  : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/30'
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-white">{text.dropHere}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{text.workspaceHint}</div>
                </div>
                <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                  {hasPressureSeries && <span>{text.pressureAxis}</span>}
                  {hasFlowSeries && <span>{text.flowAxis}</span>}
                </div>
              </div>

              <div
                className="min-h-[460px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-950 p-4 text-white dark:border-slate-800"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px), radial-gradient(circle at top right, rgba(34,211,238,0.18), transparent 26%)',
                  backgroundSize: '28px 28px, 28px 28px, 100% 100%',
                }}
              >
                {visibleSeries.length ? (
                  <ResponsiveContainer width="100%" height={420}>
                    <LineChart data={mergedChartData} margin={{ top: 24, right: 24, left: 8, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#cbd5e1', fontSize: 11 }}
                        stroke="#475569"
                        minTickGap={32}
                      />
                      {hasPressureSeries && (
                        <YAxis
                          yAxisId="pressure"
                          tick={{ fill: '#f8fafc', fontSize: 11 }}
                          stroke="#f59e0b"
                          orientation={isRTL ? 'right' : 'left'}
                        />
                      )}
                      {hasFlowSeries && (
                        <YAxis
                          yAxisId="flow"
                          tick={{ fill: '#f8fafc', fontSize: 11 }}
                          stroke="#0ea5e9"
                          orientation={hasPressureSeries ? (isRTL ? 'left' : 'right') : (isRTL ? 'right' : 'left')}
                        />
                      )}
                      <Tooltip contentStyle={tooltipStyle} />
                      {visibleSeries.map(item => (
                        <Line
                          key={item.id}
                          yAxisId={item.type === 'pressure' ? 'pressure' : 'flow'}
                          type="monotone"
                          dataKey={item.id}
                          name={`${item.pointName} | ${getTypeMeta(lang, item.type).label}`}
                          stroke={item.color}
                          strokeWidth={2.4}
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-center text-slate-300">
                    <div className="rounded-full border border-white/10 bg-white/5 p-4">
                      <Activity size={26} />
                    </div>
                    <div className="text-lg font-bold">{text.emptyBoard}</div>
                    <div className="max-w-md text-sm text-slate-400">{text.dragFromExplorer}</div>
                  </div>
                )}
              </div>
            </div>

            {series.some(item => item.loading || item.error) && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {series.filter(item => item.loading || item.error).map(item => (
                  <div
                    key={`status-${item.id}`}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      item.error
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold">{item.pointName} | {getTypeMeta(lang, item.type).label}</div>
                    <div className="mt-1">{item.loading ? text.loading : item.error}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default PointsChartsPage;
