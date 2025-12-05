import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, FileDown, AlertCircle, Check, Save } from 'lucide-react';
import { DICTIONARY } from '../constants';
import { Language } from '../types';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://8de77a78ce9b.ngrok-free.app').replace(/\/$/, '');

interface AreaFormProps {
  lang: Language;
}

export const AreaForm: React.FC<AreaFormProps> = ({ lang }) => {
  const t = DICTIONARY[lang];
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pointOptions, setPointOptions] = useState<{ id: number; name: string; point_type?: string[] }[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const hasFetchedPoints = useRef(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectedPoint = useMemo(
    () => pointOptions.find(p => String(p.id) === String(selectedPointId)),
    [pointOptions, selectedPointId]
  );

  const availableFields = useMemo(() => {
    const types = Array.isArray(selectedPoint?.point_type)
      ? selectedPoint.point_type.map(pt => String(pt || '').toLowerCase())
      : [];
    const hasFlow = types.includes('flow');
    const hasPressure = types.includes('pressure');
    const base = [{ key: 'ignore', label: t.ignoreColumn || 'Ignore' }];
    const fields: { key: string; label: string }[] = [
      { key: 'datetime', label: lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time' },
    ];
    if (hasFlow) fields.push({ key: 'flow', label: t.flowRate || 'Flow' });
    if (hasPressure) fields.push({ key: 'pressure', label: t.pressure || 'Pressure' });
    return base.concat(fields);
  }, [selectedPoint, t, lang]);

  const handleFileSelect = (file: File) => {
    if (!selectedPoint) {
      setUploadError(lang === 'ar' ? 'يرجى اختيار نقطة أولاً' : 'Please select a point first');
      return;
    }
    setUploadError(null);
    setExcelFile(file);
    // Mock preview data to show columns/rows; replace with real parsing when available
    const dummyData = [
      ['2025-12-16 10:04:44', '300', '200'],
      ['2025-12-16 09:51:20', '400', '300'],
    ];
    setPreviewData(dummyData);
    setColumnMapping(new Array(dummyData[0]?.length || 0).fill('ignore'));
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
    const payloadJson = {
      point_id: selectedPoint.id,
      point_type: selectedPoint.point_type,
      mapping: columnMapping,
      file: { name: excelFile.name, size: excelFile.size, type: excelFile.type },
    };
    console.log('Area Excel submission', payloadJson);
    const formData = new FormData();
    formData.append('point_id', String(selectedPoint.id));
    formData.append('point_type', JSON.stringify(selectedPoint.point_type || []));
    formData.append('mapping', JSON.stringify(columnMapping));
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
      setPreviewData([]);
    } catch (e: any) {
      console.error('Upload reading failed', e);
      setUploadError(e?.message || (lang === 'ar' ? 'فشل الرفع' : 'Upload failed'));
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300 min-h-[600px] flex flex-col">
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
                onChange={e => { setSelectedPointId(e.target.value); setUploadError(null); }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
              >
                <option value="">{lang === 'ar' ? 'اختر نقطة' : 'Select point'}</option>
                {pointOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 flex-1">
        {successMessage ? (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in py-20">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-4">
              <Check size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{successMessage}</h3>
          </div>
        ) : (
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
                      <span>{t.noHeaderMode}</span>
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
                                        {previewData[0]?.map((_, idx) => (
                                          <th key={idx} className="px-3 py-2 text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700">
                                            <div className="flex flex-col gap-1">
                                              <span>{t.column} {String.fromCharCode(65 + idx)}</span>
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
                                                  .filter(field => field.key === 'ignore' || field.key === columnMapping[idx] || !columnMapping.includes(field.key))
                                                  .map(field => (
                                                    <option key={field.key} value={field.key}>{field.label}</option>
                                                  ))}
                                              </select>
                                            </div>
                                          </th>
                                        ))}
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
                                        onClick={() => { setExcelFile(null); }}
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
        )}
      </div>
    </div>
  );
};
