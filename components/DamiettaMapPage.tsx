import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { DICTIONARY } from '../constants';
import { Language, Sensor } from '../types';
import { authFetch } from '../lib/auth';
import { SensorModal } from './SensorModal';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
let leafletPromise: Promise<any> | null = null;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

const loadLeaflet = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Leaflet requires a browser'));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = () => resolve((window as any).L);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
  return leafletPromise;
};

interface DamiettaMapPageProps {
  lang: Language;
  onOpenSensor?: (sensor: Sensor) => void;
}

type PointFilter = 'active' | 'inactive';

type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isActive: boolean;
  kind: 'point' | 'valve';
  hasRealCoords: boolean;
  raw?: any;
};

const toFiniteNumber = (value: any): number | null => {
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
};

const pointIsActive = (pt: any): boolean => {
  if (typeof pt?.is_active === 'boolean') return pt.is_active;
  const err = Number(pt?.error_number ?? 0);
  if (Number.isFinite(err) && err >= 4) return false;
  const status = String(pt?.status ?? '').toLowerCase();
  if (
    status.includes('inactive') ||
    status.includes('disabled') ||
    status.includes('not active') ||
    status.includes('معطل')
  ) {
    return false;
  }
  if (status.includes('active') || status.includes('نشط')) return true;
  return true;
};

const fallbackCoordinateForPoint = (pt: any, index: number, area: { center: { lat: number; lng: number } }) => {
  const stableId = Number.parseInt(String(pt?.id ?? index + 1), 10);
  const seed = Number.isFinite(stableId) ? stableId : index + 1;
  const ring = Math.floor(index / 8);
  const angle = ((seed * 137.508) % 360) * (Math.PI / 180);
  const radius = 0.006 + (ring * 0.004) + ((seed % 5) * 0.00065);
  return {
    lat: area.center.lat + Math.sin(angle) * radius,
    lng: area.center.lng + Math.cos(angle) * radius,
  };
};

const createSensorFromMapPoint = (pt: MapPoint, lang: Language): Sensor => {
  const lineName = pt.raw?.point_from
    ? `${pt.raw.point_from} -> ${pt.raw.point_to || ''}`.trim()
    : lang === 'ar'
      ? 'نقطة'
      : 'Point';
  return {
    id: pt.id,
    name: pt.name,
    lineName,
    pressure: 0,
    status: pt.isActive ? 'normal' : 'warning',
    lastReadingCurrent: new Date().toISOString(),
    lastReadingPrevious: new Date(Date.now() - 3600_000).toISOString(),
    total3MCurrent: 0,
    total3MPrevious: 0,
    dailyConsumption: 0,
    history: [],
  };
};

