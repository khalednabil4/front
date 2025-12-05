import React, { useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Language } from '../types';
import { DICTIONARY } from '../constants';
import * as XLSX from 'xlsx';
import { authFetch } from '../lib/auth';

interface RemoteTableProps { lang: Language }

type Row = Record<string, any>;

const flatten = (obj: any, prefix = ''): Row => {
    const out: Row = {};
    Object.keys(obj).forEach(k => {
        const val = obj[k];
        const key = prefix ? `${prefix}.${k}` : k;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            // Recursively flatten nested objects
            const flattened = flatten(val, key);
            Object.assign(out, flattened);
        } else if (Array.isArray(val)) {
            // Convert arrays to string representation
            out[key] = JSON.stringify(val);
        } else {
            out[key] = val;
        }
    });
    return out;
};

export const RemoteTable: React.FC<RemoteTableProps> = ({ lang }) => {
    const t = DICTIONARY[lang];
    const [rows, setRows] = useState<Row[]>([]);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<{ key: string | null; direction: 'asc' | 'desc' | null }>({ key: null, direction: null });
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Row | null>(null);
    const [editErrors, setEditErrors] = useState<Record<string, string> | null>(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newRow, setNewRow] = useState<Row | null>(null);
    const [addErrors, setAddErrors] = useState<Record<string, string> | null>(null);
    const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
            try {
                const res = await authFetch('https://jsonplaceholder.typicode.com/users');
                const data = await res.json();
                if (!mounted) return;
                // flatten each user
                const flat = data.map((d: any) => flatten(d));
                setRows(flat);
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
                if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop'));
            }
        })();
        return () => { mounted = false; };
    }, []);

    const columns = useMemo(() => {
        if (rows.length === 0) return [] as string[];
        const keys = Object.keys(rows[0]);
        return keys;
    }, [rows]);

    // Infer column types from a sample of rows and determine if field is required
    const { columnTypes, columnRequired } = useMemo(() => {
        const types: Record<string, string> = {};
        const required: Record<string, boolean> = {};
        if (!rows || rows.length === 0) return { columnTypes: types, columnRequired: required };
        const sample = rows.slice(0, 10);
        const keysSet = new Set<string>();
        sample.forEach(r => Object.keys(r).forEach(k => keysSet.add(k)));
        const keys = Array.from(keysSet);
        keys.forEach(key => {
            const counts: Record<string, number> = { number: 0, boolean: 0, email: 0, phone: 0, url: 0, date: 0, string: 0 };
            let presentCount = 0;
            sample.forEach(row => {
                const v = row[key];
                if (v === undefined || v === null || String(v).trim() === '') return;
                presentCount++;
                if (typeof v === 'number') counts.number++;
                else if (typeof v === 'boolean') counts.boolean++;
                else if (typeof v === 'string') {
                    const s = v.trim();
                    if (/^[+-]?\d+(?:\.\d+)?$/.test(s)) counts.number++;
                    else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) counts.email++;
                    else if (/^[0-9()+\-\s]{6,20}$/.test(s)) counts.phone++;
                    else if (/^https?:\/\//i.test(s)) counts.url++;
                    else if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s)) counts.date++;
                    else counts.string++;
                } else counts.string++;
            });
            // choose the max count
            let bestType = 'string';
            let bestCount = 0;
            Object.entries(counts).forEach(([k, v]) => { if (v > bestCount) { bestCount = v; bestType = k; } });
            // map 'date' to string for validation except maybe later
            if (bestType === 'date') bestType = 'string';
            types[key] = bestType;
            // consider required if present in most sample rows or key suggests required
            const keySuggestsRequired = /(^id$)|(^id\.|\.id$)|name|email|username/i.test(key);
            required[key] = keySuggestsRequired || (presentCount > sample.length * 0.7);
        });
        return { columnTypes: types, columnRequired: required };
    }, [rows]);

    const validateRow = (r: Row) => {
        const errors: Record<string, string> = {};
        columns.forEach(col => {
            const val = r[col];
            const ctype = columnTypes[col] || 'string';
            const required = columnRequired[col];
            if (required) {
                if (val === undefined || val === null || String(val).trim() === '') {
                    errors[col] = t.validation_required || 'This field is required';
                    return;
                }
            }
            if (val === undefined || val === null || String(val).trim() === '') return; // skip empty optional
            if (col.toLowerCase().includes('id')) {
                if (String(val).trim() === '') errors[col] = t.validation_id_required || 'ID is required';
            }
            if (ctype === 'number') {
                if (isNaN(Number(String(val)))) errors[col] = t.validation_must_be_number || 'Must be a number';
            }
            if (ctype === 'email') {
                const s = String(val || '');
                const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
                if (!ok) errors[col] = t.validation_invalid_email || 'Invalid email';
            }
            if (ctype === 'phone') {
                const s = String(val || '');
                const ok = /^[0-9()+\-\s]{6,20}$/.test(s);
                if (!ok) errors[col] = t.validation_invalid_phone || 'Invalid phone';
            }
            if (ctype === 'url') {
                const s = String(val || '');
                try {
                    if (s && !/^https?:\/\//i.test(s)) throw new Error('invalid');
                } catch (e) {
                    errors[col] = t.validation_invalid_url || 'Invalid URL (must start with http:// or https://)';
                }
            }
        });
        return { valid: Object.keys(errors).length === 0, errors };
    };

    const processed = useMemo(() => {
        let items = rows.filter(r => {
            if (!query) return true;
            const q = query.toLowerCase();
            return Object.values(r).some(v => String(v || '').toLowerCase().includes(q));
        });
        if (sort.key) {
            items = items.sort((a, b) => {
                const ka = a[sort.key!]; const kb = b[sort.key!];
                if (ka == null && kb == null) return 0;
                if (ka == null) return sort.direction === 'asc' ? -1 : 1;
                if (kb == null) return sort.direction === 'asc' ? 1 : -1;
                if (typeof ka === 'number' && typeof kb === 'number') return sort.direction === 'asc' ? ka - kb : kb - ka;
                return sort.direction === 'asc' ? String(ka).localeCompare(String(kb)) : String(kb).localeCompare(String(ka));
            });
        }
        return items;
    }, [rows, query, sort]);

    const totalPages = Math.max(1, Math.ceil(processed.length / rowsPerPage));
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
    const visible = useMemo(() => { const s = (page - 1) * rowsPerPage; return processed.slice(s, s + rowsPerPage); }, [processed, page, rowsPerPage]);

    const toggleSort = (key: string) => {
        setSort(prev => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            return { key: null, direction: null };
        });
    };

    const deleteRow = async (idVal: any) => {
        if (!confirm(t.confirmDelete)) return;
        const id = idVal;
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
        try {
            await authFetch(`https://jsonplaceholder.typicode.com/users/${id}`, { method: 'DELETE' });
            setRows(r => r.filter(x => x['id'] !== id));
        } catch (e) { console.error(e); alert('Delete failed'); }
        finally { if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop')); }
    };

    const saveEdit = async (updated: Row) => {
        if (!updated) return;
        const { valid, errors } = validateRow(updated || {});
        if (!valid) { setEditErrors(errors); alert(t.validation_fix_errors); return; }
        const id = updated['id'];
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
        try {
            await authFetch(`https://jsonplaceholder.typicode.com/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
            setRows(r => r.map(x => x['id'] === id ? updated : x));
            setEditing(null);
            setEditErrors(null);
        } catch (e) { console.error(e); alert('Update failed'); }
        finally { if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop')); }
    };

    const createRow = async (row: Row) => {
        const { valid, errors } = validateRow(row || {});
        if (!valid) { setAddErrors(errors); alert(t.validation_fix_errors); return; }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:start'));
        try {
            const res = await authFetch('https://jsonplaceholder.typicode.com/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
            const created = await res.json();
            // flatten created
            const flat = flatten(created);
            setRows(r => [flat, ...r]);
            setIsAddOpen(false); setNewRow(null);
            setAddErrors(null);
            setPage(1);
        } catch (e) { console.error(e); alert('Create failed'); }
        finally { if (typeof window !== 'undefined') window.dispatchEvent(new Event('app:loading:stop')); }
    };

    const exportCSV = (dataSet = processed) => {
        if (!dataSet.length) { alert(t.noRows); return; }
        const headers = columns;
        const lines = [headers.join(',')];
        dataSet.forEach(row => {
            const vals = headers.map(h => {
                const v = row[h];
                if (v == null) return '';
                return String(v).replace(/"/g, '""');
            });
            lines.push(vals.map(v => /[",\n]/.test(v) ? `"${v}"` : v).join(','));
        });
        const csv = '\uFEFF' + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `remote_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    };

    const exportXLSX = (dataSet = processed) => {
        if (!dataSet.length) { alert(t.noRows); return; }
        const headers = columns;
        const aoa = [headers, ...dataSet.map(r => headers.map(h => r[h]))];
        const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data'); XLSX.writeFile(wb, `remote_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="mt-8 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{t.newPage} - Remote</h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setIsAddOpen(true); setNewRow({}); }} className="px-3 py-2 rounded-lg bg-water-600 text-white">{t.addNew}</button>
                    <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className="px-2 py-2 rounded-lg border bg-white dark:bg-slate-900">
                        <option value="csv">CSV</option>
                        <option value="xlsx">XLSX</option>
                    </select>
                    <button onClick={() => exportFormat === 'csv' ? exportCSV(processed) : exportXLSX(processed)} className="px-3 py-2 rounded bg-white border">{t.exportCSV}</button>
                    <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder={t.searchPlaceholder} className="px-3 py-2 rounded border bg-white dark:bg-slate-900" />
                    <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="px-2 py-2 rounded-lg border bg-white dark:bg-slate-900">
                        {[5, 10, 25, 50].map(n => <option key={n} value={n}>{n} {t.rowsLabel}</option>)}
                    </select>
                </div>
            </div>

            <div className="overflow-auto">
                <table className="w-full table-auto text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-slate-500 dark:text-slate-300">
                            {columns.map(col => (
                                <th key={col} className="p-2 cursor-pointer" onClick={() => toggleSort(col)}>
                                    <div className="flex items-center gap-2">
                                        <span className="truncate">{col}</span>
                                        <span className="inline-flex items-center">
                                            {sort.key === col ? (sort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : (<><ChevronUp size={10} className="opacity-40" /><ChevronDown size={10} className="opacity-40 -mt-1" /></>)}
                                        </span>
                                    </div>
                                </th>
                            ))}
                            <th className="p-2">{t.tableActions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((r, idx) => (
                            <tr key={r['id'] ?? idx} className="border-b border-slate-100 dark:border-slate-700 hover:shadow transition hover:scale-[1.01]">
                                {columns.map(c => <td key={c} className="p-3">{String(r[c] ?? '')}</td>)}
                                <td className="p-3 flex gap-2">
                                    <button onClick={() => setEditing(r)} className="px-2 py-1 bg-slate-100 rounded">{t.edit}</button>
                                    <button onClick={() => deleteRow(r['id'])} className="px-2 py-1 bg-red-100 text-red-700 rounded">{t.delete}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-slate-500">{t.showing} {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, processed.length)} {t.of} {processed.length}</div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-slate-100">{t.prev}</button>
                    <div className="px-3">{t.page} {page} / {totalPages}</div>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded bg-slate-100">{t.next}</button>
                </div>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)}></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl shadow-lg">
                        <h3 className="text-lg font-bold mb-3">{t.editRowTitle}</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {columns.map(col => (
                                <label key={col} className="col-span-1">
                                    <div className="text-xs text-slate-500">{col}</div>
                                    <input
                                        className="w-full p-2 rounded border"
                                        value={String(editing?.[col] ?? '')}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setEditing(prev => ({ ...(prev || {}), [col]: v }));
                                            setEditErrors(prev => {
                                                if (!prev) return prev;
                                                const copy = { ...prev };
                                                delete copy[col];
                                                return Object.keys(copy).length ? copy : null;
                                            });
                                        }}
                                    />
                                    {editErrors?.[col] && <div className="text-xs text-red-600 mt-1">{editErrors[col]}</div>}
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setEditing(null)} className="px-3 py-1 rounded bg-slate-100">{t.cancel}</button>
                            <button onClick={() => editing && saveEdit(editing)} className="px-3 py-1 rounded bg-water-600 text-white">{t.save}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => { setIsAddOpen(false); setNewRow(null); }}></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl shadow-lg">
                        <h3 className="text-lg font-bold mb-3">{t.addRowTitle}</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {columns.map(col => (
                                <label key={col} className="col-span-1">
                                    <div className="text-xs text-slate-500">{col}</div>
                                    <input
                                        className="w-full p-2 rounded border"
                                        value={String(newRow?.[col] ?? '')}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setNewRow(prev => ({ ...(prev || {}), [col]: v }));
                                            setAddErrors(prev => {
                                                if (!prev) return prev;
                                                const copy = { ...prev };
                                                delete copy[col];
                                                return Object.keys(copy).length ? copy : null;
                                            });
                                        }}
                                    />
                                    {addErrors?.[col] && <div className="text-xs text-red-600 mt-1">{addErrors[col]}</div>}
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setIsAddOpen(false); setNewRow(null); setAddErrors(null); }} className="px-3 py-1 rounded bg-slate-100">{t.cancel}</button>
                            <button onClick={() => createRow(newRow || {})} className="px-3 py-1 rounded bg-water-600 text-white">{t.addNew}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RemoteTable;
