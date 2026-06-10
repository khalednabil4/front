import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  CircleAlert,
  Clock,
  Droplet,
  Gauge,
  Home,
  Map as MapIcon,
  Network,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Language } from '../types';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

type PointStateFilter = 'all' | 'working' | 'stopped';
type GroupTypeFilter = 'all' | 'dma' | 'dmz';

type LatestReading = {
  id: number;
  datetime: string | null;
  flow: number | null;
  pressure: number | null;
  level: number | null;
  totalizer: number | null;
  unit_flow: string | null;
  unit_pressure: string | null;
  unit_level: string | null;
  unit_totalizer: string | null;
  flow_status: string | null;
  pressure_status: string | null;
} | null;

type MonitoringPoint = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  error_number: number;
  point_type: string[];
  point_enter_type: string | null;
  lat: string | null;
  long: string | null;
  device_ip: string | null;
  latest_reading: LatestReading;
};

type MonitoringGroup = {
  id: number;
  type: 'dma' | 'dmz';
  name: string;
  code: string | null;
  status: string | null;
  company: { id: number | null; name: string | null };
  points: MonitoringPoint[];
  stats: MonitoringStats;
};

type MonitoringVillage = {
  id: number | null;
  map_key: string;
  name: string;
  is_unassigned: boolean;
  groups: MonitoringGroup[];
  stats: MonitoringStats;
};

type MonitoringCenter = {
  id: number | null;
  map_key: string;
  name: string;
  is_unassigned: boolean;
  villages: MonitoringVillage[];
  stats: MonitoringStats;
};

type MonitoringStats = {
  centers_count?: number;
  villages_count?: number;
  groups_count: number;
  points_count: number;
  active_points: number;
  inactive_points: number;
  last_updated?: string;
};

type MonitoringMapResponse = {
  summary: MonitoringStats;
  centers: MonitoringCenter[];
};

type MapPageProps = {
  lang: Language;
};

const labels = {
  title: 'Map',
  subtitle: 'DMA / DMZ Monitoring',
  centers: 'Centers',
  villages: 'Villages',
  groups: 'DMA / DMZ',
  points: 'Points',
  working: 'Working',
  stopped: 'Not working',
  pressure: 'Pressure',
  flow: 'Flow',
  level: 'Level',
  noReading: 'No reading',
  lastReading: 'Last reading',
  search: 'Search center, village, DMA, DMZ, point',
  all: 'All',
  refresh: 'Refresh',
  empty: 'No monitoring data',
  loadFailed: 'Could not load monitoring map',
};

const numberFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 2,
});

const normalizeText = (value: unknown) => String(value ?? '').toLowerCase();

