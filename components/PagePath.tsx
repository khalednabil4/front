import React from 'react';
import { Home } from 'lucide-react';
import { Language } from '../types';
import { DICTIONARY } from '../constants';

interface PagePathProps { currentView: string; lang: Language }

const VIEW_TO_COMPONENT: Record<string, string> = {
  dashboard: 'Dashboard',
  areas: 'AreaForm',
  stations: 'StationsList',
  'centers-map': 'CentersMapPage',
  reports: 'ReportsView',
  'points-charts': 'PointsChartsPage',
  'stations-work': 'StationsWorkbenchPage',
  profile: 'ProfileView',
  companies: 'CompaniesView',
  dm: 'DmView',
  centers: 'CentersView',
  villages: 'VillagesView',
  points: 'PointsView',
  readings: 'ReadingsView',
  'water-valves': 'MetaListView',
  'report-v1': 'ReportV1',
  permissions: 'PermissionsManager',
};

const PagePath: React.FC<PagePathProps> = ({ currentView, lang }) => {
  const t = DICTIONARY[lang] || (DICTIONARY.en as any);
  const human = (t as any)[currentView]
    || (currentView === 'centers-map' ? (lang === 'ar' ? 'خريطة المراكز' : 'Centers Map') : '')
    || (currentView === 'report-v1' ? 'Report V1' : '')
    || (currentView === 'points-charts' ? (lang === 'ar' ? 'مخططات النقاط' : 'Points Charts') : '')
    || (currentView === 'stations-work' ? (lang === 'ar' ? 'تشغيل المحطات' : 'Stations Work') : currentView);
  const comp = VIEW_TO_COMPONENT[currentView] || '';
  const path = `/${currentView}`;

  return (
    <div className="mb-4 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
      <Home size={14} />
      <div className="truncate">
        <div className="font-medium text-slate-700 dark:text-white">{human}</div>
        <div className="text-xs text-slate-400">{path}{comp ? ` | ${comp}` : ''}</div>
      </div>
    </div>
  );
};

export default PagePath;
