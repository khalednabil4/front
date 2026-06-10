import React from 'react';
import { PointGroupingService } from './PointGroupingService';
import { PointCardPlacement, PointCardPlan } from './types';

interface PointMiniCardRendererProps {
  card: PointCardPlacement;
  plan: PointCardPlan;
}

type CardTextLine = {
  value: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
};

const estimatedCharWidth = (fontSize: number) => Math.max(2.6, fontSize * 0.56);

const splitLongToken = (token: string, maxChars: number) => {
  if (!token) return [];
  if (token.length <= maxChars) return [token];

  const parts: string[] = [];
  for (let index = 0; index < token.length; index += maxChars) {
    parts.push(token.slice(index, index + maxChars));
  }
  return parts;
};

const wrapText = (value: string, width: number, fontSize: number) => {
  const normalized = String(value || '').trim();
  if (!normalized) return [];

  const maxChars = Math.max(2, Math.floor(width / estimatedCharWidth(fontSize)));
  const tokens = normalized
    .split(/\s+/)
    .filter(Boolean)
    .flatMap(token => splitLongToken(token, maxChars));

  if (!tokens.length) return [];

  const lines: string[] = [];
  let current = '';

  tokens.forEach(token => {
    if (!current) {
      current = token;
      return;
    }

    const candidate = `${current} ${token}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }

    lines.push(current);
    current = token;
  });

  if (current) lines.push(current);
  return lines;
};

const fitCardLabel = (
  numberText: string,
  nameText: string,
  width: number,
  height: number,
  tone: { text: string; muted: string },
  baseFontSize: number,
) => {
  const fontCandidates = [
    baseFontSize + 0.4,
    baseFontSize,
    baseFontSize - 0.35,
    baseFontSize - 0.7,
    baseFontSize - 1.05,
    baseFontSize - 1.4,
    baseFontSize - 1.75,
    baseFontSize - 2.1,
  ].filter((value, index, array) => value > 3.4 && array.indexOf(value) === index);

  let fallback: { lines: CardTextLine[]; lineGap: number; height: number; fits: boolean } | null = null;

  for (const numberFontSize of fontCandidates) {
    const safeNumberFontSize = Math.max(4.2, numberFontSize);
    const nameFontSize = Math.max(3.6, safeNumberFontSize - 1.15);
    const numberLines = wrapText(numberText, width, safeNumberFontSize);
    const nameLines = nameText ? wrapText(nameText, width, nameFontSize) : [];

    const lines: CardTextLine[] = [
      ...numberLines.map(line => ({
        value: line,
        fontSize: safeNumberFontSize,
        fontWeight: 900,
        fill: tone.text,
      })),
      ...nameLines.map(line => ({
        value: line,
        fontSize: nameFontSize,
        fontWeight: 700,
        fill: tone.muted,
      })),
    ];

    if (!lines.length) continue;

    const lineGap = Math.max(0.8, Math.min(1.9, nameFontSize * 0.28));
    const labelHeight = lines.reduce((sum, line) => sum + line.fontSize, 0) + (lineGap * Math.max(0, lines.length - 1));
    const candidate = {
      lines,
      lineGap,
      height: labelHeight,
      fits: labelHeight <= height,
    };

    if (!fallback) fallback = candidate;
    if (candidate.fits) return candidate;
    fallback = candidate;
  }

  return fallback || { lines: [], lineGap: 1, height: 0, fits: true };
};

const pointTextStyle: React.CSSProperties = {
  direction: 'ltr',
  pointerEvents: 'none',
  unicodeBidi: 'isolate',
  fontFamily: '"Tajawal", "Cairo", "Segoe UI", sans-serif',
  letterSpacing: '0.01em',
};

export const PointMiniCardRenderer: React.FC<PointMiniCardRendererProps> = ({ card, plan }) => {
  const isActive = card.point.is_active;
  const tone = isActive
    ? {
        border: '#1d4ed8',
        light: '#60a5fa',
        halo: 'rgba(59,130,246,0.92)',
        fill: 'rgba(248,251,255,0.98)',
        accentFill: 'rgba(219,234,254,0.98)',
        text: '#0f1f3d',
        reading: '#1e3a8a',
        muted: '#64748b',
        titleFill: '#1d4ed8',
        titleText: '#f8fbff',
      }
    : {
        border: '#dc2626',
        light: '#fb7185',
        halo: 'rgba(248,113,113,0.88)',
        fill: 'rgba(255,248,248,0.98)',
        accentFill: 'rgba(254,226,226,0.98)',
        text: '#3b1111',
        reading: '#991b1b',
        muted: '#7f1d1d',
        titleFill: '#dc2626',
        titleText: '#fff7f7',
      };
  const primaryLabel = String(card.point.name || '').trim() || PointGroupingService.pointDisplayCode(card.point);
  const pointTypeIndicator = PointGroupingService.pointTypeIndicator(card.point);
  const readingEntries = PointGroupingService.pointReadingEntries(card.point, 'compact');
  const readingValue = PointGroupingService.pointReading(card.point);
  const wantsReading = plan.showReading && (readingEntries.length > 0 || Boolean(readingValue));
  const isMissingReading = readingEntries.length === 0 && String(readingValue || '').trim() === '----';

  const accentWidth = Math.max(2.1, Math.min(3.4, card.width * 0.045));
  const contentLeft = card.x + Math.max(7, plan.paddingX + accentWidth + 4);
  const rawReadingLines = wantsReading
    ? (readingEntries.length ? readingEntries.map(entry => entry.compact) : [String(readingValue)])
    : [];
  const readingLineCount = rawReadingLines.length;
  const effectiveReadingFontSize = readingLineCount > 1
    ? Math.max(3.9, plan.readingFontSize - ((readingLineCount - 1) * 0.35))
    : plan.readingFontSize;
  const readingLineGapBase = Math.max(0.8, effectiveReadingFontSize * 0.22);
  const readingReserveHeight = readingLineCount > 0
    ? (effectiveReadingFontSize * readingLineCount) + (readingLineGapBase * Math.max(0, readingLineCount - 1)) + 3
    : 0;
  const badgeRadius = Math.max(5, Math.min(7.2, card.height * (wantsReading ? 0.21 : 0.25)));
  const badgeCx = card.x + card.width - plan.paddingX - badgeRadius - 1;
  const safeWidth = Math.max(14, badgeCx - contentLeft - badgeRadius - 3);
  const labelHeightWithReading = Math.max(10, card.height - (plan.paddingY * 2) - readingReserveHeight);
  const labelHeightWithoutReading = Math.max(10, card.height - (plan.paddingY * 2));
  const preferredLabelWithReading = fitCardLabel(primaryLabel, '', safeWidth - 2, labelHeightWithReading, tone, plan.codeFontSize);
  const showReading = wantsReading && preferredLabelWithReading.fits;
  const labelBlock = showReading
    ? preferredLabelWithReading
    : fitCardLabel(primaryLabel, '', safeWidth - 2, labelHeightWithoutReading, tone, plan.codeFontSize);
  const readingLineGap = Math.max(1.1, effectiveReadingFontSize * 0.3);
  const readingLines = showReading ? rawReadingLines : [];
  const readingBlockHeight = showReading && readingLineCount > 0
    ? (effectiveReadingFontSize * readingLineCount) + (readingLineGap * Math.max(0, readingLineCount - 1))
    : 0;
  const borderInset = Math.max(0.9, plan.borderWidth * 0.72);
  const innerWidth = Math.max(0, card.width - (borderInset * 2));
  const minimumBodyHeight = showReading ? readingBlockHeight + (plan.paddingY * 1.75) + 2.8 : 0;
  const minHeaderHeight = Math.min(card.height - 1.6, labelBlock.height + (plan.paddingY * 1.5) + 1.2);
  const maxHeaderHeight = Math.max(minHeaderHeight, card.height - minimumBodyHeight - 1.2);
  const idealHeaderHeight = labelBlock.height + (plan.paddingY * 2.15) + (showReading ? 2.4 : 4.2);
  const headerHeight = Math.min(
    maxHeaderHeight,
    Math.max(minHeaderHeight, Math.max(idealHeaderHeight, card.height * (showReading ? 0.48 : 0.66))),
  );
  const badgeCy = Math.min(
    card.y + headerHeight - badgeRadius - 1.1,
    Math.max(card.y + borderInset + badgeRadius + 1.1, card.y + (headerHeight / 2)),
  );
  const headerTextTop = card.y + borderInset + Math.max(0.7, (headerHeight - labelBlock.height) / 2);
  let nextHeaderBaselineY = headerTextTop;
  const headerLines = labelBlock.lines.map((line, index) => {
    const baselineY = nextHeaderBaselineY + (line.fontSize * 0.9);
    nextHeaderBaselineY = baselineY + (index < labelBlock.lines.length - 1 ? labelBlock.lineGap : 0);
    return {
      ...line,
      y: baselineY,
    };
  });
  const bodyTop = card.y + headerHeight + Math.max(1.5, plan.paddingY * 0.8);
  const bodyBottom = card.y + card.height - plan.paddingY;
  const availableReadingHeight = Math.max(0, bodyBottom - bodyTop);
  const readingStartY = showReading
    ? bodyTop + Math.max(0, (availableReadingHeight - readingBlockHeight) / 2) + effectiveReadingFontSize
    : null;
  const cardOpacity = plan.relaxedFit ? 0.93 : 0.99;
  const animatedStrokeWidth = Math.max(1.15, plan.borderWidth * 0.95);
  const glowStrokeWidth = Math.max(2.2, plan.borderWidth * 2.5);

  return (
    <g>
      <title>{PointGroupingService.pointTooltip(card.point)}</title>
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx={plan.borderRadius}
        ry={plan.borderRadius}
        fill="none"
        stroke={tone.halo}
        strokeWidth={glowStrokeWidth}
        opacity={isActive ? 0.28 : 0.24}
        filter="url(#monitorCardSoftGlow)"
        vectorEffect="non-scaling-stroke"
      >
        <animate
          attributeName="opacity"
          values={isActive ? '0.16;0.5;0.16' : '0.12;0.42;0.12'}
          dur={isActive ? '2.1s' : '2.55s'}
          repeatCount="indefinite"
        />
      </rect>
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx={plan.borderRadius}
        ry={plan.borderRadius}
        fill={tone.fill}
        fillOpacity={cardOpacity}
        stroke={tone.border}
        strokeWidth={plan.borderWidth}
        filter="url(#monitorCardShadow)"
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={card.x + borderInset}
        y={card.y + borderInset}
        width={innerWidth}
        height={Math.max(0, card.height - (borderInset * 2))}
        rx={Math.max(0, plan.borderRadius - borderInset)}
        ry={Math.max(0, plan.borderRadius - borderInset)}
        fill="none"
        stroke={tone.light}
        strokeWidth={animatedStrokeWidth}
        strokeDasharray="24 76"
        strokeLinecap="round"
        opacity={isActive ? 0.88 : 0.78}
        pathLength={100}
        vectorEffect="non-scaling-stroke"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={isActive ? '-100' : '100'}
          dur={isActive ? '3s' : '2.35s'}
          repeatCount="indefinite"
        />
      </rect>
      <rect
        x={card.x + borderInset}
        y={card.y + borderInset}
        width={innerWidth}
        height={Math.max(0, headerHeight - borderInset)}
        rx={Math.max(0, plan.borderRadius - borderInset)}
        ry={Math.max(0, plan.borderRadius - borderInset)}
        fill={tone.titleFill}
        opacity={0.96}
      />
      <rect
        x={card.x + 2}
        y={card.y + 3}
        width={accentWidth}
        height={Math.max(0, card.height - 6)}
        rx={accentWidth / 2}
        ry={accentWidth / 2}
        fill={tone.border}
        opacity={0.92}
      >
        <animate
          attributeName="opacity"
          values={isActive ? '0.62;1;0.62' : '0.5;0.9;0.5'}
          dur={isActive ? '1.8s' : '2.2s'}
          repeatCount="indefinite"
        />
      </rect>
      <path
        d={`M ${card.x + plan.borderRadius + 1} ${card.y + 1.6} H ${card.x + card.width - plan.borderRadius - 1}`}
        stroke="rgba(255,255,255,0.78)"
        strokeWidth="0.8"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M ${card.x + borderInset + 1.6} ${card.y + headerHeight} H ${card.x + card.width - borderInset - 1.6}`}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="0.75"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={badgeCx}
        cy={badgeCy}
        r={badgeRadius}
        fill={tone.accentFill}
        stroke={tone.light}
        strokeWidth="1"
        filter="url(#monitorCardSoftGlow)"
      />
      <text
        x={badgeCx}
        y={badgeCy + (Math.max(2.1, plan.codeFontSize * 0.31))}
        textAnchor="middle"
        fontSize={Math.max(5.4, plan.codeFontSize - 1.7)}
        fontWeight={900}
        fill={tone.border}
        direction="ltr"
        style={pointTextStyle}
      >
        {pointTypeIndicator}
      </text>
      {headerLines.map((line, index) => (
        <text
          key={`${card.point.id}-label-${index}`}
          x={contentLeft}
          y={line.y}
          textAnchor="start"
          fontSize={line.fontSize}
          fontWeight={Math.max(line.fontWeight, 800)}
          fill={tone.titleText}
          direction="ltr"
          style={pointTextStyle}
        >
          {line.value}
        </text>
      ))}
      {showReading && readingStartY != null ? (
        <>
          {readingLines.map((readingLine, index) => (
            <text
              key={`${card.point.id}-reading-${index}`}
              x={contentLeft}
              y={readingStartY + (index * (effectiveReadingFontSize + readingLineGap))}
              textAnchor="start"
              fontSize={effectiveReadingFontSize}
              fontWeight={isMissingReading ? 900 : 800}
              fill={isMissingReading ? tone.muted : tone.reading}
              direction="ltr"
              style={pointTextStyle}
            >
              {readingLine}
            </text>
          ))}
        </>
      ) : null}
    </g>
  );
};
