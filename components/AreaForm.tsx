
import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, Save, Trash2, Check, AlertCircle, ArrowRight, ChevronDown, FileDown, Edit, MapPin, Image } from 'lucide-react';
import { DICTIONARY } from '../constants';
import { Language } from '../types';

interface AreaFormProps {
  lang: Language;
}

type MappingField = 
  | 'companyName' 
  | 'areaName' 
  | 'areaCode' 
  | 'lineCount' 
  | 'valveCount' 
  | 'meterCount' 
  | 'areaSize' 
  | 'managerName' 
  | 'readingsStartMonth' 
  | 'readingsStartYear'
  | 'latitude'
  | 'longitude'
  | 'ignore';

export const AreaForm: React.FC<AreaFormProps> = ({ lang }) => {
  const t = DICTIONARY[lang];
  const [activeTab, setActiveTab] = useState<'excel' | 'manual'>('excel');
  
  // Excel State
  const [step, setStep] = useState<1 | 2>(1);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<MappingField[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manual Form State (simplified)
  const [manualForm, setManualForm] = useState({});

  const availableFields: { key: MappingField; label: string }[] = [
    { key: 'companyName', label: t.companyName },
    { key: 'areaName', label: t.areaName },
    { key: 'areaCode', label: t.areaCode },
    { key: 'lineCount', label: t.lineCount },
    { key: 'valveCount', label: t.valveCount },
    { key: 'meterCount', label: t.meterCount },
    { key: 'areaSize', label: t.areaSize },
    { key: 'managerName', label: t.managerName },
    { key: 'readingsStartMonth', label: t.readingsStartMonth },
    { key: 'readingsStartYear', label: t.readingsStartYear },
    { key: 'latitude', label: t.latitude },
    { key: 'longitude', label: t.longitude },
  ];

  // Mock file parsing
  const handleFileSelect = (file: File) => {
    setExcelFile(file);
    setIsProcessing(true);
    
    setTimeout(() => {
      const dummyData = [
        ['Saudi Water Co.', 'Riyadh North', 'RIY-01', '12', '45', '120', '2500', 'Ahmed Al-Salem', '10', '2023', '24.7136', '46.6753'],
        ['Saudi Water Co.', 'Riyadh South', 'RIY-02', '8', '30', '90', '1800', 'Khalid Al-Otaibi', '11', '2023', '24.6000', '46.7000'],
        ['Eastern Co.', 'Dammam Zone 1', 'DAM-01', '15', '60', '200', '5000', 'Fahad Al-Dossari', '01', '2024', '26.4207', '50.0888'],
      ];
      setPreviewData(dummyData);
      setColumnMapping(new Array(dummyData[0].length).fill('ignore'));
      setIsProcessing(false);
    }, 1000);
  };

  const handleFieldSelect = (colIndex: number, field: MappingField) => {
    const newMapping = [...columnMapping];
    newMapping[colIndex] = field;
    setColumnMapping(newMapping);
  };

  const handleSave = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setSuccessMessage(t.importSuccess);
      setTimeout(() => {
        setSuccessMessage(null);
        if (activeTab === 'excel') {
          setStep(1);
          setExcelFile(null);
          setPreviewData([]);
        }
      }, 2000);
    }, 1500);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors duration-300 min-h-[600px] flex flex-col">
      
      {/* Header & Tabs */}
      <div className="border-b border-slate-100 dark:border-slate-700">
        <div className="p-6 md:p-8 pb-0">
           <div className="flex justify-between items-start mb-6">
              <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{t.areas}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t.addNewArea}</p>
              </div>
           </div>

           <div className="flex gap-6">
              <button 
                onClick={() => setActiveTab('excel')}
                className={`pb-4 px-2 font-medium text-sm transition-all border-b-2 flex items-center gap-2
                  ${activeTab === 'excel' 
                    ? 'border-water-500 text-water-600 dark:text-water-400' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}
                `}
              >
                <FileSpreadsheet size={18} />
                {t.modeExcel}
              </button>
              <button 
                onClick={() => setActiveTab('manual')}
                className={`pb-4 px-2 font-medium text-sm transition-all border-b-2 flex items-center gap-2
                  ${activeTab === 'manual' 
                    ? 'border-water-500 text-water-600 dark:text-water-400' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}
                `}
              >
                <Edit size={18} />
                {t.modeManual}
              </button>
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
          <>
            {/* --- TAB: EXCEL IMPORT --- */}
            {activeTab === 'excel' && (
              <div className="animate-in fade-in duration-300 h-full">
                 {/* Stepper */}
                 <div className="flex items-center gap-2 text-sm font-medium mb-8 justify-center">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${step === 1 ? 'bg-water-100 text-water-700 dark:bg-water-900/50 dark:text-water-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        <div className="w-6 h-6 rounded-full bg-current flex items-center justify-center text-[10px] text-white dark:text-slate-900">1</div>
                        {t.step1Upload}
                    </div>
                    <div className="w-8 h-px bg-slate-200 dark:bg-slate-700"></div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${step === 2 ? 'bg-water-100 text-water-700 dark:bg-water-900/50 dark:text-water-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center text-[10px]">2</div>
                        {t.step2Map}
                    </div>
                </div>

                {step === 1 && (
                  <div className="flex flex-col items-center justify-center py-8 space-y-6">
                     {!excelFile ? (
                       <>
                          <div 
                              className="relative w-full max-w-2xl h-64 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-water-400 dark:hover:border-water-500 flex flex-col items-center justify-center cursor-pointer transition-all group"
                              onClick={() => document.getElementById('file-upload')?.click()}
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
                                          <p className="text-sm text-slate-500 dark:text-slate-400">{(excelFile.size / 1024).toFixed(1)} KB • {previewData.length} {t.rowCount}</p>
                                      </div>
                                   </div>
                                   <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                                       <button 
                                          onClick={() => { setExcelFile(null); setPreviewData([]); }}
                                          className="px-4 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
                                       >
                                          {t.removeFile}
                                       </button>
                                       <button 
                                          onClick={() => setStep(2)}
                                          className="px-6 py-2 bg-water-600 text-white rounded-lg hover:bg-water-700 shadow-lg shadow-water-500/20 transition-all text-sm font-bold flex items-center gap-2"
                                       >
                                          {t.continueToMap}
                                          <ArrowRight size={16} />
                                       </button>
                                   </div>
                              </div>
                          )}
                       </div>
                     )}
                  </div>
                )}

                {step === 2 && (
                  <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-3">
                              <FileSpreadsheet className="text-water-600 dark:text-water-400" size={20} />
                              <span className="font-medium text-slate-700 dark:text-slate-200">{excelFile?.name}</span>
                          </div>
                          <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white underline">
                              {t.cancel}
                          </button>
                      </div>

                      <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm mb-6">
                        <table className="w-full min-w-[1000px] border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                            <tr>
                              {previewData[0]?.map((_, idx) => (
                                <th key={idx} className="p-3 min-w-[180px] border-b border-r border-slate-200 dark:border-slate-700 last:border-r-0 bg-slate-50 dark:bg-slate-900">
                                  <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider text-start px-1">
                                      {t.column} {String.fromCharCode(65 + idx)}
                                    </span>
                                    <div className="relative">
                                      <select
                                        value={columnMapping[idx] || 'ignore'}
                                        onChange={(e) => handleFieldSelect(idx, e.target.value as MappingField)}
                                        className={`w-full appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border outline-none transition-all cursor-pointer font-medium
                                          ${columnMapping[idx] && columnMapping[idx] !== 'ignore'
                                            ? 'bg-water-50 border-water-200 text-water-700 dark:bg-water-900/20 dark:border-water-800 dark:text-water-300'
                                            : 'bg-white border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400'}
                                        `}
                                      >
                                        <option value="ignore" className="text-slate-400">{t.ignoreColumn}</option>
                                        {availableFields.map(field => (
                                          <option 
                                            key={field.key} 
                                            value={field.key}
                                            disabled={columnMapping.includes(field.key) && columnMapping[idx] !== field.key}
                                          >
                                            {field.label}
                                          </option>
                                        ))}
                                      </select>
                                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                    </div>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                            {previewData.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className={`p-3 text-sm border-r border-slate-100 dark:border-slate-700 last:border-r-0 truncate max-w-[200px] ${columnMapping[cIdx] !== 'ignore' ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400 opacity-50'}`}>
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-end">
                          <button 
                              onClick={handleSave}
                              disabled={isProcessing || !columnMapping.some(m => m !== 'ignore')}
                              className={`px-8 py-3 rounded-lg flex items-center gap-2 font-bold shadow-lg transition-all
                                ${isProcessing || !columnMapping.some(m => m !== 'ignore')
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                                  : 'bg-water-600 text-white hover:bg-water-700 shadow-water-500/20'}
                              `}
                          >
                              {isProcessing ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  {t.processing}
                                </>
                              ) : (
                                <>
                                  <Save size={20} />
                                  {t.save}
                                </>
                              )}
                          </button>
                      </div>
                  </div>
                )}
              </div>
            )}

            {/* --- TAB: MANUAL ENTRY --- */}
            {activeTab === 'manual' && (
              <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Basic Info */}
                    <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700 mb-2">
                       <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 text-sm uppercase tracking-wider">{t.companyName} & {t.areaName}</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">{t.companyName}</label>
                            <input type="text" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">{t.managerName}</label>
                            <input type="text" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">{t.areaName}</label>
                            <input type="text" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">{t.areaCode}</label>
                            <input type="text" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none" />
                          </div>
                       </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-1">
                       <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.lineCount}</label>
                       <input type="number" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.valveCount}</label>
                       <input type="number" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.meterCount}</label>
                       <input type="number" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.areaSize}</label>
                       <input type="number" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none transition-all" />
                    </div>

                    {/* Readings */}
                    <div className="space-y-1">
                       <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.readingsStartMonth}</label>
                       <input type="number" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.readingsStartYear}</label>
                       <input type="number" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none transition-all" />
                    </div>

                    {/* Location */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.latitude}</label>
                           <input type="text" placeholder="24.0000" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none transition-all" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.longitude}</label>
                           <input type="text" placeholder="46.0000" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-water-500 outline-none transition-all" />
                        </div>
                    </div>

                    {/* Map & Image Placeholders */}
                    <div className="md:col-span-2 space-y-4">
                       <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.locationOnMap}</label>
                          <div className="h-48 bg-slate-100 dark:bg-slate-900 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                             <MapPin size={32} className="mb-2" />
                             <span className="text-sm">{t.clickToSelect}</span>
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.uploadImage}</label>
                          <div className="h-24 bg-slate-100 dark:bg-slate-900 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                             <Image size={24} className="mb-1" />
                             <span className="text-xs">{t.uploadImage}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="flex justify-end">
                    <button 
                        onClick={handleSave}
                        className="px-8 py-3 bg-water-600 text-white rounded-lg hover:bg-water-700 shadow-lg shadow-water-500/20 transition-all font-bold flex items-center gap-2"
                    >
                      {isProcessing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {t.processing}
                          </>
                        ) : (
                          <>
                            <Save size={20} />
                            {t.save}
                          </>
                        )}
                    </button>
                 </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};