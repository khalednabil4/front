import React from 'react';

export const WaterAnimation: React.FC = () => {
    return (
        <div className="water-animation flex items-center justify-center">
            <svg viewBox="0 0 160 120" className="w-full h-full">
                {/* Waves background (two overlapping paths) */}
                <g className="waves" transform="translate(0,50)">
                    <g className="wave-track">
                        <path className="wave" fill="#0ea5e9" d="M0 30 Q20 10 40 30 T80 30 T120 30 T160 30 V60 H0 Z" opacity="0.6"></path>
                        <path className="wave" fill="#38bdf8" d="M0 30 Q20 10 40 30 T80 30 T120 30 T160 30 V60 H0 Z" opacity="0.45"></path>
                    </g>
                </g>

                {/* Pipe and pump */}
                <g transform="translate(20,20)">
                    {/* Pipe */}
                    <rect x="0" y="40" width="120" height="12" rx="6" fill="#94a3b8" />
                    <rect x="-8" y="44" width="12" height="4" rx="2" fill="#64748b" />

                    {/* Pump body */}
                    <g transform="translate(100,34)">
                        <circle className="pump" cx="0" cy="0" r="14" fill="#0ea5e9" opacity="0.95" />
                        <g className="pump" fill="#ffffff" transform="translate(-4,-4)">
                            <rect x="0" y="0" width="3" height="8" rx="1" />
                            <rect x="4" y="0" width="3" height="8" rx="1" transform="rotate(30 5.5 4)" />
                            <rect x="8" y="0" width="3" height="8" rx="1" transform="rotate(60 9.5 4)" />
                        </g>
                    </g>
                </g>

                {/* Droplet above pipe */}
                <g transform="translate(60,12)">
                    <g className="droplet">
                        <path d="M8 0 C12 6, 16 10, 8 20 C0 10, 4 6, 8 0 Z" fill="#0ea5e9" />
                        <circle cx="8" cy="6" r="2" fill="rgba(255,255,255,0.6)" />
                    </g>
                </g>

                {/* Small station icon / tower */}
                <g transform="translate(10,6)">
                    <rect x="0" y="0" width="12" height="24" rx="2" fill="#0ea5e9" opacity="0.95" />
                    <rect x="3" y="4" width="6" height="2" fill="#ffffff" opacity="0.9" />
                </g>
            </svg>
        </div>
    );
};

export default WaterAnimation;
