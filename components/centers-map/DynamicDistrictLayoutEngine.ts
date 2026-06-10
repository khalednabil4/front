import { CentersMapResponse, LabelPayload, MapRegion, PolygonBbox, PolygonPoint } from './types';

interface SourceRegion {
  region: MapRegion;
  centerX: number;
  centerY: number;
}

interface RegionBox {
  source: SourceRegion;
  left: number;
  top: number;
  width: number;
  height: number;
  rowIndex: number;
  columnIndex: number;
}

interface LayoutOptions {
  rightPadding: number;
  topPadding: number;
  bottomPadding: number;
  gap: number;
  minRegionWidth: number;
  minRegionHeight: number;
}

export interface DistrictLayoutResult {
  regions: MapRegion[];
  contentBBox: PolygonBbox;
  centerBBox: PolygonBbox;
  landmassPath: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

const finiteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const bboxFromPoints = (points: PolygonPoint[]): PolygonBbox => {
  if (!points.length) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      centerX: 0,
      centerY: 0,
    };
  }

  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX: round(minX),
    maxX: round(maxX),
    minY: round(minY),
    maxY: round(maxY),
    centerX: round((minX + maxX) / 2),
    centerY: round((minY + maxY) / 2),
  };
};

const bboxFromBoxes = (boxes: RegionBox[]): PolygonBbox => bboxFromPoints(
  boxes.flatMap(box => ([
    { x: box.left, y: box.top },
    { x: box.left + box.width, y: box.top + box.height },
  ])),
);

const layoutOptions = (containerWidth: number, containerHeight: number): LayoutOptions => {
  const minRegionWidth = containerWidth >= 900 ? 220 : clamp(containerWidth * 0.34, 140, 220);
  const minRegionHeight = containerHeight >= 650 ? 160 : clamp(containerHeight * 0.24, 105, 160);

  return {
    rightPadding: clamp(containerWidth * 0.024, 18, 52),
    topPadding: clamp(containerHeight * 0.035, 22, 54),
    bottomPadding: clamp(containerHeight * 0.035, 22, 58),
    gap: 0,
    minRegionWidth,
    minRegionHeight,
  };
};

const sourceCenterForRegion = (region: MapRegion): SourceRegion => {
  const layoutCenterX = finiteNumber(region.layout_center?.centerX);
  const layoutCenterY = finiteNumber(region.layout_center?.centerY);
  const mapPosition = region.map_position || {};
  const positionX = finiteNumber(mapPosition.x);
  const positionY = finiteNumber(mapPosition.y);
  return {
    region,
    centerX: layoutCenterX ?? positionX ?? region.bbox.centerX,
    centerY: layoutCenterY ?? positionY ?? region.bbox.centerY,
  };
};

const buildRoundedBlockPath = (
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
) => {
  const right = left + width;
  const bottom = top + height;
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  const curve = clamp(r * 0.18, 2, 6);

  return [
    `M ${round(left + r)} ${round(top)}`,
    `C ${round(left + (width * 0.32))} ${round(top + curve)}, ${round(left + (width * 0.68))} ${round(top + curve)}, ${round(right - r)} ${round(top)}`,
    `Q ${round(right)} ${round(top)} ${round(right)} ${round(top + r)}`,
    `C ${round(right - curve)} ${round(top + (height * 0.32))}, ${round(right - curve)} ${round(top + (height * 0.68))}, ${round(right)} ${round(bottom - r)}`,
    `Q ${round(right)} ${round(bottom)} ${round(right - r)} ${round(bottom)}`,
    `C ${round(left + (width * 0.68))} ${round(bottom - curve)}, ${round(left + (width * 0.32))} ${round(bottom - curve)}, ${round(left + r)} ${round(bottom)}`,
    `Q ${round(left)} ${round(bottom)} ${round(left)} ${round(bottom - r)}`,
    `C ${round(left + curve)} ${round(top + (height * 0.68))}, ${round(left + curve)} ${round(top + (height * 0.32))}, ${round(left)} ${round(top + r)}`,
    `Q ${round(left)} ${round(top)} ${round(left + r)} ${round(top)}`,
    'Z',
  ].join(' ');
};

interface InterlockEdges {
  top: number[];
  right: number[];
  bottom: number[];
  left: number[];
}

const edgeOverlap = (firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) => {
  const start = Math.max(firstStart, secondStart);
  const end = Math.min(firstEnd, secondEnd);
  return end - start > 8 ? { start, end, center: (start + end) / 2 } : null;
};

