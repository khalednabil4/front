import React, { useMemo, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Language } from '../types';
import { DICTIONARY, MOCK_DYNAMIC_DATA } from '../constants';
import RemoteTable from './RemoteTable';

interface NewPageProps {
    lang: Language;
}

type Employee = {
    id: string;
    fullName: string;
    role: string;
    department?: string;
    joiningDate?: string; // ISO date string
    isActive: boolean;
    salary?: number;
};

type SortConfig = { key: keyof Employee | null; direction: 'asc' | 'desc' | null };

export const NewPage: React.FC<NewPageProps> = ({ lang }) => {
    const t = DICTIONARY[lang];

    // Initialize from mock data (map to Employee shape)
    const initialData: Employee[] = useMemo(() => {
        return MOCK_DYNAMIC_DATA.map((d: any) => ({
            id: d.id,
            fullName: d.fullName,
            role: d.role,
            department: d.department || '',
            joiningDate: d.joiningDate || '',
            isActive: !!d.isActive,
            salary: typeof d.salary === 'number' ? d.salary : Number(d.salary) || 0,
        }));
    }, []);

    const [data, setData] = useState<Employee[]>(initialData);
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortConfig>({ key: null, direction: null });
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);
    const [page, setPage] = useState<number>(1);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newRow, setNewRow] = useState<Employee | null>(null);

    // Derived filtered + sorted data
    const processed = useMemo(() => {
        let items = data.filter(d => {
            if (!query) return true;
            const q = query.toLowerCase();
            return (
                d.fullName.toLowerCase().includes(q) ||
                d.role.toLowerCase().includes(q) ||
                (d.department || '').toLowerCase().includes(q)
            );
        });

        if (sort.key) {
            items = items.sort((a, b) => {
                const ka = a[sort.key!];
                const kb = b[sort.key!];
                if (ka == null && kb == null) return 0;
                if (ka == null) return sort.direction === 'asc' ? -1 : 1;
                if (kb == null) return sort.direction === 'asc' ? 1 : -1;
                if (typeof ka === 'number' && typeof kb === 'number') {
                    return sort.direction === 'asc' ? ka - kb : kb - ka;
                }
                return sort.direction === 'asc'
                    ? String(ka).localeCompare(String(kb))
                    : String(kb).localeCompare(String(ka));
            });
        }
        return items;
    }, [data, query, sort]);

    const totalPages = Math.max(1, Math.ceil(processed.length / rowsPerPage));

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const visible = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return processed.slice(start, start + rowsPerPage);
    }, [processed, page, rowsPerPage]);

    const toggleSort = (key: keyof Employee) => {
        setSort(prev => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            return { key: null, direction: null };
        });
    };

    const deleteRow = (id: string) => {
        if (!confirm(t.confirmDelete)) return;
        setData(d => d.filter(x => x.id !== id));
    };

    const saveEdit = (updated: Employee) => {
        setData(d => d.map(x => (x.id === updated.id ? updated : x)));
        setEditing(null);
    };

    const toggleActive = (id: string) => {
        setData(d => d.map(x => (x.id === id ? { ...x, isActive: !x.isActive } : x)));
    };

    const exportToCSV = (rows = processed) => {
        if (!rows || rows.length === 0) { alert(t.noRows); return; }
        const headers = [t.tableFullName, t.tableRole, t.tableDepartment, t.tableJoiningDate, t.tableStatus, t.tableSalary, t.tableActive];
        const escape = (v: any) => {
            if (v === null || v === undefined) return '';
            if (typeof v === 'boolean') return v ? t.tableActive : t.tableInactive;
            return String(v).replace(/"/g, '""');
        };
        const lines: string[] = [];
        lines.push(headers.map(h => `"${h}"`).join(','));
        rows.forEach(r => {
            const rowArr = [r.fullName, r.role, r.department, r.joiningDate, r.isActive ? t.tableActive : t.tableInactive, r.salary ?? ''];
            const line = rowArr.map(v => {
                const esc = escape(v);
                return /[",\n]/.test(esc) ? `"${esc}"` : esc;
            }).join(',');
            lines.push(line);
        });
        const csv = '\uFEFF' + lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `employees_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t.newPage}</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setIsAddOpen(true); setNewRow({ id: '', fullName: '', role: '', department: '', joiningDate: '', isActive: true, salary: 0 }); }} className="px-3 py-2 rounded-lg bg-water-600 text-white">{t.addNew}</button>
                    <button onClick={() => exportToCSV(processed)} className="px-3 py-2 rounded-lg bg-white border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">{t.exportCSV}</button>
                    <input
                        value={query}
                        onChange={e => { setQuery(e.target.value); setPage(1); }}
                        placeholder={t.searchPlaceholder}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                    />
                    <select
                        value={rowsPerPage}
                        onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                        className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                    >
                        {[5, 10, 25, 50].map(n => (
                            <option key={n} value={n}>{n} {t.rowsLabel}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="overflow-auto">
                <table className="w-full table-auto text-sm border-collapse">
                    <thead>
                        <tr className="text-left text-slate-500 dark:text-slate-300">
                            <th className="p-2 cursor-pointer" onClick={() => toggleSort('fullName')}>
                                <div className="flex items-center gap-2">
                                    <span>{t.tableFullName}</span>
                                    <span className="inline-flex items-center">
                                        {sort.key === 'fullName' ? (
                                            sort.direction === 'asc' ? <ChevronUp size={14} className="text-water-600" /> : <ChevronDown size={14} className="text-water-600" />
                                        ) : (
                                            <>
                                                <ChevronUp size={10} className="opacity-40" />
                                                <ChevronDown size={10} className="opacity-40 -mt-1" />
                                            </>
                                        )}
                                    </span>
                                </div>
                            </th>
                            <th className="p-2 cursor-pointer" onClick={() => toggleSort('role')}>
                                <div className="flex items-center gap-2">
                                    <span>{t.tableRole}</span>
                                    <span className="inline-flex items-center">
                                        {sort.key === 'role' ? (
                                            sort.direction === 'asc' ? <ChevronUp size={14} className="text-water-600" /> : <ChevronDown size={14} className="text-water-600" />
                                        ) : (
                                            <>
                                                <ChevronUp size={10} className="opacity-40" />
                                                <ChevronDown size={10} className="opacity-40 -mt-1" />
                                            </>
                                        )}
                                    </span>
                                </div>
                            </th>
                            <th className="p-2 cursor-pointer" onClick={() => toggleSort('department')}>
                                <div className="flex items-center gap-2">
                                    <span>{t.tableDepartment}</span>
                                    <span className="inline-flex items-center">
                                        {sort.key === 'department' ? (
                                            sort.direction === 'asc' ? <ChevronUp size={14} className="text-water-600" /> : <ChevronDown size={14} className="text-water-600" />
                                        ) : (
                                            <>
                                                <ChevronUp size={10} className="opacity-40" />
                                                <ChevronDown size={10} className="opacity-40 -mt-1" />
                                            </>
                                        )}
                                    </span>
                                </div>
                            </th>
                            <th className="p-2 cursor-pointer" onClick={() => toggleSort('joiningDate')}>
                                <div className="flex items-center gap-2">
                                    <span>{t.tableJoiningDate}</span>
                                    <span className="inline-flex items-center">
                                        {sort.key === 'joiningDate' ? (
                                            sort.direction === 'asc' ? <ChevronUp size={14} className="text-water-600" /> : <ChevronDown size={14} className="text-water-600" />
                                        ) : (
                                            <>
                                                <ChevronUp size={10} className="opacity-40" />
                                                <ChevronDown size={10} className="opacity-40 -mt-1" />
                                            </>
                                        )}
                                    </span>
                                </div>
                            </th>
                            <th className="p-2">{t.tableStatus}</th>
                            <th className="p-2 cursor-pointer" onClick={() => toggleSort('salary')}>
                                <div className="flex items-center gap-2">
                                    <span>{t.tableSalary}</span>
                                    <span className="inline-flex items-center">
                                        {sort.key === 'salary' ? (
                                            sort.direction === 'asc' ? <ChevronUp size={14} className="text-water-600" /> : <ChevronDown size={14} className="text-water-600" />
                                        ) : (
                                            <>
                                                <ChevronUp size={10} className="opacity-40" />
                                                <ChevronDown size={10} className="opacity-40 -mt-1" />
                                            </>
                                        )}
                                    </span>
                                </div>
                            </th>
                            <th className="p-2">{t.tableActive}</th>
                            <th className="p-2">{t.tableActions}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map(row => (
                            <tr key={row.id} className="bg-white dark:bg-slate-800 hover:shadow-md transition transform hover:scale-[1.01] border-b border-slate-100 dark:border-slate-700">
                                <td className="p-3">{row.fullName}</td>
                                <td className="p-3">{row.role}</td>
                                <td className="p-3">{row.department}</td>
                                <td className="p-3">{row.joiningDate}</td>
                                <td className="p-3">{row.isActive ? <span className="text-green-600 font-medium">{t.tableActive}</span> : <span className="text-slate-500">{t.tableInactive}</span>}</td>
                                <td className="p-3">{row.salary?.toLocaleString?.() ?? row.salary}</td>
                                <td className="p-3">
                                    <input type="checkbox" checked={row.isActive} onChange={() => toggleActive(row.id)} />
                                </td>
                                <td className="p-3 flex gap-2">
                                    <button onClick={() => setEditing(row)} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">{t.edit}</button>
                                    <button onClick={() => deleteRow(row.id)} className="px-2 py-1 bg-red-100 text-red-700 rounded">{t.delete}</button>
                                </td>
                            </tr>
                        ))}
                        {visible.length === 0 && (
                            <tr><td colSpan={8} className="p-6 text-center text-slate-500">{t.noRows}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-slate-500">{t.showing} {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, processed.length)} {t.of} {processed.length}</div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700">{t.prev}</button>
                    <div className="px-3">{t.page} {page} / {totalPages}</div>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700">{t.next}</button>
                </div>
            </div>

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)}></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-lg shadow-lg">
                        <h3 className="text-lg font-bold mb-3">{t.editRowTitle}</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="col-span-2">
                                <div className="text-xs text-slate-500">{t.tableFullName}</div>
                                <input className="w-full p-2 rounded border" value={editing.fullName} onChange={e => setEditing({ ...editing, fullName: e.target.value })} />
                            </label>
                            <label>
                                <div className="text-xs text-slate-500">{t.tableRole}</div>
                                <input className="w-full p-2 rounded border" value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} />
                            </label>
                            <label>
                                <div className="text-xs text-slate-500">{t.tableDepartment}</div>
                                <input className="w-full p-2 rounded border" value={editing.department} onChange={e => setEditing({ ...editing, department: e.target.value })} />
                            </label>
                            <label>
                                <div className="text-xs text-slate-500">{t.tableJoiningDate}</div>
                                <input type="date" className="w-full p-2 rounded border" value={editing.joiningDate} onChange={e => setEditing({ ...editing, joiningDate: e.target.value })} />
                            </label>
                            <label>
                                <div className="text-xs text-slate-500">{t.tableSalary}</div>
                                <input type="number" className="w-full p-2 rounded border" value={String(editing.salary ?? '')} onChange={e => setEditing({ ...editing, salary: Number(e.target.value) })} />
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />
                                <div className="text-xs text-slate-500">{t.tableActive}</div>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setEditing(null)} className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700">{t.cancel}</button>
                            <button onClick={() => saveEdit(editing)} className="px-3 py-1 rounded bg-water-600 text-white">{t.save}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {isAddOpen && newRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => { setIsAddOpen(false); setNewRow(null); }}></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-lg shadow-lg">
                        <h3 className="text-lg font-bold mb-3">{t.addRowTitle}</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="col-span-2">
                                <div className="text-xs text-slate-500">{t.tableFullName}</div>
                                <input className="w-full p-2 rounded border" value={newRow.fullName} onChange={e => setNewRow({ ...newRow, fullName: e.target.value })} />
                            </label>
                            <label>
                                <div className="text-xs text-slate-500">{t.tableRole}</div>
                                <input className="w-full p-2 rounded border" value={newRow.role} onChange={e => setNewRow({ ...newRow, role: e.target.value })} />
                            </label>
                            <label>
                                <div className="text-xs text-slate-500">{t.tableDepartment}</div>
                                <input className="w-full p-2 rounded border" value={newRow.department} onChange={e => setNewRow({ ...newRow, department: e.target.value })} />
                            </label>
                            <label>
                                <div className="text-xs text-slate-500">{t.tableJoiningDate}</div>
                                <input type="date" className="w-full p-2 rounded border" value={newRow.joiningDate} onChange={e => setNewRow({ ...newRow, joiningDate: e.target.value })} />
                            </label>
                            <label>
                                <div className="text-xs text-slate-500">{t.tableSalary}</div>
                                <input type="number" className="w-full p-2 rounded border" value={String(newRow.salary ?? '')} onChange={e => setNewRow({ ...newRow, salary: Number(e.target.value) })} />
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={newRow.isActive} onChange={e => setNewRow({ ...newRow, isActive: e.target.checked })} />
                                <div className="text-xs text-slate-500">{t.tableActive}</div>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => { setIsAddOpen(false); setNewRow(null); }} className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700">{t.cancel}</button>
                            <button onClick={() => {
                                // simple validation
                                if (!newRow.fullName || !newRow.role) { alert(t.pleaseProvideNameRole); return; }
                                const created: Employee = { ...newRow, id: 'NEW-' + Date.now() };
                                setData(d => [created, ...d]);
                                setIsAddOpen(false);
                                setNewRow(null);
                                setPage(1);
                            }} className="px-3 py-1 rounded bg-water-600 text-white">{t.addNew}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Remote API-driven table */}
            <RemoteTable lang={lang} />
        </div>
    );
};
