import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Image as ImageIcon, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { DICTIONARY } from '../constants';
import { Language } from '../types';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');
const STATIONS_BASES = ['/api/stations/', '/core/stations/'];
const POINTS_BASES = ['/api/points/?page_size=1000', '/core/points/?page_size=1000'];
const PERFORMANCE_BASES = ['/core/station-performance/', '/api/station-performance/'];

type PointRec = { id: number; name?: string; code?: string; station?: number | null; svg_position?: Record<string, any> | null };
type StationRec = { id: number; name: string; dwg_file?: string | null; svg_file?: string | null; svg_file_url?: string | null; points?: number[]; points_data?: PointRec[] };
type FormState = { name: string; points: number[]; dwgFile: File | null };
type StationPerformancePoint = {
  point_id: number;
  point_name?: string | null;
  point_code?: string | null;
  point_enter_type?: string | null;
  last_reading_datetime?: string | null;
  last_flow_m3h?: number | null;
  last_flow_ls?: number | null;
  last_totalizer_m3?: number | null;
  last_pressure_bar?: number | null;
  cumulative_period_m3?: number | null;
  cumulative_daily_m3?: number | null;
};
type StationPerformanceSummary = {
  points_count?: number;
  instantaneous_flow_m3h_sum?: number | null;
  instantaneous_flow_ls_sum?: number | null;
  cumulative_period_m3_sum?: number | null;
  cumulative_daily_m3_sum?: number | null;
  last_pressure_bar_avg?: number | null;
};
type StationPerformanceRec = {
  station?: { id: number; name: string } | null;
  period?: {
    start_month?: string;
    end_month?: string;
    date_from?: string;
    date_to_exclusive?: string;
    days_count?: number;
  } | null;
  summary?: StationPerformanceSummary | null;
  points?: StationPerformancePoint[];
};

