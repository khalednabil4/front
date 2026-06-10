import { CentersMapResponse, MapRegion, ParsedViewBox, PolygonPoint } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

const bboxFromPoints = (points: PolygonPoint[]) => {
  if (!points.length) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

export const MapViewportFitter = {
  parseViewBox(value?: string | null): ParsedViewBox {
    const parts = String(value || '0 0 1000 700')
      .trim()
      .split(/\s+/)
      .map(Number);
    const [minX = 0, minY = 0, width = 1000, height = 700] = parts;
    return {
      minX,
      minY,
      width,
      height,
      maxX: minX + width,
      maxY: minY + height,
    };
  },

  fitMap(
    map: CentersMapResponse['map'] | null | undefined,
    regions: MapRegion[],
    viewportWidth: number,
    viewportHeight: number,
  ): ParsedViewBox {
    const fallback = this.parseViewBox(map?.view_box);
    if (!regions.length) return fallback;

    const contentBbox = map?.content_bbox;
    const bbox = contentBbox && Number.isFinite(contentBbox.minX)
      ? {
          minX: contentBbox.minX,
          maxX: contentBbox.maxX,
          minY: contentBbox.minY,
          maxY: contentBbox.maxY,
        }
      : bboxFromPoints(regions.flatMap(region => region.map_shape.points || []));

    const baseWidth = Math.max(1, bbox.maxX - bbox.minX);
    const baseHeight = Math.max(1, bbox.maxY - bbox.minY);
    const paddingRatio = clamp(Math.max(baseWidth, baseHeight) > 400 ? 0.018 : 0.024, 0.012, 0.032);
    const paddingX = Math.max(4, baseWidth * paddingRatio);
    const paddingY = Math.max(4, baseHeight * paddingRatio);

    let minX = bbox.minX - paddingX;
    let maxX = bbox.maxX + paddingX;
    let minY = bbox.minY - paddingY;
    let maxY = bbox.maxY + paddingY;

    const stageWidth = Math.max(1, maxX - minX);
    const stageHeight = Math.max(1, maxY - minY);
    const viewportAspect = Math.max(1, viewportWidth) / Math.max(1, viewportHeight);
    const stageAspect = stageWidth / stageHeight;

    if (stageAspect < viewportAspect) {
      const targetWidth = stageHeight * viewportAspect;
      maxX = bbox.maxX + paddingX;
      minX = maxX - targetWidth;
    } else if (stageAspect > viewportAspect) {
      const targetHeight = stageWidth / viewportAspect;
      const extraHeight = (targetHeight - stageHeight) / 2;
      minY -= extraHeight;
      maxY += extraHeight;
    }

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    return {
      minX: round(minX),
      minY: round(minY),
      width: round(width),
      height: round(height),
      maxX: round(minX + width),
      maxY: round(minY + height),
    };
  },
};
