import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarRange, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { authFetch } from '../lib/auth';
import { Language } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

type DmType = 'dma' | 'dmz' | '';

type DmOption = { value: string; label: string; code?: string };

type ReportPoint = {
  id: number | string;
  name?: string;
  code?: string;
  readings_count?: number;
  totalizer_min?: number | string;
  totalizer_max?: number | string;
  water_in_month?: number | string;
  unit_totalizer?: string;
};

type ReportResponse = {
  dm?: { id?: number | string; type?: string; name?: string };
  month?: string;
  date_from?: string;
  date_to?: string;
  points?: ReportPoint[];
  total_water_in_month?: number | string;
};

type RowState = {
  pointId: string;
  pointName: string;
  pointCode: string;
  waterInMonth: number;
  unit?: string;
  readingsCount?: number;
  totalizerMin?: number | null;
  totalizerMax?: number | null;
  beforeAfter: string;
  subscriberShare?: number | '';
  population?: number | '';
  populationShare?: number | '';
  billedWater?: number | '';
  meterErrors?: number | '';
  registrationErrors?: number | '';
  illegalLoss?: number | '';
  technicalLoss?: number | '';
};

const safeNumber = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const monthString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const ReportV1Page: React.FC<{ lang: Language }> = ({ lang }) => {
  const [dmType, setDmType] = useState<DmType>('');
  const [dmOptions, setDmOptions] = useState<DmOption[]>([]);
  const [selectedDmId, setSelectedDmId] = useState<string>('');
  const [month, setMonth] = useState<string>(monthString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);

  const templateHref = useMemo(() => `${import.meta.env.BASE_URL}assets/r1.xlsx`, []);

  const dmLabel = useMemo(() => (dmType === 'dma' ? 'DMA' : dmType === 'dmz' ? 'DMZ' : ''), [dmType]);

  const loadDmOptions = async (type: DmType) => {
    if (!type) return;
    const endpoint = type === 'dma' ? '/core/dma/' : '/core/dmz/';
    try {
      const res = await authFetch(`${API_BASE_URL}${endpoint}?limit=200`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const data = await res.json().catch(() => null);
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const mapped: DmOption[] = items.map((dm: any) => ({
        value: String(dm?.id ?? ''),
        label: dm?.name || dm?.code || `#${dm?.id ?? ''}`,
        code: dm?.code,
      }));
      setDmOptions(mapped);
    } catch (e) {
      console.error('Failed to load DM options', e);
      setDmOptions([]);
    }
  };

  useEffect(() => {
    setSelectedDmId('');
    setDmOptions([]);
    setReport(null);
    setRows([]);
    setError(null);
  }, [dmType]);

  useEffect(() => {
    if (!dmType) return;
    loadDmOptions(dmType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmType, lang]);

  const fetchReport = async () => {
    if (!dmType || !month || !selectedDmId) {
      setError(lang === 'ar' ? 'اختر الشهر والمنطقة أولاً' : 'Select month and area first');
      return;
    }
    setIsLoading(true);
    setError(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
    try {
      const params = new URLSearchParams();
      params.append('month', month);
      if (dmType === 'dma') params.append('dma_id', selectedDmId);
      else if (dmType === 'dmz') params.append('dmz_id', selectedDmId);
      const res = await authFetch(`${API_BASE_URL}/core/report-v1/?${params.toString()}`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      const data: ReportResponse = await res.json();
      if (!res.ok) {
        const msg = (data as any)?.detail || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }
      setReport(data);
      const mapped: RowState[] = (data?.points || []).map((pt, idx) => ({
        pointId: String(pt.id ?? idx),
        pointName: pt.name || pt.code || `#${pt.id ?? idx + 1}`,
        pointCode: pt.code || '',
        waterInMonth: safeNumber(pt.water_in_month),
        unit: pt.unit_totalizer || 'm3',
        readingsCount: safeNumber(pt.readings_count),
        totalizerMin: pt.totalizer_min != null ? safeNumber(pt.totalizer_min) : null,
        totalizerMax: pt.totalizer_max != null ? safeNumber(pt.totalizer_max) : null,
        beforeAfter: '',
        subscriberShare: '',
        population: '',
        populationShare: '',
        billedWater: '',
        meterErrors: '',
        registrationErrors: '',
        illegalLoss: '',
        technicalLoss: '',
      }));
      setRows(mapped);
    } catch (e: any) {
      console.error('Failed to load report v1', e);
      setReport(null);
      setRows([]);
      setError(e?.message || 'Failed to load report');
    } finally {
      setIsLoading(false);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
    }
  };

  const updateRow = (pointId: string, key: keyof RowState, value: any) => {
    setRows(prev =>
      prev.map(r => (r.pointId === pointId ? { ...r, [key]: value } : r))
    );
  };

  const totals = useMemo(() => {
    let water = 0;
    let totalLoss = 0;
    let commercialLoss = 0;
    rows.forEach(r => {
      const meter = safeNumber(r.meterErrors);
      const reg = safeNumber(r.registrationErrors);
      const illegal = safeNumber(r.illegalLoss);
      const tech = safeNumber(r.technicalLoss);
      const comm = meter + reg + illegal;
      commercialLoss += comm;
      totalLoss += comm + tech;
      water += safeNumber(r.waterInMonth);
    });
    return { water, totalLoss, commercialLoss };
  }, [rows]);

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">تقرير الفاقد الشهري (Report V1)</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileSpreadsheet size={22} />
            {dmLabel} Report V1
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={templateHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download size={16} />
            {lang === 'ar' ? 'تنزيل القالب (Excel)' : 'Download template'}
          </a>
          <button
            type="button"
            onClick={fetchReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-water-600 text-white hover:bg-water-700 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            {lang === 'ar' ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">{lang === 'ar' ? 'الشهر' : 'Month'}</span>
            <div className="flex items-center gap-2">
              <CalendarRange size={16} className="text-slate-400" />
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">النوع</span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                className={`px-3 py-2 text-sm ${dmType === 'dma' ? 'bg-water-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}
                onClick={() => setDmType('dma')}
              >
                DMA
              </button>
              <button
                className={`px-3 py-2 text-sm ${dmType === 'dmz' ? 'bg-water-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}
                onClick={() => setDmType('dmz')}
              >
                DMZ
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">{dmType === 'dma' ? 'اختر DMA' : 'اختر DMZ'}</span>
            <select
              key={dmType || 'none'}
              value={selectedDmId || '__placeholder__'}
              onChange={e => {
                const val = e.target.value;
                if (!val || val === '__placeholder__') return;
                setSelectedDmId(val);
              }}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              disabled={!dmType}
            >
              {!dmOptions.length && <option value="">{lang === 'ar' ? 'لا يوجد' : 'No data'}</option>}
              {dmOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value="__placeholder__" disabled>
                {dmType ? `${lang === 'ar' ? 'اختر' : 'Select'} ${dmLabel}` : lang === 'ar' ? 'اختر النوع أولاً' : 'Select type first'}
              </option>
            </select>
          </div>

          <div className="flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-500 mt-0.5" />
              <div>
                الحقول التالية تُدخل يدويًا: نسبة عدد المشتركين، عدد السكان، كمية المياه المحاسب عليها، الأخطاء (العدادات/القراءات/الخلسة)، والفقد الفني.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-emerald-500 mt-0.5" />
              <div>يتم جلب كمية المياه الداخلة شهريًا لكل نقطة من واجهة /core/report-v1/ وتستخدم لحساب نسبة الفاقد (T ÷ N).</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">اسم المنطقة</div>
          <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {report?.dm?.name || dmOptions.find(o => o.value === selectedDmId)?.label || '-'}
          </div>
          <div className="text-xs text-slate-400">{dmType ? dmType.toUpperCase() : '-'}</div>
        </div>
        <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي كمية المياه الداخلة (م3/شهر)</div>
          <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {report?.total_water_in_month != null ? safeNumber(report.total_water_in_month).toLocaleString() : totals.water.toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي الفاقد (م3)</div>
          <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {totals.totalLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-x-auto">
        <table className="min-w-[1200px] w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="text-slate-600 dark:text-slate-300">
              <th className="px-2 py-2 text-left">م</th>
              <th className="px-2 py-2 text-left">إسم المنطقة الكبري DMZ</th>
              <th className="px-2 py-2 text-left">كود المنطقة الصغري DMA</th>
              <th className="px-2 py-2 text-left">إسم المنطقة الصغري DMA</th>
              <th className="px-2 py-2 text-left">قبل/بعد</th>
              <th className="px-2 py-2 text-left">نسبة عدد المشتركين %</th>
              <th className="px-2 py-2 text-left">عدد السكان بالمنطقة</th>
              <th className="px-2 py-2 text-left">نسبة السكان %</th>
              <th className="px-2 py-2 text-left">كمية المياه الداخلة (N)</th>
              <th className="px-2 py-2 text-left">كمية المياه المحاسب عليها</th>
              <th className="px-2 py-2 text-left">الكمية نتيجة أخطاء العدادات</th>
              <th className="px-2 py-2 text-left">الكمية نتيجة أخطاء التسجيل والقراءات</th>
              <th className="px-2 py-2 text-left">الكمية المهدرة نتيجة الوصلات الخلسة</th>
              <th className="px-2 py-2 text-left">كمية الفاقد الفني (تسربات)</th>
              <th className="px-2 py-2 text-left">كمية الفاقد التجاري (P+Q+R)</th>
              <th className="px-2 py-2 text-left">إجمالى كمية الفاقد (T)</th>
              <th className="px-2 py-2 text-left">نسبة الفاقد الكلي % = T/N</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={17} className="px-3 py-4 text-center text-slate-500 dark:text-slate-300">
                  {isLoading ? (lang === 'ar' ? 'جارٍ التحميل...' : 'Loading...') : (lang === 'ar' ? 'لا توجد بيانات حتى الآن' : 'No data yet')}
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const meter = safeNumber(row.meterErrors);
              const reg = safeNumber(row.registrationErrors);
              const illegal = safeNumber(row.illegalLoss);
              const tech = safeNumber(row.technicalLoss);
              const commercial = meter + reg + illegal;
              const totalLoss = commercial + tech;
              const lossPercent = row.waterInMonth ? (totalLoss / row.waterInMonth) * 100 : 0;
              return (
                <tr key={row.pointId} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-2 py-2 font-semibold text-slate-700 dark:text-slate-100">{idx + 1}</td>
                  <td className="px-2 py-2">{report?.dm?.name || '-'}</td>
                  <td className="px-2 py-2">{row.pointCode || '-'}</td>
                  <td className="px-2 py-2">{row.pointName}</td>
                  <td className="px-2 py-2">
                    <input
                      value={row.beforeAfter}
                      onChange={e => updateRow(row.pointId, 'beforeAfter', e.target.value)}
                      className="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.subscriberShare ?? ''}
                      onChange={e => updateRow(row.pointId, 'subscriberShare', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.population ?? ''}
                      onChange={e => updateRow(row.pointId, 'population', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.populationShare ?? ''}
                      onChange={e => updateRow(row.pointId, 'populationShare', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-100">
                    {safeNumber(row.waterInMonth).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.billedWater ?? ''}
                      onChange={e => updateRow(row.pointId, 'billedWater', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.meterErrors ?? ''}
                      onChange={e => updateRow(row.pointId, 'meterErrors', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.registrationErrors ?? ''}
                      onChange={e => updateRow(row.pointId, 'registrationErrors', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.illegalLoss ?? ''}
                      onChange={e => updateRow(row.pointId, 'illegalLoss', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={row.technicalLoss ?? ''}
                      onChange={e => updateRow(row.pointId, 'technicalLoss', e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-28 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-100">
                    {commercial.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-100">
                    {totalLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-100">
                    {lossPercent.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportV1Page;
