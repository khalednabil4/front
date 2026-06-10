import { Language } from '../../types';
import { authFetch } from '../../lib/auth';
import { CenterPoint, CentersMapResponse, PointsLastReadingResponse } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 12000;
const LOAD_CACHE_MS = 1000;
const EMPTY_READING_TEXT = '----';
const EMPTY_TYPED_READING = '......';

const readingOrder = [
  ['pressure', 'unit_pressure'],
  ['flow', 'unit_flow'],
  ['level', 'unit_level'],
  ['totalizer', 'unit_totalizer'],
] as const;

const POINT_TYPE_META = {
  flow: { key: 'flow', indicator: 'F', color: '#4f7cff', label: 'Flow' },
  pressure: { key: 'pressure', indicator: 'P', color: '#5c7ce6', label: 'Pressure' },
  level: { key: 'level', indicator: 'L', color: '#6a7df0', label: 'Level' },
  totalizer: { key: 'totalizer', indicator: 'T', color: '#5677ff', label: 'Totalizer' },
} as const;

type PointMetricKey = keyof typeof POINT_TYPE_META;
type ReadingMode = 'compact' | 'full';

const normalizePointType = (value?: string | null): PointMetricKey | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'flow') return 'flow';
  if (normalized === 'pressure' || normalized === 'press') return 'pressure';
  if (normalized === 'level') return 'level';
  if (normalized === 'totalizer' || normalized === 'tutalizer' || normalized === 'totaliser') return 'totalizer';
  return null;
};

const toMetricValue = (value?: number | null, unit?: string | null) => {
  if (value == null || Number.isNaN(value)) return null;
  const formatted = Number.isInteger(value) ? String(value) : Number(value).toFixed(Math.abs(value) >= 10 ? 1 : 2);
  return unit ? `${formatted} ${unit}` : formatted;
};

const readingUnitKeyByType: Record<PointMetricKey, keyof NonNullable<CenterPoint['reading']>> = {
  flow: 'unit_flow',
  pressure: 'unit_pressure',
  level: 'unit_level',
  totalizer: 'unit_totalizer',
};

const readingValueKeyByType: Record<PointMetricKey, keyof NonNullable<CenterPoint['reading']>> = {
  flow: 'flow',
  pressure: 'pressure',
  level: 'level',
  totalizer: 'totalizer',
};

interface LoadedMapPayload {
  map: CentersMapResponse;
  points: CenterPoint[];
  pointsByCenter: Map<number, CenterPoint[]>;
}

let activeLoadPromise: Promise<LoadedMapPayload> | null = null;
let activeLoadKey: string | null = null;
let cachedLoad: { key: string; timestamp: number; payload: LoadedMapPayload } | null = null;

