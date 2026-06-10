import React from 'react';
import { CenterLabelLayout } from './types';

interface CenterLabelRendererProps {
  label: CenterLabelLayout;
  regionId: number;
  lang: 'ar' | 'en';
}

export const CenterLabelRenderer: React.FC<CenterLabelRendererProps> = ({ label, regionId, lang }) => (
  <text
    x={label.x}
    y={label.top}
    textAnchor="middle"
    dominantBaseline="hanging"
    direction={lang === 'ar' ? 'rtl' : 'ltr'}
    unicodeBidi="plaintext"
    fontSize={label.fontSize}
    fontWeight={700}
    fill="#ffffff"
    filter="url(#centerLabelShadow)"
    style={{
      pointerEvents: 'none',
      fontFamily: '"Tajawal", "Noto Sans Arabic", "Cairo", "Segoe UI", sans-serif',
      letterSpacing: 0,
    }}
  >
    {label.lines.map((line, index) => (
      <tspan
        key={`${regionId}-${line}-${index}`}
        x={label.x}
        dy={index === 0 ? 0 : label.lineHeight}
      >
        {line}
      </tspan>
    ))}
  </text>
);