const parseJson = (text: string) => {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
};
const listPayload = (data: any) => (Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
const absoluteUrl = (value?: string | null) => (!value ? '' : /^https?:\/\//i.test(value) ? value : new URL(value, `${API_BASE_URL}/`).toString());
const pointLabel = (p: Partial<PointRec>) => p.name || p.code || `#${p.id ?? '?'}`;
const parsePos = (obj: any) => {
  const x = Number(obj?.x);
  const y = Number(obj?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};
const toNum = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const monthValue = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
const nowMonth = () => monthValue(new Date());
const normalizePoints = (items: any[]): PointRec[] =>
  items
    .map(item => {
      const id = toNum(item?.id);
      if (id == null) return null;
      const station = item?.station == null ? null : toNum(item.station);
      return {
        ...item,
        id,
        station,
      } as PointRec;
    })
    .filter(Boolean) as PointRec[];
const normalizeStations = (items: any[]): StationRec[] =>
  items
    .map(item => {
      const id = toNum(item?.id);
      if (id == null) return null;
      const pointIds = Array.isArray(item?.points) ? item.points.map((v: any) => toNum(v)).filter((v: number | null): v is number => v != null) : [];
      return {
        ...item,
        id,
        points: pointIds,
        points_data: normalizePoints(Array.isArray(item?.points_data) ? item.points_data : []),
      } as StationRec;
    })
    .filter(Boolean) as StationRec[];

export const StationsWorkbenchPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = DICTIONARY[lang];
  const markerIcon = useMemo(() => `${import.meta.env.BASE_URL}assets/icon.png`, []);
  const pointDrawIcon = useMemo(() => `${import.meta.env.BASE_URL}assets/point_draw.png`, []);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [stations, setStations] = useState<StationRec[]>([]);
  const [points, setPoints] = useState<PointRec[]>([]);
  const pointsById = useMemo(() => new Map(points.map(p => [p.id, p] as const)), [points]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<StationRec | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', points: [], dwgFile: null });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);

  const [viewerStationId, setViewerStationId] = useState<number | null>(null);
  const [viewerStation, setViewerStation] = useState<StationRec | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [isSavingPos, setIsSavingPos] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);
  const [svgSize, setSvgSize] = useState({ width: 1, height: 1 });
  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [stationPerformance, setStationPerformance] = useState<StationPerformanceRec | null>(null);
  const [performanceStartMonth, setPerformanceStartMonth] = useState<string>(() => nowMonth());
  const [performanceEndMonth, setPerformanceEndMonth] = useState<string>(() => nowMonth());
  const [waterBalance, setWaterBalance] = useState<{
    inputFlowLs: number;
    outputFlowLs: number;
    inputCumM3: number;
    outputCumM3: number;
    inputPoints: number;
    outputPoints: number;
  } | null>(null);
  const [isWaterBalanceModalOpen, setIsWaterBalanceModalOpen] = useState(false);

  const request = async (paths: string[], init: RequestInit = {}) => {
    let lastError = 'Request failed';
    for (const path of paths) {
      try {
        const res = await authFetch(`${API_BASE_URL}${path}`, init);
        const text = await res.text();
        const data = parseJson(text);
        if (res.ok) return data;
        lastError = `[${res.status}] ${path} -> ${data?.detail || data?.message || text || res.statusText}`;
      } catch (e: any) {
        lastError = `${path} -> ${e?.message || 'Network error'}`;
      }
    }
    throw new Error(lastError);
  };

  const loadStations = async () => {
    setIsLoading(true);
    setError(null);
    try { setStations(normalizeStations(listPayload(await request(STATIONS_BASES)))); }
    catch (e: any) { setError(e?.message || 'Failed to load stations'); setStations([]); }
    finally { setIsLoading(false); }
  };

  const loadPoints = async () => {
    try { setPoints(normalizePoints(listPayload(await request(POINTS_BASES)))); }
    catch { setPoints([]); }
  };

  const loadStationDetail = async (id: number) => {
    setViewerLoading(true);
    setViewerError(null);
    try {
      const data = await request(STATIONS_BASES.map(base => `${base}${id}/`));
      const parsed = normalizeStations([data])[0] || null;
      setViewerStation(parsed);
      const ids = Array.isArray(parsed?.points) ? parsed.points : [];
      if (selectedPointId == null || !ids.includes(selectedPointId)) setSelectedPointId(ids[0] ?? null);
    } catch (e: any) {
      setViewerError(e?.message || 'Failed to load station');
      setViewerStation(null);
    } finally {
      setViewerLoading(false);
    }
  };

  const loadStationPerformance = async (stationId: number, startMonth = performanceStartMonth, endMonth = performanceEndMonth) => {
    if (!startMonth || !endMonth) {
      setPerformanceError(lang === 'ar' ? 'حدد شهر البداية والنهاية' : 'Select start and end month');
      return;
    }
    if (startMonth > endMonth) {
      setPerformanceError(lang === 'ar' ? 'شهر البداية يجب أن يكون قبل شهر النهاية' : 'Start month must be before end month');
      return;
    }
    setIsPerformanceLoading(true);
    setPerformanceError(null);
    setWaterBalance(null);
    setIsWaterBalanceModalOpen(false);
    try {
      const params = new URLSearchParams({
        station_id: String(stationId),
        start_month: startMonth,
        end_month: endMonth,
      });
      const data = await request(PERFORMANCE_BASES.map(base => `${base}?${params.toString()}`));
      setStationPerformance({
        ...data,
        points: Array.isArray(data?.points) ? data.points : [],
      });
    } catch (e: any) {
      setPerformanceError(e?.message || (lang === 'ar' ? 'تعذر تحميل أداء المحطة' : 'Failed to load station performance'));
      setStationPerformance(null);
    } finally {
      setIsPerformanceLoading(false);
    }
  };

  const handlePerformanceStationClick = async () => {
    if (!viewerStation) return;
    setIsPerformanceOpen(true);
    await loadStationPerformance(viewerStation.id);
  };

  const handleCalculateWaterBalance = () => {
    const pointsList = stationPerformance?.points || [];
    let inputFlowLs = 0;
    let outputFlowLs = 0;
    let inputCumM3 = 0;
    let outputCumM3 = 0;
    let inputPoints = 0;
    let outputPoints = 0;

    for (const point of pointsList) {
      const enterType = String(point.point_enter_type || '').toLowerCase();
      const flowLs = Number(point.last_flow_ls);
      const cumulativeM3 = Number(point.cumulative_period_m3);
      if (enterType === 'input') {
        inputPoints += 1;
        if (Number.isFinite(flowLs)) inputFlowLs += flowLs;
        if (Number.isFinite(cumulativeM3)) inputCumM3 += cumulativeM3;
      } else if (enterType === 'output') {
        outputPoints += 1;
        if (Number.isFinite(flowLs)) outputFlowLs += flowLs;
        if (Number.isFinite(cumulativeM3)) outputCumM3 += cumulativeM3;
      }
    }

    setWaterBalance({
      inputFlowLs,
      outputFlowLs,
      inputCumM3,
      outputCumM3,
      inputPoints,
      outputPoints,
    });
    setIsWaterBalanceModalOpen(true);
  };

  useEffect(() => { loadStations(); loadPoints(); }, [lang]);
  useEffect(() => { if (viewerStationId != null) loadStationDetail(viewerStationId); }, [viewerStationId, lang]);
  useEffect(() => {
    setStationPerformance(null);
    setPerformanceError(null);
    setIsPerformanceOpen(false);
    setWaterBalance(null);
    setIsWaterBalanceModalOpen(false);
  }, [viewerStation?.id]);

  const filteredStations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(s => `${s.id} ${s.name || ''} ${(s.points || []).join(' ')}`.toLowerCase().includes(q));
  }, [search, stations]);

  const viewerSvgUrl = useMemo(() => absoluteUrl(viewerStation?.svg_file_url || viewerStation?.svg_file || ''), [viewerStation]);
  const markers = useMemo(
    () => (viewerStation?.points_data || []).map(p => ({ p, pos: parsePos(p.svg_position) })).filter(v => v.pos) as { p: PointRec; pos: { x: number; y: number } }[],
    [viewerStation]
  );
  const fixedDrawPoints = useMemo(() => {
    const items = Array.isArray(stationPerformance?.points) ? stationPerformance.points : [];
    return [0, 1, 2].map(index => items[index] || null);
  }, [stationPerformance]);
  const performanceByPoint = useMemo(() => {
    const map = new Map<number, StationPerformancePoint>();
    for (const point of stationPerformance?.points || []) {
      const id = Number(point?.point_id);
      if (Number.isFinite(id)) map.set(id, point);
    }
    return map;
  }, [stationPerformance]);
  const formatMetric = (value: unknown, maximumFractionDigits = 2) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return num.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', { maximumFractionDigits });
  };
  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US');
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', points: [], dwgFile: null }); setFormError(null); setIsFormOpen(true); };
  const openEdit = (s: StationRec) => { setEditing(s); setForm({ name: s.name || '', points: s.points || [], dwgFile: null }); setFormError(null); setIsFormOpen(true); };
  const closeForm = () => { setIsFormOpen(false); setEditing(null); setFormError(null); };

  const handlePointSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ids = Array.from(e.target.selectedOptions).map(opt => Number(opt.value)).filter(Number.isFinite);
    setForm(prev => ({ ...prev, points: ids }));
  };

  const removeFormPoint = (pointId: number) => setForm(prev => ({ ...prev, points: prev.points.filter(id => id !== pointId) }));
  const clearFormPoints = () => setForm(prev => ({ ...prev, points: [] }));

  const submitForm = async () => {
    const name = form.name.trim();
    if (!name) return setFormError('Station name is required');

    setIsSavingForm(true);
    setFormError(null);

    try {
      const uniquePoints = Array.from(new Set(form.points));

      if (!editing) {
        // 1) Create station with file only
        const fd = new FormData();
        fd.append('name', name);
        if (form.dwgFile) fd.append('dwg_file', form.dwgFile);

        const created = await request(STATIONS_BASES, { method: 'POST', body: fd });

        // 2) Optional second call for points
        if (created?.id && uniquePoints.length) {
          await request(STATIONS_BASES.map(base => `${base}${created.id}/`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points: uniquePoints }),
          });
        }
      } else {
        // update existing
        if (form.dwgFile) {
          const fd = new FormData();
          fd.append('name', name);
          fd.append('dwg_file', form.dwgFile);
          await request(STATIONS_BASES.map(base => `${base}${editing.id}/`), {
            method: 'PATCH',
            body: fd,
          });
        } else {
          await request(STATIONS_BASES.map(base => `${base}${editing.id}/`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, points: uniquePoints }),
          });
        }
      }

      closeForm();
      await Promise.all([loadStations(), loadPoints()]);
      if (viewerStationId != null) await loadStationDetail(viewerStationId);
    } catch (e: any) {
      setFormError(e?.message || 'Failed to save station');
    } finally {
      setIsSavingForm(false);
    }
  };

  const deleteStation = async (station: StationRec) => {
    const ok = window.confirm(
      lang === 'ar'
        ? `هل تريد حذف المحطة "${station.name}"؟`
        : `Delete station "${station.name}"?`
    );
    if (!ok) return;
    try {
      await request(STATIONS_BASES.map(base => `${base}${station.id}/`), { method: 'DELETE' });
      if (viewerStationId === station.id) {
        setViewerStationId(null);
        setViewerStation(null);
        setViewerError(null);
      }
      await loadStations();
    } catch (e: any) {
      setError(e?.message || (lang === 'ar' ? 'تعذر حذف المحطة' : 'Failed to delete station'));
    }
  };

  const associatePoint = async (pointId: number) => {
    if (!viewerStation) return false;
    const ids = Array.isArray(viewerStation.points) ? viewerStation.points : [];
    if (ids.includes(pointId)) return true;
    setIsAssociating(true);
    setViewerError(null);
    try {
      const nextPoints = Array.from(new Set([...ids, pointId]));
      await request(STATIONS_BASES.map(base => `${base}${viewerStation.id}/`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: nextPoints }),
      });
      await Promise.all([loadStations(), loadPoints(), loadStationDetail(viewerStation.id)]);
      return true;
    } catch (e: any) {
      setViewerError(e?.message || (lang === 'ar' ? 'تعذر ربط النقطة' : 'Failed to associate point'));
      return false;
    } finally {
      setIsAssociating(false);
    }
  };

  const associateSelectedPoint = async () => {
    if (selectedPointId == null) return false;
    return associatePoint(selectedPointId);
  };

  const disassociatePoint = async (pointId: number) => {
    if (!viewerStation) return false;
    const ids = Array.isArray(viewerStation.points) ? viewerStation.points : [];
    if (!ids.includes(pointId)) return true;

    const label = pointLabel(pointsById.get(pointId) || { id: pointId });
    const ok = window.confirm(
      lang === 'ar' ? `هل تريد حذف النقطة "${label}" من هذه المحطة؟` : `Remove point "${label}" from this station?`
    );
    if (!ok) return false;

    setIsAssociating(true);
    setViewerError(null);
    try {
      const nextPoints = ids.filter(id => id !== pointId);
      await request(STATIONS_BASES.map(base => `${base}${viewerStation.id}/`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: nextPoints }),
      });
      await Promise.all([loadStations(), loadPoints(), loadStationDetail(viewerStation.id)]);
      return true;
    } catch (e: any) {
      setViewerError(e?.message || (lang === 'ar' ? 'تعذر حذف النقطة' : 'Failed to remove point'));
      return false;
    } finally {
      setIsAssociating(false);
    }
  };

  const savePointPosition = async (pointId: number, x: number, y: number) => {
    if (!viewerStation) return;
    setIsSavingPos(true);
    setViewerError(null);
    try {
      await request(STATIONS_BASES.map(base => `${base}${viewerStation.id}/`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          point_positions: [
            {
              point_id: pointId,
              svg_position: { x, y },
            },
          ],
        }),
      });
      await Promise.all([loadStations(), loadPoints(), loadStationDetail(viewerStation.id)]);
    } catch (e: any) {
      setViewerError(e?.message || (lang === 'ar' ? 'تعذر حفظ الموضع' : 'Failed to save position'));
    } finally {
      setIsSavingPos(false);
    }
  };

  const placePointAtClientPosition = async (pointId: number, clientX: number, clientY: number) => {
    if (!viewerStation || !viewerSvgUrl) return;
    const img = imageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return;
    const associated = await associatePoint(pointId);
    if (!associated) return;
    setSelectedPointId(pointId);
    const x = Number(((relX / rect.width) * svgSize.width).toFixed(2));
    const y = Number(((relY / rect.height) * svgSize.height).toFixed(2));
    await savePointPosition(pointId, x, y);
  };

  const onSvgClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedPointId == null) {
      setViewerError(lang === 'ar' ? 'اختر نقطة أولاً' : 'Select a point first');
      return;
    }
    await placePointAtClientPosition(selectedPointId, e.clientX, e.clientY);
  };

  const onPointDragStart = (e: React.DragEvent<HTMLElement>, pointId: number) => {
    e.dataTransfer.setData('application/x-point-id', String(pointId));
    e.dataTransfer.setData('text/plain', String(pointId));
    e.dataTransfer.effectAllowed = 'move';
    setSelectedPointId(pointId);
  };

  const onSvgDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-point-id') || e.dataTransfer.getData('text/plain');
    const pointId = Number(raw);
    if (!Number.isFinite(pointId)) return;
    await placePointAtClientPosition(pointId, e.clientX, e.clientY);
  };

  const markerStyle = (pos: { x: number; y: number }) => ({
    left: `${Math.max(0, Math.min(100, (pos.x / svgSize.width) * 100))}%`,
    top: `${Math.max(0, Math.min(100, (pos.y / svgSize.height) * 100))}%`,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{lang === 'ar' ? 'إدارة المحطات' : 'Stations Management'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadStations(); loadPoints(); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"><RefreshCw size={16} />{t.refresh || 'Refresh'}</button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-water-600 text-white"><Plus size={16} />{t.addNew || 'Add New'}</button>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search || 'Search'} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm min-w-56" />
        </div>
      </div>
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-auto">
        <table className="w-full text-sm text-center">
          <thead className="bg-slate-50 dark:bg-slate-900/40"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">{t.name || 'Name'}</th><th className="px-4 py-3">DWG</th><th className="px-4 py-3">SVG</th><th className="px-4 py-3">{t.points || 'Points'}</th><th className="px-4 py-3">{t.tableActions || 'Actions'}</th></tr></thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-500">{t.processing || 'Loading...'}</td>
              </tr>
            ) : filteredStations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-500">{t.noRows || 'No rows'}</td>
              </tr>
            ) : (
              filteredStations.map(s => (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-4 py-3">{s.id}</td>
                  <td className="px-4 py-3">{s.name || '-'}</td>
                  <td className="px-4 py-3">
                    {s.dwg_file ? (
                      <a href={absoluteUrl(s.dwg_file)} target="_blank" rel="noopener noreferrer" className="text-water-600 hover:underline">.dwg</a>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {s.svg_file_url || s.svg_file ? (
                      <a href={absoluteUrl(s.svg_file_url || s.svg_file)} target="_blank" rel="noopener noreferrer" className="text-water-600 hover:underline">.svg</a>
                    ) : (
                      <span className="text-amber-600">{lang === 'ar' ? 'غير متاح' : 'Not generated'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{(s.points || []).length}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => { setViewerStationId(s.id); setViewerStation(null); setViewerError(null); }}
                        className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 inline-flex items-center gap-1"
                      >
                        <ImageIcon size={14} />{lang === 'ar' ? 'SVG' : 'SVG'}
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="px-3 py-1 rounded bg-water-600 text-white inline-flex items-center gap-1"
                      >
                        <Pencil size={14} />{t.edit || 'Edit'}
                      </button>
                      <button
                        onClick={() => deleteStation(s)}
                        className="px-3 py-1 rounded bg-red-100 text-red-700 inline-flex items-center gap-1"
                      >
                        <Trash2 size={14} />{t.delete || 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {editing ? (lang === 'ar' ? 'تعديل محطة' : 'Edit Station') : (lang === 'ar' ? 'إضافة محطة' : 'Create Station')}
              </h3>
              <button onClick={closeForm} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <label className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                <span className="font-semibold">{t.name || 'Name'} *</span>
                <input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                <span className="font-semibold">DWG File (.dwg)</span>
                <input
                  type="file"
                  accept=".dwg"
                  onChange={e => setForm(prev => ({ ...prev, dwgFile: e.target.files?.[0] || null }))}
                  className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                {editing?.dwg_file && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? 'الملف الحالي:' : 'Current file:'} {editing.dwg_file}
                  </span>
                )}
              </label>

              {editing && (
                <label className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{t.points || 'Points'}</span>
                    {form.points.length > 0 && (
                      <button
                        type="button"
                        onClick={clearFormPoints}
                        className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        {lang === 'ar' ? 'حذف الكل' : 'Clear'}
                      </button>
                    )}
                  </div>
                  <select
                    multiple
                    value={form.points.map(String)}
                    onChange={handlePointSelect}
                    className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 h-48"
                  >
                    {points.map(point => (
                      <option key={point.id} value={point.id}>
                        {pointLabel(point)} {point.station ? `(station ${point.station})` : ''}
                      </option>
                    ))}
                  </select>
                  {form.points.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {form.points.map(pointId => {
                        const point = pointsById.get(pointId) || { id: pointId };
                        return (
                          <span
                            key={`selected-point-${pointId}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
                          >
                            <span className="font-semibold">{pointLabel(point)}</span>
                            <button
                              type="button"
                              onClick={() => removeFormPoint(pointId)}
                              className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                              title={lang === 'ar' ? 'حذف النقطة' : 'Remove point'}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </label>
              )}

              {formError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
                  {formError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={closeForm}
                className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                disabled={isSavingForm}
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                onClick={submitForm}
                className="px-4 py-2 rounded bg-water-600 text-white disabled:opacity-60"
                disabled={isSavingForm}
              >
                {isSavingForm ? (t.processing || 'Saving...') : (t.save || 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewerStationId != null && (
        <div className="fixed inset-0 z-50 p-3 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setViewerStationId(null);
              setViewerStation(null);
              setViewerError(null);
              setStationPerformance(null);
              setPerformanceError(null);
              setIsPerformanceOpen(false);
              setIsWaterBalanceModalOpen(false);
            }}
          />
          <div className="relative z-10 mx-auto w-full h-full max-w-[95rem] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {lang === 'ar' ? 'عارض المحطة SVG' : 'Station SVG Viewer'} {viewerStation ? `- ${viewerStation.name}` : ''}
              </h3>
              <button
                onClick={() => {
                  setViewerStationId(null);
                  setViewerStation(null);
                  setViewerError(null);
                  setStationPerformance(null);
                  setPerformanceError(null);
                  setIsPerformanceOpen(false);
                  setIsWaterBalanceModalOpen(false);
                }}
                className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[24rem_1fr] gap-0 h-[calc(100%-4.2rem)]">
              <div className="border-r border-slate-200 dark:border-slate-800 p-4 space-y-4 overflow-auto">
                {viewerLoading && <div className="text-sm text-slate-500">{t.processing || 'Loading...'}</div>}
                {!viewerLoading && viewerStation && (
                  <>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-sm">
                      <div><span className="font-semibold">ID:</span> {viewerStation.id}</div>
                      <div><span className="font-semibold">{t.name || 'Name'}:</span> {viewerStation.name}</div>
                      <div><span className="font-semibold">SVG:</span> {viewerSvgUrl ? 'Available' : 'Missing'}</div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1">
                          <span>{lang === 'ar' ? 'من شهر' : 'Start month'}</span>
                          <input
                            type="month"
                            value={performanceStartMonth}
                            onChange={e => setPerformanceStartMonth(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </label>
                        <label className="text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1">
                          <span>{lang === 'ar' ? 'إلى شهر' : 'End month'}</span>
                          <input
                            type="month"
                            value={performanceEndMonth}
                            onChange={e => setPerformanceEndMonth(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handlePerformanceStationClick}
                        disabled={isPerformanceLoading}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-60"
                      >
                        <BarChart3 size={15} />
                        {isPerformanceLoading
                          ? (lang === 'ar' ? 'جارٍ التحميل...' : 'Loading...')
                          : 'Performance Station'}
                      </button>
                      {isPerformanceOpen && (
                        <div className="space-y-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Points</div>
                          <div className="space-y-2">
                            {fixedDrawPoints.map((point, index) => (
                              <div
                                key={`fixed-draw-point-${index}`}
                                className="flex items-center gap-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                              >
                                <img
                                  src={pointDrawIcon}
                                  alt={`draw-point-${index + 1}`}
                                  className="w-10 h-10 object-contain rounded"
                                />
                                <div className="min-w-0 text-xs text-slate-700 dark:text-slate-200">
                                  <div className="font-semibold truncate">
                                    {point?.point_name || point?.point_code || (point?.point_id != null ? `#${point.point_id}` : `${lang === 'ar' ? 'نقطة' : 'Point'} ${index + 1}`)}
                                  </div>
                                  <div>FL: {formatMetric(point?.last_flow_ls)} L/s</div>
                                  <div>TOT: {formatMetric(point?.last_totalizer_m3, 0)} m3</div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {stationPerformance?.summary && (
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                              <div>Σ Flow (L/s): {formatMetric(stationPerformance.summary.instantaneous_flow_ls_sum)}</div>
                              <div>Σ CUM: {formatMetric(stationPerformance.summary.cumulative_period_m3_sum, 0)}</div>
                              <div>Σ Daily CUM: {formatMetric(stationPerformance.summary.cumulative_daily_m3_sum, 2)}</div>
                              <div>AVG P: {formatMetric(stationPerformance.summary.last_pressure_bar_avg)} bar</div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleCalculateWaterBalance}
                            disabled={!stationPerformance || (stationPerformance.points || []).length === 0}
                            className="w-full px-2 py-2 rounded bg-emerald-600 text-white text-xs disabled:opacity-60"
                          >
                            {lang === 'ar' ? 'حساب الماء الداخل / الخارج' : 'Calculate Water Enter / Water Out'}
                          </button>

                          <div className="max-h-44 overflow-auto space-y-1 pr-1">
                            {(stationPerformance?.points || []).map(point => (
                              <div
                                key={`station-performance-point-${point.point_id}`}
                                className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs"
                              >
                                <div className="font-semibold">{point.point_name || point.point_code || `#${point.point_id}`}</div>
                                <div>{lang === 'ar' ? 'تاريخ آخر قراءة' : 'Last reading'}: {formatDateTime(point.last_reading_datetime)}</div>
                                <div>Flow: {formatMetric(point.last_flow_ls)} L/s</div>
                                <div>Pressure: {formatMetric(point.last_pressure_bar)} bar</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {performanceError && (
                        <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                          {performanceError}
                        </div>
                      )}
                    </div>

                    <label className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                      <span className="font-semibold">{lang === 'ar' ? 'النقطة المختارة' : 'Selected point'}</span>
                      <select
                        value={selectedPointId != null ? String(selectedPointId) : ''}
                        onChange={e => setSelectedPointId(e.target.value ? Number(e.target.value) : null)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">{lang === 'ar' ? 'اختر نقطة' : 'Select point'}</option>
                        {points.map(point => (
                          <option key={point.id} value={point.id}>
                            {pointLabel(point)} {point.station && point.station !== viewerStation.id ? `(station ${point.station})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      onClick={associateSelectedPoint}
                      disabled={isAssociating || selectedPointId == null}
                      className="w-full px-3 py-2 rounded bg-water-600 text-white disabled:opacity-60"
                    >
                      {isAssociating
                        ? (t.processing || 'Working...')
                        : (lang === 'ar' ? 'ربط النقطة بالمحطة' : 'Associate Point To Station')}
                    </button>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {lang === 'ar'
                        ? 'اسحب النقطة وأسقطها على SVG لتثبيت الأيقونة وحفظ الموضع، ويمكن سحب الأيقونة نفسها لتحريكها.'
                        : 'Drag a point and drop it on SVG to place it. You can also drag existing icons to move positions.'}
                    </div>

                    <div className="space-y-2">
                      <div className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                        {lang === 'ar' ? 'اسحب النقاط إلى SVG' : 'Drag Points To SVG'}
                      </div>
                      <div className="space-y-1 max-h-48 overflow-auto pr-1">
                        {points.map(point => (
                          <button
                            key={`drag-point-${point.id}`}
                            type="button"
                            draggable
                            onDragStart={e => onPointDragStart(e, point.id)}
                            onClick={() => setSelectedPointId(point.id)}
                            className={`w-full text-left px-3 py-2 rounded border text-xs ${
                              point.id === selectedPointId
                                ? 'border-water-500 bg-water-50 text-water-700 dark:bg-water-900/20'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                            title={lang === 'ar' ? 'اسحب وأسقط على صورة SVG' : 'Drag and drop onto SVG'}
                          >
                            <div className="font-semibold">{pointLabel(point)}</div>
                            {point.station ? <div>{`station ${point.station}`}</div> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                        {lang === 'ar' ? 'نقاط المحطة الحالية' : 'Current station points'}
                      </div>
                      <div className="space-y-1 max-h-72 overflow-auto pr-1">
                        {(viewerStation.points_data || []).length === 0 ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {lang === 'ar' ? 'لا توجد نقاط مرتبطة' : 'No associated points'}
                          </div>
	                        ) : (
	                          (viewerStation.points_data || []).map(point => {
	                            const pos = parsePos(point.svg_position);
	                            const active = point.id === selectedPointId;
	                            return (
	                              <div key={point.id} className="flex items-stretch gap-2">
	                                <button
	                                  type="button"
	                                  draggable
	                                  onDragStart={e => onPointDragStart(e, point.id)}
	                                  onClick={() => setSelectedPointId(point.id)}
	                                  className={`flex-1 text-left px-3 py-2 rounded border text-xs ${
	                                    active
	                                      ? 'border-water-500 bg-water-50 text-water-700 dark:bg-water-900/20'
	                                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
	                                  }`}
	                                >
	                                  <div className="font-semibold">{pointLabel(point)}</div>
	                                  <div>{pos ? `x:${pos.x} y:${pos.y}` : (lang === 'ar' ? 'بدون موضع' : 'No position')}</div>
	                                </button>
	                                <button
	                                  type="button"
	                                  onClick={e => {
	                                    e.stopPropagation();
	                                    disassociatePoint(point.id);
	                                  }}
	                                  disabled={isAssociating}
	                                  className="shrink-0 px-2 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
	                                  title={lang === 'ar' ? 'حذف النقطة من المحطة' : 'Remove point from station'}
	                                >
	                                  <Trash2 size={14} />
	                                </button>
	                              </div>
	                            );
	                          })
	                        )}
	                      </div>
	                    </div>
                  </>
                )}

                {viewerError && (
                  <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
                    {viewerError}
                  </div>
                )}
              </div>

              <div className="p-4 overflow-auto">
                {!viewerStation && !viewerLoading && (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    {lang === 'ar' ? 'تعذر تحميل المحطة' : 'Unable to load station'}
                  </div>
                )}
                {viewerStation && !viewerSvgUrl && (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    {lang === 'ar'
                      ? 'ملف SVG غير متوفر. ارفع DWG وانتظر التحويل التلقائي.'
                      : 'SVG file is not available. Upload DWG and wait for auto conversion.'}
                  </div>
                )}
                {viewerStation && viewerSvgUrl && (
                  <div
                    className="relative inline-block max-w-full"
                    onClick={onSvgClick}
                    onDragOver={e => e.preventDefault()}
                    onDrop={onSvgDrop}
                  >
                    <img
                      ref={imageRef}
                      src={viewerSvgUrl}
                      alt="Station SVG"
                      className="max-w-full h-auto border border-slate-200 dark:border-slate-700 rounded bg-white select-none cursor-crosshair"
                      onLoad={e => {
                        const img = e.currentTarget;
                        setSvgSize({
                          width: img.naturalWidth || img.clientWidth || 1,
                          height: img.naturalHeight || img.clientHeight || 1,
                        });
                      }}
                    />
                    {markers.map(({ p, pos }) => {
                      const pointPerformance = performanceByPoint.get(p.id);
                      const showReading = isPerformanceOpen && !!pointPerformance;
                      return (
                        <button
                          key={`marker-${p.id}`}
                          type="button"
                          draggable
                          onDragStart={e => onPointDragStart(e, p.id)}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedPointId(p.id);
                          }}
                          style={markerStyle(pos)}
                          className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
                          title={`${pointLabel(p)} (${pos.x}, ${pos.y})`}
                        >
                          {showReading && (
                            <div className="mb-1 px-2 py-1 rounded border border-slate-300 bg-white/95 text-[10px] leading-tight text-slate-800 shadow-sm whitespace-nowrap">
                              <div>FL: {formatMetric(pointPerformance.last_flow_ls)} L/s</div>
                              <div>TOT: {formatMetric(pointPerformance.last_totalizer_m3, 0)} m3</div>
                            </div>
                          )}
                          <img
                            src={markerIcon}
                            alt={pointLabel(p)}
                            className={`w-8 h-8 ${p.id === selectedPointId ? 'drop-shadow-[0_0_6px_rgba(14,165,233,0.8)]' : ''}`}
                          />
                        </button>
                      );
                    })}
                    {isSavingPos && (
                      <div className="absolute top-2 right-2 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs px-2 py-1 rounded">
                        {lang === 'ar' ? 'جارٍ الحفظ...' : 'Saving...'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {isWaterBalanceModalOpen && waterBalance && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setIsWaterBalanceModalOpen(false)}
                />
                <div className="relative w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">
                      {lang === 'ar' ? 'نتيجة الحساب حسب نوع النقطة' : 'Calculated by point_enter_type'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsWaterBalanceModalOpen(false)}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-sm space-y-2">
                    <div>{lang === 'ar' ? 'الداخل (input)' : 'Water Enter (input)'}: {formatMetric(waterBalance.inputFlowLs)} L/s | {lang === 'ar' ? 'نقاط' : 'Points'} {waterBalance.inputPoints}</div>
                    <div>{lang === 'ar' ? 'الخارج (output)' : 'Water Out (output)'}: {formatMetric(waterBalance.outputFlowLs)} L/s | {lang === 'ar' ? 'نقاط' : 'Points'} {waterBalance.outputPoints}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StationsWorkbenchPage;




