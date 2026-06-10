import { MapRegion } from './types';

const BASE_SIZE_WEIGHT: Record<string, number> = {
  small: 1.0,
  medium: 1.5,
  large: 2.0,
};

export const RegionWeightCalculator = {
  calculate(region: MapRegion) {
    if (typeof region.stats.visual_weight === 'number' && region.stats.visual_weight > 0) {
      return region.stats.visual_weight;
    }

    const baseWeight = BASE_SIZE_WEIGHT[String(region.size || 'medium').toLowerCase()] || BASE_SIZE_WEIGHT.medium;
    const pointsCount = Number(region.stats.points_count || 0);
    const activePoints = Number(region.stats.active_points || 0);
    const inactivePoints = Number(region.stats.inactive_points || 0);
    return Number((baseWeight + (pointsCount * 0.3) + (activePoints * 0.1) + (inactivePoints * 0.1)).toFixed(2));
  },
};
