import React, { useEffect, useMemo, useState } from 'react';
import { Language } from '../types';
import { FullScreenMonitoringLayout } from './centers-map/FullScreenMonitoringLayout';
import { DynamicDistrictLayoutEngine } from './centers-map/DynamicDistrictLayoutEngine';
import { MapViewportFitter } from './centers-map/MapViewportFitter';
import { PointCardLayoutEngine } from './centers-map/PointCardLayoutEngine';
import { PointGroupingService } from './centers-map/PointGroupingService';
import { RegionRenderer } from './centers-map/RegionRenderer';
import { RegionWeightCalculator } from './centers-map/RegionWeightCalculator';
import { SmoothPathFactory } from './centers-map/SmoothPathFactory';
import { SharedBorderGenerator } from './centers-map/SharedBorderGenerator';
import { CenterPoint, CentersMapResponse, RegionRenderPlan } from './centers-map/types';

const AUTO_REFRESH_INTERVAL_MS = 60 * 1000;

const labelsFor = (lang: Language) => (
  lang === 'ar'
    ? {
        noData: 'لا توجد مراكز جاهزة للعرض حالياً.',
        loadFailed: 'تعذر تحميل الخريطة.',
        loading: 'جارٍ تحميل الخريطة...',
      }
    : {
        noData: 'No centers are ready to display.',
        loadFailed: 'Failed to load the map.',
        loading: 'Loading map...',
      }
);

