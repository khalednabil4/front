import { MapRegion } from './types';

const calculatePolygonArea = (points: {x: number, y: number}[]): number => {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area / 2;
};

const extractOuterPath = (path: string, fallbackPoints?: {x: number, y: number}[]): string => {
  const buildFallback = () => {
    if (fallbackPoints && fallbackPoints.length >= 3) {
      return fallbackPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
    }
    return '';
  };

  if (!path) return buildFallback();

  // Split path into subpaths by 'M' or 'm' commands
  const subPathStrings = path.replace(/m/g, 'M').split('M').filter(s => s.trim().length > 0);
  
  let maxArea = -1;
  let bestSubPath = '';

  for (const spStr of subPathStrings) {
    const fullSp = 'M ' + spStr.trim();
    const matches = fullSp.match(/[+-]?\d+(\.\d+)?/g);
    if (!matches || matches.length < 6) continue;
    
    const points: {x: number, y: number}[] = [];
    for (let i = 0; i < matches.length; i += 2) {
      points.push({ x: parseFloat(matches[i]), y: parseFloat(matches[i+1]) });
    }
    
    const area = Math.abs(calculatePolygonArea(points));
    if (area > maxArea) {
      maxArea = area;
      bestSubPath = fullSp;
      if (!bestSubPath.toUpperCase().endsWith('Z')) {
        bestSubPath += ' Z';
      }
    }
  }

  if (maxArea <= 0 || !bestSubPath) {
    const fallback = buildFallback();
    return fallback || path; // Return raw path as absolute last resort
  }

  return bestSubPath;
};

export const SharedBorderGenerator = {
  generate(regions: MapRegion[], _regionCount: number) {
    const regionPaths = new Map<number, string>();

    regions.forEach(r => {
      const rawPath = r.path || '';
      const cleanPath = extractOuterPath(rawPath, r.map_shape?.points);
      regionPaths.set(r.id, cleanPath);
    });

    return { regionPaths };
  },

  buildRegionPath(regionId: number, regionPaths: Map<number, string>): string {
    return regionPaths.get(regionId) || '';
  },
};
