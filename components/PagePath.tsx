import React from 'react';
import { Home } from 'lucide-react';
import { Language } from '../types';
import { DICTIONARY } from '../constants';

interface PagePathProps { currentView: string; lang: Language }

const VIEW_TO_COMPONENT: Record<string, string> = {
    dashboard: 'Dashboard',
    areas: 'AreaForm',
    stations: 'StationsList',
    reports: 'ReportsView',
    newpage: 'NewPage',
    'dynamic-table': 'DynamicTableView',
    'dynamic-create': 'DynamicCreateView',
    profile: 'ProfileView',
    companies: 'CompaniesView',
    dm: 'DmView',
    provinces: 'ProvincesView',
    centers: 'CentersView',
    villages: 'VillagesView',
    'device-types': 'DeviceTypesView',
    'measure-types': 'MeasureTypesView',
    'measure-devices': 'MeasureDevicesView',
    points: 'PointsView',
    readings: 'ReadingsView',
    'dma-field-surveys': 'DmaFieldSurveysView',
    'dmz-network-data': 'DmzNetworkDataView',
    units: 'UnitsView',
    'connection-types': 'ConnectionTypesView',
};

const PagePath: React.FC<PagePathProps> = ({ currentView, lang }) => {
    const t = DICTIONARY[lang] || (DICTIONARY['en'] as any);
    const human = (t as any)[currentView] || currentView;
    const comp = VIEW_TO_COMPONENT[currentView] || '';

    // Build a simple path string like: /home/dashboard or /home/newpage
    const path = `/${currentView}`;

    return (
        <div className="mb-4 text-sm text-slate-500 dark:text-slate-300 flex items-center gap-3">
            <Home size={14} />
            <div className="truncate">
                <div className="font-medium text-slate-700 dark:text-white">{human}</div>
                <div className="text-xs text-slate-400">{path}{comp ? ` — ${comp}` : ''}</div>
            </div>
        </div>
    );
};

export default PagePath;
