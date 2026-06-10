import { PointGroupingService } from './PointGroupingService';
import { LabelLayoutEngine } from './LabelLayoutEngine';
import { CenterLabelLayout, CenterPoint, MapRegion, PointCardPlacement, PointCardPlan, RegionRenderPlan } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;
const POINT_CARD_SCALE = 1.1;
const POINT_CARD_FONT_SCALE = 1.05;

const pointInsidePolygon = (x: number, y: number, polygon: Array<{ x: number; y: number }>) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = ((yi > y) !== (yj > y))
      && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 0.000001)) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const rectanglePolygonScore = (
  polygon: Array<{ x: number; y: number }>,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  if (polygon.length < 3) return 1;
  const inset = Math.min(1.5, Math.max(0.6, Math.min(width, height) * 0.04));
  const left = x + inset;
  const right = x + width - inset;
  const top = y + inset;
  const bottom = y + height - inset;
  const centerX = x + (width / 2);
  const centerY = y + (height / 2);
  const samples = [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
    [centerX, centerY],
    [centerX, top],
    [centerX, bottom],
    [left, centerY],
    [right, centerY],
  ];
  const insideCount = samples.filter(([sampleX, sampleY]) => pointInsidePolygon(sampleX, sampleY, polygon)).length;
  return insideCount / samples.length;
};

const rectangleFitsPolygon = (
  polygon: Array<{ x: number; y: number }>,
  x: number,
  y: number,
  width: number,
  height: number,
) => rectanglePolygonScore(polygon, x, y, width, height) >= 1;

const buildColumnOrder = (maxColumns: number, preferredColumns: number) => {
  const ordered: number[] = [];
  const seen = new Set<number>();

  const push = (value: number) => {
    if (value < 1 || value > maxColumns || seen.has(value)) return;
    seen.add(value);
    ordered.push(value);
  };

  push(preferredColumns);
  for (let delta = 1; delta < maxColumns; delta += 1) {
    push(preferredColumns + delta);
    push(preferredColumns - delta);
  }
  for (let value = maxColumns; value >= 1; value -= 1) push(value);
  return ordered;
};

const buildCardLayout = (
  points: CenterPoint[],
  startX: number,
  startY: number,
  columns: number,
  cardWidth: number,
  cardHeight: number,
  gapX: number,
  gapY: number,
) => {
  const rows = Math.ceil(points.length / columns);
  const fullRowWidth = (cardWidth * columns) + (gapX * Math.max(0, columns - 1));
  const placements: PointCardPlacement[] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const rowStart = rowIndex * columns;
    const rowPoints = points.slice(rowStart, rowStart + columns);
    const rowWidth = (cardWidth * rowPoints.length) + (gapX * Math.max(0, rowPoints.length - 1));
    const rowOffsetX = startX + Math.max(0, (fullRowWidth - rowWidth) / 2);

    rowPoints.forEach((point, columnIndex) => {
      placements.push({
        point,
        x: round(rowOffsetX + (columnIndex * (cardWidth + gapX))),
        y: round(startY + (rowIndex * (cardHeight + gapY))),
        width: round(cardWidth),
        height: round(cardHeight),
      });
    });
  }

  return placements;
};