const buildHorizontalEdge = (
  segments: string[],
  startX: number,
  endX: number,
  y: number,
  tabCenters: number[],
  tabDepth: number,
  tabLength: number,
) => {
  const direction = endX >= startX ? 1 : -1;
  const orderedCenters = tabCenters
    .filter(center => (
      direction > 0
        ? center > Math.min(startX, endX) + tabLength && center < Math.max(startX, endX) - tabLength
        : center < Math.max(startX, endX) - tabLength && center > Math.min(startX, endX) + tabLength
    ))
    .sort((a, b) => direction > 0 ? a - b : b - a);

  orderedCenters.forEach(center => {
    const entryX = center - (direction * tabLength);
    const exitX = center + (direction * tabLength);
    segments.push(`L ${round(entryX)} ${round(y)}`);
    segments.push(
      `C ${round(center - (direction * tabLength * 0.48))} ${round(y)}, ${round(center - (direction * tabLength * 0.44))} ${round(y + tabDepth)}, ${round(center)} ${round(y + tabDepth)}`,
    );
    segments.push(
      `C ${round(center + (direction * tabLength * 0.44))} ${round(y + tabDepth)}, ${round(center + (direction * tabLength * 0.48))} ${round(y)}, ${round(exitX)} ${round(y)}`,
    );
  });

  segments.push(`L ${round(endX)} ${round(y)}`);
};

const buildVerticalEdge = (
  segments: string[],
  x: number,
  startY: number,
  endY: number,
  tabCenters: number[],
  tabDepth: number,
  tabLength: number,
) => {
  const direction = endY >= startY ? 1 : -1;
  const orderedCenters = tabCenters
    .filter(center => (
      direction > 0
        ? center > Math.min(startY, endY) + tabLength && center < Math.max(startY, endY) - tabLength
        : center < Math.max(startY, endY) - tabLength && center > Math.min(startY, endY) + tabLength
    ))
    .sort((a, b) => direction > 0 ? a - b : b - a);

  orderedCenters.forEach(center => {
    const entryY = center - (direction * tabLength);
    const exitY = center + (direction * tabLength);
    segments.push(`L ${round(x)} ${round(entryY)}`);
    segments.push(
      `C ${round(x)} ${round(center - (direction * tabLength * 0.48))}, ${round(x + tabDepth)} ${round(center - (direction * tabLength * 0.44))}, ${round(x + tabDepth)} ${round(center)}`,
    );
    segments.push(
      `C ${round(x + tabDepth)} ${round(center + (direction * tabLength * 0.44))}, ${round(x)} ${round(center + (direction * tabLength * 0.48))}, ${round(x)} ${round(exitY)}`,
    );
  });

  segments.push(`L ${round(x)} ${round(endY)}`);
};

export const buildInterlockedRegionPath = (box: RegionBox, edges: InterlockEdges) => {
  const left = box.left;
  const top = box.top;
  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const radius = clamp(Math.min(box.width, box.height) * 0.075, 16, 28);
  const tabDepth = clamp(Math.min(box.width, box.height) * 0.045, 9, 18);
  const tabLength = clamp(Math.min(box.width, box.height) * 0.115, 24, 46);
  const segments = [`M ${round(left + radius)} ${round(top)}`];

  buildHorizontalEdge(segments, left + radius, right - radius, top, edges.top, tabDepth, tabLength);
  segments.push(`Q ${round(right)} ${round(top)} ${round(right)} ${round(top + radius)}`);
  buildVerticalEdge(segments, right, top + radius, bottom - radius, edges.right, tabDepth, tabLength);
  segments.push(`Q ${round(right)} ${round(bottom)} ${round(right - radius)} ${round(bottom)}`);
  buildHorizontalEdge(segments, right - radius, left + radius, bottom, edges.bottom, tabDepth, tabLength);
  segments.push(`Q ${round(left)} ${round(bottom)} ${round(left)} ${round(bottom - radius)}`);
  buildVerticalEdge(segments, left, bottom - radius, top + radius, edges.left, tabDepth, tabLength);
  segments.push(`Q ${round(left)} ${round(top)} ${round(left + radius)} ${round(top)}`);
  segments.push('Z');
  return segments.join(' ');
};

const rectanglePoints = (left: number, top: number, width: number, height: number): PolygonPoint[] => [
  { x: round(left), y: round(top) },
  { x: round(left + width), y: round(top) },
  { x: round(left + width), y: round(top + height) },
  { x: round(left), y: round(top + height) },
];

