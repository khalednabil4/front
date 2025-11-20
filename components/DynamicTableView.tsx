import React, { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    Download,
    Trash2,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MOCK_DYNAMIC_DATA, MOCK_DYNAMIC_SCHEMA } from '../constants';
import { DynamicSchema, Language } from '../types';

interface DynamicTableViewProps {
    lang: Language;
    onCreateClick: () => void;
}

export const DynamicTableView: React.FC<DynamicTableViewProps> = ({ lang, onCreateClick }) => {
    const [data, setData] = useState<any[]>([]);
    const [schema, setSchema] = useState<DynamicSchema | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(5);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        // Simulate API fetch
        setTimeout(() => {
            setSchema(MOCK_DYNAMIC_SCHEMA);
            setData(MOCK_DYNAMIC_DATA);
        }, 500);
    }, []);

    // Filter Data
    const filteredData = data.filter(item => {
        if (!searchTerm) return true;
        return Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    // Sort Data
    const sortedData = React.useMemo(() => {
        if (!sortConfig) return filteredData;
        return [...filteredData].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [filteredData, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = sortedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleDelete = (id: string) => {
        if (window.confirm(lang === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) {
            setData(data.filter(item => item.id !== id));
        }
    };

    const handleExport = () => {
        if (!schema) return;

        const visibleFields = schema.fields.filter(f => !f.hidden);
        const exportData = data.map(row => {
            const rowData: Record<string, any> = {};
            visibleFields.forEach(field => {
                rowData[field.label] = row[field.name];
            });
            return rowData;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Adjust column widths
        const wscols = visibleFields.map(() => ({ wch: 20 }));
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, schema.entityName);
        XLSX.writeFile(wb, `${schema.entityName}_export.xlsx`);
    };

    if (!schema) {
        return <div className="p-8 text-center text-slate-500">{lang === 'ar' ? 'جارِ التحميل...' : 'Loading...'}</div>;
    }

    const isRtl = lang === 'ar';
    const visibleFields = schema.fields.filter(f => !f.hidden);

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="text-water-600" />
                        {schema.entityName} {lang === 'ar' ? 'قائمة' : 'List'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {lang === 'ar' ? 'إدارة البيانات ديناميكياً' : 'Manage data dynamically'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        <Download size={18} />
                        <span>{lang === 'ar' ? 'تصدير' : 'Export'}</span>
                    </button>

                    <button
                        onClick={onCreateClick}
                        className="flex items-center gap-2 px-4 py-2 bg-water-600 hover:bg-water-700 text-white rounded-lg transition-colors shadow-lg shadow-water-600/20"
                    >
                        <Plus size={18} />
                        <span>{lang === 'ar' ? 'إضافة جديد' : 'Add New'}</span>
                    </button>
                </div>
            </div>

            {/* Search & Per Page */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="relative flex-1 w-full sm:max-w-md">
                    <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${isRtl ? 'right-3' : 'left-3'}`} size={20} />
                    <input
                        type="text"
                        placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-water-500 transition-all ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{lang === 'ar' ? 'عرض:' : 'Show:'}</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-water-500 text-sm"
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                                {visibleFields.map(field => (
                                    <th
                                        key={field.name}
                                        onClick={() => handleSort(field.name)}
                                        className={`p-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none ${isRtl ? 'text-right' : 'text-left'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {field.label}
                                            {sortConfig?.key === field.name ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-slate-300" />
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th className={`p-4 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider ${isRtl ? 'text-left' : 'text-right'}`}>
                                    {lang === 'ar' ? 'إجراءات' : 'Actions'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {paginatedData.length > 0 ? (
                                paginatedData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                        {visibleFields.map(field => (
                                            <td key={field.name} className={`p-4 text-sm text-slate-700 dark:text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`}>
                                                {field.type === 'boolean' ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${row[field.name] ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                        {row[field.name] ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No')}
                                                    </span>
                                                ) : (
                                                    row[field.name]
                                                )}
                                            </td>
                                        ))}
                                        <td className={`p-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                                            <button
                                                onClick={() => handleDelete(row.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title={lang === 'ar' ? 'حذف' : 'Delete'}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={visibleFields.length + 1} className="p-8 text-center text-slate-500">
                                        {lang === 'ar' ? 'لا توجد بيانات' : 'No data found'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {lang === 'ar'
                            ? `عرض ${paginatedData.length} من ${filteredData.length}`
                            : `Showing ${paginatedData.length} of ${filteredData.length}`}
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ChevronLeft size={18} className={isRtl ? 'rotate-180' : ''} />
                        </button>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {currentPage} / {totalPages || 1}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ChevronRight size={18} className={isRtl ? 'rotate-180' : ''} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