export const PointGroupingService = {
  async load(lang: Language, options: { live?: boolean; force?: boolean } = {}) {
    const live = Boolean(options.live);
    const force = Boolean(options.force);
    const loadKey = `${lang}:${live ? 'live' : 'saved'}`;
    const now = Date.now();
    if (!force && cachedLoad && cachedLoad.key === loadKey && (now - cachedLoad.timestamp) < LOAD_CACHE_MS) {
      return cachedLoad.payload;
    }

    if (!force && activeLoadPromise && activeLoadKey === loadKey) {
      return activeLoadPromise;
    }

    activeLoadKey = loadKey;
    activeLoadPromise = (async () => {
    const headers = { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const pointsUrl = `${API_BASE_URL}/core/points-last-reading/${live ? '?live=1' : ''}`;

    try {
      const [mapResponse, pointsResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/core/centers-map/`, { headers, signal: controller.signal }),
        authFetch(pointsUrl, { headers, signal: controller.signal }),
      ]);

      const mapPayload = await mapResponse.json().catch(() => null);
      const pointsPayload = await pointsResponse.json().catch(() => null);

      if (!mapResponse.ok) {
        const message = mapPayload?.detail || mapPayload?.message || `${mapResponse.status} ${mapResponse.statusText}`.trim();
        throw new Error(message || 'Failed to load map.');
      }

      const validRegionIds = new Set(
        Array.isArray((mapPayload as CentersMapResponse | null)?.map?.regions)
          ? (mapPayload as CentersMapResponse).map.regions.map(region => region.id)
          : [],
      );

      const points = pointsResponse.ok && Array.isArray((pointsPayload as PointsLastReadingResponse | null)?.results)
        ? (pointsPayload as PointsLastReadingResponse).results.filter(
            point => point.center != null && validRegionIds.has(point.center),
          )
        : [];

      const payload: LoadedMapPayload = {
        map: mapPayload as CentersMapResponse,
        points,
        pointsByCenter: this.groupByCenter(points),
      };
      cachedLoad = {
        key: loadKey,
        timestamp: Date.now(),
        payload,
      };
      return payload;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Loading the monitoring map timed out.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      activeLoadPromise = null;
      activeLoadKey = null;
    }
    })();

    return activeLoadPromise;
  },

  groupByCenter(points: CenterPoint[]) {
    const grouped = new Map<number, CenterPoint[]>();
    points.forEach(point => {
      if (point.center == null) return;
      const current = grouped.get(point.center) || [];
      current.push(point);
      grouped.set(point.center, current);
    });

    grouped.forEach((centerPoints, centerId) => {
      grouped.set(
        centerId,
        [...centerPoints].sort((left, right) => {
          const activeDelta = Number(right.is_active) - Number(left.is_active);
          if (activeDelta !== 0) return activeDelta;
          return String(left.code || left.name).localeCompare(String(right.code || right.name));
        }),
      );
    });

    return grouped;
  },

  pointDisplayCode(point: CenterPoint) {
    const value = String(point.code || point.name || `P-${point.id}`).trim();
    return value || `P-${point.id}`;
  },

  pointMetricTypes(point: CenterPoint): PointMetricKey[] {
    const ordered: PointMetricKey[] = [];
    const seen = new Set<PointMetricKey>();
    const push = (pointType: string | null | undefined) => {
      const normalized = normalizePointType(pointType);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      ordered.push(normalized);
    };

    const declaredTypes = Array.isArray(point.point_type) ? point.point_type : [];
    declaredTypes.forEach(push);

    const reading = point.reading;
    if (reading) {
      (Object.keys(POINT_TYPE_META) as PointMetricKey[]).forEach(metricKey => {
        const value = reading[readingValueKeyByType[metricKey]];
        if (value != null && value !== '') {
          push(metricKey);
        }
      });
    }

    if (!ordered.length) {
      ordered.push(this.pointPrimaryType(point));
    }

    return ordered;
  },

  pointReadingEntries(point: CenterPoint, mode: ReadingMode = 'compact') {
    const reading = point.reading;
    const metricTypes = this.pointMetricTypes(point);
    if (!reading || reading.is_missing) {
      return metricTypes.map(metricKey => ({
        key: metricKey,
        compact: `${POINT_TYPE_META[metricKey].indicator}:${EMPTY_TYPED_READING}`,
        full: `${POINT_TYPE_META[metricKey].label}: ${EMPTY_TYPED_READING}`,
      }));
    }

    const entries = metricTypes
      .map(metricKey => {
        const value = reading[readingValueKeyByType[metricKey]];
        const unit = reading[readingUnitKeyByType[metricKey]];
        const compactValue = toMetricValue(value as number | null | undefined);
        const fullValue = toMetricValue(value as number | null | undefined, unit as string | null | undefined);
        if (!compactValue || !fullValue) {
          return {
            key: metricKey,
            compact: `${POINT_TYPE_META[metricKey].indicator}:${EMPTY_TYPED_READING}`,
            full: `${POINT_TYPE_META[metricKey].label}: ${EMPTY_TYPED_READING}`,
          };
        }
        return {
          key: metricKey,
          compact: `${POINT_TYPE_META[metricKey].indicator}:${compactValue}`,
          full: `${POINT_TYPE_META[metricKey].label}: ${fullValue}`,
        };
      })
      .filter(Boolean) as Array<{ key: PointMetricKey; compact: string; full: string }>;

    if (entries.length) return entries;

    for (const [valueKey, unitKey] of readingOrder) {
      const nextValue = toMetricValue(
        reading[valueKey as keyof typeof reading] as number | null | undefined,
        mode === 'full'
          ? (reading[unitKey as keyof typeof reading] as string | null | undefined)
          : undefined,
      );
      if (nextValue) {
        return [{ key: this.pointPrimaryType(point), compact: nextValue, full: nextValue }];
      }
    }

    return [];
  },

  pointHasReadableMetric(point: CenterPoint) {
    const declaredTypes = Array.isArray(point.point_type) ? point.point_type : [];
    return declaredTypes.length > 0 || this.pointReadingEntries(point).length > 0;
  },

  pointTooltip(point: CenterPoint) {
    const readingEntries = this.pointReadingEntries(point, 'full');
    const reading = readingEntries.length ? readingEntries.map(entry => entry.full).join(' | ') : EMPTY_READING_TEXT;
    const typeMeta = POINT_TYPE_META[this.pointPrimaryType(point)];
    const modbus = point.modbus;
    const modbusText = modbus?.is_configured
      ? ` | Modbus ${modbus.device_ip}:${modbus.port ?? 502} / slave ${modbus.slave_id ?? 1}${modbus.scheduled_mins ? ` / ${modbus.scheduled_mins} min` : ''}`
      : ' | Modbus not configured';
    return `${typeMeta.label}: ${point.name}${point.code ? ` (${point.code})` : ''} - ${reading}${modbusText}`;
  },

  pointPrimaryType(point: CenterPoint): PointMetricKey {
    const declaredTypes = Array.isArray(point.point_type) ? point.point_type : [];
    for (const pointType of declaredTypes) {
      const normalized = normalizePointType(pointType);
      if (normalized) return normalized;
    }

    const reading = point.reading;
    if (reading?.flow != null) return 'flow';
    if (reading?.pressure != null) return 'pressure';
    if (reading?.level != null) return 'level';
    if (reading?.totalizer != null) return 'totalizer';
    return 'flow';
  },

  pointTypeIndicator(point: CenterPoint) {
    const metricTypes = this.pointMetricTypes(point);
    if (metricTypes.length > 1) {
      return `${POINT_TYPE_META[metricTypes[0]].indicator}+`;
    }
    return POINT_TYPE_META[this.pointPrimaryType(point)].indicator;
  },

  pointTypeColor(point: CenterPoint) {
    return POINT_TYPE_META[this.pointPrimaryType(point)].color;
  },

  pointReading(point: CenterPoint) {
    const reading = point.reading;
    const readingEntries = this.pointReadingEntries(point, 'compact');
    if (readingEntries.length) {
      return readingEntries.map(entry => entry.compact).join(' | ');
    }
    if (!reading) return EMPTY_READING_TEXT;
    if (typeof reading.display === 'string' && reading.display.trim()) return reading.display.trim();
    if (reading.is_missing) return EMPTY_READING_TEXT;

    const primaryType = this.pointPrimaryType(point);
    const preferredReading = toMetricValue(
      reading[primaryType as keyof typeof reading] as number | null | undefined,
      reading[`unit_${primaryType}` as keyof typeof reading] as string | null | undefined,
    );
    if (preferredReading) return preferredReading;

    for (const [valueKey, unitKey] of readingOrder) {
      const nextValue = toMetricValue(
        reading[valueKey as keyof typeof reading] as number | null | undefined,
        reading[unitKey as keyof typeof reading] as string | null | undefined,
      );
      if (nextValue) return nextValue;
    }

    return EMPTY_READING_TEXT;
  },
};
