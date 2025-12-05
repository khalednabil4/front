import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, Eye, Pencil, X, Upload } from 'lucide-react';
import { Language } from '../types';
import { DICTIONARY } from '../constants';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://8de77a78ce9b.ngrok-free.app').replace(/\/$/, '');

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
}

type EntityRecord = Record<string, any>;

export interface MetaListViewProps {
  lang: Language;
  title: string;
  description?: string;
  endpoint: string; // e.g., /core/companies
  modelName: string; // e.g., core.company
  detailTitle?: string;
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
}) => {
  const t = DICTIONARY[lang];
  const [filters, setFilters] = useState<MetaFilter[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState<number | null>(null);
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<EntityRecord | null>(null);
  const [editingItem, setEditingItem] = useState<EntityRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createItem, setCreateItem] = useState<EntityRecord>({});
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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

  const safeEndpoint = normalizeEndpoint(endpoint);
  const selectedFilter = useMemo(
    () => filters.find(f => f.id === selectedFilterId) || null,
    [filters, selectedFilterId]
  );
  const createFields = useMemo(() => selectedFilter?.columns || [], [selectedFilter]);
  const fkFields = useMemo(
    () => createFields.filter(col => (selectedFilter?.field_types?.[col] || '').toLowerCase().startsWith('fk')),
    [createFields, selectedFilter]
  );

  const fetchFilters = async (): Promise<MetaFilter[]> => {
    setError(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/core/meta-filters/?model=${modelName}`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
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

  const fetchItems = async (filterId?: number | null) => {
    setIsLoading(true);
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const query = filterId ? `?filter_id=${filterId}` : '';
      const res = await authFetch(`${API_BASE_URL}${safeEndpoint}${query}`);
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
      const res = await authFetch(`${API_BASE_URL}${safeEndpoint}${safeEndpoint.endsWith('/') ? '' : '/'}${id}/`);
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
      const res = await authFetch(`${API_BASE_URL}${safeEndpoint}${safeEndpoint.endsWith('/') ? '' : '/'}${id}/`);
      const data = await res.json();
      setEditingItem(data);
    } catch (e) {
      console.error(e);
      setError('Failed to load record for edit');
    } finally {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const saveEdit = async () => {
    if (!editingItem || editingItem.id == null) return;
    setIsSaving(true);
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const res = await authFetch(`${API_BASE_URL}${safeEndpoint}${safeEndpoint.endsWith('/') ? '' : '/'}${editingItem.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem),
      });
      const data = await res.json();
      setItems(prev => prev.map(c => (c.id === data.id ? data : c)));
      setEditingItem(null);
      setDetailItem(data);
    } catch (e) {
      console.error(e);
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
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
        headers: { 'Content-Type': 'application/json', 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
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
  const isPointModel = modelName === 'core.point';

  const getColumnLabel = (col: string) => {
    if (selectedFilter?.column_labels?.[col]) return selectedFilter.column_labels[col];
    const fallback = filters.find(f => f.column_labels?.[col]);
    return fallback?.column_labels?.[col] || col;
  };

  const getFieldType = (key: string) => selectedFilter?.field_types?.[key] || 'charfield';
  const isFieldRequired = (key: string) => Boolean(selectedFilter?.field_required?.[key]);
  const getFieldOptions = (key: string) => selectedFilter?.field_options?.[key] || [];
  const buildFkEndpoint = (key: string) => {
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
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
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

  const renderCellValue = (value: any) => {
    if (typeof value === 'string' && value.match(/^https?:\/\/.+\.(png|jpe?g|gif|svg|webp)$/i)) {
      return (
        <button
          className="text-water-600 hover:underline"
          onClick={() => window.open(value, '_blank')}
          title={t.viewDetails || 'Open'}
        >
          🖼️
        </button>
      );
    }
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const handleFieldChange = (key: string, value: string) => {
    setEditingItem(prev => {
      if (!prev) return prev;
      if (Array.isArray(value)) {
        return { ...prev, [key]: value };
      }
      const current = prev[key];
      const numericLike = current !== null && current !== undefined && !isNaN(Number(current));
      return { ...prev, [key]: numericLike ? Number(value) : value };
    });
  };

  useEffect(() => {
    const next: EntityRecord = {};
    createFields.forEach(col => {
      const type = getFieldType(col).toLowerCase();
      const options = getFieldOptions(col);
      if (col === 'point_type' || type === 'jsonfield') {
        next[col] = [];
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
  }, [createFields]);

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
      if (['integerfield', 'positiveintegerfield', 'bigautofield'].includes(type)) {
        jsonPayload[k] = Number(v);
      } else if (['decimalfield', 'floatfield'].includes(type)) {
        jsonPayload[k] = Number(v);
      } else if (type === 'fk') {
        jsonPayload[k] = isNaN(Number(v)) ? v : Number(v);
      } else {
        jsonPayload[k] = v;
      }
    });
    return { body: JSON.stringify(jsonPayload), headers: { 'Content-Type': 'application/json' } };
  };

  const createRecord = async () => {
    // Basic required validation before hitting the API
    const missing = createFields.filter(key => {
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
        headers: headers ?? { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
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
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-water-600 text-white hover:bg-water-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedFilter}
          >
            {t.addNew || 'Add New'}
          </button>
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
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                {columns.map(col => (
                  <th key={col} className="px-4 py-3 text-left text-slate-600 dark:text-slate-300 tracking-wider">
                    {getColumnLabel(col)}
                  </th>
                ))}
                {isPointModel && (
                  <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-300 tracking-wider">
                    {lang === 'ar' ? 'رفع / عرض القراءات' : 'Upload / View Readings'}
                  </th>
                )}
                <th className="px-4 py-3 text-left text-slate-600 dark:text-slate-300 tracking-wider">
                  {t.tableActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-500">
                    {t.processing}
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-500">
                    {t.noRows}
                  </td>
                </tr>
              ) : (
                filteredItems.map(row => (
                  <tr key={row.id ?? JSON.stringify(row)} className="border-t border-slate-100 dark:border-slate-700">
                    {columns.map(col => (
                      <td key={col} className="px-4 py-3 text-slate-800 dark:text-slate-100">
                        {renderCellValue(row[col])}
                      </td>
                    ))}
                    {isPointModel && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openReadingModal(row)}
                          className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 inline-flex items-center gap-2"
                        >
                          <Upload size={14} /> {lang === 'ar' ? 'رفع / عرض' : 'Upload / View'}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 flex gap-2">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailItem(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{detailTitle || title}</h3>
              <button onClick={() => setDetailItem(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(detailItem).map(([key, value]) => (
                <div key={key} className="p-3 rounded bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200">
                  <div className="font-semibold mb-1">{getColumnLabel(key)}</div>
                  <div className="break-words">{renderCellValue(value)}</div>
                </div>
              ))}
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
                    {readingFile.name} • {(readingFile.size / 1024).toFixed(1)} KB
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCreateOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{t.addNew || 'Add New'}</h3>
              <button onClick={() => setIsCreateOpen(false)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {createFields.map(key => {
                if (key === 'id') return null;
                const type = getFieldType(key).toLowerCase();
                const label = getColumnLabel(key);
                const isNumeric = ['integerfield', 'positiveintegerfield', 'decimalfield', 'floatfield', 'bigautofield'].includes(type);
                const isTextArea = type === 'textfield';
                const isFile = type === 'filefield';
                const isDateTime = type === 'datetimefield';
                const isFk = type.toLowerCase().startsWith('fk');
                const options = getFieldOptions(key);
                return (
                  <label key={key} className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                    <span className="font-semibold">
                      {label} {isFieldRequired(key) && <span className="text-red-500">*</span>}
                    </span>
                    {isTextArea ? (
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
                          <option key={opt} value={opt}>{opt}</option>
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
                          <option key={opt} value={opt}>{opt}</option>
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
            <div className="flex justify-end gap-2 mt-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingItem(null)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{detailTitle || title}</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(editingItem).map(([key, value]) => {
                const type = getFieldType(key).toLowerCase();
                const isNumber = value !== null && value !== undefined && !isNaN(Number(value));
                const isFk = type.startsWith('fk');
                const options = getFieldOptions(key);
                const inputType = isNumber ? 'number' : 'text';
                return (
                  <label key={key} className="text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1">
                    <span className="font-semibold">{getColumnLabel(key)}</span>
                    {key === 'point_type' && options.length ? (
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
                          <option key={opt} value={opt}>{opt}</option>
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
                          <option key={opt} value={opt}>{opt}</option>
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
            <div className="flex justify-end gap-2 mt-4">
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
    </div>
  );
};

export default MetaListView;
