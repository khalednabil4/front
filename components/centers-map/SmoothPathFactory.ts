import { PolygonPoint } from './types';

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * Chaikin's corner cutting algorithm to organically smooth closed polygons.
 */
const chaikinClosed = (points: PolygonPoint[], iterations: number): PolygonPoint[] => {
  if (iterations === 0 || points.length < 3) return points;
  let current = points;
  
  for (let i = 0; i < iterations; i++) {
    const next: PolygonPoint[] = [];
    const n = current.length;
    for (let j = 0; j < n; j++) {
      const p1 = current[j];
      const p2 = current[(j + 1) % n];
      
      // Cut at 25% and 75%
      next.push({
        x: p1.x * 0.75 + p2.x * 0.25,
        y: p1.y * 0.75 + p2.y * 0.25
      });
      next.push({
        x: p1.x * 0.25 + p2.x * 0.75,
        y: p1.y * 0.25 + p2.y * 0.75
      });
    }
    current = next;
  }
  return current;
};

export const SmoothPathFactory = {
  getTension(_count: number) { return 0; },
  getCornerRadius(_count: number) { return 0; },

  /**
   * Applies Chaikin smoothing to get the organic look.
   */
  buildPolygonPath(points: PolygonPoint[]): string {
    if (points.length < 3) return '';
    
    // Disable Chaikin smoothing - use exact backend points
    const smoothed = points;
    
    return (
      smoothed.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ') + ' Z'
    );
  },

  closedFromPath(path: string, _tension = 0.25): string {
    return path || '';
  },

  // backward compat stub
  smoothEdge(points: PolygonPoint[], _tension: number, _isShared: boolean) {
    return { forward: '', reverse: '' };
  },

  roundedPolygonPath(points: PolygonPoint[], _cornerRadius: number): string {
    return this.buildPolygonPath(points);
  },
};
