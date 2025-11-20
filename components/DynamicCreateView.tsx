import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';
import { MOCK_DYNAMIC_SCHEMA } from '../constants';
import { DynamicSchema, Language } from '../types';

interface DynamicCreateViewProps {
    lang: Language;
    onBack: () => void;
}

export const DynamicCreateView: React.FC<DynamicCreateViewProps> = ({ lang, onBack }) => {
    const [schema, setSchema] = useState<DynamicSchema | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        // Simulate API fetch
        setTimeout(() => {
            setSchema(MOCK_DYNAMIC_SCHEMA);
            // Initialize default values
            const initialData: Record<string, any> = {};
            MOCK_DYNAMIC_SCHEMA.fields.forEach(field => {
                if (field.type === 'boolean') initialData[field.name] = false;
                else initialData[field.name] = '';
            });
            setFormData(initialData);
        }, 500);
    }, []);

    const handleChange = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const validate = () => {
        if (!schema) return false;
        const newErrors: Record<string, string> = {};
        let isValid = true;

        schema.fields.forEach(field => {
            if (field.required && !formData[field.name] && formData[field.name] !== 0 && formData[field.name] !== false) {
                newErrors[field.name] = lang === 'ar' ? 'هذا الحقل مطلوب' : 'This field is required';
                isValid = false;
            }
        });

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);

        // Simulate API call
        setTimeout(() => {
            setIsSubmitting(false);
            setShowSuccess(true);
            setTimeout(() => {
                onBack();
            }, 1500);
        }, 1000);
    };

    if (!schema) {
        return <div className="p-8 text-center text-slate-500">{lang === 'ar' ? 'جارِ التحميل...' : 'Loading...'}</div>;
    }

    const isRtl = lang === 'ar';

    if (showSuccess) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle size={40} className="text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                    {lang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved Successfully'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? 'جاري العودة للقائمة...' : 'Redirecting to list...'}
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                >
                    <ArrowLeft size={24} className={isRtl ? 'rotate-180' : ''} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                        {lang === 'ar' ? `إضافة ${schema.entityName} جديد` : `Create New ${schema.entityName}`}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {lang === 'ar' ? 'يرجى ملء البيانات التالية' : 'Please fill in the details below'}
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {schema.fields.filter(f => !f.hidden).map(field => (
                        <div key={field.name} className={field.type === 'boolean' ? 'md:col-span-2' : ''}>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>

                            {field.type === 'select' ? (
                                <select
                                    value={formData[field.name]}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    className={`w-full px-4 py-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-water-500 focus:border-water-500 transition-all ${errors[field.name] ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 dark:border-slate-600'}`}
                                >
                                    <option value="">{lang === 'ar' ? 'اختر...' : 'Select...'}</option>
                                    {field.options?.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : field.type === 'boolean' ? (
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleChange(field.name, !formData[field.name])}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${formData[field.name] ? 'bg-water-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData[field.name] ? (isRtl ? '-translate-x-7' : 'translate-x-7') : (isRtl ? '-translate-x-1' : 'translate-x-1')}`}></div>
                                    </button>
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {formData[field.name] ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No')}
                                    </span>
                                </div>
                            ) : (
                                <input
                                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                    value={formData[field.name]}
                                    onChange={(e) => handleChange(field.name, e.target.value)}
                                    className={`w-full px-4 py-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-water-500 focus:border-water-500 transition-all ${errors[field.name] ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 dark:border-slate-600'}`}
                                    placeholder={lang === 'ar' ? `أدخل ${field.label}` : `Enter ${field.label}`}
                                />
                            )}

                            {errors[field.name] && (
                                <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-6 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors"
                    >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-water-600 hover:bg-water-700 text-white rounded-lg font-bold shadow-lg shadow-water-600/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Save size={18} />
                                <span>{lang === 'ar' ? 'حفظ البيانات' : 'Save Data'}</span>
                            </>
                        )}
                    </button>
                </div>

            </form>
        </div>
    );
};
