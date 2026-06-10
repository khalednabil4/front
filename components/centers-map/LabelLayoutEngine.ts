import { CenterLabelLayout, MapRegion } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

const MAX_FONT_BY_SIZE: Record<string, number> = {
  large: 44,
  medium: 40,
  small: 34,
};

const pointInsidePolygon = (x: number, y: number, polygon: Array<{ x: number; y: number }>) => {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index++) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects = ((current.y > y) !== (previous.y > y))
      && (x < (((previous.x - current.x) * (y - current.y)) / ((previous.y - current.y) || 0.000001)) + current.x);
    if (intersects) inside = !inside;
  }
  return inside;
};

const distanceToSegment = (
  x: number,
  y: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
) => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  if (deltaX === 0 && deltaY === 0) {
    return Math.hypot(x - start.x, y - start.y);
  }
  const projection = (((x - start.x) * deltaX) + ((y - start.y) * deltaY)) / ((deltaX ** 2) + (deltaY ** 2));
  const clampedProjection = clamp(projection, 0, 1);
  const projectedX = start.x + (deltaX * clampedProjection);
  const projectedY = start.y + (deltaY * clampedProjection);
  return Math.hypot(x - projectedX, y - projectedY);
};

const polygonEdgeDistance = (x: number, y: number, polygon: Array<{ x: number; y: number }>) => {
  if (polygon.length < 2) return 0;
  let minimumDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    minimumDistance = Math.min(minimumDistance, distanceToSegment(x, y, start, end));
  }
  return minimumDistance;
};

const rectangleFitScore = (
  polygon: Array<{ x: number; y: number }>,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
) => {
  if (polygon.length < 3) return 1;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const samples = [
    [centerX - halfWidth, centerY - halfHeight],
    [centerX, centerY - halfHeight],
    [centerX + halfWidth, centerY - halfHeight],
    [centerX - halfWidth, centerY],
    [centerX, centerY],
    [centerX + halfWidth, centerY],
    [centerX - halfWidth, centerY + halfHeight],
    [centerX, centerY + halfHeight],
    [centerX + halfWidth, centerY + halfHeight],
  ];
  const insideCount = samples.filter(([sampleX, sampleY]) => pointInsidePolygon(sampleX, sampleY, polygon)).length;
  return insideCount / samples.length;
};

const isArabicText = (value: string) => /[\u0600-\u06FF]/.test(value);

const estimateLineWidth = (line: string, fontSize: number, rtl: boolean) => {
  const compactLine = String(line || '').trim();
  if (!compactLine) return fontSize * 1.8;
  const widthFactor = rtl ? 0.70 : 0.56;
  return compactLine.length * fontSize * widthFactor;
};

const splitIntoTwoLines = (name: string) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [String(name || '').trim()].filter(Boolean);

  let best: string[] = [words.join(' ')];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let splitIndex = 1; splitIndex < words.length; splitIndex += 1) {
    const left = words.slice(0, splitIndex).join(' ').trim();
    const right = words.slice(splitIndex).join(' ').trim();
    if (!left || !right) continue;
    const delta = Math.abs(left.length - right.length);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = [left, right];
    }
  }
  return best;
};

const lineCandidates = (name: string, rtl: boolean) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) return [['']];
  const candidates = [[normalizedName]];
  if (normalizedName.includes(' ')) {
    const twoLine = splitIntoTwoLines(normalizedName);
    if (twoLine.length > 1) candidates.push(twoLine);
  }
  if (rtl && normalizedName.includes(' ')) {
    const words = normalizedName.split(/\s+/).filter(Boolean);
    if (words.length > 2) {
      const first = words.slice(0, Math.ceil(words.length / 2)).join(' ');
      const second = words.slice(Math.ceil(words.length / 2)).join(' ');
      const variant = [first, second].filter(Boolean);
      if (variant.length > 1) candidates.push(variant);
    }
  }
  return candidates;
};

