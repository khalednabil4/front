import React from 'react';
import { CenterPoint, MapRegion, RegionRenderPlan } from './types';
import { CenterLabelRenderer } from './CenterLabelRenderer';
import { PointMiniCardRenderer } from './PointMiniCardRenderer';

interface RegionRendererProps {
  region: MapRegion;
  regionPlan: RegionRenderPlan;
  points: CenterPoint[];
  lang: 'ar' | 'en';
  isActive: boolean;
  onActivate: (regionId: number) => void;
  layer?: 'surface' | 'overlay';
  regionPath: string;
}

const hexToRgb = (value: string) => {
  const normalized = String(value || '').trim().replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized;
  if (full.length !== 6) return { r: 248, g: 180, b: 173 };
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

const mixColor = (color: string, target: { r: number; g: number; b: number }, amount: number) => {
  const source = hexToRgb(color);
  const mix = (sourceValue: number, targetValue: number) => Math.round(sourceValue + ((targetValue - sourceValue) * amount));
  return `rgb(${mix(source.r, target.r)}, ${mix(source.g, target.g)}, ${mix(source.b, target.b)})`;
};

export const RegionRenderer: React.FC<RegionRendererProps> = ({
  region,
  regionPlan,
  points,
  lang,
  isActive,
  onActivate,
  layer = 'surface',
  regionPath,
}) => {
  const clipId = `center-region-clip-${region.id}`;
  const gradientId = `center-region-gradient-${region.id}`;
  
  const gradientStart = mixColor(region.color, { r: 255, g: 255, b: 255 }, 0.05);
  const gradientEnd = mixColor(region.color, { r: 0, g: 0, b: 0 }, 0.04);
  const borderGlow = isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
  const accentGlow = isActive ? 'rgba(125,211,252,0.95)' : 'rgba(191,219,254,0.42)';

  if (layer === 'surface') {
    return (
      <g
        onMouseEnter={() => onActivate(region.id)}
        onFocus={() => onActivate(region.id)}
        onClick={() => onActivate(region.id)}
        className="cursor-pointer"
      >
        <defs>
          <linearGradient id={gradientId} x1="20%" y1="15%" x2="80%" y2="85%">
            <stop offset="0%" stopColor={gradientStart} />
            <stop offset="50%" stopColor={region.color} />
            <stop offset="100%" stopColor={gradientEnd} />
          </linearGradient>
        </defs>
        <path
          d={regionPath}
          fill={`url(#${gradientId})`}
          fillOpacity={1}
          stroke="rgba(255,255,255,0.96)"
          strokeWidth="4.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#monitorRegionShadow)"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={regionPath}
          fill="none"
          stroke={borderGlow}
          strokeWidth={isActive ? 2.2 : 1.1}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#monitorRegionLight)"
          vectorEffect="non-scaling-stroke"
        >
          <animate
            attributeName="stroke-opacity"
            values={isActive ? '0.34;0.92;0.34' : '0.14;0.34;0.14'}
            dur={isActive ? '2.4s' : '3.6s'}
            repeatCount="indefinite"
          />
        </path>
        <path
          d={regionPath}
          fill="none"
          stroke={accentGlow}
          strokeWidth={isActive ? 1.1 : 0.65}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        >
          <animate
            attributeName="stroke-opacity"
            values={isActive ? '0.12;0.58;0.12' : '0.04;0.16;0.04'}
            dur={isActive ? '1.9s' : '3.2s'}
            repeatCount="indefinite"
          />
        </path>
        <title>{region.name}</title>
      </g>
    );
  }

  return (
    <g
      onMouseEnter={() => onActivate(region.id)}
      onFocus={() => onActivate(region.id)}
      onClick={() => onActivate(region.id)}
      className="cursor-pointer"
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={regionPath} />
        </clipPath>
      </defs>

      {points.length ? (
        <g clipPath={`url(#${clipId})`} style={{ pointerEvents: 'auto' }}>
          {regionPlan.cards.cards.map(card => (
            <PointMiniCardRenderer key={card.point.id} card={card} plan={regionPlan.cards} />
          ))}
        </g>
      ) : null}

      <g style={{ pointerEvents: 'auto' }}>
        <CenterLabelRenderer label={regionPlan.label} regionId={region.id} lang={lang} />
      </g>
    </g>
  );
};
