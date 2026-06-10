import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, FileDown, AlertCircle, Check, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DICTIONARY } from '../constants';
import { Language } from '../types';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

interface AreaFormProps {
  lang: Language;
}

export const AreaForm: React.FC<AreaFormProps> = ({ lang }) => {
  const t = DICTIONARY[lang];
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pointOptions, setPointOptions] = useState<{ id: number; name: string; point_type?: string[] }[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [selectedPointType, setSelectedPointType] = useState<string[]>([]);
  const [isPointTypeLoading, setIsPointTypeLoading] = useState(false);
  const hasFetchedPoints = useRef(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectedPoint = useMemo(
    () => pointOptions.find(p => String(p.id) === String(selectedPointId)),
    [pointOptions, selectedPointId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('pointId');
    const stored = window.localStorage?.getItem('water-monitoring:selectedPointId') || '';
    const next = fromQuery || stored;
    if (next) {
      setSelectedPointId(next);
      if (fromQuery) {
        try { window.localStorage?.setItem('water-monitoring:selectedPointId', next); } catch { /* ignore */ }
      }
    }
  }, []);

  const effectivePointTypes = useMemo(() => {
    if (selectedPointType.length) return selectedPointType;
    if (Array.isArray(selectedPoint?.point_type)) return selectedPoint.point_type;
    return [];
  }, [selectedPointType, selectedPoint]);

  const pointTypesForSubmit = useMemo(() => {
    const next = new Set<string>((effectivePointTypes || []).map(pt => String(pt || '').toLowerCase()));
    if (columnMapping.some(field => field === 'tutalizer')) {
      next.add('totalizer');
    }
    return Array.from(next);
  }, [effectivePointTypes, columnMapping]);

  const availableFields = useMemo(() => {
    const types = effectivePointTypes.map(pt => String(pt || '').toLowerCase());
    const hasFlow = types.includes('flow');
    const hasPressure = types.includes('pressure');
    const hasLevel = types.includes('level');
    const base = [{ key: 'ignore', label: t.ignoreColumn || 'Ignore' }];
    const fields: { key: string; label: string }[] = [
      { key: 'datetime', label: lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time' },
      { key: 'tutalizer', label: lang === 'ar' ? 'توتالايزر' : 'Tutalizer' },
    ];
    if (hasFlow) fields.push({ key: 'flow', label: t.flowRate || 'Flow' });
    if (hasPressure) fields.push({ key: 'pressure', label: t.pressure || 'Pressure' });
    if (hasLevel) fields.push({ key: 'level', label: 'Level' });
    return base.concat(fields);
  }, [effectivePointTypes, t, lang]);

  const multiMapFields = useMemo(() => new Set(['flow', 'pressure', 'level', 'tutalizer']), []);
  const technicalUploadColumns = useMemo(() => new Set(['id', 'index', 'trigger', 'scale']), []);
  const normalizeUploadHeader = (value: string) => (
    String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_')
  );

  const parseExcelFile = (file: File): Promise<{ headers: string[]; rows: string[][] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheet];
          const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
          if (!allRows.length) {
            resolve({ headers: [], rows: [] });
            return;
          }
          const headers = (allRows[0] || []).map(h => (h === undefined || h === null || h === '' ? '' : String(h)));
          const rows = (allRows.slice(1) || []).map(r => r.map(cell => (cell === undefined || cell === null ? '' : String(cell))));
          resolve({ headers, rows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    if (!selectedPoint) {
      setUploadError(lang === 'ar' ? 'يرجى اختيار نقطة أولاً' : 'Please select a point first');
      return;
    }
    if (isPointTypeLoading) {
      setUploadError(t.processing || (lang === 'ar' ? 'جارِ المعالجة...' : 'Processing...'));
      return;
    }
    setIsProcessing(true);
    setUploadError(null);
    setExcelFile(file);
    try {
      const { headers, rows } = await parseExcelFile(file);
      const inferredHeaders = headers.length ? headers : (rows[0] || []).map((_, idx) => `${t.column || 'Column'} ${idx + 1}`);
      const visibleIndexes = inferredHeaders
        .map((header, index) => ({ header, index }))
        .filter(item => !technicalUploadColumns.has(normalizeUploadHeader(item.header)))
        .map(item => item.index);
      const visibleHeaders = visibleIndexes.map(index => inferredHeaders[index]);
      const visibleRows = rows.map(row => visibleIndexes.map(index => row[index] ?? ''));
      setPreviewHeaders(visibleHeaders);
      setPreviewData(visibleRows.slice(0, 10));
      setColumnMapping(new Array(visibleHeaders.length || 0).fill('ignore'));
    } catch (err) {
      console.error('Failed to parse excel', err);
      const msg = err instanceof Error ? err.message : (lang === 'ar' ? 'فشل الرفع' : 'Upload failed');
      setUploadError(msg);
      setExcelFile(null);
      setPreviewHeaders([]);
      setPreviewData([]);
      setColumnMapping([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPoint) {
      setUploadError(lang === 'ar' ? 'يرجى اختيار نقطة أولاً' : 'Please select a point first');
      return;
    }
    if (!excelFile) {
      setUploadError(lang === 'ar' ? 'يرجى رفع ملف إكسل' : 'Please upload an Excel file');
      return;
    }
    if (!columnMapping.length) {
      setUploadError(lang === 'ar' ? 'لم يتم العثور على أعمدة للمطابقة' : 'No columns detected to map');
      return;
    }
    const payloadJson = {
      point_id: selectedPoint.id,
      point_type: pointTypesForSubmit,
      mapping: columnMapping,
      headers: previewHeaders,
      file: { name: excelFile.name, size: excelFile.size, type: excelFile.type },
    };
    const formData = new FormData();
    formData.append('point_id', String(selectedPoint.id));
    formData.append('point_type', JSON.stringify(pointTypesForSubmit || []));
    formData.append('mapping', JSON.stringify(columnMapping));
    formData.append('headers', JSON.stringify(previewHeaders));
    formData.append('file', excelFile);
    setIsProcessing(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/core/upload-reading/`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Upload failed');
      }
      setSuccessMessage(t.importSuccess);
      setExcelFile(null);
      setPreviewHeaders([]);
      setPreviewData([]);
      setColumnMapping([]);
    } catch (e) {
      console.error('Upload reading failed', e);
      const msg = e instanceof Error ? e.message : (lang === 'ar' ? 'فشل الرفع' : 'Upload failed');
      setUploadError(msg);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

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
        if (!cancelled) {
          setSelectedPointType(normalized);
          setPointOptions(prev =>
            prev.map(p => (String(p.id) === String(selectedPointId) ? { ...p, point_type: normalized } : p))
          );
        }
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

  useEffect(() => {
    if (hasFetchedPoints.current) return;
    hasFetchedPoints.current = true;
    const loadPoints = async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/core/points/`, {
          headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
        });
        const data = await res.json();
        const list = Array.isArray(data?.results) ? data.results : [];
        setPointOptions(list.map((p: any) => ({ id: p.id, name: p.name || p.code || `#${p.id}`, point_type: p.point_type || [] })));
      } catch (e) {
        console.error('Failed to fetch points list', e);
      }
    };
    loadPoints();
  }, [lang]);

  const columnsForDisplay = previewHeaders.length ? previewHeaders : (previewData[0] || []);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300 min-h-[600px] flex flex-col">
      {successMessage && (
        <div className={`fixed top-6 z-[80] ${lang === 'ar' ? 'left-6' : 'right-6'}`}>
          <div className="flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-xl shadow-xl">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
              <Check size={18} />
            </div>
            <div className="text-sm font-semibold">{successMessage}</div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="ml-2 px-2 py-1 rounded hover:bg-white/10 text-white/90"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="border-b border-slate-100 dark:border-slate-700">
        <div className="p-6 md:p-8 pb-0">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{t.areas}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{t.addNewArea}</p>
            </div>
            <div className="w-56">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                {t.points}
              </label>
              <select
                value={selectedPointId}
                onChange={e => {
                  setSelectedPointId(e.target.value);
                  try { window.localStorage?.setItem('water-monitoring:selectedPointId', e.target.value); } catch { /* ignore */ }
                  setUploadError(null);
                  setExcelFile(null);
                  setPreviewHeaders([]);
                  setPreviewData([]);
                  setColumnMapping([]);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
              >
                <option value="">{lang === 'ar' ? 'اختر نقطة' : 'Select point'}</option>
                {pointOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {selectedPointId && isPointTypeLoading && (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t.processing || 'Loading...'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 flex-1">
        <div className="animate-in fade-in duration-300 h-full">
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            {!excelFile ? (
              <>
                <div
                  className="relative w-full max-w-2xl h-64 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-water-400 dark:hover:border-water-500 flex flex-col items-center justify-center cursor-pointer transition-all group"
                  onClick={() => {
                    if (!selectedPoint) {
                      setUploadError(lang === 'ar' ? 'يرجى اختيار نقطة أولاً' : 'Please select a point first');
                      return;
                    }
                    document.getElementById('file-upload')?.click();
                  }}
                >
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full shadow-md flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <FileSpreadsheet className="w-8 h-8 text-water-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">{t.dragDrop}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{t.browseFiles}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                    <AlertCircle size={14} />
                    <span>{lang === 'ar' ? 'سيتم استخدام الصف الأول كعناوين' : 'First row will be used as headers'}</span>
                  </div>
                  {uploadError && (
                    <div className="mt-3 text-sm text-red-600 dark:text-red-400">{uploadError}</div>
                  )}
                </div>
                <button className="flex items-center gap-2 text-slate-500 hover:text-water-600 dark:text-slate-400 dark:hover:text-water-400 text-sm font-medium mt-2 transition-colors">
                  <FileDown size={16} />
                  {t.downloadTemplate}
                </button>
              </>
            ) : (
              <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 p-6 text-center">
                {isProcessing ? (
                  <div className="py-12">
                    <div className="w-10 h-10 border-4 border-water-200 border-t-water-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">{t.processing}</p>
                  </div>
                ) : (
                  <div className="py-6 space-y-6">
                    <div className="flex items-center justify-center gap-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl text-green-600 dark:text-green-400">
                        <FileSpreadsheet size={40} />
                      </div>
                      <div className="text-start">
                        <p className="text-lg font-bold text-slate-800 dark:text-white">{excelFile.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{(excelFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="overflow-auto max-h-64 border border-slate-100 dark:border-slate-700 rounded-lg">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                          <tr>
                            {columnsForDisplay.map((header, idx) => {
                              const headerLabel = header || `${t.column || 'Column'} ${String.fromCharCode(65 + idx)}`;
                              return (
                                <th key={idx} className="px-3 py-2 text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold">{headerLabel}</span>
                                    <select
                                      value={columnMapping[idx] || 'ignore'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setColumnMapping(prev => {
                                          const next = [...prev];
                                          next[idx] = val;
                                          return next;
                                        });
                                      }}
                                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
                                    >
                                      {availableFields
                                        .filter(field => (
                                          field.key === 'ignore'
                                          || field.key === columnMapping[idx]
                                          || multiMapFields.has(field.key)
                                          || !columnMapping.includes(field.key)
                                        ))
                                        .map(field => (
                                          <option key={field.key} value={field.key}>{field.label}</option>
                                        ))}
                                    </select>
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-slate-100 dark:border-slate-700">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 text-slate-800 dark:text-slate-200">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                      <button
                        onClick={() => { setExcelFile(null); setPreviewHeaders([]); setPreviewData([]); setColumnMapping([]); }}
                        className="px-4 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
                      >
                        {t.removeFile}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={!selectedPoint}
                        className={`px-6 py-2 rounded-lg shadow-lg shadow-water-500/20 transition-all text-sm font-bold flex items-center gap-2
                          ${!selectedPoint ? 'bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600' : 'bg-water-600 text-white hover:bg-water-700'}
                        `}
                      >
                        <Save size={16} />
                        {t.save}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
