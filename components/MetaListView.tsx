import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, Eye, Pencil, X, Upload, ShieldCheck, Trash2, Pin } from 'lucide-react';
import { AuthMetadata, Language } from '../types';
import { DICTIONARY } from '../constants';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');
const CENTER_DIRECTION_OPTIONS = ['auto', 'right', 'left', 'up', 'down', 'top-right', 'top-left', 'bottom-right', 'bottom-left'] as const;
const POINT_MODBUS_DEFAULTS: Record<string, number> = {
  PORT: 502,
  SLAVE_ID: 1,
  REGISTER_41003: 41003,
  REGISTER_41005: 41005,
  FLOW_LPS_REGISTER: 41007,
  FLOW_M3H_REGISTER: 41009,
  PRESSURE_BAR_REGISTER: 41011,
  TOTALIZER_REGISTER: 41013,
  scheduled_mins: 1,
};

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
let leafletPromise: Promise<any> | null = null;

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

interface MetaFilter {
  id: number;
  name: string;
  model_name: string;
  columns: string[];
  is_default: boolean;
  column_labels?: Record<string, string>;
  field_types?: Record<string, string>;
  field_required?: Record<string, boolean>;
  field_options?: Record<string, string[]>;
  field_option_labels?: Record<string, Record<string, string>>;
}

type EntityRecord = Record<string, any>;

export interface MetaListViewProps {
  lang: Language;
  title: string;
  description?: string;
  endpoint: string; // e.g., /core/companies
  modelName: string; // e.g., core.company
  detailTitle?: string;
  sessionMeta?: AuthMetadata | null;
}

const normalizeEndpoint = (endpoint: string) => {
  if (!endpoint.startsWith('/')) return `/${endpoint.replace(/^\/+/, '')}`;
  return endpoint;
};