export const DamiettaMapPage: React.FC<DamiettaMapPageProps> = ({ lang, onOpenSensor }) => {
  const t = DICTIONARY[lang];
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<any>(null);
  const initialViewSetRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [valves, setValves] = useState<MapPoint[]>([]);
  const [filter, setFilter] = useState<PointFilter>('active');
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [pointSummary, setPointSummary] = useState<any | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);

  const markerIconUrl = useMemo(() => `${import.meta.env.BASE_URL}assets/icon.png`, []);
  const valveIconUrl = useMemo(
    () => encodeURI(`${import.meta.env.BASE_URL}assets/water values.png`),
    []
  );

  const area = useMemo(() => {
    const center = { lat: 31.4178438, lng: 31.8161551 };
    const bounds = {
      southWest: { lat: 31.33, lng: 31.67 },
      northEast: { lat: 31.5, lng: 31.92 },
    };
    return { name: lang === 'ar' ? 'دمياط - مصر' : 'Damietta, Egypt', center, bounds };
  }, [lang]);

  const pointsInBounds = useMemo(() => {
    const allItems = [...points, ...valves];
    return allItems.filter((p) =>
      p.lat >= area.bounds.southWest.lat &&
      p.lat <= area.bounds.northEast.lat &&
      p.lng >= area.bounds.southWest.lng &&
      p.lng <= area.bounds.northEast.lng
    );
  }, [area.bounds, points, valves]);

  const visiblePoints = useMemo(() => {
    return pointsInBounds.filter(p => (filter === 'active' ? p.isActive : !p.isActive));
  }, [filter, pointsInBounds]);

  const visibleCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const p of pointsInBounds) {
      if (p.isActive) active += 1;
      else inactive += 1;
    }
    return { active, inactive };
  }, [pointsInBounds]);

  const inBoundsKinds = useMemo(() => {
    let pointsCount = 0;
    let valvesCount = 0;
    for (const p of pointsInBounds) {
      if (p.kind === 'valve') valvesCount += 1;
      else pointsCount += 1;
    }
    return { points: pointsCount, valves: valvesCount };
  }, [pointsInBounds]);

  const visibleKinds = useMemo(() => {
    let pointsCount = 0;
    let valvesCount = 0;
    for (const p of visiblePoints) {
      if (p.kind === 'valve') valvesCount += 1;
      else pointsCount += 1;
    }
    return { points: pointsCount, valves: valvesCount };
  }, [visiblePoints]);

  const fetchPoints = async () => {
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
      const res = await authFetch(`${API_BASE_URL}/core/points/`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.detail || data?.message || `${res.status} ${res.statusText}`.trim();
        setError(lang === 'ar' ? `تعذر تحميل النقاط: ${msg}` : `Failed to load points: ${msg}`);
        setPoints([]);
        return;
      }
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const mapped: MapPoint[] = items
        .map((pt: any, index: number) => {
          const lat = toFiniteNumber(pt?.lat ?? pt?.lan ?? pt?.latitude);
          const lng = toFiniteNumber(pt?.long ?? pt?.lon ?? pt?.lng ?? pt?.longitude);
          const hasRealCoords = lat !== null && lng !== null;
          const coords = hasRealCoords
            ? { lat: lat as number, lng: lng as number }
            : fallbackCoordinateForPoint(pt, index, area);
          return {
            id: String(pt?.id ?? ''),
            name: pt?.name || pt?.code || (lang === 'ar' ? 'نقطة' : 'Point'),
            lat: coords.lat,
            lng: coords.lng,
            isActive: pointIsActive(pt),
            kind: 'point',
            hasRealCoords,
            raw: pt,
          } satisfies MapPoint;
        })
        .filter(Boolean) as MapPoint[];
      setPoints(mapped);
      if (mapped.length && !mapped.some(point => point.isActive) && mapped.some(point => !point.isActive)) {
        setFilter('inactive');
      }
      setError(null);
    } catch (e) {
      console.error('Failed to load points', e);
      setError(lang === 'ar' ? 'تعذر تحميل النقاط من الخادم.' : 'Failed to load points from server.');
      setPoints([]);
    } finally {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const fetchValves = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/core/water-valves/`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        console.error('Failed to load water valves', res.status, res.statusText, data);
        setValves([]);
        return;
      }
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const mapped: MapPoint[] = items
        .map((valve: any) => {
          const latRaw = toFiniteNumber(valve?.latitude ?? valve?.lat);
          const lngRaw = toFiniteNumber(valve?.longitude ?? valve?.lng ?? valve?.long);
          if (latRaw === null || lngRaw === null) return null;

          const inBounds = (lat: number, lng: number) =>
            lat >= area.bounds.southWest.lat &&
            lat <= area.bounds.northEast.lat &&
            lng >= area.bounds.southWest.lng &&
            lng <= area.bounds.northEast.lng;

          const coords = inBounds(latRaw, lngRaw)
            ? { lat: latRaw, lng: lngRaw }
            : inBounds(lngRaw, latRaw)
              ? { lat: lngRaw, lng: latRaw }
              : { lat: latRaw, lng: lngRaw };

          return {
            id: `valve-${String(valve?.id ?? '')}`,
            name: valve?.name || 'Valve',
            lat: coords.lat,
            lng: coords.lng,
            isActive: Boolean(valve?.is_active),
            kind: 'valve',
            hasRealCoords: true,
            raw: valve,
          } satisfies MapPoint;
        })
        .filter(Boolean) as MapPoint[];
      setValves(mapped);
    } catch (e) {
      console.error('Failed to load water valves', e);
      setValves([]);
    }
  };

  const fetchPointSummary = async (pointId: string) => {
    if (!/^[0-9]+$/.test(String(pointId))) {
      setPointSummary(null);
      return;
    }
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

  const openSensorForPoint = (pt: MapPoint) => {
    const sensor = createSensorFromMapPoint(pt, lang);
    setSelectedSensor(sensor);
    setSelectedPoint(pt);
    setPointSummary(null);
    fetchPointSummary(pt.id);
    onOpenSensor?.(sensor);
  };

  const handleSelectMapItem = (pt: MapPoint) => {
    if (pt.kind === 'point') {
      openSensorForPoint(pt);
      return;
    }
    setSelectedPoint(pt);
    setSelectedSensor(null);
    setPointSummary(null);
  };

  const resetView = async () => {
    try {
      const L = await loadLeaflet();
      if (!mapRef.current) return;
      const bounds = L.latLngBounds(
        [area.bounds.southWest.lat, area.bounds.southWest.lng],
        [area.bounds.northEast.lat, area.bounds.northEast.lng]
      );
      initialViewSetRef.current = false;
      mapRef.current.fitBounds(bounds, { padding: [16, 16] });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const mount = async () => {
      setError(null);
      try {
        const L = await loadLeaflet();
        if (cancelled) return;
        if (!containerRef.current) return;

        const bounds = L.latLngBounds(
          [area.bounds.southWest.lat, area.bounds.southWest.lng],
          [area.bounds.northEast.lat, area.bounds.northEast.lng]
        );

        if (!mapRef.current) {
          mapRef.current = L.map(containerRef.current, {
            zoomControl: true,
            scrollWheelZoom: true,
            minZoom: 12,
          });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(mapRef.current);
        }

        if (layerRef.current) {
          layerRef.current.remove();
          layerRef.current = null;
        }

        const group = L.featureGroup();
        const rect = L.rectangle(bounds, {
          color: '#0ea5e9',
          weight: 2,
          fillColor: '#0ea5e9',
          fillOpacity: 0.12,
        });
        rect.bindPopup(
          `<div style="min-width: 180px">
            <div style="font-weight: 700; margin-bottom: 6px">${area.name}</div>
            <div style="font-size: 12px; color: #64748b">
              Center: ${area.center.lat.toFixed(4)}, ${area.center.lng.toFixed(4)}
            </div>
          </div>`
        );
        rect.addTo(group);

        const createPulseIcon = (pt: MapPoint) =>
          L.divIcon({
            className: '',
            html: `<div class="hm-map-marker ${pt.isActive ? 'hm-map-marker--active' : 'hm-map-marker--inactive'}">
              <span class="hm-map-marker__ring"></span>
              <span class="hm-map-marker__ring hm-map-marker__ring--two"></span>
              <span class="hm-map-marker__plate"></span>
              <img class="hm-map-marker__img" src="${pt.kind === 'valve' ? valveIconUrl : markerIconUrl}" alt="" />
            </div>`,
            iconSize: [52, 52],
            iconAnchor: [26, 26],
          });

        for (const pt of visiblePoints) {
          const m = L.marker([pt.lat, pt.lng], { icon: createPulseIcon(pt), riseOnHover: true });
          m.bindTooltip(pt.name, { permanent: false, direction: 'top', opacity: 0.95, interactive: false });
          if (pt.kind === 'valve') {
            m.bindPopup(
              `<div style="min-width: 180px">
                <div style="font-weight: 700; margin-bottom: 6px">${pt.name}</div>
                <div style="font-size: 12px; color: #64748b">Water valve</div>
                <div style="font-size: 12px; color: #64748b">Coords: ${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}</div>
              </div>`
            );
          } else if (!pt.hasRealCoords) {
            m.bindPopup(
              `<div style="min-width: 190px">
                <div style="font-weight: 700; margin-bottom: 6px">${pt.name}</div>
                <div style="font-size: 12px; color: #b45309">Estimated map position</div>
                <div style="font-size: 12px; color: #64748b">Set lat/long on the point to show exact location.</div>
              </div>`
            );
          }
          m.on('click', () => {
            try {
              const currentZoom = Number(mapRef.current?.getZoom?.() ?? 13);
              const nextZoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 16) : 16;
              mapRef.current?.flyTo?.([pt.lat, pt.lng], nextZoom, { animate: true, duration: 0.6 });
            } catch {
              // ignore zoom errors
            }
            handleSelectMapItem(pt);
            if (pt.kind === 'valve' || !pt.hasRealCoords) m.openPopup();
          });
          m.on('touchstart', () => handleSelectMapItem(pt));
          m.on('tap', () => handleSelectMapItem(pt));
          m.addTo(group);
        }

        group.addTo(mapRef.current);
        layerRef.current = group;

        mapRef.current.setMaxBounds(bounds.pad(0.02));
        mapRef.current.setMaxBoundsViscosity?.(1.0);
        if (!initialViewSetRef.current) {
          initialViewSetRef.current = true;
          mapRef.current.fitBounds(bounds, { padding: [16, 16] });
          mapRef.current.setView([area.center.lat, area.center.lng], 13, { animate: false });
          setTimeout(() => mapRef.current?.invalidateSize(), 60);
        }
      } catch (e) {
        console.error(e);
        setError(lang === 'ar' ? 'تعذر تحميل الخريطة.' : 'Failed to load map.');
      }
    };

    mount();
    return () => {
      cancelled = true;
    };
  }, [area, lang, visiblePoints]);

  useEffect(() => {
    fetchPoints();
    fetchValves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-water-600 dark:text-water-300">
              <MapPin size={18} />
              <p className="text-sm font-semibold uppercase tracking-wide">{(t as any)['damietta-map'] || 'Damietta'}</p>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{area.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {lang === 'ar'
                ? 'خريطة دمياط مع نقاط نشطة/غير نشطة وتأثيرات حركة.'
                : 'Damietta map with active/inactive points and animated markers.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
              <button
                type="button"
                onClick={() => setFilter('active')}
                className={`hm-map-filter-btn ${filter === 'active' ? 'hm-map-filter-btn--active' : ''}`}
              >
                <span className="hm-map-filter-btn__dot hm-map-filter-btn__dot--active" />
                {lang === 'ar' ? 'نشط' : 'Active'} ({visibleCounts.active})
              </button>
              <button
                type="button"
                onClick={() => setFilter('inactive')}
                className={`hm-map-filter-btn ${filter === 'inactive' ? 'hm-map-filter-btn--inactive' : ''}`}
              >
                <span className="hm-map-filter-btn__dot hm-map-filter-btn__dot--inactive" />
                {lang === 'ar' ? 'غير نشط' : 'Not active'} ({visibleCounts.inactive})
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchPoints();
                fetchValves();
                resetView();
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <RefreshCw size={16} />
              {t.refresh || 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div ref={containerRef} className="w-full h-[520px] bg-slate-100 dark:bg-slate-900" />
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {lang === 'ar' ? 'بيانات النقاط (API)' : 'Points (API)'}
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                <div className="text-xs text-slate-400">{lang === 'ar' ? 'نقاط بإحداثيات' : 'Points with coords'}</div>
                <div className="font-semibold text-slate-800 dark:text-slate-100">{points.length + valves.length}</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Points: {points.length} • Valves: {valves.length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                <div className="text-xs text-slate-400">{lang === 'ar' ? 'المعروض على الخريطة' : 'Visible on map'}</div>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  {visiblePoints.length} / {pointsInBounds.length}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Points: {visibleKinds.points}/{inBoundsKinds.points} • Valves: {visibleKinds.valves}/{inBoundsKinds.valves}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              {lang === 'ar'
                ? 'يتم عرض النقاط التي تحتوي على `lat` و `long` فقط (غير null).'
                : 'Only points that have `lat` and `long` (not null) are shown.'}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="text-xs text-slate-400">{lang === 'ar' ? 'قائمة النقاط' : 'Point list'}</div>
              <div className="mt-2 max-h-[260px] overflow-auto space-y-2 pr-1">
                {pointsInBounds.length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {points.length === 0
                      ? (lang === 'ar'
                          ? 'لا توجد نقاط بإحداثيات حالياً. تأكد أن `lat` و `long` ليست null في الاستجابة.'
                          : 'No points with coordinates yet. Ensure `lat` and `long` are not null in the response.')
                      : (lang === 'ar'
                          ? 'توجد نقاط بإحداثيات، لكن لا توجد نقاط داخل نطاق خريطة دمياط الحالية.'
                          : 'Points have coordinates, but none are inside the current Damietta map bounds.')}
                  </div>
                ) : (
                  pointsInBounds.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        try {
                          const currentZoom = Number(mapRef.current?.getZoom?.() ?? 13);
                          const nextZoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 16) : 16;
                          mapRef.current?.flyTo?.([pt.lat, pt.lng], nextZoom, { animate: true, duration: 0.6 });
                        } catch {
                          // ignore zoom errors
                        }
                        handleSelectMapItem(pt);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        selectedPoint?.id === pt.id
                          ? 'border-water-300 bg-water-50 dark:bg-water-900/20 dark:border-water-700'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {pt.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                            {pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}
                            {!pt.hasRealCoords ? ' (estimated)' : ''}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border ${
                            pt.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                          {pt.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedSensor && (
        <SensorModal
          sensor={selectedSensor}
          onClose={() => {
            setSelectedSensor(null);
            setPointSummary(null);
            setSelectedPoint(null);
          }}
          lang={lang}
          summary={pointSummary}
        />
      )}
    </div>
  );
};

export default DamiettaMapPage;