const sizeMultiplierForRegion = (region: MapRegion) => {
  const size = String(region.size || 'medium').toLowerCase();
  if (size === 'large') return 1.12;
  if (size === 'small') return 0.96;
  return 1;
};

const districtRowSizes = (count: number) => {
  if (count <= 0) return [];
  if (count <= 3) return [count];
  if (count === 4) return [2, 2];
  if (count === 5) return [2, 3];
  if (count === 6) return [2, 2, 2];
  if (count === 7) return [2, 3, 2];
  if (count === 8) return [2, 4, 2];
  if (count === 9) return [3, 3, 3];

  const rowCount = Math.max(3, Math.round(Math.sqrt(count)));
  const base = Math.floor(count / rowCount);
  let remainder = count % rowCount;
  const sizes = Array.from({ length: rowCount }, () => base);
  const middle = Math.floor(rowCount / 2);
  const offsets = sizes.map((_, index) => index).sort((a, b) => {
    const distance = Math.abs(a - middle) - Math.abs(b - middle);
    return distance || a - b;
  });

  offsets.forEach(index => {
    if (remainder <= 0) return;
    sizes[index] += 1;
    remainder -= 1;
  });

  return sizes.filter(Boolean);
};

const cloneLabelForBox = (label: LabelPayload, box: RegionBox): LabelPayload => {
  const centerX = box.left + (box.width / 2);
  const centerY = box.top + (box.height / 2);
  return {
    ...label,
    x: round(centerX),
    y: round(centerY),
    subtitle_y: round(centerY + 18),
    badge_x: round(centerX),
    badge_y: round(centerY + 24),
  };
};

export const normalizeRegionPositions = (regions: SourceRegion[]) => {
  const centerBBox = bboxFromPoints(regions.map(source => ({ x: source.centerX, y: source.centerY })));
  return {
    centerBBox,
    regions: regions.map(source => ({
      ...source,
      normalizedX: source.centerX - centerBBox.minX,
      normalizedY: source.centerY - centerBBox.minY,
    })),
  };
};

export const alignMapToRight = (
  containerWidth: number,
  containerHeight: number,
  options: LayoutOptions,
) => {
  const leftSafetyPadding = clamp(containerWidth * 0.014, 12, 34);
  const availableWidth = Math.max(1, containerWidth - options.rightPadding - leftSafetyPadding);
  const availableHeight = Math.max(1, containerHeight - options.topPadding - options.bottomPadding);
  const mapWidth = availableWidth * 0.965;
  const mapHeight = availableHeight * 0.955;
  const rightAnchorX = containerWidth - options.rightPadding;
  return {
    left: rightAnchorX - mapWidth,
    top: options.topPadding + ((availableHeight - mapHeight) / 2),
    width: mapWidth,
    height: mapHeight,
    rightAnchorX,
  };
};

export const calculateMapLayout = (
  sourceRegions: SourceRegion[],
  containerWidth: number,
  containerHeight: number,
  options: LayoutOptions,
) => {
  const { centerBBox } = normalizeRegionPositions(sourceRegions);
  const mapFrame = alignMapToRight(containerWidth, containerHeight, options);
  const count = Math.max(1, sourceRegions.length);
  const rowSizes = districtRowSizes(count);
  const orderedBySourceY = [...sourceRegions].sort((first, second) => (
    (first.centerY - second.centerY)
    || (first.centerX - second.centerX)
    || (first.region.id - second.region.id)
  ));
  const rows: SourceRegion[][] = [];
  let cursor = 0;
  rowSizes.forEach(rowSize => {
    rows.push(
      orderedBySourceY
        .slice(cursor, cursor + rowSize)
        .sort((first, second) => (first.centerX - second.centerX) || (first.region.id - second.region.id)),
    );
    cursor += rowSize;
  });
  if (cursor < orderedBySourceY.length) {
    rows.push(
      orderedBySourceY
        .slice(cursor)
        .sort((first, second) => (first.centerX - second.centerX) || (first.region.id - second.region.id)),
    );
  }

  const visibleRows = rows.filter(row => row.length);
  const rowCount = Math.max(1, visibleRows.length);
  const rowHeight = (mapFrame.height - (options.gap * Math.max(0, rowCount - 1))) / rowCount;
  const boxes = visibleRows.flatMap((row, rowIndex) => {
    const columnCount = Math.max(1, row.length);
    const columnWidth = (mapFrame.width - (options.gap * Math.max(0, columnCount - 1))) / columnCount;
    const top = mapFrame.top + (rowIndex * (rowHeight + options.gap));

    return row.map((source, columnIndex) => {
      const sizeMultiplier = sizeMultiplierForRegion(source.region);
      const width = clamp(columnWidth, options.minRegionWidth, mapFrame.width);
      const height = clamp(rowHeight * (0.995 + ((sizeMultiplier - 1) * 0.005)), options.minRegionHeight, rowHeight);
      return {
        source,
        left: round(mapFrame.left + (columnIndex * (columnWidth + options.gap))),
        top: round(top + ((rowHeight - height) / 2)),
        width: round(width),
        height: round(height),
        rowIndex,
        columnIndex,
      };
    });
  });

  return {
    boxes,
    centerBBox,
  };
};