export const MetaListView: React.FC<MetaListViewProps> = ({
  lang,
  title,
  description,
  endpoint,
  modelName,
  detailTitle,
  sessionMeta,
}) => {
  const t = DICTIONARY[lang];
  const currentLanguageCode = lang === 'ar' ? 'ar' : 'en';
  const [filters, setFilters] = useState<MetaFilter[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState<number | null>(null);
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<EntityRecord | null>(null);
  const [editingItem, setEditingItem] = useState<EntityRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number | string; label?: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createItem, setCreateItem] = useState<EntityRecord>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [dmaDmzSelection, setDmaDmzSelection] = useState<'dma' | 'dmz'>('dma');
  const [fkOptions, setFkOptions] = useState<Record<string, { id: any; label: string }[]>>({});
  const [fkLoading, setFkLoading] = useState<Record<string, boolean>>({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterColumns, setFilterColumns] = useState<string[]>([]);
  const [filterIsDefault, setFilterIsDefault] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isSavingFilter, setIsSavingFilter] = useState(false);
  const [readingModalRow, setReadingModalRow] = useState<EntityRecord | null>(null);
  const [readingFile, setReadingFile] = useState<File | null>(null);
  const [readingConsoleMsg, setReadingConsoleMsg] = useState<string>('');
  const [readingPayloadPreview, setReadingPayloadPreview] = useState<string>('');
  const [readingColumnSelections, setReadingColumnSelections] = useState<string[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [createMapError, setCreateMapError] = useState<string | null>(null);
  const [isFieldPermModalOpen, setIsFieldPermModalOpen] = useState(false);
  const [fieldPermField, setFieldPermField] = useState<string>('');
  const [fieldPermissions, setFieldPermissions] = useState<Record<string, string>>({});
  const [fieldPermLoading, setFieldPermLoading] = useState(false);
  const [fieldPermError, setFieldPermError] = useState<string | null>(null);
  const [fieldPermSavingGroup, setFieldPermSavingGroup] = useState<string | null>(null);
  const [fieldPermSuccess, setFieldPermSuccess] = useState<string | null>(null);
  const [fieldLabelEditor, setFieldLabelEditor] = useState<{ key: string; value: string } | null>(null);
  const [fieldLabelSaveError, setFieldLabelSaveError] = useState<string | null>(null);
  const [isFieldLabelSaving, setIsFieldLabelSaving] = useState(false);
  const [fieldLabelOverrides, setFieldLabelOverrides] = useState<Record<string, string>>({});
  const isSuperAdmin = Boolean(sessionMeta?.isSuperuser || sessionMeta?.isStaff);
  const canEditFieldLabels = Boolean(sessionMeta?.isSuperuser);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const createMapContainerRef = useRef<HTMLDivElement | null>(null);
  const createMapInstanceRef = useRef<any>(null);
  const createMarkerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const safeEndpoint = normalizeEndpoint(endpoint);
  const isCenterModel = modelName === 'core.center';
  const selectedFilter = useMemo(
    () => filters.find(f => f.id === selectedFilterId) || null,
    [filters, selectedFilterId]
  );
  const createFields = useMemo(() => selectedFilter?.columns || [], [selectedFilter]);
  const centerFormFieldOrder = useMemo(
    () => ['name', 'province', 'map_color', 'map_size', 'map_position', 'map_position_reference'],
    []
  );
  const visibleCreateFields = useMemo(() => {
    if (!isCenterModel) return createFields;
    return centerFormFieldOrder.filter(field => createFields.includes(field));
  }, [centerFormFieldOrder, createFields, isCenterModel]);
  const hasDmaAndDmzFields = useMemo(
    () => visibleCreateFields.includes('dma') && visibleCreateFields.includes('dmz'),
    [visibleCreateFields]
  );
  const fkFields = useMemo(
    () => visibleCreateFields.filter(col => (selectedFilter?.field_types?.[col] || '').toLowerCase().startsWith('fk')),
    [visibleCreateFields, selectedFilter]
  );
  const editFields = useMemo(() => {
    if (!editingItem) return [];
    const keys = Object.keys(editingItem);
    if (!isCenterModel) return keys;
    return centerFormFieldOrder.filter(field => keys.includes(field));
  }, [centerFormFieldOrder, editingItem, isCenterModel]);
  const latFieldKey = useMemo(() => {
    if (!editingItem) return null;
    const keys = editFields.length ? editFields : Object.keys(editingItem);
    const match = keys.find(k => {
      const lower = k.toLowerCase();
      return lower === 'latitude' || lower === 'lat';
    });
    return match || null;
  }, [editFields, editingItem]);
  const lngFieldKey = useMemo(() => {
    if (!editingItem) return null;
    const keys = Object.keys(editingItem);
    const match = keys.find(k => {
      const lower = k.toLowerCase();
      return lower === 'longitude' || lower === 'lng' || lower === 'lon' || lower === 'long';
    });
    return match || null;
  }, [editingItem]);
  const hasCoordinateFields = Boolean(editingItem && latFieldKey && lngFieldKey);
  const latValue = latFieldKey && editingItem ? editingItem[latFieldKey] : null;
  const lngValue = lngFieldKey && editingItem ? editingItem[lngFieldKey] : null;
  const createLatFieldKey = useMemo(() => {
    const keys = Object.keys(createItem || {});
    const match = keys.find(k => {
      const lower = k.toLowerCase();
      return lower === 'latitude' || lower === 'lat';
    });
    return match || null;
  }, [createItem]);
  const createLngFieldKey = useMemo(() => {
    const keys = Object.keys(createItem || {});
    const match = keys.find(k => {
      const lower = k.toLowerCase();
      return lower === 'longitude' || lower === 'lng' || lower === 'lon' || lower === 'long';
    });
    return match || null;
  }, [createItem]);
  const hasCreateCoordinateFields = Boolean(createLatFieldKey && createLngFieldKey);
  const createLatValue = createLatFieldKey ? createItem[createLatFieldKey] : null;
  const createLngValue = createLngFieldKey ? createItem[createLngFieldKey] : null;

  const fetchFilters = async (): Promise<MetaFilter[]> => {
    setError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/core/meta-filters/?model=${modelName}`, {
        headers: { 'Accept-Language': currentLanguageCode },
      });
      const data = await res.json();
      const results: MetaFilter[] = data?.results || [];
      setFilters(results);
      return results;
    } catch (e) {
      console.error(e);
      setError('Failed to load filters');
      return [];
    }
  };

  const isCompanyModel = modelName === 'core.company';

  const fetchItems = async (filterId?: number | null) => {
    setIsLoading(true);
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      if (isCompanyModel) {
        const res = await authFetch(`${API_BASE_URL}/core/my-company/`, {
          headers: { 'Accept-Language': currentLanguageCode },
        });
        const data = await res.json();
        const record = data?.company || data;
        setItems(record ? [record] : []);
        return;
      }
      const query = filterId ? `?filter_id=${filterId}` : '';
      const res = await authFetch(`${API_BASE_URL}${safeEndpoint}${query}`, {
        headers: { 'Accept-Language': currentLanguageCode },
      });
      const data = await res.json();
      setItems(data?.results || []);
      if ((filterId == null) && data?.filter_id && selectedFilterId == null) {
        setSelectedFilterId(data.filter_id);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load records');
    } finally {
      setIsLoading(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const fetchDetail = async (id: number) => {
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(`${API_BASE_URL}${safeEndpoint}${safeEndpoint.endsWith('/') ? '' : '/'}${id}/`, {
        headers: { 'Accept-Language': currentLanguageCode },
      });
      const data = await res.json();
      setDetailItem(data);
    } catch (e) {
      console.error(e);
      setError('Failed to load details');
    } finally {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const startEdit = async (id: number) => {
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(`${API_BASE_URL}${safeEndpoint}${safeEndpoint.endsWith('/') ? '' : '/'}${id}/`, {
        headers: { 'Accept-Language': currentLanguageCode },
      });
      const data = await res.json();
      setEditingItem(data);
    } catch (e) {
      console.error(e);
      setError('Failed to load record for edit');
    } finally {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const normalizeCenterEditPayload = (record: EntityRecord) => {
    const payload: Record<string, any> = {};
    editFields.forEach(key => {
      if (key === 'id') return;
      const value = record[key];
      const type = getFieldType(key).toLowerCase();

      if (key === 'map_position') {
        payload[key] = getCenterDirectionValue(value);
        return;
      }
      if (value === undefined) return;
      if (value === '' && type.startsWith('fk')) {
        payload[key] = null;
        return;
      }
      if (value === '' || value === null) return;
      if (type.startsWith('fk')) {
        payload[key] = isNaN(Number(value)) ? value : Number(value);
        return;
      }
      payload[key] = value;
    });
    return payload;
  };

  const saveEdit = async () => {
    if (!editingItem || editingItem.id == null) return;
    setIsSaving(true);
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const payload = isCenterModel ? normalizeCenterEditPayload(editingItem) : editingItem;
      const res = await authFetch(`${API_BASE_URL}${safeEndpoint}${safeEndpoint.endsWith('/') ? '' : '/'}${editingItem.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': currentLanguageCode },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      const data = (() => {
        try { return text ? JSON.parse(text) : null; } catch { return null; }
      })();
      if (!res.ok) {
        const detail = data?.detail || data?.message || text || 'Failed to save changes';
        throw new Error(detail);
      }
      setItems(prev => prev.map(c => (c.id === data.id ? data : c)));
      setEditingItem(null);
      setDetailItem(data);
      emitCentersMapRefresh();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const loadFieldPermissions = async (fieldName: string) => {
    if (!fieldName) {
      setFieldPermissions({});
      setFieldPermError(null);
      return;
    }
    setFieldPermLoading(true);
    setFieldPermError(null);
    setFieldPermSuccess(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/permissions/field/lookup?model=${encodeURIComponent(modelName)}&field_name=${encodeURIComponent(fieldName)}`,
        { headers: { 'Accept-Language': currentLanguageCode } }
      );
      const text = await res.text();
      let payload: any = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
      if (!res.ok) {
        const detail = payload?.detail || text || 'Failed to load field permissions';
        throw new Error(detail);
      }
      const nextPerms = payload || {};
      setFieldPermissions(nextPerms);
    } catch (e: any) {
      console.error('Failed to load field permissions', e);
      setFieldPermissions({});
      setFieldPermError(e?.message || t.fieldPermissionsLoadFailed || 'Failed to load field permissions');
    } finally {
      setFieldPermLoading(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const openFieldPermModal = (fieldFromTrigger?: string) => {
    if (!isSuperAdmin) return;
    const fallbackField =
      fieldFromTrigger ||
      fieldPermissionFields.find(f => f && f !== 'id') ||
      fieldPermissionFields[0] ||
      '';
    setFieldPermField(fallbackField || '');
    setIsFieldPermModalOpen(true);
    if (fallbackField) {
      loadFieldPermissions(fallbackField);
    } else {
      setFieldPermissions({});
    }
  };

  const closeFieldPermModal = () => {
    setIsFieldPermModalOpen(false);
    setFieldPermError(null);
    setFieldPermLoading(false);
    setFieldPermSuccess(null);
  };

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    const load = async () => {
      const fetchedFilters = await fetchFilters();
      const defaultFilter = fetchedFilters.find(f => f.is_default) || fetchedFilters[0] || null;
      const defaultFilterId = defaultFilter?.id ?? null;
      if (defaultFilterId !== null) setSelectedFilterId(defaultFilterId);
      await fetchItems(defaultFilterId);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFieldLabelOverrides({});
    setFieldLabelEditor(null);
    setFieldLabelSaveError(null);
    setIsFieldLabelSaving(false);
  }, [lang]);

  const hasHandledLanguageRefresh = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) return;
    if (!hasHandledLanguageRefresh.current) {
      hasHandledLanguageRefresh.current = true;
      return;
    }

    const reloadForLanguage = async () => {
      const fetchedFilters = await fetchFilters();
      const nextFilterId =
        selectedFilterId ??
        fetchedFilters.find(f => f.is_default)?.id ??
        fetchedFilters[0]?.id ??
        null;
      if (nextFilterId !== selectedFilterId) {
        setSelectedFilterId(nextFilterId);
      }
      await fetchItems(nextFilterId);
    };

    void reloadForLanguage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const resetFilterModal = () => {
    setFilterName('');
    setFilterColumns([]);
    setFilterIsDefault(false);
    setFilterError(null);
    setIsSavingFilter(false);
  };

  const createMetaFilter = async () => {
    if (!filterName.trim()) {
      setFilterError(t.validation_required || 'Name is required');
      return;
    }
    if (!filterColumns.length) {
      setFilterError(t.validation_required || 'Please choose at least one column');
      return;
    }
    setIsSavingFilter(true);
    setFilterError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(`${API_BASE_URL}/core/meta-filters/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': currentLanguageCode },
        body: JSON.stringify({
          name: filterName.trim(),
          content_type: modelName,
          columns: filterColumns,
          is_default: filterIsDefault,
        }),
      });
      const data = await res.json();
      const newId = data?.id ?? null;
      setFilters(prev => [...prev, data]);
      if (newId !== null) {
        setSelectedFilterId(newId);
        await fetchItems(newId);
      } else {
        await fetchItems(null);
      }
      setIsFilterModalOpen(false);
      resetFilterModal();
    } catch (e: any) {
      console.error(e);
      setFilterError(e?.message || 'Failed to create filter');
    } finally {
      setIsSavingFilter(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const readingColumnsForRow = (row: EntityRecord) => {
    const types = Array.isArray(row?.point_type) ? row.point_type.map((p: any) => String(p || '').toLowerCase()) : [];
    const hasFlow = types.includes('flow');
    const hasPressure = types.includes('pressure');
    if (hasFlow && hasPressure) return ['date', 'time', 'flow', 'pressure'];
    if (hasFlow) return ['date', 'time', 'flow'];
    return ['date', 'time', 'pressure'];
  };

  const readingColumnLabel = (col: string) => {
    switch (col) {
      case 'date':
        return t.date || 'Date';
      case 'time':
        return lang === 'ar' ? 'الوقت' : 'Time';
      case 'flow':
        return t.flowRate || 'Flow';
      case 'pressure':
        return t.pressure || 'Pressure';
      default:
        return col;
    }
  };

  const openReadingModal = (row: EntityRecord) => {
    if (isPointModel) {
      const pointId = row?.id;
      try {
        window.localStorage?.setItem('water-monitoring:selectedPointId', String(pointId ?? ''));
      } catch {
        /* ignore storage errors */
      }
      if (typeof window !== 'undefined') {
        const target = `/areas${pointId ? `?pointId=${encodeURIComponent(pointId)}` : ''}`;
        window.location.assign(target);
      }
      return;
    }
    setReadingModalRow(row);
    setReadingFile(null);
    setReadingConsoleMsg('');
    const cols = readingColumnsForRow(row);
    setReadingColumnSelections(cols);
  };

  const uploadReadings = () => {
    if (!readingModalRow) return;
    const cols = readingColumnsForRow(readingModalRow);
    const payload = {
      point_id: readingModalRow.id,
      point_type: readingModalRow.point_type,
      expected_columns: cols,
      mapped_columns: readingColumnSelections,
      file: readingFile ? { name: readingFile.name, size: readingFile.size, type: readingFile.type } : null,
      rows_preview: cols.map((c, idx) => ({ [c]: `value_${idx + 1}` })),
    };
    console.log('Reading upload payload', payload);
    setReadingConsoleMsg(lang === 'ar' ? 'تم تسجيل البيانات في الـ console' : 'Payload logged to console');
    setReadingPayloadPreview(JSON.stringify(payload, null, 2));
  };

  useEffect(() => {
    if (editingItem) return;
    setIsFieldPermModalOpen(false);
    setFieldPermError(null);
    setFieldPermLoading(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.off();
      mapInstanceRef.current.remove();
    }
    mapInstanceRef.current = null;
    markerRef.current = null;
    leafletRef.current = null;
    setMapError(null);
  }, [editingItem]);

  useEffect(() => {
    if (!isCreateOpen) {
      if (createMapInstanceRef.current) {
        createMapInstanceRef.current.off();
        createMapInstanceRef.current.remove();
      }
      createMapInstanceRef.current = null;
      createMarkerRef.current = null;
      setCreateMapError(null);
    }
  }, [isCreateOpen]);

  useEffect(() => {
    if (!editingItem || !hasCoordinateFields || !mapContainerRef.current) return;
    setMapError(null);
    const latNum = latFieldKey ? parseCoord(editingItem[latFieldKey]) : NaN;
    const lngNum = lngFieldKey ? parseCoord(editingItem[lngFieldKey]) : NaN;
    const hasValid = !Number.isNaN(latNum) && !Number.isNaN(lngNum);

    const mountMap = async () => {
      try {
        const L = await loadLeaflet();
        leafletRef.current = L;
        if (!mapContainerRef.current) return;
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapContainerRef.current).setView(
            hasValid ? [latNum, lngNum] : [0, 0],
            hasValid ? 12 : 2
          );
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(mapInstanceRef.current);
          mapInstanceRef.current.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            updateCoordsFromMap(lat, lng);
            placeMarker(lat, lng, false);
          });
          setTimeout(() => mapInstanceRef.current?.invalidateSize(), 60);
        } else {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.setView(
            hasValid ? [latNum, lngNum] : [0, 0],
            hasValid ? mapInstanceRef.current.getZoom() : 2
          );
        }
        if (hasValid) {
          placeMarker(latNum, lngNum, true);
        }
      } catch (e) {
        console.error(e);
        setMapError('Failed to load map tiles.');
      }
    };

    mountMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingItem, hasCoordinateFields, latFieldKey, lngFieldKey]);

  useEffect(() => {
    if (!hasCoordinateFields || !leafletRef.current || !mapInstanceRef.current) return;
    if (latValue === null || latValue === undefined || lngValue === null || lngValue === undefined) return;
    const latNum = parseCoord(latValue);
    const lngNum = parseCoord(lngValue);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return;
    placeMarker(latNum, lngNum, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latValue, lngValue, hasCoordinateFields]);

  useEffect(() => {
    if (!isCreateOpen || !hasCreateCoordinateFields || !createMapContainerRef.current) return;
    setCreateMapError(null);
    const latNum = createLatFieldKey ? parseCoord(createItem[createLatFieldKey]) : NaN;
    const lngNum = createLngFieldKey ? parseCoord(createItem[createLngFieldKey]) : NaN;
    const hasValid = !Number.isNaN(latNum) && !Number.isNaN(lngNum);

    const mountMap = async () => {
      try {
        const L = await loadLeaflet();
        leafletRef.current = L;
        if (!createMapContainerRef.current) return;
        if (!createMapInstanceRef.current) {
          createMapInstanceRef.current = L.map(createMapContainerRef.current).setView(
            hasValid ? [latNum, lngNum] : [0, 0],
            hasValid ? 12 : 2
          );
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(createMapInstanceRef.current);
          createMapInstanceRef.current.on('click', (e: any) => {
            const { lat, lng } = e.latlng;
            updateCreateCoordsFromMap(lat, lng);
            placeCreateMarker(lat, lng, false);
          });
          setTimeout(() => createMapInstanceRef.current?.invalidateSize(), 60);
        } else {
          createMapInstanceRef.current.invalidateSize();
          createMapInstanceRef.current.setView(
            hasValid ? [latNum, lngNum] : [0, 0],
            hasValid ? createMapInstanceRef.current.getZoom() : 2
          );
        }
        if (hasValid) {
          placeCreateMarker(latNum, lngNum, true);
        }
      } catch (e) {
        console.error(e);
        setCreateMapError('Failed to load map tiles.');
      }
    };

    mountMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateOpen, hasCreateCoordinateFields, createLatFieldKey, createLngFieldKey, createItem]);

  useEffect(() => {
    if (!isCreateOpen || !hasCreateCoordinateFields || !leafletRef.current || !createMapInstanceRef.current) return;
    if (createLatValue === null || createLatValue === undefined || createLngValue === null || createLngValue === undefined) return;
    const latNum = parseCoord(createLatValue);
    const lngNum = parseCoord(createLngValue);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return;
    placeCreateMarker(latNum, lngNum, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createLatValue, createLngValue, isCreateOpen, hasCreateCoordinateFields]);

  const columns = useMemo(() => {
    const baseCols = selectedFilterId ? (filters.find(f => f.id === selectedFilterId)?.columns || []) : [];
    const dynamicCols = new Set<string>(baseCols);
    items.forEach(row => Object.keys(row || {}).forEach(k => dynamicCols.add(k)));
    const ordered = Array.from(dynamicCols);
    ordered.sort((a, b) => {
      if (a === 'id') return -1;
      if (b === 'id') return 1;
      const indexA = baseCols.indexOf(a);
      const indexB = baseCols.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    return ordered;
  }, [items, filters, selectedFilterId]);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(c =>
      Object.values(c).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [items, search]);

  const availableColumns = useMemo(() => columns, [columns]);
  const fieldPermissionFields = useMemo(() => {
    if (selectedFilter?.columns?.length) return selectedFilter.columns;
    const firstWithColumns = filters.find(f => f.columns?.length);
    if (firstWithColumns?.columns?.length) return firstWithColumns.columns;
    return availableColumns;
  }, [selectedFilter, filters, availableColumns]);
  const isPointModel = modelName === 'core.point';
  const tableColumnCount = columns.length + (isPointModel ? 2 : 1);

  const getColumnLabel = (col: string) => {
    if (fieldLabelOverrides[col]) return fieldLabelOverrides[col];
    if (selectedFilter?.column_labels?.[col]) return selectedFilter.column_labels[col];
    const fallback = filters.find(f => f.column_labels?.[col]);
    return fallback?.column_labels?.[col] || col;
  };

  const getFieldType = (key: string) => selectedFilter?.field_types?.[key] || 'charfield';
  const isNumericFieldType = (type: string) => {
    const t = String(type || '').toLowerCase();
    return ['integerfield', 'positiveintegerfield', 'bigautofield', 'decimalfield', 'floatfield'].includes(t);
  };

  const deleteRecord = async (id: number | string) => {
    if (id === null || id === undefined || id === '') return;
    setError(null);
    setDeletingId(id);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const url = `${API_BASE_URL}${safeEndpoint}${safeEndpoint.endsWith('/') ? '' : '/'}${encodeURIComponent(String(id))}/`;
      const res = await authFetch(url, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        let payload: any = null;
        try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
        const detail = payload?.detail || payload?.message || text || 'Failed to delete record';
        throw new Error(detail);
      }
      const idStr = String(id);
      setItems(prev => prev.filter(item => String(item?.id) !== idStr));
      if (detailItem && String(detailItem.id) === idStr) setDetailItem(null);
      if (editingItem && String(editingItem.id) === idStr) setEditingItem(null);
      setDeleteTarget(null);
      emitCentersMapRefresh();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete record');
    } finally {
      setDeletingId(null);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };
  const isBooleanFieldType = (type: string) => {
    const t = String(type || '').toLowerCase();
    return t === 'booleanfield' || t === 'nullbooleanfield' || t === 'bool' || t === 'boolean';
  };
  const isJsonFieldType = (type: string) => String(type || '').toLowerCase() === 'jsonfield';
  const isColorField = (key: string) => key.toLowerCase().includes('color');
  const formatJsonValue = (value: any) => {
    if (typeof value === 'string') return value;
    if (value === undefined || value === null) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };
  const parseJsonValue = (value: string) => {
    if (!value.trim()) return {};
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  const validColorValue = (value: any) => {
    const color = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(color) || /^#[0-9a-f]{3}$/i.test(color)) return color;
    return '#0ea5e9';
  };
  const isFieldRequired = (key: string) => Boolean(selectedFilter?.field_required?.[key]);
  const getFieldOptions = (key: string) => selectedFilter?.field_options?.[key] || [];
  const getFieldOptionLabel = (key: string, value: any) => {
    const raw = String(value ?? '');
    return selectedFilter?.field_option_labels?.[key]?.[raw] || raw;
  };
  const normalizeChoiceArray = (value: any): string[] => {
    if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
    if (value === null || value === undefined || value === '') return [];
    return [String(value)];
  };
  const isMultiOptionField = (key: string, type: string, options: string[]) => {
    const normalized = String(type || '').toLowerCase();
    return options.length > 0 && (key === 'point_type' || normalized === 'jsonfield' || normalized.startsWith('m2m'));
  };
  const getCenterDirectionValue = (value: any) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && typeof value.direction === 'string') return value.direction;
    return '';
  };
  const emitCentersMapRefresh = () => {
    if (!isCenterModel || typeof window === 'undefined') return;
    window.dispatchEvent(new Event('centers-map:refresh'));
  };
  const buildFkEndpoint = (key: string) => {
    const lowerKey = key.toLowerCase();
    // Special-case DMA/DMZ so each field pulls from its own source
    if (lowerKey === 'dma') return `${API_BASE_URL}/core/dma/`;
    if (lowerKey === 'dmz') return `${API_BASE_URL}/core/dmz/`;

    const type = getFieldType(key);
    const lower = type.toLowerCase();
    if (lower.startsWith('fk')) {
      const label = type.replace(/^fk[-\s_]*/i, '').trim();
      const slug = label.replace(/[\s_]+/g, '-').toLowerCase();
      return `${API_BASE_URL}/core/${slug}/`;
    }
    const hyphen = key.replace(/_/g, '-');
    return `${API_BASE_URL}/core/${hyphen}/`;
  };

  const fetchFkOptions = async (key: string) => {
    if (!key) return;
    setFkLoading(prev => ({ ...prev, [key]: true }));
    try {
      const url = buildFkEndpoint(key);
      const res = await authFetch(url, {
        headers: { 'Accept-Language': currentLanguageCode },
      });
      const data = await res.json();
      const list = (data?.results || data || []).map((item: any) => {
        const label = item?.name || item?.title || item?.label || item?.code || item?.slug || String(item?.id ?? '');
        return { id: item?.id ?? label, label };
      });
      setFkOptions(prev => ({ ...prev, [key]: list }));
    } catch (e) {
      console.error('Failed to fetch FK options for', key, e);
    } finally {
      setFkLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const getRecordDisplayTitle = (row: EntityRecord | null | undefined) => {
    if (!row) return title;
    return String(row.name ?? row.title ?? row.label ?? row.code ?? row.slug ?? `#${row.id ?? ''}`);
  };

  const getRecordDisplaySubtitle = (row: EntityRecord | null | undefined) => {
    if (!row) return '';
    const parts = [
      row.code && String(row.code) !== getRecordDisplayTitle(row) ? String(row.code) : null,
      row.id !== null && row.id !== undefined && row.id !== '' ? `ID ${row.id}` : null,
    ].filter(Boolean);
    return parts.join(' • ');
  };

  const renderCellValue = (
    value: any,
    key?: string,
    options?: { align?: 'start' | 'center' }
  ) => {
    const align = options?.align || 'center';
    const chipAlignment = align === 'start' ? 'justify-start' : 'justify-center';
    if (typeof value === 'string' && value.match(/^https?:\/\/.+\.(png|jpe?g|gif|svg|webp)$/i)) {
      return (
        <button
          className="text-water-600 hover:underline"
          onClick={() => window.open(value, '_blank')}
          title={t.viewDetails || 'Open'}
        >
          ðŸ–¼ï¸
        </button>
      );
    }
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') {
      return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          value
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
        }`}>
          {value ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No')}
        </span>
      );
    }
    if (Array.isArray(value)) {
      if (!value.length) return '-';
      return (
        <div className={`flex flex-wrap gap-1.5 ${chipAlignment}`}>
          {value.slice(0, 4).map((item, index) => (
            <span key={`${String(item)}-${index}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              {key ? getFieldOptionLabel(key, item) : String(item)}
            </span>
          ))}
          {value.length > 4 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              +{value.length - 4}
            </span>
          )}
        </div>
      );
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value || {});
      if (!keys.length) return '-';
      return (
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          {keys.length} {lang === 'ar' ? 'حقول' : 'fields'}
        </span>
      );
    }
    return String(value);
  };

  const describeFieldPermission = (value: string) => {
    const normalized = String(value || '').toLowerCase();
    if (!normalized || normalized === '{}' || normalized === '[]') {
      return lang === 'ar' ? 'لا يوجد إذن محدد' : 'No explicit permission';
    }
    if (normalized.includes('edit')) return lang === 'ar' ? 'تحرير' : 'Edit';
    if (normalized.includes('view')) return lang === 'ar' ? 'عرض' : 'View';
    if (normalized.includes('hide')) return lang === 'ar' ? 'إخفاء' : 'Hide';
    return value;
  };

  const normalizePermissionValue = (value: string) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('edit')) return 'edit';
    if (normalized.includes('view')) return 'view';
    if (normalized.includes('hide')) return 'hide';
    return '';
  };

  const upsertFieldPermission = async (groupName: string, permission: string) => {
    if (!fieldPermField || !groupName || !permission) {
      setFieldPermError(t.validation_required || 'Required');
      return;
    }
    setFieldPermSavingGroup(groupName);
    setFieldPermError(null);
    setFieldPermSuccess(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(`${API_BASE_URL}/api/permissions/field/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': currentLanguageCode,
        },
        body: JSON.stringify({
          group_name: groupName,
          model: modelName,
          field_name: fieldPermField,
          permission,
        }),
      });
      const text = await res.text();
      let payload: any = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
      if (!res.ok) {
        const detail = payload?.detail || text || 'Failed to update field permission';
        throw new Error(detail);
      }
      setFieldPermissions(prev => ({ ...prev, [groupName]: permission }));
      setFieldPermSuccess(t.fieldPermissionsUpdateSuccess || 'Field permission saved');
    } catch (e: any) {
      console.error('Failed to upsert field permission', e);
      setFieldPermError(e?.message || t.fieldPermissionsUpdateError || 'Failed to update field permission');
    } finally {
      setFieldPermSavingGroup(null);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const openFieldLabelEditor = (fieldKey: string) => {
    setFieldLabelEditor({ key: fieldKey, value: getColumnLabel(fieldKey) });
    setFieldLabelSaveError(null);
  };

  const closeFieldLabelEditor = () => {
    if (isFieldLabelSaving) return;
    setFieldLabelEditor(null);
    setFieldLabelSaveError(null);
  };

  const saveFieldLabel = async () => {
    if (!fieldLabelEditor) return;
    const nextLabel = fieldLabelEditor.value.trim();
    if (!nextLabel) {
      setFieldLabelSaveError(lang === 'ar' ? 'اسم الحقل مطلوب' : 'Field name is required');
      return;
    }

    const fieldKey = fieldLabelEditor.key;
    setIsFieldLabelSaving(true);
    setFieldLabelSaveError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(`${API_BASE_URL}/api/fields-languages/upsert/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': currentLanguageCode,
        },
        body: JSON.stringify({
          content_type: modelName,
          language: currentLanguageCode,
          fields: {
            [fieldKey]: nextLabel,
          },
        }),
      });
      const text = await res.text();
      let payload: any = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
      if (!res.ok) {
        const detail = payload?.detail || payload?.message || text || 'Failed to save field name';
        throw new Error(detail);
      }

      const savedLabel = payload?.fields?.[fieldKey] || nextLabel;
      setFieldLabelOverrides(prev => ({ ...prev, [fieldKey]: savedLabel }));
      setFieldLabelEditor(null);
      void fetchFilters();
    } catch (e: any) {
      console.error('Failed to upsert field label', e);
      setFieldLabelSaveError(e?.message || (lang === 'ar' ? 'تعذر حفظ اسم الحقل' : 'Failed to save field name'));
    } finally {
      setIsFieldLabelSaving(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const renderFieldLabel = (
    fieldKey: string,
    options?: { required?: boolean; className?: string; buttonClassName?: string }
  ) => {
    const label = getColumnLabel(fieldKey);
    return (
      <span className={`inline-flex items-center gap-1.5 ${options?.className || ''}`.trim()}>
        <span>
          {label}
          {options?.required && <span className="text-red-500"> *</span>}
        </span>
        {canEditFieldLabels && (
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              openFieldLabelEditor(fieldKey);
            }}
            className={`inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-1 text-slate-500 transition-colors hover:border-water-300 hover:text-water-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-water-500 dark:hover:text-water-300 ${options?.buttonClassName || ''}`.trim()}
            title={lang === 'ar' ? 'تعديل اسم الحقل' : 'Edit field name'}
            aria-label={lang === 'ar' ? `تعديل اسم الحقل ${label}` : `Edit field name ${label}`}
          >
            <Pin size={12} />
          </button>
        )}
      </span>
    );
  };

  const renderChoiceChips = (
    fieldKey: string,
    value: any,
    onChange: (nextValue: string[]) => void,
    disabled = false,
  ) => {
    const options = getFieldOptions(fieldKey);
    const selected = new Set(normalizeChoiceArray(value));
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="flex flex-wrap gap-2">
          {options.map(option => {
            const active = selected.has(String(option));
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const next = new Set(selected);
                  if (active) next.delete(String(option));
                  else next.add(String(option));
                  onChange(Array.from(next));
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? 'border-water-300 bg-water-100 text-water-800 dark:border-water-700 dark:bg-water-900/40 dark:text-water-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-water-200 hover:text-water-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {getFieldOptionLabel(fieldKey, option)}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{selected.size ? `${selected.size} selected` : (lang === 'ar' ? 'اختر قيمة أو أكثر' : 'Choose one or more')}</span>
          {selected.size > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange([])}
              className="font-semibold text-slate-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {lang === 'ar' ? 'مسح' : 'Clear'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const handleFieldChange = (key: string, value: any) => {
    setEditingItem(prev => {
      if (!prev) return prev;
      if (key === 'id') return prev;
      if (Array.isArray(value)) {
        return { ...prev, [key]: value };
      }
      const isCoordField = key === latFieldKey || key === lngFieldKey;
      if (isCoordField) {
        if (value === '') return { ...prev, [key]: '' };
        const num = Number(value);
        return { ...prev, [key]: Number.isFinite(num) ? num : value };
      }
      const fieldType = String(getFieldType(key) || '').toLowerCase();
      if (isBooleanFieldType(fieldType)) {
        const nextValue =
          typeof value === 'boolean'
            ? value
            : ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase().trim());
        return { ...prev, [key]: nextValue };
      }
      if (fieldType.startsWith('fk')) {
        if (value === '') return { ...prev, [key]: '' };
        const num = Number(value);
        return { ...prev, [key]: Number.isFinite(num) ? num : value };
      }
      if (isNumericFieldType(fieldType)) {
        if (value === '') return { ...prev, [key]: '' };
        const num = Number(value);
        return { ...prev, [key]: Number.isFinite(num) ? num : value };
      }
      return { ...prev, [key]: value };
    });
  };

  const updateCoordsFromMap = (lat: number, lng: number) => {
    if (!latFieldKey || !lngFieldKey) return;
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    setEditingItem(prev => {
      if (!prev) return prev;
      return { ...prev, [latFieldKey]: roundedLat, [lngFieldKey]: roundedLng };
    });
  };

  const placeMarker = (lat: number, lng: number, pan = false) => {
    if (!leafletRef.current || !mapInstanceRef.current) return;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const L = leafletRef.current;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapInstanceRef.current);
      markerRef.current.on('dragend', (e: any) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng();
        updateCoordsFromMap(newLat, newLng);
        placeMarker(newLat, newLng, false);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (pan) {
      mapInstanceRef.current.panTo([lat, lng]);
    }
  };

  const parseCoord = (value: any) => {
    if (value === null || value === undefined || value === '') return NaN;
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  };

  const updateCreateCoordsFromMap = (lat: number, lng: number) => {
    if (!createLatFieldKey || !createLngFieldKey) return;
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    setCreateItem(prev => ({ ...prev, [createLatFieldKey]: roundedLat, [createLngFieldKey]: roundedLng }));
  };

  const placeCreateMarker = (lat: number, lng: number, pan = false) => {
    if (!leafletRef.current || !createMapInstanceRef.current) return;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const L = leafletRef.current;
    if (!createMarkerRef.current) {
      createMarkerRef.current = L.marker([lat, lng], { draggable: true }).addTo(createMapInstanceRef.current);
      createMarkerRef.current.on('dragend', (e: any) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng();
        updateCreateCoordsFromMap(newLat, newLng);
        placeCreateMarker(newLat, newLng, false);
      });
    } else {
      createMarkerRef.current.setLatLng([lat, lng]);
    }
    if (pan) {
      createMapInstanceRef.current.panTo([lat, lng]);
    }
  };

  useEffect(() => {
    const next: EntityRecord = {};
    visibleCreateFields.forEach(col => {
      const type = getFieldType(col).toLowerCase();
      const options = getFieldOptions(col);
      if (col === 'point_type') {
        next[col] = [];
      } else if (isPointModel && Object.prototype.hasOwnProperty.call(POINT_MODBUS_DEFAULTS, col)) {
        next[col] = POINT_MODBUS_DEFAULTS[col];
      } else if (isCenterModel && col === 'map_position') {
        next[col] = '';
      } else if (isCenterModel && col === 'map_color') {
        next[col] = '#f8b4ad';
      } else if (isCenterModel && col === 'map_size') {
        next[col] = options.includes('medium') ? 'medium' : (options[0] ?? '');
      } else if (type === 'jsonfield') {
        next[col] = col.toLowerCase().includes('shape') || col.toLowerCase().includes('position') ? {} : [];
      } else if (isBooleanFieldType(type)) {
        next[col] = false;
      } else if (options.length) {
        next[col] = options[0] ?? '';
      } else {
        next[col] = '';
      }
    });
    setCreateItem(next);
    setCreateError(null);
    setFkOptions({});
    setFkLoading({});
  }, [isCenterModel, isPointModel, selectedFilter, visibleCreateFields]);

  useEffect(() => {
    if (!isCreateOpen || !hasDmaAndDmzFields) return;
    setDmaDmzSelection('dma');
    setCreateItem(prev => ({ ...prev, dmz: '' }));
  }, [isCreateOpen, hasDmaAndDmzFields]);

  useEffect(() => {
    fkFields.forEach(key => {
      if (!fkOptions[key] && !fkLoading[key]) {
        fetchFkOptions(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fkFields, selectedFilter]);

  useEffect(() => {
    if (!isCreateOpen) return;
    fkFields.forEach(key => fetchFkOptions(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateOpen, fkFields]);

  const handleCreateFieldChange = (key: string, value: any) => {
    const isCoordField = key === createLatFieldKey || key === createLngFieldKey;
    if (isCoordField) {
      if (value === '') {
        setCreateItem(prev => ({ ...prev, [key]: '' }));
        return;
      }
      const num = Number(value);
      setCreateItem(prev => ({ ...prev, [key]: Number.isFinite(num) ? num : value }));
      return;
    }
    const fieldType = getFieldType(key).toLowerCase();
    if (isBooleanFieldType(fieldType)) {
      setCreateItem(prev => ({ ...prev, [key]: Boolean(value) }));
      return;
    }
    if (hasDmaAndDmzFields && key === 'dma') {
      setDmaDmzSelection('dma');
      setCreateItem(prev => ({ ...prev, dma: value, dmz: '' }));
      return;
    }
    if (hasDmaAndDmzFields && key === 'dmz') {
      setDmaDmzSelection('dmz');
      setCreateItem(prev => ({ ...prev, dmz: value, dma: '' }));
      return;
    }
    setCreateItem(prev => ({ ...prev, [key]: value }));
  };

  const normalizeCreatePayload = () => {
    const hasFile = Object.values(createItem).some(v => v instanceof File);
    if (hasFile) {
      const formData = new FormData();
      Object.entries(createItem).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') return;
        if (v instanceof File) {
          formData.append(k, v);
        } else {
          formData.append(k, String(v));
        }
      });
      return { body: formData, headers: undefined };
    }
    const jsonPayload: Record<string, any> = {};
    Object.entries(createItem).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined) return;
      if (Array.isArray(v)) {
        jsonPayload[k] = v;
        return;
      }
      const type = getFieldType(k).toLowerCase();
      if (type === 'jsonfield') {
        jsonPayload[k] = typeof v === 'string' ? parseJsonValue(v) : v;
      } else if (['integerfield', 'positiveintegerfield', 'bigautofield'].includes(type)) {
        jsonPayload[k] = Number(v);
      } else if (['decimalfield', 'floatfield'].includes(type)) {
        jsonPayload[k] = Number(v);
      } else if (type.startsWith('fk')) {
        jsonPayload[k] = isNaN(Number(v)) ? v : Number(v);
      } else {
        jsonPayload[k] = v;
      }
    });
    return { body: JSON.stringify(jsonPayload), headers: { 'Content-Type': 'application/json' } };
  };

  const createRecord = async () => {
    if (hasDmaAndDmzFields) {
      const dmaVal = createItem['dma'];
      const dmzVal = createItem['dmz'];
      const isFilled = (v: any) => !(v === undefined || v === null || v === '');
      const hasDma = isFilled(dmaVal);
      const hasDmz = isFilled(dmzVal);
      if (hasDma && hasDmz) {
        setCreateError(lang === 'ar' ? 'اختر واحد فقط: DMA أو DMZ' : 'Choose only one: DMA or DMZ');
        return;
      }
      if (!hasDma && !hasDmz) {
        setCreateError(lang === 'ar' ? 'يجب اختيار DMA أو DMZ' : 'You must select DMA or DMZ');
        return;
      }
    }
    // Basic required validation before hitting the API
    const missing = visibleCreateFields.filter(key => {
      if (hasDmaAndDmzFields && (key === 'dma' || key === 'dmz') && key !== dmaDmzSelection) return false;
      if (!isFieldRequired(key) || key === 'id') return false;
      const val = createItem[key];
      if (val === 0 || val === false) return false;
      return val === undefined || val === null || val === '';
    });
    if (missing.length) {
      setCreateError(`${t.validation_required || 'This field is required'}: ${missing.map(getColumnLabel).join(', ')}`);
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const { body, headers } = normalizeCreatePayload();
      const url = `${API_BASE_URL}${safeEndpoint}${safeEndpoint.endsWith('/') ? '' : '/'}`;
      const res = await authFetch(url, {
        method: 'POST',
        headers: headers ?? { 'Accept-Language': currentLanguageCode },
        body,
      });
      const text = await res.text();
      const maybeJson = (() => {
        try { return text ? JSON.parse(text) : null; } catch { return null; }
      })();
      if (!res.ok) {
        const detail = maybeJson?.detail || maybeJson?.message || text || 'Failed to create record';
        throw new Error(detail);
      }
      const created = maybeJson ?? {};
      setItems(prev => [created, ...prev]);
      setIsCreateOpen(false);
      setCreateItem({});
      emitCentersMapRefresh();
    } catch (e: any) {
      console.error(e);
      setCreateError(e?.message || 'Failed to create record');
    } finally {
      setIsCreating(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
        {description || (lang === 'ar' ? 'عرض البيانات ديناميكياً' : 'Dynamic data view')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fetchItems(selectedFilterId)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <RefreshCw size={16} />
            {t.refresh || 'Refresh'}
          </button>
          {!isCompanyModel && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-water-600 text-white hover:bg-water-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedFilter}
            >
              {t.addNew || 'Add New'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t.filters}:</span>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              value={selectedFilterId ?? ''}
              onChange={e => { const id = Number(e.target.value); setSelectedFilterId(id); fetchItems(id); }}
            >
              <option value="">{t.selectFilter}</option>
              {filters.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { resetFilterModal(); setIsFilterModalOpen(true); }}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs"
            >
              {lang === 'ar' ? 'فلتر أعمدة جديد' : 'New Column Filter'}
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              placeholder={t.search || 'Search...'}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="hidden md:block overflow-auto">
          <table className="w-full text-sm text-center">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                {columns.map(col => (
                  <th key={col} className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 tracking-wider">
                    {renderFieldLabel(col, { className: 'justify-center' })}
                  </th>
                ))}
                {isPointModel && (
                  <th className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 tracking-wider">
                    {lang === 'ar' ? 'رفع / عرض القراءات' : 'Upload / View Readings'}
                  </th>
                )}
                <th className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 tracking-wider">
                  {t.tableActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-4 py-6 text-center text-slate-500">
                    {t.processing}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-4 py-6 text-center text-slate-500">
                    {t.noRows}
                  </td>
                </tr>
              ) : (
                filteredItems.map(row => (
                  <tr key={row.id ?? JSON.stringify(row)} className="border-t border-slate-100 dark:border-slate-700">
                    {columns.map(col => (
                      <td key={col} className="px-4 py-3 text-center text-slate-800 dark:text-slate-100">
                        {renderCellValue(row[col], col)}
                      </td>
                    ))}
                    {isPointModel && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openReadingModal(row)}
                          className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 inline-flex items-center gap-2"
                        >
                          <Upload size={14} /> {lang === 'ar' ? 'رفع / عرض' : 'Upload / View'}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button
                          onClick={() => row.id && fetchDetail(Number(row.id))}
                          className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 inline-flex items-center gap-1"
                        >
                          <Eye size={14} /> {t.viewDetails}
                        </button>
                        <button
                          onClick={() => row.id && startEdit(Number(row.id))}
                          className="px-3 py-1 rounded bg-water-600 text-white inline-flex items-center gap-1"
                        >
                          <Pencil size={14} /> {t.edit}
                        </button>
                        <button
                          onClick={() => row.id && setDeleteTarget({ id: row.id, label: row?.name || row?.title || row?.label || row?.code || row?.slug || row?.id })}
                          disabled={deletingId != null && String(deletingId) === String(row.id)}
                          className="px-3 py-1 rounded bg-red-100 text-red-700 inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} /> {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">{t.processing}</div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">{t.noRows}</div>
          ) : (
            filteredItems.map(row => (
              <article key={row.id ?? JSON.stringify(row)} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-slate-800 dark:text-slate-100">
                      {getRecordDisplayTitle(row)}
                    </h3>
                    {getRecordDisplaySubtitle(row) && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {getRecordDisplaySubtitle(row)}
                      </p>
                    )}
                  </div>
                  {typeof row.is_active === 'boolean' && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      row.is_active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                    }`}>
                      {row.is_active ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'غير نشط' : 'Inactive')}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {columns.map(col => (
                    <div
                      key={col}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70"
                    >
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {getColumnLabel(col)}
                      </div>
                      <div className="mt-2 break-words text-sm text-slate-800 dark:text-slate-100">
                        {renderCellValue(row[col], col, { align: 'start' })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => row.id && fetchDetail(Number(row.id))}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <Eye size={14} /> {t.viewDetails}
                  </button>
                  <button
                    onClick={() => row.id && startEdit(Number(row.id))}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-water-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    <Pencil size={14} /> {t.edit}
                  </button>
                  {isPointModel && (
                    <button
                      onClick={() => openReadingModal(row)}
                      className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                    >
                      <Upload size={14} /> {lang === 'ar' ? 'رفع / عرض القراءات' : 'Upload / View Readings'}
                    </button>
                  )}
                  <button
                    onClick={() => row.id && setDeleteTarget({ id: row.id, label: row?.name || row?.title || row?.label || row?.code || row?.slug || row?.id })}
                    disabled={deletingId != null && String(deletingId) === String(row.id)}
                    className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={14} /> {t.delete}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-[100] flex items-stretch justify-center p-0 sm:items-center sm:p-4 lg:p-6">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setDetailItem(null)} />
          <div className="relative z-10 flex h-dvh w-full min-w-0 max-w-[96rem] flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:h-[calc(100dvh-2rem)] sm:max-h-[56rem] sm:rounded-2xl">
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 flex items-start gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold leading-tight text-slate-800 dark:text-white sm:text-xl">
                    {detailTitle || title}
                  </h3>
                  <p className="mt-1 whitespace-normal break-words text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                    {getRecordDisplayTitle(detailItem)}
                    {getRecordDisplaySubtitle(detailItem) ? ` • ${getRecordDisplaySubtitle(detailItem)}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setDetailItem(null)} className="mt-0.5 shrink-0 rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t.cancel || 'Close'}>
                  <X size={18} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
                <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {Object.entries(detailItem).map(([key, value]) => (
                    <div
                      key={key}
                      className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 sm:p-4"
                    >
                      <div className="break-words text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {getColumnLabel(key)}
                      </div>
                      <div className="mt-3 min-w-0 whitespace-normal break-words text-sm text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100 sm:text-[15px]">
                        {renderCellValue(value, key, { align: 'start' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t.delete || 'Delete'}</h3>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label={t.cancel || 'Close'}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t.confirmDelete || 'Are you sure you want to delete this row?'}
            </p>
            {deleteTarget.label && (
              <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm">
                {String(deleteTarget.label)}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100"
                disabled={deletingId != null}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => deleteRecord(deleteTarget.id)}
                disabled={deletingId != null}
                className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {readingModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReadingModalRow(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-xl max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                {lang === 'ar' ? 'رفع / عرض القراءات' : 'Upload / View Readings'}
              </h3>
              <button onClick={() => setReadingModalRow(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="font-semibold">
                {lang === 'ar' ? 'النقطة' : 'Point'}: {readingModalRow.name || readingModalRow.code || `#${readingModalRow.id}`}
              </div>
              <div className="space-y-2">
                <div className="font-semibold">{lang === 'ar' ? 'تنسيق الجدول المتوقع' : 'Expected table layout'}</div>
                <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        {readingColumnsForRow(readingModalRow).map(col => (
                          <th key={col} className="px-3 py-2 text-left text-slate-600 dark:text-slate-300">
                            {readingColumnLabel(col)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-400 dark:text-slate-500">
                        {readingColumnsForRow(readingModalRow).map(col => (
                          <td key={col} className="px-3 py-2 italic">
                            {lang === 'ar' ? 'من ملف الإكسل' : 'From Excel file'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold">{lang === 'ar' ? 'تعيين أعمدة الإكسل' : 'Map Excel columns'}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {readingColumnsForRow(readingModalRow).map((col, idx) => (
                    <label key={col} className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 flex flex-col gap-1">
                      {readingColumnLabel(col)}
                      <select
                        value={readingColumnSelections[idx] || ''}
                        onChange={e => {
                          const next = [...readingColumnSelections];
                          next[idx] = e.target.value;
                          setReadingColumnSelections(next);
                        }}
                        className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                      >
                        {readingColumnsForRow(readingModalRow).map(opt => (
                          <option key={opt} value={opt}>{readingColumnLabel(opt)}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-semibold block">{lang === 'ar' ? 'ملف الإكسل' : 'Excel file'}</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => setReadingFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-700 dark:text-slate-200"
                />
                {readingFile && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {readingFile.name} â€¢ {(readingFile.size / 1024).toFixed(1)} KB
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar'
                  ? 'سيتم طباعة البيانات في الـ console إلى حين تفعيل الـ API.'
                  : 'Payload will be logged to console until the API is ready.'}
              </div>
            </div>
            {readingConsoleMsg && (
              <div className="mt-4 p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm">
                {readingConsoleMsg}
              </div>
            )}
            {readingPayloadPreview && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  {lang === 'ar' ? 'JSON المطبوع' : 'Logged JSON'}
                </div>
                <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-48">
                  {readingPayloadPreview}
                </pre>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setReadingModalRow(null)}
                className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                onClick={uploadReadings}
                className="px-4 py-2 rounded bg-water-600 text-white disabled:opacity-60"
                disabled={!readingModalRow}
              >
                {lang === 'ar' ? 'رفع (console فقط)' : 'Upload (console only)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsFilterModalOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                {lang === 'ar' ? 'فلتر عرض جديد' : 'New View Filter'}
              </h3>
              <button onClick={() => setIsFilterModalOpen(false)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                <span className="font-semibold">{lang === 'ar' ? 'اسم الفلتر' : 'Filter name'}</span>
                <input
                  value={filterName}
                  onChange={e => setFilterName(e.target.value)}
                  className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  placeholder={lang === 'ar' ? 'مثال: عرض مختصر' : 'e.g. Compact view'}
                />
              </label>
              <label className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                <span className="font-semibold">{lang === 'ar' ? 'الأعمدة' : 'Columns'}</span>
                {availableColumns.length === 0 ? (
                  <div className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300">
                    {lang === 'ar' ? 'لا توجد أعمدة متاحة بعد' : 'No columns available yet'}
                  </div>
                ) : (
                  <select
                    multiple
                    value={filterColumns}
                    onChange={e => {
                      const vals = Array.from(e.target.selectedOptions).map(o => o.value);
                      setFilterColumns(vals);
                    }}
                    className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 h-32"
                  >
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{getColumnLabel(col)}</option>
                    ))}
                  </select>
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'اختر الأعمدة التي تريد إظهارها في الجدول' : 'Choose which columns show in the table'}
                </span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={filterIsDefault}
                  onChange={e => setFilterIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                />
                {lang === 'ar' ? 'تعيين كافتراضي' : 'Set as default'}
              </label>
            </div>
            {filterError && (
              <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
                {filterError}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { resetFilterModal(); setIsFilterModalOpen(false); }}
                className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                disabled={isSavingFilter}
              >
                {t.cancel}
              </button>
              <button
                onClick={createMetaFilter}
                className="px-4 py-2 rounded bg-water-600 text-white disabled:opacity-60"
                disabled={isSavingFilter || availableColumns.length === 0}
              >
                {isSavingFilter ? (t.processing || 'Saving...') : (lang === 'ar' ? 'حفظ الفلتر' : 'Save filter')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 p-2 sm:p-4 lg:p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCreateOpen(false)} />
          <div className="relative z-10 mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900 sm:h-[calc(100dvh-2rem)] lg:h-[min(92vh,60rem)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-4 dark:border-slate-800 sm:px-6 sm:pb-4 sm:pt-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white sm:text-xl">{t.addNew || 'Add New'}</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
              {hasDmaAndDmzFields && (
                <div className="mt-4 mb-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {lang === 'ar' ? 'اختر نوع الربط' : 'Choose linkage type'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDmaDmzSelection('dma');
                          setCreateItem(prev => ({ ...prev, dmz: '' }));
                        }}
                        className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                          dmaDmzSelection === 'dma'
                            ? 'bg-water-600 text-white border-water-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        DMA
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDmaDmzSelection('dmz');
                          setCreateItem(prev => ({ ...prev, dma: '' }));
                        }}
                        className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                          dmaDmzSelection === 'dmz'
                            ? 'bg-water-600 text-white border-water-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        DMZ
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {lang === 'ar'
                      ? 'سيتم عرض حقل واحد فقط (DMA أو DMZ). اختيار واحد يقوم بإخفاء الآخر.'
                      : 'Only one field will be shown (DMA or DMZ). Selecting one hides the other.'}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:gap-4">
                {visibleCreateFields.map(key => {
                if (key === 'id') return null;
                if (hasDmaAndDmzFields && (key === 'dma' || key === 'dmz') && key !== dmaDmzSelection) return null;
                const type = getFieldType(key).toLowerCase();
                const isNumeric = ['integerfield', 'positiveintegerfield', 'decimalfield', 'floatfield', 'bigautofield'].includes(type);
                const isBool = isBooleanFieldType(type);
                const isJson = isJsonFieldType(type);
                const isColor = isColorField(key);
                const isTextArea = type === 'textfield';
                const isFile = type === 'filefield';
                const isDateTime = type === 'datetimefield';
                const isFk = type.toLowerCase().startsWith('fk');
                const options = getFieldOptions(key);
                const isMultiOption = isMultiOptionField(key, type, options);
                return (
                  <label key={key} className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                    <span className="font-semibold">{renderFieldLabel(key, { required: isFieldRequired(key) })}</span>
                    {isBool ? (
                      <div className="flex items-center gap-2 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(createItem[key])}
                          onChange={e => handleCreateFieldChange(key, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-water-600 focus:ring-water-500"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">{Boolean(createItem[key]) ? 'true' : 'false'}</span>
                      </div>
                    ) : isCenterModel && key === 'map_position' ? (
                      <select
                        value={getCenterDirectionValue(createItem[key])}
                        onChange={e => handleCreateFieldChange(key, e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      >
                        <option value="">{t.selectFilter || 'Select'}</option>
                        {CENTER_DIRECTION_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{getFieldOptionLabel(key, opt)}</option>
                        ))}
                      </select>
                    ) : isMultiOption ? (
                      renderChoiceChips(
                        key,
                        createItem[key],
                        vals => handleCreateFieldChange(key, vals),
                      )
                    ) : isJson ? (
                      <textarea
                        value={formatJsonValue(createItem[key])}
                        onChange={e => handleCreateFieldChange(key, parseJsonValue(e.target.value))}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs"
                        rows={5}
                      />
                    ) : isColor ? (
                      <div className="flex items-center gap-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5">
                        <input
                          type="color"
                          value={validColorValue(createItem[key])}
                          onChange={e => handleCreateFieldChange(key, e.target.value)}
                          className="h-8 w-10 border-0 bg-transparent p-0"
                        />
                        <input
                          value={createItem[key] ?? ''}
                          onChange={e => handleCreateFieldChange(key, e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none dark:text-slate-100"
                        />
                      </div>
                    ) : isTextArea ? (
                      <textarea
                        value={createItem[key] ?? ''}
                        onChange={e => handleCreateFieldChange(key, e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        rows={3}
                      />
                    ) : key === 'point_type' && options.length ? (
                      <select
                        multiple
                        value={Array.isArray(createItem[key]) ? createItem[key] : []}
                        onChange={e => {
                          const vals = Array.from(e.target.selectedOptions).map(o => o.value);
                          handleCreateFieldChange(key, vals);
                        }}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 h-24"
                      >
                        {options.map(opt => (
                          <option key={opt} value={opt}>{getFieldOptionLabel(key, opt)}</option>
                        ))}
                      </select>
                    ) : options.length > 0 ? (
                      <select
                        value={createItem[key] ?? ''}
                        onChange={e => handleCreateFieldChange(key, e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      >
                        <option value="">{t.selectFilter || 'Select'}</option>
                        {options.map(opt => (
                          <option key={opt} value={opt}>{getFieldOptionLabel(key, opt)}</option>
                        ))}
                      </select>
                    ) : isFk ? (
                      <select
                        value={createItem[key] ?? ''}
                        onChange={e => handleCreateFieldChange(key, e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      >
                        <option value="">{t.selectFilter || 'Select'}</option>
                        {(fkOptions[key] || []).map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                        {fkLoading[key] && <option disabled>{t.processing || 'Loading...'}</option>}
                      </select>
                    ) : isFile ? (
                      <input
                        type="file"
                        onChange={e => handleCreateFieldChange(key, e.target.files?.[0] || null)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      />
                    ) : (
                      <input
                        type={isDateTime ? 'datetime-local' : isNumeric ? 'number' : 'text'}
                        value={createItem[key] ?? ''}
                        onChange={e => handleCreateFieldChange(key, isNumeric ? e.target.value : e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      />
                    )}
                  </label>
                );
              })}
              </div>
              {createError && (
                <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
                  {createError}
                </div>
              )}
              {hasCreateCoordinateFields && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Location on map</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Click map to set coordinates</span>
                  </div>
                  <div
                    ref={createMapContainerRef}
                    className="w-full h-72 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800"
                  />
                  {createMapError && (
                    <div className="text-xs text-red-600">{createMapError}</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:justify-end sm:px-6">
              <button
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                disabled={isCreating}
              >
                {t.cancel}
              </button>
              <button
                onClick={createRecord}
                className="px-4 py-2 rounded bg-water-600 text-white disabled:opacity-60"
                disabled={isCreating}
              >
                {isCreating ? (t.processing || 'Saving...') : (t.addNew || 'Add New')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-50 p-2 sm:p-4 lg:p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingItem(null)} />
          <div className="relative z-10 mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-slate-900 sm:h-[calc(100dvh-2rem)] lg:h-[min(92vh,60rem)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-4 dark:border-slate-800 sm:px-6 sm:pb-4 sm:pt-6">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white sm:text-xl">{detailTitle || title}</h3>
                {isSuperAdmin && fieldPermissionFields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openFieldPermModal()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ShieldCheck size={14} />
                    {t.fieldPermissions || (lang === 'ar' ? 'صلاحيات الحقول' : 'Field permissions')}
                  </button>
                )}
              </div>
              <button onClick={() => setEditingItem(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:gap-4">
                {editFields.map(key => {
                const value = editingItem[key];
                const type = getFieldType(key).toLowerCase();
                const isFk = type.startsWith('fk');
                const options = getFieldOptions(key);
                const isBool = isBooleanFieldType(type);
                const isJson = isJsonFieldType(type);
                const isColor = isColorField(key);
                const isMultiOption = isMultiOptionField(key, type, options);
                const inputType = (isFk || isNumericFieldType(type) || key === latFieldKey || key === lngFieldKey) ? 'number' : 'text';
                return (
                  <label key={key} className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                    <span className="font-semibold">{renderFieldLabel(key)}</span>
                    {isBool ? (
                      <div className="flex items-center gap-2 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={e => handleFieldChange(key, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-water-600 focus:ring-water-500"
                          disabled={key === 'id'}
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">{Boolean(value) ? 'true' : 'false'}</span>
                      </div>
                    ) : isCenterModel && key === 'map_position' ? (
                      <select
                        value={getCenterDirectionValue(value)}
                        onChange={e => handleFieldChange(key, e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        disabled={key === 'id'}
                      >
                        <option value="">{t.selectFilter || 'Select'}</option>
                        {CENTER_DIRECTION_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{getFieldOptionLabel(key, opt)}</option>
                        ))}
                      </select>
                    ) : isMultiOption ? (
                      renderChoiceChips(
                        key,
                        value,
                        vals => handleFieldChange(key, vals),
                        key === 'id',
                      )
                    ) : isJson ? (
                      <textarea
                        value={formatJsonValue(value)}
                        onChange={e => handleFieldChange(key, parseJsonValue(e.target.value))}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs"
                        rows={5}
                        disabled={key === 'id'}
                      />
                    ) : isColor ? (
                      <div className="flex items-center gap-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5">
                        <input
                          type="color"
                          value={validColorValue(value)}
                          onChange={e => handleFieldChange(key, e.target.value)}
                          className="h-8 w-10 border-0 bg-transparent p-0"
                          disabled={key === 'id'}
                        />
                        <input
                          value={value ?? ''}
                          onChange={e => handleFieldChange(key, e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none dark:text-slate-100"
                          disabled={key === 'id'}
                        />
                      </div>
                    ) : key === 'point_type' && options.length ? (
                      <select
                        multiple
                        value={Array.isArray(value) ? value : value ? [value] : []}
                        onChange={e => {
                          const vals = Array.from(e.target.selectedOptions).map(o => o.value);
                          handleFieldChange(key, vals as any);
                        }}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 h-24"
                        disabled={key === 'id'}
                      >
                        {options.map(opt => (
                          <option key={opt} value={opt}>{getFieldOptionLabel(key, opt)}</option>
                        ))}
                      </select>
                    ) : options.length > 0 ? (
                      <select
                        value={value ?? ''}
                        onChange={e => handleFieldChange(key, e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        disabled={key === 'id'}
                      >
                        <option value="">{t.selectFilter || 'Select'}</option>
                        {options.map(opt => (
                          <option key={opt} value={opt}>{getFieldOptionLabel(key, opt)}</option>
                        ))}
                      </select>
                    ) : isFk ? (
                      <select
                        value={value ?? ''}
                        onChange={e => handleFieldChange(key, e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        disabled={key === 'id'}
                      >
                        <option value="">{t.selectFilter || 'Select'}</option>
                        {(fkOptions[key] || []).map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                        {fkLoading[key] && <option disabled>{t.processing || 'Loading...'}</option>}
                      </select>
                    ) : (
                      <input
                        type={inputType}
                        value={value ?? ''}
                        onChange={e => handleFieldChange(key, e.target.value)}
                        className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        disabled={key === 'id'}
                      />
                    )}
                  </label>
                );
              })}
              </div>
              {hasCoordinateFields && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Location on map</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Click map to update coordinates</span>
                  </div>
                  <div
                    ref={mapContainerRef}
                    className="w-full h-72 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800"
                  />
                  {mapError && (
                    <div className="text-xs text-red-600">{mapError}</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 dark:border-slate-800 sm:flex-row sm:justify-end sm:px-6">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                disabled={isSaving}
              >
                {t.cancel}
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 rounded bg-water-600 text-white disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? (t.processing || 'Saving...') : (t.saveChanges || t.save)}
              </button>
            </div>
          </div>
        </div>
      )}

      {fieldLabelEditor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-3">
          <div className="absolute inset-0 bg-black/60" onClick={closeFieldLabelEditor} />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {lang === 'ar' ? 'تعديل اسم الحقل' : 'Edit field name'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'سيتم الحفظ على لغة الواجهة الحالية.' : 'This will be saved for the current UI language.'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {lang === 'ar' ? 'الموديل:' : 'Model:'} {modelName} | {lang === 'ar' ? 'الحقل:' : 'Field:'} {fieldLabelEditor.key}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFieldLabelEditor}
                className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                disabled={isFieldLabelSaving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                <span className="font-semibold">{lang === 'ar' ? 'الاسم الظاهر' : 'Display name'}</span>
                <input
                  autoFocus
                  value={fieldLabelEditor.value}
                  onChange={e => setFieldLabelEditor(prev => (prev ? { ...prev, value: e.target.value } : prev))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void saveFieldLabel();
                    }
                  }}
                  className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  placeholder={lang === 'ar' ? 'اكتب اسم الحقل' : 'Enter field name'}
                />
              </label>
              {fieldLabelSaveError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {fieldLabelSaveError}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeFieldLabelEditor}
                className="px-4 py-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                disabled={isFieldLabelSaving}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void saveFieldLabel()}
                className="px-4 py-2 rounded bg-water-600 text-white disabled:opacity-60"
                disabled={isFieldLabelSaving}
              >
                {isFieldLabelSaving ? (t.processing || 'Saving...') : (t.saveChanges || t.save)}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSuperAdmin && isFieldPermModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-3">
          <div className="absolute inset-0 bg-black/60" onClick={closeFieldPermModal} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {t.fieldPermissions || (lang === 'ar' ? 'صلاحيات الحقول' : 'Field permissions')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ar'
                    ? 'اختر الحقل من أعمدة الـ Meta لعرض صلاحيات المجموعات (يتطلب صلاحية Superuser).'
                    : 'Select a meta column to see per-group access (superuser only).'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {lang === 'ar' ? 'الموديل:' : 'Model:'} {modelName}
                </p>
              </div>
              <button onClick={closeFieldPermModal} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            {fieldPermissionFields.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm">
                {lang === 'ar'
                  ? 'لا توجد أعمدة متاحة من الـ Meta لعرض صلاحيات الحقول.'
                  : 'No meta columns are available to request field permissions.'}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                  <span className="font-semibold">{lang === 'ar' ? 'الحقل' : 'Field'}</span>
                  <select
                    value={fieldPermField}
                    onChange={e => {
                      const next = e.target.value;
                      setFieldPermField(next);
                      if (next) loadFieldPermissions(next);
                    }}
                    className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    {fieldPermissionFields.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </label>

                {fieldPermError && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
                    {fieldPermError}
                  </div>
                )}
                {fieldPermSuccess && (
                  <div className="p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">
                    {fieldPermSuccess}
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2 max-h-72 overflow-auto">
                  {fieldPermLoading ? (
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {t.processing || 'Loading...'}
                    </div>
                  ) : Object.keys(fieldPermissions || {}).length === 0 ? (
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {lang === 'ar'
                        ? 'لم يتم إرجاع بيانات صلاحيات لهذا الحقل.'
                        : 'No permission data returned for this field.'}
                    </div>
                  ) : (
                    Object.entries(fieldPermissions)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([group, value]) => {
                        const normalized = normalizePermissionValue(value);
                        return (
                          <div
                            key={group}
                            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
                          >
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-800 dark:text-slate-100">{group}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {describeFieldPermission(value)}
                              </div>
                            </div>
                            {isSuperAdmin ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={normalized || ''}
                                  onChange={e => upsertFieldPermission(group, e.target.value)}
                                  className="px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                                  disabled={fieldPermSavingGroup === group}
                                >
                                  <option value="">{t.selectFilter || 'Select'}</option>
                                  <option value="view">{t.viewPermission || (lang === 'ar' ? 'عرض' : 'View')}</option>
                                  <option value="edit">{t.editPermission || (lang === 'ar' ? 'تحرير' : 'Edit')}</option>
                                  <option value="hide">{t.hidePermission || (lang === 'ar' ? 'إخفاء' : 'Hide')}</option>
                                </select>
                                {fieldPermSavingGroup === group && (
                                  <RefreshCw size={16} className="animate-spin text-slate-500" />
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">{value || '{}'}</span>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => fieldPermField && loadFieldPermissions(fieldPermField)}
                    className="px-4 py-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-2"
                    disabled={!fieldPermField || fieldPermLoading}
                  >
                    <RefreshCw size={14} />
                    {t.refresh || 'Refresh'}
                  </button>
                  <button
                    type="button"
                    onClick={closeFieldPermModal}
                    className="px-4 py-2 rounded bg-water-600 text-white"
                  >
                    {t.close || t.cancel || 'Close'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaListView;