const formatMetric = (value: number | string | null | undefined, unit?: string | null) => {
  if (value === null || value === undefined || value === '') return '--';
  const numeric = typeof value === 'number' ? value : Number(value);
  const rendered = Number.isFinite(numeric) ? numberFormatter.format(numeric) : String(value);
  return unit ? `${rendered} ${unit}` : rendered;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return labels.noReading;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return labels.noReading;
  return date.toLocaleString('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const emptyStats: MonitoringStats = {
  groups_count: 0,
  points_count: 0,
  active_points: 0,
  inactive_points: 0,
};

const statsFromGroups = (groups: MonitoringGroup[]): MonitoringStats => {
  return groups.reduce(
    (acc, group) => {
      acc.groups_count += 1;
      acc.points_count += group.points.length;
      acc.active_points += group.points.filter(point => point.is_active).length;
      acc.inactive_points += group.points.filter(point => !point.is_active).length;
      return acc;
    },
    { ...emptyStats }
  );
};

const pointMatchesState = (point: MonitoringPoint, filter: PointStateFilter) => {
  if (filter === 'working') return point.is_active;
  if (filter === 'stopped') return !point.is_active;
  return true;
};

const metricCard = (
  icon: React.ReactNode,
  label: string,
  value: number | string | null | undefined,
  unit?: string | null
) => (
  <div className="hm-monitor-metric">
    <span className="hm-monitor-metric__icon">{icon}</span>
    <span className="hm-monitor-metric__label">{label}</span>
    <span className="hm-monitor-metric__value">{formatMetric(value, unit)}</span>
  </div>
);

const normalizePointTypes = (point: MonitoringPoint) => {
  const rawTypes = Array.isArray(point.point_type) ? point.point_type : [];
  return rawTypes.map(pointType => String(pointType || '').toLowerCase());
};

const PointCard: React.FC<{ point: MonitoringPoint }> = ({ point }) => {
  const reading = point.latest_reading;
  const cardClass = point.is_active
    ? 'hm-monitor-point-card hm-monitor-point-card--active'
    : 'hm-monitor-point-card hm-monitor-point-card--inactive';
  const pointTypes = normalizePointTypes(point);
  const showPressure = pointTypes.length === 0 || pointTypes.includes('pressure');
  const showLevel = pointTypes.includes('level') && !pointTypes.includes('flow');
  const showFlow = pointTypes.length === 0 || pointTypes.includes('flow') || (!showLevel && !pointTypes.includes('pressure'));

  return (
    <article className={cardClass}>
      <div className="hm-monitor-point-card__pin" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-xs font-black text-slate-900 dark:text-white" title={point.name}>
            {point.name}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            {point.code && <span className="hm-monitor-chip">{point.code}</span>}
            {point.point_enter_type && <span className="hm-monitor-chip">{point.point_enter_type}</span>}
          </div>
        </div>
        <span className={`hm-monitor-state ${point.is_active ? 'hm-monitor-state--active' : 'hm-monitor-state--inactive'}`}>
          {point.is_active ? labels.working : labels.stopped}
        </span>
      </div>

      <div className="hm-monitor-point-card__metrics">
        {showPressure ? metricCard(<Gauge size={15} />, labels.pressure, reading?.pressure, reading?.unit_pressure || 'bar') : null}
        {showFlow ? metricCard(<Activity size={15} />, labels.flow, reading?.flow, reading?.unit_flow || 'm3/h') : null}
        {showLevel ? metricCard(<Droplet size={15} />, labels.level, reading?.level, reading?.unit_level || 'm') : null}
      </div>

      <div className="hm-monitor-point-card__footer">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <Clock size={13} />
          <span className="truncate">Last</span>
        </span>
        <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">
          {formatDateTime(reading?.datetime)}
        </span>
      </div>
    </article>
  );
};

export const MapPage: React.FC<MapPageProps> = ({ lang }) => {
  const [data, setData] = useState<MonitoringMapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [pointFilter, setPointFilter] = useState<PointStateFilter>('all');
  const [groupFilter, setGroupFilter] = useState<GroupTypeFilter>('all');

  const loadMap = async () => {
    setIsLoading(true);
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(`${API_BASE_URL}/core/monitoring-map/`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.detail || labels.loadFailed);
      }
      setData(payload as MonitoringMapResponse);
    } catch (err) {
      console.error('Failed to load monitoring map', err);
      setData(null);
      setError(labels.loadFailed);
    } finally {
      setIsLoading(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  useEffect(() => {
    loadMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const filteredCenters = useMemo(() => {
    const centers = data?.centers || [];
    const needle = normalizeText(query.trim());

    return centers
      .map(center => {
        const villages = center.villages
          .map(village => {
            const groups = village.groups
              .filter(group => groupFilter === 'all' || group.type === groupFilter)
              .map(group => {
                const groupText = normalizeText([
                  center.name,
                  village.name,
                  group.name,
                  group.code,
                  group.company?.name,
                  group.type,
                ].join(' '));
                const groupMatchesSearch = !needle || groupText.includes(needle);
                const points = group.points.filter(point => {
                  const pointText = normalizeText([
                    point.name,
                    point.code,
                    point.device_ip,
                    point.point_enter_type,
                    point.point_type?.join(' '),
                  ].join(' '));
                  return pointMatchesState(point, pointFilter) && (groupMatchesSearch || pointText.includes(needle));
                });

                if (!groupMatchesSearch && points.length === 0) return null;
                if (pointFilter !== 'all' && points.length === 0) return null;

                return {
                  ...group,
                  points,
                  stats: statsFromGroups([{ ...group, points }]),
                };
              })
              .filter(Boolean) as MonitoringGroup[];

            if (groups.length === 0) return null;
            return {
              ...village,
              groups,
              stats: statsFromGroups(groups),
            };
          })
          .filter(Boolean) as MonitoringVillage[];

        if (villages.length === 0) return null;
        return {
          ...center,
          villages,
          stats: villages.reduce(
            (acc, village) => {
              acc.groups_count += village.stats.groups_count;
              acc.points_count += village.stats.points_count;
              acc.active_points += village.stats.active_points;
              acc.inactive_points += village.stats.inactive_points;
              return acc;
            },
            { ...emptyStats }
          ),
        };
      })
      .filter(Boolean) as MonitoringCenter[];
  }, [data, groupFilter, pointFilter, query]);

  const visibleStats = useMemo(() => {
    return filteredCenters.reduce(
      (acc, center) => {
        acc.centers_count = (acc.centers_count || 0) + 1;
        acc.villages_count = (acc.villages_count || 0) + center.villages.length;
        acc.groups_count += center.stats.groups_count;
        acc.points_count += center.stats.points_count;
        acc.active_points += center.stats.active_points;
        acc.inactive_points += center.stats.inactive_points;
        return acc;
      },
      { ...emptyStats, centers_count: 0, villages_count: 0 }
    );
  }, [filteredCenters]);

  const summary = data?.summary || visibleStats;

  return (
    <div className="hm-monitor-page">
      <div className="hm-monitor-topbar">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-water-600 dark:text-water-300">
            <MapIcon size={19} />
            <span className="text-sm font-black uppercase tracking-[0.16em]">{labels.subtitle}</span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{labels.title}</h1>
        </div>
        <button
          type="button"
          onClick={loadMap}
          disabled={isLoading}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-water-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-water-700 disabled:opacity-60"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          {labels.refresh}
        </button>
      </div>

      <div className="hm-monitor-summary-row">
        <div className="hm-monitor-stat">
          <Building2 size={18} />
          <span>{labels.centers}</span>
          <strong>{summary.centers_count || visibleStats.centers_count || 0}</strong>
        </div>
        <div className="hm-monitor-stat">
          <Home size={18} />
          <span>{labels.villages}</span>
          <strong>{summary.villages_count || visibleStats.villages_count || 0}</strong>
        </div>
        <div className="hm-monitor-stat">
          <Network size={18} />
          <span>{labels.groups}</span>
          <strong>{summary.groups_count || 0}</strong>
        </div>
        <div className="hm-monitor-stat">
          <Activity size={18} />
          <span>{labels.working}</span>
          <strong>{summary.active_points || 0}</strong>
        </div>
        <div className="hm-monitor-stat hm-monitor-stat--alert">
          <CircleAlert size={18} />
          <span>{labels.stopped}</span>
          <strong>{summary.inactive_points || 0}</strong>
        </div>
      </div>

      <div className="hm-monitor-toolbar">
        <div className="relative min-w-[240px] max-w-xl flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={labels.search}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-water-500 focus:ring-2 focus:ring-water-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-water-900/40"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'working', 'stopped'] as PointStateFilter[]).map(filter => (
            <button
              key={filter}
              type="button"
              onClick={() => setPointFilter(filter)}
              className={`hm-monitor-filter ${pointFilter === filter ? 'hm-monitor-filter--selected' : ''}`}
            >
              {filter === 'all' ? labels.all : filter === 'working' ? labels.working : labels.stopped}
            </button>
          ))}
          {(['all', 'dma', 'dmz'] as GroupTypeFilter[]).map(filter => (
            <button
              key={`group-${filter}`}
              type="button"
              onClick={() => setGroupFilter(filter)}
              className={`hm-monitor-filter ${groupFilter === filter ? 'hm-monitor-filter--selected' : ''}`}
            >
              {filter === 'all' ? labels.groups : filter.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="hm-monitor-canvas">
        {filteredCenters.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400">
            {isLoading ? 'Loading...' : labels.empty}
          </div>
        ) : (
          filteredCenters.map(center => (
            <section key={center.map_key} className="hm-monitor-center">
              <div className="hm-monitor-center__head">
                <div className="hm-monitor-node hm-monitor-node--center">
                  <Building2 size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-slate-950 dark:text-white" title={center.name}>
                    {center.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>{center.stats.groups_count} {labels.groups}</span>
                    <span>{center.stats.points_count} {labels.points}</span>
                    <span className="text-water-700 dark:text-water-300">{center.stats.active_points} {labels.working}</span>
                    <span className="text-red-600 dark:text-red-300">{center.stats.inactive_points} {labels.stopped}</span>
                  </div>
                </div>
              </div>

              <div className="hm-monitor-village-stack">
                {center.villages.map(village => (
                  <section key={village.map_key} className="hm-monitor-village hm-monitor-village-map">
                    <div className="hm-monitor-village__head">
                      <div className="hm-monitor-node hm-monitor-node--village">
                        <Home size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-slate-800 dark:text-slate-100" title={village.name}>
                          {village.name}
                        </h3>
                        <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {village.stats.groups_count} {labels.groups} / {village.stats.points_count} {labels.points}
                        </div>
                      </div>
                    </div>

                    <div className="hm-monitor-group-stack">
                      {village.groups.map(group => (
                        <section key={`${group.type}-${group.id}`} className="hm-monitor-group hm-monitor-group-map">
                          <div className="hm-monitor-group__head">
                            <div className={`hm-monitor-group__type hm-monitor-group__type--${group.type}`}>
                              {group.type.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-black text-slate-900 dark:text-white" title={group.name}>
                                {group.name}
                              </h4>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {group.code && <span>{group.code}</span>}
                                {group.company?.name && <span>{group.company.name}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="hm-monitor-points-grid hm-monitor-points-map">
                            {group.points.length === 0 ? (
                              <div className="hm-monitor-empty-points">{labels.empty}</div>
                            ) : (
                              group.points.map(point => <PointCard key={point.id} point={point} />)
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default MapPage;
