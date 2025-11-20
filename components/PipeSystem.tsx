import React from 'react';
import { Pipe, Sensor } from '../types';
import { Activity, AlertTriangle } from 'lucide-react';

interface PipeSystemProps {
  pipe: Pipe;
  onSensorClick: (sensor: Sensor) => void;
}

export const PipeSystem: React.FC<PipeSystemProps> = ({ pipe, onSensorClick }) => {
  // Calculate positions based on number of sensors to distribute them evenly
  const getSensorPosition = (index: number, total: number) => {
    return ((index + 1) / (total + 1)) * 100;
  };

  return (
    <div className="relative w-full py-12 select-none">
      {/* Pipe Label */}
      <div className="absolute -top-2 left-4 bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200 z-10">
        {pipe.name}
      </div>

      {/* SVG Container for the Pipe */}
      <svg className="w-full h-24 overflow-visible">
        <defs>
          {/* Metal Gradient */}
          <linearGradient id="pipeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#f8fafc" />
            <stop offset="60%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          
          {/* Water Pattern */}
          <pattern id="waterFlow" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 10 Q10 5 20 10 T40 10" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.5" />
          </pattern>
        </defs>

        {/* Main Pipe Body */}
        <rect x="0" y="32" width="100%" height="32" rx="4" fill="url(#pipeGradient)" filter="drop-shadow(0px 4px 4px rgba(0,0,0,0.1))" />
        
        {/* Animated Water Flow Indicator (Dashed Line inside) */}
        <line 
          x1="0" y1="48" x2="100%" y2="48" 
          stroke="#0ea5e9" 
          strokeWidth="8" 
          strokeDasharray="20 10" 
          strokeLinecap="round"
          className="animate-flow opacity-60"
        />
        
        {/* Flow Direction Arrows */}
        <path d="M 10 40 L 20 48 L 10 56" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
        <path d="M 50 40 L 60 48 L 50 56" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
      </svg>

      {/* Sensors Overlay (HTML/React components positioned absolutely) */}
      <div className="absolute inset-0 top-8 h-8 w-full">
        {pipe.sensors.map((sensor, idx) => {
          const leftPos = getSensorPosition(idx, pipe.sensors.length);
          const isWarning = sensor.status === 'warning';
          
          return (
            <div
              key={sensor.id}
              onClick={() => onSensorClick(sensor)}
              className="absolute top-1/2 -translate-y-1/2 cursor-pointer group"
              style={{ left: `${leftPos}%`, transform: 'translate(-50%, -50%)' }}
            >
              {/* Stem connecting to pipe */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-6 bg-slate-400 -z-10"></div>

              {/* Sensor Body */}
              <div className={`relative w-12 h-12 rounded-full border-4 shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 bg-white
                ${isWarning ? 'border-red-500 shadow-red-200' : 'border-water-500 shadow-water-200'}
              `}>
                 {/* Pulse Animation */}
                 <div className={`absolute inset-0 rounded-full opacity-20 animate-ping ${isWarning ? 'bg-red-500' : 'bg-water-500'}`}></div>

                 {isWarning ? <AlertTriangle size={18} className="text-red-500" /> : <Activity size={18} className="text-water-600" />}
              </div>

              {/* Tooltip / Value Box */}
              <div className={`absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg shadow-md text-sm font-bold whitespace-nowrap transition-colors
                ${isWarning ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white text-water-700 border border-water-100'}
              `}>
                {sensor.pressure.toFixed(1)} Bar
                <div className={`absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 border-b border-r 
                  ${isWarning ? 'bg-red-50 border-red-200' : 'bg-white border-water-100'}
                `}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};