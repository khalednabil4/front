import React from 'react';

interface MapLegendProps {
  lang: 'ar' | 'en';
  viewBox: { minX: number; minY: number; width: number; height: number; maxX: number; maxY: number };
}

const typeItems = (lang: 'ar' | 'en') => [
  { type: 'F', label: lang === 'ar' ? 'تدفق' : 'Flow', color: '#4f7cff' },
  { type: 'P', label: lang === 'ar' ? 'ضغط' : 'Pressure', color: '#5c7ce6' },
  { type: 'L', label: lang === 'ar' ? 'مستوي' : 'Level', color: '#6a7df0' },
  { type: 'T', label: lang === 'ar' ? 'إجمالي' : 'Totalizer', color: '#5677ff' },
];

const stateItems = (lang: 'ar' | 'en') => [
  { label: lang === 'ar' ? 'نشط' : 'Active', color: '#2563eb' },
  { label: lang === 'ar' ? 'غير نشط' : 'Inactive', color: '#dc2626' },
];

export const MapLegend: React.FC<MapLegendProps> = ({ lang, viewBox }) => {
  const isRtl = lang === 'ar';
  const legendWidth = 880;
  const legendHeight = 64;
  const legendX = viewBox.minX + (viewBox.width / 2) - (legendWidth / 2);
  const legendY = viewBox.maxY - legendHeight - 32;

  const types = typeItems(lang);
  const states = stateItems(lang);

  const padding = 60;
  const groupGap = 80;
  const typeSectionWidth = 440;
  const stateSectionWidth = legendWidth - padding - typeSectionWidth - groupGap - padding;

  const typeSpacing = typeSectionWidth / types.length;
  const stateSpacing = stateSectionWidth / states.length;

  const centerY = legendY + (legendHeight / 2);
  const separatorX = legendX + padding + typeSectionWidth + (groupGap / 2);

  return (
    <g>
      <rect
        x={legendX}
        y={legendY}
        width={legendWidth}
        height={legendHeight}
        rx={16}
        ry={16}
        fill="rgba(255,255,255,0.97)"
        stroke="rgba(148,163,184,0.22)"
        strokeWidth="1.5"
        filter="url(#monitorCardShadow)"
      />

      <line
        x1={separatorX}
        y1={legendY + 16}
        x2={separatorX}
        y2={legendY + legendHeight - 16}
        stroke="rgba(148,163,184,0.3)"
        strokeWidth="1.5"
      />

      {types.map((item, index) => {
        const sectionX = legendX + padding;
        const itemCenterX = sectionX + (index * typeSpacing) + (typeSpacing / 2);
        const iconR = 9;
        const gap = 20;
        const iconCx = isRtl ? itemCenterX + gap : itemCenterX - gap;
        const textX = isRtl ? itemCenterX - gap : itemCenterX + gap;
        const iconCy = centerY;

        return (
          <g key={`type-${item.type}`}>
            <circle
              cx={iconCx}
              cy={iconCy}
              r={iconR}
              fill={item.color}
              fillOpacity={0.92}
            />
            <text
              x={iconCx}
              y={iconCy + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7.5}
              fontWeight={800}
              fill="#ffffff"
              style={{ pointerEvents: 'none' }}
            >
              {item.type}
            </text>
            <text
              x={textX}
              y={iconCy + 1}
              textAnchor={isRtl ? 'end' : 'start'}
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={600}
              fill="#374151"
              style={{ pointerEvents: 'none', fontFamily: '"Tajawal", "Noto Sans Arabic", sans-serif' }}
            >
              {item.label}
            </text>
          </g>
        );
      })}

      {states.map((item, index) => {
        const sectionX = legendX + padding + typeSectionWidth + groupGap;
        const itemCenterX = sectionX + (index * stateSpacing) + (stateSpacing / 2);
        const lineLength = 24;
        const lineY = centerY;
        const gap = 22;
        const lineX = isRtl ? itemCenterX + gap : itemCenterX - gap;
        const textX = isRtl ? itemCenterX - gap : itemCenterX + gap;

        return (
          <g key={`state-${index}`}>
            <line
              x1={lineX - lineLength / 2}
              y1={lineY}
              x2={lineX + lineLength / 2}
              y2={lineY}
              stroke={item.color}
              strokeWidth={3.5}
              strokeLinecap="round"
            />
            <text
              x={textX}
              y={lineY + 1}
              textAnchor={isRtl ? 'end' : 'start'}
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={600}
              fill="#374151"
              style={{ pointerEvents: 'none', fontFamily: '"Tajawal", "Noto Sans Arabic", sans-serif' }}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
};
