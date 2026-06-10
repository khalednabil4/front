import React from 'react';
import { Droplets } from 'lucide-react';
import { BRANDING } from '../lib/branding';
import { Language } from '../types';

interface LoadingSpinnerProps {
    isVisible: boolean;
    message?: string;
    lang?: Language;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    isVisible,
    message,
    lang = 'en',
}) => {
    if (!isVisible) return null;

    const isRTL = lang === 'ar';
    const title = isRTL ? 'جاري تحميل البيانات' : 'Loading data';
    const defaultMessage = isRTL
        ? 'نقوم بتجهيز الصفحة وتحديث القراءات...'
        : 'Preparing the page and refreshing readings...';
    const progressLabel = isRTL ? 'يرجى الانتظار' : 'Please wait';

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md ${isRTL ? 'font-cairo' : 'font-sans'}`}
            role="status"
            aria-live="polite"
            dir={isRTL ? 'rtl' : 'ltr'}
        >
            <style>{`
              @keyframes hm-loader-ring {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes hm-loader-water {
                0% { transform: translateX(-45%) translateY(0); }
                50% { transform: translateX(-25%) translateY(-3px); }
                100% { transform: translateX(-45%) translateY(0); }
              }
              @keyframes hm-loader-flow {
                0% { transform: translateX(-110%); opacity: 0; }
                18% { opacity: 1; }
                82% { opacity: 1; }
                100% { transform: translateX(110%); opacity: 0; }
              }
              @keyframes hm-loader-dot {
                0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
                40% { transform: translateY(-5px); opacity: 1; }
              }
              @keyframes hm-loader-breathe {
                0%, 100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.18); }
                50% { box-shadow: 0 0 0 12px rgba(14, 165, 233, 0); }
              }
            `}</style>

            <div className="relative w-[360px] max-w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950 text-white shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.22),transparent_42%)]" />
                <div className="relative p-7">
                    <div className="flex flex-col items-center text-center">
                        <div className="relative mb-6 h-28 w-28">
                            <div
                                className="absolute inset-0 rounded-full border border-water-300/25"
                                style={{ animation: 'hm-loader-breathe 1800ms ease-in-out infinite' }}
                            />
                            <div
                                className="absolute inset-2 rounded-full border-2 border-transparent border-t-water-300 border-r-water-500"
                                style={{ animation: 'hm-loader-ring 1100ms linear infinite' }}
                            />
                            <div className="absolute inset-5 overflow-hidden rounded-full border border-water-300/20 bg-slate-900">
                                <div
                                    className="absolute bottom-0 h-[52%] w-[190%] rounded-[45%] bg-gradient-to-b from-water-300 to-water-600"
                                    style={{ animation: 'hm-loader-water 1800ms ease-in-out infinite' }}
                                />
                                <div className="absolute inset-x-0 bottom-0 h-[42%] bg-water-600/65" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="rounded-full bg-slate-950/80 p-3 ring-1 ring-white/10">
                                    <Droplets className="h-7 w-7 text-water-200" />
                                </div>
                            </div>
                        </div>

                        <div className="mb-5 space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-water-200">
                                {BRANDING.appName}
                            </p>
                            <h2 className="text-xl font-black leading-tight text-white">
                                {title}
                            </h2>
                            <p className="text-sm leading-6 text-slate-300">
                                {message || defaultMessage}
                            </p>
                        </div>

                        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
                            <div
                                className="h-full w-2/3 rounded-full bg-gradient-to-r from-water-600 via-water-300 to-water-600"
                                style={{ animation: 'hm-loader-flow 1500ms ease-in-out infinite' }}
                            />
                        </div>

                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
                            <span>{progressLabel}</span>
                            <span className="flex items-center gap-1" aria-hidden="true">
                                {[0, 150, 300].map((delay) => (
                                    <span
                                        key={delay}
                                        className="h-1.5 w-1.5 rounded-full bg-water-300"
                                        style={{ animation: `hm-loader-dot 1000ms ease-in-out ${delay}ms infinite` }}
                                    />
                                ))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadingSpinner;
