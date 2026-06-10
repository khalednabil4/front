import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Search, CheckCircle2, AlertTriangle, Loader2, LockKeyhole } from 'lucide-react';
import { AuthMetadata, Language } from '../types';
import { DICTIONARY } from '../constants';
import { authFetch } from '../lib/auth';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

type PermissionRecord = {
  id: number;
  codename: string;
  name: string;
  model: string;
  app: string;
};

type GroupRecord = {
  id: number;
  name: string;
};

interface PermissionsPageProps {
  lang: Language;
  sessionMeta?: AuthMetadata | null;
}

const signalLoading = (start: boolean) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(start ? 'app:loading:start' : 'app:loading:stop'));
  }
};

export const PermissionsPage: React.FC<PermissionsPageProps> = ({ lang, sessionMeta }) => {
  const t = DICTIONARY[lang];
  const isSuperAdmin = Boolean(sessionMeta?.isSuperuser);

  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [isGroupDetailsLoading, setIsGroupDetailsLoading] = useState(false);

  const filteredPermissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((permission) =>
      [permission.codename, permission.name, permission.model, permission.app].some((value) => value?.toLowerCase().includes(q))
    );
  }, [permissions, search]);

  const loadPermissions = async () => {
    if (!isSuperAdmin) {
      setMessage({ type: 'error', text: t.staffOnly });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    signalLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/permissions/all`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const items = Array.isArray(data?.results) ? data.results : [];
      setPermissions(items);
    } catch (err) {
      console.error('Failed to load permissions', err);
      setMessage({ type: 'error', text: t.permissionsLoadFailed });
    } finally {
      setIsLoading(false);
      signalLoading(false);
    }
  };

  const loadGroups = async () => {
    if (!isSuperAdmin) return;

    setIsGroupsLoading(true);
    signalLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/groups/`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const items = Array.isArray((data as any)?.results) ? (data as any).results : Array.isArray(data) ? data : [];
      const normalized = items
        .map((group: any) => ({ id: Number(group?.id), name: typeof group?.name === 'string' ? group.name : '' }))
        .filter((group) => group.id && group.name);
      setGroups(normalized);
    } catch (err) {
      console.error('Failed to load groups', err);
      setMessage({ type: 'error', text: t.groupsLoadFailed });
    } finally {
      setIsGroupsLoading(false);
      signalLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) {
      setPermissions([]);
      setGroups([]);
      setSelected([]);
      setMessage({ type: 'error', text: t.staffOnly });
      return;
    }

    loadPermissions();
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, isSuperAdmin]);

  const hydrateGroup = async (id: number) => {
    if (!isSuperAdmin) return;

    setIsGroupDetailsLoading(true);
    signalLoading(true);
    setMessage(null);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/groups/?group_id=${id}`, {
        headers: { 'Accept-Language': lang === 'ar' ? 'ar' : 'en' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const permissionIds = Array.isArray((data as any)?.permission_ids)
        ? (data as any).permission_ids.filter((value: any) => typeof value === 'number')
        : [];

      setSelected(permissionIds);
      setGroupName(typeof (data as any)?.name === 'string' ? (data as any).name : groupName);
      setSelectedGroupId((data as any)?.id || id);
    } catch (err) {
      console.error('Failed to load group permissions', err);
      setMessage({ type: 'error', text: t.groupLoadFailed });
    } finally {
      setIsGroupDetailsLoading(false);
      signalLoading(false);
    }
  };

  const handleGroupChange = (value: string) => {
    if (!value) {
      setSelectedGroupId(null);
      setGroupName('');
      setSelected([]);
      return;
    }

    const id = Number(value);
    if (Number.isNaN(id)) return;

    const found = groups.find((group) => group.id === id);
    if (found?.name) setGroupName(found.name);
    setSelected([]);
    setSelectedGroupId(id);
    hydrateGroup(id);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const selectAllFiltered = () => {
    const ids = filteredPermissions.map((permission) => permission.id);
    setSelected((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearSelection = () => setSelected([]);

  const submitGroup = async (event?: React.FormEvent | React.MouseEvent) => {
    if (!isSuperAdmin) {
      setMessage({ type: 'error', text: t.staffOnly });
      return;
    }

    event?.preventDefault();
    setMessage(null);
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setMessage({ type: 'error', text: t.validation_required || 'Name is required' });
      return;
    }

    const modeToUse: 'create' | 'update' = selectedGroupId ? 'update' : 'create';
    if (modeToUse === 'update' && !selectedGroupId) {
      setMessage({ type: 'error', text: t.groupSelectionRequired });
      return;
    }

    setIsSaving(true);
    signalLoading(true);
    try {
      const bodyPayload: Record<string, any> = { name: trimmedName, permission_ids: selected };
      if (modeToUse === 'update' && selectedGroupId) {
        bodyPayload.group_id = selectedGroupId;
      }

      const res = await authFetch(`${API_BASE_URL}/api/groups/manage`, {
        method: modeToUse === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': lang === 'ar' ? 'ar' : 'en',
        },
        body: JSON.stringify(bodyPayload),
      });

      const text = await res.text();
      let payload: any = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }

      if (!res.ok) {
        throw new Error(payload?.detail || `HTTP ${res.status}`);
      }

      if (Array.isArray(payload?.permission_ids)) {
        setSelected(payload.permission_ids);
      }
      if (payload?.id) {
        setSelectedGroupId(payload.id);
      }
      if (payload?.name) {
        setGroupName(payload.name);
      }

      loadGroups();
      setMessage({ type: 'success', text: t.permissionsSaveSuccess });
    } catch (err) {
      console.error('Failed to save group permissions', err);
      setMessage({ type: 'error', text: t.permissionsSaveError });
    } finally {
      setIsSaving(false);
      signalLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-water-600 dark:text-water-300">
              <ShieldCheck size={20} />
              <p className="text-sm font-semibold uppercase tracking-wide">{t.permissions}</p>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{t.permissionsPageTitle}</h1>
            <p className="text-slate-500 dark:text-slate-300 mt-1">{t.permissionsPageSubtitle}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-2">
              <LockKeyhole size={14} />
              {t.staffOnly}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadPermissions}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              {t.refresh}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300 text-xs uppercase font-semibold tracking-wide">
            <ShieldCheck size={16} />
            {t.sessionPermissions}
          </div>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-200">
            <div>
              <p className="font-semibold text-slate-700 dark:text-white mb-2">{t.sessionPermissions}</p>
              <div className="space-y-2 max-h-44 overflow-auto pr-1">
                {sessionMeta?.permissions?.length ? (
                  sessionMeta.permissions.map((permission, idx) => (
                    <div key={`${permission.model}-${idx}`} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700">
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{permission.model}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">{permission.actions.join(', ')}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">{t.noSessionPermissions}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-5 space-y-4">
          <form onSubmit={(event) => submitGroup(event)} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300">
                {t.groupSelectorLabel}
              </label>
              <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                <select
                  value={selectedGroupId ?? ''}
                  onChange={(event) => handleGroupChange(event.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
                >
                  <option value="">{t.groupSelectorPlaceholder}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadGroups}
                  disabled={isGroupsLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 text-sm disabled:opacity-60"
                >
                  {isGroupsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  <span>{t.refreshGroups || t.refresh}</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-300">{t.groupAutoSelectHint}</p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.searchPermissions}
                  className="w-full md:w-64 max-w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
                />
                <Search size={16} className="text-slate-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-300">
                  {t.selectedCount}: {selected.length}
                </span>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-sm"
                >
                  {t.selectAll}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-100 text-sm"
                >
                  {t.clearSelection}
                </button>
              </div>
            </div>

            <div className="border border-slate-100 dark:border-slate-700 rounded-lg max-h-[65vh] md:max-h-[70vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {(isLoading || isGroupDetailsLoading) && (
                <div className="p-4 flex items-center gap-2 text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  {t.processing}
                </div>
              )}
              {!(isLoading || isGroupDetailsLoading) && !filteredPermissions.length && (
                <div className="p-4 text-sm text-slate-500">{t.noPermissionsFound}</div>
              )}
              {!(isLoading || isGroupDetailsLoading) && filteredPermissions.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(permission.id)}
                    onChange={() => toggleSelect(permission.id)}
                    className="mt-1 w-4 h-4 accent-water-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-800 dark:text-white">{permission.name}</p>
                      <span className="text-[11px] uppercase tracking-wide text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        {permission.app} • {permission.model}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{permission.codename}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">
                  {t.groupNameLabel}
                </label>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-water-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-300 mb-1">
                  {t.operationLabel}
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(event) => submitGroup(event)}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm transition bg-water-600 text-white border-water-700 hover:bg-water-700"
                  >
                    {t.createNew}
                  </button>
                </div>
              </div>
            </div>

            {message && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success'
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                  : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-200'
                  }`}
              >
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{message.text}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-water-600 text-white font-semibold hover:bg-water-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                {t.saveGroup}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
