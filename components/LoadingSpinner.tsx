import React from 'react';

interface LoadingSpinnerProps {
    isVisible: boolean;
    message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    isVisible,
    message = 'Balancing pressure, please wait...',
}) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <style>{`
              @keyframes slosh {
                0% { transform: translateX(0); }
                50% { transform: translateX(-30%); }
                100% { transform: translateX(0); }
              }
              @keyframes slosh2 {
                0% { transform: translateX(-20%); }
                50% { transform: translateX(20%); }
                100% { transform: translateX(-20%); }
              }
              @keyframes pulseFlow {
                0%, 100% { opacity: 0.5; transform: scaleX(0.9); }
                50% { opacity: 1; transform: scaleX(1); }
              }
              @keyframes drip {
                0% { transform: translateY(-6px); opacity: 0; }
                40% { transform: translateY(4px); opacity: 1; }
                100% { transform: translateY(16px); opacity: 0; }
              }
            `}</style>

            <div className="relative bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10 w-[340px] max-w-[90vw] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-water-900/40 via-slate-900/60 to-slate-950 pointer-events-none" />

                <div className="relative flex flex-col items-center gap-5">
                    {/* Tank with animated water */}
                    <div className="relative w-32 h-32">
                        <div className="absolute inset-0 rounded-2xl bg-slate-900 border border-water-400/30 shadow-inner overflow-hidden">
                            <div
                                className="absolute bottom-0 left-0 right-0 h-1/2 opacity-80"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(56,189,248,0.9) 0%, rgba(14,165,233,0.9) 100%)',
                                    transform: 'translateY(5%)',
                                    filter: 'drop-shadow(0 8px 10px rgba(56,189,248,0.35))',
                                }}
                            />
                            <div
                                className="absolute bottom-0 left-0 right-0 h-1/2 opacity-80"
                                style={{
                                    background:
                                        'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.15), transparent 25%), radial-gradient(circle at 80% 40%, rgba(255,255,255,0.12), transparent 22%), linear-gradient(180deg, rgba(56,189,248,0.8) 0%, rgba(14,165,233,0.8) 100%)',
                                    animation: 'slosh 2.8s ease-in-out infinite',
                                    transform: 'translateY(10%)',
                                }}
                            />
                            <div
                                className="absolute bottom-0 left-0 right-0 h-1/2 opacity-70"
                                style={{
                                    background:
                                        'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1), transparent 20%), radial-gradient(circle at 70% 35%, rgba(255,255,255,0.08), transparent 20%), linear-gradient(180deg, rgba(14,165,233,0.85) 0%, rgba(8,126,164,0.85) 100%)',
                                    animation: 'slosh2 3.4s ease-in-out infinite',
                                    transform: 'translateY(18%)',
                                }}
                            />
                        </div>

                        {/* Droplet */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                            <svg width="32" height="48" viewBox="0 0 32 48" className="drop-shadow-[0_8px_12px_rgba(14,165,233,0.35)]">
                                <path
                                    d="M16 0C16 0 4 15 4 25C4 33.2843 9.71573 40 16 40C22.2843 40 28 33.2843 28 25C28 15 16 0 16 0Z"
                                    fill="url(#grad)"
                                />
                                <defs>
                                    <linearGradient id="grad" x1="16" y1="0" x2="16" y2="40" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#38bdf8" />
                                        <stop offset="1" stopColor="#0ea5e9" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute left-1/2 top-6 -translate-x-1/2 w-2 h-2 bg-white/80 rounded-full animate-[drip_1.4s_ease-in-out_infinite]" />
                        </div>
                    </div>

                    {/* Flow line */}
                    <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div
                            className="absolute inset-0 bg-gradient-to-r from-water-500/0 via-water-500 to-water-500/0"
                            style={{ animation: 'pulseFlow 1.6s ease-in-out infinite' }}
                        />
                    </div>

                    <div className="text-center space-y-1">
                        <p className="text-sm font-semibold text-water-100 tracking-wide uppercase">
                            Hydro Systems Sync
                        </p>
                        <p className="text-base text-slate-200">{message}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadingSpinner;