const buildInterlockEdges = (box: RegionBox, boxes: RegionBox[]): InterlockEdges => {
  const boxRight = box.left + box.width;
  const boxBottom = box.top + box.height;
  const tolerance = 1.5;
  const edges: InterlockEdges = { top: [], right: [], bottom: [], left: [] };

  boxes.forEach(other => {
    if (other === box) return;
    const otherRight = other.left + other.width;
    const otherBottom = other.top + other.height;

    if (Math.abs(boxRight - other.left) <= tolerance) {
      const overlap = edgeOverlap(box.top, boxBottom, other.top, otherBottom);
      if (overlap) edges.right.push(overlap.center);
    }
    if (Math.abs(box.left - otherRight) <= tolerance) {
      const overlap = edgeOverlap(box.top, boxBottom, other.top, otherBottom);
      if (overlap) edges.left.push(overlap.center);
    }
    if (Math.abs(boxBottom - other.top) <= tolerance) {
      const overlap = edgeOverlap(box.left, boxRight, other.left, otherRight);
      if (overlap) edges.bottom.push(overlap.center);
    }
    if (Math.abs(box.top - otherBottom) <= tolerance) {
      const overlap = edgeOverlap(box.left, boxRight, other.left, otherRight);
      if (overlap) edges.top.push(overlap.center);
    }
  });

  return edges;
};

const buildLandmassPath = (bbox: PolygonBbox) => {
  const padding = 10;
  const left = bbox.minX - padding;
  const top = bbox.minY - padding;
  const width = (bbox.maxX - bbox.minX) + (padding * 2);
  const height = (bbox.maxY - bbox.minY) + (padding * 2);
  return buildRoundedBlockPath(left, top, width, height, clamp(Math.min(width, height) * 0.06, 18, 32));
};

export const DynamicDistrictLayoutEngine = {
  build(
    map: CentersMapResponse['map'] | null | undefined,
    regions: MapRegion[],
    containerWidth: number,
    containerHeight: number,
  ): DistrictLayoutResult {
    if (!regions.length) {
      const emptyBBox = bboxFromPoints([]);
      return {
        regions: [],
        contentBBox: map?.content_bbox || emptyBBox,
        centerBBox: emptyBBox,
        landmassPath: map?.landmass_path || '',
      };
    }

    const safeWidth = Math.max(320, containerWidth || 1280);
    const safeHeight = Math.max(320, containerHeight || 720);
    const sourceRegions = regions.map(sourceCenterForRegion);
    const options = layoutOptions(safeWidth, safeHeight);
    const { boxes, centerBBox } = calculateMapLayout(sourceRegions, safeWidth, safeHeight, options);
    const contentBBox = bboxFromBoxes(boxes);
    const renderedRegions = boxes.map(box => {
      const points = rectanglePoints(box.left, box.top, box.width, box.height);
      const bbox = bboxFromPoints(points);
      const region = box.source.region;
      const interlockEdges = buildInterlockEdges(box, boxes);

      return {
        ...region,
        path: buildInterlockedRegionPath(box, interlockEdges),
        bbox,
        label: cloneLabelForBox(region.label, box),
        map_shape: {
          ...region.map_shape,
          points,
          bbox,
          template: 'dynamic-rounded-district',
          source_center: {
            centerX: round(box.source.centerX),
            centerY: round(box.source.centerY),
            normalizedX: round(box.source.centerX - centerBBox.minX),
            normalizedY: round(box.source.centerY - centerBBox.minY),
          },
        },
      };
    });

    return {
      regions: renderedRegions,
      contentBBox,
      centerBBox,
      landmassPath: buildLandmassPath(contentBBox),
    };
  },
};