export const PointCardLayoutEngine = {
  computePointCardPlan(
    region: MapRegion,
    points: CenterPoint[],
    label: CenterLabelLayout,
    visualWeight: number,
  ): PointCardPlan {
    if (!points.length) {
      return {
        cards: [],
        showReading: false,
        codeFontSize: 8,
        readingFontSize: 7,
        paddingX: 4,
        paddingY: 3,
        gapX: 4,
        gapY: 4,
        borderRadius: 6,
        borderWidth: 1.2,
        relaxedFit: false,
      };
    }

    const regionWidth = region.bbox.maxX - region.bbox.minX;
    const regionHeight = region.bbox.maxY - region.bbox.minY;
    const sidePadding = clamp(regionWidth * 0.04, 4, 8);
    const bottomPadding = clamp(regionHeight * 0.03, 3, 6);
    const titleGap = clamp(regionHeight * 0.03, 3, 6);
    const innerX = region.bbox.minX + sidePadding;
    const innerY = label.bottom + titleGap;
    const innerWidth = Math.max(0, regionWidth - (sidePadding * 2));
    const innerHeight = Math.max(0, region.bbox.maxY - innerY - bottomPadding);
    const polygon = region.map_shape.points || [];
    const pointsWithReading = points.filter(point => PointGroupingService.pointHasReadableMetric(point)).length;
    const hasReading = pointsWithReading > 0;
    const showCompactReading = hasReading && points.length <= 18;
    const maxReadingLines = hasReading
      ? points.reduce((maxLines, point) => {
          const entryCount = PointGroupingService.pointReadingEntries(point, 'compact').length;
          const fallbackCount = PointGroupingService.pointReading(point).trim() ? 1 : 0;
          return Math.max(maxLines, Math.max(entryCount, fallbackCount));
        }, 0)
      : 0;
    const readingLineBoost = Math.max(0, maxReadingLines - 1);
    const readingHeightBoost = readingLineBoost * 4.6;
    const readingThresholdBoost = readingLineBoost * 5;

    const states = [
      {
        showReading: hasReading && points.length <= 12 && innerHeight >= (42 + readingThresholdBoost),
        minWidth: 56,
        maxWidth: 70,
        minHeight: 28 + readingHeightBoost,
        maxHeight: 34 + readingHeightBoost,
        codeFontSize: 8,
        readingFontSize: 7,
        paddingX: 4,
        paddingY: 3,
        gapX: 4,
        gapY: 4,
        borderRadius: 6,
        borderWidth: 1.2,
      },
      {
        showReading: hasReading && points.length <= 16 && innerHeight >= (36 + readingThresholdBoost),
        minWidth: 50,
        maxWidth: 64,
        minHeight: 26 + readingHeightBoost,
        maxHeight: 32 + readingHeightBoost,
        codeFontSize: 7.5,
        readingFontSize: 6.5,
        paddingX: 3.5,
        paddingY: 2.5,
        gapX: 3.5,
        gapY: 3.5,
        borderRadius: 5.5,
        borderWidth: 1.2,
      },
      {
        showReading: showCompactReading,
        minWidth: 46,
        maxWidth: 60,
        minHeight: 24 + readingHeightBoost,
        maxHeight: 30 + readingHeightBoost,
        codeFontSize: 7.2,
        readingFontSize: 5.9,
        paddingX: 3.5,
        paddingY: 2.5,
        gapX: 3.5,
        gapY: 3.5,
        borderRadius: 5.5,
        borderWidth: 1.2,
      },
      {
        showReading: showCompactReading,
        minWidth: 42,
        maxWidth: 56,
        minHeight: 22 + readingHeightBoost,
        maxHeight: 28 + readingHeightBoost,
        codeFontSize: 6.8,
        readingFontSize: 5.5,
        paddingX: 3,
        paddingY: 2.2,
        gapX: 3,
        gapY: 3,
        borderRadius: 5,
        borderWidth: 1.2,
      },
      {
        showReading: showCompactReading,
        minWidth: 38,
        maxWidth: 52,
        minHeight: 20 + readingHeightBoost,
        maxHeight: 26 + readingHeightBoost,
        codeFontSize: 6.4,
        readingFontSize: 5.2,
        paddingX: 2.8,
        paddingY: 2,
        gapX: 2.8,
        gapY: 2.8,
        borderRadius: 4.8,
        borderWidth: 1.2,
      },
      {
        showReading: showCompactReading && points.length <= 12,
        minWidth: 34,
        maxWidth: 48,
        minHeight: 18 + readingHeightBoost,
        maxHeight: 24 + readingHeightBoost,
        codeFontSize: 6,
        readingFontSize: 5,
        paddingX: 2.5,
        paddingY: 1.8,
        gapX: 2.5,
        gapY: 2.5,
        borderRadius: 4.5,
        borderWidth: 1.2,
      },
    ].map(state => ({
      ...state,
      minWidth: round(state.minWidth * POINT_CARD_SCALE),
      maxWidth: round(state.maxWidth * POINT_CARD_SCALE),
      minHeight: round(state.minHeight * POINT_CARD_SCALE),
      maxHeight: round(state.maxHeight * POINT_CARD_SCALE),
      codeFontSize: round(state.codeFontSize * POINT_CARD_FONT_SCALE),
      readingFontSize: round(state.readingFontSize * POINT_CARD_FONT_SCALE),
      paddingX: round(state.paddingX * POINT_CARD_FONT_SCALE),
      paddingY: round(state.paddingY * POINT_CARD_FONT_SCALE),
      borderRadius: round(state.borderRadius * POINT_CARD_FONT_SCALE),
    }));

    let bestRelaxed: (PointCardPlan & { score: number }) | null = null;

    for (const state of states) {
      const maxColumns = Math.max(
        1,
        Math.min(points.length, 6, Math.floor((innerWidth + state.gapX) / (state.minWidth + state.gapX))),
      );
      if (maxColumns < 1) continue;

      const preferredColumns = points.length <= 2
        ? Math.min(maxColumns, innerWidth >= 100 ? 2 : 1)
        : points.length <= 4
          ? Math.min(maxColumns, 2)
        : points.length >= 12 && innerWidth >= 240
          ? Math.min(maxColumns, 6)
          : points.length >= 8 && innerWidth >= 180
            ? Math.min(maxColumns, 5)
            : innerWidth >= 280
          ? Math.min(maxColumns, 6)
          : innerWidth >= 200
            ? Math.min(maxColumns, 5)
            : innerWidth >= 150
              ? Math.min(maxColumns, 4)
              : innerWidth >= 100
                ? Math.min(maxColumns, 3)
                : innerWidth >= 70
                  ? Math.min(maxColumns, 2)
                  : 1;
      const columnOrder = buildColumnOrder(maxColumns, preferredColumns);

      for (const columns of columnOrder) {
        const rows = Math.ceil(points.length / columns);
        const rawCardWidth = (innerWidth - (state.gapX * Math.max(0, columns - 1))) / columns;
        if (rawCardWidth < state.minWidth) continue;

        const cardWidth = Math.min(state.maxWidth, rawCardWidth);
        const totalWidth = (cardWidth * columns) + (state.gapX * Math.max(0, columns - 1));
        const rawCardHeight = (innerHeight - (state.gapY * Math.max(0, rows - 1))) / rows;
        if (rawCardHeight < state.minHeight) continue;

        const cardHeight = Math.min(state.maxHeight, rawCardHeight);
        const totalHeight = (cardHeight * rows) + (state.gapY * Math.max(0, rows - 1));
        if (totalHeight > innerHeight + 0.1) continue;

        const startX = innerX + Math.max(0, (innerWidth - totalWidth) / 2);
        const startY = innerY + Math.max(0, Math.min((innerHeight - totalHeight) / 2, visualWeight >= 5 ? 3 : 6));
        const cards = buildCardLayout(points, startX, startY, columns, cardWidth, cardHeight, state.gapX, state.gapY);

        const strictFit = polygon.length < 3
          || cards.every(card => rectangleFitsPolygon(polygon, card.x, card.y, card.width, card.height));

        const candidate: PointCardPlan = {
          cards,
          showReading: state.showReading,
          codeFontSize: state.codeFontSize,
          readingFontSize: state.readingFontSize,
          paddingX: state.paddingX,
          paddingY: state.paddingY,
          gapX: state.gapX,
          gapY: state.gapY,
          borderRadius: state.borderRadius,
          borderWidth: state.borderWidth,
          relaxedFit: false,
        };

        if (strictFit) return candidate;

        const fitScore = cards.reduce(
          (score, card) => score + rectanglePolygonScore(polygon, card.x, card.y, card.width, card.height),
          0,
        ) / Math.max(1, cards.length);
        const score = fitScore + (columns * 0.018);
        if (!bestRelaxed || score > bestRelaxed.score) {
          bestRelaxed = {
            ...candidate,
            relaxedFit: true,
            score,
          };
        }
      }
    }

    if (bestRelaxed) {
      const { score, ...plan } = bestRelaxed;
      return plan;
    }

    const emergencyGapX = 2.5;
    const emergencyGapY = 2.5;
    const emergencyWidth = clamp(
      (innerWidth / Math.max(1, Math.min(points.length, 4))) - emergencyGapX,
      round(34 * POINT_CARD_SCALE),
      round(46 * POINT_CARD_SCALE),
    );
    const emergencyHeight = clamp(
      (innerHeight / Math.max(1, Math.min(points.length, 4))) - emergencyGapY,
      round(16 * POINT_CARD_SCALE),
      round(20 * POINT_CARD_SCALE),
    );
    const emergencyMaxColumns = Math.max(1, Math.floor((innerWidth + emergencyGapX) / (emergencyWidth + emergencyGapX)));
    const emergencyRowsPerColumn = Math.max(1, Math.floor((innerHeight + emergencyGapY) / (emergencyHeight + emergencyGapY)));
    const emergencyColumns = clamp(
      Math.ceil(points.length / emergencyRowsPerColumn),
      1,
      Math.max(1, emergencyMaxColumns),
    );
    const emergencyCards = buildCardLayout(
      points,
      innerX + Math.max(0, (innerWidth - ((emergencyWidth * emergencyColumns) + (emergencyGapX * Math.max(0, emergencyColumns - 1)))) / 2),
      innerY + 1,
      emergencyColumns,
      emergencyWidth,
      emergencyHeight,
      emergencyGapX,
      emergencyGapY,
    );
    return {
      cards: emergencyCards,
      showReading: showCompactReading && points.length <= 10,
      codeFontSize: round(5.8 * POINT_CARD_FONT_SCALE),
      readingFontSize: round(4.8 * POINT_CARD_FONT_SCALE),
      paddingX: 2.5,
      paddingY: 1.8,
      gapX: emergencyGapX,
      gapY: emergencyGapY,
      borderRadius: round(4.5 * POINT_CARD_FONT_SCALE),
      borderWidth: 1.2,
      relaxedFit: true,
    };
  },

  computeRegionRenderPlan(region: MapRegion, points: CenterPoint[], visualWeight: number, lang: 'ar' | 'en'): RegionRenderPlan {
    const label = LabelLayoutEngine.compute(region, points.length, visualWeight, lang);
    const cards = this.computePointCardPlan(region, points, label, visualWeight);
    return {
      label,
      cards,
      visualWeight,
    };
  },
};
