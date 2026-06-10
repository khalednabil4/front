
export interface Sensor {
  id: string;
  name: string; // اسم النقطة
  lineName: string; // اسم الخط
  pressure: number; // bar
  status: 'normal' | 'warning' | 'critical';
  lastReadingCurrent: string;
  lastReadingPrevious: string;
  total3MCurrent: number;
  total3MPrevious: number;
  dailyConsumption: number;
  history: { time: string; value: number }[];
}

export interface Pipe {
  id: string;
  name: string;
  sensors: Sensor[];
}

export interface Station {
  id: string;
  name: string;
  areaId: string;
  pipes: Pipe[];
  status: 'active' | 'maintenance' | 'offline';
}

export interface Area {
  id: string;
  companyName: string;
  name: string;
  code: string; // DMZ
  lineCount: number;
  valveCount: number;
  meterCount: number;
  areaSize: number; // m2
  managerName: string;
  readingsStartMonth: number;
  readingsStartYear: number;
  lat: number;
  lng: number;
}

export type Language = 'en' | 'ar';
export type Theme = 'light' | 'dark';
export type ColorTheme = 'blue' | 'emerald' | 'violet' | 'amber';
export type CursorStyle = 'default' | 'big' | 'focus';

// Removed 'sensors' from View, added 'profile'
// export type View = 'dashboard' | 'areas' | 'stations' | 'reports' | 'profile';

export interface ReportMetric {
  label: string;
  value: string | number;
  change: number; // percentage
  trend: 'up' | 'down' | 'neutral';
}

export interface PermissionSummary {
  model: string;
  actions: string[];
}

export interface AuthMetadata {
  userId?: number;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  permissions?: PermissionSummary[];
  isSuperuser?: boolean;
  isStaff?: boolean;
  company?: { id: number; name: string } | null;
  group?: { id: number; name: string } | null;
}

export type NotificationSeverity = 'error' | 'warn' | 'info';

export interface NotificationPoint {
  id: number;
  name: string;
  code: string;
  dma_id: number | null;
  dmz_id: number | null;
}

export interface NotificationCompany {
  id: number;
  name: string;
}

export interface Notification {
  id: number;
  notification_type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  source_path: string | null;
  created_at: string;
  point: NotificationPoint | null;
  function_schedule: unknown | null;
  company: NotificationCompany | null;
}

export interface NotificationSummary {
  total: number;
  by_severity: Partial<Record<NotificationSeverity, number>>;
  latest: Notification | null;
}

export interface DynamicField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required: boolean;
  options?: string[]; // For select type
  hidden?: boolean;
}

export interface DynamicSchema {
  entityName: string; // e.g., "User", "Product"
  fields: DynamicField[];
}

export type View =
  | 'dashboard'
  | 'areas'
  | 'stations'
  | 'reports'
  | 'points-charts'
  | 'stations-work'
  | 'profile'
  | 'report-v1'
  | 'damietta-map'
  | 'centers-map'
  | 'water-valves'
  | 'companies'
  | 'dm'
  | 'centers'
  | 'villages'
  | 'points'
  | 'readings'
  | 'permissions'
  | 'users';