export const CentersMapPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const labels = labelsFor(lang);
  const [data, setData] = useState<CentersMapResponse | null>(null);
  const [points, setPoints] = useState<CenterPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<number | null>(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1920 : window.innerWidth,
    height: typeof window === 'undefined' ? 1080 : window.innerHeight,
  }));

  const loadData = React.useEffectEvent(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    const shouldShowLoader = !quiet || !data;
    if (shouldShowLoader) {
      setIsLoading(true);
    }
    if (!quiet) {
      setError(null);
    }

    try {
      const payload = await PointGroupingService.load(lang, { live: true, force: quiet });
      setData(payload.map);
      setPoints(payload.points);
    } catch (loadError: any) {
      console.error('Failed to load centers map', loadError);
      if (!quiet || !data) {
        setError(loadError?.message || labels.loadFailed);
      }
      if (!quiet && !data) {
        setData(null);
        setPoints([]);
      }
    } finally {
      if (shouldShowLoader) {
        setIsLoading(false);
      }
    }
  });

  useEffect(() => {
    void loadData();
  }, [lang, loadData]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleRefresh = () => {
      void loadData({ quiet: true });
    };

    window.addEventListener('centers-map:refresh', handleRefresh);

    return () => {
      window.removeEventListener('centers-map:refresh', handleRefresh);
    };
  }, [loadData]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void loadData({ quiet: true });
    }, AUTO_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadData({ quiet: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  const sourceRegions = data?.map.regions ?? [];
  const districtLayout = useMemo(
    () => DynamicDistrictLayoutEngine.build(data?.map, sourceRegions, viewportSize.width, viewportSize.height),
    [data?.map, sourceRegions, viewportSize.height, viewportSize.width],
  );
  const regions = districtLayout.regions;
  const regionCount = regions.length;

  const pointsByCenter = useMemo(() => PointGroupingService.groupByCenter(points), [points]);

  const regionPaths = useMemo(() => {
    const { regionPaths: paths } = SharedBorderGenerator.generate(regions, regionCount);
    return paths;
  }, [regions, regionCount]);

  const regionPlans = useMemo(() => {
    const nextPlans = new Map<number, RegionRenderPlan>();
    regions.forEach(region => {
      const visualWeight = RegionWeightCalculator.calculate(region);
      nextPlans.set(
        region.id,
        PointCardLayoutEngine.computeRegionRenderPlan(
          region,
          pointsByCenter.get(region.id) || [],
          visualWeight,
          lang === 'ar' ? 'ar' : 'en',
        ),
      );
    });
    return nextPlans;
  }, [lang, pointsByCenter, regions]);

  useEffect(() => {
    if (!regions.length) {
      setActiveRegionId(null);
      return;
    }
    if (activeRegionId && regions.some(region => region.id === activeRegionId)) return;
    setActiveRegionId(regions[0].id);
  }, [activeRegionId, regions]);

  const stageViewBox = useMemo(
    () => MapViewportFitter.fitMap(
      data?.map ? { ...data.map, content_bbox: districtLayout.contentBBox } : data?.map,
      regions,
      viewportSize.width,
      viewportSize.height,
    ),
    [data?.map, districtLayout.contentBBox, regions, viewportSize.height, viewportSize.width],
  );

  const infoBoxX = stageViewBox.minX + (stageViewBox.width / 2);
  const infoBoxY = stageViewBox.minY + (stageViewBox.height / 2);
  const smoothLandmassPath = districtLayout.landmassPath
    ? SmoothPathFactory.closedFromPath(districtLayout.landmassPath, 0.5)
    : '';

  return (
    <FullScreenMonitoringLayout>
      <svg
        viewBox={`${stageViewBox.minX} ${stageViewBox.minY} ${stageViewBox.width} ${stageViewBox.height}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMaxYMid meet"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="monitorBackgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8f4f8" />
            <stop offset="50%" stopColor="#d6eef6" />
            <stop offset="100%" stopColor="#c4e4f0" />
          </linearGradient>
          <radialGradient id="monitorGlowGradient" cx="40%" cy="20%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="monitorMessageShadow" x="-20%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="rgba(15,23,42,0.18)" />
          </filter>
          <filter id="monitorWaterGlow" x="-20%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(56,189,248,0.18)" />
          </filter>
          <filter id="monitorRegionShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="rgba(74, 117, 151, 0.12)" />
          </filter>
          <filter id="monitorCardShadow" x="-25%" y="-25%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(32, 56, 85, 0.14)" />
          </filter>
          <filter id="monitorCardLight" x="-40%" y="-40%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="rgba(96,165,250,0.32)" />
          </filter>
          <filter id="monitorCardSoftGlow" x="-80%" y="-80%" width="260%" height="260%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="coloredGlow" />
            <feMerge>
              <feMergeNode in="coloredGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="centerLabelShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(15, 23, 42, 0.3)" />
          </filter>
          <filter id="monitorRegionLight" x="-22%" y="-22%" width="144%" height="144%">
            <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="rgba(255,255,255,0.28)" />
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="rgba(125,211,252,0.18)" />
          </filter>
          <filter id="monitorLandmassShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="rgba(68, 108, 143, 0.07)" />
          </filter>
        </defs>

        <rect x={stageViewBox.minX} y={stageViewBox.minY} width={stageViewBox.width} height={stageViewBox.height} fill="url(#monitorBackgroundGradient)" />
        <rect x={stageViewBox.minX} y={stageViewBox.minY} width={stageViewBox.width} height={stageViewBox.height} fill="url(#monitorGlowGradient)" />

        {error ? (
          <g filter="url(#monitorMessageShadow)">
            <rect
              x={infoBoxX - 220}
              y={infoBoxY - 48}
              width={440}
              height={96}
              rx="24"
              fill="rgba(255,255,255,0.96)"
              stroke="rgba(220,38,38,0.18)"
              strokeWidth="1.8"
            />
            <text x={infoBoxX} y={infoBoxY + 8} textAnchor="middle" fontSize="18" fontWeight={700} fill="#991b1b">
              {error}
            </text>
          </g>
        ) : null}

        {!data || !regions.length ? (
          <g filter="url(#monitorMessageShadow)">
            <rect
              x={infoBoxX - 214}
              y={infoBoxY - 48}
              width={428}
              height={96}
              rx="24"
              fill="rgba(255,255,255,0.96)"
              stroke="rgba(15,23,42,0.08)"
              strokeWidth="1.8"
            />
            <text x={infoBoxX} y={infoBoxY + 8} textAnchor="middle" fontSize="18" fontWeight={700} fill="#172033">
              {isLoading ? labels.loading : labels.noData}
            </text>
          </g>
        ) : (
          <g>
            {smoothLandmassPath ? (
              <path
                d={smoothLandmassPath}
                fill="rgba(255,255,255,0.06)"
                stroke="none"
                filter="url(#monitorLandmassShadow)"
              />
            ) : null}

            {data.map.waterways.map((waterway, index) => (
              <path
                key={`waterway-${index}`}
                d={waterway}
                fill="none"
                stroke="rgba(56,189,248,0.12)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                filter="url(#monitorWaterGlow)"
              />
            ))}

            {regions.map(region => (
              <RegionRenderer
                key={region.id}
                region={region}
                regionPlan={regionPlans.get(region.id) || PointCardLayoutEngine.computeRegionRenderPlan(region, [], RegionWeightCalculator.calculate(region), lang === 'ar' ? 'ar' : 'en')}
                points={pointsByCenter.get(region.id) || []}
                lang={lang === 'ar' ? 'ar' : 'en'}
                isActive={activeRegionId === region.id}
                onActivate={setActiveRegionId}
                layer="surface"
                regionPath={regionPaths.get(region.id) || ''}
              />
            ))}

            {regions.map(region => (
              <RegionRenderer
                key={`overlay-${region.id}`}
                region={region}
                regionPlan={regionPlans.get(region.id) || PointCardLayoutEngine.computeRegionRenderPlan(region, [], RegionWeightCalculator.calculate(region), lang === 'ar' ? 'ar' : 'en')}
                points={pointsByCenter.get(region.id) || []}
                lang={lang === 'ar' ? 'ar' : 'en'}
                isActive={activeRegionId === region.id}
                onActivate={setActiveRegionId}
                layer="overlay"
                regionPath={regionPaths.get(region.id) || ''}
              />
            ))}
          </g>
        )}
      </svg>
    </FullScreenMonitoringLayout>
  );
};
