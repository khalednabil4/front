export interface RegionStats {
  villages_count: number;
  groups_count: number;
  points_count: number;
  active_points: number;
  inactive_points: number;
  visual_weight?: number;
}

export interface ProvinceRef {
  id: number;
  name: string;
}

export interface LabelPayload {
  x: number;
  y: number;
  line_height: number;
  title_lines: string[];
  title_font_size: number;
  subtitle?: string | null;
  subtitle_font_size: number;
  subtitle_y: number;
  show_subtitle: boolean;
  badge_x: number;
  badge_y: number;
  badge_radius: number;
  badge_font_size: number;
  show_badge: boolean;
  badge_value: number;
}

export interface PolygonPoint {
  x: number;
  y: number;
}

export interface PolygonBbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
}

export interface MapRegion {
  id: number;
  name: string;
  slug?: string | null;
  color: string;
  size: string;
  province?: ProvinceRef | null;
  path: string;
  bbox: PolygonBbox;
  label: LabelPayload;
  stats: RegionStats;
  map_position: Record<string, unknown>;
  layout_center?: {
    centerX: number;
    centerY: number;
    source: string;
  };
  map_shape: {
    points?: PolygonPoint[];
    [key: string]: unknown;
  };
}

export interface CentersMapResponse {
  summary: {
    centers_count: number;
    villages_count: number;
    groups_count: number;
    points_count: number;
    active_points: number;
    inactive_points: number;
    last_updated?: string | null;
  };
  map: {
    view_box: string;
    fit: {
      scale: number;
      translate_x: number;
      translate_y: number;
      bbox: PolygonBbox;
    };
    sea: {
      label: {
        x: number;
        y: number;
      };
    };
    landmass_path: string;
    outline_path: string;
    waterways: string[];
    internal_borders?: string[];
    content_bbox?: PolygonBbox;
    center_bbox?: PolygonBbox;
    regions: MapRegion[];
  };
}

export interface PointReadingPayload {
  id?: number | null;
  datetime?: string | null;
  flow?: number | null;
  pressure?: number | null;
  level?: number | null;
  totalizer?: number | null;
  unit_flow?: string | null;
  unit_pressure?: string | null;
  unit_level?: string | null;
  unit_totalizer?: string | null;
  display?: string | null;
  is_missing?: boolean;
}

export interface PointModbusPayload {
  protocol: string;
  device_ip?: string | null;
  port?: number | null;
  slave_id?: number | null;
  scheduled_mins?: number | null;
  is_configured?: boolean;
  registers?: Record<string, number> | null;
}

export interface CenterPoint {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  error_number?: number | null;
  point_type: string[];
  point_enter_type?: string | null;
  dma_id?: number | null;
  dmz_id?: number | null;
  dm_type?: string | null;
  dm_id?: number | null;
  center: number | null;
  modbus?: PointModbusPayload | null;
  reading?: PointReadingPayload | null;
}

export interface PointsLastReadingResponse {
  count: number;
  results: CenterPoint[];
}

export interface ParsedViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
  maxX: number;
  maxY: number;
}

export interface CenterLabelLayout {
  lines: string[];
  x: number;
  top: number;
  bottom: number;
  fontSize: number;
  lineHeight: number;
}

export interface PointCardPlacement {
  point: CenterPoint;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PointCardPlan {
  cards: PointCardPlacement[];
  showReading: boolean;
  codeFontSize: number;
  readingFontSize: number;
  paddingX: number;
  paddingY: number;
  gapX: number;
  gapY: number;
  borderRadius: number;
  borderWidth: number;
  relaxedFit: boolean;
}

export interface RegionRenderPlan {
  label: CenterLabelLayout;
  cards: PointCardPlan;
  visualWeight: number;
}