const bestLabelCenter = (
  region: MapRegion,
  blockWidth: number,
  blockHeight: number,
  pointsCount: number,
) => {
  const polygon = region.map_shape.points || [];
  const regionWidth = region.bbox.maxX - region.bbox.minX;
  const regionHeight = region.bbox.maxY - region.bbox.minY;
  const preferredYRatio = 0.50;
  const preferredY = region.bbox.minY + (regionHeight * preferredYRatio);
  const minX = region.bbox.minX + (regionWidth * 0.14);
  const maxX = region.bbox.maxX - (regionWidth * 0.14);
  const minY = region.bbox.minY + (regionHeight * 0.22);
  const maxY = region.bbox.maxY - (regionHeight * 0.22);
  const candidateCenters: Array<{ x: number; y: number }> = [
    { x: region.bbox.centerX, y: preferredY },
    { x: region.bbox.centerX, y: region.bbox.centerY },
    { x: region.label?.x ?? region.bbox.centerX, y: region.label?.y ?? preferredY },
  ];

  for (let row = 0; row <= 4; row += 1) {
    for (let column = 0; column <= 4; column += 1) {
      candidateCenters.push({
        x: minX + (((maxX - minX) / 4) * column),
        y: minY + (((maxY - minY) / 4) * row),
      });
    }
  }

  let best = {
    x: region.bbox.centerX,
    y: clamp(preferredY, minY, maxY),
    score: Number.NEGATIVE_INFINITY,
  };

  for (const candidate of candidateCenters) {
    if (polygon.length >= 3 && !pointInsidePolygon(candidate.x, candidate.y, polygon)) continue;
    const fitScore = rectangleFitScore(polygon, candidate.x, candidate.y, blockWidth, blockHeight);
    const edgeDistance = polygonEdgeDistance(candidate.x, candidate.y, polygon);
    const verticalPenalty = Math.abs(candidate.y - preferredY) * 0.9;
    const horizontalPenalty = Math.abs(candidate.x - region.bbox.centerX) * 0.4;
    // Strongly prioritize pushing labels deeper inside the polygon
    const score = (fitScore * 90) + (edgeDistance * 4.4) - verticalPenalty - horizontalPenalty;
    if (score > best.score) {
      best = { x: candidate.x, y: candidate.y, score };
    }
  }

  return best;
};

export const LabelLayoutEngine = {
  compute(region: MapRegion, pointsCount: number, visualWeight: number, lang: 'ar' | 'en'): CenterLabelLayout {
    const name = String(region.name || '').trim();
    const rtl = lang === 'ar' || isArabicText(name);
    const sizeKey = String(region.size || 'medium').toLowerCase();
    const maxFont = MAX_FONT_BY_SIZE[sizeKey] || MAX_FONT_BY_SIZE.medium;
    const regionWidth = region.bbox.maxX - region.bbox.minX;
    const regionHeight = region.bbox.maxY - region.bbox.minY;
    const labelWidthLimit = regionWidth * 0.72;
    const densityPenalty = pointsCount >= 10 ? 1 : pointsCount >= 5 ? 0.6 : pointsCount > 0 ? 0.3 : 0;
    const weightPenalty = visualWeight >= 5 ? 0.5 : 0;
    const startingFont = clamp(
      Math.min(maxFont, (regionWidth * 0.11), (regionHeight * 0.22)) - densityPenalty - weightPenalty,
      16,
      maxFont,
    );

    const candidates = lineCandidates(name, rtl);
    for (let fontSize = startingFont; fontSize >= 10; fontSize -= 0.5) {
      const lineHeight = Math.max(fontSize * 1.04, fontSize + 0.5);
      for (const lines of candidates) {
        if (lines.length > 2) continue;
        const blockWidth = Math.max(...lines.map(line => estimateLineWidth(line, fontSize, rtl)), fontSize * 2);
        if (blockWidth > (labelWidthLimit * (lines.length > 1 ? 1.01 : 1))) continue;
        const blockHeight = Math.max(fontSize, (lines.length * lineHeight));
        const center = bestLabelCenter(region, blockWidth, blockHeight, pointsCount);
        if (center.score < 16 && fontSize > 11) continue;
        const top = center.y - (blockHeight / 2);
        return {
          lines,
          x: round(center.x),
          top: round(top),
          bottom: round(top + blockHeight),
          fontSize: round(fontSize),
          lineHeight: round(lineHeight),
        };
      }
    }

    const fallbackFont = clamp(Math.min(maxFont, regionHeight * 0.18), 16, maxFont);
    const fallbackLineHeight = Math.max(fallbackFont * 1.04, fallbackFont + 0.5);
    const fallbackLines = candidates[candidates.length - 1] || [name];
    const fallbackHeight = Math.max(fallbackFont, fallbackLines.length * fallbackLineHeight);
    const fallbackY = region.bbox.centerY;
    return {
      lines: fallbackLines,
      x: round(region.bbox.centerX),
      top: round(fallbackY - (fallbackHeight / 2)),
      bottom: round((fallbackY - (fallbackHeight / 2)) + fallbackHeight),
      fontSize: round(fallbackFont),
      lineHeight: round(fallbackLineHeight),
    };
  },
};
